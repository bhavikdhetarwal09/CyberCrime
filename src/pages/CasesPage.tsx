import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  FolderOpen,
  UserPlus,
  X,
  AlertCircle,
  CheckCircle2,
  Lock,
  ShieldCheck,
  FileCheck2,
  ClipboardCopy,
  StickyNote,
  History,
  RefreshCw,
  Upload,
  RotateCcw,
} from 'lucide-react';
import {
  AuthUser,
  CaseRecord,
  CaseStatus,
  CaseNoteCategory,
  SuspectIdentifier,
  NavSection,
  ComplaintRecord,
} from '../shared/types';
import { api, ApiError } from '../lib/api';
import { usePreferences } from '../lib/preferences';

const COMPLAINT_CATEGORIES = [
  'Online Financial Fraud',
  'SIM and Device Identity Misuse',
  'Cyber Harassment',
  'Phishing and Account Takeover',
  'Social Media Abuse / Impersonation',
  'Ransomware / Unauthorized Access',
  'Other Cyber Offence',
];

interface CasesPageProps {
  user: AuthUser;
  cases: CaseRecord[];
  complaints?: ComplaintRecord[];
  activeCaseId: string | null;
  openCreateModalTrigger: number;
  onSelectCase: (caseId: string) => void;
  onNavigate: (section: NavSection) => void;
  onRefreshCases: (selectId?: string) => Promise<void>;
}

export const CasesPage: React.FC<CasesPageProps> = ({
  user,
  cases,
  complaints = [],
  activeCaseId,
  openCreateModalTrigger,
  onSelectCase,
  onNavigate,
  onRefreshCases,
}) => {
  const { t } = usePreferences();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CaseStatus>('ALL');
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(activeCaseId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<CaseRecord | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [newlyCreatedComplaint, setNewlyCreatedComplaint] = useState<{
    complaintId: string;
    caseId: string;
    caseNumber: string;
    title: string;
  } | null>(null);
  const [copiedNewId, setCopiedNewId] = useState(false);

  // Exact Complaint ID lookup state (for Viewer)
  const [exactLookupResult, setExactLookupResult] = useState<{
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
  } | null>(null);
  const [exactLookupError, setExactLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Modal form fields
  const [existingComplaintId, setExistingComplaintId] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(COMPLAINT_CATEGORIES[0]);
  const [incidentDateTime, setIncidentDateTime] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [relevantPhoneNumber, setRelevantPhoneNumber] = useState('');
  const [supportingInfo, setSupportingInfo] = useState('');
  const [description, setDescription] = useState('');
  const [investigatorName, setInvestigatorName] = useState(user.name);
  const [status, setStatus] = useState<CaseStatus>('Active');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Standard'>('Medium');
  const [saving, setSaving] = useState(false);

  // Add suspect form inside Case Detail
  const [addingSuspect, setAddingSuspect] = useState(false);
  const [selectedInvestigator, setSelectedInvestigator] = useState<string>('');
  const [susLabel, setSusLabel] = useState('');
  const [susAlias, setSusAlias] = useState('');
  const [susPhone, setSusPhone] = useState('');
  const [susImei, setSusImei] = useState('');
  const [susOperator, setSusOperator] = useState('Airtel-Demo');

  // Evidence verification, Notes & Chain of Custody state
  const [verifyingDatasetId, setVerifyingDatasetId] = useState<string | null>(null);
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);
  const [noteCategory, setNoteCategory] = useState<CaseNoteCategory>('Observation');
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const isViewer = user.role === 'Viewer';
  const isAdmin = user.role === 'Administrator';
  // STRICT RBAC: ONLY Viewer creates cases/complaints
  const canCreateCases = user.role === 'Viewer';
  const canDeleteCases = user.role === 'Administrator';

  const canEditSpecificCase = (c: CaseRecord | null): boolean => {
    if (!c) return false;
    if (user.role === 'Viewer') return c.ownerUserId === user.id;
    if (user.role === 'Investigator') return user.assignedCaseIds.includes(c.id);
    if (user.role === 'Administrator') return true;
    return false;
  };

  React.useEffect(() => {
    if (openCreateModalTrigger > 0 && canCreateCases) {
      openCreateDialog();
    }
  }, [openCreateModalTrigger, canCreateCases]);

  React.useEffect(() => {
    if (activeCaseId) {
      setSelectedDetailId(activeCaseId);
    }
  }, [activeCaseId]);

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.caseNumber.toLowerCase().includes(q) ||
        (c.complaintId || '').toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q) ||
        c.investigator.toLowerCase().includes(q) ||
        c.suspects.some((s) => s.phoneNumber.toLowerCase().includes(q) || s.alias.toLowerCase().includes(q))
      );
    });
  }, [cases, search, statusFilter]);

  const detailCase = cases.find((c) => c.id === selectedDetailId) || cases[0] || null;
  const canEditDetail = canEditSpecificCase(detailCase);
  const canImportDetail = canEditDetail;
  const isMetadataRestricted = Boolean(detailCase?.restrictedMetadataOnly);

  const openCreateDialog = () => {
    if (!canCreateCases) return;
    setEditingCase(null);
    setExistingComplaintId('');
    setTitle('');
    setCategory(COMPLAINT_CATEGORIES[0]);
    setIncidentDateTime(new Date().toISOString().slice(0, 16));
    setRelevantPhoneNumber('');
    setSupportingInfo('');
    setDescription('');
    setPriority('Medium');
    setStatus('Active');
    setModalOpen(true);
  };

  const openEditDialog = (c: CaseRecord) => {
    if (!canEditSpecificCase(c)) {
      setFeedback({ type: 'error', message: 'You are not authorized to modify this case.' });
      return;
    }
    setEditingCase(c);
    setExistingComplaintId(c.complaintId || '');
    setTitle(c.title);
    setCategory(c.category || COMPLAINT_CATEGORIES[0]);
    setIncidentDateTime((c.incidentDateTime || new Date().toISOString()).slice(0, 16));
    setRelevantPhoneNumber(c.relevantPhoneNumber || '');
    setSupportingInfo(c.supportingInfo || '');
    setDescription(c.description);
    setInvestigatorName(c.investigator);
    setStatus(c.status);
    setPriority(c.priority);
    setModalOpen(true);
  };

  const handleSaveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCase ? !canEditSpecificCase(editingCase) : !canCreateCases) {
      setFeedback({ type: 'error', message: 'Unauthorized action for your role.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      if (editingCase) {
        await api.updateCase(editingCase.id, {
          title,
          description,
          category,
          incidentDateTime,
          relevantPhoneNumber,
          supportingInfo,
          priority,
          ...(user.role !== 'Viewer' ? { investigator: investigatorName, status } : {}),
        });
        await onRefreshCases(editingCase.id);
        setFeedback({ type: 'success', message: `Updated case ${editingCase.caseNumber}.` });
      } else {
        const res = await api.createComplaint({
          title,
          category,
          description,
          incidentDateTime: incidentDateTime ? new Date(incidentDateTime).toISOString() : undefined,
          relevantPhoneNumber: relevantPhoneNumber.trim() || undefined,
          supportingInfo: supportingInfo.trim() || undefined,
          priority,
          existingComplaintId: existingComplaintId.trim() || undefined,
        });
        await onRefreshCases(res.caseRecord.id);
        onSelectCase(res.caseRecord.id);
        setSelectedDetailId(res.caseRecord.id);
        setNewlyCreatedComplaint({
          complaintId: res.complaint.complaintId,
          caseId: res.caseRecord.id,
          caseNumber: res.caseRecord.caseNumber,
          title: res.caseRecord.title,
        });
        setFeedback({
          type: 'success',
          message: res.matchedExisting
            ? `Opened your existing complaint ${res.complaint.complaintId}.`
            : `Complaint registered! Your unique Complaint ID is ${res.complaint.complaintId}.`,
        });
      }
      setModalOpen(false);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Failed to save case.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCase = async (c: CaseRecord) => {
    if (!canDeleteCases) {
      setFeedback({ type: 'error', message: 'Only Administrators can delete cases.' });
      return;
    }
    setFeedback(null);
    try {
      await api.deleteCase(c.id);
      await onRefreshCases();
      setFeedback({ type: 'success', message: `Deleted case ${c.caseNumber}.` });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Delete failed.',
      });
    }
  };

  const handleExactLookup = async (idToLookUp: string) => {
    const cleanId = idToLookUp.trim();
    if (!cleanId) return;
    setIsLookingUp(true);
    setExactLookupError(null);
    try {
      const res = await api.trackComplaint(cleanId);
      setExactLookupResult(res);
      setFeedback({
        type: 'success',
        message: `Verified and loaded complaint ${res.complaint.complaintId}.`,
      });
    } catch (err) {
      setExactLookupResult(null);
      setExactLookupError(
        err instanceof ApiError
          ? err.message
          : 'Complaint not found. Please verify the exact Complaint ID and try again.'
      );
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleToggleCaseStatus = async (c: CaseRecord) => {
    const nextStatus: CaseStatus = c.status === 'Archived' ? 'Active' : 'Archived';
    setSaving(true);
    setFeedback(null);
    try {
      await api.updateCase(c.id, { status: nextStatus });
      await onRefreshCases(c.id);
      setFeedback({
        type: 'success',
        message:
          nextStatus === 'Archived'
            ? `Case ${c.caseNumber} has been closed/archived.`
            : `Case ${c.caseNumber} has been re-opened as Active.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Failed to update case lifecycle status.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReassignCase = async (caseId: string, investigatorName: string) => {
    setSaving(true);
    setFeedback(null);
    try {
      await api.updateCase(caseId, { investigator: investigatorName });
      await onRefreshCases(caseId);
      setFeedback({
        type: 'success',
        message: `Case re-assigned to Lead Investigator: ${investigatorName}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Failed to re-assign investigator.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddSuspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailCase || !canEditDetail || !susPhone.trim()) return;
    setFeedback(null);
    const nextSuspect: SuspectIdentifier = {
      id: `SUS-${Date.now().toString().slice(-4)}`,
      label: susLabel.trim() || `Contact ${detailCase.suspects.length + 1}`,
      alias: susAlias.trim() || 'Recorded Identifier',
      phoneNumber: susPhone.trim(),
      primaryImei: susImei.trim() || '',
      primaryImsi: '',
      operator: susOperator,
      notes: 'Added in Case Management.',
    };
    try {
      await api.updateCase(detailCase.id, {
        suspects: [...detailCase.suspects, nextSuspect],
      });
      await onRefreshCases(detailCase.id);
      setSusLabel('');
      setSusAlias('');
      setSusPhone('');
      setSusImei('');
      setAddingSuspect(false);
      setFeedback({ type: 'success', message: `Added ${nextSuspect.label} (${nextSuspect.phoneNumber}).` });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Unable to add identifier.',
      });
    }
  };

  const handleRemoveSuspect = async (suspectId: string) => {
    if (!detailCase || !canEditDetail) return;
    try {
      await api.updateCase(detailCase.id, {
        suspects: detailCase.suspects.filter((s) => s.id !== suspectId),
      });
      await onRefreshCases(detailCase.id);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Unable to remove identifier.',
      });
    }
  };

  const handleVerifyDatasetIntegrity = async (datasetId: string) => {
    if (!detailCase || !canEditDetail) return;
    setVerifyingDatasetId(datasetId);
    setFeedback(null);
    try {
      const res = await api.verifyDatasetIntegrity(detailCase.id, datasetId);
      await onRefreshCases(detailCase.id);
      setFeedback({
        type: res.verifiedMatch ? 'success' : 'error',
        message: res.verifiedMatch
          ? `SHA-256 verified for ${res.dataset.evidenceRefId} (${res.computedSha256.slice(0, 16)}…). Chain of custody updated.`
          : `SHA-256 mismatch detected for ${res.dataset.evidenceRefId}. Review custody log immediately.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Unable to verify file SHA-256 integrity.',
      });
    } finally {
      setVerifyingDatasetId(null);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedHashId(id);
    setTimeout(() => setCopiedHashId((cur) => (cur === id ? null : cur)), 1800);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailCase || !noteContent.trim() || !canEditDetail) return;
    setSavingNote(true);
    setFeedback(null);
    try {
      await api.addCaseNote(detailCase.id, {
        category: noteCategory,
        content: noteContent.trim(),
      });
      await onRefreshCases(detailCase.id);
      setNoteContent('');
      setFeedback({ type: 'success', message: `Added ${noteCategory} note to ${detailCase.caseNumber}.` });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Unable to save note.',
      });
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!detailCase || !canEditDetail) return;
    try {
      await api.deleteCaseNote(detailCase.id, noteId);
      await onRefreshCases(detailCase.id);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Unable to remove note.',
      });
    }
  };

  const localizeCaseStatus = (st: CaseStatus) => {
    if (st === 'Active') return t('common.active');
    if (st === 'Under Review') return t('common.underReview');
    return t('common.archived');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {isViewer
              ? 'My Personal Cases & Demo Case Studies'
              : isAdmin
              ? 'Case Registry (Governance View)'
              : 'Assigned Investigation Cases'}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-1">
            {isViewer
              ? 'Create and submit personal complaints, explore the 5 demo case studies, or view any complaint by entering its exact Complaint ID.'
              : isAdmin
              ? 'Review system case registry metadata and assign Investigators via Settings.'
              : 'Analyze and document cases explicitly assigned to your investigator profile.'}
          </p>
        </div>

        {/* STRICT RBAC: Create Case / Complaint button is ONLY shown for Viewer */}
        {canCreateCases && (
          <button
            type="button"
            onClick={openCreateDialog}
            className="h-9 px-4 text-xs font-medium bg-[#17243B] hover:bg-[#101A30] dark:bg-[#C5A66A] dark:hover:bg-[#d2b57c] dark:text-[#101A30] text-white rounded flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-[#C5A66A] dark:text-[#101A30]" />
            Create Complaint / Case
          </button>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="h-9 px-4 text-xs font-medium bg-white dark:bg-[#17243B] border border-[#CBD2DE] dark:border-[#2A3F63] text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D] rounded flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <ShieldCheck className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A]" />
            Assign Investigators
          </button>
        )}
      </div>

      {/* Newly Created Complaint ID Confirmation Card (Viewer) */}
      {newlyCreatedComplaint && isViewer && (
        <div className="p-4 rounded border border-emerald-300 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-[#16A34A] dark:text-[#4ADE80]" />
              <span>Personal Complaint Registered &amp; Persisted</span>
            </div>
            <button
              type="button"
              onClick={() => setNewlyCreatedComplaint(null)}
              className="text-[#64748B] hover:text-[#17243B] dark:hover:text-white"
              aria-label="Dismiss confirmation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded bg-white dark:bg-[#101A30] border border-[#DCE3EE] dark:border-[#243656]">
            <div>
              <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                Unique Complaint ID (save this to track your complaint anytime)
              </p>
              <p className="text-base font-mono font-bold tracking-wide text-[#101A30] dark:text-[#C5A66A] mt-0.5">
                {newlyCreatedComplaint.complaintId}
              </p>
              <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1] mt-0.5">
                Linked Case: <span className="font-mono">{newlyCreatedComplaint.caseNumber}</span> —{' '}
                {newlyCreatedComplaint.title}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(newlyCreatedComplaint.complaintId).catch(() => {});
                  }
                  setCopiedNewId(true);
                  setTimeout(() => setCopiedNewId(false), 2000);
                }}
                className="h-8 px-3 rounded border border-[#CBD2DE] dark:border-[#2A3F63] text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D] inline-flex items-center gap-1.5 font-medium"
              >
                <ClipboardCopy className="w-3.5 h-3.5" />
                {copiedNewId ? 'Copied!' : 'Copy Complaint ID'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectCase(newlyCreatedComplaint.caseId);
                  onNavigate('import');
                }}
                className="h-8 px-3 rounded bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] inline-flex items-center gap-1.5 font-medium"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload CDR / IPDR
              </button>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`p-3 rounded border text-xs flex items-center gap-2 ${
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
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-lg flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8993A5] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim().length >= 4) {
                  e.preventDefault();
                  handleExactLookup(search);
                }
              }}
              placeholder={
                isViewer
                  ? 'Search my cases & demo studies, or enter exact ID to lookup...'
                  : t('cases.searchPlaceholder')
              }
              className="w-full h-9 pl-9 pr-3 text-xs bg-[#F5F7FA] dark:bg-[#101A30] border border-[#DCE1EA] dark:border-[#243656] text-[#17243B] dark:text-[#F4F5F7] placeholder:text-[#8993A5] rounded focus:outline-none focus:bg-white dark:focus:bg-[#101A30] focus:border-[#17243B] dark:focus:border-[#C5A66A]"
            />
          </div>
          {isViewer && (
            <button
              type="button"
              disabled={isLookingUp || !search.trim()}
              onClick={() => handleExactLookup(search)}
              className="h-9 px-3 text-xs font-medium bg-[#101A30] dark:bg-[#C5A66A] hover:bg-[#17243B] dark:hover:bg-[#d3b67c] text-white dark:text-[#101A30] rounded disabled:opacity-40 transition-colors shrink-0 whitespace-nowrap"
            >
              {isLookingUp ? 'Searching…' : 'Lookup Exact ID'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 p-1 bg-[#F5F7FA] dark:bg-[#101A30] rounded border border-[#E2E7EF] dark:border-[#243656] overflow-x-auto">
          {(['ALL', 'Active', 'Under Review', 'Archived'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-white dark:bg-[#1F3150] text-[#17243B] dark:text-[#F4F5F7] shadow-xs'
                  : 'text-[#64748B] dark:text-[#8993A5] hover:text-[#17243B] dark:hover:text-[#F4F5F7]'
              }`}
            >
              {st === 'ALL' ? t('cases.allCases') : localizeCaseStatus(st)}
            </button>
          ))}
        </div>
      </div>

      {exactLookupError && (
        <div
          role="alert"
          className="p-3.5 rounded border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs text-[#DC2626] dark:text-[#F87171] flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{exactLookupError}</span>
          </div>
          <button
            type="button"
            onClick={() => setExactLookupError(null)}
            className="text-[#64748B] hover:text-[#17243B] dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {exactLookupResult && (
        <div className="p-4 rounded border border-[#C5A66A]/60 bg-amber-50/50 dark:bg-[#132036] space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A]" />
              <span className="font-mono font-bold text-sm text-[#17243B] dark:text-[#C5A66A]">
                {exactLookupResult.complaint.complaintId}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white dark:bg-[#17243B] border border-[#CBD2DE] dark:border-[#2A3F63] text-[#17243B] dark:text-[#F4F5F7]">
                Status: {exactLookupResult.complaint.status}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                EXACT ID VERIFIED
              </span>
            </div>
            <div className="flex items-center gap-2">
              {exactLookupResult.caseRecord && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectCase(exactLookupResult.caseRecord!.id);
                    setSelectedDetailId(exactLookupResult.caseRecord!.id);
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded inline-flex items-center gap-1"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  View Case Workspace
                </button>
              )}
              <button
                type="button"
                onClick={() => setExactLookupResult(null)}
                className="text-[#64748B] hover:text-[#17243B] dark:hover:text-white"
                aria-label="Dismiss lookup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <p className="font-semibold text-sm text-[#17243B] dark:text-[#F4F5F7]">
              {exactLookupResult.complaint.title}
            </p>
            <p className="text-[#475569] dark:text-[#CBD5E1] mt-0.5 leading-relaxed">
              {exactLookupResult.complaint.description}
            </p>
            <p className="text-[11px] text-[#64748B] dark:text-[#9AA6BA] mt-1">
              Category: {exactLookupResult.complaint.category} · Incident Date:{' '}
              {exactLookupResult.complaint.incidentDateTime.slice(0, 16).replace('T', ' ')}
              {exactLookupResult.complaint.relevantPhoneNumber
                ? ` · Contact Phone: ${exactLookupResult.complaint.relevantPhoneNumber}`
                : ''}
            </p>
          </div>
          {exactLookupResult.complaint.statusUpdates.length > 0 && (
            <div className="pt-2 border-t border-[#CBD2DE]/60 dark:border-[#243656] space-y-1.5">
              <p className="text-[11px] font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                Official Complaint Timeline
              </p>
              {exactLookupResult.complaint.statusUpdates.map((upd, idx) => (
                <div key={idx} className="flex items-start justify-between gap-2 text-[11px]">
                  <span className="text-[#334155] dark:text-[#CBD5E1]">
                    <strong className="text-[#A88748] dark:text-[#C5A66A]">{upd.status}:</strong>{' '}
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

      {/* Cases Table */}
      <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2E7EF] dark:border-[#243656] bg-[#F8F9FB] dark:bg-[#132036] text-[11px] font-semibold text-[#64748B] dark:text-[#8993A5]">
              <th className="py-3 px-4">{isViewer ? 'Complaint / Case ID' : t('cases.colCaseId')}</th>
              <th className="py-3 px-4">{t('cases.colTitle')}</th>
              <th className="py-3 px-4">{isViewer ? 'Category' : t('cases.colInvestigator')}</th>
              <th className="py-3 px-4">{t('cases.colCreated')}</th>
              <th className="py-3 px-4">{t('cases.colStatus')}</th>
              <th className="py-3 px-4 text-right">{t('cases.colSuspects')}</th>
              <th className="py-3 px-4 text-right">{t('cases.colDatasets')}</th>
              <th className="py-3 px-4 text-right">{t('cases.colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ECEFF4] dark:divide-[#243656] text-xs">
            {filteredCases.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#64748B] dark:text-[#8993A5]">
                  {isViewer && cases.length === 0
                    ? 'You have no personal cases yet. Click "Create Complaint / Case" above to create your first case.'
                    : t('cases.noMatch')}
                </td>
              </tr>
            ) : (
              filteredCases.map((c) => {
                const isSelected = detailCase?.id === c.id;
                const isActive = activeCaseId === c.id;
                const canEditRow = canEditSpecificCase(c);
                const linkedCmp = complaints.find((cmp) => cmp.caseId === c.id);
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedDetailId(c.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#F1F5F9] dark:bg-[#1D2D49]'
                        : 'hover:bg-[#F8F9FB] dark:hover:bg-[#1A2A45]'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7] whitespace-nowrap">
                      {c.complaintId ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#A88748] dark:text-[#C5A66A]">{c.complaintId}</span>
                            <button
                              type="button"
                              title="Copy Complaint ID"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyText(`cmp-${c.id}`, c.complaintId!);
                              }}
                              className="text-[#64748B] hover:text-[#17243B] dark:hover:text-white"
                            >
                              <ClipboardCopy className="w-3 h-3" />
                            </button>
                            {copiedHashId === `cmp-${c.id}` && (
                              <span className="text-[10px] font-sans text-emerald-600 dark:text-emerald-400">
                                Copied
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-normal text-[#64748B] dark:text-[#8993A5]">
                              {c.caseNumber}
                            </span>
                            {c.isSyntheticDemo ? (
                              <span className="px-1 py-0.2 text-[9px] font-sans font-semibold rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300">
                                DEMO STUDY
                              </span>
                            ) : (
                              <span className="px-1 py-0.2 text-[9px] font-sans font-semibold rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300">
                                MY COMPLAINT
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          {c.caseNumber}
                          {isActive && (
                            <span className="ml-2 text-[10px] font-sans font-semibold text-[#A88748] dark:text-[#C5A66A]">
                              · {t('common.active')}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#17243B] dark:text-[#F4F5F7] max-w-xs truncate">
                      {c.title}
                    </td>
                    <td className="py-3 px-4 text-[#475569] dark:text-[#CBD5E1] whitespace-nowrap">
                      {isViewer ? c.category || 'Personal Complaint' : c.investigator}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[#64748B] dark:text-[#8993A5] whitespace-nowrap">
                      {c.createdDate}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          c.status === 'Active'
                            ? 'text-[#16A34A] dark:text-[#22C55E]'
                            : c.status === 'Under Review'
                            ? 'text-[#EA580C] dark:text-[#F97316]'
                            : 'text-[#64748B] dark:text-[#8993A5]'
                        }`}
                      >
                        {linkedCmp ? linkedCmp.status : localizeCaseStatus(c.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
                      {c.restrictedMetadataOnly ? '—' : c.suspects.length}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
                      {c.datasets.length}
                    </td>
                    <td
                      className="py-3 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        {!c.restrictedMetadataOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectCase(c.id);
                              onNavigate('overview');
                            }}
                            className="px-2 py-1 text-[11px] font-medium bg-[#17243B] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded hover:bg-[#101A30] dark:hover:bg-[#d2b57c] inline-flex items-center gap-1"
                          >
                            <FolderOpen className="w-3 h-3" />
                            {t('cases.analyze')}
                          </button>
                        )}
                        {canEditRow && (
                          <button
                            type="button"
                            onClick={() => openEditDialog(c)}
                            aria-label={`Edit ${c.caseNumber}`}
                            className="p-1.5 text-[#475569] dark:text-[#CBD5E1] hover:text-[#17243B] dark:hover:text-[#F4F5F7] border border-[#DCE1EA] dark:border-[#243656] rounded bg-white dark:bg-[#101A30]"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteCases && cases.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCase(c)}
                            aria-label={`Delete ${c.caseNumber}`}
                            className="p-1.5 text-[#DC2626] dark:text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/40 border border-[#DCE1EA] dark:border-[#243656] rounded bg-white dark:bg-[#101A30]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Selected Case Detail Workspace */}
      {detailCase && (
        <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-5 border-b border-[#ECEFF4] dark:border-[#243656]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-mono text-[#64748B] dark:text-[#8993A5]">
                  {detailCase.complaintId ? `${detailCase.complaintId} · ` : ''}
                  {detailCase.caseNumber} · {t('cases.colCreated')} {detailCase.createdDate} ·{' '}
                  {detailCase.category ? `${detailCase.category} · ` : ''}
                  {t('cases.colInvestigator')}: {detailCase.investigator}
                </p>
                {detailCase.isSyntheticDemo ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300">
                    OFFICIAL DEMO STUDY
                  </span>
                ) : isViewer ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300">
                    MY PERSONAL COMPLAINT
                  </span>
                ) : null}
              </div>
              <h2 className="text-lg font-semibold text-[#17243B] dark:text-[#F4F5F7] mt-1">
                {detailCase.title}
              </h2>
              <p className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-2 max-w-3xl leading-relaxed">
                {detailCase.description || t('cases.noNarrative')}
              </p>
              {detailCase.relevantPhoneNumber && (
                <p className="text-[11px] font-mono text-[#64748B] dark:text-[#9AA6BA] mt-1.5">
                  Reported Number: {detailCase.relevantPhoneNumber}
                  {detailCase.incidentDateTime
                    ? ` · Incident Time: ${detailCase.incidentDateTime.slice(0, 16).replace('T', ' ')}`
                    : ''}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {canImportDetail && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectCase(detailCase.id);
                    onNavigate('import');
                  }}
                  className="h-9 px-3.5 text-xs font-medium border border-[#CBD2DE] dark:border-[#2D4063] rounded text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2F4C]"
                >
                  {t('cases.importFiles')}
                </button>
              )}
              {!isMetadataRestricted && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectCase(detailCase.id);
                    onNavigate('cdr');
                  }}
                  className="h-9 px-3.5 text-xs font-medium bg-[#17243B] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded hover:bg-[#101A30] dark:hover:bg-[#d2b57c]"
                >
                  {t('cases.openCdr')}
                </button>
              )}
            </div>
          </div>

          {/* Administrator Case Management & Investigation Review Toolbar */}
          {isAdmin && (
            <div className="p-4 rounded-lg border border-[#C5A66A]/60 bg-[#F7F2E7]/40 dark:bg-[#131F35] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E2E7EF] dark:border-[#243656]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A]" />
                  <span className="font-semibold text-xs text-[#17243B] dark:text-[#F4F5F7]">
                    Administrator Investigation Controls &amp; Case Lifecycle
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                      detailCase.status === 'Active'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                        : detailCase.status === 'Under Review'
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    STATUS: {detailCase.status.toUpperCase()}
                  </span>
                </div>
                {/* Close / Re-open Button */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleCaseStatus(detailCase)}
                    disabled={saving}
                    className={`h-8 px-3 text-xs font-medium rounded inline-flex items-center gap-1.5 transition-colors ${
                      detailCase.status === 'Archived'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-red-700 hover:bg-red-800 text-white'
                    }`}
                  >
                    {detailCase.status === 'Archived' ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        Re-open Case
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        Close Case
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Assign / Re-assign Investigator + Quick Investigation Tabs */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[#64748B] dark:text-[#8993A5] font-medium">Lead IO:</span>
                  <span className="font-semibold text-[#17243B] dark:text-[#F4F5F7] font-mono">
                    {detailCase.investigator}
                  </span>
                  <div className="inline-flex items-center gap-1.5 ml-2">
                    <select
                      value={selectedInvestigator || detailCase.investigator}
                      onChange={(e) => setSelectedInvestigator(e.target.value)}
                      className="h-8 px-2.5 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] rounded text-[#17243B] dark:text-[#F4F5F7] text-xs font-mono"
                    >
                      <option value="R. Verma">R. Verma (INV-14 · Telecom Unit)</option>
                      <option value="K. Deshmukh">K. Deshmukh (INV-22 · Financial Desk)</option>
                      <option value="M. Rathore">M. Rathore (ADM-01 · Governance Desk)</option>
                      <option value="Pending Assignment">Pending Assignment</option>
                    </select>
                    <button
                      type="button"
                      disabled={saving || (selectedInvestigator === detailCase.investigator && !selectedInvestigator)}
                      onClick={() => handleReassignCase(detailCase.id, selectedInvestigator || detailCase.investigator)}
                      className="h-8 px-3 bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] font-medium rounded hover:bg-[#17243B] dark:hover:bg-[#d3b67c] disabled:opacity-50"
                    >
                      Re-assign
                    </button>
                  </div>
                </div>

                {/* Direct Investigation Tab Review Shortcuts */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-[#64748B] dark:text-[#8993A5] mr-1">Review Tabs:</span>
                  <button
                    type="button"
                    onClick={() => { onSelectCase(detailCase.id); onNavigate('cdr'); }}
                    className="h-7 px-2.5 text-[11px] font-medium border border-[#CBD2DE] dark:border-[#2D4063] rounded hover:bg-white dark:hover:bg-[#101A30] text-[#17243B] dark:text-[#F4F5F7]"
                  >
                    CDR
                  </button>
                  <button
                    type="button"
                    onClick={() => { onSelectCase(detailCase.id); onNavigate('ipdr'); }}
                    className="h-7 px-2.5 text-[11px] font-medium border border-[#CBD2DE] dark:border-[#2D4063] rounded hover:bg-white dark:hover:bg-[#101A30] text-[#17243B] dark:text-[#F4F5F7]"
                  >
                    IPDR
                  </button>
                  <button
                    type="button"
                    onClick={() => { onSelectCase(detailCase.id); onNavigate('towers'); }}
                    className="h-7 px-2.5 text-[11px] font-medium border border-[#CBD2DE] dark:border-[#2D4063] rounded hover:bg-white dark:hover:bg-[#101A30] text-[#17243B] dark:text-[#F4F5F7]"
                  >
                    Tower Location
                  </button>
                  <button
                    type="button"
                    onClick={() => { onSelectCase(detailCase.id); onNavigate('imei'); }}
                    className="h-7 px-2.5 text-[11px] font-medium border border-[#CBD2DE] dark:border-[#2D4063] rounded hover:bg-white dark:hover:bg-[#101A30] text-[#17243B] dark:text-[#F4F5F7]"
                  >
                    IMEI
                  </button>
                  <button
                    type="button"
                    onClick={() => { onSelectCase(detailCase.id); onNavigate('network'); }}
                    className="h-7 px-2.5 text-[11px] font-medium border border-[#CBD2DE] dark:border-[#2D4063] rounded hover:bg-white dark:hover:bg-[#101A30] text-[#17243B] dark:text-[#F4F5F7]"
                  >
                    Contact Network
                  </button>
                  <button
                    type="button"
                    onClick={() => { onSelectCase(detailCase.id); onNavigate('ai'); }}
                    className="h-7 px-2.5 text-[11px] font-medium border border-[#CBD2DE] dark:border-[#2D4063] rounded hover:bg-white dark:hover:bg-[#101A30] text-[#17243B] dark:text-[#F4F5F7]"
                  >
                    Assessment
                  </button>
                  <button
                    type="button"
                    onClick={() => { onSelectCase(detailCase.id); onNavigate('reports'); }}
                    className="h-7 px-2.5 text-[11px] font-medium bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded"
                  >
                    Centralized Report
                  </button>
                </div>
              </div>
            </div>
          )}

          {isMetadataRestricted ? (
            <div className="p-4 rounded border border-[#DCE3EE] dark:border-[#243656] bg-[#F8F9FB] dark:bg-[#101A30] text-xs text-[#475569] dark:text-[#CBD5E1] flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  Sensitive Case Evidence Protected Under Governance Policy
                </p>
                <p className="mt-0.5 leading-relaxed">
                  Suspect identifiers, CDR/IPDR rows, investigator notes, and AI queries are hidden from default Administrator metadata views. Assign an Investigator in Settings to analyze this case.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Suspect / Reported Identifiers */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                      {t('cases.suspectIdsTitle', { count: detailCase.suspects.length })}
                    </h3>
                    <p className="text-xs text-[#64748B] dark:text-[#8993A5]">
                      {t('cases.suspectIdsSub')}
                    </p>
                  </div>
                  {canEditDetail && (
                    <button
                      type="button"
                      onClick={() => setAddingSuspect((v) => !v)}
                      className="h-8 px-3 text-xs font-medium border border-[#CBD2DE] dark:border-[#2D4063] rounded text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2F4C] flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {t('cases.addSuspect')}
                    </button>
                  )}
                </div>

                {addingSuspect && canEditDetail && (
                  <form
                    onSubmit={handleAddSuspect}
                    className="mb-4 p-4 bg-[#F8F9FB] dark:bg-[#132036] border border-[#DCE1EA] dark:border-[#243656] rounded grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
                  >
                    <input
                      type="text"
                      required
                      value={susLabel}
                      onChange={(e) => setSusLabel(e.target.value)}
                      placeholder="Label (e.g. Reported Number)"
                      className="h-9 px-2.5 text-xs bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded"
                    />
                    <input
                      type="text"
                      required
                      value={susAlias}
                      onChange={(e) => setSusAlias(e.target.value)}
                      placeholder="Alias / Description"
                      className="h-9 px-2.5 text-xs bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded"
                    />
                    <input
                      type="text"
                      required
                      value={susPhone}
                      onChange={(e) => setSusPhone(e.target.value)}
                      placeholder="+91-98xxx-xxxxx"
                      className="h-9 px-2.5 text-xs font-mono bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded"
                    />
                    <input
                      type="text"
                      value={susImei}
                      onChange={(e) => setSusImei(e.target.value)}
                      placeholder="15-digit IMEI (optional)"
                      className="h-9 px-2.5 text-xs font-mono bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={susOperator}
                        onChange={(e) => setSusOperator(e.target.value)}
                        className="h-9 px-2 text-xs bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded flex-1"
                      >
                        <option>Airtel-Demo</option>
                        <option>Jio-Demo</option>
                        <option>Vi-Demo</option>
                        <option>BSNL-Demo</option>
                      </select>
                      <button
                        type="submit"
                        className="h-9 px-3 text-xs font-medium bg-[#17243B] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded"
                      >
                        {t('common.save')}
                      </button>
                    </div>
                  </form>
                )}

                <div className="border border-[#ECEFF4] dark:border-[#243656] rounded overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F8F9FB] dark:bg-[#132036] border-b border-[#ECEFF4] dark:border-[#243656] text-[11px] text-[#64748B] dark:text-[#8993A5]">
                        <th className="py-2.5 px-4">{t('cases.colLabel')}</th>
                        <th className="py-2.5 px-4">{t('cases.colAlias')}</th>
                        <th className="py-2.5 px-4">{t('overview.colPhone')}</th>
                        <th className="py-2.5 px-4">{t('cases.colPrimaryImei')}</th>
                        <th className="py-2.5 px-4">{t('cases.colOperator')}</th>
                        <th className="py-2.5 px-4">{t('cases.colNotes')}</th>
                        {canEditDetail && (
                          <th className="py-2.5 px-4 text-right">{t('common.remove')}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECEFF4] dark:divide-[#243656]">
                      {detailCase.suspects.length === 0 ? (
                        <tr>
                          <td colSpan={canEditDetail ? 7 : 6} className="py-6 text-center text-[#64748B] dark:text-[#8993A5]">
                            {t('cases.noSuspects')}
                          </td>
                        </tr>
                      ) : (
                        detailCase.suspects.map((s) => (
                          <tr key={s.id} className="hover:bg-[#F8F9FB] dark:hover:bg-[#1A2A45]">
                            <td className="py-2.5 px-4 font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                              {s.label}
                            </td>
                            <td className="py-2.5 px-4 text-[#334155] dark:text-[#CBD5E1]">{s.alias}</td>
                            <td className="py-2.5 px-4 font-mono tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
                              {s.phoneNumber}
                            </td>
                            <td className="py-2.5 px-4 font-mono tabular-nums text-[#475569] dark:text-[#CBD5E1]">
                              {s.primaryImei || '—'}
                            </td>
                            <td className="py-2.5 px-4 text-[#475569] dark:text-[#CBD5E1]">
                              {s.operator}
                            </td>
                            <td className="py-2.5 px-4 text-[#64748B] dark:text-[#8993A5] max-w-xs">
                              {s.notes}
                            </td>
                            {canEditDetail && (
                              <td className="py-2.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSuspect(s.id)}
                                  className="text-[#DC2626] dark:text-[#EF4444] hover:underline"
                                >
                                  {t('common.remove')}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Associated Evidence Files & SHA-256 Integrity Verification */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7] flex items-center gap-1.5">
                      <FileCheck2 className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A]" />
                      {t('cases.associatedDatasets', { count: detailCase.datasets.length })} &amp; Evidence Integrity
                    </h3>
                    <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
                      Each dataset is assigned an Evidence Reference ID and canonical SHA-256 digest.
                    </p>
                  </div>
                </div>
                <div className="border border-[#ECEFF4] dark:border-[#243656] rounded overflow-x-auto">
                  {detailCase.datasets.length === 0 ? (
                    <p className="p-4 text-xs text-[#64748B] dark:text-[#8993A5]">
                      {t('cases.noDatasetsYet')}
                    </p>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F8F9FB] dark:bg-[#132036] border-b border-[#ECEFF4] dark:border-[#243656] text-[11px] text-[#64748B] dark:text-[#8993A5]">
                          <th className="py-2.5 px-4">Evidence Ref</th>
                          <th className="py-2.5 px-4">File &amp; Schema</th>
                          <th className="py-2.5 px-4 text-right">Rows</th>
                          <th className="py-2.5 px-4">SHA-256 Digest</th>
                          <th className="py-2.5 px-4">Integrity Status</th>
                          <th className="py-2.5 px-4 text-right">Verification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECEFF4] dark:divide-[#243656]">
                        {detailCase.datasets.map((ds) => {
                          const isVerifying = verifyingDatasetId === ds.id;
                          return (
                            <tr key={ds.id} className="hover:bg-[#F8F9FB] dark:hover:bg-[#1A2A45]">
                              <td className="py-2.5 px-4 font-mono font-semibold text-[#17243B] dark:text-[#C5A66A] whitespace-nowrap">
                                {ds.evidenceRefId || ds.id}
                              </td>
                              <td className="py-2.5 px-4">
                                <p className="font-mono font-medium text-[#17243B] dark:text-[#F4F5F7]">
                                  {ds.fileName}
                                </p>
                                <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                                  {ds.fileType} · {ds.schemaFormat} · {ds.uploadedBy} ({ds.uploadedAt.slice(0, 10)})
                                </p>
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#17243B] dark:text-[#F4F5F7] whitespace-nowrap">
                                {ds.recordCount.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-4 font-mono text-[11px] text-[#475569] dark:text-[#CBD5E1] whitespace-nowrap">
                                {ds.sha256Hash ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <span title={ds.sha256Hash}>
                                      {ds.sha256Hash.slice(0, 14)}…{ds.sha256Hash.slice(-6)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(ds.id, ds.sha256Hash)}
                                      title="Copy full SHA-256 digest"
                                      className="p-1 text-[#64748B] hover:text-[#17243B] dark:hover:text-[#F4F5F7]"
                                    >
                                      <ClipboardCopy className="w-3.5 h-3.5" />
                                    </button>
                                    {copiedHashId === ds.id && (
                                      <span className="text-[10px] text-[#16A34A] dark:text-[#4ADE80]">Copied</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-[#8993A5]">Pending digest</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 whitespace-nowrap">
                                <p
                                  className={`font-semibold ${
                                    ds.integrityStatus === 'Verified'
                                      ? 'text-[#16A34A] dark:text-[#4ADE80]'
                                      : ds.integrityStatus === 'Mismatch'
                                      ? 'text-[#DC2626] dark:text-[#F87171]'
                                      : 'text-[#B45309] dark:text-[#F59E0B]'
                                  }`}
                                >
                                  {ds.integrityStatus}
                                </p>
                                {ds.lastVerifiedAt && ds.lastVerifiedBy && (
                                  <p className="text-[10px] font-mono text-[#64748B] dark:text-[#8993A5]">
                                    {ds.lastVerifiedBy} · {ds.lastVerifiedAt.slice(0, 16).replace('T', ' ')} UTC
                                  </p>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                {canEditDetail ? (
                                  <button
                                    type="button"
                                    disabled={isVerifying}
                                    onClick={() => handleVerifyDatasetIntegrity(ds.id)}
                                    className="h-7 px-2.5 text-[11px] font-medium bg-white dark:bg-[#101A30] hover:bg-[#F5F5F2] dark:hover:bg-[#1E2F4C] text-[#17243B] dark:text-[#F4F5F7] border border-[#CBD2DE] dark:border-[#2D4063] rounded inline-flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    {isVerifying ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <ShieldCheck className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />
                                    )}
                                    {ds.integrityStatus === 'Verified' ? 'Re-Verify' : 'Verify SHA-256'}
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-[#8993A5] inline-flex items-center gap-1">
                                    <Lock className="w-3 h-3" /> Read-only
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Investigation Notes & Chain of Custody Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7] flex items-center gap-1.5">
                      <StickyNote className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A]" />
                      Case Notes ({detailCase.notes?.length || 0})
                    </h3>
                    <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
                      Timestamped observations, verification leads, and custody remarks included in case reports.
                    </p>
                  </div>

                  {canEditDetail && (
                    <form
                      onSubmit={handleAddNote}
                      className="p-3.5 bg-[#F8F8F6] dark:bg-[#132036] border border-[#DCE1EA] dark:border-[#243656] rounded space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="font-medium text-[#334155] dark:text-[#CBD5E1]">
                          Add Case Note
                        </label>
                        <select
                          value={noteCategory}
                          onChange={(e) => setNoteCategory(e.target.value as CaseNoteCategory)}
                          className="h-7 px-2 text-xs bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded"
                        >
                          <option value="Observation">Observation</option>
                          <option value="Lead">Lead</option>
                          <option value="Verification">Verification</option>
                          <option value="Custody">Custody</option>
                        </select>
                      </div>
                      <textarea
                        rows={2}
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Record observations, supporting details, or custody remarks..."
                        className="w-full p-2.5 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] placeholder:text-[#8993A5] rounded resize-none"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={savingNote || noteContent.trim().length < 3}
                          className="h-8 px-3.5 text-xs font-medium bg-[#17243B] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded hover:opacity-90 disabled:opacity-50"
                        >
                          {savingNote ? 'Saving…' : 'Save Note'}
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="border border-[#ECEFF4] dark:border-[#243656] rounded divide-y divide-[#ECEFF4] dark:divide-[#243656] max-h-72 overflow-y-auto text-xs">
                    {!detailCase.notes || detailCase.notes.length === 0 ? (
                      <p className="p-4 text-[#64748B] dark:text-[#8993A5]">
                        No notes recorded for this case yet.
                      </p>
                    ) : (
                      detailCase.notes.map((n) => (
                        <div key={n.id} className="p-3.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                              {n.authorName}{' '}
                              <span className="font-normal text-[#64748B] dark:text-[#8993A5]">
                                ({n.authorRole})
                              </span>{' '}
                              ·{' '}
                              <span className="font-mono text-[11px] text-[#A88748] dark:text-[#C5A66A]">
                                {n.category}
                              </span>
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-[11px] text-[#8993A5] tabular-nums">
                                {n.createdAt.slice(0, 16).replace('T', ' ')} UTC
                              </span>
                              {canEditDetail && (user.role === 'Administrator' || n.authorId === user.id) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNote(n.id)}
                                  aria-label="Delete note"
                                  className="text-[#8993A5] hover:text-[#DC2626] dark:hover:text-[#EF4444]"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-[#334155] dark:text-[#CBD5E1] leading-relaxed">{n.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7] flex items-center gap-1.5">
                      <History className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A]" />
                      Chain of Custody History ({detailCase.custodyLog?.length || 0})
                    </h3>
                    <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
                      Chronological log of evidence ingestion, SHA-256 checks, and report exports.
                    </p>
                  </div>
                  <div className="border border-[#ECEFF4] dark:border-[#243656] rounded divide-y divide-[#ECEFF4] dark:divide-[#243656] max-h-96 overflow-y-auto text-xs">
                    {!detailCase.custodyLog || detailCase.custodyLog.length === 0 ? (
                      <p className="p-4 text-[#64748B] dark:text-[#8993A5]">
                        No chain-of-custody entries recorded yet.
                      </p>
                    ) : (
                      detailCase.custodyLog.map((entry) => (
                        <div key={entry.id} className="p-3.5 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                              {entry.evidenceRefId} ·{' '}
                              <span
                                className={
                                  entry.action === 'INTEGRITY_VERIFIED'
                                    ? 'text-[#16A34A] dark:text-[#4ADE80]'
                                    : entry.action === 'INTEGRITY_MISMATCH'
                                    ? 'text-[#DC2626] dark:text-[#F87171]'
                                    : 'text-[#A88748] dark:text-[#C5A66A]'
                                }
                              >
                                {entry.action}
                              </span>
                            </span>
                            <span className="font-mono text-[11px] text-[#8993A5] tabular-nums shrink-0">
                              {entry.timestamp.slice(0, 16).replace('T', ' ')} UTC
                            </span>
                          </div>
                          <p className="text-[#334155] dark:text-[#CBD5E1]">{entry.notes}</p>
                          <p className="font-mono text-[10px] text-[#64748B] dark:text-[#8993A5]">
                            Actor: {entry.actorName} ({entry.actorRole}) · File: {entry.fileName}
                            {entry.sha256Hash ? ` · SHA-256: ${entry.sha256Hash.slice(0, 14)}…` : ''}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* Viewer Create Complaint/Case Modal OR Authorized Edit Case Modal */}
      {modalOpen && (editingCase ? canEditSpecificCase(editingCase) : canCreateCases) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#101A30]/60 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-[#17243B] border border-[#DCE1EA] dark:border-[#243656] rounded w-full max-w-xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#ECEFF4] dark:border-[#243656] flex items-center justify-between sticky top-0 bg-white dark:bg-[#17243B]">
              <h3 className="text-base font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {editingCase
                  ? `Edit Case ${editingCase.caseNumber}`
                  : 'Create Personal Complaint / Case'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-[#64748B] dark:text-[#8993A5] hover:text-[#17243B] dark:hover:text-[#F4F5F7]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCase} className="p-6 space-y-4 text-xs">
              {!editingCase && (
                <div className="p-3 rounded bg-[#F8F9FB] dark:bg-[#101A30] border border-[#DCE3EE] dark:border-[#243656] text-[11px] text-[#475569] dark:text-[#CBD5E1]">
                  A unique <span className="font-mono font-semibold text-[#A88748] dark:text-[#C5A66A]">TRACE-CMP-2026-XXXXXX</span> Complaint ID will be generated automatically and bound exclusively to your account.
                </div>
              )}

              <div>
                <label className="block font-medium text-[#334155] dark:text-[#CBD5E1] mb-1">
                  Case / Complaint Title *
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Unauthorized UPI Debit & Impersonation Call"
                  className="w-full h-9 px-3 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-[#334155] dark:text-[#CBD5E1] mb-1">
                    Complaint Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-9 px-3 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded"
                  >
                    {COMPLAINT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-[#334155] dark:text-[#CBD5E1] mb-1">
                    Incident Date &amp; Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={incidentDateTime}
                    onChange={(e) => setIncidentDateTime(e.target.value)}
                    className="w-full h-9 px-3 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-[#334155] dark:text-[#CBD5E1] mb-1">
                    Relevant Phone Number
                  </label>
                  <input
                    type="text"
                    value={relevantPhoneNumber}
                    onChange={(e) => setRelevantPhoneNumber(e.target.value)}
                    placeholder="+91-98xxx-xxxxx"
                    className="w-full h-9 px-3 font-mono bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#334155] dark:text-[#CBD5E1] mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'High' | 'Medium' | 'Standard')}
                    className="w-full h-9 px-3 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Standard">Standard</option>
                  </select>
                </div>
              </div>

              {!editingCase && (
                <div>
                  <label className="block font-medium text-[#334155] dark:text-[#CBD5E1] mb-1">
                    Existing Complaint ID / Reference ID (optional — leave blank to auto-generate)
                  </label>
                  <input
                    type="text"
                    value={existingComplaintId}
                    onChange={(e) => setExistingComplaintId(e.target.value)}
                    placeholder="Leave blank to generate new TRACE-CMP-2026-XXXXXX"
                    className="w-full h-9 px-3 font-mono bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded"
                  />
                </div>
              )}

              {editingCase && user.role !== 'Viewer' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-[#334155] dark:text-[#CBD5E1] mb-1">
                      Case Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as CaseStatus)}
                      className="w-full h-9 px-3 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded"
                    >
                      <option value="Active">{t('common.active')}</option>
                      <option value="Under Review">{t('common.underReview')}</option>
                      <option value="Archived">{t('common.archived')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-[#334155] dark:text-[#CBD5E1] mb-1">
                      Assigned Investigator
                    </label>
                    <input
                      type="text"
                      value={investigatorName}
                      onChange={(e) => setInvestigatorName(e.target.value)}
                      className="w-full h-9 px-3 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-medium text-[#334155] dark:text-[#CBD5E1] mb-1">
                  Incident Description *
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={10}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the incident timeline, suspicious numbers, messages, or transactions..."
                  className="w-full p-3 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded resize-none"
                />
              </div>

              <div>
                <label className="block font-medium text-[#334155] dark:text-[#CBD5E1] mb-1">
                  Supporting Information / Evidence Notes (optional)
                </label>
                <textarea
                  rows={2}
                  value={supportingInfo}
                  onChange={(e) => setSupportingInfo(e.target.value)}
                  placeholder="Transaction IDs, bank/telecom reference numbers, or evidence file notes..."
                  className="w-full p-3 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-9 px-4 border border-[#CBD2DE] dark:border-[#2D4063] rounded text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2F4C]"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 px-4 bg-[#17243B] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded hover:bg-[#101A30] dark:hover:bg-[#d2b57c] disabled:opacity-60 font-medium"
                >
                  {saving
                    ? t('common.saving')
                    : editingCase
                    ? 'Update Case'
                    : 'Submit Complaint & Create Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
