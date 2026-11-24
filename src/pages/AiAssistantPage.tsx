import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  FileText,
  AlertCircle,
  Download,
  ExternalLink,
  Languages,
  CheckCircle2,
  Loader2,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  AuthUser,
  CaseRecord,
  AIResponsePayload,
  EvidenceCitation,
} from '../shared/types';
import { usePreferences } from '../lib/preferences';

export interface AiQueryErrorState {
  message: string;
  failedQuestion: string;
}

interface AiAssistantPageProps {
  user: AuthUser;
  activeCase: CaseRecord | null;
  aiConfigured: boolean;
  cdrCount?: number;
  ipdrCount?: number;
  history: AIResponsePayload[];
  loading: boolean;
  pendingQuestion: string | null;
  errorState: AiQueryErrorState | null;
  onSubmitQuery: (question: string, language: 'en' | 'hi') => void;
  onCancelQuery: () => void;
  onClearError: () => void;
  onInspectCitation: (citation: EvidenceCitation) => void;
}

export const AiAssistantPage: React.FC<AiAssistantPageProps> = ({
  user,
  activeCase,
  aiConfigured: _aiConfigured,
  cdrCount,
  ipdrCount,
  history,
  loading,
  pendingQuestion,
  errorState,
  onSubmitQuery,
  onCancelQuery,
  onClearError,
  onInspectCitation,
}) => {
  const { language, setLanguage, t } = usePreferences();
  const canExport = Boolean(
    activeCase &&
      ((user.role === 'Viewer' && activeCase.ownerUserId === user.id) ||
        user.role === 'Investigator' ||
        (user.role === 'Administrator' && Boolean(user.canAccessSensitiveCaseData)))
  );
  const [queryInput, setQueryInput] = useState('');
  const [activeEvidenceList, setActiveEvidenceList] = useState<EvidenceCitation[]>([]);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  // Sync side-panel evidence strictly to the active case and latest response
  useEffect(() => {
    const latest = history[history.length - 1];
    setActiveEvidenceList(latest ? latest.citations : []);
    setSelectedResponseId(latest ? latest.id : null);
  }, [activeCase?.id, history]);

  // Smoothly scroll conversation feed as new responses or loading state appear
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history.length, loading, errorState]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = queryInput.trim();
    if (!activeCase || !trimmed || loading) return;
    setQueryInput('');
    onSubmitQuery(trimmed, language);
  };

  const exportTranscript = () => {
    if (!activeCase || history.length === 0) return;
    const lines: string[] = [
      `TRACE INTEL — AI Investigation Assistant Transcript`,
      `Case: ${activeCase.caseNumber} — ${activeCase.title}`,
      `Classification: REQUIRES HUMAN OFFICER VERIFICATION`,
      `Exported: ${new Date().toISOString()}`,
      `========================================================================`,
      '',
    ];
    for (const item of history) {
      lines.push(`QUESTION (${item.language.toUpperCase()}): ${item.question}`);
      lines.push(`ENGINE: ${item.modelLabel}`);
      lines.push(`SUMMARY: ${item.summary}`);
      lines.push(`OBSERVED FACTS:`);
      item.observedFacts.forEach((f) => {
        lines.push(`  - ${f.statement} [Citations: ${f.citation_ids.join(', ') || 'None'}]`);
      });
      if (item.analyticalPatterns.length > 0) {
        lines.push(`ANALYTICAL PATTERNS:`);
        item.analyticalPatterns.forEach((p) => lines.push(`  - ${p}`));
      }
      if (item.hypothesesForVerification.length > 0) {
        lines.push(`HYPOTHESES FOR OFFICER VERIFICATION:`);
        item.hypothesesForVerification.forEach((h) => lines.push(`  - ${h}`));
      }
      lines.push(`EVIDENCE CITATIONS:`);
      item.citations.forEach((c) => {
        lines.push(
          `  * ${c.record_id} | ${c.source_file} (Row ${c.source_row}) | ${c.phone_number} | ${c.timestamp}`
        );
      });
      lines.push('------------------------------------------------------------------------\n');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCase.caseNumber}_ai_transcript.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!activeCase) {
    return (
      <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-10 text-center space-y-2">
        <h2 className="text-base font-semibold text-[#17243B] dark:text-[#F4F5F7]">
          No Authorized Case Selected for AI Assistant
        </h2>
        <p className="text-xs text-[#64748B] dark:text-[#8993A5]">
          {user.role === 'Viewer'
            ? 'Create a personal complaint or case first to ask the AI Investigator Assistant about your own case records.'
            : 'Select an assigned investigation case to run AI-assisted analysis.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('ai.title')}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-1">
            {t('ai.subtitle')}{' '}
            <span className="font-mono text-[#17243B] dark:text-[#F4F5F7]">
              {activeCase.caseNumber}
            </span>
            . {t('ai.subtitleTail')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Language Toggle (Synced Globally) */}
          <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#17243B] border border-[#DCE1EA] dark:border-[#243656] rounded text-xs">
            <Languages className="w-3.5 h-3.5 text-[#8993A5] ml-1.5 mr-0.5" />
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
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
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                language === 'hi'
                  ? 'bg-[#17243B] dark:bg-[#C5A66A] text-white dark:text-[#101A30]'
                  : 'text-[#64748B] dark:text-[#8993A5] hover:text-[#17243B] dark:hover:text-[#F4F5F7]'
              }`}
            >
              हिंदी
            </button>
          </div>

          {canExport && (
            <button
              type="button"
              disabled={history.length === 0}
              onClick={exportTranscript}
              className="h-9 px-3.5 text-xs font-medium bg-white dark:bg-[#17243B] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F8F9FB] dark:hover:bg-[#1E2F4C] disabled:opacity-40 rounded inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              {t('ai.exportSummary')}
            </button>
          )}
        </div>
      </div>

      {/* Authorized Case Evidence Scope Bar */}
      <div className="px-4 py-2.5 bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#475569] dark:text-[#94A3B8]">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono tabular-nums">
          <span className="font-sans font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            Authorized Scope:
          </span>
          <span>{activeCase.caseNumber}</span>
          <span aria-hidden="true">·</span>
          <span>{typeof cdrCount === 'number' ? `${cdrCount} CDR` : `${activeCase.datasets.filter((d) => d.fileType === 'CDR').length} CDR file(s)`}</span>
          <span aria-hidden="true">·</span>
          <span>{typeof ipdrCount === 'number' ? `${ipdrCount} IPDR` : `${activeCase.datasets.filter((d) => d.fileType === 'IPDR').length} IPDR file(s)`}</span>
          <span aria-hidden="true">·</span>
          <span>{activeCase.datasets.length} dataset(s)</span>
        </div>
        <span className="text-[#64748B] dark:text-[#8993A5]">
          Grounded strictly on loaded case records; never fabricates identities, locations, or conclusions.
        </span>
      </div>

      {cdrCount === 0 && ipdrCount === 0 && (
        <div className="px-4 py-3 bg-[#F8F9FB] dark:bg-[#132036] border border-[#DCE3EE] dark:border-[#243656] rounded text-xs text-[#475569] dark:text-[#CBD5E1]">
          <strong className="text-[#17243B] dark:text-[#F4F5F7]">Data Not Available:</strong> No CDR or IPDR records have been uploaded to {activeCase.caseNumber} yet. Upload CSV/XLSX evidence in Data Import for evidence-cited telecom analysis.
        </div>
      )}

      {/* Main Split: Conversational Workspace + Supporting Records Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded flex flex-col min-h-[580px]">
          {/* Conversation Feed */}
          <div className="flex-1 p-5 space-y-6 overflow-y-auto max-h-[600px]">
            {history.length === 0 && !loading && !errorState && (
              <div className="py-16 text-center max-w-md mx-auto space-y-2">
                <FileText className="w-7 h-7 text-[#8993A5] mx-auto" />
                <p className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  {t('ai.emptyTitle')}
                </p>
                <p className="text-xs text-[#64748B] dark:text-[#8993A5] leading-relaxed">
                  {t('ai.emptyDesc')}
                </p>
              </div>
            )}

            {history.map((item) => {
              const isSelected = selectedResponseId === item.id;
              return (
                <article
                  key={item.id}
                  onClick={() => {
                    setSelectedResponseId(item.id);
                    setActiveEvidenceList(item.citations);
                  }}
                  className={`space-y-3 pb-6 border-b border-[#ECEFF4] dark:border-[#243656] last:border-b-0 ${
                    isSelected ? '' : 'opacity-95'
                  }`}
                >
                  {/* User Prompt */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] px-4 py-2.5 bg-[#17243B] dark:bg-[#2563EB] text-white rounded text-xs leading-relaxed">
                      {item.question}
                    </div>
                  </div>

                  {/* Structured Assistant Finding */}
                  <div className="bg-[#F8F9FB] dark:bg-[#132036] border border-[#DCE1EA] dark:border-[#243656] rounded p-4 space-y-4 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E2E6ED] dark:border-[#243656] text-[11px]">
                      <span className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                        {item.modelLabel}
                      </span>
                      <span className="font-mono text-[#64748B] dark:text-[#8993A5]">
                        {item.mode === 'deterministic_demo'
                          ? 'Local Evidence Analyzer'
                          : 'Grounded on Case Records'}{' '}
                        · {item.citations.length} citations
                      </span>
                    </div>

                    <p className="text-[#17243B] dark:text-[#F4F5F7] text-sm leading-relaxed font-medium">
                      {item.summary}
                    </p>

                    {/* 1. Observed Facts */}
                    {item.observedFacts.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          {item.language === 'hi'
                            ? '1. दर्ज तथ्य (Observed Facts)'
                            : '1. Observed Facts (Source-Cited)'}
                        </p>
                        <ul className="space-y-2">
                          {item.observedFacts.map((fact, idx) => (
                            <li
                              key={idx}
                              className="leading-relaxed text-[#334155] dark:text-[#CBD5E1]"
                            >
                              <span>• {fact.statement}</span>
                              {fact.citation_ids.length > 0 && (
                                <span className="inline-flex flex-wrap gap-1 ml-2 align-middle">
                                  {fact.citation_ids.map((cid) => {
                                    const refObj = item.citations.find((c) => c.record_id === cid);
                                    const provenanceLabel = refObj
                                      ? `${refObj.source_file} · Row #${refObj.source_row} · ${refObj.timestamp.slice(0, 19).replace('T', ' ')} UTC`
                                      : cid;
                                    return (
                                      <button
                                        key={cid}
                                        type="button"
                                        title={provenanceLabel}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveEvidenceList(item.citations);
                                          if (refObj) onInspectCitation(refObj);
                                        }}
                                        className="px-1.5 py-0.5 font-mono text-[10px] bg-white dark:bg-[#101A30] hover:bg-[#17243B] dark:hover:bg-[#C5A66A] hover:text-white dark:hover:text-[#101A30] text-[#17243B] dark:text-[#C5A66A] border border-[#CBD2DE] dark:border-[#2D4063] rounded transition-colors"
                                      >
                                        {refObj
                                          ? `${cid} (${refObj.source_file}:${refObj.source_row})`
                                          : cid}
                                      </button>
                                    );
                                  })}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 2. Analytical Patterns */}
                    {item.analyticalPatterns.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          {item.language === 'hi'
                            ? '2. विश्लेषणात्मक पैटर्न (Analytical Patterns)'
                            : '2. Analytical Patterns'}
                        </p>
                        <ul className="list-disc pl-4 space-y-1 text-[#475569] dark:text-[#CBD5E1]">
                          {item.analyticalPatterns.map((p, idx) => (
                            <li key={idx}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 3. Hypotheses for Verification */}
                    {item.hypothesesForVerification.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          {item.language === 'hi'
                            ? '3. अधिकारी सत्यापन हेतु बिंदु (Hypotheses Requiring Verification)'
                            : '3. Hypotheses Requiring Officer Verification'}
                        </p>
                        <ul className="list-disc pl-4 space-y-1 text-[#475569] dark:text-[#CBD5E1]">
                          {item.hypothesesForVerification.map((h, idx) => (
                            <li key={idx}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 4. Data Limitations */}
                    {item.dataLimitations.length > 0 && (
                      <div className="p-2.5 bg-white dark:bg-[#101A30] border border-[#E2E6ED] dark:border-[#243656] rounded text-[11px] text-[#64748B] dark:text-[#8993A5]">
                        <strong className="text-[#334155] dark:text-[#CBD5E1]">
                          {t('ai.limitationsLabel')}{' '}
                        </strong>
                        {item.dataLimitations.join(' ')}
                      </div>
                    )}

                    {/* Verification footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E2E6ED] dark:border-[#243656] text-[11px]">
                      <span className="text-[#EA580C] dark:text-[#F97316] font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('ai.verifyFooter')}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}

            {/* Active In-Flight Request State */}
            {loading && (
              <div className="space-y-3">
                {pendingQuestion && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] px-4 py-2.5 bg-[#17243B] dark:bg-[#2563EB] text-white rounded text-xs leading-relaxed opacity-90">
                      {pendingQuestion}
                    </div>
                  </div>
                )}
                <div
                  role="status"
                  aria-live="polite"
                  className="p-4 bg-[#F8F9FB] dark:bg-[#132036] border border-[#DCE1EA] dark:border-[#243656] rounded flex items-center justify-between gap-3 text-xs text-[#475569] dark:text-[#CBD5E1]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Loader2 className="w-4 h-4 animate-spin text-[#17243B] dark:text-[#C5A66A] shrink-0" />
                    <span>{t('ai.analyzing')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={onCancelQuery}
                    className="px-2.5 py-1 text-[11px] font-medium bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#475569] dark:text-[#CBD5E1] hover:text-[#17243B] dark:hover:text-white rounded inline-flex items-center gap-1 shrink-0 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    {t('ai.cancelBtn')}
                  </button>
                </div>
              </div>
            )}

            {/* Error State with Retry & Explicit Fallback */}
            {!loading && errorState && (
              <div
                role="alert"
                className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded space-y-3 text-xs text-[#DC2626] dark:text-red-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium">{errorState.message}</p>
                      <p className="text-[11px] opacity-80">
                        Question: &ldquo;{errorState.failedQuestion}&rdquo;
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClearError}
                    aria-label="Dismiss error"
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSubmitQuery(errorState.failedQuestion, language)}
                    className="px-3 py-1.5 bg-[#17243B] hover:bg-[#101A30] dark:bg-[#C5A66A] dark:hover:bg-[#d2b57c] text-white dark:text-[#101A30] rounded text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t('ai.retryBtn')}
                  </button>
                </div>
              </div>
            )}

            <div ref={feedEndRef} />
          </div>

          {/* Clean Empty Input Bar */}
          <form
            onSubmit={handleSubmit}
            className="p-4 border-t border-[#ECEFF4] dark:border-[#243656] bg-white dark:bg-[#17243B] flex items-center gap-2"
          >
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              disabled={loading}
              autoComplete="off"
              placeholder={t('ai.inputPlaceholder')}
              aria-label="Investigation question"
              className="flex-1 h-10 px-3.5 text-xs bg-[#F5F7FA] dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] placeholder:text-[#8993A5] rounded focus:outline-none focus:bg-white dark:focus:bg-[#101A30] focus:border-[#17243B] dark:focus:border-[#C5A66A] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !queryInput.trim()}
              className="h-10 px-4 bg-[#17243B] hover:bg-[#101A30] dark:bg-[#C5A66A] dark:hover:bg-[#d2b57c] disabled:opacity-50 text-white dark:text-[#101A30] text-xs font-medium rounded inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>{t('ai.analyzeBtn')}</span>
                  <Send className="w-3.5 h-3.5 text-[#C5A66A] dark:text-[#101A30]" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Supporting Records Side Panel */}
        <aside className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded flex flex-col min-h-[580px] max-h-[720px]">
          <div className="px-5 py-4 border-b border-[#ECEFF4] dark:border-[#243656]">
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('ai.sideTitle', { count: activeEvidenceList.length })}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
              {t('ai.sideSub')}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[#ECEFF4] dark:divide-[#243656] text-xs">
            {activeEvidenceList.length === 0 ? (
              <p className="p-5 text-[#64748B] dark:text-[#8993A5] leading-relaxed">
                {t('ai.sideEmpty')}
              </p>
            ) : (
              activeEvidenceList.map((cite) => (
                <button
                  key={cite.record_id}
                  type="button"
                  onClick={() => onInspectCitation(cite)}
                  className="w-full text-left p-4 hover:bg-[#F8F9FB] dark:hover:bg-[#1A2A45] transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                      {cite.record_id}
                    </span>
                    <span className="text-[10px] font-mono text-[#A88748] dark:text-[#C5A66A] inline-flex items-center gap-1">
                      {t('common.inspect')} <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-[#334155] dark:text-[#CBD5E1] break-all">
                    {cite.phone_number}
                  </p>
                  <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1]">{cite.summary}</p>
                  <p className="font-mono text-[10px] text-[#64748B] dark:text-[#8993A5]">
                    {cite.source_file} · Row #{cite.source_row} ·{' '}
                    {cite.timestamp.slice(0, 19).replace('T', ' ')}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
