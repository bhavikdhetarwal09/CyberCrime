import type {
  CaseRecord,
  CDRRecord,
  CellTower,
  IPDRRecord,
  CallDirection,
  SuspectIdentifier,
  AuditLogEntry,
} from './types.ts';

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

function makeIso(year: number, monthIdx: number, day: number, hour: number, minute: number, second: number): string {
  return new Date(Date.UTC(year, monthIdx, day, hour, minute, second)).toISOString();
}

// ============================================================================
// CASE 03 — Digital Financial Fraud Investigation (Online Financial Fraud)
// ============================================================================
const TOWERS_CASE_3: CellTower[] = [
  {
    cell_id: 'TWR-MUM-01',
    tower_name: 'Sector 01 — Andheri East Commercial Hub (Synthetic)',
    area: 'Andheri East Zone',
    latitude: 19.1136,
    longitude: 72.8697,
    azimuth_deg: 40,
    coverage_radius_m: 1100,
    operator: 'Airtel-Demo',
  },
  {
    cell_id: 'TWR-MUM-02',
    tower_name: 'Sector 02 — BKC Financial Corridor (Synthetic)',
    area: 'Bandra Kurla Zone',
    latitude: 19.0653,
    longitude: 72.8687,
    azimuth_deg: 130,
    coverage_radius_m: 950,
    operator: 'Jio-Demo',
  },
  {
    cell_id: 'TWR-MUM-03',
    tower_name: 'Sector 03 — Kurla West Transit Node (Synthetic)',
    area: 'Kurla West Zone',
    latitude: 19.0728,
    longitude: 72.8826,
    azimuth_deg: 215,
    coverage_radius_m: 1300,
    operator: 'Vi-Demo',
  },
  {
    cell_id: 'TWR-MUM-04',
    tower_name: 'Sector 04 — Powai Tech Park North (Synthetic)',
    area: 'Powai Zone',
    latitude: 19.1197,
    longitude: 72.9051,
    azimuth_deg: 310,
    coverage_radius_m: 1400,
    operator: 'Jio-Demo',
  },
  {
    cell_id: 'TWR-MUM-05',
    tower_name: 'Sector 05 — Goregaon Link Road (Synthetic)',
    area: 'Goregaon Zone',
    latitude: 19.1663,
    longitude: 72.8526,
    azimuth_deg: 75,
    coverage_radius_m: 1250,
    operator: 'Airtel-Demo',
  },
];

// ============================================================================
// CASE 04 — SIM / IMEI and Identity Misuse Investigation
// ============================================================================
const TOWERS_CASE_4: CellTower[] = [
  {
    cell_id: 'TWR-BLR-01',
    tower_name: 'Sector 01 — Electronic City Phase 1 (Synthetic)',
    area: 'Electronic City Zone',
    latitude: 12.8452,
    longitude: 77.6602,
    azimuth_deg: 25,
    coverage_radius_m: 1300,
    operator: 'Jio-Demo',
  },
  {
    cell_id: 'TWR-BLR-02',
    tower_name: 'Sector 02 — Silk Board Junction (Synthetic)',
    area: 'HSR / Silk Board Zone',
    latitude: 12.9177,
    longitude: 77.6238,
    azimuth_deg: 115,
    coverage_radius_m: 1100,
    operator: 'Airtel-Demo',
  },
  {
    cell_id: 'TWR-BLR-03',
    tower_name: 'Sector 03 — Koramangala 4th Block (Synthetic)',
    area: 'Koramangala Zone',
    latitude: 12.9352,
    longitude: 77.6245,
    azimuth_deg: 205,
    coverage_radius_m: 1000,
    operator: 'Vi-Demo',
  },
  {
    cell_id: 'TWR-BLR-04',
    tower_name: 'Sector 04 — Whitefield ITPL Main (Synthetic)',
    area: 'Whitefield Zone',
    latitude: 12.9850,
    longitude: 77.7366,
    azimuth_deg: 280,
    coverage_radius_m: 1500,
    operator: 'Airtel-Demo',
  },
  {
    cell_id: 'TWR-BLR-05',
    tower_name: 'Sector 05 — Majestic Central Transit (Synthetic)',
    area: 'Central Bengaluru Zone',
    latitude: 12.9767,
    longitude: 77.5713,
    azimuth_deg: 350,
    coverage_radius_m: 1200,
    operator: 'Jio-Demo',
  },
];

// ============================================================================
// CASE 05 — Cyber Harassment and Suspicious Communication Investigation
// ============================================================================
const TOWERS_CASE_5: CellTower[] = [
  {
    cell_id: 'TWR-PUN-01',
    tower_name: 'Sector 01 — Shivajinagar Academic District (Synthetic)',
    area: 'Shivajinagar Zone',
    latitude: 18.5308,
    longitude: 73.8475,
    azimuth_deg: 50,
    coverage_radius_m: 1150,
    operator: 'Airtel-Demo',
  },
  {
    cell_id: 'TWR-PUN-02',
    tower_name: 'Sector 02 — Hinjawadi Phase 2 West (Synthetic)',
    area: 'Hinjawadi Zone',
    latitude: 18.5913,
    longitude: 73.7389,
    azimuth_deg: 145,
    coverage_radius_m: 1450,
    operator: 'Jio-Demo',
  },
  {
    cell_id: 'TWR-PUN-03',
    tower_name: 'Sector 03 — Kothrud Residential Spine (Synthetic)',
    area: 'Kothrud Zone',
    latitude: 18.5074,
    longitude: 73.8077,
    azimuth_deg: 230,
    coverage_radius_m: 1200,
    operator: 'Vi-Demo',
  },
  {
    cell_id: 'TWR-PUN-04',
    tower_name: 'Sector 04 — Viman Nagar Airport Road (Synthetic)',
    area: 'Viman Nagar Zone',
    latitude: 18.5679,
    longitude: 73.9143,
    azimuth_deg: 315,
    coverage_radius_m: 1350,
    operator: 'Airtel-Demo',
  },
];

export function generateAdditionalThreeSyntheticCases(): {
  cases: CaseRecord[];
  cdrsByCase: Record<string, CDRRecord[]>;
  ipdrsByCase: Record<string, IPDRRecord[]>;
  towersByCase: Record<string, CellTower[]>;
  auditLogs: AuditLogEntry[];
} {
  // --------------------------------------------------------------------------
  // CASE 03: Digital Financial Fraud Investigation
  // --------------------------------------------------------------------------
  const case3Id = 'CASE-TI-2026-0211';
  const rng3 = createRng(20260211);
  const case3Suspects: SuspectIdentifier[] = [
    {
      id: 'SUS-301',
      label: 'Suspect Caller 1',
      alias: 'Fake KYC Caller (Synthetic)',
      phoneNumber: '+91-98701-41001',
      primaryImei: '861240051198201',
      primaryImsi: '404200019841001',
      operator: 'Airtel-Demo',
      notes: 'Initiated high-frequency social-engineering voice calls immediately prior to unauthorized UPI debit windows.',
    },
    {
      id: 'SUS-302',
      label: 'Mule Coordinator',
      alias: 'Account Relay Handler (Synthetic)',
      phoneNumber: '+91-98701-41002',
      primaryImei: '861240051198202',
      primaryImsi: '405854019841002',
      operator: 'Jio-Demo',
      notes: 'Received rapid post-debit confirmation calls from Suspect Caller 1 and contacted three downstream mule accounts.',
    },
    {
      id: 'SUS-303',
      label: 'Synthetic Victim',
      alias: 'Complainant Account Holder (Synthetic)',
      phoneNumber: '+91-98701-41090',
      primaryImei: '354120089912301',
      primaryImsi: '404451019841090',
      operator: 'Airtel-Demo',
      notes: 'Reported unauthorized Rs. 2,85,000 multi-tranche debit following deceptive banking support calls.',
    },
  ];

  const case3MuleNumbers = ['+91-98701-41011', '+91-98701-41012', '+91-98701-41013', '+91-98701-41014'];
  const cdrsCase3: CDRRecord[] = [];
  let c3Row = 1;

  // Deterministic pre-fraud & rapid burst call cluster around 2026-11-12 to 2026-11-16
  for (let i = 0; i < 64; i++) {
    const day = 11 + Math.floor(i / 13);
    const isFraudBurst = i >= 12 && i <= 29;
    const hour = isFraudBurst ? 21 + (i % 3) : 9 + Math.floor(rng3() * 12);
    const minute = Math.floor(rng3() * 60);
    const second = Math.floor(rng3() * 60);

    let caller = case3Suspects[0].phoneNumber;
    let receiver = case3Suspects[2].phoneNumber;
    let callType: CallDirection = 'OUTGOING';
    let imei = case3Suspects[0].primaryImei;
    let imsi = case3Suspects[0].primaryImsi;
    let operator = 'Airtel-Demo';
    let duration = 45 + Math.floor(rng3() * 240);

    if (i % 3 === 1) {
      caller = case3Suspects[0].phoneNumber;
      receiver = case3Suspects[1].phoneNumber;
      callType = i % 6 === 1 ? 'SMS_OUT' : 'OUTGOING';
      duration = callType === 'SMS_OUT' ? 0 : 28 + Math.floor(rng3() * 110);
    } else if (i % 3 === 2) {
      caller = case3Suspects[1].phoneNumber;
      receiver = case3MuleNumbers[i % case3MuleNumbers.length];
      imei = case3Suspects[1].primaryImei;
      imsi = case3Suspects[1].primaryImsi;
      operator = 'Jio-Demo';
      callType = i % 9 === 2 ? 'INCOMING' : 'OUTGOING';
      duration = 20 + Math.floor(rng3() * 95);
    }

    const tower = TOWERS_CASE_3[i % TOWERS_CASE_3.length];
    cdrsCase3.push({
      record_id: `CDR-C3-${pad(c3Row)}`,
      case_id: case3Id,
      dataset_id: 'DS-301',
      caller_number: caller,
      receiver_number: receiver,
      call_type: callType,
      timestamp: makeIso(2026, 10, day, hour % 24, minute, second),
      duration_seconds: duration,
      cell_id: tower.cell_id,
      imei,
      imsi,
      operator,
      source_file: 'case3_financial_fraud_cdr_nov2026.csv',
      source_row: c3Row + 1,
    });
    c3Row += 1;
  }

  const ipdrsCase3: IPDRRecord[] = [];
  const case3Services = ['HTTPS (443) — Payment Gateway Relay', 'HTTPS (443) — Remote Screen App', 'UDP (3478) — VoIP Call Channel'];
  for (let i = 0; i < 26; i++) {
    const day = 11 + Math.floor(i / 6);
    const hour = i % 2 === 0 ? 22 : 14;
    const min = (i * 7) % 55;
    const sub = i % 2 === 0 ? case3Suspects[0].phoneNumber : case3Suspects[1].phoneNumber;
    ipdrsCase3.push({
      record_id: `IPDR-C3-${pad(i + 1)}`,
      case_id: case3Id,
      dataset_id: 'DS-302',
      public_ip: `203.0.113.${30 + (i % 5)}`,
      source_port: 41000 + i * 37,
      destination_ip: `198.51.100.${80 + (i % 4)}`,
      destination_port: i % 3 === 2 ? 3478 : 443,
      session_start: makeIso(2026, 10, day, hour, min, 5),
      session_end: makeIso(2026, 10, day, hour, Math.min(59, min + 4), 40),
      bytes_transferred: 340000 + Math.floor(rng3() * 1900000),
      subscriber_id: sub,
      protocol: i % 3 === 2 ? 'UDP' : 'TCP',
      service_indicator: case3Services[i % case3Services.length],
      operator: i % 2 === 0 ? 'Airtel-Demo' : 'Jio-Demo',
      source_file: 'case3_upi_relay_ipdr_nov2026.csv',
      source_row: i + 2,
    });
  }

  const case3Record: CaseRecord = {
    id: case3Id,
    caseNumber: 'TI-2026-0211',
    complaintId: 'TRACE-CMP-2026-0211',
    category: 'Online Financial Fraud',
    title: 'Digital Financial Fraud Investigation — Multi-Channel UPI Mule Network (Synthetic)',
    description:
      'Synthetic investigation into an unauthorized digital financial debit of Rs. 2,85,000 preceded by deceptive KYC verification calls and followed by rapid relay communications across four mule subscriber numbers.',
    investigator: 'R. Verma',
    incidentDateTime: '2026-11-12T21:15:00Z',
    relevantPhoneNumber: '+91-98701-41001',
    supportingInfo: 'Synthetic bank reference trail, call burst correlation logs, and TEST-NET IPDR relay sessions.',
    createdDate: '2026-11-16',
    updatedAt: '2026-11-20T09:40:00Z',
    status: 'Active',
    priority: 'High',
    suspects: case3Suspects,
    datasets: [
      {
        id: 'DS-301',
        caseId: case3Id,
        evidenceRefId: 'EVD-TI-2026-0211-001',
        fileName: 'case3_financial_fraud_cdr_nov2026.csv',
        fileType: 'CDR',
        schemaFormat: 'Operator A Standard CSV',
        operator: 'Airtel-Demo / Jio-Demo',
        recordCount: cdrsCase3.length,
        validCount: cdrsCase3.length,
        warningCount: 0,
        duplicateCount: 0,
        fileSizeBytes: 18420,
        uploadedBy: 'R. Verma',
        uploadedAt: '2026-11-16T10:12:00Z',
        normalizationStatus: 'Normalized',
        sha256Hash: '',
        integrityStatus: 'Verified',
        lastVerifiedAt: '2026-11-18T11:00:00Z',
        lastVerifiedBy: 'R. Verma',
      },
      {
        id: 'DS-302',
        caseId: case3Id,
        evidenceRefId: 'EVD-TI-2026-0211-002',
        fileName: 'case3_upi_relay_ipdr_nov2026.csv',
        fileType: 'IPDR',
        schemaFormat: 'ISP CGNAT IPDR CSV',
        operator: 'Airtel-Demo / Jio-Demo',
        recordCount: ipdrsCase3.length,
        validCount: ipdrsCase3.length,
        warningCount: 0,
        duplicateCount: 0,
        fileSizeBytes: 8640,
        uploadedBy: 'R. Verma',
        uploadedAt: '2026-11-16T10:25:00Z',
        normalizationStatus: 'Normalized',
        sha256Hash: '',
        integrityStatus: 'Verified',
        lastVerifiedAt: '2026-11-18T11:05:00Z',
        lastVerifiedBy: 'R. Verma',
      },
    ],
    notes: [
      {
        id: 'NOTE-301',
        caseId: case3Id,
        authorId: 'usr-inv-01',
        authorName: 'R. Verma',
        authorRole: 'Investigator',
        category: 'Lead',
        content:
          'High-density 21:00–23:59 UTC call burst between +91-98701-41001 and complainant (+91-98701-41090) precedes outbound relay calls from +91-98701-41002 to four mule endpoints.',
        createdAt: '2026-11-17T14:20:00Z',
      },
    ],
    custodyLog: [
      {
        id: 'COC-3001',
        caseId: case3Id,
        evidenceRefId: 'EVD-TI-2026-0211-001',
        datasetId: 'DS-301',
        fileName: 'case3_financial_fraud_cdr_nov2026.csv',
        action: 'INGESTED',
        actorName: 'R. Verma',
        actorRole: 'Investigator',
        sha256Hash: '',
        timestamp: '2026-11-16T10:12:00Z',
        notes: `Ingested ${cdrsCase3.length} synthetic financial fraud CDR records.`,
      },
      {
        id: 'COC-3002',
        caseId: case3Id,
        evidenceRefId: 'EVD-TI-2026-0211-002',
        datasetId: 'DS-302',
        fileName: 'case3_upi_relay_ipdr_nov2026.csv',
        action: 'INGESTED',
        actorName: 'R. Verma',
        actorRole: 'Investigator',
        sha256Hash: '',
        timestamp: '2026-11-16T10:25:00Z',
        notes: `Ingested ${ipdrsCase3.length} synthetic payment-window IPDR sessions.`,
      },
    ],
    verificationStatus: 'Pending Officer Verification',
    isSyntheticDemo: true,
  };

  // --------------------------------------------------------------------------
  // CASE 04: SIM / IMEI and Identity Misuse Investigation
  // --------------------------------------------------------------------------
  const case4Id = 'CASE-TI-2026-0224';
  const rng4 = createRng(20260224);
  const sharedHandsetImei = '354829110044211';
  const case4Suspects: SuspectIdentifier[] = [
    {
      id: 'SUS-401',
      label: 'Primary SIM Holder',
      alias: 'Multi-SIM Cycling Node A (Synthetic)',
      phoneNumber: '+91-97410-52001',
      primaryImei: sharedHandsetImei,
      primaryImsi: '405854029952001',
      operator: 'Jio-Demo',
      notes: 'Observed swapping across three distinct handset IMEIs within 96 hours while also sharing IMEI 354829110044211 with two other SIMs.',
    },
    {
      id: 'SUS-402',
      label: 'Secondary SIM Alias',
      alias: 'Shared-IMEI SIM B (Synthetic)',
      phoneNumber: '+91-97410-52002',
      primaryImei: sharedHandsetImei,
      primaryImsi: '404451029952002',
      operator: 'Airtel-Demo',
      notes: 'Activated on identical IMEI 354829110044211 immediately after SIM A ceased activity at Electronic City sector.',
    },
    {
      id: 'SUS-403',
      label: 'Tertiary SIM Alias',
      alias: 'Shared-IMEI SIM C (Synthetic)',
      phoneNumber: '+91-97410-52003',
      primaryImei: sharedHandsetImei,
      primaryImsi: '404200029952003',
      operator: 'Vi-Demo',
      notes: 'Third distinct IMSI observed inside the same physical handset IMEI during Whitefield/Koramangala transitions.',
    },
  ];

  const swapImeis = [sharedHandsetImei, '354829110088904', '867712040091337'];
  const cdrsCase4: CDRRecord[] = [];
  const case4Counterparts = ['+91-97410-52041', '+91-97410-52042', '+91-97410-52043', '+91-97410-52044'];

  for (let i = 0; i < 60; i++) {
    const day = 10 + Math.floor(i / 12);
    const hour = 8 + ((i * 3) % 15);
    const minute = (i * 11) % 60;
    const second = (i * 17) % 60;
    const tower = TOWERS_CASE_4[i % TOWERS_CASE_4.length];

    let caller = case4Suspects[0].phoneNumber;
    let imei = swapImeis[Math.floor(i / 20) % swapImeis.length];
    let imsi = case4Suspects[0].primaryImsi;
    let operator = 'Jio-Demo';

    if (i >= 20 && i < 38) {
      caller = case4Suspects[1].phoneNumber;
      imei = sharedHandsetImei;
      imsi = case4Suspects[1].primaryImsi;
      operator = 'Airtel-Demo';
    } else if (i >= 38 && i < 50) {
      caller = case4Suspects[2].phoneNumber;
      imei = sharedHandsetImei;
      imsi = case4Suspects[2].primaryImsi;
      operator = 'Vi-Demo';
    } else if (i >= 50) {
      // Back to primary number on swapped third IMEI
      caller = case4Suspects[0].phoneNumber;
      imei = swapImeis[2];
      imsi = case4Suspects[0].primaryImsi;
    }

    const receiver =
      i % 4 === 0
        ? case4Suspects[(i + 1) % case4Suspects.length].phoneNumber
        : case4Counterparts[i % case4Counterparts.length];

    cdrsCase4.push({
      record_id: `CDR-C4-${pad(i + 1)}`,
      case_id: case4Id,
      dataset_id: 'DS-401',
      caller_number: caller,
      receiver_number: receiver,
      call_type: i % 5 === 0 ? 'SMS_OUT' : i % 2 === 0 ? 'OUTGOING' : 'INCOMING',
      timestamp: makeIso(2026, 10, day, hour, minute, second),
      duration_seconds: i % 5 === 0 ? 0 : 18 + Math.floor(rng4() * 190),
      cell_id: tower.cell_id,
      imei,
      imsi,
      operator,
      source_file: 'case4_sim_imei_cycling_cdr_nov2026.csv',
      source_row: i + 2,
    });
  }

  const ipdrsCase4: IPDRRecord[] = [];
  for (let i = 0; i < 20; i++) {
    const day = 10 + Math.floor(i / 4);
    const sub = case4Suspects[i % case4Suspects.length].phoneNumber;
    ipdrsCase4.push({
      record_id: `IPDR-C4-${pad(i + 1)}`,
      case_id: case4Id,
      dataset_id: 'DS-402',
      public_ip: `192.0.2.${40 + (i % 4)}`,
      source_port: 52000 + i * 29,
      destination_ip: `203.0.113.${110 + (i % 3)}`,
      destination_port: 443,
      session_start: makeIso(2026, 10, day, 11 + (i % 10), (i * 9) % 54, 10),
      session_end: makeIso(2026, 10, day, 11 + (i % 10), ((i * 9) % 54) + 5, 22),
      bytes_transferred: 220000 + Math.floor(rng4() * 980000),
      subscriber_id: sub,
      protocol: i % 2 === 0 ? 'TCP' : 'QUIC',
      service_indicator: 'HTTPS (443) — SIM Provisioning / Identity Portal',
      operator: i % 2 === 0 ? 'Jio-Demo' : 'Airtel-Demo',
      source_file: 'case4_device_identity_ipdr_nov2026.csv',
      source_row: i + 2,
    });
  }

  const case4Record: CaseRecord = {
    id: case4Id,
    caseNumber: 'TI-2026-0224',
    complaintId: 'TRACE-CMP-2026-0224',
    category: 'SIM and Device Identity Misuse',
    title: 'SIM / IMEI and Identity Misuse Investigation — Multi-SIM Handset Cycling (Synthetic)',
    description:
      'Synthetic investigation into rapid SIM-to-handset rotation where three distinct synthetic IMSIs cycled inside shared IMEI 354829110044211 while primary subscriber +91-97410-52001 migrated across three handsets.',
    investigator: 'R. Verma',
    incidentDateTime: '2026-11-11T09:30:00Z',
    relevantPhoneNumber: '+91-97410-52001',
    supportingInfo: 'Multi-operator CDR dumps highlighting shared IMEI clusters and rapid IMSI switchover windows.',
    createdDate: '2026-11-17',
    updatedAt: '2026-11-20T12:10:00Z',
    status: 'Under Review',
    priority: 'High',
    suspects: case4Suspects,
    datasets: [
      {
        id: 'DS-401',
        caseId: case4Id,
        evidenceRefId: 'EVD-TI-2026-0224-001',
        fileName: 'case4_sim_imei_cycling_cdr_nov2026.csv',
        fileType: 'CDR',
        schemaFormat: 'Multi-Operator Normalized CDR',
        operator: 'Jio-Demo / Airtel-Demo / Vi-Demo',
        recordCount: cdrsCase4.length,
        validCount: cdrsCase4.length,
        warningCount: 0,
        duplicateCount: 0,
        fileSizeBytes: 17190,
        uploadedBy: 'R. Verma',
        uploadedAt: '2026-11-17T08:45:00Z',
        normalizationStatus: 'Normalized',
        sha256Hash: '',
        integrityStatus: 'Verified',
        lastVerifiedAt: '2026-11-19T10:15:00Z',
        lastVerifiedBy: 'R. Verma',
      },
      {
        id: 'DS-402',
        caseId: case4Id,
        evidenceRefId: 'EVD-TI-2026-0224-002',
        fileName: 'case4_device_identity_ipdr_nov2026.csv',
        fileType: 'IPDR',
        schemaFormat: 'ISP NAT IPDR CSV',
        operator: 'Jio-Demo / Airtel-Demo',
        recordCount: ipdrsCase4.length,
        validCount: ipdrsCase4.length,
        warningCount: 0,
        duplicateCount: 0,
        fileSizeBytes: 6810,
        uploadedBy: 'R. Verma',
        uploadedAt: '2026-11-17T09:00:00Z',
        normalizationStatus: 'Normalized',
        sha256Hash: '',
        integrityStatus: 'Verified',
        lastVerifiedAt: '2026-11-19T10:18:00Z',
        lastVerifiedBy: 'R. Verma',
      },
    ],
    notes: [
      {
        id: 'NOTE-401',
        caseId: case4Id,
        authorId: 'usr-inv-01',
        authorName: 'R. Verma',
        authorRole: 'Investigator',
        category: 'Verification',
        content:
          'IMEI 354829110044211 hosts three distinct synthetic SIMs (+91-97410-52001, -52002, -52003) across sequential time slices; KYC verification of CAF documents recommended.',
        createdAt: '2026-11-18T16:05:00Z',
      },
    ],
    custodyLog: [
      {
        id: 'COC-4001',
        caseId: case4Id,
        evidenceRefId: 'EVD-TI-2026-0224-001',
        datasetId: 'DS-401',
        fileName: 'case4_sim_imei_cycling_cdr_nov2026.csv',
        action: 'INGESTED',
        actorName: 'R. Verma',
        actorRole: 'Investigator',
        sha256Hash: '',
        timestamp: '2026-11-17T08:45:00Z',
        notes: `Ingested ${cdrsCase4.length} synthetic SIM/IMEI CDR rows.`,
      },
    ],
    verificationStatus: 'Pending Officer Verification',
    isSyntheticDemo: true,
  };

  // --------------------------------------------------------------------------
  // CASE 05: Cyber Harassment and Suspicious Communication Investigation
  // --------------------------------------------------------------------------
  const case5Id = 'CASE-TI-2026-0239';
  const rng5 = createRng(20260239);
  const case5Suspects: SuspectIdentifier[] = [
    {
      id: 'SUS-501',
      label: 'Primary Harassment Caller',
      alias: 'Repeated Night-Window Caller (Synthetic)',
      phoneNumber: '+91-96230-63001',
      primaryImei: '356910440281901',
      primaryImsi: '404451039963001',
      operator: 'Airtel-Demo',
      notes: 'Placed repeated unwanted late-night voice calls and high-frequency SMS bursts toward complainant number.',
    },
    {
      id: 'SUS-502',
      label: 'Secondary Harassment Number',
      alias: 'Alternate Messaging Line (Synthetic)',
      phoneNumber: '+91-96230-63002',
      primaryImei: '356910440281998',
      primaryImsi: '405854039963002',
      operator: 'Jio-Demo',
      notes: 'Resumed contact bursts immediately after complainant blocked primary caller.',
    },
    {
      id: 'SUS-503',
      label: 'Synthetic Complainant',
      alias: 'Complainant Target Number (Synthetic)',
      phoneNumber: '+91-96230-63090',
      primaryImei: '358120991104422',
      primaryImsi: '404200039963090',
      operator: 'Vi-Demo',
      notes: 'Filed formal cyber harassment complaint documenting repeated midnight calls and threatening messages.',
    },
  ];

  const cdrsCase5: CDRRecord[] = [];
  for (let i = 0; i < 56; i++) {
    const day = 12 + Math.floor(i / 10);
    // Heavy late-night pattern (22:00 - 03:00 UTC)
    const isNightHarassment = i % 3 !== 2;
    const hour = isNightHarassment ? [22, 23, 0, 1, 2][i % 5] : 13 + (i % 5);
    const minute = (i * 7) % 58;
    const second = (i * 13) % 59;
    const tower = TOWERS_CASE_5[i % TOWERS_CASE_5.length];

    const fromPrimary = i < 36 || i % 2 === 0;
    const caller = fromPrimary ? case5Suspects[0].phoneNumber : case5Suspects[1].phoneNumber;
    const receiver =
      i % 7 === 0
        ? fromPrimary
          ? case5Suspects[1].phoneNumber
          : case5Suspects[0].phoneNumber
        : case5Suspects[2].phoneNumber;

    const callType: CallDirection = i % 3 === 0 ? 'SMS_OUT' : 'OUTGOING';
    cdrsCase5.push({
      record_id: `CDR-C5-${pad(i + 1)}`,
      case_id: case5Id,
      dataset_id: 'DS-501',
      caller_number: caller,
      receiver_number: receiver,
      call_type: callType,
      timestamp: makeIso(2026, 10, day, hour, minute, second),
      duration_seconds: callType === 'SMS_OUT' ? 0 : 12 + Math.floor(rng5() * 65),
      cell_id: tower.cell_id,
      imei: fromPrimary ? case5Suspects[0].primaryImei : case5Suspects[1].primaryImei,
      imsi: fromPrimary ? case5Suspects[0].primaryImsi : case5Suspects[1].primaryImsi,
      operator: fromPrimary ? 'Airtel-Demo' : 'Jio-Demo',
      source_file: 'case5_cyber_harassment_cdr_nov2026.csv',
      source_row: i + 2,
    });
  }

  const ipdrsCase5: IPDRRecord[] = [];
  for (let i = 0; i < 16; i++) {
    const day = 12 + Math.floor(i / 3);
    const sub = i % 2 === 0 ? case5Suspects[0].phoneNumber : case5Suspects[1].phoneNumber;
    ipdrsCase5.push({
      record_id: `IPDR-C5-${pad(i + 1)}`,
      case_id: case5Id,
      dataset_id: 'DS-502',
      public_ip: `198.51.100.${140 + (i % 3)}`,
      source_port: 37000 + i * 41,
      destination_ip: `192.0.2.${150 + (i % 2)}`,
      destination_port: 443,
      session_start: makeIso(2026, 10, day, 23, (i * 3) % 52, 8),
      session_end: makeIso(2026, 10, day, 23, ((i * 3) % 52) + 6, 30),
      bytes_transferred: 185000 + Math.floor(rng5() * 750000),
      subscriber_id: sub,
      protocol: 'TCP',
      service_indicator: 'HTTPS (443) — Social Messaging Platform',
      operator: i % 2 === 0 ? 'Airtel-Demo' : 'Jio-Demo',
      source_file: 'case5_harassment_messaging_ipdr_nov2026.csv',
      source_row: i + 2,
    });
  }

  const case5Record: CaseRecord = {
    id: case5Id,
    caseNumber: 'TI-2026-0239',
    complaintId: 'TRACE-CMP-2026-0239',
    category: 'Cyber Harassment',
    title: 'Cyber Harassment and Suspicious Communication Investigation (Synthetic)',
    description:
      'Synthetic investigation concerning persistent unwanted late-night voice calls and SMS bursts targeting complainant +91-96230-63090 from two coordinated synthetic subscriber lines across Pune cell sectors.',
    investigator: 'R. Verma',
    incidentDateTime: '2026-11-12T22:30:00Z',
    relevantPhoneNumber: '+91-96230-63001',
    supportingInfo: 'Call frequency logs, SMS timestamps, tower sector transitions, and messaging IPDR sessions.',
    createdDate: '2026-11-18',
    updatedAt: '2026-11-20T15:30:00Z',
    status: 'Active',
    priority: 'Medium',
    suspects: case5Suspects,
    datasets: [
      {
        id: 'DS-501',
        caseId: case5Id,
        evidenceRefId: 'EVD-TI-2026-0239-001',
        fileName: 'case5_cyber_harassment_cdr_nov2026.csv',
        fileType: 'CDR',
        schemaFormat: 'Operator A / B Normalized CDR',
        operator: 'Airtel-Demo / Jio-Demo',
        recordCount: cdrsCase5.length,
        validCount: cdrsCase5.length,
        warningCount: 0,
        duplicateCount: 0,
        fileSizeBytes: 15840,
        uploadedBy: 'R. Verma',
        uploadedAt: '2026-11-18T11:00:00Z',
        normalizationStatus: 'Normalized',
        sha256Hash: '',
        integrityStatus: 'Verified',
        lastVerifiedAt: '2026-11-19T14:40:00Z',
        lastVerifiedBy: 'R. Verma',
      },
      {
        id: 'DS-502',
        caseId: case5Id,
        evidenceRefId: 'EVD-TI-2026-0239-002',
        fileName: 'case5_harassment_messaging_ipdr_nov2026.csv',
        fileType: 'IPDR',
        schemaFormat: 'ISP NAT IPDR CSV',
        operator: 'Airtel-Demo / Jio-Demo',
        recordCount: ipdrsCase5.length,
        validCount: ipdrsCase5.length,
        warningCount: 0,
        duplicateCount: 0,
        fileSizeBytes: 5490,
        uploadedBy: 'R. Verma',
        uploadedAt: '2026-11-18T11:15:00Z',
        normalizationStatus: 'Normalized',
        sha256Hash: '',
        integrityStatus: 'Verified',
        lastVerifiedAt: '2026-11-19T14:42:00Z',
        lastVerifiedBy: 'R. Verma',
      },
    ],
    notes: [
      {
        id: 'NOTE-501',
        caseId: case5Id,
        authorId: 'usr-inv-01',
        authorName: 'R. Verma',
        authorRole: 'Investigator',
        category: 'Observation',
        content:
          'Majority of outbound calls and SMS bursts from +91-96230-63001 and +91-96230-63002 occur between 22:00 and 02:59 UTC with direct coordination calls between both suspect lines.',
        createdAt: '2026-11-19T15:10:00Z',
      },
    ],
    custodyLog: [
      {
        id: 'COC-5001',
        caseId: case5Id,
        evidenceRefId: 'EVD-TI-2026-0239-001',
        datasetId: 'DS-501',
        fileName: 'case5_cyber_harassment_cdr_nov2026.csv',
        action: 'INGESTED',
        actorName: 'R. Verma',
        actorRole: 'Investigator',
        sha256Hash: '',
        timestamp: '2026-11-18T11:00:00Z',
        notes: `Ingested ${cdrsCase5.length} synthetic cyber harassment CDR records.`,
      },
    ],
    verificationStatus: 'Pending Officer Verification',
    isSyntheticDemo: true,
  };

  const auditLogs: AuditLogEntry[] = [
    {
      id: 'AUD-1006',
      timestamp: '2026-11-16T10:12:00Z',
      userId: 'usr-inv-01',
      userName: 'R. Verma',
      userRole: 'Investigator',
      action: 'DATA_IMPORT',
      caseId: case3Id,
      resource: 'case3_financial_fraud_cdr_nov2026.csv',
      status: 'Success',
      details: `Normalized ${cdrsCase3.length} synthetic CDR rows for Case TI-2026-0211 (Online Financial Fraud).`,
    },
    {
      id: 'AUD-1007',
      timestamp: '2026-11-17T08:45:00Z',
      userId: 'usr-inv-01',
      userName: 'R. Verma',
      userRole: 'Investigator',
      action: 'DATA_IMPORT',
      caseId: case4Id,
      resource: 'case4_sim_imei_cycling_cdr_nov2026.csv',
      status: 'Success',
      details: `Normalized ${cdrsCase4.length} synthetic CDR rows for Case TI-2026-0224 (SIM/IMEI Misuse).`,
    },
    {
      id: 'AUD-1008',
      timestamp: '2026-11-18T11:00:00Z',
      userId: 'usr-inv-01',
      userName: 'R. Verma',
      userRole: 'Investigator',
      action: 'DATA_IMPORT',
      caseId: case5Id,
      resource: 'case5_cyber_harassment_cdr_nov2026.csv',
      status: 'Success',
      details: `Normalized ${cdrsCase5.length} synthetic CDR rows for Case TI-2026-0239 (Cyber Harassment).`,
    },
  ];

  return {
    cases: [case3Record, case4Record, case5Record],
    cdrsByCase: {
      [case3Id]: cdrsCase3,
      [case4Id]: cdrsCase4,
      [case5Id]: cdrsCase5,
    },
    ipdrsByCase: {
      [case3Id]: ipdrsCase3,
      [case4Id]: ipdrsCase4,
      [case5Id]: ipdrsCase5,
    },
    towersByCase: {
      [case3Id]: TOWERS_CASE_3,
      [case4Id]: TOWERS_CASE_4,
      [case5Id]: TOWERS_CASE_5,
    },
    auditLogs,
  };
}
