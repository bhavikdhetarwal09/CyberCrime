import React, { useState, useMemo } from 'react';
import { Search, ShieldCheck, RefreshCw, Activity, ShieldAlert, KeyRound, Lock } from 'lucide-react';
import { AuditLogEntry, AuthUser, SecurityActivitySummary } from '../shared/types';
import { usePreferences } from '../lib/preferences';

interface AuditLogsPageProps {
  user: AuthUser;
  auditLogs: AuditLogEntry[];
  securityMetrics?: SecurityActivitySummary | null;
  onRefreshLogs: () => Promise<void>;
}

const ROLE_MATRIX = [
  {
    capability: 'Portal Services (Report Crime, Learning Corner, Cyber Volunteer)',
    Administrator: 'Hidden (Governance Desk)',
    Investigator: 'Hidden (Case Workspace)',
    Viewer: 'Full Access',
  },
  {
    capability: 'Create Personal Cases / Complaints & Track Own Complaint ID',
    Administrator: 'Denied (403)',
    Investigator: 'Denied (403)',
    Viewer: 'Allowed (Own Scope)',
  },
  {
    capability: 'View Telecom Records (CDR / IPDR / Network / Tower / IMEI)',
    Administrator: 'Full Read & Review Access',
    Investigator: 'Assigned Cases Only',
    Viewer: 'Own Cases Only',
  },
  {
    capability: 'Import & Normalize CDR / IPDR Files',
    Administrator: 'Full Case Import Access',
    Investigator: 'Assigned Cases Only',
    Viewer: 'Own Cases Only',
  },
  {
    capability: 'AI Investigation Assistant (Evidence-Cited Gemini SDK)',
    Administrator: 'Full Read & Review Oversight',
    Investigator: 'Assigned Cases Only',
    Viewer: 'Own Cases Only',
  },
  {
    capability: 'Centralized Reports & Officer Sign-off (Verify/Lock & Export)',
    Administrator: 'Full Review, Lock & Export Authority',
    Investigator: 'Assigned Cases + Officer Sign-Off',
    Viewer: 'Own Cases Only',
  },
  {
    capability: 'View Security Audit Logs & System Monitoring',
    Administrator: 'All Platform Events & Metrics',
    Investigator: 'Assigned Case Events',
    Viewer: 'Denied (403)',
  },
  {
    capability: 'User Management, Role Permissions, Activation & Case Assignments',
    Administrator: 'Full Governance Control',
    Investigator: 'Denied (403)',
    Viewer: 'Denied (403)',
  },
];

export const AuditLogsPage: React.FC<AuditLogsPageProps> = ({
  user,
  auditLogs,
  securityMetrics,
  onRefreshLogs,
}) => {
  const { t } = usePreferences();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [userFilter, setUserFilter] = useState('ALL');
  const [caseFilter, setCaseFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const distinctUsers = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((l) => {
      if (l.userName) set.add(l.userName);
    });
    return Array.from(set).sort();
  }, [auditLogs]);

  const distinctCases = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((l) => {
      if (
        l.resource &&
        (l.resource.startsWith('case:') ||
          l.resource.startsWith('CASE-') ||
          l.resource.includes('TRACE-CMP-') ||
          l.resource.startsWith('complaint:'))
      ) {
        set.add(l.resource);
      }
      if (l.details) {
        const matches = l.details.match(/(CASE-[A-Z0-9-]+|TRACE-CMP-[A-Z0-9-]+)/g);
        if (matches) {
          matches.forEach((m) => set.add(m));
        }
      }
    });
    return Array.from(set).sort();
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auditLogs.filter((l) => {
      if (userFilter !== 'ALL' && l.userName !== userFilter) return false;
      if (caseFilter !== 'ALL') {
        const matchesCase =
          l.resource.includes(caseFilter) || l.details.includes(caseFilter);
        if (!matchesCase) return false;
      }
      if (actionFilter === 'AUTH_GROUP') {
        if (!l.action.startsWith('AUTH_') && l.action !== 'ACCESS_DENIED') return false;
      } else if (actionFilter === 'EVIDENCE_GROUP') {
        if (
          l.action !== 'DATA_IMPORT' &&
          l.action !== 'EVIDENCE_VERIFY' &&
          l.action !== 'CASE_NOTE_ADD' &&
          l.action !== 'CASE_NOTE_DELETE' &&
          l.action !== 'REPORT_EXPORT' &&
          l.action !== 'REPORT_VERIFY'
        ) {
          return false;
        }
      } else if (actionFilter !== 'ALL' && l.action !== actionFilter) {
        return false;
      }
      if (!q) return true;
      return (
        l.userName.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.resource.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q)
      );
    });
  }, [auditLogs, search, actionFilter, userFilter, caseFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshLogs();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('audit.title')}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-1">
            {t('audit.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="h-9 px-3.5 text-xs font-medium bg-white dark:bg-[#17243B] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F8F9FB] dark:hover:bg-[#1E2F4C] rounded inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {t('audit.refreshBtn')}
        </button>
      </div>

      {/* Login Activity & Security Monitoring Strip */}
      {securityMetrics && (
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-[#64748B] dark:text-[#8993A5]">Active Sessions</p>
              <Activity className="w-3.5 h-3.5 text-[#16A34A] dark:text-[#4ADE80]" />
            </div>
            <p className="mt-1.5 text-2xl font-mono font-semibold tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
              {securityMetrics.activeSessions}
            </p>
            <p className="mt-0.5 text-[10px] text-[#64748B] dark:text-[#8993A5]">
              30-min idle auto-timeout active
            </p>
          </div>
          <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-[#64748B] dark:text-[#8993A5]">Successful Logins</p>
              <KeyRound className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
            </div>
            <p className="mt-1.5 text-2xl font-mono font-semibold tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
              {securityMetrics.successfulLogins + securityMetrics.otpVerifiedCount}
            </p>
            <p className="mt-0.5 text-[10px] font-mono text-[#64748B] dark:text-[#8993A5]">
              {securityMetrics.otpVerifiedCount} via 2-step OTP
            </p>
          </div>
          <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-[#64748B] dark:text-[#8993A5]">Failed Logins</p>
              <ShieldAlert className="w-3.5 h-3.5 text-[#DC2626] dark:text-[#F87171]" />
            </div>
            <p className="mt-1.5 text-2xl font-mono font-semibold tabular-nums text-[#DC2626] dark:text-[#F87171]">
              {securityMetrics.failedLogins}
            </p>
            <p className="mt-0.5 text-[10px] text-[#64748B] dark:text-[#8993A5]">
              Rate-limited by IP
            </p>
          </div>
          <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-[#64748B] dark:text-[#8993A5]">OTP Failures</p>
              <ShieldAlert className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FB923C]" />
            </div>
            <p className="mt-1.5 text-2xl font-mono font-semibold tabular-nums text-[#EA580C] dark:text-[#FB923C]">
              {securityMetrics.otpFailedCount}
            </p>
            <p className="mt-0.5 text-[10px] text-[#64748B] dark:text-[#8993A5]">
              Max 5 attempts / challenge
            </p>
          </div>
          <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-[#64748B] dark:text-[#8993A5]">Blocked Access (403)</p>
              <Lock className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />
            </div>
            <p className="mt-1.5 text-2xl font-mono font-semibold tabular-nums text-[#17243B] dark:text-[#C5A66A]">
              {securityMetrics.accessDeniedCount}
            </p>
            <p className="mt-0.5 text-[10px] text-[#64748B] dark:text-[#8993A5]">
              RBAC &amp; cross-case guards
            </p>
          </div>
        </section>
      )}

      {/* RBAC Enforcement Matrix */}
      <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
        <div className="px-5 py-3.5 border-b border-[#ECEFF4] dark:border-[#243656] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#17243B] dark:text-[#C5A66A]" />
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('audit.rbacTitle')}
            </h2>
          </div>
          <span className="text-xs text-[#64748B] dark:text-[#8993A5]">
            {t('audit.currentRole')}{' '}
            <strong className="text-[#17243B] dark:text-[#F4F5F7]">
              {t(`role.${user.role}` as 'role.Administrator')}
            </strong>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8F9FB] dark:bg-[#132036] border-b border-[#ECEFF4] dark:border-[#243656] text-[11px] text-[#64748B] dark:text-[#8993A5]">
                <th className="py-2.5 px-4">Operation (Enforced by Express Middleware)</th>
                <th className="py-2.5 px-4">{t('role.Administrator')}</th>
                <th className="py-2.5 px-4">{t('role.Investigator')}</th>
                <th className="py-2.5 px-4">{t('role.Viewer')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEFF4] dark:divide-[#243656]">
              {ROLE_MATRIX.map((row) => (
                <tr key={row.capability} className="hover:bg-[#F8F9FB] dark:hover:bg-[#1A2A45]">
                  <td className="py-2.5 px-4 font-medium text-[#17243B] dark:text-[#F4F5F7]">
                    {row.capability}
                  </td>
                  <td className="py-2.5 px-4 text-[#16A34A] dark:text-[#22C55E] font-medium">
                    {row.Administrator}
                  </td>
                  <td className="py-2.5 px-4 text-[#334155] dark:text-[#CBD5E1]">
                    {row.Investigator}
                  </td>
                  <td className="py-2.5 px-4 text-[#64748B] dark:text-[#8993A5]">{row.Viewer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Audit Activity Filter + Table */}
      <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
        <div className="p-4 border-b border-[#ECEFF4] dark:border-[#243656] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[#8993A5] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('audit.searchPlaceholder')}
              className="w-full h-9 pl-8 pr-3 bg-[#F5F7FA] dark:bg-[#101A30] border border-[#DCE1EA] dark:border-[#243656] text-[#17243B] dark:text-[#F4F5F7] placeholder:text-[#8993A5] rounded focus:outline-none focus:bg-white dark:focus:bg-[#101A30] focus:border-[#17243B] dark:focus:border-[#C5A66A]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* User / Actor Filter */}
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="h-9 px-3 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded"
            >
              <option value="ALL">All Users ({distinctUsers.length})</option>
              {distinctUsers.map((u) => (
                <option key={u} value={u}>
                  User: {u}
                </option>
              ))}
            </select>

            {/* Case / Resource Filter */}
            <select
              value={caseFilter}
              onChange={(e) => setCaseFilter(e.target.value)}
              className="h-9 px-3 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded max-w-[200px] truncate"
            >
              <option value="ALL">All Cases / Resources ({distinctCases.length})</option>
              {distinctCases.map((c) => (
                <option key={c} value={c}>
                  Case: {c}
                </option>
              ))}
            </select>

            {/* Action / Event Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-9 px-3 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded"
            >
              <option value="ALL">{t('audit.allEvents', { count: auditLogs.length })}</option>
              <option value="AUTH_GROUP">All Login, OTP &amp; Access Denied</option>
              <option value="EVIDENCE_GROUP">Evidence &amp; Investigation Actions</option>
              <option value="AUTH_LOGIN">AUTH_LOGIN</option>
              <option value="AUTH_OTP_ISSUED">AUTH_OTP_ISSUED</option>
              <option value="AUTH_OTP_VERIFIED">AUTH_OTP_VERIFIED</option>
              <option value="AUTH_OTP_FAILED">AUTH_OTP_FAILED</option>
              <option value="AUTH_LOGOUT">AUTH_LOGOUT</option>
              <option value="EVIDENCE_VERIFY">EVIDENCE_VERIFY</option>
              <option value="CASE_NOTE_ADD">CASE_NOTE_ADD</option>
              <option value="CASE_NOTE_DELETE">CASE_NOTE_DELETE</option>
              <option value="DATA_IMPORT">DATA_IMPORT</option>
              <option value="AI_QUERY">AI_QUERY</option>
              <option value="REPORT_EXPORT">REPORT_EXPORT</option>
              <option value="REPORT_VERIFY">REPORT_VERIFY</option>
              <option value="CASE_CREATE">CASE_CREATE</option>
              <option value="CASE_UPDATE">CASE_UPDATE</option>
              <option value="CASE_DELETE">CASE_DELETE</option>
              <option value="DATA_DELETE">DATA_DELETE</option>
              <option value="ROLE_UPDATE">ROLE_UPDATE</option>
              <option value="ACCESS_DENIED">ACCESS_DENIED</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8F9FB] dark:bg-[#132036] border-b border-[#ECEFF4] dark:border-[#243656] text-[11px] text-[#64748B] dark:text-[#8993A5]">
                <th className="py-2.5 px-4">{t('audit.colTimestamp')}</th>
                <th className="py-2.5 px-4">{t('audit.colActor')}</th>
                <th className="py-2.5 px-4">{t('audit.colAction')}</th>
                <th className="py-2.5 px-4">{t('audit.colResource')}</th>
                <th className="py-2.5 px-4">{t('audit.colOutcome')}</th>
                <th className="py-2.5 px-4">{t('audit.colDetails')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEFF4] dark:divide-[#243656]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#64748B] dark:text-[#8993A5]">
                    {t('audit.noLogs')}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-[#F8F9FB] dark:hover:bg-[#1A2A45]">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-[#64748B] dark:text-[#8993A5] whitespace-nowrap">
                      {l.timestamp.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="font-medium text-[#17243B] dark:text-[#F4F5F7]">
                        {l.userName}
                      </span>
                      <span className="text-[#64748B] dark:text-[#8993A5]"> · {l.userRole}</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[#17243B] dark:text-[#F4F5F7] whitespace-nowrap">
                      {l.action}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[#475569] dark:text-[#CBD5E1]">
                      {l.resource}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap font-medium">
                      <span
                        className={
                          l.status === 'Success'
                            ? 'text-[#16A34A] dark:text-[#22C55E]'
                            : l.status === 'Denied'
                            ? 'text-[#DC2626] dark:text-[#EF4444]'
                            : 'text-[#EA580C] dark:text-[#F97316]'
                        }
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[#475569] dark:text-[#CBD5E1]">{l.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
