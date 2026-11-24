import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import { CaseRecord, CDRRecord, CellTower } from '../shared/types';
import {
  computeCaseAnalytics,
  formatDuration,
  isNightTimestamp,
} from '../shared/analytics';
import {
  createDefaultFilters,
  extractFilterOptions,
  filterCdrs,
  ForensicFilters,
} from '../shared/filtering';
import { ForensicFilterBar } from '../components/ForensicFilterBar';
import { usePreferences } from '../lib/preferences';

interface CdrAnalysisPageProps {
  activeCase: CaseRecord | null;
  cdrs: CDRRecord[];
  towers: CellTower[];
  onInspectCdr: (rec: CDRRecord) => void;
  onInspectNumberRecords: (phoneNumber: string, records: CDRRecord[]) => void;
}

type SortKey =
  | 'timestamp'
  | 'duration_seconds'
  | 'caller_number'
  | 'receiver_number'
  | 'call_type'
  | 'cell_id';

type RecordViewMode = 'all' | 'duplicates' | 'quality';

export const CdrAnalysisPage: React.FC<CdrAnalysisPageProps> = ({
  activeCase,
  cdrs,
  towers,
  onInspectCdr,
  onInspectNumberRecords,
}) => {
  const { t, chartTheme } = usePreferences();
  const [filters, setFilters] = useState<ForensicFilters>(() => createDefaultFilters());
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortAsc, setSortAsc] = useState(false);
  const [recordViewMode, setRecordViewMode] = useState<RecordViewMode>('all');
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setFilters(createDefaultFilters());
    setPage(1);
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

  const { duplicateRecordIds, qualityFlaggedIds } = useMemo(() => {
    const sigBuckets = new Map<string, string[]>();
    const flagged = new Set<string>();
    for (const r of filteredCdrs) {
      const sig = `${r.caller_number}|${r.receiver_number}|${r.timestamp}|${r.call_type}|${r.duration_seconds}`;
      const bucket = sigBuckets.get(sig) || [];
      bucket.push(r.record_id);
      sigBuckets.set(sig, bucket);
      if (
        !r.imei ||
        !r.imsi ||
        !r.cell_id ||
        r.cell_id === 'UNKNOWN' ||
        (r.quality_flags && r.quality_flags.length > 0)
      ) {
        flagged.add(r.record_id);
      }
    }
    const dups = new Set<string>();
    for (const ids of sigBuckets.values()) {
      if (ids.length > 1) {
        ids.forEach((id) => dups.add(id));
      }
    }
    return { duplicateRecordIds: dups, qualityFlaggedIds: flagged };
  }, [filteredCdrs]);

  const scopedCdrs = useMemo(() => {
    if (recordViewMode === 'duplicates') {
      return filteredCdrs.filter((r) => duplicateRecordIds.has(r.record_id));
    }
    if (recordViewMode === 'quality') {
      return filteredCdrs.filter((r) => qualityFlaggedIds.has(r.record_id));
    }
    return filteredCdrs;
  }, [filteredCdrs, recordViewMode, duplicateRecordIds, qualityFlaggedIds]);

  const sortedCdrs = useMemo(() => {
    const copy = [...scopedCdrs];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'duration_seconds') cmp = a.duration_seconds - b.duration_seconds;
      else cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [scopedCdrs, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sortedCdrs.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedCdrs = sortedCdrs.slice((safePage - 1) * pageSize, safePage * pageSize);

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3 h-3 opacity-60" />;
    return sortAsc ? (
      <ArrowUp className="w-3 h-3 text-[#101A30] dark:text-[#C5A66A]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#101A30] dark:text-[#C5A66A]" />
    );
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
    setPage(1);
  };

  const handleFiltersChange = (next: ForensicFilters) => {
    setFilters(next);
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(createDefaultFilters());
    setRecordViewMode('all');
    setPage(1);
  };

  if (!activeCase || !analytics) {
    return (
      <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-8 text-center text-xs text-[#64748B] dark:text-[#8993A5]">
        {t('overview.noCaseTitle')}
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: chartTheme.tooltipBg,
    borderColor: chartTheme.tooltipBorder,
    color: chartTheme.tooltipText,
    fontSize: '12px',
    borderRadius: '6px',
  };

  const topContactChart = analytics.topContacts.slice(0, 7).map((c) => ({
    label: c.label ? `${c.label}` : c.phoneNumber.slice(-8),
    calls: c.totalCalls,
    durationMin: Number((c.totalDurationSec / 60).toFixed(1)),
  }));

  const splitChart = [
    { name: t('overview.incomingVoice'), count: analytics.incomingCount, color: chartTheme.incoming },
    { name: t('overview.outgoingVoice'), count: analytics.outgoingCount, color: chartTheme.outgoing },
    { name: t('overview.smsEvents'), count: analytics.smsCount, color: chartTheme.gold },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('cdr.title')}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-1">
            {t('cdr.subtitle')}{' '}
            <span className="font-mono text-[#17243B] dark:text-[#C5A66A]">
              {activeCase.caseNumber}
            </span>
            . {t('cdr.subtitleTail')}
          </p>
        </div>
      </div>

      {/* Complete CDR Filter Bar */}
      <ForensicFilterBar
        filters={filters}
        options={filterOptions}
        enabledFields={[
          'search',
          'dateRange',
          'timeRange',
          'suspect',
          'phoneNumber',
          'callType',
          'towerId',
          'imei',
          'nightOnly',
        ]}
        searchPlaceholder={t('cdr.searchPlaceholder')}
        resultSummary={`${filteredCdrs.length} / ${cdrs.length} CDR`}
        onChange={handleFiltersChange}
        onReset={resetFilters}
      />

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
        <StatBox
          label={t('cdr.statFiltered')}
          value={analytics.totalCdrs.toLocaleString()}
          valueClass="text-[#17243B] dark:text-[#F4F5F7]"
        />
        <StatBox
          label={t('cdr.statInOut')}
          value={`${analytics.incomingCount} / ${analytics.outgoingCount}`}
          sub={`${analytics.smsCount} SMS`}
          valueClass="text-[#2563EB] dark:text-[#60A5FA]"
        />
        <StatBox
          label={t('cdr.statDuration')}
          value={formatDuration(analytics.totalDurationSec)}
          valueClass="text-[#0D9488] dark:text-[#2DD4BF]"
        />
        <StatBox
          label={t('cdr.statAvgVoice')}
          value={`${analytics.avgDurationSec}s`}
          valueClass="text-[#A88748] dark:text-[#C5A66A]"
        />
        <StatBox
          label={t('cdr.statNight')}
          value={String(analytics.nightCallCount)}
          sub={`${Math.round((analytics.nightCallCount / Math.max(1, analytics.totalCdrs)) * 100)}%`}
          valueClass="text-[#EA580C] dark:text-[#FB923C]"
        />
        <StatBox
          label={t('cdr.statWindow')}
          value={analytics.firstTimestamp ? analytics.firstTimestamp.slice(5, 10) : '—'}
          sub={analytics.lastTimestamp ? `→ ${analytics.lastTimestamp.slice(5, 10)}` : t('common.noData')}
          valueClass="text-[#17243B] dark:text-[#F4F5F7]"
        />
      </div>

      {/* Hourly + Daily Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('cdr.hourlyTitle')}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#8993A5]">{t('cdr.hourlySub')}</p>
          </div>
          <div className="h-[240px]">
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
              {t('cdr.dailyTitle')}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#8993A5]">{t('cdr.dailySub')}</p>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.dailySeries} margin={{ top: 6, right: 12, left: 0, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: chartTheme.axisTick }}
                  tickFormatter={(v) => String(v).slice(5)}
                  label={{
                    value: t('overview.axisDate'),
                    position: 'insideBottom',
                    offset: -10,
                    fill: chartTheme.axisLabel,
                    fontSize: 10,
                  }}
                />
                <YAxis tick={{ fontSize: 11, fill: chartTheme.axisTick }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                <Line
                  type="monotone"
                  dataKey="incoming"
                  name={t('overview.incoming')}
                  stroke={chartTheme.incoming}
                  strokeWidth={2.2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="outgoing"
                  name={t('overview.outgoing')}
                  stroke={chartTheme.outgoing}
                  strokeWidth={2.2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="sms"
                  name={t('overview.sms')}
                  stroke={chartTheme.gold}
                  strokeWidth={2}
                  dot={{ r: 2.5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Contact Analysis Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('cdr.topChartTitle')}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#8993A5]">{t('cdr.topChartSub')}</p>
          </div>
          <div className="h-[220px]">
            {topContactChart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#64748B] dark:text-[#8993A5]">
                {t('common.noData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topContactChart} margin={{ top: 6, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: chartTheme.axisTick }} />
                  <YAxis tick={{ fontSize: 11, fill: chartTheme.axisTick }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="calls" name={t('overview.calls')} fill={chartTheme.incoming} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="durationMin" name={t('overview.durationMin')} fill={chartTheme.outgoing} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('cdr.splitChartTitle')}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#8993A5]">{t('cdr.splitChartSub')}</p>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={splitChart} margin={{ top: 6, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: chartTheme.axisTick }} />
                <YAxis tick={{ fontSize: 11, fill: chartTheme.axisTick }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name={t('overview.events')} radius={[4, 4, 0, 0]}>
                  {splitChart.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Top Contacted Numbers + Unusual Frequency Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
          <div className="px-5 py-3.5 border-b border-[#E2E7EF] dark:border-[#243656]">
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('cdr.topTableTitle')}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F5F7FA] dark:bg-[#131F35] border-b border-[#E2E7EF] dark:border-[#243656] text-[11px] text-[#64748B] dark:text-[#8993A5]">
                  <th className="py-2.5 px-4">{t('cdr.colNumber')}</th>
                  <th className="py-2.5 px-4">{t('overview.colEntity')}</th>
                  <th className="py-2.5 px-4 text-right">{t('cdr.colCalls')}</th>
                  <th className="py-2.5 px-4 text-right">{t('cdr.colAvgDur')}</th>
                  <th className="py-2.5 px-4">{t('cdr.colFirstLast')}</th>
                  <th className="py-2.5 px-4 text-right">{t('cdr.colSource')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E7EF] dark:divide-[#243656]">
                {analytics.topContacts.slice(0, 7).map((c) => (
                  <tr key={c.phoneNumber} className="hover:bg-[#F5F7FA] dark:hover:bg-[#101A30]">
                    <td className="py-2.5 px-4 font-mono tabular-nums font-medium text-[#17243B] dark:text-[#F4F5F7]">
                      {c.phoneNumber}
                    </td>
                    <td className="py-2.5 px-4 text-[#475569] dark:text-[#CBD5E1]">
                      {c.label || 'Contact'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                      {c.totalCalls}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#475569] dark:text-[#9AA6BA]">
                      {c.avgDurationSec}s
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-[#64748B] dark:text-[#8993A5]">
                      {c.firstContact.slice(5, 16).replace('T', ' ')} →{' '}
                      {c.lastContact.slice(5, 16).replace('T', ' ')}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          const matched = filteredCdrs.filter(
                            (r) =>
                              r.caller_number === c.phoneNumber ||
                              r.receiver_number === c.phoneNumber
                          );
                          onInspectNumberRecords(c.phoneNumber, matched);
                        }}
                        className="text-[11px] font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline"
                      >
                        {t('common.records')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('cdr.unusualTitle')}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
              {t('cdr.unusualSub')}
            </p>
          </div>
          {analytics.unusualPatterns.length === 0 ? (
            <p className="text-xs text-[#64748B] dark:text-[#8993A5] py-4">{t('cdr.noUnusual')}</p>
          ) : (
            analytics.unusualPatterns.map((u) => (
              <div
                key={u.phoneNumber}
                className="p-3.5 bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/60 rounded space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FB923C]" />
                    {u.phoneNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const matched = filteredCdrs.filter(
                        (r) =>
                          r.caller_number === u.phoneNumber ||
                          r.receiver_number === u.phoneNumber
                      );
                      onInspectNumberRecords(u.phoneNumber, matched);
                    }}
                    className="text-[11px] font-medium text-[#2563EB] dark:text-[#C5A66A] underline"
                  >
                    {t('common.inspect')}
                  </button>
                </div>
                {u.suspectLabel && (
                  <p className="text-[11px] font-medium text-[#475569] dark:text-[#CBD5E1]">
                    {u.suspectLabel}
                  </p>
                )}
                <p className="text-[#4A3B1E] dark:text-[#FED7AA] leading-snug">{u.reason}</p>
              </div>
            ))
          )}
        </section>
      </div>

      {/* Detailed Searchable & Sortable CDR Table */}
      <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
        <div className="px-5 py-3.5 border-b border-[#E2E7EF] dark:border-[#243656] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('cdr.tableTitle', { count: sortedCdrs.length })}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#8993A5]">{t('cdr.tableSub')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Segmented Duplicate & Validation Filter */}
            <div className="inline-flex items-center p-0.5 bg-[#F5F5F2] dark:bg-[#101A30] border border-[#E2E7EF] dark:border-[#243656] rounded">
              {(
                [
                  { id: 'all', label: `All (${filteredCdrs.length})` },
                  { id: 'duplicates', label: `Duplicates (${duplicateRecordIds.size})` },
                  { id: 'quality', label: `Validation Flags (${qualityFlaggedIds.size})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setRecordViewMode(tab.id);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors ${
                    recordViewMode === tab.id
                      ? 'bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30]'
                      : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#17243B] dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="cdr-page-size" className="text-[11px] text-[#64748B] dark:text-[#8993A5] whitespace-nowrap">
                Rows:
              </label>
              <select
                id="cdr-page-size"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-7 px-2 bg-[#F5F5F2] dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2A3F63] rounded text-[11px] font-mono text-[#17243B] dark:text-[#F4F5F7]"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 border border-[#CBD2DE] dark:border-[#2A3F63] rounded disabled:opacity-40 text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F5F2] dark:hover:bg-[#101A30]"
              >
                {t('common.prev')}
              </button>
              <span className="font-mono tabular-nums text-[#475569] dark:text-[#9AA6BA]">
                {t('common.pageOf', { page: safePage, total: totalPages })}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 border border-[#CBD2DE] dark:border-[#2A3F63] rounded disabled:opacity-40 text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F5F2] dark:hover:bg-[#101A30]"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8F8F6] dark:bg-[#131F35] border-b border-[#E2E7EF] dark:border-[#243656] text-[11px] text-[#64748B] dark:text-[#8993A5]">
                <th className="py-2.5 px-4">{t('cdr.colRecordId')}</th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('caller_number')}
                    className="inline-flex items-center gap-1 hover:text-[#17243B] dark:hover:text-white whitespace-nowrap"
                  >
                    {t('cdr.colCaller')} {renderSortIcon('caller_number')}
                  </button>
                </th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('receiver_number')}
                    className="inline-flex items-center gap-1 hover:text-[#17243B] dark:hover:text-white whitespace-nowrap"
                  >
                    {t('cdr.colReceiver')} {renderSortIcon('receiver_number')}
                  </button>
                </th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('call_type')}
                    className="inline-flex items-center gap-1 hover:text-[#17243B] dark:hover:text-white whitespace-nowrap"
                  >
                    {t('cdr.colType')} {renderSortIcon('call_type')}
                  </button>
                </th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('timestamp')}
                    className="inline-flex items-center gap-1 hover:text-[#17243B] dark:hover:text-white whitespace-nowrap"
                  >
                    {t('cdr.colTimestamp')} {renderSortIcon('timestamp')}
                  </button>
                </th>
                <th className="py-2.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('duration_seconds')}
                    className="inline-flex items-center gap-1 hover:text-[#17243B] dark:hover:text-white whitespace-nowrap"
                  >
                    {t('cdr.colDuration')} {renderSortIcon('duration_seconds')}
                  </button>
                </th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('cell_id')}
                    className="inline-flex items-center gap-1 hover:text-[#17243B] dark:hover:text-white whitespace-nowrap"
                  >
                    {t('cdr.colCellId')} {renderSortIcon('cell_id')}
                  </button>
                </th>
                <th className="py-2.5 px-4">{t('cdr.colSourceRow')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E7EF] dark:divide-[#243656]">
              {pagedCdrs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#64748B] dark:text-[#8993A5]">
                    {t('cdr.noRows')}
                  </td>
                </tr>
              ) : (
                pagedCdrs.map((r) => {
                  const typeColor =
                    r.call_type === 'INCOMING'
                      ? 'text-[#2563EB] dark:text-[#60A5FA]'
                      : r.call_type === 'OUTGOING'
                      ? 'text-[#0D9488] dark:text-[#2DD4BF]'
                      : 'text-[#A88748] dark:text-[#C5A66A]';
                  return (
                    <tr
                      key={r.record_id}
                      onClick={() => onInspectCdr(r)}
                      className="hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono text-[#475569] dark:text-[#9AA6BA]">
                        {r.record_id}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums font-medium text-[#17243B] dark:text-[#F4F5F7]">
                        {r.caller_number}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-[#334155] dark:text-[#CBD5E1]">
                        {r.receiver_number}
                      </td>
                      <td className={`py-2.5 px-4 font-medium ${typeColor}`}>{r.call_type}</td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-[#475569] dark:text-[#9AA6BA]">
                        {r.timestamp.slice(0, 19).replace('T', ' ')}
                        {isNightTimestamp(r.timestamp) && (
                          <span className="ml-1.5 text-[10px] font-sans text-[#EA580C] dark:text-[#FB923C] font-semibold">
                            {t('common.night')}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
                        {r.duration_seconds}s
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[#475569] dark:text-[#9AA6BA]">
                        {r.cell_id}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-[#64748B] dark:text-[#8993A5]">
                        <span>
                          {r.source_file}:{r.source_row}
                        </span>
                        {duplicateRecordIds.has(r.record_id) && (
                          <span className="ml-1.5 font-sans text-[10px] font-semibold text-[#DC2626] dark:text-[#F87171]">
                            · Duplicate
                          </span>
                        )}
                        {!duplicateRecordIds.has(r.record_id) && qualityFlaggedIds.has(r.record_id) && (
                          <span className="ml-1.5 font-sans text-[10px] font-semibold text-[#A88748] dark:text-[#C5A66A]">
                            · Incomplete
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const StatBox: React.FC<{ label: string; value: string; sub?: string; valueClass?: string }> = ({
  label,
  value,
  sub,
  valueClass = 'text-[#17243B] dark:text-[#F4F5F7]',
}) => (
  <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-3.5">
    <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] truncate">{label}</p>
    <p className={`text-lg font-mono font-semibold tabular-nums mt-1 ${valueClass}`}>{value}</p>
    {sub && <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] mt-0.5 truncate">{sub}</p>}
  </div>
);
