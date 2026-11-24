import React, { useState, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  NodeProps,
} from '@xyflow/react';
import {
  RotateCcw,
  ShieldAlert,
  ExternalLink,
  Download,
  ImageDown,
  Check,
  User,
  Phone,
  Share2,
  Sparkles,
  Globe,
  Info,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { CaseRecord, CDRRecord, CellTower } from '../shared/types';
import { formatDuration } from '../shared/analytics';
import {
  ForensicFilters,
  createDefaultFilters,
  extractFilterOptions,
  filterCdrs,
} from '../shared/filtering';
import { ForensicFilterBar } from '../components/ForensicFilterBar';
import { usePreferences } from '../lib/preferences';

interface ContactNetworkPageProps {
  activeCase: CaseRecord | null;
  cdrs: CDRRecord[];
  towers: CellTower[];
  onInspectCdr: (rec: CDRRecord) => void;
  onCaptureGraphSnapshot?: (caseId: string, pngDataUrl: string) => void;
}

interface NodeMeta {
  phoneNumber: string;
  roleType: 'SUSPECT' | 'COMMON_BRIDGE' | 'PERIPHERAL';
  label: string;
  connectedSuspects: string[];
  totalCalls: number;
  totalDuration: number;
}

interface EdgeMeta {
  id: string;
  a: string;
  b: string;
  count: number;
  duration: number;
  nightCount: number;
}

interface CircularContactNodeData {
  meta: NodeMeta;
  isSuspect: boolean;
  isBridge: boolean;
  isMatch: boolean;
  isSelected: boolean;
  isDimmed: boolean;
  isDark: boolean;
  suspectLabel?: string;
  [key: string]: unknown;
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Linkurious-Style Circular Node Component
 * Renders an elevated circular icon node with high-contrast badge & clean label underneath.
 */
const CircularContactNode: React.FC<NodeProps<Node<CircularContactNodeData>>> = ({ data }) => {
  const { meta, isSuspect, isBridge, isMatch, isSelected, isDimmed, isDark, suspectLabel } = data;

  let circleBg = isDark ? '#17243B' : '#FFFFFF';
  let iconColor = isDark ? '#38BDF8' : '#0284C7';
  let circleBorder = isDark ? '2.5px solid #0284C7' : '2.5px solid #0284C7';
  let badgeBg = isDark ? '#0F1E36' : '#EFF6FF';
  let badgeColor = isDark ? '#38BDF8' : '#1D4ED8';
  let badgeBorder = isDark ? '#1E3A5F' : '#BFDBFE';

  if (isSuspect) {
    circleBg = '#101A30';
    iconColor = '#C5A66A';
    circleBorder = '3px solid #C5A66A';
    badgeBg = '#C5A66A';
    badgeColor = '#101A30';
    badgeBorder = '#D4AF37';
  } else if (isBridge) {
    circleBg = isDark ? '#2C1808' : '#FFF7ED';
    iconColor = isDark ? '#FB923C' : '#EA580C';
    circleBorder = isDark ? '2.5px solid #F97316' : '2.5px solid #EA580C';
    badgeBg = isDark ? '#7C2D12' : '#FFEDD5';
    badgeColor = isDark ? '#FFEDD5' : '#9A3412';
    badgeBorder = isDark ? '#9A3412' : '#FDBA74';
  }

  if (isMatch || isSelected) {
    circleBorder = '3px solid #DC2626';
  }

  const primaryLabel = isSuspect ? suspectLabel || 'Suspect' : isBridge ? 'Shared Contact' : meta.phoneNumber;
  const secondaryLabel = isSuspect
    ? meta.phoneNumber
    : isBridge
    ? `${meta.connectedSuspects.length} Suspects`
    : `${meta.totalCalls} calls`;

  const IconComponent = isSuspect ? ShieldAlert : isBridge ? Share2 : Phone;

  return (
    <div
      className="relative flex flex-col items-center group cursor-pointer select-none"
      style={{
        opacity: isDimmed ? 0.2 : 1,
        transition: 'opacity 200ms ease, transform 150ms ease',
        transform: isSelected ? 'scale(1.08)' : undefined,
      }}
    >
      {/* Target & Source Handles anchored at exact center of 52px circle */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          top: 26,
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 2,
          height: 2,
          opacity: 0,
          pointerEvents: 'none',
          border: 'none',
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          top: 26,
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 2,
          height: 2,
          opacity: 0,
          pointerEvents: 'none',
          border: 'none',
        }}
      />

      {/* 52px Circular Node */}
      <div
        className="relative w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all duration-200 shadow-md"
        style={{
          backgroundColor: circleBg,
          border: circleBorder,
          boxShadow: isSelected
            ? '0 0 0 4px rgba(220, 38, 38, 0.4), 0 6px 14px rgba(0,0,0,0.25)'
            : '0 2px 8px rgba(0,0,0,0.12)',
        }}
      >
        <IconComponent className="w-5 h-5 shrink-0" style={{ color: iconColor }} />

        {/* Call count badge pill */}
        <span
          className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold leading-none border shadow-xs"
          style={{
            backgroundColor: badgeBg,
            color: badgeColor,
            borderColor: badgeBorder,
          }}
        >
          {meta.totalCalls}
        </span>
      </div>

      {/* Label Underneath with protective background chip */}
      <div className="mt-1.5 flex flex-col items-center max-w-[135px] pointer-events-none text-center">
        <span
          className="text-[11px] font-semibold leading-tight truncate w-full px-1.5 py-0.5 rounded bg-white/95 dark:bg-[#101A30]/95 shadow-xs border border-[#CBD5E1]/60 dark:border-[#2D4063]/60"
          style={{ color: isDark ? '#F4F5F7' : '#0F172A' }}
          title={meta.label}
        >
          {primaryLabel}
        </span>
        <span
          className="text-[10px] font-mono leading-tight mt-0.5 truncate w-full px-1 py-0.5 rounded bg-[#F8FAFC]/90 dark:bg-[#17243B]/90 text-[#64748B] dark:text-[#94A3B8]"
        >
          {secondaryLabel}
        </span>
      </div>
    </div>
  );
};

const nodeTypes = {
  circularContact: CircularContactNode,
};

/**
 * Simplified Clean Network Layout
 * Distributes nodes cleanly inside the visible canvas without crossing lines:
 * - Suspects are placed at the primary focal centers.
 * - Common Bridges (shared contacts linking multiple suspects) are placed neatly between them.
 * - Key Peripheral Contacts are placed as clean satellites in the outer hemisphere of their linked suspect.
 * - Eliminates crossing spiderweb lines, provides generous 160-220px node spacing, and stays within canvas bounds.
 */
function computeSimplifiedNetworkLayout(
  suspectNodes: NodeMeta[],
  bridgeNodes: NodeMeta[],
  peripheralNodes: NodeMeta[],
  edges: { a: string; b: string }[],
  bounds = { width: 840, height: 560 }
): Map<string, { x: number; y: number }> {
  const posMap = new Map<string, { x: number; y: number }>();
  const allNodes = [...suspectNodes, ...bridgeNodes, ...peripheralNodes];
  if (allNodes.length === 0) return posMap;

  const cx = bounds.width / 2;
  const cy = bounds.height / 2;

  const numSus = suspectNodes.length;
  const susPositions = new Map<string, { x: number; y: number }>();

  // 1. Position Suspects as the central anchors
  if (numSus <= 1) {
    const s = suspectNodes[0] || allNodes[0];
    const pos = { x: cx, y: cy };
    susPositions.set(s.phoneNumber, pos);
    posMap.set(s.phoneNumber, { x: Math.round(pos.x - 26), y: Math.round(pos.y - 26) });
  } else if (numSus === 2) {
    // Two suspects: placed symmetrically at (cx - 140, cy) and (cx + 140, cy) -> 280px apart!
    suspectNodes.forEach((s, idx) => {
      const pos = { x: idx === 0 ? cx - 140 : cx + 140, y: cy };
      susPositions.set(s.phoneNumber, pos);
      posMap.set(s.phoneNumber, { x: Math.round(pos.x - 26), y: Math.round(pos.y - 26) });
    });
  } else {
    // 3+ suspects: placed on an inner circle of radius 120-150px
    const susRadius = Math.max(120, Math.min(150, numSus * 38));
    suspectNodes.forEach((s, idx) => {
      const angle = (2 * Math.PI * idx) / numSus - Math.PI / 2;
      const pos = { x: cx + susRadius * Math.cos(angle), y: cy + susRadius * Math.sin(angle) };
      susPositions.set(s.phoneNumber, pos);
      posMap.set(s.phoneNumber, { x: Math.round(pos.x - 26), y: Math.round(pos.y - 26) });
    });
  }

  // 2. Position Common Bridges (Shared Contacts between suspects)
  const numBridges = bridgeNodes.length;
  bridgeNodes.forEach((b, idx) => {
    if (numSus === 2) {
      // In 2-suspect cases, stagger bridges along vertical centerline x = cx!
      const slot = idx % 2 === 0 ? -1 : 1;
      const step = Math.floor(idx / 2);
      const targetY = Math.max(70, Math.min(bounds.height - 70, cy + slot * (135 + step * 75)));
      posMap.set(b.phoneNumber, { x: Math.round(cx - 26), y: Math.round(targetY - 26) });
    } else {
      const linkedSus = suspectNodes.filter(
        (s) => b.connectedSuspects.includes(s.label) || b.connectedSuspects.includes(s.phoneNumber)
      );
      if (linkedSus.length >= 2) {
        const avgX = linkedSus.reduce((acc, s) => acc + (susPositions.get(s.phoneNumber)?.x || cx), 0) / linkedSus.length;
        const avgY = linkedSus.reduce((acc, s) => acc + (susPositions.get(s.phoneNumber)?.y || cy), 0) / linkedSus.length;
        const dirX = avgX - cx;
        const dirY = avgY - cy;
        const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        const bridgeDist = 130 + (idx % 2) * 45;
        const bx = cx + (dirX / len) * bridgeDist;
        const by = cy + (dirY / len) * bridgeDist;
        posMap.set(b.phoneNumber, {
          x: Math.round(Math.max(65, Math.min(bounds.width - 65, bx)) - 26),
          y: Math.round(Math.max(65, Math.min(bounds.height - 65, by)) - 26),
        });
      } else {
        const angle = (2 * Math.PI * idx) / Math.max(1, numBridges) + 0.35;
        const bx = cx + 160 * Math.cos(angle);
        const by = cy + 160 * Math.sin(angle);
        posMap.set(b.phoneNumber, {
          x: Math.round(Math.max(65, Math.min(bounds.width - 65, bx)) - 26),
          y: Math.round(Math.max(65, Math.min(bounds.height - 65, by)) - 26),
        });
      }
    }
  });

  // 3. Position Peripheral Contacts as satellite clusters around their linked suspect
  const periphBySuspect = new Map<string, NodeMeta[]>();
  peripheralNodes.forEach((p) => {
    const connectedSus = suspectNodes.find((s) =>
      edges.some((e) => (e.a === s.phoneNumber && e.b === p.phoneNumber) || (e.b === s.phoneNumber && e.a === p.phoneNumber))
    );
    const key = connectedSus ? connectedSus.phoneNumber : (suspectNodes[0]?.phoneNumber || 'unknown');
    const list = periphBySuspect.get(key) || [];
    list.push(p);
    periphBySuspect.set(key, list);
  });

  periphBySuspect.forEach((pList, susPhone) => {
    const susPos = susPositions.get(susPhone) || { x: cx, y: cy };
    const awayDirX = susPos.x - cx;
    const awayDirY = susPos.y - cy;
    let baseAngle = Math.atan2(awayDirY, awayDirX);
    if (Math.abs(awayDirX) < 1 && Math.abs(awayDirY) < 1) {
      baseAngle = -Math.PI / 2;
    }

    const count = pList.length;
    const arcSpread = Math.min(Math.PI * 0.95, Math.max(0.65, count * 0.38));
    const startAngle = baseAngle - arcSpread / 2;
    const angleStep = count > 1 ? arcSpread / (count - 1) : 0;

    pList.forEach((p, idx) => {
      const angle = count === 1 ? baseAngle : startAngle + idx * angleStep;
      const dist = 165 + (idx % 2 === 1 ? 35 : 0);
      const px = susPos.x + dist * Math.cos(angle);
      const py = susPos.y + dist * Math.sin(angle);

      const clampedX = Math.max(70, Math.min(bounds.width - 70, px));
      const clampedY = Math.max(70, Math.min(bounds.height - 70, py));
      posMap.set(p.phoneNumber, {
        x: Math.round(clampedX - 26),
        y: Math.round(clampedY - 26),
      });
    });
  });

  // 4. Collision Relaxation Pass
  const sim = allNodes.map((n) => {
    const p = posMap.get(n.phoneNumber)!;
    return {
      id: n.phoneNumber,
      x: p.x + 26,
      y: p.y + 26,
      isSuspect: n.roleType === 'SUSPECT',
    };
  });

  const minGap = 140;
  for (let iter = 0; iter < 30; iter++) {
    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        const a = sim[i];
        const b = sim[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < minGap) {
          const overlap = (minGap - dist) / 2;
          const nx = (dx / dist) * overlap;
          const ny = (dy / dist) * overlap;
          if (!a.isSuspect) {
            a.x -= nx;
            a.y -= ny;
          }
          if (!b.isSuspect) {
            b.x += nx;
            b.y += ny;
          }
        }
      }
    }
  }

  sim.forEach((s) => {
    const finalX = Math.round(Math.max(65, Math.min(bounds.width - 65, s.x)) - 26);
    const finalY = Math.round(Math.max(65, Math.min(bounds.height - 65, s.y)) - 26);
    posMap.set(s.id, { x: finalX, y: finalY });
  });

  return posMap;
}

export const ContactNetworkPage: React.FC<ContactNetworkPageProps> = ({
  activeCase,
  cdrs,
  towers,
  onInspectCdr,
  onCaptureGraphSnapshot,
}) => {
  const { theme, t } = usePreferences();
  const isDark = theme === 'dark';

  const [filters, setFilters] = useState<ForensicFilters>(() => createDefaultFilters());
  const [onlySharedAndSuspects, setOnlySharedAndSuspects] = useState(false);
  const [keyConnectionsOnly, setKeyConnectionsOnly] = useState(true);
  const [selectedSuspectPhones, setSelectedSuspectPhones] = useState<string[]>([]);
  const [selectedNodePhone, setSelectedNodePhone] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [snapshotSaved, setSnapshotSaved] = useState(false);

  useEffect(() => {
    if (activeCase) {
      setSelectedSuspectPhones(activeCase.suspects.map((s) => s.phoneNumber));
      setSelectedNodePhone(null);
      setSelectedEdgeId(null);
      setSnapshotSaved(false);
      setFilters(createDefaultFilters());
    }
  }, [activeCase?.id]);

  const filterOptions = useMemo(
    () => extractFilterOptions(activeCase, cdrs, [], towers),
    [activeCase, cdrs, towers]
  );

  const filteredCdrs = useMemo(() => filterCdrs(cdrs, filters), [cdrs, filters]);

  const handleResetAll = () => {
    setFilters(createDefaultFilters());
    setOnlySharedAndSuspects(false);
    setKeyConnectionsOnly(true);
    setSelectedSuspectPhones(activeCase ? activeCase.suspects.map((s) => s.phoneNumber) : []);
    setSelectedNodePhone(null);
    setSelectedEdgeId(null);
    setLayoutVersion((v) => v + 1);
  };

  const graphData = useMemo(() => {
    if (!activeCase)
      return {
        nodes: [] as Node[],
        edges: [] as Edge[],
        metaMap: new Map<string, NodeMeta>(),
        edgeMetaMap: new Map<string, EdgeMeta>(),
      };

    const suspectMap = new Map(activeCase.suspects.map((s) => [s.phoneNumber, s]));
    const activeSusSet = new Set(selectedSuspectPhones);

    const edgeAgg = new Map<string, EdgeMeta>();
    const nodeCalls = new Map<
      string,
      { calls: number; duration: number; linkedSuspects: Set<string> }
    >();

    const touch = (num: string, dur: number, peerSuspect?: string) => {
      const prev = nodeCalls.get(num) || {
        calls: 0,
        duration: 0,
        linkedSuspects: new Set<string>(),
      };
      prev.calls += 1;
      prev.duration += dur;
      if (peerSuspect) prev.linkedSuspects.add(peerSuspect);
      nodeCalls.set(num, prev);
    };

    for (const r of filteredCdrs) {
      const a = r.caller_number;
      const b = r.receiver_number;
      if (!a || !b || a === b) continue;

      const aIsActiveSus = activeSusSet.has(a);
      const bIsActiveSus = activeSusSet.has(b);
      if (selectedSuspectPhones.length > 0 && !aIsActiveSus && !bIsActiveSus) continue;

      touch(a, r.duration_seconds, bIsActiveSus ? b : undefined);
      touch(b, r.duration_seconds, aIsActiveSus ? a : undefined);

      const [u, v] = a < b ? [a, b] : [b, a];
      const key = `${u}|${v}`;
      const e = edgeAgg.get(key) || { id: key, a: u, b: v, count: 0, duration: 0, nightCount: 0 };
      e.count += 1;
      e.duration += r.duration_seconds;
      const hr = new Date(r.timestamp).getUTCHours();
      if (hr >= 22 || hr < 5) e.nightCount += 1;
      edgeAgg.set(key, e);
    }

    const metaMap = new Map<string, NodeMeta>();
    const suspectNodes: NodeMeta[] = [];
    const bridgeNodes: NodeMeta[] = [];
    const peripheralNodes: NodeMeta[] = [];

    for (const [phone, stat] of nodeCalls.entries()) {
      const sus = suspectMap.get(phone);
      const linkedSusLabels = Array.from(stat.linkedSuspects).map(
        (p) => suspectMap.get(p)?.label || p
      );
      const isBridge = !sus && stat.linkedSuspects.size >= 2;
      if (onlySharedAndSuspects && !sus && !isBridge) continue;

      const meta: NodeMeta = {
        phoneNumber: phone,
        roleType: sus ? 'SUSPECT' : isBridge ? 'COMMON_BRIDGE' : 'PERIPHERAL',
        label: sus ? `${sus.label}\n${phone}` : isBridge ? `Shared Contact\n${phone}` : phone,
        connectedSuspects: linkedSusLabels,
        totalCalls: stat.calls,
        totalDuration: stat.duration,
      };
      metaMap.set(phone, meta);
      if (meta.roleType === 'SUSPECT') suspectNodes.push(meta);
      else if (meta.roleType === 'COMMON_BRIDGE') bridgeNodes.push(meta);
      else peripheralNodes.push(meta);
    }

    // Key Connections Filtering:
    // By default, show suspects, common bridges, and top key connections only.
    // If a node is selected, expand and include its directly connected peripheral contacts.
    let activePeripherals: NodeMeta[] = [];
    if (keyConnectionsOnly) {
      if (selectedNodePhone) {
        const directlyConnected = new Set<string>();
        for (const e of edgeAgg.values()) {
          if (e.a === selectedNodePhone) directlyConnected.add(e.b);
          if (e.b === selectedNodePhone) directlyConnected.add(e.a);
        }
        activePeripherals = peripheralNodes
          .filter((p) => directlyConnected.has(p.phoneNumber) || p.totalCalls >= 6)
          .slice(0, 10);
      } else {
        activePeripherals = peripheralNodes
          .filter((p) => p.totalCalls >= 4)
          .sort((a, b) => b.totalCalls - a.totalCalls)
          .slice(0, 4);
      }
    } else {
      activePeripherals = peripheralNodes
        .sort((a, b) => b.totalCalls - a.totalCalls)
        .slice(0, 14);
    }

    const activeNodeIds = new Set([
      ...suspectNodes.map((s) => s.phoneNumber),
      ...bridgeNodes.map((b) => b.phoneNumber),
      ...activePeripherals.map((p) => p.phoneNumber),
    ]);

    const activeEdges = Array.from(edgeAgg.values()).filter(
      (e) => activeNodeIds.has(e.a) && activeNodeIds.has(e.b)
    );

    // Compute Clean Non-Crossing Simplified Layout
    const posMap = computeSimplifiedNetworkLayout(
      suspectNodes,
      bridgeNodes,
      activePeripherals,
      activeEdges,
      { width: 840, height: 560 }
    );

    const highlightQuery = (filters.phoneNumber.trim() || filters.search.trim()).toLowerCase();

    // Compute focused neighborhood when a node or edge is selected
    const focusedNeighbors = new Set<string>();
    if (selectedNodePhone) {
      focusedNeighbors.add(selectedNodePhone);
      for (const e of edgeAgg.values()) {
        if (e.a === selectedNodePhone) focusedNeighbors.add(e.b);
        if (e.b === selectedNodePhone) focusedNeighbors.add(e.a);
      }
    } else if (selectedEdgeId && edgeAgg.has(selectedEdgeId)) {
      const selE = edgeAgg.get(selectedEdgeId)!;
      focusedNeighbors.add(selE.a);
      focusedNeighbors.add(selE.b);
    }
    const hasFocusSelection = focusedNeighbors.size > 0;

    const makeNode = (meta: NodeMeta): Node => {
      const isMatch =
        highlightQuery.length >= 2 &&
        (meta.phoneNumber.toLowerCase().includes(highlightQuery) ||
          meta.label.toLowerCase().includes(highlightQuery));
      const isSelected = selectedNodePhone === meta.phoneNumber;
      const isDimmed = hasFocusSelection && !focusedNeighbors.has(meta.phoneNumber);
      const pos = posMap.get(meta.phoneNumber) || { x: 420, y: 280 };

      return {
        id: meta.phoneNumber,
        type: 'circularContact',
        position: pos,
        data: {
          meta,
          isSuspect: meta.roleType === 'SUSPECT',
          isBridge: meta.roleType === 'COMMON_BRIDGE',
          isMatch,
          isSelected,
          isDimmed,
          isDark,
          suspectLabel: suspectMap.get(meta.phoneNumber)?.label,
        },
      };
    };

    const nodes: Node[] = [];
    suspectNodes.forEach((m) => nodes.push(makeNode(m)));
    bridgeNodes.forEach((m) => nodes.push(makeNode(m)));
    activePeripherals.forEach((m) => nodes.push(makeNode(m)));

    const renderedIds = new Set(nodes.map((n) => n.id));
    const edges: Edge[] = [];

    for (const e of activeEdges) {
      if (!renderedIds.has(e.a) || !renderedIds.has(e.b)) continue;
      const isBridgeEdge =
        metaMap.get(e.a)?.roleType === 'COMMON_BRIDGE' ||
        metaMap.get(e.b)?.roleType === 'COMMON_BRIDGE';
      const isFocusedEdge =
        selectedEdgeId === e.id ||
        selectedNodePhone === e.a ||
        selectedNodePhone === e.b;
      const isDimmedEdge = hasFocusSelection && !isFocusedEdge;
      const isHighFreq = e.count >= 6;

      const edgeColor = isFocusedEdge
        ? '#DC2626'
        : isBridgeEdge
        ? isDark
          ? '#F97316'
          : '#EA580C'
        : isHighFreq
        ? isDark
          ? '#C5A66A'
          : '#A88748'
        : isDark
        ? '#38BDF8'
        : '#0284C7';

      // Only display text label on focused edges, key bridges, or when explicitly selected
      // to avoid spiderweb text clutter
      const showLabel = isFocusedEdge || isBridgeEdge || (keyConnectionsOnly && e.count >= 8);

      edges.push({
        id: e.id,
        source: e.a,
        target: e.b,
        type: 'straight',
        label: showLabel ? `${e.count} calls` : undefined,
        labelStyle: {
          fontSize: 10,
          fill: isDark ? '#E2E8F0' : '#0F172A',
          fontFamily: 'IBM Plex Mono, monospace',
          fontWeight: 600,
          opacity: isDimmedEdge ? 0.25 : 1,
        },
        labelBgStyle: {
          fill: isDark ? '#17243B' : '#FFFFFF',
          fillOpacity: isDimmedEdge ? 0.35 : 0.95,
        },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        style: {
          stroke: edgeColor,
          strokeWidth: isFocusedEdge ? 3 : Math.min(3.6, 1.4 + e.count * 0.16),
          opacity: isDimmedEdge ? 0.2 : 0.88,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: 14,
          height: 14,
        },
      });
    }

    return { nodes, edges, metaMap, edgeMetaMap: edgeAgg };
  }, [
    activeCase,
    filteredCdrs,
    selectedSuspectPhones,
    onlySharedAndSuspects,
    keyConnectionsOnly,
    filters.phoneNumber,
    filters.search,
    selectedNodePhone,
    selectedEdgeId,
    layoutVersion,
    isDark,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(graphData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphData.edges);

  useEffect(() => {
    setNodes(graphData.nodes);
    setEdges(graphData.edges);
  }, [graphData, setNodes, setEdges]);

  const selectedMeta = selectedNodePhone ? graphData.metaMap.get(selectedNodePhone) : null;
  const selectedEdgeMeta = selectedEdgeId ? graphData.edgeMetaMap.get(selectedEdgeId) : null;

  const selectedRecords = useMemo(() => {
    if (selectedEdgeMeta) {
      return filteredCdrs.filter(
        (r) =>
          (r.caller_number === selectedEdgeMeta.a && r.receiver_number === selectedEdgeMeta.b) ||
          (r.caller_number === selectedEdgeMeta.b && r.receiver_number === selectedEdgeMeta.a)
      );
    }
    if (!selectedNodePhone) return [];
    return filteredCdrs.filter(
      (r) => r.caller_number === selectedNodePhone || r.receiver_number === selectedNodePhone
    );
  }, [selectedNodePhone, selectedEdgeMeta, filteredCdrs]);

  const toggleSuspectSelection = (phone: string) => {
    setSelectedSuspectPhones((prev) =>
      prev.includes(phone) ? prev.filter((p) => p !== phone) : [...prev, phone]
    );
  };

  /**
   * Generates a forensic SVG diagram with circular nodes, straight directional links, and labels underneath
   */
  const buildForensicGraphSvg = (): string => {
    const width = 1200;
    const height = 850;
    const nodePos = new Map(nodes.map((n) => [n.id, n.position]));
    const suspectMap = new Map((activeCase?.suspects || []).map((s) => [s.phoneNumber, s]));

    const edgeSvg = edges
      .map((e) => {
        const p1 = nodePos.get(e.source);
        const p2 = nodePos.get(e.target);
        if (!p1 || !p2) return '';
        const x1 = p1.x + 26;
        const y1 = p1.y + 26;
        const x2 = p2.x + 26;
        const y2 = p2.y + 26;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const stroke = (e.style?.stroke as string) || '#0284C7';
        const sw = Number(e.style?.strokeWidth || 1.8);
        return `
          <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" stroke-opacity="0.8" marker-end="url(#arrow)" />
          <rect x="${mx - 24}" y="${my - 8}" width="48" height="15" rx="3" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.8" />
          <text x="${mx}" y="${my + 3}" text-anchor="middle" font-family="monospace" font-size="8.5" fill="#1E293B">${escapeXml(String(e.label || ''))}</text>
        `;
      })
      .join('\n');

    const nodeSvg = nodes
      .map((n) => {
        const meta = graphData.metaMap.get(n.id);
        if (!meta) return '';
        const isSus = meta.roleType === 'SUSPECT';
        const isBridge = meta.roleType === 'COMMON_BRIDGE';
        const fill = isSus ? '#101A30' : isBridge ? '#FFF7ED' : '#FFFFFF';
        const stroke = isSus ? '#C5A66A' : isBridge ? '#EA580C' : '#0284C7';
        const title = isSus
          ? suspectMap.get(meta.phoneNumber)?.label || 'Suspect'
          : isBridge
          ? `Shared (${meta.connectedSuspects.length})`
          : 'Contact';
        const cx = n.position.x + 26;
        const cy = n.position.y + 26;
        return `
          <g>
            <circle cx="${cx}" cy="${cy}" r="26" fill="${fill}" stroke="${stroke}" stroke-width="${isSus ? 3 : 2}" />
            <circle cx="${cx + 18}" cy="${cy - 16}" r="9" fill="${stroke}" />
            <text x="${cx + 18}" y="${cy - 13}" text-anchor="middle" font-family="monospace" font-size="8" font-weight="bold" fill="#FFFFFF">${meta.totalCalls}</text>
            <text x="${cx}" y="${cy + 42}" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="600" fill="#0F172A">${escapeXml(title)}</text>
            <text x="${cx}" y="${cy + 55}" text-anchor="middle" font-family="monospace" font-size="9" fill="#64748B">${escapeXml(meta.phoneNumber)}</text>
          </g>
        `;
      })
      .join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748B" />
        </marker>
      </defs>
      <rect width="100%" height="100%" fill="#F8FAFC" />
      <rect width="100%" height="46" fill="#101A30" />
      <text x="20" y="28" font-family="sans-serif" font-size="13" font-weight="600" fill="#FFFFFF">TRACE INTEL — Forensic Contact Network Diagram | ${escapeXml(activeCase?.caseNumber || '')}</text>
      <text x="${width - 20}" y="28" text-anchor="end" font-family="monospace" font-size="10" fill="#C5A66A">${nodes.length} nodes · ${edges.length} links · ${new Date().toISOString().slice(0, 19)} UTC</text>
      <g transform="translate(0, 46)">
        ${edgeSvg}
        ${nodeSvg}
      </g>
    </svg>`;
  };

  const handleExportSvg = () => {
    if (!activeCase || nodes.length === 0) return;
    const svgText = buildForensicGraphSvg();
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCase.caseNumber}_Contact_Network.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const renderSvgToPngDataUrl = (svgText: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 1200;
        canvas.height = img.height || 850;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to render graph PNG'));
      };
      img.src = url;
    });
  };

  const handleExportPng = async (saveToReportOnly = false) => {
    if (!activeCase || nodes.length === 0) return;
    try {
      const pngUrl = await renderSvgToPngDataUrl(buildForensicGraphSvg());
      onCaptureGraphSnapshot?.(activeCase.id, pngUrl);
      if (saveToReportOnly) {
        setSnapshotSaved(true);
        setTimeout(() => setSnapshotSaved(false), 2500);
        return;
      }
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `${activeCase.caseNumber}_Contact_Network.png`;
      a.click();
    } catch {
      if (!saveToReportOnly) handleExportSvg();
    }
  };

  if (!activeCase) {
    return (
      <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-10 text-center space-y-2">
        <h2 className="text-base font-semibold text-[#17243B] dark:text-[#F4F5F7]">
          No Active Case Selected for Contact Network Analysis
        </h2>
        <p className="text-xs text-[#64748B] dark:text-[#8993A5]">
          Create a personal case or select an assigned investigation case from the top selector to view the contact link graph.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('network.title')}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-1">{t('network.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            disabled={nodes.length === 0}
            onClick={handleExportSvg}
            className="h-9 px-3 text-xs font-medium bg-white dark:bg-[#17243B] text-[#17243B] dark:text-[#F4F5F7] border border-[#CBD2DE] dark:border-[#2A3F63] rounded inline-flex items-center gap-1.5 hover:bg-[#F5F5F2] dark:hover:bg-[#101A30] disabled:opacity-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />
            Export SVG
          </button>
          <button
            type="button"
            disabled={nodes.length === 0}
            onClick={() => handleExportPng(false)}
            className="h-9 px-3 text-xs font-medium bg-white dark:bg-[#17243B] text-[#17243B] dark:text-[#F4F5F7] border border-[#CBD2DE] dark:border-[#2A3F63] rounded inline-flex items-center gap-1.5 hover:bg-[#F5F5F2] dark:hover:bg-[#101A30] disabled:opacity-50 transition-colors"
          >
            <ImageDown className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />
            Export PNG
          </button>
          {onCaptureGraphSnapshot && (
            <button
              type="button"
              disabled={nodes.length === 0}
              onClick={() => handleExportPng(true)}
              className="h-9 px-3 text-xs font-medium bg-[#17243B] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              {snapshotSaved ? <Check className="w-3.5 h-3.5" /> : <ImageDown className="w-3.5 h-3.5" />}
              {snapshotSaved ? 'Saved to Report' : 'Attach to Report'}
            </button>
          )}
          <button
            type="button"
            onClick={handleResetAll}
            className="h-9 px-3.5 text-xs font-medium bg-white dark:bg-[#17243B] text-[#17243B] dark:text-[#F4F5F7] border border-[#CBD2DE] dark:border-[#2A3F63] rounded inline-flex items-center gap-1.5 hover:bg-[#F5F5F2] dark:hover:bg-[#101A30] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('network.resetBtn')}
          </button>
        </div>
      </div>

      {/* Unified Forensic Filters + Multi-Suspect Graph Controls */}
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
        searchPlaceholder={t('network.searchPlaceholder')}
        resultSummary={`${graphData.nodes.length} nodes · ${graphData.edges.length} links · ${filteredCdrs.length} / ${cdrs.length} CDR`}
        onChange={setFilters}
        onReset={handleResetAll}
        extraControls={
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-[#64748B] dark:text-[#8993A5]">
                {t('network.compareSuspects')}
              </span>
              {activeCase.suspects.map((s) => (
                <label key={s.id} className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSuspectPhones.includes(s.phoneNumber)}
                    onChange={() => toggleSuspectSelection(s.phoneNumber)}
                    className="rounded border-[#CBD2DE] dark:border-[#2A3F63]"
                  />
                  <span className="font-medium text-[#17243B] dark:text-[#F4F5F7]">{s.label}</span>
                </label>
              ))}
              <span className="text-[#CBD2DE] dark:text-[#2A3F63]" aria-hidden="true">
                |
              </span>
              <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-[#17243B] dark:text-[#F4F5F7]">
                <input
                  type="checkbox"
                  checked={onlySharedAndSuspects}
                  onChange={(e) => setOnlySharedAndSuspects(e.target.checked)}
                  className="rounded border-[#CBD2DE] dark:border-[#2A3F63]"
                />
                {t('network.sharedOnly')}
              </label>
            </div>
            {/* Updated Circular Node Legend */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#475569] dark:text-[#9AA6BA]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-[#101A30] border-2 border-[#C5A66A]" />
                {t('network.legendSuspect')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-[#FFF7ED] dark:bg-[#3B2314] border-2 border-[#EA580C]" />
                {t('network.legendShared')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-white dark:bg-[#17243B] border-2 border-[#0284C7]" />
                {t('network.legendPeripheral')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-[#0284C7] dark:bg-[#38BDF8]" />
                {t('network.legendStrongEdge')}
              </span>
            </div>
          </div>
        }
      />

      {/* Radial Force-Directed Graph Canvas + Side Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#FFFFFF] dark:bg-[#0B1324] border border-[#E2E7EF] dark:border-[#243656] rounded-lg overflow-hidden h-[620px] relative shadow-xs flex flex-col">
          {/* Canvas Mode & Focus Bar */}
          <div className="px-4 py-2.5 bg-[#F8FAFC]/95 dark:bg-[#101A30]/95 backdrop-blur-xs border-b border-[#E2E8F0] dark:border-[#243656] flex flex-wrap items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setKeyConnectionsOnly(true)}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  keyConnectionsOnly
                    ? 'bg-[#17243B] dark:bg-[#C5A66A] text-white dark:text-[#101A30] shadow-xs'
                    : 'bg-white dark:bg-[#17243B] text-[#64748B] dark:text-[#8993A5] border border-[#CBD5E1] dark:border-[#2A3F63] hover:text-[#17243B] dark:hover:text-[#F4F5F7]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Key Connections (Simplified)
              </button>
              <button
                type="button"
                onClick={() => setKeyConnectionsOnly(false)}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  !keyConnectionsOnly
                    ? 'bg-[#17243B] dark:bg-[#C5A66A] text-white dark:text-[#101A30] shadow-xs'
                    : 'bg-white dark:bg-[#17243B] text-[#64748B] dark:text-[#8993A5] border border-[#CBD5E1] dark:border-[#2A3F63] hover:text-[#17243B] dark:hover:text-[#F4F5F7]'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                All Contacts
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {selectedNodePhone ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 font-mono text-[11px] font-medium">
                  <span>Focused: {selectedNodePhone}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNodePhone(null);
                      setSelectedEdgeId(null);
                    }}
                    className="hover:opacity-75 font-bold ml-1"
                    title="Clear focus"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <span className="text-[11px] text-[#64748B] dark:text-[#8993A5] hidden sm:inline-flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />
                  Click any node to expand full details
                </span>
              )}
              <span className="font-mono text-[11px] text-[#64748B] dark:text-[#8993A5] px-2 py-0.5 rounded bg-white dark:bg-[#17243B] border border-[#CBD5E1] dark:border-[#2A3F63]">
                {nodes.length} nodes · {edges.length} links
              </span>
            </div>
          </div>

          <div className="flex-1 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_evt, node) => {
                setSelectedEdgeId(null);
                setSelectedNodePhone((prev) => (prev === node.id ? null : node.id));
              }}
              onEdgeClick={(_evt, edge) => {
                setSelectedNodePhone(null);
                setSelectedEdgeId((prev) => (prev === edge.id ? null : edge.id));
              }}
              onPaneClick={() => {
                setSelectedNodePhone(null);
                setSelectedEdgeId(null);
              }}
              fitView
              fitViewOptions={{ padding: 0.2 }}
            >
              <Background color={isDark ? '#1E293B' : '#E2E8F0'} gap={24} size={1.2} />
              <Controls />
              <MiniMap
                nodeColor={(n) => {
                  const m = graphData.metaMap.get(n.id);
                  if (m?.roleType === 'SUSPECT') return '#C5A66A';
                  if (m?.roleType === 'COMMON_BRIDGE') return '#EA580C';
                  return '#0284C7';
                }}
              />
            </ReactFlow>
          </div>
        </div>

        {/* Node / Edge Inspector Panel */}
        <aside className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded-lg flex flex-col h-[620px]">
          <div className="px-5 py-4 border-b border-[#E2E7EF] dark:border-[#243656] flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {selectedEdgeMeta ? 'Connection Link Details' : selectedMeta ? t('network.detailsTitle') : 'Contact Network Overview'}
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
                {selectedEdgeMeta
                  ? 'Direct communications between linked subscribers'
                  : selectedMeta
                  ? 'Active node communications and underlying records'
                  : 'Simplified structural analysis of case communications'}
              </p>
            </div>
            {(selectedMeta || selectedEdgeMeta) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedNodePhone(null);
                  setSelectedEdgeId(null);
                }}
                className="text-[11px] font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline shrink-0"
              >
                Clear Focus
              </button>
            )}
          </div>
          {!selectedMeta && !selectedEdgeMeta ? (
            <div className="p-5 text-xs text-[#64748B] dark:text-[#8993A5] flex-1 flex flex-col justify-between overflow-y-auto space-y-4">
              <div className="space-y-4">
                <div className="p-3 bg-[#F8FAFC] dark:bg-[#101A30] border border-[#E2E8F0] dark:border-[#243656] rounded-md space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                    <Layers className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A]" />
                    <span>Clean Non-Crossing Layout</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#475569] dark:text-[#94A3B8]">
                    Suspects sit at the focal core, common bridges are placed directly between them, and contacts orbit their linked suspect. No scattered or crossing lines.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold tracking-wider text-[#64748B] dark:text-[#8993A5] uppercase">
                    Node Types
                  </p>
                  
                  <div className="p-2.5 rounded border border-[#E2E8F0] dark:border-[#243656] bg-white dark:bg-[#131F33] flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-[#101A30] border-2 border-[#C5A66A] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">Suspects (Focal Center)</p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Target subscribers under investigation.</p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded border border-[#FED7AA] dark:border-[#7C2D12] bg-[#FFF7ED] dark:bg-[#25150B] flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-[#EA580C] border-2 border-[#F97316] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-[#9A3412] dark:text-[#FDBA74]">Common Bridges</p>
                      <p className="text-[11px] text-[#C2410C] dark:text-[#FB923C]">Shared contacts talking to 2 or more suspects.</p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded border border-[#E2E8F0] dark:border-[#243656] bg-white dark:bg-[#131F33] flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-[#EFF6FF] dark:bg-[#17243B] border-2 border-[#0284C7] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">Key Peripheral Contacts</p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Frequent contacts orbiting their linked suspect.</p>
                    </div>
                  </div>
                </div>

                {/* Network Summary Stats */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 rounded bg-[#F8FAFC] dark:bg-[#101A30] border border-[#E2E8F0] dark:border-[#243656]">
                    <p className="text-[10px] text-[#64748B] dark:text-[#8993A5]">Suspect Targets</p>
                    <p className="text-base font-bold font-mono text-[#17243B] dark:text-[#F4F5F7]">{activeCase.suspects.length}</p>
                  </div>
                  <div className="p-2.5 rounded bg-[#F8FAFC] dark:bg-[#101A30] border border-[#E2E8F0] dark:border-[#243656]">
                    <p className="text-[10px] text-[#64748B] dark:text-[#8993A5]">Shared Bridges</p>
                    <p className="text-base font-bold font-mono text-[#EA580C] dark:text-[#FB923C]">
                      {Array.from(graphData.metaMap.values()).filter((m) => m.roleType === 'COMMON_BRIDGE').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-[#F8F8F6] dark:bg-[#101A30] border border-[#E2E7EF] dark:border-[#243656] rounded flex items-start gap-2 text-[#475569] dark:text-[#9AA6BA]">
                <Sparkles className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A] shrink-0 mt-0.5" />
                <span className="text-[11px]">Click any circular node in the web to expand its full neighborhood and inspect individual CDR calls.</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {selectedEdgeMeta ? (
                <div className="p-3.5 bg-[#F8F8F6] dark:bg-[#101A30] border border-[#E2E7EF] dark:border-[#243656] rounded space-y-1.5">
                  <p className="text-[11px] font-semibold text-[#A88748] dark:text-[#C5A66A]">
                    DIRECT CONNECTION PAIR
                  </p>
                  <p className="font-mono text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                    {selectedEdgeMeta.a} ↔ {selectedEdgeMeta.b}
                  </p>
                  <p className="text-[#475569] dark:text-[#CBD5E1]">
                    {selectedEdgeMeta.count} total events ·{' '}
                    <span className="font-mono">{formatDuration(selectedEdgeMeta.duration)}</span> ·{' '}
                    <span className="text-[#EA580C] dark:text-[#FB923C] font-mono">
                      {selectedEdgeMeta.nightCount} night
                    </span>
                  </p>
                </div>
              ) : (
                selectedMeta && (
                  <div className="p-3.5 bg-[#F8F8F6] dark:bg-[#101A30] border border-[#E2E7EF] dark:border-[#243656] rounded space-y-1.5">
                    <p className="text-[11px] font-semibold text-[#A88748] dark:text-[#C5A66A]">
                      {selectedMeta.roleType === 'SUSPECT'
                        ? t('network.roleSuspect')
                        : selectedMeta.roleType === 'COMMON_BRIDGE'
                        ? t('network.roleBridge')
                        : t('network.rolePeripheral')}
                    </p>
                    <p className="font-mono text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                      {selectedMeta.phoneNumber}
                    </p>
                    <p className="text-[#475569] dark:text-[#CBD5E1]">
                      {selectedMeta.totalCalls} events ·{' '}
                      <span className="font-mono">{formatDuration(selectedMeta.totalDuration)}</span>
                    </p>
                    {selectedMeta.connectedSuspects.length > 0 && (
                      <p className="text-[#334155] dark:text-[#CBD5E1]">
                        {t('network.linkedSuspects')}{' '}
                        <strong>{selectedMeta.connectedSuspects.join(', ')}</strong>
                      </p>
                    )}
                  </div>
                )
              )}

              <div>
                <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7] mb-2">
                  {t('network.supportingRows', { count: selectedRecords.length })}
                </p>
                <div className="border border-[#E2E7EF] dark:border-[#243656] rounded divide-y divide-[#E2E7EF] dark:divide-[#243656]">
                  {selectedRecords.slice(0, 20).map((r) => (
                    <button
                      key={r.record_id}
                      type="button"
                      onClick={() => onInspectCdr(r)}
                      className="w-full text-left px-3 py-2.5 hover:bg-[#F8F8F6] dark:hover:bg-[#101A30] transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[#17243B] dark:text-[#F4F5F7] truncate">
                          {r.caller_number} {'->'} {r.receiver_number}
                        </p>
                        <p className="font-mono text-[10px] text-[#64748B] dark:text-[#8993A5]">
                          {r.timestamp.slice(5, 19).replace('T', ' ')} · {r.duration_seconds}s ·{' '}
                          {r.cell_id}
                        </p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[#8993A5] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
