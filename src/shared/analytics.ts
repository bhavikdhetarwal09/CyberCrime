import type {
  CaseRecord,
  CDRRecord,
  CellTower,
  IPDRRecord,
  AIResponsePayload,
  EvidenceCitation,
  AIObservedFact,
} from './types.ts';

export interface ContactSummary {
  phoneNumber: string;
  label?: string;
  isSuspect: boolean;
  totalCalls: number;
  incomingCalls: number;
  outgoingCalls: number;
  smsCount: number;
  totalDurationSec: number;
  avgDurationSec: number;
  nightCalls: number;
  firstContact: string;
  lastContact: string;
  uniqueCounterparts: number;
  sampleRecordId: string;
}

export interface CommonContactFinding {
  phoneNumber: string;
  connectedSuspects: string[];
  connectedSuspectLabels: string[];
  totalCalls: number;
  totalDurationSec: number;
  nightCalls: number;
  supportingRecordIds: string[];
}

export interface DeviceChangeAlert {
  id: string;
  type: 'IMEI_CHANGE' | 'SIM_SWAP';
  primaryIdentifier: string;
  associatedIdentifiers: string[];
  suspectLabel?: string;
  firstSeen: string;
  lastSeen: string;
  recordCount: number;
  confidenceNote: string;
  supportingRecordIds: string[];
}

export interface TowerUsageStat {
  cell_id: string;
  tower_name: string;
  area: string;
  latitude: number;
  longitude: number;
  operator: string;
  totalHits: number;
  uniqueNumbers: string[];
  suspectLabels: string[];
  nightHits: number;
  firstSeen: string;
  lastSeen: string;
  sampleRecordIds: string[];
}

export interface UnusualFrequencyAlert {
  phoneNumber: string;
  suspectLabel?: string;
  callCount: number;
  shortCallRatio: number;
  outgoingRatio: number;
  avgDurationSec: number;
  reason: string;
  sampleRecordId: string;
}

export interface CaseAnalyticsSummary {
  totalCdrs: number;
  totalIpdrs: number;
  uniqueNumbers: number;
  networkEdgesCount: number;
  dataQualityScore: number;
  incomingCount: number;
  outgoingCount: number;
  smsCount: number;
  totalDurationSec: number;
  avgDurationSec: number;
  nightCallCount: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  topContacts: ContactSummary[];
  commonContacts: CommonContactFinding[];
  deviceAlerts: DeviceChangeAlert[];
  towerStats: TowerUsageStat[];
  unusualPatterns: UnusualFrequencyAlert[];
  dailySeries: Array<{ date: string; incoming: number; outgoing: number; sms: number; total: number }>;
  hourlySeries: Array<{ hour: string; calls: number; isNight: boolean }>;
}

export function isNightTimestamp(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const h = d.getUTCHours();
  return h >= 22 || h < 5;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${rem}s`;
  if (mins > 0) return `${mins}m ${rem}s`;
  return `${rem}s`;
}

export function computeCaseAnalytics(
  caseRecord: CaseRecord,
  cdrs: CDRRecord[],
  ipdrs: IPDRRecord[],
  towers: CellTower[]
): CaseAnalyticsSummary {
  const suspectByPhone = new Map(caseRecord.suspects.map((s) => [s.phoneNumber, s]));
  const towerById = new Map(towers.map((t) => [t.cell_id, t]));

  const uniquePhoneSet = new Set<string>();
  const edgeSet = new Set<string>();
  const contactMap = new Map<
    string,
    {
      totalCalls: number;
      incoming: number;
      outgoing: number;
      sms: number;
      duration: number;
      night: number;
      first: string;
      last: string;
      peers: Set<string>;
      sampleRecordId: string;
    }
  >();

  let incomingCount = 0;
  let outgoingCount = 0;
  let smsCount = 0;
  let totalDurationSec = 0;
  let nightCallCount = 0;
  let validFieldsCount = 0;
  let totalCheckedFields = 0;
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;

  const dailyMap = new Map<string, { incoming: number; outgoing: number; sms: number; total: number }>();
  const hourlyBuckets = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    calls: 0,
    isNight: h >= 22 || h < 5,
  }));

  // For common contacts: map non-suspect phone -> Set of suspect phones + records
  const contactToSuspects = new Map<
    string,
    { suspects: Set<string>; calls: number; duration: number; night: number; recordIds: string[] }
  >();

  // For IMEI/SIM tracking
  const phoneToImeis = new Map<
    string,
    { imeis: Set<string>; first: string; last: string; recordIds: string[] }
  >();
  const imeiToNumbers = new Map<
    string,
    { numbers: Set<string>; imsis: Set<string>; first: string; last: string; recordIds: string[] }
  >();

  // For Tower stats
  const towerAgg = new Map<
    string,
    {
      hits: number;
      numbers: Set<string>;
      suspects: Set<string>;
      nightHits: number;
      first: string;
      last: string;
      recordIds: string[];
    }
  >();

  const touchContact = (
    num: string,
    peer: string,
    dir: 'in' | 'out' | 'sms',
    rec: CDRRecord,
    night: boolean
  ) => {
    if (!num) return;
    uniquePhoneSet.add(num);
    let entry = contactMap.get(num);
    if (!entry) {
      entry = {
        totalCalls: 0,
        incoming: 0,
        outgoing: 0,
        sms: 0,
        duration: 0,
        night: 0,
        first: rec.timestamp,
        last: rec.timestamp,
        peers: new Set(),
        sampleRecordId: rec.record_id,
      };
      contactMap.set(num, entry);
    }
    entry.totalCalls += 1;
    if (dir === 'in') entry.incoming += 1;
    else if (dir === 'out') entry.outgoing += 1;
    else entry.sms += 1;
    entry.duration += rec.duration_seconds;
    if (night) entry.night += 1;
    if (rec.timestamp < entry.first) entry.first = rec.timestamp;
    if (rec.timestamp > entry.last) entry.last = rec.timestamp;
    if (peer) entry.peers.add(peer);
  };

  for (const r of cdrs) {
    // Data quality scoring across key fields
    const checks = [
      Boolean(r.caller_number),
      Boolean(r.receiver_number),
      Boolean(r.timestamp && !Number.isNaN(Date.parse(r.timestamp))),
      Boolean(r.cell_id),
      Boolean(r.imei),
      Boolean(r.imsi),
    ];
    totalCheckedFields += checks.length;
    validFieldsCount += checks.filter(Boolean).length;

    if (!firstTimestamp || r.timestamp < firstTimestamp) firstTimestamp = r.timestamp;
    if (!lastTimestamp || r.timestamp > lastTimestamp) lastTimestamp = r.timestamp;

    const night = isNightTimestamp(r.timestamp);
    if (night) nightCallCount += 1;

    const isSms = r.call_type === 'SMS_IN' || r.call_type === 'SMS_OUT';
    if (isSms) smsCount += 1;
    else if (r.call_type === 'INCOMING') incomingCount += 1;
    else outgoingCount += 1;

    totalDurationSec += r.duration_seconds;

    // Daily & hourly
    const dateKey = r.timestamp.slice(0, 10);
    const dayObj = dailyMap.get(dateKey) || { incoming: 0, outgoing: 0, sms: 0, total: 0 };
    if (isSms) dayObj.sms += 1;
    else if (r.call_type === 'INCOMING') dayObj.incoming += 1;
    else dayObj.outgoing += 1;
    dayObj.total += 1;
    dailyMap.set(dateKey, dayObj);

    const dObj = new Date(r.timestamp);
    if (!Number.isNaN(dObj.getTime())) {
      hourlyBuckets[dObj.getUTCHours()].calls += 1;
    }

    // Contacts & undirected edges
    if (r.caller_number && r.receiver_number) {
      const pair =
        r.caller_number < r.receiver_number
          ? `${r.caller_number}|${r.receiver_number}`
          : `${r.receiver_number}|${r.caller_number}`;
      edgeSet.add(pair);
    }

    touchContact(r.caller_number, r.receiver_number, isSms ? 'sms' : 'out', r, night);
    touchContact(r.receiver_number, r.caller_number, isSms ? 'sms' : 'in', r, night);

    // Common contacts relative to suspects
    const callerIsSus = suspectByPhone.has(r.caller_number);
    const receiverIsSus = suspectByPhone.has(r.receiver_number);
    if (callerIsSus && !receiverIsSus) {
      const cc = contactToSuspects.get(r.receiver_number) || {
        suspects: new Set<string>(),
        calls: 0,
        duration: 0,
        night: 0,
        recordIds: [],
      };
      cc.suspects.add(r.caller_number);
      cc.calls += 1;
      cc.duration += r.duration_seconds;
      if (night) cc.night += 1;
      if (cc.recordIds.length < 12) cc.recordIds.push(r.record_id);
      contactToSuspects.set(r.receiver_number, cc);
    } else if (receiverIsSus && !callerIsSus) {
      const cc = contactToSuspects.get(r.caller_number) || {
        suspects: new Set<string>(),
        calls: 0,
        duration: 0,
        night: 0,
        recordIds: [],
      };
      cc.suspects.add(r.receiver_number);
      cc.calls += 1;
      cc.duration += r.duration_seconds;
      if (night) cc.night += 1;
      if (cc.recordIds.length < 12) cc.recordIds.push(r.record_id);
      contactToSuspects.set(r.caller_number, cc);
    }

    // Identify the subscriber whose device generated the CDR row (prefer suspect, else caller)
    const deviceOwnerPhone = callerIsSus
      ? r.caller_number
      : receiverIsSus
      ? r.receiver_number
      : r.caller_number;

    if (r.imei && deviceOwnerPhone) {
      const pEntry = phoneToImeis.get(deviceOwnerPhone) || {
        imeis: new Set<string>(),
        first: r.timestamp,
        last: r.timestamp,
        recordIds: [],
      };
      pEntry.imeis.add(r.imei);
      if (r.timestamp < pEntry.first) pEntry.first = r.timestamp;
      if (r.timestamp > pEntry.last) pEntry.last = r.timestamp;
      if (pEntry.recordIds.length < 15) pEntry.recordIds.push(r.record_id);
      phoneToImeis.set(deviceOwnerPhone, pEntry);

      const iEntry = imeiToNumbers.get(r.imei) || {
        numbers: new Set<string>(),
        imsis: new Set<string>(),
        first: r.timestamp,
        last: r.timestamp,
        recordIds: [],
      };
      iEntry.numbers.add(deviceOwnerPhone);
      if (r.imsi) iEntry.imsis.add(r.imsi);
      if (r.timestamp < iEntry.first) iEntry.first = r.timestamp;
      if (r.timestamp > iEntry.last) iEntry.last = r.timestamp;
      if (iEntry.recordIds.length < 15) iEntry.recordIds.push(r.record_id);
      imeiToNumbers.set(r.imei, iEntry);
    }

    // Tower stats
    if (r.cell_id) {
      const tAgg = towerAgg.get(r.cell_id) || {
        hits: 0,
        numbers: new Set<string>(),
        suspects: new Set<string>(),
        nightHits: 0,
        first: r.timestamp,
        last: r.timestamp,
        recordIds: [],
      };
      tAgg.hits += 1;
      tAgg.numbers.add(deviceOwnerPhone);
      const susMatch = suspectByPhone.get(deviceOwnerPhone);
      if (susMatch) tAgg.suspects.add(susMatch.label);
      if (night) tAgg.nightHits += 1;
      if (r.timestamp < tAgg.first) tAgg.first = r.timestamp;
      if (r.timestamp > tAgg.last) tAgg.last = r.timestamp;
      if (tAgg.recordIds.length < 15) tAgg.recordIds.push(r.record_id);
      towerAgg.set(r.cell_id, tAgg);
    }
  }

  // Also factor IPDR completeness into data quality
  for (const ip of ipdrs) {
    const checks = [
      Boolean(ip.public_ip),
      Boolean(ip.destination_ip),
      ip.source_port > 0,
      Boolean(ip.session_start),
      Boolean(ip.subscriber_id && ip.subscriber_id !== 'Unmapped (CGNAT)'),
    ];
    totalCheckedFields += checks.length;
    validFieldsCount += checks.filter(Boolean).length;
  }

  const dataQualityScore =
    totalCheckedFields > 0 ? Math.round((validFieldsCount / totalCheckedFields) * 1000) / 10 : 100;

  const topContacts: ContactSummary[] = Array.from(contactMap.entries())
    .map(([phoneNumber, stat]) => {
      const sus = suspectByPhone.get(phoneNumber);
      const voiceCalls = stat.incoming + stat.outgoing;
      return {
        phoneNumber,
        label: sus ? `${sus.label} (${sus.alias.replace(' (Synthetic)', '')})` : undefined,
        isSuspect: Boolean(sus),
        totalCalls: stat.totalCalls,
        incomingCalls: stat.incoming,
        outgoingCalls: stat.outgoing,
        smsCount: stat.sms,
        totalDurationSec: stat.duration,
        avgDurationSec: voiceCalls > 0 ? Math.round(stat.duration / voiceCalls) : 0,
        nightCalls: stat.night,
        firstContact: stat.first,
        lastContact: stat.last,
        uniqueCounterparts: stat.peers.size,
        sampleRecordId: stat.sampleRecordId,
      };
    })
    .sort((a, b) => b.totalCalls - a.totalCalls);

  const commonContacts: CommonContactFinding[] = Array.from(contactToSuspects.entries())
    .filter(([, v]) => v.suspects.size >= 2)
    .map(([phoneNumber, v]) => {
      const susList = Array.from(v.suspects);
      return {
        phoneNumber,
        connectedSuspects: susList,
        connectedSuspectLabels: susList.map((p) => suspectByPhone.get(p)?.label || p),
        totalCalls: v.calls,
        totalDurationSec: v.duration,
        nightCalls: v.night,
        supportingRecordIds: v.recordIds,
      };
    })
    .sort((a, b) => b.connectedSuspects.length - a.connectedSuspects.length || b.totalCalls - a.totalCalls);

  const deviceAlerts: DeviceChangeAlert[] = [];
  for (const [phone, info] of phoneToImeis.entries()) {
    if (info.imeis.size > 1) {
      const sus = suspectByPhone.get(phone);
      deviceAlerts.push({
        id: `DEV-IMEI-${phone.slice(-5)}`,
        type: 'IMEI_CHANGE',
        primaryIdentifier: phone,
        associatedIdentifiers: Array.from(info.imeis),
        suspectLabel: sus?.label,
        firstSeen: info.first,
        lastSeen: info.last,
        recordCount: info.recordIds.length,
        confidenceNote:
          'Multiple IMEI values logged against one subscriber number. Requires human review to distinguish handset replacement from operator reporting noise.',
        supportingRecordIds: info.recordIds,
      });
    }
  }
  for (const [imei, info] of imeiToNumbers.entries()) {
    if (info.numbers.size > 1) {
      const matchedSus = Array.from(info.numbers)
        .map((n) => suspectByPhone.get(n)?.label)
        .filter(Boolean)
        .join(', ');
      deviceAlerts.push({
        id: `DEV-SIM-${imei.slice(-5)}`,
        type: 'SIM_SWAP',
        primaryIdentifier: imei,
        associatedIdentifiers: Array.from(info.numbers),
        suspectLabel: matchedSus || undefined,
        firstSeen: info.first,
        lastSeen: info.last,
        recordCount: info.recordIds.length,
        confidenceNote:
          'Single IMEI observed with multiple MSISDN/IMSI pairs. Flagged for investigator review (possible dual-SIM handset or SIM swap).',
        supportingRecordIds: info.recordIds,
      });
    }
  }

  const towerStats: TowerUsageStat[] = Array.from(towerAgg.entries())
    .map(([cellId, agg]) => {
      const meta = towerById.get(cellId);
      return {
        cell_id: cellId,
        tower_name: meta?.tower_name || `Unregistered Tower (${cellId})`,
        area: meta?.area || 'Unknown Area',
        latitude: meta?.latitude ?? 26.9124,
        longitude: meta?.longitude ?? 75.7873,
        operator: meta?.operator || 'Unknown',
        totalHits: agg.hits,
        uniqueNumbers: Array.from(agg.numbers),
        suspectLabels: Array.from(agg.suspects),
        nightHits: agg.nightHits,
        firstSeen: agg.first,
        lastSeen: agg.last,
        sampleRecordIds: agg.recordIds,
      };
    })
    .sort((a, b) => b.totalHits - a.totalHits);

  // Unusual contact frequency: high volume + high outgoing ratio + short average duration
  const unusualPatterns: UnusualFrequencyAlert[] = [];
  for (const c of topContacts) {
    const voiceTotal = c.incomingCalls + c.outgoingCalls;
    const outgoingRatio = voiceTotal > 0 ? c.outgoingCalls / voiceTotal : 0;
    const shortRecords = cdrs.filter(
      (r) =>
        (r.caller_number === c.phoneNumber || r.receiver_number === c.phoneNumber) &&
        r.duration_seconds > 0 &&
        r.duration_seconds <= 45
    );
    const shortRatio = voiceTotal > 0 ? shortRecords.length / voiceTotal : 0;

    if (c.totalCalls >= 25 && (outgoingRatio >= 0.72 || shortRatio >= 0.45)) {
      unusualPatterns.push({
        phoneNumber: c.phoneNumber,
        suspectLabel: c.label,
        callCount: c.totalCalls,
        shortCallRatio: Math.round(shortRatio * 100),
        outgoingRatio: Math.round(outgoingRatio * 100),
        avgDurationSec: c.avgDurationSec,
        reason:
          shortRatio >= 0.45
            ? `Elevated short-duration call burst (${Math.round(shortRatio * 100)}% under 45s, ${Math.round(outgoingRatio * 100)}% outgoing).`
            : `Asymmetric outgoing call ratio (${Math.round(outgoingRatio * 100)}% outgoing across ${c.totalCalls} events).`,
        sampleRecordId: c.sampleRecordId,
      });
    }
  }

  const dailySeries = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => ({ date, ...val }));

  const voiceCallsCount = incomingCount + outgoingCount;

  return {
    totalCdrs: cdrs.length,
    totalIpdrs: ipdrs.length,
    uniqueNumbers: uniquePhoneSet.size,
    networkEdgesCount: edgeSet.size,
    dataQualityScore,
    incomingCount,
    outgoingCount,
    smsCount,
    totalDurationSec,
    avgDurationSec: voiceCallsCount > 0 ? Math.round(totalDurationSec / voiceCallsCount) : 0,
    nightCallCount,
    firstTimestamp,
    lastTimestamp,
    topContacts,
    commonContacts,
    deviceAlerts,
    towerStats,
    unusualPatterns,
    dailySeries,
    hourlySeries: hourlyBuckets,
  };
}

// Deterministic evidence-grounded query engine (used for explicit Demo Mode fallback or when no API key is configured)
export function runDeterministicCaseQuery(
  question: string,
  language: 'en' | 'hi',
  caseRecord: CaseRecord,
  cdrs: CDRRecord[],
  ipdrs: IPDRRecord[],
  towers: CellTower[]
): AIResponsePayload {
  const q = question.toLowerCase();
  const isHindi = language === 'hi' || /[\u0900-\u097F]/.test(question);
  const analytics = computeCaseAnalytics(caseRecord, cdrs, ipdrs, towers);

  const cdrMap = new Map(cdrs.map((r) => [r.record_id, r]));
  const ipdrMap = new Map(ipdrs.map((r) => [r.record_id, r]));

  const citations: EvidenceCitation[] = [];
  const addCdrCitation = (id: string, note?: string) => {
    const r = cdrMap.get(id);
    if (!r || citations.some((c) => c.record_id === id)) return;
    citations.push({
      record_id: r.record_id,
      record_type: 'CDR',
      source_file: r.source_file,
      source_row: r.source_row,
      phone_number: `${r.caller_number} -> ${r.receiver_number}`,
      timestamp: r.timestamp,
      summary: note || `${r.call_type} (${r.duration_seconds}s) via ${r.cell_id}`,
    });
  };
  const addIpdrCitation = (id: string) => {
    const r = ipdrMap.get(id);
    if (!r || citations.some((c) => c.record_id === id)) return;
    citations.push({
      record_id: r.record_id,
      record_type: 'IPDR',
      source_file: r.source_file,
      source_row: r.source_row,
      phone_number: r.subscriber_id,
      timestamp: r.session_start,
      summary: `${r.public_ip}:${r.source_port} -> ${r.destination_ip}:${r.destination_port} (${r.protocol})`,
    });
  };

  let summary = '';
  const observedFacts: AIObservedFact[] = [];
  const analyticalPatterns: string[] = [];
  const hypothesesForVerification: string[] = [];
  const dataLimitations: string[] = [
    isHindi
      ? 'यह विश्लेषण केवल चयनित केस के सिंथेटिक डेमो डेटा पर आधारित है। किसी भी निष्कर्ष के लिए जांच अधिकारी का मैनुअल सत्यापन अनिवार्य है।'
      : 'Analysis is restricted strictly to the selected case dataset (SYNTHETIC DEMO DATA). Human investigator verification is required before treating any observation as an official conclusion.',
  ];

  // Check for explicit entity lookup (specific phone number, IMEI, tower ID, or public IP)
  const phoneTokens = (question.match(/\+?\d[\d-]{5,}\d/g) || []).map((t) => t.replace(/[-\s]/g, ''));
  const towerTokens = (question.match(/\b(?:twr|cell|site)[-_a-z0-9]+\b/gi) || []).map((t) =>
    t.toLowerCase()
  );
  const ipTokens = question.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [];
  const hasExplicitEntity =
    phoneTokens.length > 0 || towerTokens.length > 0 || ipTokens.length > 0;

  if (cdrs.length === 0 && ipdrs.length === 0) {
    summary = isHindi
      ? `केस ${caseRecord.caseNumber} में अभी कोई CDR या IPDR रिकॉर्ड अपलोड नहीं किया गया है। विश्लेषण के लिए पहले डेटा इम्पोर्ट करें।`
      : `Case ${caseRecord.caseNumber} currently contains 0 CDR records and 0 IPDR sessions. Import synthetic CSV/XLSX datasets before running investigative queries.`;
    hypothesesForVerification.push(
      isHindi
        ? 'डेटा इम्पोर्ट पृष्ठ से मानकीकृत CDR या IPDR फ़ाइलें अपलोड करें।'
        : 'Upload CDR or IPDR files via the Data Import workspace to populate case-scoped evidence.'
    );
  } else if (hasExplicitEntity) {
    const matchedCdrs = cdrs.filter((r) => {
      const callerNorm = r.caller_number.replace(/[-\s]/g, '');
      const recvNorm = r.receiver_number.replace(/[-\s]/g, '');
      const imeiNorm = r.imei.replace(/[-\s]/g, '');
      const phoneHit = phoneTokens.some(
        (tok) => callerNorm.includes(tok) || recvNorm.includes(tok) || imeiNorm.includes(tok)
      );
      const towerHit = towerTokens.some((tok) => r.cell_id.toLowerCase().includes(tok));
      return phoneHit || towerHit;
    });
    const matchedIpdrs = ipdrs.filter((r) => {
      const ipHit = ipTokens.some((tok) => r.public_ip === tok || r.destination_ip === tok);
      const subNorm = r.subscriber_id.replace(/[-\s]/g, '');
      const subHit = phoneTokens.some((tok) => subNorm.includes(tok));
      return ipHit || subHit;
    });

    if (matchedCdrs.length === 0 && matchedIpdrs.length === 0) {
      summary = isHindi
        ? `केस ${caseRecord.caseNumber} के अपलोड किए गए डेटा में निर्दिष्ट पहचानकर्ता (${[...phoneTokens, ...towerTokens, ...ipTokens].join(', ')}) से मेल खाने वाला कोई रिकॉर्ड नहीं मिला।`
        : `No CDR or IPDR records in case ${caseRecord.caseNumber} match the specified identifier(s): ${[...phoneTokens, ...towerTokens, ...ipTokens].join(', ')}.`;
    } else {
      summary = isHindi
        ? `केस ${caseRecord.caseNumber} में निर्दिष्ट पहचानकर्ता से संबंधित ${matchedCdrs.length} CDR और ${matchedIpdrs.length} IPDR रिकॉर्ड मिले हैं।`
        : `Located ${matchedCdrs.length} matching CDR record(s) and ${matchedIpdrs.length} matching IPDR session(s) in case ${caseRecord.caseNumber}.`;
      matchedCdrs.slice(0, 5).forEach((r) => {
        addCdrCitation(r.record_id);
        observedFacts.push({
          statement: `${r.timestamp.replace('T', ' ').slice(0, 19)} UTC: ${r.caller_number} -> ${r.receiver_number} (${r.call_type}, ${r.duration_seconds}s, Tower ${r.cell_id}, IMEI ${r.imei || 'N/A'}) [${r.source_file}, Row #${r.source_row}].`,
          citation_ids: [r.record_id],
        });
      });
      matchedIpdrs.slice(0, 4).forEach((r) => {
        addIpdrCitation(r.record_id);
        observedFacts.push({
          statement: `${r.session_start.replace('T', ' ').slice(0, 19)} UTC: ${r.subscriber_id} via ${r.public_ip}:${r.source_port} -> ${r.destination_ip}:${r.destination_port} (${r.protocol}) [${r.source_file}, Row #${r.source_row}].`,
          citation_ids: [r.record_id],
        });
      });
      if (matchedCdrs.length > 0) {
        const nightMatches = matchedCdrs.filter((r) => isNightTimestamp(r.timestamp)).length;
        const distinctTowers = Array.from(new Set(matchedCdrs.map((r) => r.cell_id).filter(Boolean)));
        analyticalPatterns.push(
          `Matched CDR subset includes ${nightMatches} night-time event(s) across ${distinctTowers.length} cell tower(s): ${distinctTowers.slice(0, 5).join(', ') || 'None'}.`
        );
      }
      hypothesesForVerification.push(
        'Verify subscriber KYC, device ownership, and ISP NAT allocation records through authorized channels before drawing conclusions.'
      );
    }
  } else if (q.includes('common') || q.includes('shared') || q.includes('साझा') || q.includes('कॉमन')) {
    const topCommon = analytics.commonContacts.slice(0, 3);
    if (topCommon.length === 0) {
      summary = isHindi
        ? 'चयनित केस के डेटासेट में संदिग्धों के बीच कोई साझा संपर्क नंबर नहीं मिला।'
        : 'No shared contacts linking two or more listed suspects were found in the uploaded records for this case.';
    } else {
      summary = isHindi
        ? `चयनित केस (${caseRecord.caseNumber}) में ${analytics.commonContacts.length} साझा संपर्क नंबर पाए गए हैं। सबसे प्रमुख साझा नंबर ${topCommon[0].phoneNumber} है, जो ${topCommon[0].connectedSuspectLabels.join(', ')} से ${topCommon[0].totalCalls} कॉल के माध्यम से जुड़ा है।`
        : `Identified ${analytics.commonContacts.length} shared contact numbers linking multiple suspects in ${caseRecord.caseNumber}. The highest-frequency shared contact is ${topCommon[0].phoneNumber}, linked to ${topCommon[0].connectedSuspectLabels.join(', ')} across ${topCommon[0].totalCalls} recorded events.`;
      for (const cc of topCommon) {
        const ids = cc.supportingRecordIds.slice(0, 3);
        ids.forEach((id) => addCdrCitation(id));
        observedFacts.push({
          statement: isHindi
            ? `नंबर ${cc.phoneNumber} संदिग्धों (${cc.connectedSuspectLabels.join(', ')}) के साथ ${cc.totalCalls} कॉल (${formatDuration(cc.totalDurationSec)}) में जुड़ा हुआ है, जिनमें ${cc.nightCalls} रात्रि कॉल हैं।`
            : `${cc.phoneNumber} appears in ${cc.totalCalls} records (${formatDuration(cc.totalDurationSec)} total duration, ${cc.nightCalls} night events) involving ${cc.connectedSuspectLabels.join(', ')}.`,
          citation_ids: ids,
        });
      }
      analyticalPatterns.push(
        isHindi
          ? `${topCommon[0].phoneNumber} कई संदिग्धों के बीच एक सामान्य संपर्क बिंदु के रूप में दिखाई देता है।`
          : `${topCommon[0].phoneNumber} acts as a recurring bridge node connecting ${topCommon[0].connectedSuspectLabels.join(' and ')} across normalized CDR datasets.`
      );
      hypothesesForVerification.push(
        isHindi
          ? 'सत्यापित करें कि क्या साझा नंबर किसी वैध सेवा प्रदाता, परिचित या समन्वय बिंदु से संबंधित है; केवल कॉल आवृत्ति अपराध का प्रमाण नहीं है।'
          : 'Verify subscriber KYC and context for shared numbers via authorized channels; shared contact links do not independently prove criminal involvement.'
      );
    }
  } else if (
    q.includes('night') ||
    q.includes('10 pm') ||
    q.includes('5 am') ||
    q.includes('रात') ||
    q.includes('रात्रि')
  ) {
    const nightRecs = cdrs.filter((r) => isNightTimestamp(r.timestamp));
    if (nightRecs.length === 0) {
      summary = isHindi
        ? `केस ${caseRecord.caseNumber} में रात 10:00 बजे से सुबह 5:00 बजे (UTC) के बीच कोई संचार रिकॉर्ड नहीं मिला।`
        : `No communication records between 22:00 and 05:00 UTC were found in case ${caseRecord.caseNumber}.`;
    } else {
      const sample = nightRecs.slice(0, 6);
      sample.forEach((r) => addCdrCitation(r.record_id));
      summary = isHindi
        ? `केस ${caseRecord.caseNumber} में रात 10:00 बजे से सुबह 5:00 बजे (UTC) के बीच कुल ${nightRecs.length} संचार रिकॉर्ड पाए गए (कुल CDR का ${Math.round((nightRecs.length / Math.max(1, cdrs.length)) * 100)}%)।`
        : `Found ${nightRecs.length} communication records between 22:00 and 05:00 UTC in case ${caseRecord.caseNumber} (${Math.round((nightRecs.length / Math.max(1, cdrs.length)) * 100)}% of total CDR volume).`;
      sample.slice(0, 4).forEach((r) => {
        observedFacts.push({
          statement: `${r.timestamp.replace('T', ' ').slice(0, 19)} UTC: ${r.caller_number} -> ${r.receiver_number} (${r.call_type}, ${r.duration_seconds}s, Tower ${r.cell_id}) [${r.source_file}, Row #${r.source_row}].`,
          citation_ids: [r.record_id],
        });
      });

      // Compute top night participants and night towers strictly from actual nightRecs
      const nightParticipantCounts = new Map<string, number>();
      const nightTowerCounts = new Map<string, number>();
      for (const r of nightRecs) {
        if (r.caller_number) {
          nightParticipantCounts.set(r.caller_number, (nightParticipantCounts.get(r.caller_number) || 0) + 1);
        }
        if (r.receiver_number) {
          nightParticipantCounts.set(r.receiver_number, (nightParticipantCounts.get(r.receiver_number) || 0) + 1);
        }
        if (r.cell_id) {
          nightTowerCounts.set(r.cell_id, (nightTowerCounts.get(r.cell_id) || 0) + 1);
        }
      }
      const topNightNums = Array.from(nightParticipantCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([num, cnt]) => `${num} (${cnt})`);
      const topNightTowers = Array.from(nightTowerCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([tid, cnt]) => `${tid} (${cnt})`);

      analyticalPatterns.push(
        isHindi
          ? `रात्रि गतिविधि मुख्य रूप से ${topNightNums.join(', ')} और टावर ${topNightTowers.join(', ') || 'N/A'} पर केंद्रित है।`
          : `Late-night activity concentrates around ${topNightNums.join(', ')}${topNightTowers.length > 0 ? ` on towers ${topNightTowers.join(', ')}` : ''}.`
      );
      hypothesesForVerification.push(
        'Cross-check late-night call bursts against verified incident timelines and shift schedules before drawing conclusions.'
      );
    }
  } else if (q.includes('imei') || q.includes('sim') || q.includes('device') || q.includes('डिवाइस') || q.includes('सिम')) {
    if (analytics.deviceAlerts.length === 0) {
      summary = isHindi
        ? `केस ${caseRecord.caseNumber} के अपलोड किए गए रिकॉर्ड में कोई IMEI या SIM परिवर्तन विसंगति नहीं मिली।`
        : 'No IMEI or SIM change anomalies were observed in the uploaded records for this case.';
    } else {
      summary = isHindi
        ? `इस केस में ${analytics.deviceAlerts.length} संभावित IMEI/SIM परिवर्तन चिह्नित किए गए हैं जिनकी मानवीय समीक्षा आवश्यक है।`
        : `Detected ${analytics.deviceAlerts.length} potential IMEI/SIM association change(s) flagged for investigator review in ${caseRecord.caseNumber}.`;
      for (const alert of analytics.deviceAlerts) {
        const ids = alert.supportingRecordIds.slice(0, 3);
        ids.forEach((id) => addCdrCitation(id));
        observedFacts.push({
          statement: `${alert.type === 'IMEI_CHANGE' ? 'IMEI Change' : 'SIM Swap'}: ${alert.primaryIdentifier} (${alert.suspectLabel || 'Subscriber'}) associated with [${alert.associatedIdentifiers.join(', ')}] between ${alert.firstSeen.slice(0, 10)} and ${alert.lastSeen.slice(0, 10)}.`,
          citation_ids: ids,
        });
      }
      analyticalPatterns.push(
        `Device identifier transitions were recorded across ${analytics.deviceAlerts.length} subscriber/handset pair(s) within the observed dataset window.`
      );
      hypothesesForVerification.push(
        'Confirm whether multiple IMEIs represent a legitimate phone upgrade, dual-SIM slot reporting, or deliberate device switching.'
      );
      dataLimitations.push(
        'Records with blank IMEI fields in operator exports cannot confirm device continuity.'
      );
    }
  } else if (q.includes('tower') || q.includes('location') || q.includes('टावर') || q.includes('लोकेशन')) {
    const topTowers = analytics.towerStats.slice(0, 4);
    if (topTowers.length === 0) {
      summary = isHindi
        ? `केस ${caseRecord.caseNumber} में कोई सेल-टावर एसोसिएशन रिकॉर्ड नहीं मिला।`
        : `No cell-tower associations were found in the uploaded records for case ${caseRecord.caseNumber}.`;
    } else {
      summary = isHindi
        ? `सबसे अधिक उपयोग किया गया सेल टावर ${topTowers[0].cell_id} (${topTowers[0].area}) है, जिसमें ${topTowers[0].totalHits} रिकॉर्ड और ${topTowers[0].uniqueNumbers.length} अद्वितीय नंबर दर्ज हैं।`
        : `Most frequently recorded cell tower is ${topTowers[0].cell_id} (${topTowers[0].area}) with ${topTowers[0].totalHits} CDR hits across ${topTowers[0].uniqueNumbers.length} unique numbers.`;
      for (const t of topTowers) {
        const ids = t.sampleRecordIds.slice(0, 2);
        ids.forEach((id) => addCdrCitation(id));
        observedFacts.push({
          statement: `${t.cell_id} (${t.area}): ${t.totalHits} hits (${t.nightHits} night-time), linked suspects: ${t.suspectLabels.join(', ') || 'None'}.`,
          citation_ids: ids,
        });
      }
      const multiSuspectTowers = analytics.towerStats.filter((t) => t.suspectLabels.length >= 2).slice(0, 3);
      if (multiSuspectTowers.length > 0) {
        analyticalPatterns.push(
          `Overlapping multi-suspect tower usage appears on ${multiSuspectTowers.map((t) => `${t.cell_id} (${t.area})`).join(', ')}.`
        );
      } else {
        analyticalPatterns.push(
          `Highest tower concentration is recorded on ${topTowers.slice(0, 2).map((t) => `${t.cell_id} (${t.area})`).join(' and ')}.`
        );
      }
      hypothesesForVerification.push(
        'Corroborate tower sequences with independent physical evidence (CCTV, toll, witness records) before inferring presence.'
      );
      dataLimitations.push(
        'Cell tower association reflects network sector coverage (~900m–1.8km radius) and is NOT precise GPS tracking.'
      );
    }
  } else if (q.includes('ip') || q.includes('ipdr') || q.includes('session') || q.includes('port') || q.includes('आईपी')) {
    if (ipdrs.length === 0) {
      summary = isHindi
        ? `केस ${caseRecord.caseNumber} में कोई IPDR सत्र रिकॉर्ड उपलब्ध नहीं है।`
        : `No IPDR session records are currently loaded for case ${caseRecord.caseNumber}.`;
    } else {
      const sampleIp = ipdrs.slice(0, 5);
      sampleIp.forEach((r) => addIpdrCitation(r.record_id));
      const mappedCount = ipdrs.filter((r) => r.subscriber_id !== 'Unmapped (CGNAT)').length;
      summary = isHindi
        ? `केस ${caseRecord.caseNumber} में कुल ${ipdrs.length} IPDR सत्र दर्ज हैं, जिनमें से ${mappedCount} सत्र सब्सक्राइबर नंबर से जुड़े हैं।`
        : `Case ${caseRecord.caseNumber} contains ${ipdrs.length} IPDR sessions (${mappedCount} mapped to supplied subscriber IDs, ${ipdrs.length - mappedCount} unmapped CGNAT entries).`;
      sampleIp.slice(0, 4).forEach((r) => {
        observedFacts.push({
          statement: `${r.session_start.slice(0, 19).replace('T', ' ')} UTC: Subscriber ${r.subscriber_id} mapped to ${r.public_ip}:${r.source_port} -> ${r.destination_ip}:${r.destination_port} (${r.protocol}, ${r.service_indicator}) [${r.source_file}, Row #${r.source_row}].`,
          citation_ids: [r.record_id],
        });
      });
      const nightIpCount = ipdrs.filter((r) => isNightTimestamp(r.session_start)).length;
      analyticalPatterns.push(
        `${nightIpCount} of ${ipdrs.length} IPDR sessions (${Math.round((nightIpCount / Math.max(1, ipdrs.length)) * 100)}%) fall inside the 22:00–05:00 UTC night window.`
      );
      hypothesesForVerification.push(
        'Confirm CGNAT port-to-subscriber allocation logs directly with the ISP through lawful process.'
      );
      dataLimitations.push(
        'A public IP address under Carrier-Grade NAT does NOT uniquely identify a person or precise physical address by itself.'
      );
    }
  } else if (
    q.includes('longest') ||
    q.includes('duration') ||
    q.includes('talk time') ||
    q.includes('अवधि') ||
    q.includes('लंबी')
  ) {
    const byDuration = [...analytics.topContacts]
      .sort((a, b) => b.totalDurationSec - a.totalDurationSec || b.totalCalls - a.totalCalls)
      .slice(0, 5);
    if (byDuration.length === 0) {
      summary = isHindi
        ? `केस ${caseRecord.caseNumber} में कॉल अवधि गणना के लिए कोई CDR रिकॉर्ड उपलब्ध नहीं है।`
        : `No CDR records are available in case ${caseRecord.caseNumber} to calculate call duration.`;
    } else {
      const leader = byDuration[0];
      summary = isHindi
        ? `सबसे लंबी कुल कॉल अवधि ${leader.phoneNumber}${leader.label ? ` (${leader.label})` : ''} की है: कुल ${formatDuration(leader.totalDurationSec)} (${leader.totalDurationSec} सेकंड), ${leader.totalCalls} कॉल में।`
        : `The longest total call duration belongs to ${leader.phoneNumber}${leader.label ? ` (${leader.label})` : ''} with ${formatDuration(leader.totalDurationSec)} (${leader.totalDurationSec.toLocaleString()} seconds) across ${leader.totalCalls} recorded events.`;
      for (const c of byDuration) {
        addCdrCitation(c.sampleRecordId);
        observedFacts.push({
          statement: `${c.phoneNumber}${c.label ? ` (${c.label})` : ''}: total duration ${formatDuration(c.totalDurationSec)} (${c.totalDurationSec.toLocaleString()}s), ${c.totalCalls} events, average ${c.avgDurationSec}s per voice call.`,
          citation_ids: [c.sampleRecordId],
        });
      }
      analyticalPatterns.push(
        `Combined case voice duration across all ${analytics.totalCdrs} CDR records is ${formatDuration(analytics.totalDurationSec)} (mean ${analytics.avgDurationSec}s per voice call).`
      );
      hypothesesForVerification.push(
        'Review call timing and subscriber KYC before drawing conclusions from cumulative call duration.'
      );
    }
  } else if (
    (q.includes('total') || q.includes('how many') || q.includes('count') || q.includes('कुल') || q.includes('कितने')) &&
    (q.includes('cdr') || q.includes('record') || q.includes('रिकॉर्ड'))
  ) {
    const sampleRecs = cdrs.slice(0, 3);
    sampleRecs.forEach((r) => addCdrCitation(r.record_id));
    summary = isHindi
      ? `केस ${caseRecord.caseNumber} में कुल ${analytics.totalCdrs} CDR रिकॉर्ड उपलब्ध हैं (${analytics.incomingCount} इनकमिंग, ${analytics.outgoingCount} आउटगोइंग, ${analytics.smsCount} SMS) और ${analytics.totalIpdrs} IPDR सत्र दर्ज हैं।`
      : `Case ${caseRecord.caseNumber} currently has ${analytics.totalCdrs} total CDR records (${analytics.incomingCount} incoming voice, ${analytics.outgoingCount} outgoing voice, ${analytics.smsCount} SMS) across ${analytics.uniqueNumbers} unique phone numbers, along with ${analytics.totalIpdrs} IPDR sessions.`;
    observedFacts.push({
      statement: `Total CDR records in ${caseRecord.caseNumber}: ${analytics.totalCdrs} (${analytics.incomingCount} incoming, ${analytics.outgoingCount} outgoing, ${analytics.smsCount} SMS).`,
      citation_ids: sampleRecs.map((r) => r.record_id),
    });
    if (caseRecord.datasets.length > 0) {
      observedFacts.push({
        statement: `Loaded datasets (${caseRecord.datasets.length}): ${caseRecord.datasets.map((d) => `${d.fileName} (${d.fileType}, ${d.recordCount} rows)`).join('; ')}.`,
        citation_ids: sampleRecs.slice(0, 1).map((r) => r.record_id),
      });
    }
    if (analytics.firstTimestamp && analytics.lastTimestamp) {
      analyticalPatterns.push(
        `Recorded timestamps span from ${analytics.firstTimestamp.slice(0, 19).replace('T', ' ')} UTC to ${analytics.lastTimestamp.slice(0, 19).replace('T', ' ')} UTC.`
      );
    }
    hypothesesForVerification.push(
      'Confirm that all authorized operator extracts for the investigation window have been imported into this case.'
    );
  } else if (
    q.includes('highest') ||
    q.includes('frequency') ||
    q.includes('frequent') ||
    q.includes('top ') ||
    q.includes('most') ||
    q.includes('अधिक') ||
    q.includes('ज्यादा')
  ) {
    const requestedTopMatch = q.match(/\btop\s+(\d{1,2})\b/);
    const requestedCount = requestedTopMatch
      ? Math.min(10, Math.max(1, Number(requestedTopMatch[1])))
      : 5;
    const topList = analytics.topContacts.slice(0, requestedCount);
    if (topList.length === 0) {
      summary = isHindi
        ? `केस ${caseRecord.caseNumber} में कॉल आवृत्ति गणना के लिए कोई CDR रिकॉर्ड उपलब्ध नहीं है।`
        : `No CDR records are available in case ${caseRecord.caseNumber} to compute contact frequency.`;
    } else {
      summary = isHindi
        ? `सबसे अधिक कॉल आवृत्ति ${topList[0].phoneNumber} (${topList[0].label || 'संपर्क'}) की है, जिसके नाम कुल ${topList[0].totalCalls} संचार घटनाएं (${formatDuration(topList[0].totalDurationSec)}) दर्ज हैं। शीर्ष ${topList.length} संपर्क नीचे सूचीबद्ध हैं।`
        : `The highest communication frequency belongs to ${topList[0].phoneNumber}${topList[0].label ? ` (${topList[0].label})` : ''} with ${topList[0].totalCalls} recorded events (${formatDuration(topList[0].totalDurationSec)} total duration). The top ${topList.length} most frequently contacted numbers are listed below.`;
      topList.forEach((c, idx) => {
        addCdrCitation(c.sampleRecordId);
        observedFacts.push({
          statement: `#${idx + 1} ${c.phoneNumber}${c.label ? ` (${c.label})` : ''}: ${c.totalCalls} events (${c.incomingCalls} in / ${c.outgoingCalls} out / ${c.smsCount} SMS), total duration ${formatDuration(c.totalDurationSec)}, ${c.nightCalls} night events.`,
          citation_ids: [c.sampleRecordId],
        });
      });
      if (analytics.unusualPatterns.length > 0) {
        analyticalPatterns.push(analytics.unusualPatterns[0].reason);
      }
      hypothesesForVerification.push(
        'Review call context and subscriber ownership before interpreting high frequency as operational coordination.'
      );
    }
  } else {
    // General case summary strictly from current case analytics
    const top1 = analytics.topContacts[0];
    const common1 = analytics.commonContacts[0];
    const sampleIds = [
      top1?.sampleRecordId,
      common1?.supportingRecordIds[0],
      analytics.deviceAlerts[0]?.supportingRecordIds[0],
      ipdrs[0]?.record_id,
    ].filter(Boolean) as string[];
    sampleIds.forEach((id) => {
      if (id.startsWith('IPDR')) addIpdrCitation(id);
      else addCdrCitation(id);
    });

    summary = isHindi
      ? `केस ${caseRecord.caseNumber} (${caseRecord.title}) में ${analytics.totalCdrs} CDR, ${analytics.totalIpdrs} IPDR सत्र और ${analytics.uniqueNumbers} अद्वितीय नंबर शामिल हैं। प्रमुख पैटर्न में ${analytics.commonContacts.length} साझा संपर्क, ${analytics.nightCallCount} रात्रि कॉल और ${analytics.deviceAlerts.length} डिवाइस परिवर्तन अलर्ट शामिल हैं।`
      : `Case ${caseRecord.caseNumber} comprises ${analytics.totalCdrs} normalized CDRs, ${analytics.totalIpdrs} IPDR sessions, and ${analytics.uniqueNumbers} unique phone numbers. Key observations include ${analytics.commonContacts.length} shared contacts across suspects, ${analytics.nightCallCount} night-time communications, and ${analytics.deviceAlerts.length} flagged IMEI/SIM transitions.`;

    if (top1) {
      observedFacts.push({
        statement: `Highest activity number: ${top1.phoneNumber} (${top1.label || 'Contact'}) with ${top1.totalCalls} events totaling ${formatDuration(top1.totalDurationSec)}.`,
        citation_ids: [top1.sampleRecordId],
      });
    }
    if (common1) {
      observedFacts.push({
        statement: `Primary shared contact: ${common1.phoneNumber} linked to ${common1.connectedSuspectLabels.join(', ')} (${common1.totalCalls} events).`,
        citation_ids: common1.supportingRecordIds.slice(0, 2),
      });
    }
    if (analytics.deviceAlerts[0]) {
      observedFacts.push({
        statement: `Device alert (${analytics.deviceAlerts[0].type}): ${analytics.deviceAlerts[0].primaryIdentifier} linked to [${analytics.deviceAlerts[0].associatedIdentifiers.join(', ')}].`,
        citation_ids: analytics.deviceAlerts[0].supportingRecordIds.slice(0, 2),
      });
    }
    if (ipdrs[0]) {
      observedFacts.push({
        statement: `IPDR coverage: ${ipdrs.length} sessions across ${new Set(ipdrs.map((i) => i.public_ip)).size} public IPs.`,
        citation_ids: [ipdrs[0].record_id],
      });
    }

    if (analytics.totalCdrs > 0) {
      analyticalPatterns.push(
        `Night-time traffic accounts for ${Math.round((analytics.nightCallCount / Math.max(1, analytics.totalCdrs)) * 100)}% of CDR events.`
      );
    }
    if (analytics.towerStats[0]) {
      analyticalPatterns.push(
        `Top cell tower ${analytics.towerStats[0].cell_id} (${analytics.towerStats[0].area}) logged ${analytics.towerStats[0].totalHits} hits.`
      );
    }
    const leadTarget = common1
      ? `shared contact ${common1.phoneNumber}`
      : top1
      ? `high-volume number ${top1.phoneNumber}`
      : 'uploaded communication records';
    hypothesesForVerification.push(
      `Prioritize investigator verification of ${leadTarget}${analytics.deviceAlerts.length > 0 ? ' and flagged IMEI/SIM transitions' : ''} before preparing official case findings.`
    );
  }

  return {
    id: `AI-${Date.now()}`,
    question,
    language: isHindi ? 'hi' : 'en',
    mode: 'deterministic_demo',
    modelLabel: 'Local Evidence Analyzer',
    timestamp: new Date().toISOString(),
    summary,
    observedFacts,
    analyticalPatterns,
    hypothesesForVerification,
    dataLimitations,
    citations,
    suggestedFollowUps: [],
    requiresHumanVerification: true,
    isSyntheticData: caseRecord.isSyntheticDemo,
  };
}
