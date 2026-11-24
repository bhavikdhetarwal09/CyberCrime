import type {
  CaseRecord,
  CDRRecord,
  CellTower,
  IPDRRecord,
  CallDirection,
  SuspectIdentifier,
  DatasetMeta,
  AuditLogEntry,
} from './types.ts';
import { generateAdditionalThreeSyntheticCases } from './additionalSyntheticCases.ts';

// Deterministic PRNG (Mulberry32) so every run produces identical, consistent synthetic evidence
function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function makeIso(dayOffset: number, hour: number, minute: number, second: number): string {
  // Base date: 2026-11-05 (synthetic 14-day window)
  const d = new Date(Date.UTC(2026, 10, 5 + dayOffset, hour, minute, second));
  return d.toISOString();
}

export const SYNTHETIC_TOWERS_CASE_1: CellTower[] = [
  {
    cell_id: 'TWR-JPR-01',
    tower_name: 'Sector 01 — Civil Lines North (Synthetic)',
    area: 'Civil Lines Zone',
    latitude: 26.9065,
    longitude: 75.7832,
    azimuth_deg: 45,
    coverage_radius_m: 1200,
    operator: 'Airtel-Demo',
  },
  {
    cell_id: 'TWR-JPR-02',
    tower_name: 'Sector 02 — Bani Park Hub (Synthetic)',
    area: 'Bani Park',
    latitude: 26.9278,
    longitude: 75.7924,
    azimuth_deg: 120,
    coverage_radius_m: 1100,
    operator: 'Jio-Demo',
  },
  {
    cell_id: 'TWR-JPR-03',
    tower_name: 'Sector 03 — Vaishali Commercial (Synthetic)',
    area: 'Vaishali Nagar',
    latitude: 26.9124,
    longitude: 75.7441,
    azimuth_deg: 210,
    coverage_radius_m: 1500,
    operator: 'Airtel-Demo',
  },
  {
    cell_id: 'TWR-JPR-04',
    tower_name: 'Sector 04 — MI Road Central (Synthetic)',
    area: 'Central Corridor',
    latitude: 26.9162,
    longitude: 75.8095,
    azimuth_deg: 90,
    coverage_radius_m: 900,
    operator: 'Airtel-Demo',
  },
  {
    cell_id: 'TWR-JPR-05',
    tower_name: 'Sector 05 — Mansarovar West (Synthetic)',
    area: 'Mansarovar',
    latitude: 26.8639,
    longitude: 75.7648,
    azimuth_deg: 315,
    coverage_radius_m: 1600,
    operator: 'Jio-Demo',
  },
  {
    cell_id: 'TWR-JPR-06',
    tower_name: 'Sector 06 — Tonk Road South (Synthetic)',
    area: 'Tonk Road',
    latitude: 26.8542,
    longitude: 75.8045,
    azimuth_deg: 180,
    coverage_radius_m: 1400,
    operator: 'Vi-Demo',
  },
  {
    cell_id: 'TWR-JPR-07',
    tower_name: 'Sector 07 — Malviya Industrial (Synthetic)',
    area: 'Malviya Industrial Area',
    latitude: 26.8588,
    longitude: 75.8264,
    azimuth_deg: 60,
    coverage_radius_m: 1300,
    operator: 'Airtel-Demo',
  },
  {
    cell_id: 'TWR-JPR-08',
    tower_name: 'Sector 08 — Sitapura IT Park (Synthetic)',
    area: 'Sitapura',
    latitude: 26.7875,
    longitude: 75.8291,
    azimuth_deg: 270,
    coverage_radius_m: 1800,
    operator: 'Jio-Demo',
  },
  {
    cell_id: 'TWR-JPR-09',
    tower_name: 'Sector 09 — Vidyadhar North (Synthetic)',
    area: 'Vidyadhar Nagar',
    latitude: 26.9612,
    longitude: 75.7815,
    azimuth_deg: 15,
    coverage_radius_m: 1500,
    operator: 'Vi-Demo',
  },
  {
    cell_id: 'TWR-JPR-10',
    tower_name: 'Sector 10 — Jagatpura Rail Link (Synthetic)',
    area: 'Jagatpura',
    latitude: 26.8355,
    longitude: 75.8542,
    azimuth_deg: 145,
    coverage_radius_m: 1700,
    operator: 'Jio-Demo',
  },
];

export const SYNTHETIC_TOWERS_CASE_2: CellTower[] = SYNTHETIC_TOWERS_CASE_1.slice(0, 5);

const CASE_1_SUSPECTS: SuspectIdentifier[] = [
  {
    id: 'SUS-A',
    label: 'Suspect A',
    alias: 'Arjun Dev (Synthetic)',
    phoneNumber: '+91-98290-10001',
    primaryImei: '354829104412001',
    primaryImsi: '404451009810001',
    operator: 'Airtel-Demo',
    notes: 'Primary synthetic test entity; handset IMEI changes mid-window on Nov 11.',
  },
  {
    id: 'SUS-B',
    label: 'Suspect B',
    alias: 'Vikram Rao (Synthetic)',
    phoneNumber: '+91-98290-10002',
    primaryImei: '864209051120334',
    primaryImsi: '405854009810002',
    operator: 'Jio-Demo',
    notes: 'Synthetic test entity sharing multiple bridge contacts and exhibiting SIM swap on IMEI 864209051120334.',
  },
  {
    id: 'SUS-C',
    label: 'Suspect C',
    alias: 'Neha Kulkarni (Synthetic)',
    phoneNumber: '+91-98290-10003',
    primaryImei: '359011882340559',
    primaryImsi: '404200009810003',
    operator: 'Vi-Demo',
    notes: 'Synthetic test entity with repeated MI Road & Malviya tower associations.',
  },
  {
    id: 'SUS-D',
    label: 'Suspect D',
    alias: 'Karan Mehta (Synthetic)',
    phoneNumber: '+91-98290-10004',
    primaryImei: '357712009914228',
    primaryImsi: '404451009810004',
    operator: 'Airtel-Demo',
    notes: 'High-frequency short-duration outgoing burst calls to synthetic external numbers.',
  },
];

const CASE_2_SUSPECTS: SuspectIdentifier[] = [
  {
    id: 'SUS-E',
    label: 'Suspect E',
    alias: 'Rohit Sen (Synthetic)',
    phoneNumber: '+91-98290-50001',
    primaryImei: '356601223344551',
    primaryImsi: '404451009850001',
    operator: 'Airtel-Demo',
    notes: 'Synthetic phishing test subscriber linked to NAT IPDR logs.',
  },
  {
    id: 'SUS-F',
    label: 'Suspect F',
    alias: 'Meera Joshi (Synthetic)',
    phoneNumber: '+91-98290-50002',
    primaryImei: '867712334455662',
    primaryImsi: '405854009850002',
    operator: 'Jio-Demo',
    notes: 'Synthetic secondary subscriber sharing bridge number +91-98290-60011.',
  },
];

// Bridge common contacts & peripheral contacts (all synthetic 98290-xxxxx numbers)
const BRIDGE_CONTACTS = [
  '+91-98290-20011', // Shared by Suspect A, B, C (high frequency coordinator)
  '+91-98290-20012', // Shared by Suspect A, B (late-night bridge)
  '+91-98290-20013', // Shared by Suspect B, C, D
];

const PERIPHERAL_CONTACTS = [
  '+91-98290-30101',
  '+91-98290-30102',
  '+91-98290-30103',
  '+91-98290-30104',
  '+91-98290-30105',
  '+91-98290-30106',
  '+91-98290-30107',
  '+91-98290-30108',
  '+91-98290-30109',
  '+91-98290-30110',
  '+91-98290-30111',
];

export interface SyntheticSeedData {
  cases: CaseRecord[];
  cdrsByCase: Record<string, CDRRecord[]>;
  ipdrsByCase: Record<string, IPDRRecord[]>;
  towersByCase: Record<string, CellTower[]>;
  initialAuditLogs: AuditLogEntry[];
}

export function generateSyntheticSeedData(): SyntheticSeedData {
  const rng = createRng(20261121);
  const case1Id = 'CASE-TI-2026-0142';
  const case2Id = 'CASE-TI-2026-0158';

  const cdrsCase1: CDRRecord[] = [];
  let airtelRow = 2;
  let jioRow = 2;

  const pushCdr = (params: {
    caller: string;
    receiver: string;
    callType: CallDirection;
    day: number;
    hour: number;
    minute: number;
    second: number;
    duration: number;
    cellId: string;
    imei: string;
    imsi: string;
    operator: 'Airtel-Demo' | 'Jio-Demo' | 'Vi-Demo';
    dataset: 'DS-01' | 'DS-02';
    qualityFlags?: string[];
  }) => {
    const isAirtelFile = params.dataset === 'DS-01';
    const rowNum = isAirtelFile ? airtelRow++ : jioRow++;
    const sourceFile = isAirtelFile
      ? 'airtel_demo_cdr_nov2026.csv'
      : 'jio_demo_cdr_nov2026.xlsx';
    const idx = cdrsCase1.length + 1;
    cdrsCase1.push({
      record_id: `CDR-142-${String(idx).padStart(4, '0')}`,
      case_id: case1Id,
      dataset_id: params.dataset,
      caller_number: params.caller,
      receiver_number: params.receiver,
      call_type: params.callType,
      timestamp: makeIso(params.day, params.hour, params.minute, params.second),
      duration_seconds: params.duration,
      cell_id: params.cellId,
      imei: params.imei,
      imsi: params.imsi,
      operator: params.operator,
      source_file: sourceFile,
      source_row: rowNum,
      quality_flags: params.qualityFlags,
    });
  };

  // 1. Deliberate forensic narrative events (so AI, Timeline, Map, IMEI, Network all strongly agree)
  // Suspect A movement sequence on Nov 10 (day 5): Civil Lines -> MI Road -> Malviya Industrial -> Sitapura
  const susA = CASE_1_SUSPECTS[0];
  const susB = CASE_1_SUSPECTS[1];
  const susC = CASE_1_SUSPECTS[2];
  const susD = CASE_1_SUSPECTS[3];
  const susANewImei = '358910224490882'; // Switched handset on day 6 (Nov 11)
  const susBAltNumber = '+91-98290-10099'; // Second SIM placed in Suspect B's handset (same IMEI!)
  const susBAltImsi = '405854009810099';

  // High-frequency bridge communication: Suspect A, B, C calling BRIDGE_CONTACTS[0] (+91-98290-20011)
  for (let d = 0; d < 12; d++) {
    const imeiA = d >= 6 ? susANewImei : susA.primaryImei;
    const towersA = ['TWR-JPR-01', 'TWR-JPR-04', 'TWR-JPR-07', 'TWR-JPR-04', 'TWR-JPR-08'];
    // Suspect A -> Bridge 1
    pushCdr({
      caller: susA.phoneNumber,
      receiver: BRIDGE_CONTACTS[0],
      callType: d % 3 === 0 ? 'INCOMING' : 'OUTGOING',
      day: d,
      hour: 10 + (d % 6),
      minute: Math.floor(rng() * 55),
      second: Math.floor(rng() * 59),
      duration: 145 + Math.floor(rng() * 320),
      cellId: towersA[d % towersA.length],
      imei: imeiA,
      imsi: susA.primaryImsi,
      operator: 'Airtel-Demo',
      dataset: 'DS-01',
    });

    // Suspect B -> Bridge 1
    pushCdr({
      caller: susB.phoneNumber,
      receiver: BRIDGE_CONTACTS[0],
      callType: d % 2 === 0 ? 'OUTGOING' : 'INCOMING',
      day: d,
      hour: 11 + (d % 5),
      minute: Math.floor(rng() * 55),
      second: Math.floor(rng() * 59),
      duration: 180 + Math.floor(rng() * 290),
      cellId: d % 2 === 0 ? 'TWR-JPR-02' : 'TWR-JPR-04',
      imei: susB.primaryImei,
      imsi: susB.primaryImsi,
      operator: 'Jio-Demo',
      dataset: 'DS-02',
    });

    // Suspect C -> Bridge 1 (every other day)
    if (d % 2 === 0) {
      pushCdr({
        caller: susC.phoneNumber,
        receiver: BRIDGE_CONTACTS[0],
        callType: 'OUTGOING',
        day: d,
        hour: 14 + (d % 4),
        minute: Math.floor(rng() * 55),
        second: Math.floor(rng() * 59),
        duration: 110 + Math.floor(rng() * 210),
        cellId: d % 4 === 0 ? 'TWR-JPR-04' : 'TWR-JPR-07',
        imei: susC.primaryImei,
        imsi: susC.primaryImsi,
        operator: 'Vi-Demo',
        dataset: 'DS-02',
      });
    }
  }

  // Night-time activity cluster (22:00 - 04:59) between Suspect A, Suspect B, and Bridge 2 (+91-98290-20012)
  const nightHours = [22, 23, 0, 1, 2, 3, 4];
  for (let i = 0; i < 28; i++) {
    const day = 1 + (i % 11);
    const hr = nightHours[i % nightHours.length];
    const imeiA = day >= 6 ? susANewImei : susA.primaryImei;
    const isAToB = i % 3 === 0;
    const isAToBridge2 = i % 3 === 1;
    if (isAToB) {
      pushCdr({
        caller: susA.phoneNumber,
        receiver: susB.phoneNumber,
        callType: i % 2 === 0 ? 'OUTGOING' : 'INCOMING',
        day,
        hour: hr,
        minute: 10 + (i * 7) % 48,
        second: (i * 13) % 59,
        duration: 95 + Math.floor(rng() * 240),
        cellId: i % 2 === 0 ? 'TWR-JPR-04' : 'TWR-JPR-07',
        imei: imeiA,
        imsi: susA.primaryImsi,
        operator: 'Airtel-Demo',
        dataset: 'DS-01',
      });
    } else if (isAToBridge2) {
      pushCdr({
        caller: susA.phoneNumber,
        receiver: BRIDGE_CONTACTS[1],
        callType: 'OUTGOING',
        day,
        hour: hr,
        minute: 5 + (i * 9) % 50,
        second: (i * 11) % 59,
        duration: 210 + Math.floor(rng() * 280),
        cellId: 'TWR-JPR-07',
        imei: imeiA,
        imsi: susA.primaryImsi,
        operator: 'Airtel-Demo',
        dataset: 'DS-01',
      });
    } else {
      pushCdr({
        caller: susB.phoneNumber,
        receiver: BRIDGE_CONTACTS[1],
        callType: 'INCOMING',
        day,
        hour: hr,
        minute: 12 + (i * 5) % 45,
        second: (i * 17) % 59,
        duration: 165 + Math.floor(rng() * 190),
        cellId: 'TWR-JPR-05',
        imei: susB.primaryImei,
        imsi: susB.primaryImsi,
        operator: 'Jio-Demo',
        dataset: 'DS-02',
      });
    }
  }

  // Chronological movement trail for Suspect A on Day 5 (Nov 10) across 5 towers
  const trailA: Array<{ hour: number; min: number; cell: string; peer: string; dur: number }> = [
    { hour: 8, min: 15, cell: 'TWR-JPR-01', peer: PERIPHERAL_CONTACTS[0], dur: 68 },
    { hour: 10, min: 42, cell: 'TWR-JPR-04', peer: BRIDGE_CONTACTS[0], dur: 245 },
    { hour: 13, min: 18, cell: 'TWR-JPR-04', peer: susC.phoneNumber, dur: 192 },
    { hour: 16, min: 5, cell: 'TWR-JPR-07', peer: susB.phoneNumber, dur: 310 },
    { hour: 19, min: 30, cell: 'TWR-JPR-08', peer: BRIDGE_CONTACTS[1], dur: 154 },
    { hour: 22, min: 48, cell: 'TWR-JPR-07', peer: BRIDGE_CONTACTS[0], dur: 284 },
  ];
  for (const stop of trailA) {
    pushCdr({
      caller: susA.phoneNumber,
      receiver: stop.peer,
      callType: 'OUTGOING',
      day: 5,
      hour: stop.hour,
      minute: stop.min,
      second: 22,
      duration: stop.dur,
      cellId: stop.cell,
      imei: susA.primaryImei,
      imsi: susA.primaryImsi,
      operator: 'Airtel-Demo',
      dataset: 'DS-01',
    });
  }

  // Co-location of Suspect C at TWR-JPR-04 and TWR-JPR-07 on Day 5
  pushCdr({
    caller: susC.phoneNumber,
    receiver: susA.phoneNumber,
    callType: 'INCOMING',
    day: 5,
    hour: 13,
    minute: 18,
    second: 22,
    duration: 192,
    cellId: 'TWR-JPR-04',
    imei: susC.primaryImei,
    imsi: susC.primaryImsi,
    operator: 'Vi-Demo',
    dataset: 'DS-02',
  });
  pushCdr({
    caller: susC.phoneNumber,
    receiver: BRIDGE_CONTACTS[2],
    callType: 'OUTGOING',
    day: 5,
    hour: 16,
    minute: 24,
    second: 11,
    duration: 135,
    cellId: 'TWR-JPR-07',
    imei: susC.primaryImei,
    imsi: susC.primaryImsi,
    operator: 'Vi-Demo',
    dataset: 'DS-02',
  });

  // SIM Swap event on Suspect B's handset (IMEI 864209051120334 used with alternate SIM +91-98290-10099 on Days 8-11)
  for (let i = 0; i < 8; i++) {
    pushCdr({
      caller: susBAltNumber,
      receiver: i % 2 === 0 ? BRIDGE_CONTACTS[0] : BRIDGE_CONTACTS[2],
      callType: i % 3 === 0 ? 'SMS_OUT' : 'OUTGOING',
      day: 8 + (i % 4),
      hour: 18 + (i % 5),
      minute: 11 + i * 5,
      second: 30,
      duration: i % 3 === 0 ? 0 : 75 + i * 19,
      cellId: i % 2 === 0 ? 'TWR-JPR-05' : 'TWR-JPR-10',
      imei: susB.primaryImei, // SAME IMEI as Suspect B!
      imsi: susBAltImsi,
      operator: 'Jio-Demo',
      dataset: 'DS-02',
    });
  }

  // Suspect D high-frequency short-duration outgoing burst pattern (unusual contact frequency)
  for (let i = 0; i < 34; i++) {
    const peer =
      i < 8 ? BRIDGE_CONTACTS[2] : PERIPHERAL_CONTACTS[i % PERIPHERAL_CONTACTS.length];
    pushCdr({
      caller: susD.phoneNumber,
      receiver: peer,
      callType: i % 5 === 0 ? 'SMS_OUT' : 'OUTGOING',
      day: 3 + (i % 9),
      hour: 9 + (i % 10),
      minute: Math.floor(rng() * 59),
      second: Math.floor(rng() * 59),
      duration: i % 5 === 0 ? 0 : 12 + Math.floor(rng() * 38),
      cellId: i % 3 === 0 ? 'TWR-JPR-03' : 'TWR-JPR-06',
      imei: susD.primaryImei,
      imsi: susD.primaryImsi,
      operator: 'Airtel-Demo',
      dataset: 'DS-01',
    });
  }

  // Remaining realistic synthetic CDRs to reach 240 total records across all suspects & contacts
  const allSuspects = CASE_1_SUSPECTS;
  const allTowers = SYNTHETIC_TOWERS_CASE_1.map((t) => t.cell_id);
  const callTypes: CallDirection[] = ['INCOMING', 'OUTGOING', 'OUTGOING', 'INCOMING', 'SMS_IN', 'SMS_OUT'];

  while (cdrsCase1.length < 240) {
    const sIdx = Math.floor(rng() * allSuspects.length);
    const sus = allSuspects[sIdx];
    const day = Math.floor(rng() * 14);
    const hour = Math.floor(rng() * 24);
    const minute = Math.floor(rng() * 60);
    const second = Math.floor(rng() * 60);
    const ct = callTypes[Math.floor(rng() * callTypes.length)];
    const isSms = ct === 'SMS_IN' || ct === 'SMS_OUT';
    const useBridge = rng() < 0.34;
    const peerPool = useBridge ? BRIDGE_CONTACTS : PERIPHERAL_CONTACTS;
    const peer = peerPool[Math.floor(rng() * peerPool.length)];

    const isIncoming = ct === 'INCOMING' || ct === 'SMS_IN';
    const caller = isIncoming ? peer : sus.phoneNumber;
    const receiver = isIncoming ? sus.phoneNumber : peer;

    const imei =
      sus.id === 'SUS-A' && day >= 6
        ? susANewImei
        : sus.primaryImei;

    const preferredTowers: Record<string, string[]> = {
      'SUS-A': ['TWR-JPR-01', 'TWR-JPR-04', 'TWR-JPR-07', 'TWR-JPR-08'],
      'SUS-B': ['TWR-JPR-02', 'TWR-JPR-04', 'TWR-JPR-05', 'TWR-JPR-10'],
      'SUS-C': ['TWR-JPR-04', 'TWR-JPR-06', 'TWR-JPR-07', 'TWR-JPR-09'],
      'SUS-D': ['TWR-JPR-03', 'TWR-JPR-06', 'TWR-JPR-09'],
    };
    const tList = preferredTowers[sus.id] || allTowers;
    const cellId = tList[Math.floor(rng() * tList.length)];
    const dataset = sus.operator === 'Airtel-Demo' ? 'DS-01' : 'DS-02';

    // Include 3 realistic records with minor missing-field quality flags to reflect real telecom data
    const qualityFlags: string[] = [];
    let finalImei = imei;
    if (cdrsCase1.length === 198 || cdrsCase1.length === 215) {
      finalImei = '';
      qualityFlags.push('Missing IMEI in operator export');
    }

    pushCdr({
      caller,
      receiver,
      callType: ct,
      day,
      hour,
      minute,
      second,
      duration: isSms ? 0 : 18 + Math.floor(rng() * 480),
      cellId,
      imei: finalImei,
      imsi: sus.primaryImsi,
      operator: sus.operator as 'Airtel-Demo' | 'Jio-Demo' | 'Vi-Demo',
      dataset,
      qualityFlags: qualityFlags.length > 0 ? qualityFlags : undefined,
    });
  }

  // Sort CDRs chronologically descending
  cdrsCase1.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Generate 64 IPDR sessions for Case 1 (RFC 5737 TEST-NET synthetic public IPs only)
  const ipdrsCase1: IPDRRecord[] = [];
  const syntheticPublicIps = [
    '198.51.100.14',
    '198.51.100.28',
    '198.51.100.42',
    '203.0.113.19',
    '203.0.113.77',
    '203.0.113.105',
  ];
  const syntheticDestEndpoints: Array<{ ip: string; port: number; protocol: 'TCP' | 'UDP' | 'QUIC'; service: string }> = [
    { ip: '192.0.2.44', port: 443, protocol: 'TCP', service: 'HTTPS / Encrypted Messaging Indicator' },
    { ip: '192.0.2.88', port: 5222, protocol: 'TCP', service: 'XMPP / VoIP Signaling Port' },
    { ip: '192.0.2.91', port: 3478, protocol: 'UDP', service: 'STUN / VoIP Media Relay' },
    { ip: '192.0.2.120', port: 443, protocol: 'QUIC', service: 'HTTP/3 Encrypted Tunnel' },
    { ip: '192.0.2.155', port: 8443, protocol: 'TCP', service: 'Alt-HTTPS Portal Endpoint' },
    { ip: '192.0.2.53', port: 53, protocol: 'UDP', service: 'DNS Resolver Query' },
  ];

  const subscribersPool = [
    susA.phoneNumber,
    susA.phoneNumber,
    susB.phoneNumber,
    susB.phoneNumber,
    susC.phoneNumber,
    susD.phoneNumber,
    'Unmapped (CGNAT)',
  ];

  for (let i = 0; i < 64; i++) {
    const day = Math.floor(rng() * 14);
    const hour = i < 18 ? [22, 23, 0, 1, 2, 3][i % 6] : Math.floor(rng() * 24);
    const minute = Math.floor(rng() * 55);
    const sec = Math.floor(rng() * 59);
    const sessionLengthSec = 45 + Math.floor(rng() * 2200);
    const startDate = new Date(Date.UTC(2026, 10, 5 + day, hour, minute, sec));
    const endDate = new Date(startDate.getTime() + sessionLengthSec * 1000);
    const dest = syntheticDestEndpoints[i % syntheticDestEndpoints.length];
    const sub = subscribersPool[i % subscribersPool.length];
    const pubIp =
      sub === susA.phoneNumber
        ? syntheticPublicIps[i % 2]
        : sub === susB.phoneNumber
        ? syntheticPublicIps[2 + (i % 2)]
        : syntheticPublicIps[i % syntheticPublicIps.length];

    ipdrsCase1.push({
      record_id: `IPDR-142-${String(i + 1).padStart(4, '0')}`,
      case_id: case1Id,
      dataset_id: 'DS-03',
      public_ip: pubIp,
      source_port: 32000 + Math.floor(rng() * 28000),
      destination_ip: dest.ip,
      destination_port: dest.port,
      session_start: startDate.toISOString(),
      session_end: endDate.toISOString(),
      bytes_transferred: 45000 + Math.floor(rng() * 14500000),
      subscriber_id: sub,
      protocol: dest.protocol,
      service_indicator: dest.service,
      operator: sub === susB.phoneNumber ? 'Jio-Demo' : 'Airtel-Demo',
      source_file: 'isp_nat_ipdr_nov2026.csv',
      source_row: i + 2,
    });
  }
  ipdrsCase1.sort((a, b) => b.session_start.localeCompare(a.session_start));

  // Generate Case 2 synthetic records (60 CDRs, 24 IPDRs)
  const cdrsCase2: CDRRecord[] = [];
  const bridgeCase2 = '+91-98290-60011';
  const peripheralCase2 = ['+91-98290-60101', '+91-98290-60102', '+91-98290-60103', '+91-98290-60104'];
  for (let i = 0; i < 60; i++) {
    const sus = CASE_2_SUSPECTS[i % 2];
    const peer = i % 3 === 0 ? bridgeCase2 : peripheralCase2[i % peripheralCase2.length];
    const isIn = i % 2 === 0;
    const ct: CallDirection = isIn ? 'INCOMING' : 'OUTGOING';
    cdrsCase2.push({
      record_id: `CDR-158-${String(i + 1).padStart(4, '0')}`,
      case_id: case2Id,
      dataset_id: 'DS-04',
      caller_number: isIn ? peer : sus.phoneNumber,
      receiver_number: isIn ? sus.phoneNumber : peer,
      call_type: ct,
      timestamp: makeIso(i % 10, (8 + i * 3) % 24, (i * 7) % 60, (i * 11) % 60),
      duration_seconds: 35 + ((i * 47) % 340),
      cell_id: SYNTHETIC_TOWERS_CASE_2[i % SYNTHETIC_TOWERS_CASE_2.length].cell_id,
      imei: sus.primaryImei,
      imsi: sus.primaryImsi,
      operator: sus.operator,
      source_file: 'case2_telecom_cdr_nov2026.csv',
      source_row: i + 2,
    });
  }
  cdrsCase2.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const ipdrsCase2: IPDRRecord[] = [];
  for (let i = 0; i < 24; i++) {
    const sus = CASE_2_SUSPECTS[i % 2];
    const startDate = new Date(Date.UTC(2026, 10, 6 + (i % 8), (9 + i * 2) % 24, (i * 5) % 60, 10));
    const endDate = new Date(startDate.getTime() + (120 + i * 45) * 1000);
    const dest = syntheticDestEndpoints[i % syntheticDestEndpoints.length];
    ipdrsCase2.push({
      record_id: `IPDR-158-${String(i + 1).padStart(4, '0')}`,
      case_id: case2Id,
      dataset_id: 'DS-05',
      public_ip: syntheticPublicIps[i % 3],
      source_port: 41000 + i * 117,
      destination_ip: dest.ip,
      destination_port: dest.port,
      session_start: startDate.toISOString(),
      session_end: endDate.toISOString(),
      bytes_transferred: 82000 + i * 125000,
      subscriber_id: sus.phoneNumber,
      protocol: dest.protocol,
      service_indicator: dest.service,
      operator: sus.operator,
      source_file: 'case2_nat_ipdr_nov2026.csv',
      source_row: i + 2,
    });
  }
  ipdrsCase2.sort((a, b) => b.session_start.localeCompare(a.session_start));

  const airtelCount = cdrsCase1.filter((r) => r.dataset_id === 'DS-01').length;
  const jioCount = cdrsCase1.filter((r) => r.dataset_id === 'DS-02').length;

  const datasetsCase1: DatasetMeta[] = [
    {
      id: 'DS-01',
      caseId: case1Id,
      evidenceRefId: 'EVD-TI-2026-0142-001',
      fileName: 'airtel_demo_cdr_nov2026.csv',
      fileType: 'CDR',
      schemaFormat: 'Operator A (Airtel Standard CSV)',
      operator: 'Airtel-Demo',
      recordCount: airtelCount,
      validCount: airtelCount - 2,
      warningCount: 2,
      duplicateCount: 0,
      fileSizeBytes: 38420,
      uploadedBy: 'R. Verma (Investigator)',
      uploadedAt: '2026-11-18T09:15:00Z',
      normalizationStatus: 'Normalized with Warnings',
      sha256Hash: '',
      integrityStatus: 'Unverified',
    },
    {
      id: 'DS-02',
      caseId: case1Id,
      evidenceRefId: 'EVD-TI-2026-0142-002',
      fileName: 'jio_demo_cdr_nov2026.xlsx',
      fileType: 'CDR',
      schemaFormat: 'Operator B (Jio Telecom XLSX)',
      operator: 'Jio-Demo / Vi-Demo',
      recordCount: jioCount,
      validCount: jioCount,
      warningCount: 0,
      duplicateCount: 0,
      fileSizeBytes: 42190,
      uploadedBy: 'R. Verma (Investigator)',
      uploadedAt: '2026-11-18T10:40:00Z',
      normalizationStatus: 'Normalized',
      sha256Hash: '',
      integrityStatus: 'Unverified',
    },
    {
      id: 'DS-03',
      caseId: case1Id,
      evidenceRefId: 'EVD-TI-2026-0142-003',
      fileName: 'isp_nat_ipdr_nov2026.csv',
      fileType: 'IPDR',
      schemaFormat: 'NAT Session IPDR CSV',
      operator: 'Multi-ISP Demo',
      recordCount: ipdrsCase1.length,
      validCount: ipdrsCase1.length,
      warningCount: 0,
      duplicateCount: 0,
      fileSizeBytes: 16240,
      uploadedBy: 'R. Verma (Investigator)',
      uploadedAt: '2026-11-18T11:20:00Z',
      normalizationStatus: 'Normalized',
      sha256Hash: '',
      integrityStatus: 'Unverified',
    },
  ];

  const datasetsCase2: DatasetMeta[] = [
    {
      id: 'DS-04',
      caseId: case2Id,
      evidenceRefId: 'EVD-TI-2026-0158-001',
      fileName: 'case2_telecom_cdr_nov2026.csv',
      fileType: 'CDR',
      schemaFormat: 'Operator A (Airtel Standard CSV)',
      operator: 'Airtel-Demo',
      recordCount: cdrsCase2.length,
      validCount: cdrsCase2.length,
      warningCount: 0,
      duplicateCount: 0,
      fileSizeBytes: 14820,
      uploadedBy: 'R. Verma (Investigator)',
      uploadedAt: '2026-11-19T14:10:00Z',
      normalizationStatus: 'Normalized',
      sha256Hash: '',
      integrityStatus: 'Unverified',
    },
    {
      id: 'DS-05',
      caseId: case2Id,
      evidenceRefId: 'EVD-TI-2026-0158-002',
      fileName: 'case2_nat_ipdr_nov2026.csv',
      fileType: 'IPDR',
      schemaFormat: 'NAT Session IPDR CSV',
      operator: 'Airtel-Demo',
      recordCount: ipdrsCase2.length,
      validCount: ipdrsCase2.length,
      warningCount: 0,
      duplicateCount: 0,
      fileSizeBytes: 6410,
      uploadedBy: 'R. Verma (Investigator)',
      uploadedAt: '2026-11-19T14:22:00Z',
      normalizationStatus: 'Normalized',
      sha256Hash: '',
      integrityStatus: 'Unverified',
    },
  ];

  const cases: CaseRecord[] = [
    {
      id: case1Id,
      caseNumber: 'TI-2026-0142',
      complaintId: 'TRACE-CMP-2026-0142',
      category: 'Online Financial Fraud',
      title: 'Synthetic Telecom Fraud Ring Correlation (Demo Case A)',
      description:
        'Multi-operator CDR normalization, common bridge contacts, late-night communication windows, tower-sequence overlaps, IMEI/SIM changes, and CGNAT IPDR session logs.',
      investigator: 'R. Verma',
      createdDate: '2026-11-15',
      updatedAt: '2026-11-20T16:45:00Z',
      status: 'Active',
      priority: 'High',
      suspects: CASE_1_SUSPECTS,
      datasets: datasetsCase1,
      notes: [
        {
          id: 'NOTE-1001',
          caseId: case1Id,
          authorId: 'usr-inv-01',
          authorName: 'R. Verma',
          authorRole: 'Investigator',
          category: 'Lead',
          content:
            'Common bridge contact +91-98290-20011 appears across Suspect A, Suspect B, and Suspect C during late-night windows (23:00–03:00 IST). Subscriber KYC request pending.',
          createdAt: '2026-11-19T16:15:00Z',
        },
        {
          id: 'NOTE-1002',
          caseId: case1Id,
          authorId: 'usr-inv-01',
          authorName: 'R. Verma',
          authorRole: 'Investigator',
          category: 'Observation',
          content:
            'Handset IMEI transition observed on Suspect A MSISDN (+91-98290-10001) and dual-SIM sharing observed on IMEI 864209051120334. Requires operator equipment confirmation.',
          createdAt: '2026-11-20T10:05:00Z',
        },
      ],
      custodyLog: [
        {
          id: 'COC-1001',
          caseId: case1Id,
          evidenceRefId: 'EVD-TI-2026-0142-001',
          datasetId: 'DS-01',
          fileName: 'airtel_demo_cdr_nov2026.csv',
          action: 'INGESTED',
          actorName: 'R. Verma',
          actorRole: 'Investigator',
          sha256Hash: '',
          timestamp: '2026-11-18T09:15:00Z',
          notes: `Ingested and normalized ${airtelCount} synthetic CDR rows (2 missing-IMEI warnings).`,
        },
        {
          id: 'COC-1002',
          caseId: case1Id,
          evidenceRefId: 'EVD-TI-2026-0142-002',
          datasetId: 'DS-02',
          fileName: 'jio_demo_cdr_nov2026.xlsx',
          action: 'INGESTED',
          actorName: 'R. Verma',
          actorRole: 'Investigator',
          sha256Hash: '',
          timestamp: '2026-11-18T10:40:00Z',
          notes: `Ingested and normalized ${jioCount} synthetic CDR rows via Operator B schema.`,
        },
        {
          id: 'COC-1003',
          caseId: case1Id,
          evidenceRefId: 'EVD-TI-2026-0142-003',
          datasetId: 'DS-03',
          fileName: 'isp_nat_ipdr_nov2026.csv',
          action: 'INGESTED',
          actorName: 'R. Verma',
          actorRole: 'Investigator',
          sha256Hash: '',
          timestamp: '2026-11-18T11:20:00Z',
          notes: `Ingested and normalized ${ipdrsCase1.length} synthetic NAT IPDR rows.`,
        },
      ],
      verificationStatus: 'Pending Officer Verification',
      isSyntheticDemo: true,
    },
    {
      id: case2Id,
      caseNumber: 'TI-2026-0158',
      complaintId: 'TRACE-CMP-2026-0158',
      category: 'Phishing and Account Takeover',
      title: 'Synthetic Cyber-Phishing Infrastructure Review (Demo Case B)',
      description:
        'Secondary test case illustrating strict case-level data isolation, IPDR destination port analysis, and cross-subscriber contact verification.',
      investigator: 'R. Verma',
      createdDate: '2026-11-19',
      updatedAt: '2026-11-20T11:30:00Z',
      status: 'Under Review',
      priority: 'Medium',
      suspects: CASE_2_SUSPECTS,
      datasets: datasetsCase2,
      notes: [
        {
          id: 'NOTE-2001',
          caseId: case2Id,
          authorId: 'usr-inv-01',
          authorName: 'R. Verma',
          authorRole: 'Investigator',
          category: 'Verification',
          content:
            'Initial IPDR port distribution review completed. All public IP addresses belong to synthetic RFC 5737 documentation ranges.',
          createdAt: '2026-11-20T11:20:00Z',
        },
      ],
      custodyLog: [
        {
          id: 'COC-2001',
          caseId: case2Id,
          evidenceRefId: 'EVD-TI-2026-0158-001',
          datasetId: 'DS-04',
          fileName: 'case2_telecom_cdr_nov2026.csv',
          action: 'INGESTED',
          actorName: 'R. Verma',
          actorRole: 'Investigator',
          sha256Hash: '',
          timestamp: '2026-11-19T14:10:00Z',
          notes: `Ingested and normalized ${cdrsCase2.length} synthetic CDR rows.`,
        },
        {
          id: 'COC-2002',
          caseId: case2Id,
          evidenceRefId: 'EVD-TI-2026-0158-002',
          datasetId: 'DS-05',
          fileName: 'case2_nat_ipdr_nov2026.csv',
          action: 'INGESTED',
          actorName: 'R. Verma',
          actorRole: 'Investigator',
          sha256Hash: '',
          timestamp: '2026-11-19T14:22:00Z',
          notes: `Ingested and normalized ${ipdrsCase2.length} synthetic NAT IPDR rows.`,
        },
      ],
      verificationStatus: 'Verified by Investigator',
      verifiedBy: 'R. Verma (Investigator)',
      verifiedAt: '2026-11-20T11:25:00Z',
      isSyntheticDemo: true,
    },
  ];

  const initialAuditLogs: AuditLogEntry[] = [
    {
      id: 'AUD-1001',
      timestamp: '2026-11-18T09:15:12Z',
      userId: 'usr-inv-01',
      userName: 'R. Verma',
      userRole: 'Investigator',
      action: 'DATA_IMPORT',
      caseId: case1Id,
      resource: 'airtel_demo_cdr_nov2026.csv',
      status: 'Success',
      details: `Normalized ${airtelCount} synthetic CDR rows (2 missing-IMEI warnings flagged).`,
    },
    {
      id: 'AUD-1002',
      timestamp: '2026-11-18T10:40:08Z',
      userId: 'usr-inv-01',
      userName: 'R. Verma',
      userRole: 'Investigator',
      action: 'DATA_IMPORT',
      caseId: case1Id,
      resource: 'jio_demo_cdr_nov2026.xlsx',
      status: 'Success',
      details: `Normalized ${jioCount} CDR rows via Operator B schema mapping.`,
    },
    {
      id: 'AUD-1003',
      timestamp: '2026-11-18T11:20:44Z',
      userId: 'usr-inv-01',
      userName: 'R. Verma',
      userRole: 'Investigator',
      action: 'DATA_IMPORT',
      caseId: case1Id,
      resource: 'isp_nat_ipdr_nov2026.csv',
      status: 'Success',
      details: 'Normalized 64 IPDR session rows (RFC 5737 TEST-NET ranges).',
    },
    {
      id: 'AUD-1004',
      timestamp: '2026-11-19T15:02:19Z',
      userId: 'usr-inv-01',
      userName: 'R. Verma',
      userRole: 'Investigator',
      action: 'AI_QUERY',
      caseId: case1Id,
      resource: 'AI Investigation Assistant',
      status: 'Success',
      details: 'Queried common contacts between Suspect A and Suspect B with evidence citations.',
    },
    {
      id: 'AUD-1005',
      timestamp: '2026-11-20T11:25:00Z',
      userId: 'usr-inv-01',
      userName: 'R. Verma',
      userRole: 'Investigator',
      action: 'REPORT_VERIFY',
      caseId: case2Id,
      resource: 'TI-2026-0158 Draft Report',
      status: 'Success',
      details: 'Investigator completed manual verification review on synthetic Case B.',
    },
  ];

  const additional = generateAdditionalThreeSyntheticCases();

  return {
    cases: [...cases, ...additional.cases],
    cdrsByCase: {
      [case1Id]: cdrsCase1,
      [case2Id]: cdrsCase2,
      ...additional.cdrsByCase,
    },
    ipdrsByCase: {
      [case1Id]: ipdrsCase1,
      [case2Id]: ipdrsCase2,
      ...additional.ipdrsByCase,
    },
    towersByCase: {
      [case1Id]: SYNTHETIC_TOWERS_CASE_1,
      [case2Id]: SYNTHETIC_TOWERS_CASE_2,
      ...additional.towersByCase,
    },
    initialAuditLogs: [...initialAuditLogs, ...additional.auditLogs],
  };
}

// Downloadable raw sample CSV templates for Data Import testing (2 distinct CDR schemas + 1 IPDR schema)
export const SAMPLE_IMPORT_FILES = {
  airtelCdrCsv: {
    fileName: 'sample_operator_a_airtel_cdr.csv',
    fileType: 'CDR' as const,
    schemaLabel: 'Operator A (Airtel Standard CSV)',
    content: [
      'Calling_No,Called_No,Call_Direction,Date_Time_UTC,Dur_Sec,First_Cell_ID,Handset_IMEI,Subscriber_IMSI,Circle_Operator',
      '+91-98290-10001,+91-98290-20011,OUTGOING,2026-11-19T22:45:10Z,214,TWR-JPR-04,358910224490882,404451009810001,Airtel-Demo',
      '+91-98290-20012,+91-98290-10001,INCOMING,2026-11-19T23:18:40Z,188,TWR-JPR-07,358910224490882,404451009810001,Airtel-Demo',
      '+91-98290-10001,+91-98290-20011,OUTGOING,2026-11-19T22:45:10Z,214,TWR-JPR-04,358910224490882,404451009810001,Airtel-Demo',
      '+91-98290-10004,+91-98290-30105,OUTGOING,INVALID_DATE_VALUE,42,TWR-JPR-03,357712009914228,404451009810004,Airtel-Demo',
      '+91-98290-10001,+91-98290-10002,OUTGOING,2026-11-20T01:12:05Z,305,TWR-JPR-07,,404451009810001,Airtel-Demo',
      '+91-98290-10004,+91-98290-20013,SMS_OUT,2026-11-20T09:15:22Z,0,TWR-JPR-06,357712009914228,404451009810004,Airtel-Demo',
    ].join('\n'),
  },
  jioCdrCsv: {
    fileName: 'sample_operator_b_jio_cdr.csv',
    fileType: 'CDR' as const,
    schemaLabel: 'Operator B (Jio Telecom Format)',
    content: [
      'A_PARTY,B_PARTY,SERVICE_TYPE,EVENT_TIMESTAMP,CALL_DURATION,CGI_TOWER,DEVICE_IMEI,SIM_IMSI,NETWORK',
      '+91-98290-10002,+91-98290-20011,MO_VOICE,2026-11-19T21:14:00Z,176,TWR-JPR-02,864209051120334,405854009810002,Jio-Demo',
      '+91-98290-10003,+91-98290-20011,MT_VOICE,2026-11-19T21:30:12Z,129,TWR-JPR-04,359011882340559,404200009810003,Vi-Demo',
      '+91-98290-10099,+91-98290-20012,MO_VOICE,2026-11-20T00:25:44Z,94,TWR-JPR-05,864209051120334,405854009810099,Jio-Demo',
      '+91-98290-10002,+91-98290-20013,MO_SMS,2026-11-20T02:10:09Z,0,TWR-JPR-10,864209051120334,405854009810002,Jio-Demo',
    ].join('\n'),
  },
  ispIpdrCsv: {
    fileName: 'sample_isp_nat_ipdr.csv',
    fileType: 'IPDR' as const,
    schemaLabel: 'NAT Session IPDR CSV',
    content: [
      'NAT_Public_IP,Src_Port,Dst_IP,Dst_Port,Start_Time_UTC,End_Time_UTC,MSISDN_Subscriber,L4_Proto,ISP_Name,Bytes_Total',
      '198.51.100.14,48210,192.0.2.44,443,2026-11-19T22:40:00Z,2026-11-19T23:05:12Z,+91-98290-10001,TCP,Airtel-Demo,1482000',
      '198.51.100.42,51904,192.0.2.91,3478,2026-11-19T23:12:30Z,2026-11-19T23:28:15Z,+91-98290-10002,UDP,Jio-Demo,4920300',
      '203.0.113.19,39011,192.0.2.88,5222,2026-11-20T01:05:00Z,2026-11-20T01:18:45Z,+91-98290-10001,TCP,Airtel-Demo,392400',
      '203.0.113.77,60114,192.0.2.120,443,2026-11-20T02:15:10Z,2026-11-20T02:44:00Z,Unmapped (CGNAT),QUIC,Vi-Demo,2910000',
    ].join('\n'),
  },
};
