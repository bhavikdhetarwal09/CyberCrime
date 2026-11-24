import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AuthUser,
  CaseRecord,
  CDRRecord,
  IPDRRecord,
  CellTower,
  AuditLogEntry,
  SecurityActivitySummary,
  NavSection,
  AIResponsePayload,
  EvidenceCitation,
  ComplaintRecord,
  SystemMonitoringSummary,
} from './shared/types';
import { computeCaseAnalytics } from './shared/analytics';
import { api, ApiError } from './lib/api';
import { Layout } from './components/Layout';
import { EvidenceDrawer, InspectedEvidence } from './components/EvidenceDrawer';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { CasesPage } from './pages/CasesPage';
import { DataImportPage } from './pages/DataImportPage';
import { CdrAnalysisPage } from './pages/CdrAnalysisPage';
import { IpdrAnalysisPage } from './pages/IpdrAnalysisPage';
import { ContactNetworkPage } from './pages/ContactNetworkPage';
import { TowerLocationPage } from './pages/TowerLocationPage';
import { ImeiSimPage } from './pages/ImeiSimPage';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { Loader2 } from 'lucide-react';
import { usePreferences } from './lib/preferences';

export default function App() {
  const { t } = usePreferences();
  const [authBootstrapping, setAuthBootstrapping] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>('overview');

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [adminMonitoring, setAdminMonitoring] = useState<SystemMonitoringSummary | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [cdrs, setCdrs] = useState<CDRRecord[]>([]);
  const [ipdrs, setIpdrs] = useState<IPDRRecord[]>([]);
  const [towers, setTowers] = useState<CellTower[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [securityMetrics, setSecurityMetrics] = useState<SecurityActivitySummary | null>(null);
  const [networkSnapshotByCase, setNetworkSnapshotByCase] = useState<Record<string, string>>({});
  const [loadingCaseData, setLoadingCaseData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [aiHistoryByCase, setAiHistoryByCase] = useState<Record<string, AIResponsePayload[]>>({});
  const [aiLoadingByCase, setAiLoadingByCase] = useState<Record<string, boolean>>({});
  const [aiPendingQuestionByCase, setAiPendingQuestionByCase] = useState<
    Record<string, string | null>
  >({});
  const [aiErrorByCase, setAiErrorByCase] = useState<
    Record<string, { message: string; failedQuestion: string } | null>
  >({});
  const aiControllersRef = useRef<Record<string, AbortController>>({});
  const casesRef = useRef<CaseRecord[]>([]);
  const userRef = useRef<AuthUser | null>(null);
  const lastLoadedRecordKeyRef = useRef<string | null>(null);
  const [inspectedEvidence, setInspectedEvidence] = useState<InspectedEvidence | null>(null);
  const [createCaseTrigger, setCreateCaseTrigger] = useState(0);

  useEffect(() => {
    casesRef.current = cases;
  }, [cases]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const activeCase = useMemo(
    () => cases.find((c) => c.id === activeCaseId) || cases[0] || null,
    [cases, activeCaseId]
  );

  const canUserReadSensitiveCase = useCallback((u: AuthUser, caseItem: CaseRecord | null): boolean => {
    if (!caseItem) return false;
    if (u.role === 'Viewer') {
      return caseItem.ownerUserId === u.id || Boolean(caseItem.isSyntheticDemo);
    }
    if (u.role === 'Investigator') {
      return u.assignedCaseIds.includes(caseItem.id);
    }
    if (u.role === 'Administrator') {
      return true;
    }
    return false;
  }, []);

  const isSectionAllowed = useCallback((u: AuthUser, section: NavSection): boolean => {
    if (u.role === 'Viewer') {
      return section !== 'audit' && section !== 'settings';
    }
    if (u.role === 'Administrator') {
      return true;
    }
    return true;
  }, []);

  const fetchAuditLogs = useCallback(async (roleOverride?: AuthUser['role']) => {
    const effectiveRole = roleOverride ?? userRef.current?.role;
    if (effectiveRole === 'Viewer' || !effectiveRole) {
      setAuditLogs([]);
      setSecurityMetrics(null);
      return;
    }
    try {
      const res = await api.getAuditLogs();
      setAuditLogs(res.logs);
      setSecurityMetrics(res.securityMetrics || null);
    } catch {
      // Ignore transient errors if logged out or unauthorized
    }
  }, []);

  const fetchComplaints = useCallback(async (roleOverride?: AuthUser['role']) => {
    const effectiveRole = roleOverride ?? userRef.current?.role;
    if (effectiveRole !== 'Viewer') {
      setComplaints([]);
      return;
    }
    try {
      const res = await api.getComplaints();
      setComplaints(res.complaints);
    } catch {
      setComplaints([]);
    }
  }, []);

  const fetchAdminMonitoring = useCallback(async (roleOverride?: AuthUser['role']) => {
    const effectiveRole = roleOverride ?? userRef.current?.role;
    if (effectiveRole !== 'Administrator') {
      setAdminMonitoring(null);
      return;
    }
    try {
      const res = await api.getAdminMonitoring();
      setAdminMonitoring(res.monitoring);
    } catch {
      setAdminMonitoring(null);
    }
  }, []);

  const fetchCaseRecords = useCallback(
    async (
      caseId: string,
      effectiveUser?: AuthUser,
      caseListOverride?: CaseRecord[],
      forceReload = false
    ) => {
      const u = effectiveUser ?? userRef.current;
      const list = caseListOverride ?? casesRef.current;
      const targetCase = list.find((c) => c.id === caseId) || null;
      if (!u || !canUserReadSensitiveCase(u, targetCase)) {
        lastLoadedRecordKeyRef.current = null;
        setCdrs([]);
        setIpdrs([]);
        setTowers([]);
        setLoadError(null);
        setLoadingCaseData(false);
        return;
      }

      const loadKey = `${u.id}:${caseId}`;
      if (!forceReload && lastLoadedRecordKeyRef.current === loadKey) {
        return;
      }
      lastLoadedRecordKeyRef.current = loadKey;

      setLoadingCaseData(true);
      setLoadError(null);
      try {
        const [bundle, aiHist] = await Promise.all([
          api.getCaseRecords(caseId),
          api.getAiHistory(caseId).catch(() => ({ history: [] as AIResponsePayload[] })),
        ]);
        setCdrs(bundle.cdrs);
        setIpdrs(bundle.ipdrs);
        setTowers(bundle.towers);
        setAiHistoryByCase((prev) => ({
          ...prev,
          [caseId]: aiHist.history,
        }));
      } catch (err) {
        lastLoadedRecordKeyRef.current = null;
        if (err instanceof ApiError && err.status === 403) {
          setCdrs([]);
          setIpdrs([]);
          setTowers([]);
          setLoadError(null);
        } else {
          setLoadError(err instanceof Error ? err.message : 'Unable to load case records.');
        }
      } finally {
        setLoadingCaseData(false);
      }
    },
    [canUserReadSensitiveCase]
  );

  const hydrateUserWorkspace = useCallback(
    async (authedUser: AuthUser, hasAi: boolean) => {
      userRef.current = authedUser;
      lastLoadedRecordKeyRef.current = null;
      setUser(authedUser);
      setAiConfigured(hasAi);
      setActiveSection('overview');
      const [caseRes] = await Promise.all([
        api.getCases(),
        fetchAuditLogs(authedUser.role),
        fetchComplaints(authedUser.role),
        fetchAdminMonitoring(authedUser.role),
      ]);
      casesRef.current = caseRes.cases;
      setCases(caseRes.cases);
      const firstId = caseRes.cases[0]?.id || null;
      setActiveCaseId(firstId);
      if (firstId) {
        await fetchCaseRecords(firstId, authedUser, caseRes.cases, true);
      } else {
        setCdrs([]);
        setIpdrs([]);
        setTowers([]);
        setLoadingCaseData(false);
      }
    },
    [fetchAuditLogs, fetchComplaints, fetchAdminMonitoring, fetchCaseRecords]
  );

  // Restore active server session via HttpOnly cookie ONCE on initial mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await api.getMe();
        if (!active) return;
        await hydrateUserWorkspace(me.user, me.aiConfigured);
      } catch {
        // Not logged in or expired session; show LoginPage
      } finally {
        if (active) setAuthBootstrapping(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshCases = useCallback(
    async (selectId?: string) => {
      const currentUser = userRef.current;
      const res = await api.getCases();
      casesRef.current = res.cases;
      setCases(res.cases);
      const nextId =
        selectId && res.cases.some((c) => c.id === selectId)
          ? selectId
          : activeCaseId && res.cases.some((c) => c.id === activeCaseId)
          ? activeCaseId
          : res.cases[0]?.id || null;
      setActiveCaseId(nextId);
      if (nextId && currentUser) {
        await fetchCaseRecords(nextId, currentUser, res.cases, true);
      } else {
        lastLoadedRecordKeyRef.current = null;
        setCdrs([]);
        setIpdrs([]);
        setTowers([]);
      }
      await Promise.all([
        fetchAuditLogs(currentUser?.role),
        fetchComplaints(currentUser?.role),
        fetchAdminMonitoring(currentUser?.role),
      ]);
    },
    [activeCaseId, fetchCaseRecords, fetchAuditLogs, fetchComplaints, fetchAdminMonitoring]
  );

  // Load records when switching activeCaseId (deduped via lastLoadedRecordKeyRef)
  useEffect(() => {
    if (user && activeCaseId) {
      void fetchCaseRecords(activeCaseId, user, casesRef.current, false);
    }
  }, [user, activeCaseId, fetchCaseRecords]);

  const analytics = useMemo(() => {
    if (!activeCase) return null;
    if (user && !canUserReadSensitiveCase(user, activeCase)) return null;
    return computeCaseAnalytics(activeCase, cdrs, ipdrs, towers);
  }, [activeCase, user, canUserReadSensitiveCase, cdrs, ipdrs, towers]);

  const towerMap = useMemo(() => new Map(towers.map((t) => [t.cell_id, t])), [towers]);

  useEffect(() => {
    if (user && !isSectionAllowed(user, activeSection)) {
      setActiveSection('overview');
    }
  }, [user, activeSection, isSectionAllowed]);

  const handleLoginSuccess = async (authedUser: AuthUser, hasAi: boolean) => {
    await hydrateUserWorkspace(authedUser, hasAi);
  };

  const handleLogout = useCallback(async () => {
    Object.values(aiControllersRef.current).forEach((ctrl) => ctrl.abort());
    aiControllersRef.current = {};
    await api.logout().catch(() => {});
    userRef.current = null;
    casesRef.current = [];
    lastLoadedRecordKeyRef.current = null;
    setUser(null);
    setCases([]);
    setComplaints([]);
    setAdminMonitoring(null);
    setActiveCaseId(null);
    setCdrs([]);
    setIpdrs([]);
    setTowers([]);
    setAuditLogs([]);
    setSecurityMetrics(null);
    setNetworkSnapshotByCase({});
    setAiHistoryByCase({});
    setAiLoadingByCase({});
    setAiPendingQuestionByCase({});
    setAiErrorByCase({});
    setInspectedEvidence(null);
  }, []);

  // Client-side inactivity session timeout (30 minutes of idle activity signs out cleanly)
  useEffect(() => {
    if (!user) return;
    const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
    let idleTimer: number | undefined;
    const resetIdleTimer = () => {
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        void handleLogout();
      }, IDLE_TIMEOUT_MS);
    };
    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      events.forEach((evt) => window.removeEventListener(evt, resetIdleTimer));
    };
  }, [user, handleLogout]);

  const handleSubmitAiQuery = useCallback(
    async (caseId: string, questionText: string, language: 'en' | 'hi') => {
      const cleanQuestion = questionText.trim();
      if (!caseId || !cleanQuestion) return;
      if (aiControllersRef.current[caseId]) return;

      const controller = new AbortController();
      aiControllersRef.current[caseId] = controller;

      setAiLoadingByCase((prev) => ({ ...prev, [caseId]: true }));
      setAiPendingQuestionByCase((prev) => ({ ...prev, [caseId]: cleanQuestion }));
      setAiErrorByCase((prev) => ({ ...prev, [caseId]: null }));

      const priorTurns = (aiHistoryByCase[caseId] || []).slice(-4).map((item) => ({
        question: item.question,
        summary: item.summary,
      }));

      try {
        const res = await api.queryAI(
          caseId,
          {
            question: cleanQuestion,
            language,
            conversationHistory: priorTurns,
          },
          { timeoutMs: 35000, signal: controller.signal }
        );

        if (aiControllersRef.current[caseId] !== controller) return;

        setAiHistoryByCase((prev) => ({
          ...prev,
          [caseId]: [...(prev[caseId] || []), res.result],
        }));
        setAiErrorByCase((prev) => ({ ...prev, [caseId]: null }));
        void fetchAuditLogs();
      } catch (err) {
        if (aiControllersRef.current[caseId] !== controller) return;

        if (err instanceof ApiError && err.status === 499) {
          setAiErrorByCase((prev) => ({ ...prev, [caseId]: null }));
        } else if (err instanceof ApiError) {
          setAiErrorByCase((prev) => ({
            ...prev,
            [caseId]: {
              message: err.message,
              failedQuestion: cleanQuestion,
            },
          }));
        } else {
          setAiErrorByCase((prev) => ({
            ...prev,
            [caseId]: {
              message: 'Unable to reach the AI Investigation Assistant. Please retry.',
              failedQuestion: cleanQuestion,
            },
          }));
        }
      } finally {
        if (aiControllersRef.current[caseId] === controller) {
          delete aiControllersRef.current[caseId];
          setAiLoadingByCase((prev) => ({ ...prev, [caseId]: false }));
          setAiPendingQuestionByCase((prev) => ({ ...prev, [caseId]: null }));
        }
      }
    },
    [aiHistoryByCase, fetchAuditLogs]
  );

  const handleCancelAiQuery = useCallback((caseId: string) => {
    const controller = aiControllersRef.current[caseId];
    if (controller) {
      delete aiControllersRef.current[caseId];
      controller.abort();
    }
    setAiLoadingByCase((prev) => ({ ...prev, [caseId]: false }));
    setAiPendingQuestionByCase((prev) => ({ ...prev, [caseId]: null }));
  }, []);

  const handleClearAiError = useCallback((caseId: string) => {
    setAiErrorByCase((prev) => ({ ...prev, [caseId]: null }));
  }, []);

  const inspectCdr = (rec: CDRRecord) => {
    setInspectedEvidence({
      kind: 'CDR',
      record: rec,
      tower: towerMap.get(rec.cell_id),
    });
  };

  const inspectCdrById = (recordId: string) => {
    const found = cdrs.find((r) => r.record_id === recordId);
    if (found) inspectCdr(found);
  };

  const inspectIpdr = (rec: IPDRRecord) => {
    setInspectedEvidence({ kind: 'IPDR', record: rec });
  };

  const inspectCitation = (citation: EvidenceCitation) => {
    if (citation.record_type === 'IPDR') {
      const ipRec = ipdrs.find((r) => r.record_id === citation.record_id);
      if (ipRec) {
        inspectIpdr(ipRec);
        return;
      }
    }
    const cdrRec = cdrs.find((r) => r.record_id === citation.record_id);
    if (cdrRec) {
      inspectCdr(cdrRec);
    }
  };

  if (authBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F2] dark:bg-[#0E172A] text-[#17243B] dark:text-[#F4F5F7]">
        <div className="flex items-center gap-3 text-xs font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-[#C5A66A]" />
          <span>Restoring TRACE INTEL session…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const currentAiHistory = activeCase ? aiHistoryByCase[activeCase.id] || [] : [];

  return (
    <>
      <Layout
        user={user}
        cases={cases}
        activeCase={activeCase}
        activeSection={activeSection}
        analytics={analytics}
        cdrs={cdrs}
        ipdrs={ipdrs}
        onSelectSection={(sec) => {
          if (isSectionAllowed(user, sec)) setActiveSection(sec);
        }}
        onSelectCase={(id) => {
          setActiveCaseId(id);
          setInspectedEvidence(null);
        }}
        onLogout={handleLogout}
        onInspectCdr={inspectCdr}
        onInspectIpdr={inspectIpdr}
      >
        {loadingCaseData ? (
          <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-12 flex items-center justify-center gap-3 text-xs text-[#64748B] dark:text-[#8993A5]">
            <Loader2 className="w-4 h-4 animate-spin text-[#17243B] dark:text-[#C5A66A]" />
            <span>{t('shell.loadingRecords')}</span>
          </div>
        ) : loadError ? (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded p-6 text-xs text-[#DC2626] dark:text-[#F87171]">
            {loadError}
          </div>
        ) : (
          <>
            {activeSection === 'overview' && (
              <OverviewPage
                user={user}
                cases={cases}
                complaints={complaints}
                adminMonitoring={adminMonitoring}
                activeCase={activeCase}
                analytics={analytics}
                cdrs={cdrs}
                ipdrs={ipdrs}
                towers={towers}
                auditLogs={auditLogs}
                onSelectCase={(id) => {
                  setActiveCaseId(id);
                  setInspectedEvidence(null);
                }}
                onNavigate={(sec) => {
                  if (isSectionAllowed(user, sec)) setActiveSection(sec);
                }}
                onOpenCreateCase={() => {
                  if (user.role !== 'Viewer') return;
                  setActiveSection('cases');
                  setCreateCaseTrigger((n) => n + 1);
                }}
                onRefreshWorkspace={refreshCases}
                onInspectCdrById={inspectCdrById}
              />
            )}

            {activeSection === 'cases' && (
              <CasesPage
                user={user}
                cases={cases}
                complaints={complaints}
                activeCaseId={activeCase?.id || null}
                openCreateModalTrigger={createCaseTrigger}
                onSelectCase={(id) => setActiveCaseId(id)}
                onNavigate={(sec) => {
                  if (isSectionAllowed(user, sec)) setActiveSection(sec);
                }}
                onRefreshCases={refreshCases}
              />
            )}

            {activeSection === 'import' && isSectionAllowed(user, 'import') && (
              <DataImportPage
                user={user}
                activeCase={activeCase}
                onImportComplete={() => refreshCases(activeCase?.id)}
              />
            )}

            {activeSection === 'cdr' && isSectionAllowed(user, 'cdr') && (
              <CdrAnalysisPage
                activeCase={activeCase}
                cdrs={cdrs}
                towers={towers}
                onInspectCdr={inspectCdr}
                onInspectNumberRecords={(phone, recs) =>
                  setInspectedEvidence({
                    kind: 'MULTI_CDR',
                    title: `Records for ${phone}`,
                    subtitle: `${recs.length} filtered CDR events involving ${phone}`,
                    records: recs,
                  })
                }
              />
            )}

            {activeSection === 'ipdr' && isSectionAllowed(user, 'ipdr') && (
              <IpdrAnalysisPage
                activeCase={activeCase}
                ipdrs={ipdrs}
                onInspectIpdr={inspectIpdr}
              />
            )}

            {activeSection === 'network' && isSectionAllowed(user, 'network') && (
              <ContactNetworkPage
                activeCase={activeCase}
                cdrs={cdrs}
                towers={towers}
                onInspectCdr={inspectCdr}
                onCaptureGraphSnapshot={(caseId, pngDataUrl) =>
                  setNetworkSnapshotByCase((prev) => ({ ...prev, [caseId]: pngDataUrl }))
                }
              />
            )}

            {activeSection === 'towers' && isSectionAllowed(user, 'towers') && (
              <TowerLocationPage
                user={user}
                activeCase={activeCase}
                cdrs={cdrs}
                towers={towers}
                onInspectCdr={inspectCdr}
              />
            )}

            {activeSection === 'imei' && isSectionAllowed(user, 'imei') && (
              <ImeiSimPage
                user={user}
                activeCase={activeCase}
                cdrs={cdrs}
                towers={towers}
                onInspectCdr={inspectCdr}
                onInspectRecords={(title, subtitle, records) =>
                  setInspectedEvidence({ kind: 'MULTI_CDR', title, subtitle, records })
                }
              />
            )}

            {activeSection === 'ai' && isSectionAllowed(user, 'ai') && (
              <AiAssistantPage
                user={user}
                activeCase={activeCase}
                aiConfigured={aiConfigured}
                cdrCount={cdrs.length}
                ipdrCount={ipdrs.length}
                history={currentAiHistory}
                loading={activeCase ? Boolean(aiLoadingByCase[activeCase.id]) : false}
                pendingQuestion={activeCase ? aiPendingQuestionByCase[activeCase.id] || null : null}
                errorState={activeCase ? aiErrorByCase[activeCase.id] || null : null}
                onSubmitQuery={(question, lang) => {
                  if (!activeCase) return;
                  void handleSubmitAiQuery(activeCase.id, question, lang);
                }}
                onCancelQuery={() => {
                  if (!activeCase) return;
                  handleCancelAiQuery(activeCase.id);
                }}
                onClearError={() => {
                  if (!activeCase) return;
                  handleClearAiError(activeCase.id);
                }}
                onInspectCitation={inspectCitation}
              />
            )}

            {activeSection === 'reports' && isSectionAllowed(user, 'reports') && (
              <ReportsPage
                user={user}
                cases={cases}
                activeCase={activeCase}
                cdrs={cdrs}
                ipdrs={ipdrs}
                towers={towers}
                aiHistory={currentAiHistory}
                networkGraphSnapshot={activeCase ? networkSnapshotByCase[activeCase.id] || null : null}
                onRefreshCases={refreshCases}
                onSelectCase={(id) => setActiveCaseId(id)}
              />
            )}

            {activeSection === 'audit' && user.role !== 'Viewer' && (
              <AuditLogsPage
                user={user}
                auditLogs={auditLogs}
                securityMetrics={securityMetrics}
                onRefreshLogs={() => fetchAuditLogs()}
              />
            )}

            {activeSection === 'settings' && user.role !== 'Viewer' && (
              <SettingsPage
                user={user}
                cases={cases}
                activeCase={activeCase}
                adminMonitoring={adminMonitoring}
                onRefreshAll={() => refreshCases()}
                onLogout={handleLogout}
              />
            )}
          </>
        )}
      </Layout>

      <EvidenceDrawer
        evidence={inspectedEvidence}
        onClose={() => setInspectedEvidence(null)}
        onInspectSingle={inspectCdr}
      />
    </>
  );
}
