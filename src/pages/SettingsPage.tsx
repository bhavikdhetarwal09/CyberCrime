import React, { useEffect, useState } from 'react';
import {
  Users,
  Trash2,
  RotateCcw,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Sun,
  Moon,
  Globe,
  UserPlus,
  Database,
  ShieldCheck,
  Power,
  RefreshCw,
} from 'lucide-react';
import {
  AuthUser,
  CaseRecord,
  UserRole,
  SystemMonitoringSummary,
} from '../shared/types';
import { api, ApiError } from '../lib/api';
import { usePreferences } from '../lib/preferences';

interface SettingsPageProps {
  user: AuthUser;
  cases: CaseRecord[];
  activeCase: CaseRecord | null;
  adminMonitoring?: SystemMonitoringSummary | null;
  onRefreshAll: () => Promise<void>;
  onLogout: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  cases,
  activeCase,
  adminMonitoring: initialMonitoring,
  onRefreshAll,
  onLogout,
}) => {
  const { theme, setTheme, language, setLanguage, t } = usePreferences();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [monitoring, setMonitoring] = useState<SystemMonitoringSummary | null>(
    initialMonitoring || null
  );
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create User form (Administrator only)
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Investigator');
  const [newDepartment, setNewDepartment] = useState('Cyber Investigation Unit');
  const [newBadgeCode, setNewBadgeCode] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  // Case assignment editor for a selected user
  const [editingAssignUserId, setEditingAssignUserId] = useState<string | null>(null);
  const [draftCaseIds, setDraftCaseIds] = useState<string[]>([]);
  const [savingAssignment, setSavingAssignment] = useState(false);

  const isAdmin = user.role === 'Administrator';

  const loadGovernanceData = async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const [userRes, monRes] = await Promise.all([
        api.getUsers(),
        api.getAdminMonitoring(),
      ]);
      setUsers(userRes.users);
      setMonitoring(monRes.monitoring);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Unable to load governance directory.',
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (initialMonitoring) {
      setMonitoring(initialMonitoring);
    }
  }, [initialMonitoring]);

  useEffect(() => {
    void loadGovernanceData();
  }, [isAdmin]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setFeedback(null);
    try {
      const res = await api.createUser({
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
        department: newDepartment.trim(),
        badgeCode: newBadgeCode.trim() || undefined,
        assignedCaseIds: [],
      });
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewBadgeCode('');
      setShowCreateUser(false);
      await loadGovernanceData();
      setFeedback({
        type: 'success',
        text: `Created ${res.user.role} account for ${res.user.name} (${res.user.email}).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'User creation failed.',
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateUserRole = async (target: AuthUser, nextRole: UserRole) => {
    setFeedback(null);
    try {
      await api.updateUserRole(target.id, {
        role: nextRole,
        assignedCaseIds: nextRole === 'Viewer' ? [] : target.assignedCaseIds,
        canAccessSensitiveCaseData: nextRole === 'Investigator' ? true : false,
      });
      await loadGovernanceData();
      setFeedback({
        type: 'success',
        text: `Updated ${target.name} (${target.email}) role to ${nextRole}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Role update failed.',
      });
    }
  };

  const handleToggleUserStatus = async (target: AuthUser) => {
    setFeedback(null);
    try {
      const res = await api.updateUserStatus(target.id, !target.isActive);
      await loadGovernanceData();
      setFeedback({
        type: 'success',
        text: `${res.user.isActive ? 'Activated' : 'Suspended'} account ${res.user.email}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Status update failed.',
      });
    }
  };

  const handleToggleAdminSensitivePolicy = async (target: AuthUser) => {
    setFeedback(null);
    try {
      const nextFlag = !target.canAccessSensitiveCaseData;
      await api.updateUserRole(target.id, {
        canAccessSensitiveCaseData: nextFlag,
      });
      await loadGovernanceData();
      setFeedback({
        type: 'success',
        text: `Updated sensitive case data policy for ${target.email} (${nextFlag ? 'Explicitly Authorized' : 'Metadata Only'}).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Policy update failed.',
      });
    }
  };

  const openAssignmentEditor = (target: AuthUser) => {
    setEditingAssignUserId(target.id);
    setDraftCaseIds([...target.assignedCaseIds]);
  };

  const toggleDraftCase = (caseId: string) => {
    setDraftCaseIds((prev) =>
      prev.includes(caseId) ? prev.filter((id) => id !== caseId) : [...prev, caseId]
    );
  };

  const saveCaseAssignments = async (target: AuthUser) => {
    setSavingAssignment(true);
    setFeedback(null);
    try {
      await api.updateUserRole(target.id, {
        assignedCaseIds: draftCaseIds,
      });
      setEditingAssignUserId(null);
      await loadGovernanceData();
      setFeedback({
        type: 'success',
        text: `Updated assigned cases for ${target.name} (${draftCaseIds.length} case(s) assigned).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Case assignment update failed.',
      });
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleDeleteDataset = async (caseId: string, datasetId: string, fileName: string) => {
    setFeedback(null);
    try {
      await api.deleteDataset(caseId, datasetId);
      await onRefreshAll();
      setFeedback({
        type: 'success',
        text: `Deleted dataset "${fileName}" and its normalized records from the case.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Dataset deletion blocked.',
      });
    }
  };

  const handleResetDemo = async () => {
    setFeedback(null);
    try {
      await api.resetDemoData();
      await onRefreshAll();
      await loadGovernanceData();
      setFeedback({
        type: 'success',
        text: 'Restored the 5 synthetic investigation cases, CDR/IPDR datasets, and default role baseline.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Reset failed.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#17243B] dark:text-[#F4F5F7]">
          {isAdmin ? 'User Management, Governance & System Settings' : t('settings.title')}
        </h1>
        <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-1">
          {isAdmin
            ? 'Manage accounts, roles, account status, investigator case assignments, and database health.'
            : t('settings.subtitle')}
        </p>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded border text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-[#DC2626] dark:text-red-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Appearance & Language Preferences */}
      <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5 space-y-4 text-xs">
        <div>
          <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('settings.appearanceTitle')}
          </h2>
          <p className="text-[#64748B] dark:text-[#8993A5] mt-0.5">
            {t('settings.appearanceSub')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="p-4 bg-[#F8F9FB] dark:bg-[#132036] border border-[#E2E7EF] dark:border-[#243656] rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {t('settings.themeLabel')}
              </p>
              <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] mt-0.5">
                {theme === 'dark' ? t('shell.themeDark') : t('shell.themeLight')}
              </p>
            </div>
            <div className="inline-flex items-center gap-1 p-1 bg-white dark:bg-[#101A30] border border-[#DCE1EA] dark:border-[#2D4063] rounded self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`px-3 py-1.5 rounded text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                  theme === 'light'
                    ? 'bg-[#17243B] text-white'
                    : 'text-[#64748B] dark:text-[#8993A5] hover:text-[#17243B] dark:hover:text-[#F4F5F7]'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                {t('shell.themeLight')}
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`px-3 py-1.5 rounded text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                  theme === 'dark'
                    ? 'bg-[#C5A66A] text-[#101A30]'
                    : 'text-[#64748B] dark:text-[#8993A5] hover:text-[#17243B] dark:hover:text-[#F4F5F7]'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                {t('shell.themeDark')}
              </button>
            </div>
          </div>

          <div className="p-4 bg-[#F8F9FB] dark:bg-[#132036] border border-[#E2E7EF] dark:border-[#243656] rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7] flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />
                {t('settings.langLabel')}
              </p>
              <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] mt-0.5">
                {language === 'hi' ? 'हिंदी (Hindi)' : 'English (Default)'}
              </p>
            </div>
            <div className="inline-flex items-center gap-1 p-1 bg-white dark:bg-[#101A30] border border-[#DCE1EA] dark:border-[#2D4063] rounded self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  language === 'en'
                    ? 'bg-[#17243B] dark:bg-[#C5A66A] text-white dark:text-[#101A30]'
                    : 'text-[#64748B] dark:text-[#8993A5] hover:text-[#17243B] dark:hover:text-[#F4F5F7]'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  language === 'hi'
                    ? 'bg-[#17243B] dark:bg-[#C5A66A] text-white dark:text-[#101A30]'
                    : 'text-[#64748B] dark:text-[#8993A5] hover:text-[#17243B] dark:hover:text-[#F4F5F7]'
                }`}
              >
                हिंदी
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Current Session Profile */}
      <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('settings.sessionTitle')}
          </p>
          <p className="text-[#475569] dark:text-[#CBD5E1]">
            <strong className="text-[#17243B] dark:text-[#F4F5F7]">{user.name}</strong> ({user.email}) ·{' '}
            {t('shell.roleLabel')}{' '}
            <strong className="text-[#17243B] dark:text-[#F4F5F7]">
              {t(`role.${user.role}` as 'role.Administrator')}
            </strong>{' '}
            · <span className="font-mono">{user.badgeCode}</span>
          </p>
          <p className="text-[#64748B] dark:text-[#8993A5]">
            Assigned Case Scope:{' '}
            <span className="font-mono">
              {user.role === 'Administrator'
                ? user.canAccessSensitiveCaseData
                  ? `${user.assignedCaseIds.length} authorized case(s)`
                  : 'Governance Metadata Only'
                : user.assignedCaseIds.length > 0
                ? user.assignedCaseIds.join(', ')
                : 'No cases assigned'}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="h-9 px-4 bg-[#17243B] hover:bg-[#101A30] dark:bg-[#C5A66A] dark:hover:bg-[#d2b57c] text-white dark:text-[#101A30] font-medium rounded inline-flex items-center gap-2 shrink-0"
        >
          <LogOut className="w-4 h-4 text-[#C5A66A] dark:text-[#101A30]" />
          {t('shell.signOut')}
        </button>
      </section>

      {/* Admin-Only Governance Controls */}
      {isAdmin && (
        <>
          {/* Live Database & System Monitoring */}
          <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5 space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A]" />
                <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  Database &amp; Platform Health Monitoring
                </h2>
              </div>
              <button
                type="button"
                onClick={() => void loadGovernanceData()}
                className="h-8 px-3 border border-[#CBD2DE] dark:border-[#2D4063] rounded text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Status
              </button>
            </div>
            {monitoring && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F9FB] dark:bg-[#132036]">
                  <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Storage Engine</p>
                  <p className="font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7] mt-1">
                    {monitoring.databaseTarget}
                  </p>
                  <p className="text-[10px] text-[#16A34A] dark:text-[#4ADE80] uppercase mt-0.5">
                    {monitoring.databaseStatus}
                  </p>
                </div>
                <div className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F9FB] dark:bg-[#132036]">
                  <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">AI Engine</p>
                  <p className="font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7] mt-1">
                    Gemini SDK
                  </p>
                  <p className="text-[10px] text-[#64748B] dark:text-[#8993A5] mt-0.5">
                    {monitoring.aiProviderConfigured ? 'Service Active' : 'Service Standby'}
                  </p>
                </div>
                <div className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F9FB] dark:bg-[#132036]">
                  <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Active Sessions</p>
                  <p className="font-mono text-base font-semibold text-[#17243B] dark:text-[#F4F5F7] mt-1">
                    {monitoring.activeSessions}
                  </p>
                </div>
                <div className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F9FB] dark:bg-[#132036]">
                  <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Cases / Complaints</p>
                  <p className="font-mono text-base font-semibold text-[#17243B] dark:text-[#F4F5F7] mt-1">
                    {monitoring.totalCases} / {monitoring.totalComplaints}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* User Directory, Role Management, Activation & Investigator Case Assignments */}
          <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
            <div className="px-5 py-4 border-b border-[#ECEFF4] dark:border-[#243656] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#17243B] dark:text-[#C5A66A]" />
                <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  User Directory, Role Permissions &amp; Investigator Assignments
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateUser((v) => !v)}
                className="h-8 px-3 text-xs font-medium bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded inline-flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {showCreateUser ? 'Close Form' : 'Create User'}
              </button>
            </div>

            {showCreateUser && (
              <form
                onSubmit={handleCreateUser}
                className="p-5 border-b border-[#ECEFF4] dark:border-[#243656] bg-[#F8F9FB] dark:bg-[#132036] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs"
              >
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Full Name *"
                  className="h-9 px-3 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] rounded text-[#17243B] dark:text-[#F4F5F7]"
                />
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email Address *"
                  className="h-9 px-3 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] rounded text-[#17243B] dark:text-[#F4F5F7]"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Password (min 8 chars) *"
                  className="h-9 px-3 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] rounded text-[#17243B] dark:text-[#F4F5F7]"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="h-9 px-3 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] rounded text-[#17243B] dark:text-[#F4F5F7]"
                >
                  <option value="Investigator">Investigator</option>
                  <option value="Viewer">Viewer</option>
                  <option value="Administrator">Administrator</option>
                </select>
                <input
                  type="text"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  placeholder="Department / Unit"
                  className="h-9 px-3 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] rounded text-[#17243B] dark:text-[#F4F5F7]"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newBadgeCode}
                    onChange={(e) => setNewBadgeCode(e.target.value)}
                    placeholder="Badge Code (optional)"
                    className="h-9 px-3 flex-1 font-mono bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] rounded text-[#17243B] dark:text-[#F4F5F7]"
                  />
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="h-9 px-4 bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] font-medium rounded disabled:opacity-50"
                  >
                    {creatingUser ? 'Saving…' : 'Create'}
                  </button>
                </div>
              </form>
            )}

            {loadingUsers ? (
              <p className="p-5 text-xs text-[#64748B] dark:text-[#8993A5]">Loading directory...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F8F9FB] dark:bg-[#132036] border-b border-[#ECEFF4] dark:border-[#243656] text-[11px] text-[#64748B] dark:text-[#8993A5]">
                      <th className="py-2.5 px-4">User &amp; Status</th>
                      <th className="py-2.5 px-4">Email</th>
                      <th className="py-2.5 px-4">Assigned Cases / Scope</th>
                      <th className="py-2.5 px-4">Role</th>
                      <th className="py-2.5 px-4 text-right">Governance Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECEFF4] dark:divide-[#243656]">
                    {users.map((u) => {
                      const isEditingAssign = editingAssignUserId === u.id;
                      return (
                        <React.Fragment key={u.id}>
                          <tr className="hover:bg-[#F8F9FB] dark:hover:bg-[#1A2A45]">
                            <td className="py-2.5 px-4">
                              <p className="font-medium text-[#17243B] dark:text-[#F4F5F7]">
                                {u.name}{' '}
                                <span className="font-mono text-[#64748B] dark:text-[#8993A5]">
                                  ({u.badgeCode})
                                </span>
                              </p>
                              <p className="text-[10px] mt-0.5">
                                <span
                                  className={
                                    u.isActive
                                      ? 'text-[#16A34A] dark:text-[#4ADE80] font-semibold'
                                      : 'text-[#DC2626] dark:text-[#F87171] font-semibold'
                                  }
                                >
                                  {u.isActive ? 'Active' : 'Suspended'}
                                </span>
                                {' · '}
                                <span className="text-[#64748B] dark:text-[#8993A5]">{u.department}</span>
                              </p>
                            </td>
                            <td className="py-2.5 px-4 font-mono text-[#475569] dark:text-[#CBD5E1]">
                              {u.email}
                            </td>
                            <td className="py-2.5 px-4 text-[11px] text-[#64748B] dark:text-[#8993A5]">
                              {u.role === 'Viewer' ? (
                                <span>Own Personal Complaints Only</span>
                              ) : (
                                <div className="space-y-1">
                                  <span className="font-mono">
                                    {u.assignedCaseIds.length} assigned case(s)
                                  </span>
                                  {u.role === 'Administrator' && (
                                    <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(u.canAccessSensitiveCaseData)}
                                        onChange={() => void handleToggleAdminSensitivePolicy(u)}
                                        className="accent-[#101A30] dark:accent-[#C5A66A]"
                                      />
                                      <span>Explicit sensitive case access</span>
                                    </label>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-4">
                              <select
                                value={u.role}
                                disabled={u.id === user.id}
                                onChange={(e) => void handleUpdateUserRole(u, e.target.value as UserRole)}
                                className="h-8 px-2 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded text-xs disabled:opacity-50"
                              >
                                <option value="Administrator">{t('role.Administrator')}</option>
                                <option value="Investigator">{t('role.Investigator')}</option>
                                <option value="Viewer">{t('role.Viewer')}</option>
                              </select>
                            </td>
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                {u.role !== 'Viewer' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      isEditingAssign
                                        ? setEditingAssignUserId(null)
                                        : openAssignmentEditor(u)
                                    }
                                    className="h-8 px-2.5 rounded border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] inline-flex items-center gap-1"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />
                                    Assign Cases
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={u.id === user.id}
                                  onClick={() => void handleToggleUserStatus(u)}
                                  className={`h-8 px-2.5 rounded border inline-flex items-center gap-1 disabled:opacity-40 ${
                                    u.isActive
                                      ? 'border-red-200 dark:border-red-900/60 text-[#DC2626] dark:text-[#F87171] hover:bg-red-50 dark:hover:bg-red-950/30'
                                      : 'border-emerald-200 dark:border-emerald-800/60 text-[#16A34A] dark:text-[#4ADE80] hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                  }`}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                  {u.isActive ? 'Suspend' : 'Activate'}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isEditingAssign && (
                            <tr className="bg-[#F8F9FB] dark:bg-[#101A30]">
                              <td colSpan={5} className="px-5 py-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                                    Select Authorized Cases for {u.name} ({u.role})
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingAssignUserId(null)}
                                      className="h-7 px-3 rounded border border-[#CBD2DE] dark:border-[#2D4063] text-[#475569] dark:text-[#CBD5E1]"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={savingAssignment}
                                      onClick={() => void saveCaseAssignments(u)}
                                      className="h-7 px-3 rounded bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] font-medium disabled:opacity-50"
                                    >
                                      {savingAssignment ? 'Saving…' : 'Save Assignments'}
                                    </button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {cases.map((c) => {
                                    const checked = draftCaseIds.includes(c.id);
                                    return (
                                      <label
                                        key={c.id}
                                        className={`p-2.5 rounded border cursor-pointer flex items-start gap-2 transition-colors ${
                                          checked
                                            ? 'bg-white dark:bg-[#17243B] border-[#1D4ED8] dark:border-[#C5A66A]'
                                            : 'bg-white/70 dark:bg-[#132036] border-[#DCE3EE] dark:border-[#243656]'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleDraftCase(c.id)}
                                          className="mt-0.5 accent-[#101A30] dark:accent-[#C5A66A]"
                                        />
                                        <div className="min-w-0">
                                          <p className="font-mono font-semibold text-[#17243B] dark:text-[#C5A66A]">
                                            {c.caseNumber}
                                          </p>
                                          <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1] truncate">
                                            {c.title}
                                          </p>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Baseline Data Retention & Reset */}
          <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5 space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#ECEFF4] dark:border-[#243656]">
              <div>
                <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  {t('settings.retentionTitle')}
                </h2>
                <p className="text-[#64748B] dark:text-[#8993A5] mt-0.5">
                  Restore the 5-case synthetic demonstration baseline or manage uploaded datasets.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleResetDemo()}
                className="h-9 px-3.5 bg-white dark:bg-[#101A30] hover:bg-[#F8F9FB] dark:hover:bg-[#1E2F4C] text-[#17243B] dark:text-[#F4F5F7] border border-[#CBD2DE] dark:border-[#2D4063] rounded inline-flex items-center gap-1.5 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t('settings.resetDemoBtn')}
              </button>
            </div>

            {activeCase && !activeCase.restrictedMetadataOnly && activeCase.datasets.length > 0 && (
              <div className="divide-y divide-[#ECEFF4] dark:divide-[#243656] border border-[#ECEFF4] dark:border-[#243656] rounded">
                {activeCase.datasets.map((ds) => (
                  <div key={ds.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono font-medium text-[#17243B] dark:text-[#F4F5F7]">
                        {ds.fileName}
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                        {ds.fileType} · {t('overview.rowsCount', { count: ds.recordCount })} ·{' '}
                        {ds.uploadedBy}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteDataset(activeCase.id, ds.id, ds.fileName)}
                      className="px-3 py-1.5 text-[#DC2626] dark:text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('settings.deleteDataset')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
              Total cases in persistent database: <span className="font-mono">{cases.length}</span>.
            </p>
          </section>
        </>
      )}

      {/* Subtle About & Data Source Disclosure */}
      <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('settings.aboutTitle')}
          </h2>
          <span className="font-mono text-[11px] text-[#64748B] dark:text-[#8993A5]">
            {t('settings.dataSourceLabel')}:{' '}
            <strong className="text-[#17243B] dark:text-[#C5A66A]">
              {t('settings.dataSourceValue')}
            </strong>
          </span>
        </div>
        <p className="text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
          {t('settings.aboutBody')}
        </p>
      </section>
    </div>
  );
};
