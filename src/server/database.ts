import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AuthUser,
  UserRole,
  CaseRecord,
  CDRRecord,
  IPDRRecord,
  CellTower,
  AuditLogEntry,
  ComplaintRecord,
  ComplaintStatus,
  ComplaintStatusUpdate,
  AIResponsePayload,
} from '../shared/types.ts';
import { generateSyntheticSeedData } from '../shared/syntheticData.ts';

export interface StoredUser extends AuthUser {
  passwordSalt: string;
  passwordHash: string;
}

export interface StoredSession {
  tokenHash: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
}

export interface StoredOtpChallenge {
  challengeId: string;
  userId: string;
  role: UserRole;
  email: string;
  rememberSession: boolean;
  otpSalt: string;
  otpHash: string;
  expiresAt: number;
  createdAt: number;
  lastSentAt: number;
  attempts: number;
  maxAttempts: number;
}

export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(storedHash, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function computeDatasetCanonicalSha256FromRows(
  caseId: string,
  datasetId: string,
  fileType: 'CDR' | 'IPDR' | 'TOWER',
  cdrs: CDRRecord[],
  ipdrs: IPDRRecord[],
  clientFileSha256?: string
): string {
  const hash = crypto.createHash('sha256');
  hash.update(`TRACE_INTEL_EVIDENCE_V1|${caseId}|${datasetId}|${fileType}|`);
  if (clientFileSha256 && /^[a-f0-9]{64}$/i.test(clientFileSha256.trim())) {
    hash.update(`RAW_FILE_SHA256:${clientFileSha256.trim().toLowerCase()}|`);
  }
  if (fileType === 'CDR') {
    const rows = cdrs
      .filter((r) => r.dataset_id === datasetId)
      .slice()
      .sort((a, b) => a.record_id.localeCompare(b.record_id));
    for (const r of rows) {
      hash.update(
        `${r.record_id}|${r.caller_number}|${r.receiver_number}|${r.call_type}|${r.timestamp}|${r.duration_seconds}|${r.cell_id}|${r.imei}|${r.imsi}|${r.source_file}|${r.source_row}\n`
      );
    }
  } else if (fileType === 'IPDR') {
    const rows = ipdrs
      .filter((r) => r.dataset_id === datasetId)
      .slice()
      .sort((a, b) => a.record_id.localeCompare(b.record_id));
    for (const r of rows) {
      hash.update(
        `${r.record_id}|${r.public_ip}|${r.source_port}|${r.destination_ip}|${r.destination_port}|${r.session_start}|${r.session_end}|${r.bytes_transferred}|${r.subscriber_id}|${r.protocol}|${r.source_file}|${r.source_row}\n`
      );
    }
  }
  return hash.digest('hex');
}

const ALL_FIVE_SYNTHETIC_CASE_IDS = [
  'CASE-TI-2026-0142',
  'CASE-TI-2026-0158',
  'CASE-TI-2026-0211',
  'CASE-TI-2026-0224',
  'CASE-TI-2026-0239',
];

export const FIVE_DEMO_COMPLAINTS: ComplaintRecord[] = [
  {
    id: 'CMP-DEMO-0142',
    complaintId: 'TRACE-CMP-2026-0142',
    caseId: 'CASE-TI-2026-0142',
    ownerUserId: 'SYSTEM_DEMO',
    title: 'Synthetic Telecom Fraud Ring Correlation (Demo Case A)',
    category: 'Online Financial Fraud',
    description:
      'Multi-operator CDR normalization, common bridge contacts, late-night communication windows, tower-sequence overlaps, IMEI/SIM changes, and CGNAT IPDR session logs.',
    incidentDateTime: '2026-11-15T09:30:00Z',
    relevantPhoneNumber: '+91-98290-10001',
    supportingInfo: 'Synthetic baseline reference case study A for multi-subscriber telecom fraud analysis.',
    status: 'Assigned',
    statusUpdates: [
      {
        timestamp: '2026-11-15T09:30:00Z',
        status: 'Submitted',
        note: 'Citizen incident registered under unique ID TRACE-CMP-2026-0142.',
      },
      {
        timestamp: '2026-11-16T11:00:00Z',
        status: 'Assigned',
        note: 'Assigned to Cyber & Telecom Investigation Unit (Lead Investigator: R. Verma).',
      },
    ],
    createdAt: '2026-11-15T09:30:00Z',
    updatedAt: '2026-11-16T11:00:00Z',
  },
  {
    id: 'CMP-DEMO-0158',
    complaintId: 'TRACE-CMP-2026-0158',
    caseId: 'CASE-TI-2026-0158',
    ownerUserId: 'SYSTEM_DEMO',
    title: 'Synthetic Cyber-Phishing Infrastructure Review (Demo Case B)',
    category: 'Phishing and Account Takeover',
    description:
      'Secondary test case illustrating strict case-level data isolation, IPDR destination port analysis, and cross-subscriber contact verification.',
    incidentDateTime: '2026-11-19T10:15:00Z',
    relevantPhoneNumber: '+91-98290-10004',
    supportingInfo: 'Synthetic baseline reference case study B for phishing and IPDR destination analysis.',
    status: 'Under Review',
    statusUpdates: [
      {
        timestamp: '2026-11-19T10:15:00Z',
        status: 'Submitted',
        note: 'Citizen incident registered under unique ID TRACE-CMP-2026-0158.',
      },
      {
        timestamp: '2026-11-20T11:25:00Z',
        status: 'Under Review',
        note: 'Investigator verified evidence SHA-256 integrity and began IPDR port distribution review.',
      },
    ],
    createdAt: '2026-11-19T10:15:00Z',
    updatedAt: '2026-11-20T11:25:00Z',
  },
  {
    id: 'CMP-DEMO-0211',
    complaintId: 'TRACE-CMP-2026-0211',
    caseId: 'CASE-TI-2026-0211',
    ownerUserId: 'SYSTEM_DEMO',
    title: 'Synthetic Online Financial Fraud & UPI Relay (Demo Case C)',
    category: 'Online Financial Fraud',
    description:
      'Rapid beneficiary transfers, multi-hop mule account layering, and synchronized NAT IPDR session correlation.',
    incidentDateTime: '2026-11-16T10:00:00Z',
    relevantPhoneNumber: '+91-98290-30001',
    supportingInfo: 'Synthetic baseline reference case study C for UPI financial fraud correlation.',
    status: 'Assigned',
    statusUpdates: [
      {
        timestamp: '2026-11-16T10:00:00Z',
        status: 'Submitted',
        note: 'Citizen incident registered under unique ID TRACE-CMP-2026-0211.',
      },
      {
        timestamp: '2026-11-16T10:12:00Z',
        status: 'Assigned',
        note: 'Assigned to Financial Cyber Crimes Desk (Lead Investigator: R. Verma).',
      },
    ],
    createdAt: '2026-11-16T10:00:00Z',
    updatedAt: '2026-11-16T10:12:00Z',
  },
  {
    id: 'CMP-DEMO-0224',
    complaintId: 'TRACE-CMP-2026-0224',
    caseId: 'CASE-TI-2026-0224',
    ownerUserId: 'SYSTEM_DEMO',
    title: 'Synthetic SIM/IMEI Cycling & Device Handset Swap (Demo Case D)',
    category: 'SIM and Device Identity Misuse',
    description:
      'High-frequency IMSI swaps across shared hardware IMEI identifiers and burner SIM cycling.',
    incidentDateTime: '2026-11-17T08:30:00Z',
    relevantPhoneNumber: '+91-98290-40001',
    supportingInfo: 'Synthetic baseline reference case study D for handset IMEI and burner SIM tracking.',
    status: 'Under Review',
    statusUpdates: [
      {
        timestamp: '2026-11-17T08:30:00Z',
        status: 'Submitted',
        note: 'Citizen incident registered under unique ID TRACE-CMP-2026-0224.',
      },
      {
        timestamp: '2026-11-17T09:00:00Z',
        status: 'Under Review',
        note: 'Under active review for device IMEI correlation across carrier networks.',
      },
    ],
    createdAt: '2026-11-17T08:30:00Z',
    updatedAt: '2026-11-17T09:00:00Z',
  },
  {
    id: 'CMP-DEMO-0239',
    complaintId: 'TRACE-CMP-2026-0239',
    caseId: 'CASE-TI-2026-0239',
    ownerUserId: 'SYSTEM_DEMO',
    title: 'Synthetic Cyber Harassment & Multi-SIM Calling Ring (Demo Case E)',
    category: 'Cyber Harassment',
    description:
      'Repetitive night-window burst calling patterns, anonymous SIM cycling, and cross-operator coordination.',
    incidentDateTime: '2026-11-18T10:30:00Z',
    relevantPhoneNumber: '+91-98290-50001',
    supportingInfo: 'Synthetic baseline reference case study E for cyber harassment and late-night burst calling.',
    status: 'Assigned',
    statusUpdates: [
      {
        timestamp: '2026-11-18T10:30:00Z',
        status: 'Submitted',
        note: 'Citizen incident registered under unique ID TRACE-CMP-2026-0239.',
      },
      {
        timestamp: '2026-11-18T11:00:00Z',
        status: 'Assigned',
        note: 'Assigned to Cyber & Telecom Investigation Unit.',
      },
    ],
    createdAt: '2026-11-18T10:30:00Z',
    updatedAt: '2026-11-18T11:00:00Z',
  },
];

export const SEEDED_TEST_USERS: Array<Omit<StoredUser, 'passwordSalt' | 'passwordHash'> & { demoPass: string }> = [
  {
    id: 'usr-adm-01',
    email: 'admin@traceintel.demo',
    name: 'M. Rathore',
    badgeCode: 'ADM-01',
    role: 'Administrator',
    department: 'Platform Governance & Security',
    assignedCaseIds: [],
    isActive: true,
    canAccessSensitiveCaseData: false,
    demoPass: 'DemoAdmin#2026',
  },
  {
    id: 'usr-inv-01',
    email: 'investigator@traceintel.demo',
    name: 'R. Verma',
    badgeCode: 'INV-14',
    role: 'Investigator',
    department: 'Cyber & Telecom Investigation Unit',
    assignedCaseIds: [...ALL_FIVE_SYNTHETIC_CASE_IDS],
    isActive: true,
    canAccessSensitiveCaseData: true,
    demoPass: 'DemoInvest#2026',
  },
  {
    id: 'usr-inv-02',
    email: 'investigator2@traceintel.demo',
    name: 'K. Deshmukh',
    badgeCode: 'INV-22',
    role: 'Investigator',
    department: 'Financial Cyber Crimes Desk',
    assignedCaseIds: ['CASE-TI-2026-0211', 'CASE-TI-2026-0224'],
    isActive: true,
    canAccessSensitiveCaseData: true,
    demoPass: 'DemoInvest2#2026',
  },
  {
    id: 'usr-vwr-01',
    email: 'viewer@traceintel.demo',
    name: 'S. Nair',
    badgeCode: 'VWR-03',
    role: 'Viewer',
    department: 'Citizen Complaint Portal User',
    assignedCaseIds: [],
    isActive: true,
    canAccessSensitiveCaseData: false,
    demoPass: 'DemoViewer#2026',
  },
  {
    id: 'usr-vwr-02',
    email: 'viewer2@traceintel.demo',
    name: 'A. Kulkarni',
    badgeCode: 'VWR-07',
    role: 'Viewer',
    department: 'Citizen Complaint Portal User',
    assignedCaseIds: [],
    isActive: true,
    canAccessSensitiveCaseData: false,
    demoPass: 'DemoViewer2#2026',
  },
];

// Local & in-memory relational storage driver powered by Node.js v22 native node:sqlite
interface SqlDriver {
  engine: 'sqlite' | 'memory';
  targetLabel: string;
  exec(sql: string): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<void>;
}

function normalizeSqlPlaceholders(sql: string): string {
  return sql.replace(/\$\d+/g, '?');
}

async function createSqlDriver(): Promise<SqlDriver> {
  const sqliteMod = await import('node:sqlite');
  const storagePref = (process.env.TRACE_INTEL_STORAGE || 'sqlite').trim().toLowerCase();

  let engine: 'sqlite' | 'memory' = 'sqlite';
  let dbTarget = ':memory:';
  let targetLabel = 'In-Memory Storage';

  if (storagePref === 'memory') {
    engine = 'memory';
    dbTarget = ':memory:';
    targetLabel = 'In-Memory Storage';
  } else {
    const localPath = path.resolve(process.cwd(), 'data', 'trace_intel.sqlite');
    try {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      const probePath = path.join(path.dirname(localPath), '.write-probe');
      fs.writeFileSync(probePath, 'ok');
      fs.unlinkSync(probePath);
      dbTarget = localPath;
      targetLabel = `Local SQLite (${localPath})`;
    } catch {
      // Read-only filesystem fallback: run cleanly in-memory
      engine = 'memory';
      dbTarget = ':memory:';
      targetLabel = 'In-Memory Storage';
    }
  }

  const sqlite = new sqliteMod.DatabaseSync(dbTarget);
  if (engine === 'sqlite') {
    sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  } else {
    sqlite.exec('PRAGMA foreign_keys = ON;');
  }

  return {
    engine,
    targetLabel,
    async exec(sql: string) {
      sqlite.exec(sql);
    },
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
      const stmt = sqlite.prepare(normalizeSqlPlaceholders(sql));
      const normalized = params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p ?? null));
      return stmt.all(...(normalized as never[])) as T[];
    },
    async run(sql: string, params: unknown[] = []): Promise<void> {
      const stmt = sqlite.prepare(normalizeSqlPlaceholders(sql));
      const normalized = params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p ?? null));
      stmt.run(...(normalized as never[]));
    },
  };
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    badge_code TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    can_access_sensitive_case_data INTEGER NOT NULL DEFAULT 0,
    assigned_case_ids_json TEXT NOT NULL DEFAULT '[]',
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS user_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS otp_challenges (
    challenge_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT NOT NULL,
    remember_session INTEGER NOT NULL DEFAULT 0,
    otp_salt TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    last_sent_at BIGINT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5
  )`,
  `CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    case_number TEXT NOT NULL UNIQUE,
    complaint_id TEXT UNIQUE,
    owner_user_id TEXT,
    category TEXT NOT NULL DEFAULT 'General Investigation',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    investigator TEXT NOT NULL,
    incident_date_time TEXT,
    relevant_phone_number TEXT,
    supporting_info TEXT,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    is_viewer_complaint INTEGER NOT NULL DEFAULT 0,
    is_synthetic_demo INTEGER NOT NULL DEFAULT 0,
    verification_status TEXT NOT NULL DEFAULT 'Pending Officer Verification',
    verified_by TEXT,
    verified_at TEXT,
    suspects_json TEXT NOT NULL DEFAULT '[]',
    datasets_json TEXT NOT NULL DEFAULT '[]',
    notes_json TEXT NOT NULL DEFAULT '[]',
    custody_log_json TEXT NOT NULL DEFAULT '[]',
    created_date TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL UNIQUE,
    case_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    incident_date_time TEXT NOT NULL,
    relevant_phone_number TEXT NOT NULL DEFAULT '',
    supporting_info TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    status_updates_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cdr_records (
    record_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    dataset_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    PRIMARY KEY (case_id, record_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ipdr_records (
    record_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    dataset_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    PRIMARY KEY (case_id, record_id)
  )`,
  `CREATE TABLE IF NOT EXISTS tower_records (
    case_id TEXT NOT NULL,
    cell_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    PRIMARY KEY (case_id, cell_id)
  )`,
  `CREATE TABLE IF NOT EXISTS dataset_hashes (
    case_id TEXT NOT NULL,
    dataset_id TEXT NOT NULL,
    expected_hash TEXT NOT NULL,
    client_file_sha256 TEXT,
    PRIMARY KEY (case_id, dataset_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    question TEXT NOT NULL,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    case_id TEXT,
    resource TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cases_owner ON cases(owner_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_complaints_owner ON complaints(owner_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cdr_case ON cdr_records(case_id, dataset_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ipdr_case ON ipdr_records(case_id, dataset_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_case_user ON ai_conversations(case_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(timestamp)`,
];

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToStoredUser(row: Record<string, unknown>): StoredUser {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    badgeCode: String(row.badge_code),
    role: String(row.role) as UserRole,
    department: String(row.department),
    isActive: row.is_active === true || Number(row.is_active) === 1,
    canAccessSensitiveCaseData:
      row.can_access_sensitive_case_data === true || Number(row.can_access_sensitive_case_data) === 1,
    assignedCaseIds: safeJsonParse<string[]>(row.assigned_case_ids_json, []),
    passwordSalt: String(row.password_salt),
    passwordHash: String(row.password_hash),
  };
}

function rowToCaseRecord(row: Record<string, unknown>): CaseRecord {
  return {
    id: String(row.id),
    caseNumber: String(row.case_number),
    complaintId: row.complaint_id ? String(row.complaint_id) : undefined,
    ownerUserId: row.owner_user_id ? String(row.owner_user_id) : undefined,
    category: row.category ? String(row.category) : undefined,
    title: String(row.title),
    description: String(row.description),
    investigator: String(row.investigator),
    incidentDateTime: row.incident_date_time ? String(row.incident_date_time) : undefined,
    relevantPhoneNumber: row.relevant_phone_number ? String(row.relevant_phone_number) : undefined,
    supportingInfo: row.supporting_info ? String(row.supporting_info) : undefined,
    status: String(row.status) as CaseRecord['status'],
    priority: String(row.priority) as CaseRecord['priority'],
    isViewerComplaint: row.is_viewer_complaint === true || Number(row.is_viewer_complaint) === 1,
    isSyntheticDemo: row.is_synthetic_demo === true || Number(row.is_synthetic_demo) === 1,
    verificationStatus: String(row.verification_status) as CaseRecord['verificationStatus'],
    verifiedBy: row.verified_by ? String(row.verified_by) : undefined,
    verifiedAt: row.verified_at ? String(row.verified_at) : undefined,
    suspects: safeJsonParse(row.suspects_json, []),
    datasets: safeJsonParse(row.datasets_json, []),
    notes: safeJsonParse(row.notes_json, []),
    custodyLog: safeJsonParse(row.custody_log_json, []),
    createdDate: String(row.created_date),
    updatedAt: String(row.updated_at),
  };
}

function rowToComplaint(row: Record<string, unknown>): ComplaintRecord {
  return {
    id: String(row.id),
    complaintId: String(row.complaint_id),
    caseId: String(row.case_id),
    ownerUserId: String(row.owner_user_id),
    title: String(row.title),
    category: String(row.category),
    description: String(row.description),
    incidentDateTime: String(row.incident_date_time),
    relevantPhoneNumber: String(row.relevant_phone_number || ''),
    supportingInfo: String(row.supporting_info || ''),
    status: String(row.status) as ComplaintStatus,
    statusUpdates: safeJsonParse<ComplaintStatusUpdate[]>(row.status_updates_json, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class TraceDatabase {
  private driver: SqlDriver;
  public defaultReferenceTowers: CellTower[] = [];

  constructor(driver: SqlDriver) {
    this.driver = driver;
  }

  get engine(): 'sqlite' | 'memory' {
    return this.driver.engine;
  }

  get targetLabel(): string {
    return this.driver.targetLabel;
  }

  async initialize(): Promise<void> {
    for (const stmt of SCHEMA_STATEMENTS) {
      await this.driver.exec(stmt);
    }

    const seed = generateSyntheticSeedData();
    this.defaultReferenceTowers = (seed.towersByCase['CASE-TI-2026-0142'] || []).map((t) => ({ ...t }));

    const existingUsers = await this.driver.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM users');
    const userCount = Number(existingUsers[0]?.cnt || 0);
    if (userCount === 0) {
      await this.seedInitialBaseline(false);
    } else {
      // Ensure the 5 baseline synthetic cases exist if upgrading from an older 2-case database
      await this.ensureFiveSyntheticCasesExist();
    }
  }

  private async ensureFiveSyntheticCasesExist(): Promise<void> {
    const seed = generateSyntheticSeedData();
    for (const c of seed.cases) {
      const existing = await this.getCaseById(c.id);
      if (!existing) {
        const cdrs = seed.cdrsByCase[c.id] || [];
        const ipdrs = seed.ipdrsByCase[c.id] || [];
        const towers = seed.towersByCase[c.id] || [];
        for (const ds of c.datasets) {
          const digest = computeDatasetCanonicalSha256FromRows(c.id, ds.id, ds.fileType, cdrs, ipdrs);
          ds.sha256Hash = digest;
          for (const entry of c.custodyLog) {
            if (entry.datasetId === ds.id && !entry.sha256Hash) {
              entry.sha256Hash = digest;
            }
          }
          await this.upsertDatasetHash(c.id, ds.id, digest);
        }
        await this.upsertCase(c);
        await this.insertCdrs(cdrs);
        await this.insertIpdrs(ipdrs);
        await this.upsertTowers(c.id, towers);
      } else if (!existing.complaintId && c.complaintId) {
        existing.complaintId = c.complaintId;
        if (!existing.category && c.category) {
          existing.category = c.category;
        }
        await this.upsertCase(existing);
      }
    }
    // Ensure the 5 demo complaints are seeded
    for (const cmp of FIVE_DEMO_COMPLAINTS) {
      await this.upsertComplaint(cmp);
    }
    // Ensure primary Investigator A has all 5 baseline synthetic cases assigned
    const inv1 = await this.findUserById('usr-inv-01');
    if (inv1) {
      const merged = Array.from(new Set([...inv1.assignedCaseIds, ...ALL_FIVE_SYNTHETIC_CASE_IDS]));
      if (merged.length !== inv1.assignedCaseIds.length) {
        inv1.assignedCaseIds = merged;
        await this.updateUser(inv1);
      }
    }
  }

  async seedInitialBaseline(clearExisting: boolean): Promise<void> {
    if (clearExisting) {
      await this.driver.run('DELETE FROM ai_conversations');
      await this.driver.run('DELETE FROM complaints');
      await this.driver.run('DELETE FROM cdr_records');
      await this.driver.run('DELETE FROM ipdr_records');
      await this.driver.run('DELETE FROM tower_records');
      await this.driver.run('DELETE FROM dataset_hashes');
      await this.driver.run('DELETE FROM cases');
      await this.driver.run('DELETE FROM audit_logs');
      await this.driver.run('DELETE FROM otp_challenges');
      // Keep active admin session alive while resetting user scopes
    }

    const nowIso = new Date().toISOString();
    for (const u of SEEDED_TEST_USERS) {
      const existing = await this.findUserById(u.id);
      if (!existing) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = hashPassword(u.demoPass, salt);
        await this.insertUser({
          id: u.id,
          email: u.email,
          name: u.name,
          badgeCode: u.badgeCode,
          role: u.role,
          department: u.department,
          assignedCaseIds: [...u.assignedCaseIds],
          isActive: u.isActive,
          canAccessSensitiveCaseData: Boolean(u.canAccessSensitiveCaseData),
          passwordSalt: salt,
          passwordHash: hash,
        });
      } else if (clearExisting) {
        existing.role = u.role;
        existing.assignedCaseIds = [...u.assignedCaseIds];
        existing.isActive = u.isActive;
        existing.canAccessSensitiveCaseData = Boolean(u.canAccessSensitiveCaseData);
        await this.updateUser(existing);
      }
    }

    const seed = generateSyntheticSeedData();
    for (const c of seed.cases) {
      const cdrs = seed.cdrsByCase[c.id] || [];
      const ipdrs = seed.ipdrsByCase[c.id] || [];
      const towers = seed.towersByCase[c.id] || [];
      for (const ds of c.datasets) {
        const digest = computeDatasetCanonicalSha256FromRows(c.id, ds.id, ds.fileType, cdrs, ipdrs);
        ds.sha256Hash = digest;
        for (const entry of c.custodyLog) {
          if (entry.datasetId === ds.id && !entry.sha256Hash) {
            entry.sha256Hash = digest;
          }
        }
        await this.upsertDatasetHash(c.id, ds.id, digest);
      }
      await this.upsertCase(c);
      await this.insertCdrs(cdrs);
      await this.insertIpdrs(ipdrs);
      await this.upsertTowers(c.id, towers);
    }

    for (const cmp of FIVE_DEMO_COMPLAINTS) {
      await this.upsertComplaint(cmp);
    }

    for (const log of seed.initialAuditLogs) {
      await this.insertAuditLog({ ...log, timestamp: log.timestamp || nowIso });
    }
  }

  // ---------------- USERS ----------------
  async getAllUsers(): Promise<StoredUser[]> {
    const rows = await this.driver.query('SELECT * FROM users ORDER BY created_at ASC');
    return rows.map(rowToStoredUser);
  }

  async findUserById(userId: string): Promise<StoredUser | null> {
    const rows = await this.driver.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
    return rows[0] ? rowToStoredUser(rows[0]) : null;
  }

  async findUserByEmailOrBadge(identifier: string): Promise<StoredUser | null> {
    const norm = identifier.trim().toLowerCase();
    const rows = await this.driver.query(
      'SELECT * FROM users WHERE LOWER(email) = $1 OR LOWER(badge_code) = $1 LIMIT 1',
      [norm]
    );
    return rows[0] ? rowToStoredUser(rows[0]) : null;
  }

  async insertUser(user: StoredUser): Promise<void> {
    const now = new Date().toISOString();
    await this.driver.run(
      `INSERT INTO users (
        id, email, name, badge_code, role, department, is_active,
        can_access_sensitive_case_data, assigned_case_ids_json,
        password_salt, password_hash, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        user.id,
        user.email.toLowerCase(),
        user.name,
        user.badgeCode,
        user.role,
        user.department,
        user.isActive ? 1 : 0,
        user.canAccessSensitiveCaseData ? 1 : 0,
        JSON.stringify(user.assignedCaseIds),
        user.passwordSalt,
        user.passwordHash,
        now,
        now,
      ]
    );
  }

  async updateUser(user: StoredUser): Promise<void> {
    await this.driver.run(
      `UPDATE users SET
        name = $2,
        role = $3,
        department = $4,
        is_active = $5,
        can_access_sensitive_case_data = $6,
        assigned_case_ids_json = $7,
        updated_at = $8
      WHERE id = $1`,
      [
        user.id,
        user.name,
        user.role,
        user.department,
        user.isActive ? 1 : 0,
        user.canAccessSensitiveCaseData ? 1 : 0,
        JSON.stringify(user.assignedCaseIds),
        new Date().toISOString(),
      ]
    );
  }

  // ---------------- SESSIONS ----------------
  async createSession(session: StoredSession): Promise<void> {
    await this.driver.run(
      `INSERT INTO user_sessions (token_hash, user_id, expires_at, created_at) VALUES ($1,$2,$3,$4)`,
      [session.tokenHash, session.userId, session.expiresAt, session.createdAt]
    );
  }

  async getSessionByTokenHash(tokenHash: string): Promise<StoredSession | null> {
    const rows = await this.driver.query(
      'SELECT * FROM user_sessions WHERE token_hash = $1 LIMIT 1',
      [tokenHash]
    );
    if (!rows[0]) return null;
    return {
      tokenHash: String(rows[0].token_hash),
      userId: String(rows[0].user_id),
      expiresAt: Number(rows[0].expires_at),
      createdAt: Number(rows[0].created_at),
    };
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.driver.run('DELETE FROM user_sessions WHERE token_hash = $1', [tokenHash]);
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    await this.driver.run('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
  }

  async pruneExpiredSessions(): Promise<void> {
    await this.driver.run('DELETE FROM user_sessions WHERE expires_at < $1', [Date.now()]);
  }

  async countActiveSessions(): Promise<number> {
    const rows = await this.driver.query<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM user_sessions WHERE expires_at >= $1',
      [Date.now()]
    );
    return Number(rows[0]?.cnt || 0);
  }

  // ---------------- OTP CHALLENGES ----------------
  async saveOtpChallenge(ch: StoredOtpChallenge): Promise<void> {
    await this.driver.run(
      `INSERT INTO otp_challenges (
        challenge_id, user_id, role, email, remember_session,
        otp_salt, otp_hash, expires_at, created_at, last_sent_at, attempts, max_attempts
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (challenge_id) DO UPDATE SET
        otp_salt = EXCLUDED.otp_salt,
        otp_hash = EXCLUDED.otp_hash,
        expires_at = EXCLUDED.expires_at,
        last_sent_at = EXCLUDED.last_sent_at,
        attempts = EXCLUDED.attempts`,
      [
        ch.challengeId,
        ch.userId,
        ch.role,
        ch.email,
        ch.rememberSession ? 1 : 0,
        ch.otpSalt,
        ch.otpHash,
        ch.expiresAt,
        ch.createdAt,
        ch.lastSentAt,
        ch.attempts,
        ch.maxAttempts,
      ]
    );
  }

  async getOtpChallenge(challengeId: string): Promise<StoredOtpChallenge | null> {
    const rows = await this.driver.query(
      'SELECT * FROM otp_challenges WHERE challenge_id = $1 LIMIT 1',
      [challengeId]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      challengeId: String(r.challenge_id),
      userId: String(r.user_id),
      role: String(r.role) as UserRole,
      email: String(r.email),
      rememberSession: r.remember_session === true || Number(r.remember_session) === 1,
      otpSalt: String(r.otp_salt),
      otpHash: String(r.otp_hash),
      expiresAt: Number(r.expires_at),
      createdAt: Number(r.created_at),
      lastSentAt: Number(r.last_sent_at),
      attempts: Number(r.attempts),
      maxAttempts: Number(r.max_attempts),
    };
  }

  async deleteOtpChallenge(challengeId: string): Promise<void> {
    await this.driver.run('DELETE FROM otp_challenges WHERE challenge_id = $1', [challengeId]);
  }

  async pruneExpiredOtpChallenges(): Promise<void> {
    await this.driver.run('DELETE FROM otp_challenges WHERE expires_at < $1', [Date.now()]);
  }

  // ---------------- CASES ----------------
  async getAllCases(): Promise<CaseRecord[]> {
    const rows = await this.driver.query('SELECT * FROM cases ORDER BY updated_at DESC');
    return rows.map(rowToCaseRecord);
  }

  async getCaseById(caseId: string): Promise<CaseRecord | null> {
    const rows = await this.driver.query('SELECT * FROM cases WHERE id = $1 LIMIT 1', [caseId]);
    return rows[0] ? rowToCaseRecord(rows[0]) : null;
  }

  async upsertCase(c: CaseRecord): Promise<void> {
    await this.driver.run(
      `INSERT INTO cases (
        id, case_number, complaint_id, owner_user_id, category, title, description,
        investigator, incident_date_time, relevant_phone_number, supporting_info,
        status, priority, is_viewer_complaint, is_synthetic_demo,
        verification_status, verified_by, verified_at,
        suspects_json, datasets_json, notes_json, custody_log_json,
        created_date, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      ON CONFLICT (id) DO UPDATE SET
        case_number = EXCLUDED.case_number,
        complaint_id = EXCLUDED.complaint_id,
        owner_user_id = EXCLUDED.owner_user_id,
        category = EXCLUDED.category,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        investigator = EXCLUDED.investigator,
        incident_date_time = EXCLUDED.incident_date_time,
        relevant_phone_number = EXCLUDED.relevant_phone_number,
        supporting_info = EXCLUDED.supporting_info,
        status = EXCLUDED.status,
        priority = EXCLUDED.priority,
        is_viewer_complaint = EXCLUDED.is_viewer_complaint,
        is_synthetic_demo = EXCLUDED.is_synthetic_demo,
        verification_status = EXCLUDED.verification_status,
        verified_by = EXCLUDED.verified_by,
        verified_at = EXCLUDED.verified_at,
        suspects_json = EXCLUDED.suspects_json,
        datasets_json = EXCLUDED.datasets_json,
        notes_json = EXCLUDED.notes_json,
        custody_log_json = EXCLUDED.custody_log_json,
        updated_at = EXCLUDED.updated_at`,
      [
        c.id,
        c.caseNumber,
        c.complaintId || null,
        c.ownerUserId || null,
        c.category || 'General Investigation',
        c.title,
        c.description,
        c.investigator,
        c.incidentDateTime || null,
        c.relevantPhoneNumber || null,
        c.supportingInfo || null,
        c.status,
        c.priority,
        c.isViewerComplaint ? 1 : 0,
        c.isSyntheticDemo ? 1 : 0,
        c.verificationStatus,
        c.verifiedBy || null,
        c.verifiedAt || null,
        JSON.stringify(c.suspects || []),
        JSON.stringify(c.datasets || []),
        JSON.stringify(c.notes || []),
        JSON.stringify(c.custodyLog || []),
        c.createdDate,
        c.updatedAt,
      ]
    );
  }

  async deleteCaseById(caseId: string): Promise<void> {
    await this.driver.run('DELETE FROM ai_conversations WHERE case_id = $1', [caseId]);
    await this.driver.run('DELETE FROM complaints WHERE case_id = $1', [caseId]);
    await this.driver.run('DELETE FROM cdr_records WHERE case_id = $1', [caseId]);
    await this.driver.run('DELETE FROM ipdr_records WHERE case_id = $1', [caseId]);
    await this.driver.run('DELETE FROM tower_records WHERE case_id = $1', [caseId]);
    await this.driver.run('DELETE FROM dataset_hashes WHERE case_id = $1', [caseId]);
    await this.driver.run('DELETE FROM cases WHERE id = $1', [caseId]);
  }

  // ---------------- COMPLAINTS ----------------
  async getComplaintsByOwner(ownerUserId: string): Promise<ComplaintRecord[]> {
    const rows = await this.driver.query(
      'SELECT * FROM complaints WHERE owner_user_id = $1 ORDER BY created_at DESC',
      [ownerUserId]
    );
    return rows.map(rowToComplaint);
  }

  async getComplaintsForViewer(viewerUserId: string): Promise<ComplaintRecord[]> {
    const rows = await this.driver.query(
      `SELECT * FROM complaints 
       WHERE owner_user_id = $1 OR owner_user_id = 'SYSTEM_DEMO' 
       ORDER BY CASE WHEN owner_user_id = $1 THEN 0 ELSE 1 END, created_at DESC`,
      [viewerUserId]
    );
    return rows.map(rowToComplaint);
  }

  async getComplaintByComplaintId(complaintId: string): Promise<ComplaintRecord | null> {
    const rows = await this.driver.query(
      'SELECT * FROM complaints WHERE UPPER(complaint_id) = $1 LIMIT 1',
      [complaintId.trim().toUpperCase()]
    );
    return rows[0] ? rowToComplaint(rows[0]) : null;
  }

  async upsertComplaint(c: ComplaintRecord): Promise<void> {
    await this.driver.run(
      `INSERT INTO complaints (
        id, complaint_id, case_id, owner_user_id, title, category, description,
        incident_date_time, relevant_phone_number, supporting_info,
        status, status_updates_json, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (id) DO UPDATE SET
        complaint_id = EXCLUDED.complaint_id,
        case_id = EXCLUDED.case_id,
        owner_user_id = EXCLUDED.owner_user_id,
        title = EXCLUDED.title,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        incident_date_time = EXCLUDED.incident_date_time,
        relevant_phone_number = EXCLUDED.relevant_phone_number,
        supporting_info = EXCLUDED.supporting_info,
        status = EXCLUDED.status,
        status_updates_json = EXCLUDED.status_updates_json,
        updated_at = EXCLUDED.updated_at`,
      [
        c.id,
        c.complaintId,
        c.caseId,
        c.ownerUserId,
        c.title,
        c.category,
        c.description,
        c.incidentDateTime,
        c.relevantPhoneNumber,
        c.supportingInfo,
        c.status,
        JSON.stringify(c.statusUpdates || []),
        c.createdAt,
        c.updatedAt,
      ]
    );
  }

  async insertComplaint(c: ComplaintRecord): Promise<void> {
    await this.driver.run(
      `INSERT INTO complaints (
        id, complaint_id, case_id, owner_user_id, title, category, description,
        incident_date_time, relevant_phone_number, supporting_info,
        status, status_updates_json, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        c.id,
        c.complaintId,
        c.caseId,
        c.ownerUserId,
        c.title,
        c.category,
        c.description,
        c.incidentDateTime,
        c.relevantPhoneNumber,
        c.supportingInfo,
        c.status,
        JSON.stringify(c.statusUpdates),
        c.createdAt,
        c.updatedAt,
      ]
    );
  }

  async updateComplaintByCaseId(
    caseId: string,
    updates: Partial<Pick<ComplaintRecord, 'title' | 'category' | 'description' | 'incidentDateTime' | 'relevantPhoneNumber' | 'supportingInfo' | 'status' | 'statusUpdates'>>
  ): Promise<void> {
    const rows = await this.driver.query('SELECT * FROM complaints WHERE case_id = $1 LIMIT 1', [caseId]);
    if (!rows[0]) return;
    const existing = rowToComplaint(rows[0]);
    await this.driver.run(
      `UPDATE complaints SET
        title = $2,
        category = $3,
        description = $4,
        incident_date_time = $5,
        relevant_phone_number = $6,
        supporting_info = $7,
        status = $8,
        status_updates_json = $9,
        updated_at = $10
      WHERE id = $1`,
      [
        existing.id,
        updates.title ?? existing.title,
        updates.category ?? existing.category,
        updates.description ?? existing.description,
        updates.incidentDateTime ?? existing.incidentDateTime,
        updates.relevantPhoneNumber ?? existing.relevantPhoneNumber,
        updates.supportingInfo ?? existing.supportingInfo,
        updates.status ?? existing.status,
        JSON.stringify(updates.statusUpdates ?? existing.statusUpdates),
        new Date().toISOString(),
      ]
    );
  }

  async countComplaints(): Promise<number> {
    const rows = await this.driver.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM complaints');
    return Number(rows[0]?.cnt || 0);
  }

  // ---------------- TELECOM RECORDS ----------------
  async getCdrsByCase(caseId: string): Promise<CDRRecord[]> {
    const rows = await this.driver.query<{ payload_json: string }>(
      'SELECT payload_json FROM cdr_records WHERE case_id = $1',
      [caseId]
    );
    return rows.map((r) => safeJsonParse<CDRRecord>(r.payload_json, {} as CDRRecord)).filter((r) => Boolean(r.record_id));
  }

  async insertCdrs(records: CDRRecord[]): Promise<void> {
    for (const r of records) {
      await this.driver.run(
        `INSERT INTO cdr_records (record_id, case_id, dataset_id, payload_json)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (case_id, record_id) DO UPDATE SET payload_json = EXCLUDED.payload_json`,
        [r.record_id, r.case_id, r.dataset_id, JSON.stringify(r)]
      );
    }
  }

  async deleteCdrsByDataset(caseId: string, datasetId: string): Promise<void> {
    await this.driver.run('DELETE FROM cdr_records WHERE case_id = $1 AND dataset_id = $2', [
      caseId,
      datasetId,
    ]);
  }

  async getIpdrsByCase(caseId: string): Promise<IPDRRecord[]> {
    const rows = await this.driver.query<{ payload_json: string }>(
      'SELECT payload_json FROM ipdr_records WHERE case_id = $1',
      [caseId]
    );
    return rows.map((r) => safeJsonParse<IPDRRecord>(r.payload_json, {} as IPDRRecord)).filter((r) => Boolean(r.record_id));
  }

  async insertIpdrs(records: IPDRRecord[]): Promise<void> {
    for (const r of records) {
      await this.driver.run(
        `INSERT INTO ipdr_records (record_id, case_id, dataset_id, payload_json)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (case_id, record_id) DO UPDATE SET payload_json = EXCLUDED.payload_json`,
        [r.record_id, r.case_id, r.dataset_id, JSON.stringify(r)]
      );
    }
  }

  async deleteIpdrsByDataset(caseId: string, datasetId: string): Promise<void> {
    await this.driver.run('DELETE FROM ipdr_records WHERE case_id = $1 AND dataset_id = $2', [
      caseId,
      datasetId,
    ]);
  }

  async getTowersByCase(caseId: string): Promise<CellTower[]> {
    const rows = await this.driver.query<{ payload_json: string }>(
      'SELECT payload_json FROM tower_records WHERE case_id = $1',
      [caseId]
    );
    return rows.map((r) => safeJsonParse<CellTower>(r.payload_json, {} as CellTower)).filter((t) => Boolean(t.cell_id));
  }

  async upsertTowers(caseId: string, towers: CellTower[]): Promise<void> {
    for (const t of towers) {
      await this.driver.run(
        `INSERT INTO tower_records (case_id, cell_id, payload_json)
         VALUES ($1,$2,$3)
         ON CONFLICT (case_id, cell_id) DO UPDATE SET payload_json = EXCLUDED.payload_json`,
        [caseId, t.cell_id, JSON.stringify(t)]
      );
    }
  }

  // ---------------- DATASET HASHES ----------------
  async getDatasetHash(
    caseId: string,
    datasetId: string
  ): Promise<{ expectedHash: string; clientFileSha256?: string } | null> {
    const rows = await this.driver.query(
      'SELECT expected_hash, client_file_sha256 FROM dataset_hashes WHERE case_id = $1 AND dataset_id = $2 LIMIT 1',
      [caseId, datasetId]
    );
    if (!rows[0]) return null;
    return {
      expectedHash: String(rows[0].expected_hash),
      clientFileSha256: rows[0].client_file_sha256 ? String(rows[0].client_file_sha256) : undefined,
    };
  }

  async upsertDatasetHash(
    caseId: string,
    datasetId: string,
    expectedHash: string,
    clientFileSha256?: string
  ): Promise<void> {
    await this.driver.run(
      `INSERT INTO dataset_hashes (case_id, dataset_id, expected_hash, client_file_sha256)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (case_id, dataset_id) DO UPDATE SET
         expected_hash = EXCLUDED.expected_hash,
         client_file_sha256 = EXCLUDED.client_file_sha256`,
      [caseId, datasetId, expectedHash, clientFileSha256 || null]
    );
  }

  async deleteDatasetHash(caseId: string, datasetId: string): Promise<void> {
    await this.driver.run('DELETE FROM dataset_hashes WHERE case_id = $1 AND dataset_id = $2', [
      caseId,
      datasetId,
    ]);
  }

  // ---------------- AI CONVERSATIONS ----------------
  async getAiConversations(caseId: string, userId: string): Promise<AIResponsePayload[]> {
    const rows = await this.driver.query<{ response_json: string }>(
      'SELECT response_json FROM ai_conversations WHERE case_id = $1 AND user_id = $2 ORDER BY created_at ASC LIMIT 50',
      [caseId, userId]
    );
    return rows
      .map((r) => safeJsonParse<AIResponsePayload | null>(r.response_json, null))
      .filter((x): x is AIResponsePayload => Boolean(x));
  }

  async insertAiConversation(caseId: string, userId: string, payload: AIResponsePayload): Promise<void> {
    await this.driver.run(
      `INSERT INTO ai_conversations (id, case_id, user_id, question, response_json, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [payload.id, caseId, userId, payload.question, JSON.stringify(payload), payload.timestamp]
    );
  }

  // ---------------- AUDIT LOGS ----------------
  async insertAuditLog(entry: AuditLogEntry): Promise<void> {
    await this.driver.run(
      `INSERT INTO audit_logs (id, timestamp, user_id, user_name, user_role, action, case_id, resource, status, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [
        entry.id,
        entry.timestamp,
        entry.userId,
        entry.userName,
        entry.userRole,
        entry.action,
        entry.caseId || null,
        entry.resource,
        entry.status,
        entry.details,
      ]
    );
  }

  async getAuditLogs(limit = 300): Promise<AuditLogEntry[]> {
    const rows = await this.driver.query(
      'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1',
      [limit]
    );
    return rows.map((r) => ({
      id: String(r.id),
      timestamp: String(r.timestamp),
      userId: String(r.user_id),
      userName: String(r.user_name),
      userRole: String(r.user_role) as UserRole,
      action: String(r.action) as AuditLogEntry['action'],
      caseId: r.case_id ? String(r.case_id) : undefined,
      resource: String(r.resource),
      status: String(r.status) as AuditLogEntry['status'],
      details: String(r.details),
    }));
  }

  async countAuditLogs(): Promise<number> {
    const rows = await this.driver.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM audit_logs');
    return Number(rows[0]?.cnt || 0);
  }

  async ping(): Promise<boolean> {
    try {
      await this.driver.query('SELECT 1 as ok');
      return true;
    } catch {
      return false;
    }
  }
}

let dbPromise: Promise<TraceDatabase> | null = null;

export async function getDatabase(): Promise<TraceDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const driver = await createSqlDriver();
      const db = new TraceDatabase(driver);
      await db.initialize();
      return db;
    })();
  }
  return dbPromise;
}
