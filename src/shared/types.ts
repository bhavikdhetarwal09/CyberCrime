export type UserRole = 'Administrator' | 'Investigator' | 'Viewer';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  badgeCode: string;
  role: UserRole;
  department: string;
  assignedCaseIds: string[];
  isActive: boolean;
  canAccessSensitiveCaseData?: boolean;
}

export interface LoginChallengeResponse {
  requiresOtp: true;
  challengeId: string;
  role: UserRole;
  email: string;
  maskedChannel: string;
  expiresInSeconds: number;
  maxAttempts: number;
  resendCooldownSeconds: number;
  deliveryChannel: string;
  verificationDispatchCode?: string;
}

export interface LoginSuccessResponse {
  requiresOtp: false;
  token: string;
  user: AuthUser;
  aiConfigured: boolean;
}

export type ComplaintStatus = 'Submitted' | 'Under Review' | 'Assigned' | 'Resolved' | 'Closed';

export interface ComplaintStatusUpdate {
  timestamp: string;
  status: ComplaintStatus;
  note: string;
}

export interface ComplaintRecord {
  id: string;
  complaintId: string;
  caseId: string;
  ownerUserId: string;
  title: string;
  category: string;
  description: string;
  incidentDateTime: string;
  relevantPhoneNumber: string;
  supportingInfo: string;
  status: ComplaintStatus;
  statusUpdates: ComplaintStatusUpdate[];
  createdAt: string;
  updatedAt: string;
}

export interface SystemMonitoringSummary {
  databaseEngine: 'sqlite' | 'memory';
  databaseStatus: 'connected' | 'degraded';
  databaseTarget: string;
  aiProviderConfigured: boolean;
  aiProviderMode: string;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalCases: number;
  totalComplaints: number;
  activeSessions: number;
  auditLogCount: number;
  serverTimeUtc: string;
}

export interface SuspectIdentifier {
  id: string;
  label: string; // e.g., "Suspect A"
  alias: string; // e.g., "Arjun Dev (Synthetic)"
  phoneNumber: string;
  primaryImei: string;
  primaryImsi: string;
  operator: string;
  notes: string;
}

export type EvidenceIntegrityStatus = 'Unverified' | 'Verified' | 'Mismatch';

export interface DatasetMeta {
  id: string;
  caseId: string;
  evidenceRefId: string;
  fileName: string;
  fileType: 'CDR' | 'IPDR' | 'TOWER';
  schemaFormat: string;
  operator: string;
  recordCount: number;
  validCount: number;
  warningCount: number;
  duplicateCount: number;
  fileSizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  normalizationStatus: 'Normalized' | 'Normalized with Warnings';
  sha256Hash: string;
  integrityStatus: EvidenceIntegrityStatus;
  lastVerifiedAt?: string;
  lastVerifiedBy?: string;
}

export type CaseNoteCategory = 'Observation' | 'Lead' | 'Verification' | 'Custody';

export interface CaseNote {
  id: string;
  caseId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  category: CaseNoteCategory;
  content: string;
  createdAt: string;
}

export type ChainOfCustodyAction =
  | 'INGESTED'
  | 'INTEGRITY_VERIFIED'
  | 'INTEGRITY_MISMATCH'
  | 'REPORT_EXPORTED';

export interface ChainOfCustodyEntry {
  id: string;
  caseId: string;
  evidenceRefId: string;
  datasetId?: string;
  fileName: string;
  action: ChainOfCustodyAction;
  actorName: string;
  actorRole: UserRole;
  sha256Hash: string;
  verifiedMatch?: boolean;
  timestamp: string;
  notes: string;
}

export type CaseStatus = 'Active' | 'Under Review' | 'Archived';

export interface CaseRecord {
  id: string;
  caseNumber: string;
  complaintId?: string;
  ownerUserId?: string;
  category?: string;
  title: string;
  description: string;
  investigator: string;
  incidentDateTime?: string;
  relevantPhoneNumber?: string;
  supportingInfo?: string;
  createdDate: string;
  updatedAt: string;
  status: CaseStatus;
  priority: 'High' | 'Medium' | 'Standard';
  suspects: SuspectIdentifier[];
  datasets: DatasetMeta[];
  notes: CaseNote[];
  custodyLog: ChainOfCustodyEntry[];
  verificationStatus:
    | 'Pending Officer Verification'
    | 'Verified by Investigator'
    | 'Verified by Administrator';
  verifiedBy?: string;
  verifiedAt?: string;
  isSyntheticDemo: boolean;
  isViewerComplaint?: boolean;
  restrictedMetadataOnly?: boolean;
}

export type CallDirection = 'INCOMING' | 'OUTGOING' | 'SMS_IN' | 'SMS_OUT';

export interface CDRRecord {
  record_id: string;
  case_id: string;
  dataset_id: string;
  caller_number: string;
  receiver_number: string;
  call_type: CallDirection;
  timestamp: string; // ISO 8601 UTC/IST string
  duration_seconds: number;
  cell_id: string;
  imei: string;
  imsi: string;
  operator: string;
  source_file: string;
  source_row: number;
  quality_flags?: string[];
}

export interface IPDRRecord {
  record_id: string;
  case_id: string;
  dataset_id: string;
  public_ip: string;
  source_port: number;
  destination_ip: string;
  destination_port: number;
  session_start: string;
  session_end: string;
  bytes_transferred: number;
  subscriber_id: string; // phone number or 'Unmapped'
  protocol: 'TCP' | 'UDP' | 'QUIC' | 'ICMP';
  service_indicator: string;
  operator: string;
  source_file: string;
  source_row: number;
}

export interface CellTower {
  cell_id: string;
  tower_name: string;
  area: string;
  latitude: number;
  longitude: number;
  azimuth_deg: number;
  coverage_radius_m: number;
  operator: string;
}

export interface CaseDatasetBundle {
  caseRecord: CaseRecord;
  cdrs: CDRRecord[];
  ipdrs: IPDRRecord[];
  towers: CellTower[];
}

export interface EvidenceCitation {
  record_id: string;
  record_type: 'CDR' | 'IPDR' | 'TOWER';
  source_file: string;
  source_row: number;
  phone_number: string;
  timestamp: string;
  summary: string;
}

export interface AIObservedFact {
  statement: string;
  citation_ids: string[];
}

export interface AIResponsePayload {
  id: string;
  question: string;
  language: 'en' | 'hi';
  mode: 'gemini_live' | 'deterministic_demo';
  modelLabel: string;
  timestamp: string;
  summary: string;
  observedFacts: AIObservedFact[];
  analyticalPatterns: string[];
  hypothesesForVerification: string[];
  dataLimitations: string[];
  citations: EvidenceCitation[];
  suggestedFollowUps: string[];
  requiresHumanVerification: true;
  isSyntheticData: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action:
    | 'AUTH_LOGIN'
    | 'AUTH_LOGOUT'
    | 'AUTH_OTP_ISSUED'
    | 'AUTH_OTP_VERIFIED'
    | 'AUTH_OTP_FAILED'
    | 'CASE_CREATE'
    | 'CASE_UPDATE'
    | 'CASE_DELETE'
    | 'CASE_NOTE_ADD'
    | 'CASE_NOTE_DELETE'
    | 'EVIDENCE_VERIFY'
    | 'DATA_IMPORT'
    | 'DATA_DELETE'
    | 'AI_QUERY'
    | 'REPORT_EXPORT'
    | 'REPORT_VERIFY'
    | 'ROLE_UPDATE'
    | 'COMPLAINT_TRACK'
    | 'ACCESS_DENIED';
  caseId?: string;
  resource: string;
  status: 'Success' | 'Denied' | 'Error';
  details: string;
}

export interface SecurityActivitySummary {
  activeSessions: number;
  successfulLogins: number;
  failedLogins: number;
  otpVerifiedCount: number;
  otpFailedCount: number;
  accessDeniedCount: number;
  lastLoginAt?: string;
}

export type NavSection =
  | 'overview'
  | 'cases'
  | 'import'
  | 'cdr'
  | 'ipdr'
  | 'network'
  | 'towers'
  | 'imei'
  | 'ai'
  | 'reports'
  | 'audit'
  | 'settings';
