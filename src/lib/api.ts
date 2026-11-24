import {
  AuthUser,
  CaseRecord,
  CDRRecord,
  IPDRRecord,
  CellTower,
  DatasetMeta,
  AIResponsePayload,
  AuditLogEntry,
  UserRole,
  SuspectIdentifier,
  CaseStatus,
  LoginChallengeResponse,
  LoginSuccessResponse,
  ComplaintRecord,
  SystemMonitoringSummary,
} from '../shared/types';

// In-memory session token store (never persisted in localStorage/sessionStorage)
let sessionToken: string | null = null;

export function setSessionToken(token: string | null): void {
  sessionToken = token;
}

export function getSessionToken(): string | null {
  return sessionToken;
}

export class ApiError extends Error {
  status: number;
  canFallbackToDemo?: boolean;
  retryAfterSeconds?: number;
  attemptsRemaining?: number;
  constructor(
    message: string,
    status: number,
    canFallbackToDemo?: boolean,
    retryAfterSeconds?: number,
    attemptsRemaining?: number
  ) {
    super(message);
    this.status = status;
    this.canFallbackToDemo = canFallbackToDemo;
    this.retryAfterSeconds = retryAfterSeconds;
    this.attemptsRemaining = attemptsRemaining;
  }
}

interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

async function apiFetch<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const { timeoutMs, signal: externalSignal, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      credentials: 'include',
      headers,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(
        data.error || `Request failed (${response.status})`,
        response.status,
        Boolean(data.canFallbackToDemo),
        typeof data.retryAfterSeconds === 'number' ? data.retryAfterSeconds : undefined,
        typeof data.attemptsRemaining === 'number' ? data.attemptsRemaining : undefined
      );
    }
    return data as T;
  } catch (err) {
    if (timedOut) {
      throw new ApiError(
        'The AI analysis request timed out. Please retry your question.',
        408,
        true
      );
    }
    if (err instanceof ApiError) {
      throw err;
    }
    if (
      (err instanceof DOMException && err.name === 'AbortError') ||
      (err instanceof Error && err.name === 'AbortError')
    ) {
      throw new ApiError('Request cancelled.', 499, false);
    }
    throw new ApiError(
      'Network error while contacting the TRACE INTEL server. Check your connection and retry.',
      0,
      false
    );
  } finally {
    if (timer) clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export const api = {
  getTemporaryOtps: () =>
    apiFetch<{ administratorOtp: string; investigatorOtp: string }>('/api/auth/temp-otp'),

  login: async (payload: {
    email: string;
    password: string;
    role: UserRole;
    rememberSession?: boolean;
  }): Promise<LoginSuccessResponse | LoginChallengeResponse> => {
    const res = await apiFetch<LoginSuccessResponse | LoginChallengeResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.requiresOtp && res.token) {
      setSessionToken(res.token);
    }
    return res;
  },

  verifyOtp: async (payload: {
    challengeId: string;
    otp: string;
  }): Promise<LoginSuccessResponse> => {
    const res = await apiFetch<LoginSuccessResponse>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.token) {
      setSessionToken(res.token);
    }
    return res;
  },

  resendOtp: async (payload: { challengeId: string }): Promise<LoginChallengeResponse> => {
    return apiFetch<LoginChallengeResponse>('/api/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMe: () =>
    apiFetch<{
      user: AuthUser;
      aiConfigured: boolean;
      databaseEngine: 'sqlite' | 'memory';
    }>('/api/auth/me'),

  logout: async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setSessionToken(null);
    }
  },

  getComplaints: () => apiFetch<{ complaints: ComplaintRecord[] }>('/api/complaints'),

  createComplaint: (payload: {
    title: string;
    category: string;
    description: string;
    incidentDateTime?: string;
    relevantPhoneNumber?: string;
    supportingInfo?: string;
    priority?: 'High' | 'Medium' | 'Standard';
    existingComplaintId?: string;
  }) =>
    apiFetch<{
      caseRecord: CaseRecord;
      complaint: ComplaintRecord;
      matchedExisting?: boolean;
    }>('/api/complaints', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  trackComplaint: (complaintId: string) =>
    apiFetch<{
      complaint: ComplaintRecord;
      caseSummary: {
        id: string;
        caseNumber: string;
        title?: string;
        category?: string;
        status: CaseStatus;
        priority: 'High' | 'Medium' | 'Standard';
        datasetCount: number;
      } | null;
      caseRecord?: CaseRecord;
    }>('/api/complaints/track', {
      method: 'POST',
      body: JSON.stringify({ complaintId }),
    }),

  getCases: () => apiFetch<{ cases: CaseRecord[] }>('/api/cases'),

  createCase: (payload: {
    caseNumber?: string;
    title: string;
    description: string;
    investigator?: string;
    status: CaseStatus;
    priority: 'High' | 'Medium' | 'Standard';
    suspects: SuspectIdentifier[];
  }) =>
    apiFetch<{ caseRecord: CaseRecord }>('/api/cases', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCase: (
    caseId: string,
    payload: Partial<{
      title: string;
      description: string;
      category: string;
      incidentDateTime: string;
      relevantPhoneNumber: string;
      supportingInfo: string;
      investigator: string;
      status: CaseStatus;
      priority: 'High' | 'Medium' | 'Standard';
      suspects: SuspectIdentifier[];
    }>
  ) =>
    apiFetch<{ caseRecord: CaseRecord }>(`/api/cases/${encodeURIComponent(caseId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteCase: (caseId: string) =>
    apiFetch<{ ok: boolean }>(`/api/cases/${encodeURIComponent(caseId)}`, {
      method: 'DELETE',
    }),

  addCaseNote: (
    caseId: string,
    payload: {
      category: 'Observation' | 'Lead' | 'Verification' | 'Custody';
      content: string;
    }
  ) =>
    apiFetch<{ caseRecord: CaseRecord }>(`/api/cases/${encodeURIComponent(caseId)}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteCaseNote: (caseId: string, noteId: string) =>
    apiFetch<{ caseRecord: CaseRecord }>(
      `/api/cases/${encodeURIComponent(caseId)}/notes/${encodeURIComponent(noteId)}`,
      { method: 'DELETE' }
    ),

  verifyDatasetIntegrity: (caseId: string, datasetId: string) =>
    apiFetch<{
      caseRecord: CaseRecord;
      dataset: DatasetMeta;
      verifiedMatch: boolean;
      computedSha256: string;
      expectedSha256: string;
    }>(
      `/api/cases/${encodeURIComponent(caseId)}/datasets/${encodeURIComponent(datasetId)}/verify-integrity`,
      { method: 'POST' }
    ),

  getCaseRecords: (caseId: string) =>
    apiFetch<{
      caseRecord: CaseRecord;
      cdrs: CDRRecord[];
      ipdrs: IPDRRecord[];
      towers: CellTower[];
    }>(`/api/cases/${encodeURIComponent(caseId)}/records`),

  importDataset: (
    caseId: string,
    payload: {
      fileType: 'CDR' | 'IPDR';
      fileName: string;
      schemaFormat: string;
      operator: string;
      fileSizeBytes: number;
      records: Array<Partial<CDRRecord> | Partial<IPDRRecord>>;
      warningCount: number;
      duplicateCount: number;
      fileSha256?: string;
    }
  ) =>
    apiFetch<{ dataset: DatasetMeta }>(`/api/cases/${encodeURIComponent(caseId)}/import`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteDataset: (caseId: string, datasetId: string) =>
    apiFetch<{ ok: boolean }>(
      `/api/cases/${encodeURIComponent(caseId)}/datasets/${encodeURIComponent(datasetId)}`,
      { method: 'DELETE' }
    ),

  getAiHistory: (caseId: string) =>
    apiFetch<{ history: AIResponsePayload[] }>(
      `/api/cases/${encodeURIComponent(caseId)}/ai-history`
    ),

  queryAI: async (
    caseId: string,
    payload: {
      question: string;
      language: 'en' | 'hi';
      conversationHistory?: Array<{ question: string; summary: string }>;
    },
    options?: { timeoutMs?: number; signal?: AbortSignal }
  ): Promise<{ result: AIResponsePayload }> => {
    const data = await apiFetch<{ result?: AIResponsePayload }>(
      `/api/cases/${encodeURIComponent(caseId)}/ai-query`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: options?.timeoutMs ?? 35000,
        signal: options?.signal,
      }
    );
    if (!data?.result || typeof data.result.summary !== 'string' || !data.result.summary.trim()) {
      throw new ApiError(
        'Received an incomplete response from the AI Investigation Assistant. Please retry.',
        502,
        false
      );
    }
    return { result: data.result };
  },

  verifyCaseReport: (caseId: string) =>
    apiFetch<{ caseRecord: CaseRecord }>(
      `/api/cases/${encodeURIComponent(caseId)}/verify-report`,
      { method: 'POST' }
    ),

  recordExport: (payload: { caseId: string; format: 'PDF' | 'XLSX'; fileName: string }) =>
    apiFetch<{ ok: boolean }>('/api/audit-logs/record-export', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAuditLogs: () =>
    apiFetch<{
      logs: AuditLogEntry[];
      securityMetrics: import('../shared/types').SecurityActivitySummary;
    }>('/api/audit-logs'),

  getUsers: () => apiFetch<{ users: AuthUser[] }>('/api/users'),

  createUser: (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    department: string;
    badgeCode?: string;
    assignedCaseIds?: string[];
  }) =>
    apiFetch<{ user: AuthUser }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUserRole: (
    userId: string,
    payload: {
      role?: UserRole;
      assignedCaseIds?: string[];
      canAccessSensitiveCaseData?: boolean;
    }
  ) =>
    apiFetch<{ user: AuthUser }>(`/api/users/${encodeURIComponent(userId)}/role`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  updateUserStatus: (userId: string, isActive: boolean) =>
    apiFetch<{ user: AuthUser }>(`/api/users/${encodeURIComponent(userId)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ isActive }),
    }),

  getAdminMonitoring: () =>
    apiFetch<{ monitoring: SystemMonitoringSummary }>('/api/admin/monitoring'),

  resetDemoData: () => apiFetch<{ ok: boolean }>('/api/admin/reset-demo', { method: 'POST' }),
};
