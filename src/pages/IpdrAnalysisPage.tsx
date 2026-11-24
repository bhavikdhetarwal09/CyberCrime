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
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { CaseRecord, IPDRRecord } from '../shared/types';
import {
  createDefaultFilters,
  extractFilterOptions,
  filterIpdrs,
  ForensicFilters,
} from '../shared/filtering';
import { ForensicFilterBar } from '../components/ForensicFilterBar';
import { usePreferences } from '../lib/preferences';

interface IpdrAnalysisPageProps {
  activeCase: CaseRecord | null;
  ipdrs: IPDRRecord[];
  onInspectIpdr: (rec: IPDRRecord) => void;
}

export const IpdrAnalysisPage: React.FC<IpdrAnalysisPageProps> = ({
  activeCase,
  ipdrs,
  onInspectIpdr,
}) => {
  const { t, chartTheme } = usePreferences();
  const [filters, setFilters] = useState<ForensicFilters>(() => createDefaultFilters());
  const [sortBy, setSortBy] = useState<
    'session_start' | 'source_port' | 'destination_port' | 'protocol' | 'bytes_transferred'
  >('session_start');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sessionViewMode, setSessionViewMode] = useState<
    'all' | 'unmapped' | 'shared_nat' | 'duplicates'
  >('all');
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setFilters(createDefaultFilters());
    setSessionViewMode('all');
    setPage(1);
  }, [activeCase?.id]);

  const filterOptions = useMemo(
    () => extractFilterOptions(activeCase, [], ipdrs, []),
    [activeCase, ipdrs]
  );

  const baseFilteredIpdrs = useMemo(() => filterIpdrs(ipdrs, filters), [ipdrs, filters]);

  const { duplicateSessionIds, sharedNatIps } = useMemo(() => {
    const sigBuckets = new Map<string, string[]>();
    const ipSubs = new Map<string, Set<string>>();
    for (const r of baseFilteredIpdrs) {
      const sig = `${r.public_ip}|${r.source_port}|${r.destination_ip}|${r.destination_port}|${r.session_start}`;
      const bucket = sigBuckets.get(sig) || [];
      bucket.push(r.record_id);
      sigBuckets.set(sig, bucket);
      const subSet = ipSubs.get(r.public_ip) || new Set<string>();
      subSet.add(r.subscriber_id);
      ipSubs.set(r.public_ip, subSet);
    }
    const dups = new Set<string>();
    for (const ids of sigBuckets.values()) {
      if (ids.length > 1) ids.forEach((id) => dups.add(id));
    }
    const shared = new Set<string>();
    for (const [ip, subs] of ipSubs.entries()) {
      if (subs.size > 1) shared.add(ip);
    }
    return { duplicateSessionIds: dups, sharedNatIps: shared };
  }, [baseFilteredIpdrs]);

  const filteredIpdrs = useMemo(() => {
    const scoped =
      sessionViewMode === 'unmapped'
        ? baseFilteredIpdrs.filter((r) => r.subscriber_id.includes('Unmapped'))
        : sessionViewMode === 'shared_nat'
        ? baseFilteredIpdrs.filter((r) => sharedNatIps.has(r.public_ip))
        : sessionViewMode === 'duplicates'
        ? baseFilteredIpdrs.filter((r) => duplicateSessionIds.has(r.record_id))
        : baseFilteredIpdrs;

    return [...scoped].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'source_port') return (a.source_port - b.source_port) * mul;
      if (sortBy === 'destination_port') return (a.destination_port - b.destination_port) * mul;
      if (sortBy === 'bytes_transferred') return (a.bytes_transferred - b.bytes_transferred) * mul;
      if (sortBy === 'protocol') return a.protocol.localeCompare(b.protocol) * mul;
      return a.session_start.localeCompare(b.session_start) * mul;
    });
  }, [baseFilteredIpdrs, sessionViewMode, sharedNatIps, duplicateSessionIds, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredIpdrs.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedIpdrs = filteredIpdrs.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  const renderSortIcon = (col: typeof sortBy) => {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 opacity-60" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#101A30] dark:text-[#C5A66A]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#101A30] dark:text-[#C5A66A]" />
    );
  };

  const timelineSeries = useMemo(() => {
    const map = new Map<string, { date: string; mapped: number; unmapped: number }>();
    filteredIpdrs.forEach((r) => {
      const date = r.session_start.slice(0, 10);
      const entry = map.get(date) || { date, mapped: 0, unmapped: 0 };
      if (r.subscriber_id.includes('Unmapped')) entry.unmapped += 1;
      else entry.mapped += 1;
      map.set(date, entry);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredIpdrs]);

  const protocolSeries = useMemo(() => {
    const map = new Map<string, number>();
    filteredIpdrs.forEach((r) => map.set(r.protocol, (map.get(r.protocol) || 0) + 1));
    return Array.from(map.entries()).map(([protocol, count]) => ({ protocol, count }));
  }, [filteredIpdrs]);

  const portSeries = useMemo(() => {
    const map = new Map<string, { port: string; count: number; service: string }>();
    filteredIpdrs.forEach((r) => {
      const k = String(r.destination_port);
      const prev = map.get(k) || { port: `Port ${k}`, count: 0, service: r.service_indicator };
      prev.count += 1;
      map.set(k, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [filteredIpdrs]);

  const publicIpSummary = useMemo(() => {
    const map = new Map<
      string,
      { ip: string; sessions: number; subscribers: Set<string>; totalBytes: number; lastSeen: string }
    >();
    filteredIpdrs.forEach((r) => {
      const entry = map.get(r.public_ip) || {
        ip: r.public_ip,
        sessions: 0,
        subscribers: new Set<string>(),
        totalBytes: 0,
        lastSeen: r.session_start,
      };
      entry.sessions += 1;
      entry.subscribers.add(r.subscriber_id);
      entry.totalBytes += r.bytes_transferred;
      if (r.session_start > entry.lastSeen) entry.lastSeen = r.session_start;
      map.set(r.public_ip, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.sessions - a.sessions);
  }, [filteredIpdrs]);

  const mappedCount = filteredIpdrs.filter((r) => r.subscriber_id !== 'Unmapped (CGNAT)').length;

  const tooltipStyle = {
    backgroundColor: chartTheme.tooltipBg,
    borderColor: chartTheme.tooltipBorder,
    color: chartTheme.tooltipText,
    fontSize: '12px',
    borderRadius: '6px',
  };

  if (!activeCase) {
    return (
      <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-10 text-center space-y-2">
        <h2 className="text-base font-semibold text-[#17243B] dark:text-[#F4F5F7]">
          No Active Case Selected for IPDR Analysis
        </h2>
        <p className="text-xs text-[#64748B] dark:text-[#8993A5]">
          Create a personal case or select an assigned investigation case from the top selector to analyze IP Detail Records.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('ipdr.title')}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-1">
            {t('ipdr.subtitle')}{' '}
            <span className="font-mono text-[#17243B] dark:text-[#C5A66A]">
              {activeCase?.caseNumber}
            </span>
            .
          </p>
        </div>
      </div>

      {/* Complete IPDR Filter Bar */}
      <ForensicFilterBar
        filters={filters}
        options={filterOptions}
        enabledFields={[
          'search',
          'dateRange',
          'timeRange',
          'suspect',
          'subscriberId',
          'publicIp',
          'sourcePort',
          'destinationPort',
          'protocol',
          'nightOnly',
        ]}
        searchPlaceholder={t('ipdr.searchPlaceholder')}
        resultSummary={`${filteredIpdrs.length} / ${ipdrs.length} IPDR`}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
        onReset={() => {
          setFilters(createDefaultFilters());
          setSessionViewMode('all');
          setPage(1);
        }}
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4">
          <p className="text-[#64748B] dark:text-[#8993A5]">{t('ipdr.kpiFiltered')}</p>
          <p className="text-xl font-mono font-semibold tabular-nums text-[#2563EB] dark:text-[#60A5FA] mt-1">
            {filteredIpdrs.length}
          </p>
        </div>
        <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4">
          <p className="text-[#64748B] dark:text-[#8993A5]">{t('ipdr.kpiPublicIps')}</p>
          <p className="text-xl font-mono font-semibold tabular-nums text-[#0D9488] dark:text-[#2DD4BF] mt-1">
            {publicIpSummary.length}
          </p>
        </div>
        <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4">
          <p className="text-[#64748B] dark:text-[#8993A5]">{t('ipdr.kpiMapped')}</p>
          <p className="text-xl font-mono font-semibold tabular-nums text-[#16A34A] dark:text-[#4ADE80] mt-1">
            {mappedCount}
          </p>
        </div>
        <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4">
          <p className="text-[#64748B] dark:text-[#8993A5]">{t('ipdr.kpiUnmapped')}</p>
          <p className="text-xl font-mono font-semibold tabular-nums text-[#EA580C] dark:text-[#FB923C] mt-1">
            {filteredIpdrs.length - mappedCount}
          </p>
        </div>
      </div>

      {/* Session Activity Timeline Chart */}
      <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('ipdr.timelineTitle')}
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#8993A5]">{t('ipdr.timelineSub')}</p>
        </div>
        <div className="h-[220px]">
          {timelineSeries.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[#64748B] dark:text-[#8993A5]">
              {t('common.noData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineSeries} margin={{ top: 8, right: 12, left: 0, bottom: 16 }}>
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
                <YAxis
                  tick={{ fontSize: 11, fill: chartTheme.axisTick }}
                  label={{
                    value: t('ipdr.axisSessions'),
                    angle: -90,
                    position: 'insideLeft',
                    fill: chartTheme.axisLabel,
                    fontSize: 10,
                  }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                <Area
                  type="monotone"
                  dataKey="mapped"
                  name={t('ipdr.mappedSessions')}
                  stackId="1"
                  stroke={chartTheme.outgoing}
                  fill={chartTheme.outgoing}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="unmapped"
                  name={t('ipdr.unmappedSessions')}
                  stackId="1"
                  stroke={chartTheme.warning}
                  fill={chartTheme.warning}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Charts + Public IP Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5">
          <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('ipdr.protocolTitle')}
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#8993A5] mb-3">
            {t('ipdr.protocolSub')}
          </p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={protocolSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                <XAxis dataKey="protocol" tick={{ fontSize: 11, fill: chartTheme.axisTick }} />
                <YAxis tick={{ fontSize: 11, fill: chartTheme.axisTick }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name={t('ipdr.axisSessions')} radius={[4, 4, 0, 0]}>
                  {protocolSeries.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={chartTheme.protocolColors[idx % chartTheme.protocolColors.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5">
          <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('ipdr.portTitle')}
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#8993A5] mb-3">{t('ipdr.portSub')}</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={portSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                <XAxis dataKey="port" tick={{ fontSize: 10, fill: chartTheme.axisTick }} />
                <YAxis tick={{ fontSize: 11, fill: chartTheme.axisTick }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="count"
                  name={t('ipdr.axisSessions')}
                  fill={chartTheme.gold}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
          <div className="px-5 py-3.5 border-b border-[#E2E7EF] dark:border-[#243656] flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {t('ipdr.natSummaryTitle')}
              </h2>
              <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                Click a Public IP to filter sessions
              </p>
            </div>
            {filters.publicIp && (
              <button
                type="button"
                onClick={() => {
                  setFilters((f) => ({ ...f, publicIp: '' }));
                  setPage(1);
                }}
                className="text-[11px] font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline whitespace-nowrap"
              >
                Clear IP
              </button>
            )}
          </div>
          <div className="divide-y divide-[#E2E7EF] dark:divide-[#243656] text-xs max-h-[260px] overflow-y-auto">
            {publicIpSummary.map((item) => {
              const isSelectedIp = filters.publicIp === item.ip;
              const isSharedNat = item.subscribers.size > 1;
              return (
                <button
                  key={item.ip}
                  type="button"
                  onClick={() => {
                    setFilters((f) => ({ ...f, publicIp: f.publicIp === item.ip ? '' : item.ip }));
                    setPage(1);
                  }}
                  className={`w-full text-left px-5 py-3 flex items-center justify-between gap-3 transition-colors ${
                    isSelectedIp
                      ? 'bg-[#EEF4FC] dark:bg-[#101A30]'
                      : 'hover:bg-[#F8F8F6] dark:hover:bg-[#131F35]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7] truncate">
                      {item.ip}
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                      {item.subscribers.size} mapping(s) · {(item.totalBytes / 1024 / 1024).toFixed(1)} MB
                      {isSharedNat && (
                        <span className="ml-1 text-[#A88748] dark:text-[#C5A66A] font-medium">
                          · Shared CGNAT
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-[#2563EB] dark:text-[#60A5FA] shrink-0">
                    {item.sessions}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* IPDR Sessions Table */}
      <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
        <div className="px-5 py-3.5 border-b border-[#E2E7EF] dark:border-[#243656] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('ipdr.tableTitle', { count: filteredIpdrs.length })}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#8993A5]">{t('ipdr.tableSub')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="inline-flex items-center p-0.5 bg-[#F5F5F2] dark:bg-[#101A30] border border-[#E2E7EF] dark:border-[#243656] rounded">
              {(
                [
                  { id: 'all', label: `All (${baseFilteredIpdrs.length})` },
                  {
                    id: 'unmapped',
                    label: `Unmapped (${baseFilteredIpdrs.filter((r) => r.subscriber_id.includes('Unmapped')).length})`,
                  },
                  {
                    id: 'shared_nat',
                    label: `Shared NAT (${baseFilteredIpdrs.filter((r) => sharedNatIps.has(r.public_ip)).length})`,
                  },
                  { id: 'duplicates', label: `Duplicates (${duplicateSessionIds.size})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSessionViewMode(tab.id);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors ${
                    sessionViewMode === tab.id
                      ? 'bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30]'
                      : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#17243B] dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="ipdr-page-size" className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                Rows:
              </label>
              <select
                id="ipdr-page-size"
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
              <span className="text-xs font-mono tabular-nums text-[#64748B] dark:text-[#8993A5] shrink-0">
                {t('common.pageOf', { page: safePage, total: totalPages })}
              </span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8F8F6] dark:bg-[#131F35] border-b border-[#E2E7EF] dark:border-[#243656] text-[11px] text-[#64748B] dark:text-[#8993A5]">
                <th className="py-2.5 px-4">{t('cdr.colRecordId')}</th>
                <th className="py-2.5 px-4">{t('ipdr.colSubMapping')}</th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('source_port')}
                    className="inline-flex items-center gap-1 hover:text-[#17243B] dark:hover:text-white whitespace-nowrap"
                  >
                    {t('ipdr.colPubIpPort')} {renderSortIcon('source_port')}
                  </button>
                </th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('destination_port')}
                    className="inline-flex items-center gap-1 hover:text-[#17243B] dark:hover:text-white whitespace-nowrap"
                  >
                    {t('ipdr.colDstIpPort')} {renderSortIcon('destination_port')}
                  </button>
                </th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('protocol')}
                    className="inline-flex items-center gap-1 hover:text-[#17243B] dark:hover:text-white whitespace-nowrap"
                  >
                    {t('ipdr.colProtocol')} {renderSortIcon('protocol')}
                  </button>
                </th>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('session_start')}
                    className="inline-flex items-center gap-1 hover:text-[#17243B] dark:hover:text-white whitespace-nowrap"
                  >
                    {t('ipdr.colWindow')} {renderSortIcon('session_start')}
                  </button>
                </th>
                <th className="py-2.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('bytes_transferred')}
                    className="inline-flex items-center gap-1 hover:text-[#17243B] dark:hover:text-white whitespace-nowrap"
                  >
                    Volume {renderSortIcon('bytes_transferred')}
                  </button>
                </th>
                <th className="py-2.5 px-4">{t('ipdr.colService')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E7EF] dark:divide-[#243656]">
              {paginatedIpdrs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#64748B] dark:text-[#8993A5]">
                    {t('ipdr.noRows')}
                  </td>
                </tr>
              ) : (
                paginatedIpdrs.map((r) => (
                  <tr
                    key={r.record_id}
                    onClick={() => onInspectIpdr(r)}
                    className="hover:bg-[#F8F8F6] dark:hover:bg-[#101A30] cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-[#475569] dark:text-[#9AA6BA]">
                      {r.record_id}
                      {duplicateSessionIds.has(r.record_id) && (
                        <span className="ml-1.5 font-sans text-[10px] font-semibold text-[#DC2626] dark:text-[#F87171]">
                          · Dup
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-2.5 px-4 font-mono ${
                        r.subscriber_id.includes('Unmapped')
                          ? 'text-[#EA580C] dark:text-[#FB923C]'
                          : 'text-[#16A34A] dark:text-[#4ADE80] font-medium'
                      }`}
                    >
                      {r.subscriber_id}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
                      {r.public_ip}:{r.source_port}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-[#475569] dark:text-[#CBD5E1]">
                      {r.destination_ip}:{r.destination_port}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                      {r.protocol}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-[#475569] dark:text-[#9AA6BA]">
                      {r.session_start.slice(5, 19).replace('T', ' ')} →{' '}
                      {r.session_end.slice(11, 19)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
                      {r.bytes_transferred >= 1024 * 1024
                        ? `${(r.bytes_transferred / (1024 * 1024)).toFixed(2)} MB`
                        : `${Math.round(r.bytes_transferred / 1024)} KB`}
                    </td>
                    <td className="py-2.5 px-4 text-[#475569] dark:text-[#CBD5E1]">
                      {r.service_indicator}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-[#E2E7EF] dark:border-[#243656] flex items-center justify-between text-xs">
            <span className="font-mono tabular-nums text-[#64748B] dark:text-[#8993A5]">
              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredIpdrs.length)} /{' '}
              {filteredIpdrs.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 border border-[#CBD2DE] dark:border-[#2A3F63] rounded disabled:opacity-40 hover:bg-[#F5F5F2] dark:hover:bg-[#101A30] text-[#17243B] dark:text-[#F4F5F7]"
              >
                {t('common.previous')}
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 border border-[#CBD2DE] dark:border-[#2A3F63] rounded disabled:opacity-40 hover:bg-[#F5F5F2] dark:hover:bg-[#101A30] text-[#17243B] dark:text-[#F4F5F7]"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
