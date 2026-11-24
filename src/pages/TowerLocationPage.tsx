import React, { useState, useMemo, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { RotateCcw, Clock, ChevronLeft, ChevronRight, Lock, Play, Pause, Info } from 'lucide-react';
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

interface TowerLocationPageProps {
  user: AuthUser;
  activeCase: CaseRecord | null;
  cdrs: CDRRecord[];
  towers: CellTower[];
  onInspectCdr: (rec: CDRRecord) => void;
}

export const TowerLocationPage: React.FC<TowerLocationPageProps> = ({
  user,
  activeCase,
  cdrs,
  towers,
  onInspectCdr,
}) => {
  const { theme, t, chartTheme } = usePreferences();
  const isDark = theme === 'dark';
  const isViewer = user.role === 'Viewer';

  const [filters, setFilters] = useState<ForensicFilters>(() =>
    createDefaultFilters({
      suspectPhone: activeCase?.suspects[0]?.phoneNumber || 'ALL',
    })
  );
  const [showSequencePath, setShowSequencePath] = useState(true);
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [focusedTimelineIndex, setFocusedTimelineIndex] = useState<number | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<1 | 2 | 4>(1);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    setFocusedTimelineIndex(null);
    setIsReplaying(false);
    setSelectedArea('ALL');
    if (activeCase && activeCase.suspects.length > 0) {
      setFilters(createDefaultFilters({ suspectPhone: activeCase.suspects[0].phoneNumber }));
    } else {
      setFilters(createDefaultFilters());
    }
  }, [activeCase?.id]);

  const filterOptions = useMemo(
    () => extractFilterOptions(activeCase, cdrs, [], towers),
    [activeCase, cdrs, towers]
  );

  const areaOptions = useMemo(
    () => Array.from(new Set(towers.map((tw) => tw.area).filter(Boolean))).sort(),
    [towers]
  );

  const towerById = useMemo(() => new Map(towers.map((tw) => [tw.cell_id, tw])), [towers]);

  const filteredCdrs = useMemo(() => {
    const base = filterCdrs(cdrs, filters);
    if (selectedArea === 'ALL') return base;
    return base.filter((r) => towerById.get(r.cell_id)?.area === selectedArea);
  }, [cdrs, filters, selectedArea, towerById]);

  const analytics = useMemo(() => {
    if (!activeCase) return null;
    return computeCaseAnalytics(activeCase, filteredCdrs, [], towers);
  }, [activeCase, filteredCdrs, towers]);

  const chronologicalTimeline = useMemo(() => {
    return [...filteredCdrs]
      .filter((r) => towerById.has(r.cell_id))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [filteredCdrs, towerById]);

  const visibleTimelineSlice = useMemo(
    () => chronologicalTimeline.slice(-40),
    [chronologicalTimeline]
  );

  useEffect(() => {
    if (
      focusedTimelineIndex !== null &&
      (focusedTimelineIndex < 0 || focusedTimelineIndex >= visibleTimelineSlice.length)
    ) {
      setFocusedTimelineIndex(null);
      setIsReplaying(false);
    }
  }, [visibleTimelineSlice.length, focusedTimelineIndex]);

  // Historical Replay timer (chronological stepping over recorded cell-tower events)
  useEffect(() => {
    if (!isReplaying || visibleTimelineSlice.length === 0) return;
    const intervalMs = replaySpeed === 4 ? 350 : replaySpeed === 2 ? 700 : 1200;
    const id = window.setInterval(() => {
      setFocusedTimelineIndex((prev) => {
        if (prev === null) return 0;
        if (prev >= visibleTimelineSlice.length - 1) {
          setIsReplaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [isReplaying, replaySpeed, visibleTimelineSlice.length]);

  const focusedEvent =
    focusedTimelineIndex !== null ? visibleTimelineSlice[focusedTimelineIndex] || null : null;

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !focusedEvent) return;
    const tw = towerById.get(focusedEvent.cell_id);
    if (tw) {
      map.panTo([tw.latitude, tw.longitude], { animate: true });
    }
  }, [focusedEvent, towerById]);

  const towerActivityChartData = useMemo(() => {
    if (!analytics) return [];
    return analytics.towerStats.slice(0, 8).map((ts) => ({
      tower: ts.cell_id,
      dayHits: Math.max(0, ts.totalHits - ts.nightHits),
      nightHits: ts.nightHits,
    }));
  }, [analytics]);

  const hasMapTarget = Boolean(activeCase && analytics);

  // Initialize Leaflet Map whenever map container mounts
  useEffect(() => {
    if (!hasMapTarget || !mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [26.895, 75.798],
      zoom: 12,
      scrollWheelZoom: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);
    const group = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = group;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, [hasMapTarget]);

  // Update distinct colored markers, coverage circles, and polyline when filters or theme change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layerGroupRef.current;
    if (!map || !group || !analytics) return;

    group.clearLayers();
    const boundsPoints: L.LatLngExpression[] = [];

    for (const tStat of analytics.towerStats) {
      const tower = towerById.get(tStat.cell_id);
      if (!tower) continue;
      const latLng: L.LatLngExpression = [tower.latitude, tower.longitude];
      boundsPoints.push(latLng);

      const isMultiSuspect = tStat.suspectLabels.length >= 2;
      const isHighNight = tStat.nightHits >= Math.max(2, Math.ceil(tStat.totalHits * 0.35));
      const markerFill = isMultiSuspect
        ? '#DC2626'
        : isHighNight
        ? '#EA580C'
        : '#2563EB';
      const circleFill = isMultiSuspect
        ? '#DC2626'
        : isHighNight
        ? '#EA580C'
        : '#0D9488';

      L.circle(latLng, {
        radius: Math.min(tower.coverage_radius_m, 1400),
        color: circleFill,
        weight: 1.2,
        opacity: 0.45,
        fillColor: circleFill,
        fillOpacity: isDark ? 0.18 : 0.12,
      }).addTo(group);

      const marker = L.circleMarker(latLng, {
        radius: Math.min(15, 7 + Math.sqrt(tStat.totalHits) * 1.4),
        color: '#FFFFFF',
        weight: 2,
        fillColor: markerFill,
        fillOpacity: 0.95,
      }).addTo(group);

      const popupEl = document.createElement('div');
      popupEl.style.fontSize = '12px';
      popupEl.style.minWidth = '195px';

      const idEl = document.createElement('div');
      idEl.style.fontWeight = '600';
      idEl.style.color = isDark ? '#F4F5F7' : '#17243B';
      idEl.textContent = tower.cell_id;

      const nameEl = document.createElement('div');
      nameEl.style.color = isDark ? '#C5A66A' : '#475569';
      nameEl.style.marginTop = '2px';
      nameEl.textContent = tower.tower_name;

      const metaEl = document.createElement('div');
      metaEl.style.marginTop = '6px';
      metaEl.style.fontFamily = 'monospace';
      metaEl.style.fontSize = '11px';
      metaEl.style.color = isDark ? '#CBD5E1' : '#334155';
      metaEl.style.whiteSpace = 'pre-line';
      metaEl.textContent = `Hits: ${tStat.totalHits} (${tStat.nightHits} night)\nOperator: ${tower.operator}\nSuspects: ${tStat.suspectLabels.join(', ') || 'None'}\nCoords: ${tower.latitude.toFixed(4)}, ${tower.longitude.toFixed(4)}`;

      popupEl.appendChild(idEl);
      popupEl.appendChild(nameEl);
      popupEl.appendChild(metaEl);
      marker.bindPopup(popupEl);
    }

    const hasFocusedEntity =
      filters.suspectPhone !== 'ALL' || filters.phoneNumber.trim().length > 0;
    if (showSequencePath && hasFocusedEntity && chronologicalTimeline.length >= 2) {
      const recentPath = chronologicalTimeline.slice(-24);
      const latLngs: L.LatLngExpression[] = [];
      for (const rec of recentPath) {
        const tw = towerById.get(rec.cell_id);
        if (tw) latLngs.push([tw.latitude, tw.longitude]);
      }
      if (latLngs.length >= 2) {
        L.polyline(latLngs, {
          color: '#C5A66A',
          weight: 3.5,
          opacity: 0.9,
          dashArray: '6, 6',
        }).addTo(group);
      }
    }

    // Highlight active replay tower with crisp gold ring
    if (focusedEvent) {
      const activeTw = towerById.get(focusedEvent.cell_id);
      if (activeTw) {
        L.circleMarker([activeTw.latitude, activeTw.longitude], {
          radius: 19,
          color: '#C5A66A',
          weight: 3.5,
          fillColor: '#C5A66A',
          fillOpacity: 0.22,
        }).addTo(group);
      }
    }

    if (boundsPoints.length > 0 && !focusedEvent) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [36, 36], maxZoom: 13 });
    }
  }, [
    analytics,
    towerById,
    showSequencePath,
    filters.suspectPhone,
    filters.phoneNumber,
    chronologicalTimeline,
    focusedEvent,
    isDark,
  ]);

  if (!activeCase || !analytics) {
    return (
      <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-10 text-center space-y-2">
        <h2 className="text-base font-semibold text-[#17243B] dark:text-[#F4F5F7]">
          No Active Case Selected for Tower &amp; Location Replay
        </h2>
        <p className="text-xs text-[#64748B] dark:text-[#8993A5]">
          {isViewer
            ? 'Create a personal complaint/case and import your CDR records to explore cell tower locations and timeline replay.'
            : 'Select an assigned case from the top selector to view cell tower maps and chronological replay.'}
        </p>
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

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('towers.title')}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-1">{t('towers.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFilters(
              createDefaultFilters({
                suspectPhone: activeCase.suspects[0]?.phoneNumber || 'ALL',
              })
            );
            setShowSequencePath(true);
          }}
          className="h-9 px-3.5 text-xs font-medium bg-white dark:bg-[#17243B] text-[#17243B] dark:text-[#F4F5F7] border border-[#CBD2DE] dark:border-[#2A3F63] rounded inline-flex items-center gap-1.5 self-start sm:self-auto hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {t('towers.defaultViewBtn')}
        </button>
      </div>

      {/* Unified Forensic Filter Bar */}
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
          'nightOnly',
        ]}
        resultSummary={`${analytics.towerStats.length} towers · ${chronologicalTimeline.length} events (${filteredCdrs.length}/${cdrs.length} CDR)`}
        onChange={setFilters}
        onReset={() => {
          setFilters(createDefaultFilters());
          setSelectedArea('ALL');
          setFocusedTimelineIndex(null);
          setIsReplaying(false);
          setShowSequencePath(true);
        }}
        extraControls={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-[#17243B] dark:text-[#F4F5F7]">
                <input
                  type="checkbox"
                  checked={showSequencePath}
                  onChange={(e) => setShowSequencePath(e.target.checked)}
                  className="rounded border-[#CBD2DE] dark:border-[#2A3F63]"
                />
                {t('towers.showPath')}
              </label>
              <div className="inline-flex items-center gap-2">
                <span className="text-[11px] font-medium text-[#64748B] dark:text-[#8993A5]">
                  Area Filter:
                </span>
                <select
                  value={selectedArea}
                  onChange={(e) => {
                    setSelectedArea(e.target.value);
                    setFocusedTimelineIndex(null);
                    setIsReplaying(false);
                  }}
                  className="h-7 px-2 text-xs bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2A3F63] text-[#17243B] dark:text-[#F4F5F7] rounded"
                >
                  <option value="ALL">All Areas ({areaOptions.length})</option>
                  {areaOptions.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <span className="text-[11px] font-mono text-[#64748B] dark:text-[#8993A5]">
              {filters.suspectPhone !== 'ALL' || filters.phoneNumber.trim()
                ? t('towers.pathActive')
                : t('towers.pathHint')}
            </span>
          </div>
        }
      />

      {/* Recorded vs. Inferred Forensic Distinction Banner */}
      <div className="px-4 py-2.5 bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2 text-[#475569] dark:text-[#CBD5E1]">
          <Info className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-[#17243B] dark:text-[#F4F5F7]">Recorded Data:</strong> Serving Cell ID, approximate tower sector coordinates, and historical CDR timestamps.{' '}
            <strong className="text-[#17243B] dark:text-[#F4F5F7]">Inferred Visual:</strong> Dashed chronological path connects sequential serving towers for historical replay only — not real-time GPS tracking.
          </p>
        </div>
      </div>

      {/* Map + Timeline Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded overflow-hidden flex flex-col">
          {/* Interactive Map Legend Header */}
          <div className="px-4 py-2.5 border-b border-[#E2E7EF] dark:border-[#243656] bg-[#F5F7FA] dark:bg-[#131F35] flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#475569] dark:text-[#9AA6BA]">
            <span className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('towers.legendTitle')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
              {t('towers.legendOverlap')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C]" />
              {t('towers.legendNight')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
              {t('towers.legendStandard')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-[#C5A66A]" />
              {t('towers.legendPath')}
            </span>
          </div>
          <div ref={mapContainerRef} className="w-full h-[465px]" />
        </div>

        {/* Chronological Tower Sequence with Interactive Read-Only Timeline Navigation */}
        <aside className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded flex flex-col h-[505px]">
          <div className="px-5 py-3.5 border-b border-[#E2E7EF] dark:border-[#243656] space-y-2.5">
            <div>
              <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {t('towers.sequenceTitle', { count: chronologicalTimeline.length })}
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
                {t('towers.sequenceSub')}
              </p>
            </div>

            {visibleTimelineSlice.length > 0 && (
              <div className="pt-2 border-t border-[#E2E7EF] dark:border-[#243656] space-y-2">
                <div className="flex items-center justify-between gap-1.5 text-[11px]">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (isReplaying) {
                          setIsReplaying(false);
                        } else {
                          if (
                            focusedTimelineIndex === null ||
                            focusedTimelineIndex >= visibleTimelineSlice.length - 1
                          ) {
                            setFocusedTimelineIndex(0);
                          }
                          setIsReplaying(true);
                        }
                      }}
                      className="h-7 px-2.5 rounded bg-[#17243B] dark:bg-[#C5A66A] text-white dark:text-[#101A30] hover:opacity-90 inline-flex items-center gap-1 font-medium"
                    >
                      {isReplaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      {isReplaying ? 'Pause' : 'Replay'}
                    </button>
                    <select
                      value={replaySpeed}
                      onChange={(e) => setReplaySpeed(Number(e.target.value) as 1 | 2 | 4)}
                      aria-label="Replay speed"
                      className="h-7 px-1.5 rounded border border-[#CBD2DE] dark:border-[#2A3F63] bg-white dark:bg-[#101A30] text-[#17243B] dark:text-[#F4F5F7] font-mono text-[10px]"
                    >
                      <option value={1}>1x</option>
                      <option value={2}>2x</option>
                      <option value={4}>4x</option>
                    </select>
                  </div>
                  <span className="font-mono text-[10px] text-[#64748B] dark:text-[#8993A5] tabular-nums">
                    {focusedTimelineIndex !== null
                      ? t('towers.timelinePos', {
                          current: focusedTimelineIndex + 1,
                          total: visibleTimelineSlice.length,
                        })
                      : t('towers.timelineAll')}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsReplaying(false);
                        setFocusedTimelineIndex((prev) =>
                          prev === null ? 0 : Math.max(0, prev - 1)
                        );
                      }}
                      disabled={focusedTimelineIndex === 0}
                      aria-label={t('towers.timelinePrev')}
                      className="h-7 px-1.5 rounded border border-[#CBD2DE] dark:border-[#2A3F63] bg-[#F8F8F6] dark:bg-[#101A30] text-[#17243B] dark:text-[#F4F5F7] disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsReplaying(false);
                        setFocusedTimelineIndex((prev) =>
                          prev === null
                            ? 0
                            : Math.min(visibleTimelineSlice.length - 1, prev + 1)
                        );
                      }}
                      disabled={focusedTimelineIndex === visibleTimelineSlice.length - 1}
                      aria-label={t('towers.timelineNext')}
                      className="h-7 px-1.5 rounded border border-[#CBD2DE] dark:border-[#2A3F63] bg-[#F8F8F6] dark:bg-[#101A30] text-[#17243B] dark:text-[#F4F5F7] disabled:opacity-40"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, visibleTimelineSlice.length - 1)}
                  value={focusedTimelineIndex ?? Math.max(0, visibleTimelineSlice.length - 1)}
                  onChange={(e) => {
                    setIsReplaying(false);
                    setFocusedTimelineIndex(Number(e.target.value));
                  }}
                  aria-label="Timeline event scrubber"
                  className="w-full h-1.5 accent-[#17243B] dark:accent-[#C5A66A] cursor-pointer"
                />
              </div>
            )}

            {isViewer && (
              <p className="text-[10px] text-[#64748B] dark:text-[#9AA6BA] flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-[#A88748] dark:text-[#C5A66A] shrink-0" />
                <span>{t('viewer.timelineReadOnlyHint')}</span>
              </p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[#E2E7EF] dark:divide-[#243656] text-xs">
            {visibleTimelineSlice.length === 0 ? (
              <p className="p-5 text-[#64748B] dark:text-[#8993A5]">{t('towers.noEvents')}</p>
            ) : (
              visibleTimelineSlice.map((rec, idx) => {
                const tower = towerById.get(rec.cell_id);
                const isFocused = focusedTimelineIndex === idx;
                return (
                  <button
                    key={rec.record_id}
                    type="button"
                    onClick={() => {
                      setIsReplaying(false);
                      setFocusedTimelineIndex(idx);
                      onInspectCdr(rec);
                    }}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 ${
                      isFocused
                        ? 'bg-[#F7F2E7] dark:bg-[#1E2E4A] ring-1 ring-inset ring-[#C5A66A]/60'
                        : 'hover:bg-[#F8F8F6] dark:hover:bg-[#101A30]'
                    }`}
                  >
                    <span className="w-5 h-5 rounded bg-[#101A30] dark:bg-[#C5A66A] text-[#C5A66A] dark:text-[#101A30] font-mono text-[10px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          {rec.cell_id}
                        </span>
                        <span className="font-mono text-[10px] text-[#64748B] dark:text-[#8993A5] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {rec.timestamp.slice(5, 19).replace('T', ' ')}
                        </span>
                      </div>
                      <p className="text-[#475569] dark:text-[#CBD5E1] truncate mt-0.5">
                        {tower?.area || 'Cell Sector'} · {rec.call_type} ({rec.duration_seconds}s)
                      </p>
                      <p className="text-[11px] font-mono text-[#64748B] dark:text-[#8993A5] truncate">
                        {rec.caller_number} {'->'} {rec.receiver_number}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      </div>

      {/* Time-Based Tower Activity Chart */}
      <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('towers.chartTitle')}
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#8993A5]">{t('towers.chartSub')}</p>
        </div>
        <div className="h-[220px]">
          {towerActivityChartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[#64748B] dark:text-[#8993A5]">
              {t('towers.noEvents')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={towerActivityChartData} margin={{ top: 6, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                <XAxis dataKey="tower" tick={{ fontSize: 10, fill: chartTheme.axisTick }} />
                <YAxis tick={{ fontSize: 11, fill: chartTheme.axisTick }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  dataKey="dayHits"
                  name={t('towers.dayHits')}
                  stackId="a"
                  fill={chartTheme.incoming}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="nightHits"
                  name={t('towers.nightHits')}
                  stackId="a"
                  fill={chartTheme.warning}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Tower Usage Frequency Table */}
      <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
        <div className="px-5 py-3.5 border-b border-[#E2E7EF] dark:border-[#243656]">
          <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('towers.tableTitle')}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F5F7FA] dark:bg-[#131F35] border-b border-[#E2E7EF] dark:border-[#243656] text-[11px] text-[#64748B] dark:text-[#8993A5]">
                <th className="py-2.5 px-4">{t('towers.colTowerId')}</th>
                <th className="py-2.5 px-4">{t('towers.colSector')}</th>
                <th className="py-2.5 px-4">{t('cases.colOperator')}</th>
                <th className="py-2.5 px-4 text-right">{t('towers.colTotalHits')}</th>
                <th className="py-2.5 px-4 text-right">{t('towers.colNightHits')}</th>
                <th className="py-2.5 px-4">{t('towers.colSuspects')}</th>
                <th className="py-2.5 px-4">{t('towers.colCoords')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E7EF] dark:divide-[#243656]">
              {analytics.towerStats.map((ts) => (
                <tr key={ts.cell_id} className="hover:bg-[#F5F7FA] dark:hover:bg-[#101A30]">
                  <td className="py-2.5 px-4 font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                    {ts.cell_id}
                  </td>
                  <td className="py-2.5 px-4 text-[#334155] dark:text-[#CBD5E1]">{ts.tower_name}</td>
                  <td className="py-2.5 px-4 text-[#475569] dark:text-[#9AA6BA]">{ts.operator}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                    {ts.totalHits}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#EA580C] dark:text-[#FB923C]">
                    {ts.nightHits}
                  </td>
                  <td className="py-2.5 px-4 text-[#334155] dark:text-[#CBD5E1]">
                    {ts.suspectLabels.length > 0 ? ts.suspectLabels.join(', ') : '—'}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-[#64748B] dark:text-[#8993A5]">
                    {ts.latitude.toFixed(4)}, {ts.longitude.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
