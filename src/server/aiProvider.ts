import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  CaseRecord,
  CDRRecord,
  IPDRRecord,
  CellTower,
} from '../shared/types.ts';
import {
  computeCaseAnalytics,
  formatDuration,
  isNightTimestamp,
} from '../shared/analytics.ts';

export type ConfiguredAiProvider = 'gemini';

export interface ConversationTurn {
  question: string;
  summary: string;
}

export interface AiProviderResult {
  rawText: string;
  provider: 'gemini';
  modelLabel: string;
}

export interface ClassifiedAiError {
  httpStatus: number;
  userMessage: string;
  isTransient: boolean;
}

export const AI_REQUEST_TIMEOUT_MS = Math.min(
  60000,
  Math.max(5000, Number(process.env.AI_REQUEST_TIMEOUT_MS) || 28000)
);

// Cooldown tracker so if gemini-4-hydrogen hits a transient 503/timeout spike,
// subsequent requests route straight to gemini-3.1-flash-lite for 60s without repeating the stall.
let primaryGeminiCooldownUntil = 0;
const PRIMARY_GEMINI_COOLDOWN_MS = 60 * 1000;

export function getConfiguredProviderMode(): ConfiguredAiProvider {
  return 'gemini';
}

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return key;
}

export function hasConfiguredAiProvider(): boolean {
  return Boolean(getGeminiApiKey());
}

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function classifyAiProviderError(err: unknown): ClassifiedAiError {
  const raw = err instanceof Error ? err.message : String(err || 'Unexpected AI provider error');
  const lower = raw.toLowerCase();

  if (
    (err instanceof Error && err.name === 'AbortError') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('etimedout') ||
    lower.includes('aborted')
  ) {
    return {
      httpStatus: 504,
      userMessage:
        'The AI analysis request timed out while waiting for a response. Please retry your question.',
      isTransient: true,
    };
  }

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('invalid_api_key') ||
    lower.includes('incorrect api key') ||
    lower.includes('401') ||
    lower.includes('403')
  ) {
    return {
      httpStatus: 403,
      userMessage:
        'AI provider authentication failed. Please verify the configured server API key in Settings > Secrets.',
      isTransient: false,
    };
  }

  if (
    lower.includes('resource_exhausted') ||
    lower.includes('rate_limit') ||
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('quota')
  ) {
    return {
      httpStatus: 429,
      userMessage:
        'AI provider rate limit or quota was reached. Please wait a few seconds and retry, or review your API quota in Settings > Secrets.',
      isTransient: true,
    };
  }

  if (
    lower.includes('unavailable') ||
    lower.includes('503') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('internal') ||
    lower.includes('fetch failed') ||
    lower.includes('econnreset')
  ) {
    return {
      httpStatus: 503,
      userMessage:
        'The AI provider is temporarily busy due to high demand. Please click Retry in a few seconds.',
      isTransient: true,
    };
  }

  return {
    httpStatus: 502,
    userMessage:
      'Unable to complete the AI analysis request due to an upstream service error. Please retry.',
    isTransient: false,
  };
}

export function extractJsonObjectText(raw: string): string {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

const FORENSIC_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description:
        'Direct, clear, accurate analytical answer to the investigator question strictly derived from case data.',
    },
    observedFacts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          statement: { type: Type.STRING },
          citation_ids: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    },
    analyticalPatterns: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    hypothesesForVerification: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    dataLimitations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['summary', 'observedFacts'],
};

async function callGeminiModelWithTimeout(
  aiClient: GoogleGenAI,
  model: string,
  userPrompt: string,
  systemInstruction: string,
  timeoutMs: number
): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      const timeoutErr = new Error(`Gemini API request timed out after ${timeoutMs}ms`);
      timeoutErr.name = 'AbortError';
      reject(timeoutErr);
    }, timeoutMs);
  });

  const config: Record<string, unknown> = {
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: FORENSIC_RESPONSE_SCHEMA,
    abortSignal: controller.signal,
  };

  if (model === 'gemini-4-hydrogen') {
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
  }

  try {
    const response = await Promise.race([
      aiClient.models.generateContent({
        model,
        contents: userPrompt,
        config,
      }),
      timeoutPromise,
    ]);
    return (response.text ?? '').trim();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runGeminiProvider(
  apiKey: string,
  userPrompt: string,
  systemInstruction: string,
  deadline: number
): Promise<AiProviderResult> {
  const aiClient = createGeminiClient(apiKey);
  const now = Date.now();
  const primaryInCooldown = now < primaryGeminiCooldownUntil;

  const attempts: Array<{ model: string; label: string; backoffMs: number; timeoutMs: number }> =
    primaryInCooldown
      ? [
          { model: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', backoffMs: 0, timeoutMs: 11000 },
          { model: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', backoffMs: 600, timeoutMs: 10000 },
          { model: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', backoffMs: 900, timeoutMs: 8500 },
        ]
      : [
          { model: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', backoffMs: 0, timeoutMs: 11500 },
          { model: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', backoffMs: 350, timeoutMs: 9500 },
          { model: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', backoffMs: 750, timeoutMs: 8500 },
        ];

  let lastErr: unknown = null;

  for (const step of attempts) {
    if (step.backoffMs > 0) {
      const remBeforeWait = deadline - Date.now();
      if (remBeforeWait <= 2000) break;
      await new Promise((r) => setTimeout(r, Math.min(step.backoffMs, remBeforeWait - 1500)));
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 1500) {
      const err = new Error('Gemini API request timed out.');
      err.name = 'AbortError';
      lastErr = err;
      break;
    }

    try {
      const rawText = await callGeminiModelWithTimeout(
        aiClient,
        step.model,
        userPrompt,
        systemInstruction,
        Math.min(remainingMs, step.timeoutMs)
      );
      if (!rawText) {
        throw new Error('Gemini returned an empty response.');
      }
      return { rawText, provider: 'gemini', modelLabel: step.label };
    } catch (err) {
      lastErr = err;
      const classified = classifyAiProviderError(err);
      if (step.model === 'gemini-4-hydrogen' && classified.isTransient) {
        primaryGeminiCooldownUntil = Date.now() + PRIMARY_GEMINI_COOLDOWN_MS;
      }
      if (!classified.isTransient) {
        throw err;
      }
    }
  }

  throw lastErr ?? new Error('Unable to obtain a response from Gemini API.');
}

export async function invokeConfiguredAiProvider(
  userPrompt: string,
  systemInstruction: string,
  totalTimeoutMs = AI_REQUEST_TIMEOUT_MS
): Promise<AiProviderResult> {
  const geminiKey = getGeminiApiKey();
  if (!geminiKey) {
    throw new Error('Gemini API key is not configured on the server.');
  }
  const deadline = Date.now() + totalTimeoutMs;
  return runGeminiProvider(geminiKey, userPrompt, systemInstruction, deadline);
}

// -----------------------------------------------------------------------------
// Question-Aware Forensic Case Evidence Retriever
// Computes exact aggregates, entity profiles, pairwise comparisons, IPDR
// summaries, repeated IPs, tower stats, and targeted verifiable source rows.
// -----------------------------------------------------------------------------
function normalizeDigits(val: string): string {
  return String(val || '').replace(/[^0-9]/g, '');
}

function cleanStr(s: string, maxLen = 120): string {
  return String(s || '').replace(/[\r\n\t<>]/g, ' ').trim().slice(0, maxLen);
}

export function buildForensicContextForQuestion(
  caseRecord: CaseRecord,
  cdrs: CDRRecord[],
  ipdrs: IPDRRecord[],
  towers: CellTower[],
  question: string,
  conversationHistory: ConversationTurn[] = []
) {
  const analytics = computeCaseAnalytics(caseRecord, cdrs, ipdrs, towers);
  const towerById = new Map(towers.map((t) => [t.cell_id, t]));
  const suspectByPhone = new Map(caseRecord.suspects.map((s) => [s.phoneNumber, s]));

  // Collect all known phone numbers across CDRs, IPDRs, and suspects
  const allPhones = new Set<string>();
  caseRecord.suspects.forEach((s) => s.phoneNumber && allPhones.add(s.phoneNumber));
  cdrs.forEach((r) => {
    if (r.caller_number) allPhones.add(r.caller_number);
    if (r.receiver_number) allPhones.add(r.receiver_number);
  });
  ipdrs.forEach((r) => {
    if (r.subscriber_id && r.subscriber_id !== 'Unmapped (CGNAT)') allPhones.add(r.subscriber_id);
  });

  // Helper to resolve phones, towers, and IPs from a text snippet
  const extractEntitiesFromText = (text: string) => {
    const lower = text.toLowerCase();
    const resolvedPhones = new Set<string>();

    // 1. Resolve suspect labels ("Suspect A") or aliases ("Arjun Dev")
    for (const s of caseRecord.suspects) {
      const labelLower = s.label.toLowerCase();
      const aliasLower = s.alias.toLowerCase();
      const aliasFirst = aliasLower.split(/\s+/)[0] || '';
      if (
        (labelLower.length >= 3 && lower.includes(labelLower)) ||
        (aliasLower.length >= 3 && lower.includes(aliasLower)) ||
        (aliasFirst.length >= 4 && lower.includes(aliasFirst))
      ) {
        resolvedPhones.add(s.phoneNumber);
      }
    }

    // 2. Resolve explicit phone numbers or 5+ digit numeric suffixes/tokens
    const numericTokens = (text.match(/\+?\d[\d\s-]{4,}\d/g) || [])
      .map((t) => normalizeDigits(t))
      .filter((d) => d.length >= 5);

    for (const tok of numericTokens) {
      for (const knownPhone of allPhones) {
        const knownDigits = normalizeDigits(knownPhone);
        if (knownDigits.endsWith(tok) || knownDigits.includes(tok) || tok.endsWith(knownDigits)) {
          resolvedPhones.add(knownPhone);
        }
      }
    }

    // 3. Resolve cell tower IDs or tower area names
    const resolvedTowers = new Set<string>();
    const towerTokens = (text.match(/\b(?:twr|cell|site)[-_a-z0-9]+\b/gi) || []).map((t) =>
      t.toLowerCase()
    );
    for (const t of towers) {
      const idLower = t.cell_id.toLowerCase();
      const areaLower = t.area.toLowerCase();
      if (
        towerTokens.some((tok) => idLower.includes(tok)) ||
        (areaLower.length >= 4 && lower.includes(areaLower))
      ) {
        resolvedTowers.add(t.cell_id);
      }
    }

    // 4. Resolve explicit IPv4 addresses
    const resolvedIps = new Set<string>(text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []);

    return {
      phones: Array.from(resolvedPhones),
      towers: Array.from(resolvedTowers),
      ips: Array.from(resolvedIps),
      rawNumericTokens: numericTokens,
    };
  };

  const currentEntities = extractEntitiesFromText(question);
  // If this is a follow-up question referencing "that number", "both", "they", "it", etc., inherit entities from the most recent turn
  const lastTurn = conversationHistory[conversationHistory.length - 1];
  const priorEntities = lastTurn
    ? extractEntitiesFromText(`${lastTurn.question} ${lastTurn.summary}`)
    : { phones: [], towers: [], ips: [], rawNumericTokens: [] };

  const targetPhones =
    currentEntities.phones.length > 0 ? currentEntities.phones : priorEntities.phones.slice(0, 3);
  const targetTowers =
    currentEntities.towers.length > 0 ? currentEntities.towers : priorEntities.towers.slice(0, 3);
  const targetIps =
    currentEntities.ips.length > 0 ? currentEntities.ips : priorEntities.ips.slice(0, 3);

  // Build detailed full-dataset profiles for each resolved phone number
  const matchedEntityProfiles = targetPhones.slice(0, 4).map((phone) => {
    const relatedCdrs = cdrs.filter(
      (r) => r.caller_number === phone || r.receiver_number === phone
    );
    const relatedIpdrs = ipdrs.filter((r) => r.subscriber_id === phone);

    let incoming = 0;
    let outgoing = 0;
    let sms = 0;
    let totalDur = 0;
    let nightCalls = 0;
    let firstSeen = '';
    let lastSeen = '';
    const imeis = new Set<string>();
    const imsis = new Set<string>();
    const counterparties = new Map<string, { calls: number; durationSec: number; sampleId: string }>();
    const towerHits = new Map<string, { hits: number; nightHits: number }>();

    for (const r of relatedCdrs) {
      const isCaller = r.caller_number === phone;
      const other = isCaller ? r.receiver_number : r.caller_number;
      if (r.call_type === 'SMS_IN' || r.call_type === 'SMS_OUT') sms += 1;
      else if (isCaller) outgoing += 1;
      else incoming += 1;

      totalDur += r.duration_seconds;
      if (isNightTimestamp(r.timestamp)) nightCalls += 1;
      if (!firstSeen || r.timestamp < firstSeen) firstSeen = r.timestamp;
      if (!lastSeen || r.timestamp > lastSeen) lastSeen = r.timestamp;

      if (isCaller && r.imei) imeis.add(r.imei);
      if (isCaller && r.imsi) imsis.add(r.imsi);

      if (other) {
        const cp = counterparties.get(other) || { calls: 0, durationSec: 0, sampleId: r.record_id };
        cp.calls += 1;
        cp.durationSec += r.duration_seconds;
        counterparties.set(other, cp);
      }

      if (r.cell_id) {
        const th = towerHits.get(r.cell_id) || { hits: 0, nightHits: 0 };
        th.hits += 1;
        if (isNightTimestamp(r.timestamp)) th.nightHits += 1;
        towerHits.set(r.cell_id, th);
      }
    }

    const voiceCount = incoming + outgoing;
    const sus = suspectByPhone.get(phone);
    return {
      phoneNumber: phone,
      suspectLabel: sus?.label || null,
      alias: sus?.alias || null,
      totalMatchingCdrs: relatedCdrs.length,
      incomingVoice: incoming,
      outgoingVoice: outgoing,
      smsCount: sms,
      totalDurationSec: totalDur,
      totalDurationFormatted: formatDuration(totalDur),
      avgVoiceDurationSec: voiceCount > 0 ? Math.round(totalDur / voiceCount) : 0,
      nightCalls,
      firstSeen,
      lastSeen,
      imeisUsed: Array.from(imeis),
      imsisUsed: Array.from(imsis),
      topCounterparties: Array.from(counterparties.entries())
        .sort((a, b) => b[1].calls - a[1].calls || b[1].durationSec - a[1].durationSec)
        .slice(0, 6)
        .map(([num, stats]) => ({
          phone: num,
          label: suspectByPhone.get(num)?.label || 'Contact',
          calls: stats.calls,
          totalDurationSec: stats.durationSec,
          totalDurationFormatted: formatDuration(stats.durationSec),
          sampleRecordId: stats.sampleId,
        })),
      towersUsed: Array.from(towerHits.entries())
        .sort((a, b) => b[1].hits - a[1].hits)
        .slice(0, 6)
        .map(([cellId, stats]) => ({
          cell_id: cellId,
          area: towerById.get(cellId)?.area || 'Unknown',
          hits: stats.hits,
          nightHits: stats.nightHits,
        })),
      totalMatchingIpdrs: relatedIpdrs.length,
      publicIpsUsed: Array.from(new Set(relatedIpdrs.map((i) => i.public_ip))),
      sampleCdrRecordIds: relatedCdrs.slice(0, 6).map((r) => r.record_id),
      sampleIpdrRecordIds: relatedIpdrs.slice(0, 4).map((r) => r.record_id),
    };
  });

  // Build pairwise comparison whenever 2+ target phones are resolved
  let entityComparison: Record<string, unknown> | null = null;
  if (matchedEntityProfiles.length >= 2) {
    const p1 = matchedEntityProfiles[0];
    const p2 = matchedEntityProfiles[1];
    const directCdrs = cdrs.filter(
      (r) =>
        (r.caller_number === p1.phoneNumber && r.receiver_number === p2.phoneNumber) ||
        (r.caller_number === p2.phoneNumber && r.receiver_number === p1.phoneNumber)
    );
    const directDur = directCdrs.reduce((acc, r) => acc + r.duration_seconds, 0);
    const directNight = directCdrs.filter((r) => isNightTimestamp(r.timestamp)).length;

    const p1Contacts = new Set<string>();
    const p2Contacts = new Set<string>();
    const p1Towers = new Set<string>();
    const p2Towers = new Set<string>();
    for (const r of cdrs) {
      if (r.caller_number === p1.phoneNumber || r.receiver_number === p1.phoneNumber) {
        const other = r.caller_number === p1.phoneNumber ? r.receiver_number : r.caller_number;
        if (other && other !== p2.phoneNumber) p1Contacts.add(other);
        if (r.cell_id) p1Towers.add(r.cell_id);
      }
      if (r.caller_number === p2.phoneNumber || r.receiver_number === p2.phoneNumber) {
        const other = r.caller_number === p2.phoneNumber ? r.receiver_number : r.caller_number;
        if (other && other !== p1.phoneNumber) p2Contacts.add(other);
        if (r.cell_id) p2Towers.add(r.cell_id);
      }
    }
    const sharedContacts = Array.from(p1Contacts).filter((c) => p2Contacts.has(c));
    const sharedTowers = Array.from(p1Towers)
      .filter((t) => p2Towers.has(t))
      .map((cellId) => ({ cell_id: cellId, area: towerById.get(cellId)?.area || 'Unknown' }));

    entityComparison = {
      numberA: p1.phoneNumber,
      labelA: p1.suspectLabel || 'Contact',
      numberB: p2.phoneNumber,
      labelB: p2.suspectLabel || 'Contact',
      directCommunicationsCount: directCdrs.length,
      directTotalDurationSec: directDur,
      directDurationFormatted: formatDuration(directDur),
      directNightCalls: directNight,
      directSampleRecordIds: directCdrs.slice(0, 6).map((r) => r.record_id),
      sharedContacts,
      sharedTowers,
      callFrequencyDelta: p1.totalMatchingCdrs - p2.totalMatchingCdrs,
      totalDurationDeltaSec: p1.totalDurationSec - p2.totalDurationSec,
    };
  }

  // Pairwise top communicating phone pairs across the full case CDR dataset
  const pairMap = new Map<
    string,
    { a: string; b: string; calls: number; durationSec: number; nightCalls: number; sampleRecordId: string }
  >();
  for (const r of cdrs) {
    if (!r.caller_number || !r.receiver_number) continue;
    const [a, b] =
      r.caller_number < r.receiver_number
        ? [r.caller_number, r.receiver_number]
        : [r.receiver_number, r.caller_number];
    const key = `${a}|${b}`;
    const entry = pairMap.get(key) || {
      a,
      b,
      calls: 0,
      durationSec: 0,
      nightCalls: 0,
      sampleRecordId: r.record_id,
    };
    entry.calls += 1;
    entry.durationSec += r.duration_seconds;
    if (isNightTimestamp(r.timestamp)) entry.nightCalls += 1;
    pairMap.set(key, entry);
  }
  const topCommunicatingPairs = Array.from(pairMap.values())
    .sort((x, y) => y.calls - x.calls || y.durationSec - x.durationSec)
    .slice(0, 10)
    .map((p) => ({
      numberA: p.a,
      labelA: suspectByPhone.get(p.a)?.label || 'Contact',
      numberB: p.b,
      labelB: suspectByPhone.get(p.b)?.label || 'Contact',
      totalCalls: p.calls,
      totalDurationSec: p.durationSec,
      totalDurationFormatted: formatDuration(p.durationSec),
      nightCalls: p.nightCalls,
      sampleRecordId: p.sampleRecordId,
    }));

  // Complete IPDR aggregates & repeated IP analysis across ALL case IPDRs
  const publicIpStats = new Map<
    string,
    {
      sessions: number;
      subscribers: Set<string>;
      protocols: Set<string>;
      destinations: Set<string>;
      firstSeen: string;
      lastSeen: string;
      sampleRecordIds: string[];
    }
  >();
  const destEndpointCounts = new Map<string, { count: number; service: string; protocol: string }>();
  const subIpdrCounts = new Map<string, number>();
  let mappedIpdrCount = 0;
  let nightIpdrCount = 0;

  for (const r of ipdrs) {
    if (isNightTimestamp(r.session_start)) nightIpdrCount += 1;
    if (r.subscriber_id && r.subscriber_id !== 'Unmapped (CGNAT)') {
      mappedIpdrCount += 1;
      subIpdrCounts.set(r.subscriber_id, (subIpdrCounts.get(r.subscriber_id) || 0) + 1);
    }
    if (r.public_ip) {
      const entry = publicIpStats.get(r.public_ip) || {
        sessions: 0,
        subscribers: new Set<string>(),
        protocols: new Set<string>(),
        destinations: new Set<string>(),
        firstSeen: r.session_start,
        lastSeen: r.session_start,
        sampleRecordIds: [],
      };
      entry.sessions += 1;
      if (r.subscriber_id) entry.subscribers.add(r.subscriber_id);
      if (r.protocol) entry.protocols.add(r.protocol);
      if (r.destination_ip) entry.destinations.add(`${r.destination_ip}:${r.destination_port}`);
      if (r.session_start < entry.firstSeen) entry.firstSeen = r.session_start;
      if (r.session_start > entry.lastSeen) entry.lastSeen = r.session_start;
      if (entry.sampleRecordIds.length < 4) entry.sampleRecordIds.push(r.record_id);
      publicIpStats.set(r.public_ip, entry);
    }
    const destKey = `${r.destination_ip}:${r.destination_port}`;
    const destEntry = destEndpointCounts.get(destKey) || {
      count: 0,
      service: r.service_indicator,
      protocol: r.protocol,
    };
    destEntry.count += 1;
    destEndpointCounts.set(destKey, destEntry);
  }

  const repeatedPublicIps = Array.from(publicIpStats.entries())
    .filter(([, s]) => s.sessions >= 2)
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .slice(0, 12)
    .map(([ip, s]) => ({
      public_ip: ip,
      sessionCount: s.sessions,
      subscribers: Array.from(s.subscribers),
      protocols: Array.from(s.protocols),
      sampleDestinations: Array.from(s.destinations).slice(0, 4),
      firstSeen: s.firstSeen,
      lastSeen: s.lastSeen,
      sampleRecordIds: s.sampleRecordIds,
    }));

  // Top contacts sorted by frequency and by total duration
  const topByFrequency = analytics.topContacts.slice(0, 12);
  const topByDuration = [...analytics.topContacts]
    .sort((a, b) => b.totalDurationSec - a.totalDurationSec || b.totalCalls - a.totalCalls)
    .slice(0, 12);
  const longestIndividualCdrs = [...cdrs]
    .sort((a, b) => b.duration_seconds - a.duration_seconds)
    .slice(0, 5);

  // Select targeted sample CDR & IPDR rows most relevant to the investigator's question
  const q = question.toLowerCase();
  const matchedCdrsForEntities = cdrs.filter(
    (r) =>
      targetPhones.includes(r.caller_number) ||
      targetPhones.includes(r.receiver_number) ||
      targetTowers.includes(r.cell_id) ||
      currentEntities.rawNumericTokens.some((tok) => normalizeDigits(r.imei).includes(tok))
  );
  const matchedIpdrsForEntities = ipdrs.filter(
    (r) =>
      targetPhones.includes(r.subscriber_id) ||
      targetIps.includes(r.public_ip) ||
      targetIps.includes(r.destination_ip)
  );

  const topContactRecordIds = new Set<string>([
    ...topByFrequency.slice(0, 8).map((c) => c.sampleRecordId),
    ...topByDuration.slice(0, 8).map((c) => c.sampleRecordId),
    ...topCommunicatingPairs.slice(0, 6).map((p) => p.sampleRecordId),
  ]);

  let thematicCdrs: CDRRecord[] = [];
  if (q.includes('night') || q.includes('10 pm') || q.includes('5 am') || q.includes('रात')) {
    thematicCdrs = cdrs.filter((r) => isNightTimestamp(r.timestamp)).slice(0, 20);
  } else if (q.includes('imei') || q.includes('sim') || q.includes('device')) {
    const alertIds = new Set(analytics.deviceAlerts.flatMap((a) => a.supportingRecordIds));
    thematicCdrs = cdrs.filter((r) => alertIds.has(r.record_id)).slice(0, 20);
  } else if (q.includes('tower') || q.includes('location') || q.includes('cell') || q.includes('टावर')) {
    const towerRecIds = new Set(analytics.towerStats.flatMap((t) => t.sampleRecordIds.slice(0, 3)));
    thematicCdrs = cdrs.filter((r) => towerRecIds.has(r.record_id)).slice(0, 20);
  } else if (q.includes('duration') || q.includes('longest')) {
    thematicCdrs = longestIndividualCdrs;
  } else {
    const commonIds = new Set(analytics.commonContacts.flatMap((c) => c.supportingRecordIds.slice(0, 3)));
    thematicCdrs = cdrs.filter((r) => commonIds.has(r.record_id)).slice(0, 15);
  }

  const seenCdrIds = new Set<string>();
  const selectedCdrs: CDRRecord[] = [];
  const wantsAllEntityRecords =
    targetPhones.length === 1 &&
    (q.includes('all record') || q.includes('show record') || q.includes('associated with') || q.includes('history'));
  const maxCdrSamples = wantsAllEntityRecords ? 35 : 30;

  const importedCdrs = cdrs.filter((r) => r.record_id.startsWith('CDR-IMP-')).slice(0, 8);
  const topContactSampleCdrs = cdrs.filter((r) => topContactRecordIds.has(r.record_id));

  for (const r of [
    ...matchedCdrsForEntities.slice(0, wantsAllEntityRecords ? 35 : 18),
    ...thematicCdrs,
    ...topContactSampleCdrs,
    ...importedCdrs,
    ...cdrs.slice(0, 10),
  ]) {
    if (!seenCdrIds.has(r.record_id)) {
      seenCdrIds.add(r.record_id);
      selectedCdrs.push(r);
      if (selectedCdrs.length >= maxCdrSamples) break;
    }
  }

  const seenIpdrIds = new Set<string>();
  const selectedIpdrs: IPDRRecord[] = [];
  const repeatedIpSampleIds = new Set(repeatedPublicIps.flatMap((ip) => ip.sampleRecordIds.slice(0, 2)));
  const repeatedIpRows = ipdrs.filter((r) => repeatedIpSampleIds.has(r.record_id));
  const importedIpdrs = ipdrs.filter((r) => r.record_id.startsWith('IPDR-IMP-')).slice(0, 6);

  for (const r of [
    ...matchedIpdrsForEntities.slice(0, 12),
    ...repeatedIpRows,
    ...importedIpdrs,
    ...ipdrs.slice(0, 12),
  ]) {
    if (!seenIpdrIds.has(r.record_id)) {
      seenIpdrIds.add(r.record_id);
      selectedIpdrs.push(r);
      if (selectedIpdrs.length >= 18) break;
    }
  }

  return {
    caseMeta: {
      caseNumber: cleanStr(caseRecord.caseNumber),
      title: cleanStr(caseRecord.title),
      status: caseRecord.status,
      datasets: caseRecord.datasets.map((ds) => ({
        fileName: cleanStr(ds.fileName),
        fileType: ds.fileType,
        operator: cleanStr(ds.operator),
        recordCount: ds.recordCount,
      })),
      suspects: caseRecord.suspects.map((s) => ({
        label: cleanStr(s.label),
        alias: cleanStr(s.alias),
        phone: cleanStr(s.phoneNumber),
        primaryImei: cleanStr(s.primaryImei),
        operator: cleanStr(s.operator),
      })),
    },
    queryFocusedRetrieval: {
      resolvedPhones: targetPhones,
      resolvedTowers: targetTowers,
      resolvedIps: targetIps,
      unmatchedNumericTokens: currentEntities.rawNumericTokens.filter(
        (tok) => !targetPhones.some((p) => normalizeDigits(p).includes(tok))
      ),
      matchedEntityProfiles,
      entityComparison,
    },
    computedAggregates: {
      totalCdrs: analytics.totalCdrs,
      totalIpdrs: analytics.totalIpdrs,
      uniqueNumbers: analytics.uniqueNumbers,
      incomingCount: analytics.incomingCount,
      outgoingCount: analytics.outgoingCount,
      smsCount: analytics.smsCount,
      totalDurationSec: analytics.totalDurationSec,
      totalDurationFormatted: formatDuration(analytics.totalDurationSec),
      avgDurationSec: analytics.avgDurationSec,
      nightCallCount22To05UTC: analytics.nightCallCount,
      dateRange: {
        firstTimestamp: analytics.firstTimestamp,
        lastTimestamp: analytics.lastTimestamp,
      },
      dataQualityScore: analytics.dataQualityScore,
      topContactsByCallFrequency: topByFrequency.map((c, idx) => ({
        rank: idx + 1,
        phone: c.phoneNumber,
        label: c.label || 'Contact',
        totalCalls: c.totalCalls,
        incoming: c.incomingCalls,
        outgoing: c.outgoingCalls,
        sms: c.smsCount,
        totalDurationSec: c.totalDurationSec,
        totalDurationFormatted: formatDuration(c.totalDurationSec),
        avgDurationSec: c.avgDurationSec,
        nightCalls: c.nightCalls,
        sampleRecordId: c.sampleRecordId,
      })),
      topContactsByTotalDuration: topByDuration.map((c, idx) => ({
        rank: idx + 1,
        phone: c.phoneNumber,
        label: c.label || 'Contact',
        totalDurationSec: c.totalDurationSec,
        totalDurationFormatted: formatDuration(c.totalDurationSec),
        totalCalls: c.totalCalls,
        incoming: c.incomingCalls,
        outgoing: c.outgoingCalls,
        avgDurationSec: c.avgDurationSec,
        sampleRecordId: c.sampleRecordId,
      })),
      topCommunicatingPairs,
      longestSingleCalls: longestIndividualCdrs.map((r) => ({
        record_id: r.record_id,
        caller: cleanStr(r.caller_number),
        receiver: cleanStr(r.receiver_number),
        duration_sec: r.duration_seconds,
        durationFormatted: formatDuration(r.duration_seconds),
        timestamp: r.timestamp,
      })),
      commonContactsBetweenSuspects: analytics.commonContacts.slice(0, 8),
      deviceAlerts: analytics.deviceAlerts,
      towerUsage: analytics.towerStats.slice(0, 12).map((t) => ({
        cell_id: t.cell_id,
        tower_name: t.tower_name,
        area: t.area,
        operator: t.operator,
        totalHits: t.totalHits,
        nightHits: t.nightHits,
        uniqueNumbersCount: t.uniqueNumbers.length,
        suspectLabels: t.suspectLabels,
        firstSeen: t.firstSeen,
        lastSeen: t.lastSeen,
        sampleRecordIds: t.sampleRecordIds.slice(0, 4),
      })),
      unusualFrequencyPatterns: analytics.unusualPatterns,
      ipdrSummary: {
        totalSessions: ipdrs.length,
        mappedSessions: mappedIpdrCount,
        unmappedCgnatSessions: ipdrs.length - mappedIpdrCount,
        nightSessions22To05UTC: nightIpdrCount,
        uniquePublicIps: publicIpStats.size,
        repeatedPublicIps,
        topDestinationEndpoints: Array.from(destEndpointCounts.entries())
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 8)
          .map(([endpoint, meta]) => ({ endpoint, ...meta })),
        topSubscribersByIpdr: Array.from(subIpdrCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([subscriber, sessions]) => ({ subscriber, sessions })),
      },
    },
    sampleCdrRecords: selectedCdrs.map((r) => ({
      record_id: r.record_id,
      caller: cleanStr(r.caller_number),
      receiver: cleanStr(r.receiver_number),
      type: r.call_type,
      timestamp: r.timestamp,
      duration_sec: r.duration_seconds,
      cell_id: cleanStr(r.cell_id),
      imei: cleanStr(r.imei),
      imsi: cleanStr(r.imsi),
      source_file: cleanStr(r.source_file),
      source_row: r.source_row,
    })),
    sampleIpdrRecords: selectedIpdrs.map((r) => ({
      record_id: r.record_id,
      public_ip: cleanStr(r.public_ip),
      src_port: r.source_port,
      dst_ip: cleanStr(r.destination_ip),
      dst_port: r.destination_port,
      start: r.session_start,
      end: r.session_end,
      subscriber: cleanStr(r.subscriber_id),
      protocol: r.protocol,
      service: cleanStr(r.service_indicator),
      source_file: cleanStr(r.source_file),
      source_row: r.source_row,
    })),
  };
}
