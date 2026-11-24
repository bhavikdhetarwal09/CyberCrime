import type { CaseRecord, CDRRecord, CellTower, IPDRRecord } from './types';
import { isNightTimestamp } from './analytics';
import { getCurrentIstDateString, isValidIsoDateString } from './dateConstraints';

export interface ForensicFilters {
  search: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM (UTC)
  endTime: string; // HH:MM (UTC)
  suspectPhone: string; // 'ALL' or suspect phoneNumber
  phoneNumber: string; // free text or selected phoneNumber
  callType: string; // 'ALL' | 'INCOMING' | 'OUTGOING' | 'SMS_IN' | 'SMS_OUT' | 'VOICE_ONLY' | 'SMS_ONLY'
  towerId: string; // 'ALL' or cell_id
  imei: string; // 'ALL' or IMEI string
  nightOnly: boolean;
  publicIp: string; // 'ALL' or public_ip
  sourcePort: string; // text/number match
  destinationPort: string; // 'ALL' or port string
  protocol: string; // 'ALL' | 'TCP' | 'UDP' | 'QUIC' | 'ICMP'
  subscriberId: string; // 'ALL' or subscriber_id
}

export const DEFAULT_FORENSIC_FILTERS: ForensicFilters = {
  search: '',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  suspectPhone: 'ALL',
  phoneNumber: '',
  callType: 'ALL',
  towerId: 'ALL',
  imei: 'ALL',
  nightOnly: false,
  publicIp: 'ALL',
  sourcePort: '',
  destinationPort: 'ALL',
  protocol: 'ALL',
  subscriberId: 'ALL',
};

export function createDefaultFilters(overrides: Partial<ForensicFilters> = {}): ForensicFilters {
  return { ...DEFAULT_FORENSIC_FILTERS, ...overrides };
}

/**
 * Defense-in-depth date bounds resolution:
 * - Never allows dates beyond today's dynamic Asia/Kolkata date.
 * - Flags inverted ranges (startDate > endDate) as invalid.
 */
function resolveSafeDateBounds(
  startDate: string,
  endDate: string
): { start: string; end: string; invalidRange: boolean } {
  const maxIstDate = getCurrentIstDateString();
  const rawStart = (startDate || '').trim();
  const rawEnd = (endDate || '').trim();

  const start =
    rawStart && isValidIsoDateString(rawStart)
      ? rawStart > maxIstDate
        ? maxIstDate
        : rawStart
      : '';
  const end =
    rawEnd && isValidIsoDateString(rawEnd)
      ? rawEnd > maxIstDate
        ? maxIstDate
        : rawEnd
      : '';

  if (start && end && start > end) {
    return { start, end, invalidRange: true };
  }
  return { start, end, invalidRange: false };
}

/**
 * Checks whether an ISO timestamp's UTC HH:MM falls within [startTime, endTime].
 * Supports overnight wrap-around ranges (e.g., startTime="22:00", endTime="05:00").
 */
export function matchesTimeWindow(isoTimestamp: string, startTime: string, endTime: string): boolean {
  if (!startTime && !endTime) return true;
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return false;
  const hhmm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

  if (startTime && endTime) {
    if (startTime <= endTime) {
      return hhmm >= startTime && hhmm <= endTime;
    }
    // Overnight window (e.g., 22:00 -> 05:00)
    return hhmm >= startTime || hhmm <= endTime;
  }
  if (startTime) return hhmm >= startTime;
  return hhmm <= endTime;
}

export function filterCdrs(cdrs: CDRRecord[], f: ForensicFilters): CDRRecord[] {
  const { start, end, invalidRange } = resolveSafeDateBounds(f.startDate, f.endDate);
  if (invalidRange) return [];

  const q = f.search.trim().toLowerCase();
  const phoneQ = f.phoneNumber.trim().toLowerCase();
  const imeiFilter = f.imei !== 'ALL' ? f.imei.trim().toLowerCase() : '';

  return cdrs.filter((r) => {
    const datePart = r.timestamp.slice(0, 10);
    if (start && datePart < start) return false;
    if (end && datePart > end) return false;
    if (!matchesTimeWindow(r.timestamp, f.startTime, f.endTime)) return false;
    if (f.nightOnly && !isNightTimestamp(r.timestamp)) return false;

    if (f.suspectPhone !== 'ALL') {
      if (r.caller_number !== f.suspectPhone && r.receiver_number !== f.suspectPhone) {
        return false;
      }
    }

    if (phoneQ) {
      if (
        !r.caller_number.toLowerCase().includes(phoneQ) &&
        !r.receiver_number.toLowerCase().includes(phoneQ)
      ) {
        return false;
      }
    }

    if (f.callType !== 'ALL') {
      if (f.callType === 'VOICE_ONLY') {
        if (r.call_type !== 'INCOMING' && r.call_type !== 'OUTGOING') return false;
      } else if (f.callType === 'SMS_ONLY') {
        if (r.call_type !== 'SMS_IN' && r.call_type !== 'SMS_OUT') return false;
      } else if (r.call_type !== f.callType) {
        return false;
      }
    }

    if (f.towerId !== 'ALL' && r.cell_id !== f.towerId) return false;

    if (imeiFilter) {
      if (imeiFilter === '__missing__') {
        if (r.imei.trim() !== '') return false;
      } else if (!r.imei.toLowerCase().includes(imeiFilter)) {
        return false;
      }
    }

    if (q) {
      const hit =
        r.caller_number.toLowerCase().includes(q) ||
        r.receiver_number.toLowerCase().includes(q) ||
        r.cell_id.toLowerCase().includes(q) ||
        r.imei.toLowerCase().includes(q) ||
        r.imsi.toLowerCase().includes(q) ||
        r.operator.toLowerCase().includes(q) ||
        r.record_id.toLowerCase().includes(q) ||
        r.source_file.toLowerCase().includes(q);
      if (!hit) return false;
    }

    return true;
  });
}

export function filterIpdrs(ipdrs: IPDRRecord[], f: ForensicFilters): IPDRRecord[] {
  const { start, end, invalidRange } = resolveSafeDateBounds(f.startDate, f.endDate);
  if (invalidRange) return [];

  const q = f.search.trim().toLowerCase();
  const phoneQ = f.phoneNumber.trim().toLowerCase();
  const srcPortQ = f.sourcePort.trim();

  return ipdrs.filter((r) => {
    const datePart = r.session_start.slice(0, 10);
    if (start && datePart < start) return false;
    if (end && datePart > end) return false;
    if (!matchesTimeWindow(r.session_start, f.startTime, f.endTime)) return false;
    if (f.nightOnly && !isNightTimestamp(r.session_start)) return false;

    if (f.suspectPhone !== 'ALL' && r.subscriber_id !== f.suspectPhone) return false;
    if (f.subscriberId !== 'ALL' && r.subscriber_id !== f.subscriberId) return false;
    if (phoneQ && !r.subscriber_id.toLowerCase().includes(phoneQ)) return false;

    if (f.publicIp !== 'ALL' && r.public_ip !== f.publicIp) return false;
    if (srcPortQ && !String(r.source_port).includes(srcPortQ)) return false;
    if (f.destinationPort !== 'ALL' && String(r.destination_port) !== f.destinationPort) return false;
    if (f.protocol !== 'ALL' && r.protocol !== f.protocol) return false;

    if (q) {
      const hit =
        r.public_ip.toLowerCase().includes(q) ||
        r.destination_ip.toLowerCase().includes(q) ||
        String(r.source_port).includes(q) ||
        String(r.destination_port).includes(q) ||
        r.subscriber_id.toLowerCase().includes(q) ||
        r.service_indicator.toLowerCase().includes(q) ||
        r.protocol.toLowerCase().includes(q) ||
        r.record_id.toLowerCase().includes(q) ||
        r.source_file.toLowerCase().includes(q);
      if (!hit) return false;
    }

    return true;
  });
}

export interface FilterFieldOptions {
  suspects: Array<{ phoneNumber: string; label: string; alias: string }>;
  phoneNumbers: string[];
  towers: Array<{ cell_id: string; area: string }>;
  imeis: string[];
  publicIps: string[];
  destinationPorts: number[];
  subscribers: string[];
}

export function extractFilterOptions(
  activeCase: CaseRecord | null,
  cdrs: CDRRecord[],
  ipdrs: IPDRRecord[],
  towers: CellTower[]
): FilterFieldOptions {
  const phoneSet = new Set<string>();
  const towerIdsSeen = new Set<string>();
  const imeiSet = new Set<string>();

  for (const r of cdrs) {
    if (r.caller_number) phoneSet.add(r.caller_number);
    if (r.receiver_number) phoneSet.add(r.receiver_number);
    if (r.cell_id) towerIdsSeen.add(r.cell_id);
    if (r.imei) imeiSet.add(r.imei);
  }

  const towerAreaMap = new Map(towers.map((t) => [t.cell_id, t.area]));
  for (const t of towers) towerIdsSeen.add(t.cell_id);

  const towerList = Array.from(towerIdsSeen)
    .sort()
    .map((id) => ({
      cell_id: id,
      area: towerAreaMap.get(id) || 'Observed Sector',
    }));

  const publicIpSet = new Set<string>();
  const destPortSet = new Set<number>();
  const subSet = new Set<string>();
  for (const r of ipdrs) {
    if (r.public_ip) publicIpSet.add(r.public_ip);
    if (r.destination_port) destPortSet.add(r.destination_port);
    if (r.subscriber_id) subSet.add(r.subscriber_id);
  }

  return {
    suspects: (activeCase?.suspects || []).map((s) => ({
      phoneNumber: s.phoneNumber,
      label: s.label,
      alias: s.alias,
    })),
    phoneNumbers: Array.from(phoneSet).sort(),
    towers: towerList,
    imeis: Array.from(imeiSet).sort(),
    publicIps: Array.from(publicIpSet).sort(),
    destinationPorts: Array.from(destPortSet).sort((a, b) => a - b),
    subscribers: Array.from(subSet).sort(),
  };
}

export interface ActiveFilterToken {
  key: keyof ForensicFilters | 'dateRange' | 'timeRange';
  label: string;
  value: string;
}

export function getActiveFilterTokens(
  f: ForensicFilters,
  options: FilterFieldOptions
): ActiveFilterToken[] {
  const tokens: ActiveFilterToken[] = [];
  if (f.search.trim()) {
    tokens.push({ key: 'search', label: 'Search', value: `"${f.search.trim()}"` });
  }
  if (f.startDate || f.endDate) {
    tokens.push({
      key: 'dateRange',
      label: 'Date',
      value: `${f.startDate || 'Start'} → ${f.endDate || 'End'}`,
    });
  }
  if (f.startTime || f.endTime) {
    tokens.push({
      key: 'timeRange',
      label: 'Time (UTC)',
      value: `${f.startTime || '00:00'}–${f.endTime || '23:59'}`,
    });
  }
  if (f.nightOnly) {
    tokens.push({ key: 'nightOnly', label: 'Window', value: 'Night (22:00–05:00)' });
  }
  if (f.suspectPhone !== 'ALL') {
    const sus = options.suspects.find((s) => s.phoneNumber === f.suspectPhone);
    tokens.push({
      key: 'suspectPhone',
      label: 'Suspect',
      value: sus ? `${sus.label} (${sus.phoneNumber})` : f.suspectPhone,
    });
  }
  if (f.phoneNumber.trim()) {
    tokens.push({ key: 'phoneNumber', label: 'Phone', value: f.phoneNumber.trim() });
  }
  if (f.callType !== 'ALL') {
    tokens.push({ key: 'callType', label: 'Call Type', value: f.callType });
  }
  if (f.towerId !== 'ALL') {
    tokens.push({ key: 'towerId', label: 'Tower', value: f.towerId });
  }
  if (f.imei !== 'ALL') {
    tokens.push({
      key: 'imei',
      label: 'IMEI',
      value: f.imei === '__MISSING__' ? 'Missing IMEI' : f.imei,
    });
  }
  if (f.subscriberId !== 'ALL') {
    tokens.push({ key: 'subscriberId', label: 'Subscriber', value: f.subscriberId });
  }
  if (f.publicIp !== 'ALL') {
    tokens.push({ key: 'publicIp', label: 'Public IP', value: f.publicIp });
  }
  if (f.sourcePort.trim()) {
    tokens.push({ key: 'sourcePort', label: 'Source Port', value: f.sourcePort.trim() });
  }
  if (f.destinationPort !== 'ALL') {
    tokens.push({ key: 'destinationPort', label: 'Dest Port', value: f.destinationPort });
  }
  if (f.protocol !== 'ALL') {
    tokens.push({ key: 'protocol', label: 'Protocol', value: f.protocol });
  }
  return tokens;
}
