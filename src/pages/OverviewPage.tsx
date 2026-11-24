import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Plus,
  Upload,
  MessageSquareText,
  ArrowUpRight,
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  Briefcase,
  PhoneCall,
  Globe,
  Users,
  Share2,
  ShieldCheck,
  Scale,
  Search,
  CheckCircle2,
  AlertCircle,
  ClipboardCopy,
  Database,
  Activity,
  FileText,
  FolderOpen,
  Settings,
} from 'lucide-react';
import {
  AuthUser,
  CaseRecord,
  CDRRecord,
  IPDRRecord,
  CellTower,
  AuditLogEntry,
  NavSection,
  ComplaintRecord,
  SystemMonitoringSummary,
} from '../shared/types';
import {
  CaseAnalyticsSummary,
  computeCaseAnalytics,
  formatDuration,
} from '../shared/analytics';
import {
  createDefaultFilters,
  extractFilterOptions,
  filterCdrs,
  filterIpdrs,
  ForensicFilters,
} from '../shared/filtering';
import { ForensicFilterBar } from '../components/ForensicFilterBar';
import { PortalServicesSection } from '../components/PortalServicesSection';
import { Bns63ReferencePanel } from '../components/Bns63ReferencePanel';
import { api, ApiError } from '../lib/api';
import { usePreferences } from '../lib/preferences';

interface OverviewPageProps {
  user: AuthUser;
  cases: CaseRecord[];
  complaints: ComplaintRecord[];
  adminMonitoring: SystemMonitoringSummary | null;
  activeCase: CaseRecord | null;
  analytics: CaseAnalyticsSummary | null;
  cdrs: CDRRecord[];
  ipdrs: IPDRRecord[];
  towers: CellTower[];
  auditLogs: AuditLogEntry[];
  onNavigate: (section: NavSection) => void;
  onSelectCase?: (caseId: string) => void;
  onOpenCreateCase: () => void;
  onRefreshWorkspace?: (selectId?: string) => Promise<void>;
  onInspectCdrById: (recordId: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  user,
  cases,
  complaints,
  adminMonitoring,
  activeCase,
  cdrs,
  ipdrs,
  towers,
  auditLogs,
  onNavigate,
  onSelectCase,
  onOpenCreateCase,
  onInspectCdrById,
}) => {
  const { t, chartTheme } = usePreferences();
  const isViewer = user.role === 'Viewer';
  const isAdmin = user.role === 'Administrator';
  const canViewAudit = user.role === 'Administrator' || user.role === 'Investigator';
  const canImportData =
    user.role === 'Viewer' ||
    user.role === 'Investigator' ||
    (user.role === 'Administrator' && Boolean(user.canAccessSensitiveCaseData));

  const [filters, setFilters] = useState<ForensicFilters>(() => createDefaultFilters());
  const [bns63Open, setBns63Open] = useState(false);

  // Viewer Complaint Tracking state
  const [trackInput, setTrackInput] = useState('');
  const [tracking, setTracking] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [trackedResult, setTrackedResult] = useState<{
    complaint: ComplaintRecord;
    caseSummary: {
      id: string;
      caseNumber: string;
      status: CaseRecord['status'];
      priority: CaseRecord['priority'];
      datasetCount: number;
    } | null;
  } | null>(null);
  const [copiedComplaintId, setCopiedComplaintId] = useState<string | null>(null);

  useEffect(() => {
    setFilters(createDefaultFilters());
  }, [activeCase?.id]);

  const filterOptions = useMemo(
    () => extractFilterOptions(activeCase, cdrs, ipdrs, towers),
    [activeCase, cdrs, ipdrs, towers]
  );

  const filteredCdrs = useMemo(() => filterCdrs(cdrs, filters), [cdrs, filters]);
  const filteredIpdrs = useMemo(() => filterIpdrs(ipdrs, filters), [ipdrs, filters]);

  const analytics = useMemo(() => {
    if (!activeCase) return null;
    if (isAdmin && !user.canAccessSensitiveCaseData) return null;
    return computeCaseAnalytics(activeCase, filteredCdrs, filteredIpdrs, towers);
  }, [activeCase, isAdmin, user.canAccessSensitiveCaseData, filteredCdrs, filteredIpdrs, towers]);

  const handleTrackComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = trackInput.trim();
    if (!cleaned) return;
    setTracking(true);
    setTrackError(null);
    setTrackedResult(null);
    try {
      const res = await api.trackComplaint(cleaned);
      setTrackedResult(res);
    } catch (err) {
      setTrackError(
        err instanceof ApiError
          ? err.message
          : 'Complaint not found or you are not authorized to access this complaint.'
      );
    } finally {
      setTracking(false);
    }
  };

  const handleCopyComplaintId = (cid: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(cid).catch(() => {});
    }
    setCopiedComplaintId(cid);
    setTimeout(() => setCopiedComplaintId((cur) => (cur === cid ? null : cur)), 1800);
  };

  // =========================================================================
  // 1. ADMINISTRATOR GOVERNANCE DASHBOARD (NO PORTAL SERVICES, NO CREATE CASE)
  // =========================================================================
  if (isAdmin && !user.canAccessSensitiveCaseData) {
    const recentLogs = auditLogs.slice(0, 8);
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-mono text-[#A88748] dark:text-[#C5A66A] uppercase tracking-wider">
              Administrator Governance Console · Metadata &amp; Access Control
            </p>
            <h1 className="text-2xl font-semibold text-[#17243B] dark:text-[#F4F5F7] mt-1">
              Platform Governance &amp; System Monitoring
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="h-9 px-3.5 text-xs font-medium bg-[#101A30] dark:bg-[#C5A66A] hover:bg-[#17243B] dark:hover:bg-[#d3b67c] text-white dark:text-[#101A30] rounded flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Settings className="w-3.5 h-3.5 text-[#C5A66A] dark:text-[#101A30]" />
              Users &amp; Assignments
            </button>
            <button
              type="button"
              onClick={() => onNavigate('audit')}
              className="h-9 px-3.5 text-xs font-medium bg-white dark:bg-[#17243B] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D] text-[#17243B] dark:text-[#F4F5F7] border border-[#CBD2DE] dark:border-[#2A3F63] rounded flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />
              Audit Logs
            </button>
            <button
              type="button"
              aria-expanded={bns63Open}
              onClick={() => setBns63Open((prev) => !prev)}
              className={`h-9 px-3.5 text-xs font-medium rounded border flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                bns63Open
                  ? 'bg-[#101A30] text-white border-[#101A30] dark:border-[#C5A66A]'
                  : 'bg-white dark:bg-[#17243B] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D] text-[#17243B] dark:text-[#F4F5F7] border-[#CBD2DE] dark:border-[#2A3F63]'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />
              BNS 63
            </button>
          </div>
        </div>

        {bns63Open && <Bns63ReferencePanel onClose={() => setBns63Open(false)} />}

        {/* Governance Notice */}
        <div className="p-4 rounded border border-[#C5A66A]/60 bg-[#F7F2E7]/60 dark:bg-[#1E2738] text-xs flex items-start gap-3 shadow-sm">
          <ShieldCheck className="w-5 h-5 text-[#A88748] dark:text-[#C5A66A] shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-[#17243B] dark:text-[#F4F5F7]">
              Administrator Governance &amp; Comprehensive Investigation Oversight
            </p>
            <p className="mt-0.5 leading-relaxed text-[#475569] dark:text-[#CBD5E1]">
              Full administrative authority active: manage investigator/viewer accounts, activate or suspend access, assign lead officers, and inspect CDR, IPDR, Cell Towers, IMEI, Contact Networks, AI Assessments, and verify/lock Centralized Reports across all system cases.
            </p>
          </div>
        </div>

        {/* Governance KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4">
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 rounded bg-emerald-50 dark:bg-emerald-950/40 text-[#16A34A] dark:text-[#4ADE80] flex items-center justify-center">
                <Database className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono uppercase text-[#16A34A] dark:text-[#4ADE80]">
                {adminMonitoring?.databaseStatus || 'connected'}
              </span>
            </div>
            <p className="mt-3 text-xs text-[#64748B] dark:text-[#9AA6BA]">Database Storage</p>
            <p className="mt-1 text-base font-semibold font-mono text-[#17243B] dark:text-[#F4F5F7] truncate">
              {adminMonitoring?.databaseEngine === 'memory' ? 'In-Memory' : 'SQLite (Local)'}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#8993A5] truncate">
              {adminMonitoring?.databaseTarget || 'Local Relational Storage'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="text-left bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] hover:border-[#2563EB] dark:hover:border-[#C5A66A] rounded p-4 transition-colors"
          >
            <span className="w-7 h-7 rounded bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </span>
            <p className="mt-3 text-xs text-[#64748B] dark:text-[#9AA6BA]">User Accounts</p>
            <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
              {adminMonitoring?.totalUsers ?? '—'}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#8993A5]">
              {adminMonitoring
                ? `${adminMonitoring.activeUsers} active · ${adminMonitoring.inactiveUsers} suspended`
                : 'Loading directory'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('cases')}
            className="text-left bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] hover:border-[#2563EB] dark:hover:border-[#C5A66A] rounded p-4 transition-colors"
          >
            <span className="w-7 h-7 rounded bg-[#F7F2E7] dark:bg-[#2B251B] text-[#A88748] dark:text-[#C5A66A] flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </span>
            <p className="mt-3 text-xs text-[#64748B] dark:text-[#9AA6BA]">Total Cases</p>
            <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
              {adminMonitoring?.totalCases ?? cases.length}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#8993A5]">
              {cases.filter((c) => c.status === 'Active').length} active · {cases.filter((c) => c.status === 'Archived').length} closed
            </p>
          </button>

          <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4">
            <span className="w-7 h-7 rounded bg-teal-50 dark:bg-teal-950/40 text-[#0D9488] dark:text-[#2DD4BF] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </span>
            <p className="mt-3 text-xs text-[#64748B] dark:text-[#9AA6BA]">Citizen Complaints</p>
            <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
              {adminMonitoring?.totalComplaints ?? 0}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#8993A5]">
              Unique Complaint IDs tracked
            </p>
          </div>

          <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4">
            <span className="w-7 h-7 rounded bg-orange-50 dark:bg-orange-950/40 text-[#EA580C] dark:text-[#FB923C] flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </span>
            <p className="mt-3 text-xs text-[#64748B] dark:text-[#9AA6BA]">Active Sessions</p>
            <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
              {adminMonitoring?.activeSessions ?? 1}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#8993A5]">
              Authenticated tokens
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('audit')}
            className="text-left bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] hover:border-[#2563EB] dark:hover:border-[#C5A66A] rounded p-4 transition-colors"
          >
            <span className="w-7 h-7 rounded bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <p className="mt-3 text-xs text-[#64748B] dark:text-[#9AA6BA]">Audit Trail Entries</p>
            <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
              {adminMonitoring?.auditLogCount ?? auditLogs.length}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#8993A5]">
              AI Provider:{' '}
              {adminMonitoring?.aiProviderConfigured
                ? adminMonitoring.aiProviderMode
                : 'Standby'}
            </p>
          </button>
        </div>

        {/* Case Registry Metadata + Security Audit Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
            <div className="px-5 py-4 border-b border-[#E2E7EF] dark:border-[#243656] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  Case Registry &amp; Investigation Oversight
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
                  Direct inspection shortcuts across active investigation cases
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('cases')}
                className="text-xs font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline"
              >
                Open Registry
              </button>
            </div>
            <div className="divide-y divide-[#E2E7EF] dark:divide-[#243656]">
              {cases.map((c) => (
                <div
                  key={c.id}
                  className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7] truncate">
                      <span className="font-mono text-[#A88748] dark:text-[#C5A66A] mr-2">
                        {c.caseNumber}
                      </span>
                      {c.title}
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] mt-0.5">
                      {c.category || 'Investigation'} · Lead IO: {c.investigator} · Created {c.createdDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        c.status === 'Active'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : c.status === 'Under Review'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {c.status}
                    </span>
                    {onSelectCase && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectCase(c.id);
                            onNavigate('cases');
                          }}
                          className="h-6 px-2 text-[10px] font-medium border border-[#CBD2DE] dark:border-[#2D4063] rounded hover:bg-[#F5F7FA] dark:hover:bg-[#1E2F4C] text-[#17243B] dark:text-[#F4F5F7]"
                        >
                          Workspace
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectCase(c.id);
                            onNavigate('cdr');
                          }}
                          className="h-6 px-2 text-[10px] font-medium border border-[#CBD2DE] dark:border-[#2D4063] rounded hover:bg-[#F5F7FA] dark:hover:bg-[#1E2F4C] text-[#17243B] dark:text-[#F4F5F7]"
                        >
                          CDR
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectCase(c.id);
                            onNavigate('reports');
                          }}
                          className="h-6 px-2 text-[10px] font-medium bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded hover:bg-[#17243B] dark:hover:bg-[#d3b67c]"
                        >
                          Report
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
            <div className="px-5 py-4 border-b border-[#E2E7EF] dark:border-[#243656] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  Recent Governance &amp; Security Audit Activity
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
                  Persisted authentication, access-denied, and governance events
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('audit')}
                className="text-xs font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline"
              >
                Full Audit Log
              </button>
            </div>
            <div className="divide-y divide-[#E2E7EF] dark:divide-[#243656]">
              {recentLogs.length === 0 ? (
                <p className="p-5 text-xs text-[#64748B] dark:text-[#8993A5]">
                  No audit events recorded yet.
                </p>
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} className="px-5 py-3 flex items-start justify-between gap-4 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-[#17243B] dark:text-[#F4F5F7]">
                        {log.userName}{' '}
                        <span className="text-[#64748B] dark:text-[#8993A5] font-normal">
                          ({log.userRole})
                        </span>{' '}
                        ·{' '}
                        <span
                          className={`font-mono text-[11px] ${
                            log.status === 'Denied'
                              ? 'text-[#DC2626] dark:text-[#F87171]'
                              : 'text-[#2563EB] dark:text-[#C5A66A]'
                          }`}
                        >
                          {log.action}
                        </span>
                      </p>
                      <p className="text-[#64748B] dark:text-[#8993A5] mt-0.5 truncate">{log.details}</p>
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-[#8993A5] shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {log.timestamp.slice(5, 16).replace('T', ' ')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. VIEWER PERSONAL WORKSPACE (PORTAL SERVICES + CREATE & TRACK COMPLAINTS)
  // =========================================================================
  if (isViewer) {
    return (
      <div className="space-y-6">
        {/* Portal Services — STRICTLY VISIBLE TO VIEWER ROLE ONLY */}
        <PortalServicesSection />

        {/* Viewer Action Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-mono text-[#A88748] dark:text-[#C5A66A] uppercase tracking-wider">
              Personal Citizen Portal · Isolated Private Workspace
            </p>
            <h1 className="text-2xl font-semibold text-[#17243B] dark:text-[#F4F5F7] mt-1">
              My Complaints, Personal Cases &amp; Evidence Analysis
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenCreateCase}
              className="h-9 px-4 text-xs font-medium bg-[#101A30] dark:bg-[#C5A66A] hover:bg-[#17243B] dark:hover:bg-[#d3b67c] text-white dark:text-[#101A30] rounded flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#C5A66A] dark:text-[#101A30]" />
              Create Complaint / Case
            </button>
            {activeCase && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('import')}
                  className="h-9 px-3.5 text-xs font-medium bg-white dark:bg-[#17243B] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D] text-[#17243B] dark:text-[#F4F5F7] border border-[#CBD2DE] dark:border-[#2A3F63] rounded flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Evidence
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('ai')}
                  className="h-9 px-3.5 text-xs font-medium bg-white dark:bg-[#17243B] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D] text-[#17243B] dark:text-[#F4F5F7] border border-[#CBD2DE] dark:border-[#2A3F63] rounded flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <MessageSquareText className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />
                  AI Assistant
                </button>
              </>
            )}
            <button
              type="button"
              aria-expanded={bns63Open}
              onClick={() => setBns63Open((prev) => !prev)}
              className={`h-9 px-3.5 text-xs font-medium rounded border flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                bns63Open
                  ? 'bg-[#101A30] text-white border-[#101A30] dark:border-[#C5A66A]'
                  : 'bg-white dark:bg-[#17243B] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D] text-[#17243B] dark:text-[#F4F5F7] border-[#CBD2DE] dark:border-[#2A3F63]'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />
              BNS 63
            </button>
          </div>
        </div>

        {bns63Open && <Bns63ReferencePanel onClose={() => setBns63Open(false)} />}

        {/* Track Your Complaint + Quick Summary Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Private Complaint Tracking Card */}
          <section className="lg:col-span-2 bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7] flex items-center gap-2">
                <Search className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A]" />
                Track &amp; View Complaint by Exact ID
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
                Enter an exact Complaint ID (e.g., TRACE-CMP-2026-0142 or a personal ID). Browsing or discovering others&apos; complaints without the exact ID is strictly restricted.
              </p>
            </div>

            <form onSubmit={handleTrackComplaint} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={trackInput}
                onChange={(e) => setTrackInput(e.target.value)}
                placeholder="Enter Exact Complaint ID (e.g., TRACE-CMP-2026-0142)"
                aria-label="Enter Exact Complaint ID"
                className="flex-1 h-10 px-3.5 text-xs font-mono bg-[#F5F7FA] dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2A3F63] text-[#17243B] dark:text-[#F4F5F7] placeholder:text-[#8993A5] rounded focus:outline-none focus:border-[#101A30] dark:focus:border-[#C5A66A]"
              />
              <button
                type="submit"
                disabled={tracking || !trackInput.trim()}
                className="h-10 px-5 text-xs font-medium bg-[#101A30] dark:bg-[#C5A66A] hover:bg-[#17243B] dark:hover:bg-[#d3b67c] disabled:opacity-50 text-white dark:text-[#101A30] rounded transition-colors whitespace-nowrap"
              >
                {tracking ? 'Checking…' : 'View / Track Complaint'}
              </button>
            </form>

            {trackError && (
              <div
                role="alert"
                className="p-3 rounded border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs text-[#DC2626] dark:text-[#F87171] flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{trackError}</span>
              </div>
            )}

            {trackedResult && (
              <div className="p-4 rounded border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-[#101A30] space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A] dark:text-[#4ADE80]" />
                    <span className="font-mono font-semibold text-[#17243B] dark:text-[#C5A66A]">
                      {trackedResult.complaint.complaintId}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white dark:bg-[#17243B] border border-[#DCE3EE] dark:border-[#2A3F63] text-[#17243B] dark:text-[#F4F5F7]">
                      {trackedResult.complaint.status}
                    </span>
                  </div>
                  {trackedResult.caseSummary && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCase?.(trackedResult.caseSummary!.id);
                        onNavigate('cases');
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded inline-flex items-center gap-1"
                    >
                      <FolderOpen className="w-3 h-3" />
                      Open Personal Case
                    </button>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                    {trackedResult.complaint.title}
                  </p>
                  <p className="text-[#475569] dark:text-[#CBD5E1] mt-0.5">
                    Category: {trackedResult.complaint.category} · Incident:{' '}
                    {trackedResult.complaint.incidentDateTime.slice(0, 16).replace('T', ' ')}
                    {trackedResult.complaint.relevantPhoneNumber
                      ? ` · Phone: ${trackedResult.complaint.relevantPhoneNumber}`
                      : ''}
                  </p>
                </div>
                {trackedResult.complaint.statusUpdates.length > 0 && (
                  <div className="pt-2 border-t border-[#DCE3EE] dark:border-[#243656] space-y-1.5">
                    <p className="text-[11px] font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                      Status Updates
                    </p>
                    {trackedResult.complaint.statusUpdates.map((upd, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2 text-[11px]">
                        <span className="text-[#334155] dark:text-[#CBD5E1]">
                          <strong className="text-[#17243B] dark:text-[#C5A66A]">{upd.status}:</strong>{' '}
                          {upd.note}
                        </span>
                        <span className="font-mono text-[#64748B] dark:text-[#8993A5] shrink-0">
                          {upd.timestamp.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Personal Workspace Summary */}
          <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5 flex flex-col justify-between space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                My Workspace Overview
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
                Signed in as {user.name} ({user.email})
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#132036]">
                <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">My Complaints</p>
                <p className="mt-1 text-xl font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  {complaints.length}
                </p>
              </div>
              <div className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#132036]">
                <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">My Personal Cases</p>
                <p className="mt-1 text-xl font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  {cases.length}
                </p>
              </div>
              <div className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#132036]">
                <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Loaded CDR Rows</p>
                <p className="mt-1 text-xl font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  {cdrs.length}
                </p>
              </div>
              <div className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#132036]">
                <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Loaded IPDR Rows</p>
                <p className="mt-1 text-xl font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  {ipdrs.length}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigate('cases')}
                className="flex-1 h-8 px-3 text-xs font-medium border border-[#CBD2DE] dark:border-[#2A3F63] rounded text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D]"
              >
                My Cases
              </button>
              <button
                type="button"
                disabled={!activeCase}
                onClick={() => onNavigate('reports')}
                className="flex-1 h-8 px-3 text-xs font-medium border border-[#CBD2DE] dark:border-[#2A3F63] rounded text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D] disabled:opacity-40"
              >
                My Reports
              </button>
            </div>
          </section>
        </div>

        {/* My Complaints & Reference Demo Cases List */}
        <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
          <div className="px-5 py-4 border-b border-[#E2E7EF] dark:border-[#243656] flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                My Complaints &amp; Reference Demo Case Studies
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
                Your personal filed complaints and the 5 official demonstration case studies.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCreateCase}
              className="h-8 px-3 text-xs font-medium bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Complaint / Case
            </button>
          </div>

          {cases.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <Briefcase className="w-7 h-7 text-[#8993A5] mx-auto" />
              <div>
                <p className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  You have not created any personal cases or complaints yet
                </p>
                <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-1 max-w-md mx-auto">
                  Create a personal complaint to receive a unique Complaint ID, upload your own CDR/IPDR records, run personal telecom analysis, and export reports.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenCreateCase}
                className="h-9 px-4 text-xs font-medium bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Your First Complaint / Case
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E7EF] dark:divide-[#243656]">
              {cases.map((c) => {
                const linkedComplaint = complaints.find((cmp) => cmp.caseId === c.id);
                const isSelected = activeCase?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => onSelectCase?.(c.id)}
                    className={`px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#F8F8F6] dark:bg-[#132036]'
                        : 'hover:bg-[#F8F8F6] dark:hover:bg-[#1A2A45]'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {c.complaintId && (
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#A88748] dark:text-[#C5A66A]">
                            {c.complaintId}
                            <button
                              type="button"
                              title="Copy Complaint ID"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyComplaintId(c.complaintId!);
                              }}
                              className="p-0.5 text-[#64748B] hover:text-[#17243B] dark:hover:text-white"
                            >
                              <ClipboardCopy className="w-3 h-3" />
                            </button>
                            {copiedComplaintId === c.complaintId && (
                              <span className="text-[10px] font-sans text-[#16A34A] dark:text-[#4ADE80]">
                                Copied
                              </span>
                            )}
                          </span>
                        )}
                        <span className="font-mono text-[#64748B] dark:text-[#8993A5]">
                          ({c.caseNumber})
                        </span>
                        {c.isSyntheticDemo ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300">
                            DEMO STUDY
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300">
                            MY COMPLAINT
                          </span>
                        )}
                        <span className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          {c.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                        {c.category || 'Personal Complaint'} · Status:{' '}
                        {linkedComplaint?.status || c.status} · {c.datasets.length} evidence file(s)
                      </p>
                    </div>
                    <div
                      className="flex flex-wrap items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCase?.(c.id);
                          onNavigate('import');
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium border border-[#CBD2DE] dark:border-[#2A3F63] rounded text-[#17243B] dark:text-[#F4F5F7] hover:bg-white dark:hover:bg-[#101A30]"
                      >
                        Upload CDR/IPDR
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCase?.(c.id);
                          onNavigate('cdr');
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded"
                      >
                        Analyze
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCase?.(c.id);
                          onNavigate('ai');
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium border border-[#CBD2DE] dark:border-[#2A3F63] rounded text-[#17243B] dark:text-[#F4F5F7] hover:bg-white dark:hover:bg-[#101A30]"
                      >
                        AI Assistant
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Active Personal Case Analysis Summary (if viewer has a selected case) */}
        {activeCase && analytics && (
          <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-mono text-[#A88748] dark:text-[#C5A66A]">
                  Selected Personal Case · {activeCase.complaintId || activeCase.caseNumber}
                </p>
                <h2 className="text-base font-semibold text-[#17243B] dark:text-[#F4F5F7] mt-0.5">
                  {activeCase.title}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => onNavigate('cdr')}
                  className="px-3 py-1.5 rounded border border-[#CBD2DE] dark:border-[#2A3F63] text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F7FA] dark:hover:bg-[#101A30]"
                >
                  CDR Analysis
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('ipdr')}
                  className="px-3 py-1.5 rounded border border-[#CBD2DE] dark:border-[#2A3F63] text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F7FA] dark:hover:bg-[#101A30]"
                >
                  IPDR Analysis
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('network')}
                  className="px-3 py-1.5 rounded border border-[#CBD2DE] dark:border-[#2A3F63] text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F7FA] dark:hover:bg-[#101A30]"
                >
                  Contact Network
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('towers')}
                  className="px-3 py-1.5 rounded border border-[#CBD2DE] dark:border-[#2A3F63] text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F7FA] dark:hover:bg-[#101A30]"
                >
                  Tower Map
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('imei')}
                  className="px-3 py-1.5 rounded border border-[#CBD2DE] dark:border-[#2A3F63] text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F7FA] dark:hover:bg-[#101A30]"
                >
                  IMEI / SIM
                </button>
              </div>
            </div>

            {cdrs.length === 0 && ipdrs.length === 0 ? (
              <div className="p-4 rounded border border-dashed border-[#CBD2DE] dark:border-[#2A3F63] bg-[#F8F9FB] dark:bg-[#101A30] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                    Data Not Available — No CDR or IPDR records uploaded for this case yet
                  </p>
                  <p className="text-[#64748B] dark:text-[#8993A5] mt-0.5">
                    Upload your own CSV/XLSX telecom records to populate call timelines, tower maps, contact networks, IMEI/SIM checks, and AI queries.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('import')}
                  className="h-8 px-3.5 bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded font-medium inline-flex items-center gap-1.5 shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Evidence
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#132036]">
                  <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Total CDR Events</p>
                  <p className="mt-1 text-lg font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                    {analytics.totalCdrs}
                  </p>
                </div>
                <div className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#132036]">
                  <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Total IPDR Sessions</p>
                  <p className="mt-1 text-lg font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                    {analytics.totalIpdrs}
                  </p>
                </div>
                <div className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#132036]">
                  <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Unique Numbers</p>
                  <p className="mt-1 text-lg font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                    {analytics.uniqueNumbers}
                  </p>
                </div>
                <div className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#132036]">
                  <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">IMEI / SIM Alerts</p>
                  <p className="mt-1 text-lg font-mono font-semibold text-[#DC2626] dark:text-[#F87171]">
                    {analytics.deviceAlerts.length}
                  </p>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    );
  }

  // =========================================================================
  // 3. INVESTIGATOR DASHBOARD (NO PORTAL SERVICES, NO CREATE CASE)
  // =========================================================================
  if (!activeCase || !analytics) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-10 text-center">
          <h2 className="text-lg font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            No Assigned Investigation Cases
          </h2>
          <p className="text-sm text-[#64748B] dark:text-[#8993A5] mt-1">
            Contact your Administrator to assign investigation cases to your account.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              aria-expanded={bns63Open}
              onClick={() => setBns63Open((prev) => !prev)}
              className={`h-9 px-3.5 text-xs font-medium rounded border inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                bns63Open
                  ? 'bg-[#101A30] text-white border-[#101A30] dark:border-[#C5A66A]'
                  : 'bg-white dark:bg-[#17243B] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D] text-[#17243B] dark:text-[#F4F5F7] border-[#CBD2DE] dark:border-[#2A3F63]'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />
              BNS 63
            </button>
          </div>
        </div>
        {bns63Open && <Bns63ReferencePanel onClose={() => setBns63Open(false)} />}
      </div>
    );
  }

  const activeCaseCount = cases.filter((c) => c.status === 'Active').length;
  const kpis = [
    {
      label: t('overview.kpiActiveCases'),
      value: String(activeCaseCount),
      sub: t('overview.kpiActiveCasesSub', { total: cases.length }),
      target: 'cases' as NavSection,
      icon: Briefcase,
      accentText: 'text-[#2563EB] dark:text-[#60A5FA]',
      accentBg: 'bg-blue-50 dark:bg-blue-950/40',
    },
    {
      label: t('overview.kpiTotalCdrs'),
      value: analytics.totalCdrs.toLocaleString(),
      sub: t('overview.kpiTotalCdrsSub', { night: analytics.nightCallCount }),
      target: 'cdr' as NavSection,
      icon: PhoneCall,
      accentText: 'text-[#0D9488] dark:text-[#2DD4BF]',
      accentBg: 'bg-teal-50 dark:bg-teal-950/40',
    },
    {
      label: t('overview.kpiTotalIpdrs'),
      value: analytics.totalIpdrs.toLocaleString(),
      sub: t('overview.kpiTotalIpdrsSub'),
      target: 'ipdr' as NavSection,
      icon: Globe,
      accentText: 'text-[#2563EB] dark:text-[#60A5FA]',
      accentBg: 'bg-blue-50 dark:bg-blue-950/40',
    },
    {
      label: t('overview.kpiUniqueNumbers'),
      value: analytics.uniqueNumbers.toLocaleString(),
      sub: t('overview.kpiUniqueNumbersSub', { suspects: activeCase.suspects.length }),
      target: 'cdr' as NavSection,
      icon: Users,
      accentText: 'text-[#A88748] dark:text-[#C5A66A]',
      accentBg: 'bg-[#F7F2E7] dark:bg-[#2B251B]',
    },
    {
      label: t('overview.kpiNetworkLinks'),
      value: analytics.networkEdgesCount.toLocaleString(),
      sub: t('overview.kpiNetworkLinksSub', { shared: analytics.commonContacts.length }),
      target: 'network' as NavSection,
      icon: Share2,
      accentText: 'text-[#EA580C] dark:text-[#FB923C]',
      accentBg: 'bg-orange-50 dark:bg-orange-950/40',
    },
    {
      label: t('overview.kpiDataQuality'),
      value: `${analytics.dataQualityScore.toFixed(1)}%`,
      sub: t('overview.kpiDataQualitySub'),
      target: (canImportData ? 'import' : 'cases') as NavSection,
      icon: ShieldCheck,
      accentText: 'text-[#16A34A] dark:text-[#4ADE80]',
      accentBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    },
  ];

  const directionData = [
    { name: t('overview.incomingVoice'), count: analytics.incomingCount, color: chartTheme.incoming },
    { name: t('overview.outgoingVoice'), count: analytics.outgoingCount, color: chartTheme.outgoing },
    { name: t('overview.smsEvents'), count: analytics.smsCount, color: chartTheme.gold },
  ];

  const topContactChartData = analytics.topContacts.slice(0, 6).map((c) => ({
    label: c.label ? `${c.label} (${c.phoneNumber.slice(-4)})` : c.phoneNumber.slice(-8),
    phoneNumber: c.phoneNumber,
    calls: c.totalCalls,
    durationMin: Number((c.totalDurationSec / 60).toFixed(1)),
  }));

  const tooltipStyle = {
    backgroundColor: chartTheme.tooltipBg,
    borderColor: chartTheme.tooltipBorder,
    color: chartTheme.tooltipText,
    fontSize: '12px',
    borderRadius: '6px',
  };

  const recentCaseLogs = auditLogs
    .filter((l) => !l.caseId || l.caseId === activeCase.id)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Investigator Header + Actions (NO Portal Services, NO Create Case) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-[#64748B] dark:text-[#8993A5]">
            {activeCase.caseNumber} · {activeCase.status}
            {activeCase.category ? ` · ${activeCase.category}` : ''}
          </p>
          <h1 className="text-2xl font-semibold text-[#17243B] dark:text-[#F4F5F7] mt-1">
            {activeCase.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canImportData && (
            <button
              type="button"
              onClick={() => onNavigate('import')}
              className="h-9 px-3.5 text-xs font-medium bg-white dark:bg-[#17243B] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D] text-[#17243B] dark:text-[#F4F5F7] border border-[#CBD2DE] dark:border-[#2A3F63] rounded flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              {t('overview.importBtn')}
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('ai')}
            className="h-9 px-4 text-xs font-medium bg-[#101A30] dark:bg-[#C5A66A] hover:bg-[#17243B] dark:hover:bg-[#d3b67c] text-white dark:text-[#101A30] rounded flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <MessageSquareText className="w-3.5 h-3.5 text-[#C5A66A] dark:text-[#101A30]" />
            {t('overview.openAiBtn')}
          </button>
          <button
            type="button"
            aria-expanded={bns63Open}
            onClick={() => setBns63Open((prev) => !prev)}
            className={`h-9 px-3.5 text-xs font-medium rounded border flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              bns63Open
                ? 'bg-[#101A30] text-white border-[#101A30] dark:border-[#C5A66A]'
                : 'bg-white dark:bg-[#17243B] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D] text-[#17243B] dark:text-[#F4F5F7] border-[#CBD2DE] dark:border-[#2A3F63]'
            }`}
          >
            <Scale className={`w-3.5 h-3.5 ${bns63Open ? 'text-[#C5A66A]' : 'text-[#A88748] dark:text-[#C5A66A]'}`} />
            BNS 63
          </button>
        </div>
      </div>

      {/* Dedicated BNS 63 Statutory Reference Section */}
      {bns63Open && <Bns63ReferencePanel onClose={() => setBns63Open(false)} />}

      {/* Unified Dashboard Filter Bar */}
      <ForensicFilterBar
        filters={filters}
        options={filterOptions}
        enabledFields={[
          'dateRange',
          'timeRange',
          'suspect',
          'phoneNumber',
          'callType',
          'towerId',
          'imei',
          'publicIp',
          'sourcePort',
          'nightOnly',
        ]}
        resultSummary={`CDRs: ${filteredCdrs.length}/${cdrs.length} · IPDRs: ${filteredIpdrs.length}/${ipdrs.length}`}
        onChange={setFilters}
        onReset={() => setFilters(createDefaultFilters())}
      />

      {/* 6 KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              type="button"
              onClick={() => onNavigate(kpi.target)}
              className="text-left bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] hover:border-[#2563EB] dark:hover:border-[#C5A66A] rounded p-4 transition-colors group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`w-7 h-7 rounded flex items-center justify-center ${kpi.accentBg} ${kpi.accentText}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#8993A5] group-hover:text-[#17243B] dark:group-hover:text-[#C5A66A] shrink-0 transition-colors" />
              </div>
              <p className="mt-3 text-xs font-medium text-[#64748B] dark:text-[#9AA6BA] truncate">
                {kpi.label}
              </p>
              <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
                {kpi.value}
              </p>
              <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#8993A5] truncate">
                {kpi.sub}
              </p>
            </button>
          );
        })}
      </div>

      {/* Critical Alert Summary + Assigned Case Overview (All 5 Cases Visible for Investigator A) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
          <div className="px-5 py-3.5 border-b border-[#E2E7EF] dark:border-[#243656] flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                Assigned Investigation Cases ({cases.length})
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
                {cases.filter((c) => c.status === 'Active').length} Active ·{' '}
                {cases.filter((c) => c.status === 'Under Review').length} Under Review ·{' '}
                {cases.filter((c) => c.verificationStatus !== 'Verified by Investigator').length} Pending Verification
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('cases')}
              className="text-xs font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline whitespace-nowrap"
            >
              Manage Cases
            </button>
          </div>
          <div className="divide-y divide-[#E2E7EF] dark:divide-[#243656]">
            {cases.slice(0, 6).map((c) => {
              const isCurrent = c.id === activeCase.id;
              const verifiedFiles = c.datasets.filter((d) => d.integrityStatus === 'Verified').length;
              return (
                <div
                  key={c.id}
                  onClick={() => onSelectCase?.(c.id)}
                  className={`px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs transition-colors ${
                    onSelectCase ? 'cursor-pointer' : ''
                  } ${
                    isCurrent
                      ? 'bg-[#F8F8F6] dark:bg-[#132036]'
                      : 'hover:bg-[#F8F8F6] dark:hover:bg-[#1A2A45]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7] truncate">
                      <span className="font-mono text-[#A88748] dark:text-[#C5A66A] mr-2">
                        {c.caseNumber}
                      </span>
                      {c.title}
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] mt-0.5">
                      IO: {c.investigator} · {c.suspects.length} suspects · {c.datasets.length} files (
                      {verifiedFiles}/{c.datasets.length} SHA-256 verified)
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`font-medium ${
                        c.status === 'Active'
                          ? 'text-[#16A34A] dark:text-[#4ADE80]'
                          : c.status === 'Under Review'
                          ? 'text-[#EA580C] dark:text-[#FB923C]'
                          : 'text-[#64748B] dark:text-[#8993A5]'
                      }`}
                    >
                      {c.status} · {c.priority}
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                      {c.verificationStatus === 'Verified by Investigator'
                        ? 'Officer Verified'
                        : 'Pending Verification'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Critical Alert Summary */}
        <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              Critical Alert Summary
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
              High-priority forensic triggers requiring officer review in {activeCase.caseNumber}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <button
              type="button"
              onClick={() => onNavigate('imei')}
              className="p-3 text-left rounded border border-[#E2E7EF] dark:border-[#243656] hover:border-[#DC2626] dark:hover:border-[#F87171] bg-[#F8F8F6] dark:bg-[#132036] transition-colors"
            >
              <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">IMEI / SIM Alerts</p>
              <p className="mt-1 text-lg font-mono font-semibold tabular-nums text-[#DC2626] dark:text-[#F87171]">
                {analytics.deviceAlerts.length}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('network')}
              className="p-3 text-left rounded border border-[#E2E7EF] dark:border-[#243656] hover:border-[#A88748] dark:hover:border-[#C5A66A] bg-[#F8F8F6] dark:bg-[#132036] transition-colors"
            >
              <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Bridge Contacts</p>
              <p className="mt-1 text-lg font-mono font-semibold tabular-nums text-[#A88748] dark:text-[#C5A66A]">
                {analytics.commonContacts.length}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('cdr')}
              className="p-3 text-left rounded border border-[#E2E7EF] dark:border-[#243656] hover:border-[#EA580C] dark:hover:border-[#FB923C] bg-[#F8F8F6] dark:bg-[#132036] transition-colors"
            >
              <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Night / Burst Flags</p>
              <p className="mt-1 text-lg font-mono font-semibold tabular-nums text-[#EA580C] dark:text-[#FB923C]">
                {analytics.unusualPatterns.length}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('cases')}
              className="p-3 text-left rounded border border-[#E2E7EF] dark:border-[#243656] hover:border-[#2563EB] dark:hover:border-[#C5A66A] bg-[#F8F8F6] dark:bg-[#132036] transition-colors"
            >
              <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Unverified Files</p>
              <p className="mt-1 text-lg font-mono font-semibold tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
                {activeCase.datasets.filter((d) => d.integrityStatus !== 'Verified').length}
              </p>
            </button>
          </div>
        </section>
      </div>

      {/* Primary Charts Row: Daily Communication Activity + Direction Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5">
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {t('overview.chartDailyTitle')}
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
                {t('overview.chartDailySub')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('cdr')}
              className="text-xs font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline whitespace-nowrap"
            >
              {t('overview.openCdrWorkspace')}
            </button>
          </div>
          <div className="h-[270px] w-full">
            {analytics.dailySeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#64748B] dark:text-[#8993A5]">
                {t('overview.chartDailyEmpty')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.dailySeries} margin={{ top: 8, right: 12, left: 0, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: chartTheme.axisTick }}
                    tickFormatter={(v) => String(v).slice(5)}
                    label={{
                      value: t('overview.axisDate'),
                      position: 'insideBottom',
                      offset: -10,
                      fill: chartTheme.axisLabel,
                      fontSize: 10,
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: chartTheme.axisTick }}
                    label={{
                      value: t('overview.axisEvents'),
                      angle: -90,
                      position: 'insideLeft',
                      fill: chartTheme.axisLabel,
                      fontSize: 10,
                    }}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Area
                    type="monotone"
                    dataKey="incoming"
                    name={t('overview.incoming')}
                    stackId="1"
                    stroke={chartTheme.incoming}
                    fill={chartTheme.incoming}
                    fillOpacity={0.28}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="outgoing"
                    name={t('overview.outgoing')}
                    stackId="1"
                    stroke={chartTheme.outgoing}
                    fill={chartTheme.outgoing}
                    fillOpacity={0.28}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="sms"
                    name={t('overview.sms')}
                    stackId="1"
                    stroke={chartTheme.gold}
                    fill={chartTheme.gold}
                    fillOpacity={0.32}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('overview.chartSplitTitle')}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5 font-mono">
              {t('overview.chartSplitSub', {
                total: formatDuration(analytics.totalDurationSec),
                avg: analytics.avgDurationSec,
              })}
            </p>
          </div>
          <div className="h-[270px] w-full">
            {analytics.totalCdrs === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#64748B] dark:text-[#8993A5]">
                {t('common.noData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={directionData} margin={{ top: 8, right: 8, left: 0, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: chartTheme.axisTick }}
                    label={{
                      value: t('overview.axisCategory'),
                      position: 'insideBottom',
                      offset: -10,
                      fill: chartTheme.axisLabel,
                      fontSize: 10,
                    }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: chartTheme.axisTick }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" name={t('overview.events')} radius={[4, 4, 0, 0]}>
                    {directionData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      {/* Secondary Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('overview.chartHourlyTitle')}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
              {t('overview.chartHourlySub')}
            </p>
          </div>
          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.hourlySeries} margin={{ top: 6, right: 8, left: 0, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: chartTheme.axisTick }}
                  interval={2}
                  label={{
                    value: t('overview.axisHour'),
                    position: 'insideBottom',
                    offset: -10,
                    fill: chartTheme.axisLabel,
                    fontSize: 10,
                  }}
                />
                <YAxis tick={{ fontSize: 11, fill: chartTheme.axisTick }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="calls" name={t('overview.events')} radius={[3, 3, 0, 0]}>
                  {analytics.hourlySeries.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.isNight ? chartTheme.warning : chartTheme.incoming}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('overview.chartTopContactsTitle')}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
              {t('overview.chartTopContactsSub')}
            </p>
          </div>
          <div className="h-[230px] w-full">
            {topContactChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#64748B] dark:text-[#8993A5]">
                {t('common.noData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topContactChartData} margin={{ top: 6, right: 8, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: chartTheme.axisTick }} />
                  <YAxis tick={{ fontSize: 11, fill: chartTheme.axisTick }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar
                    dataKey="calls"
                    name={t('overview.calls')}
                    fill={chartTheme.incoming}
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="durationMin"
                    name={t('overview.durationMin')}
                    fill={chartTheme.outgoing}
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      {/* Top Contacted Numbers Table + Investigation Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
          <div className="px-5 py-4 border-b border-[#E2E7EF] dark:border-[#243656] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {t('overview.topContactsTableTitle')}
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
                {t('overview.topContactsTableSub')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('cdr')}
              className="text-xs font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline"
            >
              {t('overview.viewAll')}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E7EF] dark:border-[#243656] text-[11px] font-semibold text-[#64748B] dark:text-[#8993A5] bg-[#F5F7FA] dark:bg-[#131F35]">
                  <th className="py-2.5 px-4">{t('overview.colPhone')}</th>
                  <th className="py-2.5 px-4">{t('overview.colEntity')}</th>
                  <th className="py-2.5 px-4 text-right">{t('overview.colTotal')}</th>
                  <th className="py-2.5 px-4 text-right">{t('overview.colInOut')}</th>
                  <th className="py-2.5 px-4 text-right">{t('overview.colNight')}</th>
                  <th className="py-2.5 px-4 text-right">{t('overview.colDuration')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E7EF] dark:divide-[#243656] text-xs">
                {analytics.topContacts.slice(0, 8).map((row) => (
                  <tr
                    key={row.phoneNumber}
                    onClick={() => onInspectCdrById(row.sampleRecordId)}
                    className="hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono tabular-nums font-medium text-[#17243B] dark:text-[#F4F5F7]">
                      {row.phoneNumber}
                    </td>
                    <td className="py-2.5 px-4 text-[#334155] dark:text-[#CBD5E1]">
                      {row.label ? (
                        <span className="font-medium text-[#17243B] dark:text-[#F4F5F7]">
                          {row.label}
                        </span>
                      ) : (
                        <span className="text-[#64748B] dark:text-[#8993A5]">
                          {t('overview.externalBridge')}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                      {row.totalCalls}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      <span className="text-[#2563EB] dark:text-[#60A5FA]">{row.incomingCalls}</span>
                      <span className="text-[#8993A5] mx-1">/</span>
                      <span className="text-[#0D9488] dark:text-[#2DD4BF]">{row.outgoingCalls}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#EA580C] dark:text-[#FB923C]">
                      {row.nightCalls}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#334155] dark:text-[#CBD5E1]">
                      {formatDuration(row.totalDurationSec)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Investigation Alerts Panel */}
        <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded flex flex-col">
          <div className="px-5 py-4 border-b border-[#E2E7EF] dark:border-[#243656]">
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('overview.alertsPanelTitle')}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
              {t('overview.alertsPanelSub')}
            </p>
          </div>
          <div className="p-4 space-y-3 flex-1">
            {analytics.deviceAlerts.map((alert) => {
              const isSimSwap = alert.type === 'SIM_SWAP';
              return (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => onNavigate('imei')}
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    isSimSwap
                      ? 'border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/25 hover:border-[#DC2626]'
                      : 'border-orange-200 dark:border-orange-900/60 bg-orange-50/60 dark:bg-orange-950/20 hover:border-[#EA580C]'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                    <AlertTriangle
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSimSwap
                          ? 'text-[#DC2626] dark:text-[#F87171]'
                          : 'text-[#EA580C] dark:text-[#FB923C]'
                      }`}
                    />
                    <span>
                      {alert.type === 'IMEI_CHANGE'
                        ? t('overview.imeiTransitionDetected')
                        : t('overview.simSwapIndicator')}
                    </span>
                  </div>
                  <p className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-1 leading-snug">
                    <span className="font-mono text-[#17243B] dark:text-[#F4F5F7]">
                      {alert.primaryIdentifier}
                    </span>{' '}
                    · {alert.associatedIdentifiers.length} IDs ({alert.suspectLabel || 'Subscriber'}).
                  </p>
                </button>
              );
            })}

            {analytics.commonContacts.slice(0, 2).map((cc) => (
              <button
                key={cc.phoneNumber}
                type="button"
                onClick={() => onNavigate('network')}
                className="w-full text-left p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F5F7FA] dark:bg-[#101A30] hover:border-[#A88748] dark:hover:border-[#C5A66A] transition-colors"
              >
                <p className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  {t('overview.commonContactBridge')} ·{' '}
                  <span className="font-mono text-[#A88748] dark:text-[#C5A66A]">
                    {cc.phoneNumber}
                  </span>
                </p>
                <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-1">
                  {cc.connectedSuspectLabels.join(', ')} ({cc.totalCalls} calls, {cc.nightCalls} night).
                </p>
              </button>
            ))}

            {analytics.unusualPatterns.slice(0, 1).map((u) => (
              <button
                key={u.phoneNumber}
                type="button"
                onClick={() => onNavigate('cdr')}
                className="w-full text-left p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F5F7FA] dark:bg-[#101A30] hover:border-[#2563EB] dark:hover:border-[#C5A66A] transition-colors"
              >
                <p className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  {t('overview.unusualCallPattern')} ·{' '}
                  <span className="font-mono">{u.phoneNumber}</span>
                </p>
                <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-1">{u.reason}</p>
              </button>
            ))}

            {analytics.deviceAlerts.length === 0 &&
              analytics.commonContacts.length === 0 &&
              analytics.unusualPatterns.length === 0 && (
                <p className="text-xs text-[#64748B] dark:text-[#8993A5] py-4">
                  {t('overview.noAlertsInFilter')}
                </p>
              )}
          </div>
        </section>
      </div>

      {/* Bottom Row: Evidence Datasets, Recent Case Updates/Notes & Activity Timeline */}
      <div className={`grid grid-cols-1 ${canViewAudit ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6`}>
        <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
          <div className="px-5 py-4 border-b border-[#E2E7EF] dark:border-[#243656] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('overview.associatedDatasets')}
            </h2>
            {canImportData && (
              <button
                type="button"
                onClick={() => onNavigate('import')}
                className="text-xs font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline"
              >
                {t('overview.importNew')}
              </button>
            )}
          </div>
          <div className="divide-y divide-[#E2E7EF] dark:divide-[#243656]">
            {activeCase.datasets.length === 0 ? (
              <p className="p-5 text-xs text-[#64748B] dark:text-[#8993A5]">
                {t('overview.noDatasets')}
              </p>
            ) : (
              activeCase.datasets.map((ds) => (
                <div key={ds.id} className="px-5 py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <FileSpreadsheet className="w-4 h-4 text-[#0D9488] dark:text-[#14B8A6] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-mono font-medium text-[#17243B] dark:text-[#F4F5F7] truncate">
                        {ds.fileName}
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] mt-0.5">
                        {ds.evidenceRefId || ds.id} · {ds.fileType} · {ds.integrityStatus}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono tabular-nums font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                      {t('overview.rowsCount', { count: ds.recordCount })}
                    </p>
                    <p
                      className={`text-[11px] ${
                        ds.warningCount > 0
                          ? 'text-[#EA580C] dark:text-[#FB923C]'
                          : 'text-[#16A34A] dark:text-[#4ADE80]'
                      }`}
                    >
                      {ds.normalizationStatus}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Recent Case Updates & Investigation Notes */}
        <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
          <div className="px-5 py-4 border-b border-[#E2E7EF] dark:border-[#243656] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              Recent Case Updates
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('cases')}
              className="text-xs font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline"
            >
              View Notes
            </button>
          </div>
          <div className="divide-y divide-[#E2E7EF] dark:divide-[#243656]">
            {!activeCase.notes || activeCase.notes.length === 0 ? (
              <p className="p-5 text-xs text-[#64748B] dark:text-[#8993A5]">
                No investigator notes recorded for this case yet.
              </p>
            ) : (
              activeCase.notes.slice(0, 4).map((note) => (
                <div key={note.id} className="px-5 py-3 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[#17243B] dark:text-[#F4F5F7]">
                      {note.authorName}{' '}
                      <span className="font-mono text-[11px] text-[#A88748] dark:text-[#C5A66A]">
                        · {note.category}
                      </span>
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-[#8993A5] shrink-0">
                      {note.createdAt.slice(5, 16).replace('T', ' ')}
                    </span>
                  </div>
                  <p className="text-[#64748B] dark:text-[#8993A5] line-clamp-2 leading-relaxed">
                    {note.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        {canViewAudit && (
          <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
            <div className="px-5 py-4 border-b border-[#E2E7EF] dark:border-[#243656] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {t('overview.recentActivity')}
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('audit')}
                className="text-xs font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline"
              >
                {t('overview.fullAuditLog')}
              </button>
            </div>
            <div className="divide-y divide-[#E2E7EF] dark:divide-[#243656]">
              {recentCaseLogs.map((log) => (
                <div key={log.id} className="px-5 py-3 flex items-start justify-between gap-4 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-[#17243B] dark:text-[#F4F5F7]">
                      {log.userName}{' '}
                      <span className="text-[#64748B] dark:text-[#8993A5] font-normal">
                        ({log.userRole})
                      </span>{' '}
                      ·{' '}
                      <span className="font-mono text-[11px] text-[#2563EB] dark:text-[#C5A66A]">
                        {log.action}
                      </span>
                    </p>
                    <p className="text-[#64748B] dark:text-[#8993A5] mt-0.5 truncate">{log.details}</p>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-[#8993A5] shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {log.timestamp.slice(5, 16).replace('T', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
