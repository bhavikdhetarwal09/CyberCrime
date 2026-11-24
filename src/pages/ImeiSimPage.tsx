import React, { useMemo, useState, useEffect } from 'react';
import { AlertTriangle, Cpu, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { AuthUser, CaseRecord, CDRRecord, CellTower } from '../shared/types';
import { computeCaseAnalytics } from '../shared/analytics';
import {
  ForensicFilters,
  createDefaultFilters,
  extractFilterOptions,
  filterCdrs,
} from '../shared/filtering';
import { ForensicFilterBar } from '../components/ForensicFilterBar';
import { usePreferences } from '../lib/preferences';

interface ImeiSimPageProps {
  user: AuthUser;
  activeCase: CaseRecord | null;
  cdrs: CDRRecord[];
  towers: CellTower[];
  onInspectCdr: (rec: CDRRecord) => void;
  onInspectRecords: (title: string, subtitle: string, records: CDRRecord[]) => void;
}

export const ImeiSimPage: React.FC<ImeiSimPageProps> = ({
  user,
  activeCase,
  cdrs,
  towers,
  onInspectCdr,
  onInspectRecords,
}) => {
  const { t } = usePreferences();
  const isViewer = user.role === 'Viewer';
  const [filters, setFilters] = useState<ForensicFilters>(() => createDefaultFilters());
  const [reviewMarks, setReviewMarks] = useState<
    Record<string, 'Pending Review' | 'Flagged' | 'Cleared'>
  >({});
  const [matrixFilter, setMatrixFilter] = useState<'all' | 'multi_sim' | 'multi_imei'>('all');
  const [matrixSortKey, setMatrixSortKey] = useState<
    'imei' | 'phoneNumber' | 'firstSeen' | 'lastSeen' | 'count'
  >('count');
  const [matrixSortAsc, setMatrixSortAsc] = useState(false);

  useEffect(() => {
    setFilters(createDefaultFilters());
    setMatrixFilter('all');
  }, [activeCase?.id]);

  const filterOptions = useMemo(
    () => extractFilterOptions(activeCase, cdrs, [], towers),
    [activeCase, cdrs, towers]
  );

  const filteredCdrs = useMemo(() => filterCdrs(cdrs, filters), [cdrs, filters]);

  const analytics = useMemo(() => {
    if (!activeCase) return null;
    return computeCaseAnalytics(activeCase, filteredCdrs, [], towers);
  }, [activeCase, filteredCdrs, towers]);

  const associations = useMemo(() => {
    if (!activeCase) return [];
    const susMap = new Map(activeCase.suspects.map((s) => [s.phoneNumber, s]));
    const map = new Map<
      string,
      {
        imei: string;
        phoneNumber: string;
        imsi: string;
        suspectLabel?: string;
        operator: string;
        firstSeen: string;
        lastSeen: string;
        count: number;
        sampleRecord: CDRRecord;
      }
    >();

    for (const r of filteredCdrs) {
      if (!r.imei) continue;
      const ownerPhone = susMap.has(r.caller_number)
        ? r.caller_number
        : susMap.has(r.receiver_number)
        ? r.receiver_number
        : r.caller_number;
      const key = `${r.imei}|${ownerPhone}|${r.imsi}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          imei: r.imei,
          phoneNumber: ownerPhone,
          imsi: r.imsi || '—',
          suspectLabel: susMap.get(ownerPhone)?.label,
          operator: r.operator,
          firstSeen: r.timestamp,
          lastSeen: r.timestamp,
          count: 1,
          sampleRecord: r,
        });
      } else {
        existing.count += 1;
        if (r.timestamp < existing.firstSeen) existing.firstSeen = r.timestamp;
        if (r.timestamp > existing.lastSeen) existing.lastSeen = r.timestamp;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [activeCase, filteredCdrs]);

  const deviceSummary = useMemo(() => {
    const imeiToPhones = new Map<string, Set<string>>();
    const phoneToImeis = new Map<string, Set<string>>();
    for (const row of associations) {
      const phones = imeiToPhones.get(row.imei) || new Set<string>();
      phones.add(row.phoneNumber);
      imeiToPhones.set(row.imei, phones);

      const imeis = phoneToImeis.get(row.phoneNumber) || new Set<string>();
      imeis.add(row.imei);
      phoneToImeis.set(row.phoneNumber, imeis);
    }
    const multiSimImeis = new Set(
      Array.from(imeiToPhones.entries())
        .filter(([, phones]) => phones.size > 1)
        .map(([imei]) => imei)
    );
    const multiImeiPhones = new Set(
      Array.from(phoneToImeis.entries())
        .filter(([, imeis]) => imeis.size > 1)
        .map(([phone]) => phone)
    );
    return {
      uniqueImeiCount: imeiToPhones.size,
      uniquePhoneCount: phoneToImeis.size,
      multiSimImeis,
      multiImeiPhones,
    };
  }, [associations]);

  const displayedAssociations = useMemo(() => {
    const scoped =
      matrixFilter === 'multi_sim'
        ? associations.filter((r) => deviceSummary.multiSimImeis.has(r.imei))
        : matrixFilter === 'multi_imei'
        ? associations.filter((r) => deviceSummary.multiImeiPhones.has(r.phoneNumber))
        : associations;
    return [...scoped].sort((a, b) => {
      let cmp = 0;
      if (matrixSortKey === 'count') cmp = a.count - b.count;
      else cmp = String(a[matrixSortKey]).localeCompare(String(b[matrixSortKey]));
      return matrixSortAsc ? cmp : -cmp;
    });
  }, [associations, matrixFilter, deviceSummary, matrixSortKey, matrixSortAsc]);

  const toggleMatrixSort = (key: typeof matrixSortKey) => {
    if (matrixSortKey === key) setMatrixSortAsc((v) => !v);
    else {
      setMatrixSortKey(key);
      setMatrixSortAsc(false);
    }
  };

  const renderMatrixSortIcon = (key: typeof matrixSortKey) => {
    if (matrixSortKey !== key) return <ArrowUpDown className="w-3 h-3 opacity-60" />;
    return matrixSortAsc ? (
      <ArrowUp className="w-3 h-3 text-[#101A30] dark:text-[#C5A66A]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#101A30] dark:text-[#C5A66A]" />
    );
  };

  if (!activeCase || !analytics) {
    return (
      <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-10 text-center space-y-2">
        <h2 className="text-base font-semibold text-[#17243B] dark:text-[#F4F5F7]">
          No Active Case Selected for IMEI &amp; SIM Analysis
        </h2>
        <p className="text-xs text-[#64748B] dark:text-[#8993A5]">
          {isViewer
            ? 'Create a personal complaint/case and upload CDR data to analyze IMEI and SIM device associations.'
            : 'Select an assigned case from the top selector to analyze IMEI and SIM associations.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#17243B] dark:text-[#F4F5F7]">
          {t('imei.title')}
        </h1>
        <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-1">
          {t('imei.subtitle')}{' '}
          <span className="font-mono text-[#17243B] dark:text-[#C5A66A]">
            {activeCase.caseNumber}
          </span>
          .
        </p>
      </div>

      {/* Unified Forensic Filter Bar */}
      <ForensicFilterBar
        filters={filters}
        options={filterOptions}
        enabledFields={[
          'search',
          'dateRange',
          'timeRange',
          'suspect',
          'phoneNumber',
          'imei',
          'towerId',
          'callType',
          'nightOnly',
        ]}
        searchPlaceholder={t('imei.searchPlaceholder')}
        resultSummary={`${filteredCdrs.length}/${cdrs.length} CDR · ${associations.length} IMEI–SIM · ${analytics.deviceAlerts.length} alerts`}
        onChange={setFilters}
        onReset={() => setFilters(createDefaultFilters())}
      />

      {/* Device & SIM Relationship KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4">
          <p className="text-[#64748B] dark:text-[#8993A5]">Unique Handset IMEIs</p>
          <p className="text-xl font-mono font-semibold tabular-nums text-[#17243B] dark:text-[#F4F5F7] mt-1">
            {deviceSummary.uniqueImeiCount}
          </p>
        </div>
        <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4">
          <p className="text-[#64748B] dark:text-[#8993A5]">Observed Subscribers</p>
          <p className="text-xl font-mono font-semibold tabular-nums text-[#2563EB] dark:text-[#60A5FA] mt-1">
            {deviceSummary.uniquePhoneCount}
          </p>
        </div>
        <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4">
          <p className="text-[#64748B] dark:text-[#8993A5]">Multi-SIM Handsets</p>
          <p className="text-xl font-mono font-semibold tabular-nums text-[#A88748] dark:text-[#C5A66A] mt-1">
            {deviceSummary.multiSimImeis.size}
          </p>
        </div>
        <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4">
          <p className="text-[#64748B] dark:text-[#8993A5]">Multi-Handset Numbers</p>
          <p className="text-xl font-mono font-semibold tabular-nums text-[#EA580C] dark:text-[#FB923C] mt-1">
            {deviceSummary.multiImeiPhones.size}
          </p>
        </div>
      </div>

      {/* Flagged IMEI / SIM Changes */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
          {t('imei.flaggedTitle', { count: analytics.deviceAlerts.length })}
        </h2>
        {analytics.deviceAlerts.length === 0 ? (
          <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-6 text-xs text-[#64748B] dark:text-[#8993A5]">
            {t('imei.noFlagged')}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {analytics.deviceAlerts.map((alert) => {
              const status = reviewMarks[alert.id] || 'Pending Review';
              const isSimSwap = alert.type === 'SIM_SWAP';
              const supportingRecs = filteredCdrs.filter((r) =>
                alert.supportingRecordIds.includes(r.record_id)
              );
              return (
                <div
                  key={alert.id}
                  className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5 space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7] flex items-center gap-1.5">
                        <AlertTriangle
                          className={`w-4 h-4 shrink-0 ${
                            isSimSwap
                              ? 'text-[#DC2626] dark:text-[#F87171]'
                              : 'text-[#EA580C] dark:text-[#FB923C]'
                          }`}
                        />
                        <span>
                          {alert.type === 'IMEI_CHANGE'
                            ? t('imei.typeImeiChange')
                            : t('imei.typeSimSwap')}
                        </span>
                      </p>
                      <p className="font-mono text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7] mt-1.5">
                        {alert.primaryIdentifier}{' '}
                        {alert.suspectLabel && (
                          <span className="font-sans text-xs font-normal text-[#64748B] dark:text-[#8993A5]">
                            · {alert.suspectLabel}
                          </span>
                        )}
                      </p>
                    </div>
                    <select
                      value={status}
                      disabled={isViewer}
                      title={isViewer ? t('viewer.reviewStatusLocked') : undefined}
                      onChange={(e) => {
                        if (isViewer) return;
                        setReviewMarks((prev) => ({
                          ...prev,
                          [alert.id]: e.target.value as 'Pending Review' | 'Flagged' | 'Cleared',
                        }));
                      }}
                      aria-label={`Review status for ${alert.id}`}
                      className={`h-8 px-2 bg-[#F5F7FA] dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2A3F63] rounded text-[11px] font-medium disabled:opacity-60 disabled:cursor-not-allowed ${
                        status === 'Cleared'
                          ? 'text-[#16A34A] dark:text-[#4ADE80]'
                          : status === 'Flagged'
                          ? 'text-[#DC2626] dark:text-[#F87171]'
                          : 'text-[#17243B] dark:text-[#F4F5F7]'
                      }`}
                    >
                      <option value="Pending Review">{t('imei.statusPending')}</option>
                      <option value="Flagged">{t('imei.statusFlagged')}</option>
                      <option value="Cleared">{t('imei.statusCleared')}</option>
                    </select>
                  </div>

                  <div className="p-3 bg-[#F5F7FA] dark:bg-[#101A30] border border-[#E2E7EF] dark:border-[#243656] rounded space-y-1">
                    <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                      {t('imei.associatedIds')}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[#17243B] dark:text-[#C5A66A] font-medium">
                      {alert.associatedIdentifiers.map((id) => (
                        <span key={id}>{id}</span>
                      ))}
                    </div>
                    <p className="text-[11px] font-mono text-[#64748B] dark:text-[#8993A5] pt-1">
                      {alert.firstSeen.slice(0, 16).replace('T', ' ')} →{' '}
                      {alert.lastSeen.slice(0, 16).replace('T', ' ')} UTC
                    </p>
                  </div>

                  <p className="text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                    {alert.confidenceNote}
                  </p>

                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-[#64748B] dark:text-[#8993A5]">
                      {t('imei.supportingRecords', { count: supportingRecs.length })}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onInspectRecords(
                          `${alert.type === 'IMEI_CHANGE' ? 'IMEI Transition' : 'SIM Swap'}: ${alert.primaryIdentifier}`,
                          `Associated identifiers: ${alert.associatedIdentifiers.join(', ')}`,
                          supportingRecs
                        )
                      }
                      className="text-xs font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline inline-flex items-center gap-1"
                    >
                      {t('imei.inspectSource')}
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Full SIM-to-IMEI Association Matrix */}
      <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
        <div className="px-5 py-4 border-b border-[#E2E7EF] dark:border-[#243656] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#0D9488] dark:text-[#2DD4BF]" />
            <div>
              <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {t('imei.matrixTitle', { count: displayedAssociations.length })}
              </h2>
              <p className="text-[11px] font-mono text-[#64748B] dark:text-[#8993A5]">
                {t('imei.matrixSub')}
              </p>
            </div>
          </div>
          <div className="inline-flex items-center p-0.5 bg-[#F5F5F2] dark:bg-[#101A30] border border-[#E2E7EF] dark:border-[#243656] rounded text-xs">
            {(
              [
                { id: 'all', label: `All (${associations.length})` },
                { id: 'multi_sim', label: `Multi-SIM Handsets (${deviceSummary.multiSimImeis.size})` },
                { id: 'multi_imei', label: `Multi-Handset Numbers (${deviceSummary.multiImeiPhones.size})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMatrixFilter(tab.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors ${
                  matrixFilter === tab.id
                    ? 'bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30]'
                    : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#17243B] dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8F8F6] dark:bg-[#131F35] border-b border-[#E2E7EF] dark:border-[#243656] text-[11px] text-[#64748B] dark:text-[#8993A5]">
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleMatrixSort('imei')}
                    className="inline-flex items-center gap-1 hover:text-[#17243B] dark:hover:text-white whitespace-nowrap"
                  >
                    {t('imei.colHandsetImei')} {renderMatrixSortIcon('imei')}
                  </button>
                </th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleMatrixSort('phoneNumber')}
                    className="inline-flex items-center gap-1 hover:text-[#17243B] dark:hover:text-white whitespace-nowrap"
                  >
                    {t('imei.colMsisdn')} {renderMatrixSortIcon('phoneNumber')}
                  </button>
                </th>
                <th className="py-2.5 px-4">{t('imei.colImsi')}</th>
                <th className="py-2.5 px-4">{t('overview.colEntity')}</th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleMatrixSort('firstSeen')}
                    className="inline-flex items-center gap-1 hover:text-[#17243B] dark:hover:text-white whitespace-nowrap"
                  >
                    {t('imei.colFirstSeen')} {renderMatrixSortIcon('firstSeen')}
                  </button>
                </th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleMatrixSort('lastSeen')}
                    className="inline-flex items-center gap-1 hover:text-[#17243B] dark:hover:text-white whitespace-nowrap"
                  >
                    {t('imei.colLastSeen')} {renderMatrixSortIcon('lastSeen')}
                  </button>
                </th>
                <th className="py-2.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => toggleMatrixSort('count')}
                    className="inline-flex items-center gap-1 hover:text-[#17243B] dark:hover:text-white whitespace-nowrap"
                  >
                    {t('overview.events')} {renderMatrixSortIcon('count')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E7EF] dark:divide-[#243656]">
              {displayedAssociations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-[#64748B] dark:text-[#8993A5]">
                    {t('imei.noAssociations')}
                  </td>
                </tr>
              ) : (
                displayedAssociations.map((row) => (
                  <tr
                    key={`${row.imei}-${row.phoneNumber}-${row.imsi}`}
                    onClick={() => onInspectCdr(row.sampleRecord)}
                    className="hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                      {row.imei}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[#2563EB] dark:text-[#60A5FA]">
                      {row.phoneNumber}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[#64748B] dark:text-[#8993A5]">
                      {row.imsi}
                    </td>
                    <td className="py-2.5 px-4 text-[#334155] dark:text-[#CBD5E1]">
                      {row.suspectLabel || 'Observed Subscriber'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-[#64748B] dark:text-[#8993A5]">
                      {row.firstSeen.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-[#64748B] dark:text-[#8993A5]">
                      {row.lastSeen.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                      {row.count}
                    </td>
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
