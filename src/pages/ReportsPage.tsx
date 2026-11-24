import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import {
  FileDown,
  FileSpreadsheet,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Lock,
} from 'lucide-react';
import {
  AuthUser,
  CaseRecord,
  CDRRecord,
  IPDRRecord,
  CellTower,
  AIResponsePayload,
} from '../shared/types';
import { computeCaseAnalytics, formatDuration } from '../shared/analytics';
import { api, ApiError } from '../lib/api';
import { usePreferences } from '../lib/preferences';

interface ReportsPageProps {
  user: AuthUser;
  cases?: CaseRecord[];
  activeCase: CaseRecord | null;
  cdrs: CDRRecord[];
  ipdrs: IPDRRecord[];
  towers: CellTower[];
  aiHistory: AIResponsePayload[];
  networkGraphSnapshot?: string | null;
  onRefreshCases: (selectId?: string) => Promise<void>;
  onSelectCase?: (caseId: string) => void;
}

// Neutralize CSV/Excel formula injection on all string cells
function safeExcelCell(value: string | number | null | undefined): string | number {
  if (typeof value === 'number') return value;
  const str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) return `'${str}`;
  return str;
}

function formatUtcAndIstNow(): { utc: string; ist: string } {
  const now = new Date();
  const utc = `${now.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
  const ist = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(now)
    .replace(',', '') + ' IST';
  return { utc, ist };
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  user,
  cases = [],
  activeCase,
  cdrs,
  ipdrs,
  towers,
  aiHistory,
  networkGraphSnapshot,
  onRefreshCases,
  onSelectCase,
}) => {
  const { t } = usePreferences();
  const [sections, setSections] = useState({
    caseDetails: true,
    suspects: true,
    datasets: true,
    officerNotes: true,
    commSummary: true,
    networkSnapshot: true,
    commonContacts: true,
    towerTimeline: true,
    ipdrSummary: true,
    imeiObservations: true,
    aiFindings: true,
  });
  const [selectedSuspectIds, setSelectedSuspectIds] = useState<string[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  React.useEffect(() => {
    if (activeCase) {
      setSelectedSuspectIds(activeCase.suspects.map((s) => s.id));
    }
  }, [activeCase?.id]);

  const includedSuspects = useMemo(() => {
    if (!activeCase) return [];
    return activeCase.suspects.filter((s) => selectedSuspectIds.includes(s.id));
  }, [activeCase, selectedSuspectIds]);

  const isSuspectSubsetActive =
    Boolean(activeCase) &&
    (activeCase?.suspects.length ?? 0) > 0 &&
    selectedSuspectIds.length < (activeCase?.suspects.length ?? 0);

  const scopedCdrs = useMemo(() => {
    if (!isSuspectSubsetActive) return cdrs;
    const phoneSet = new Set(includedSuspects.map((s) => s.phoneNumber));
    if (phoneSet.size === 0) return [];
    return cdrs.filter(
      (r) => phoneSet.has(r.caller_number) || phoneSet.has(r.receiver_number)
    );
  }, [cdrs, includedSuspects, isSuspectSubsetActive]);

  const scopedIpdrs = useMemo(() => {
    if (!isSuspectSubsetActive) return ipdrs;
    const phoneSet = new Set(includedSuspects.map((s) => s.phoneNumber));
    if (phoneSet.size === 0) return [];
    return ipdrs.filter((r) => phoneSet.has(r.subscriber_id));
  }, [ipdrs, includedSuspects, isSuspectSubsetActive]);

  const analytics = useMemo(() => {
    if (!activeCase) return null;
    const scopedCase: CaseRecord = isSuspectSubsetActive
      ? { ...activeCase, suspects: includedSuspects }
      : activeCase;
    return computeCaseAnalytics(scopedCase, scopedCdrs, scopedIpdrs, towers);
  }, [activeCase, includedSuspects, isSuspectSubsetActive, scopedCdrs, scopedIpdrs, towers]);

  const canExport = Boolean(
    activeCase &&
      ((user.role === 'Viewer' && activeCase.ownerUserId === user.id) ||
        user.role === 'Investigator' ||
        user.role === 'Administrator')
  );
  const canVerify =
    user.role === 'Investigator' ||
    user.role === 'Administrator';

  if (!activeCase || !analytics) {
    return (
      <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-10 text-center space-y-2">
        <h2 className="text-base font-semibold text-[#17243B] dark:text-[#F4F5F7]">
          No Case Selected for Reporting
        </h2>
        <p className="text-xs text-[#64748B] dark:text-[#8993A5]">
          {user.role === 'Viewer'
            ? 'Create a personal complaint or case first to generate and export your case reports.'
            : 'Select an authorized case to build and export forensic investigation reports.'}
        </p>
      </div>
    );
  }

  const toggleSection = (key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleVerifyReport = async () => {
    if (!canVerify) {
      setStatusMsg({
        type: 'error',
        text: 'Only authorized Investigators and Administrators can record official report verification sign-off.',
      });
      return;
    }
    setVerifying(true);
    setStatusMsg(null);
    try {
      await api.verifyCaseReport(activeCase.id);
      await onRefreshCases(activeCase.id);
      setStatusMsg({
        type: 'success',
        text: `Case ${activeCase.caseNumber} report officially verified and locked by ${user.name} (${user.role}).`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Unable to verify report.',
      });
    } finally {
      setVerifying(false);
    }
  };

  const exportPdf = async () => {
    if (!canExport) {
      setStatusMsg({ type: 'error', text: t('viewer.exportDenied') });
      return;
    }
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const fileName = `${activeCase.caseNumber}_Investigation_Report.pdf`;
    const timestamps = formatUtcAndIstNow();

    // Header bar
    doc.setFillColor(16, 26, 48);
    doc.rect(0, 0, 595, 72, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('TRACE INTEL — Forensic Telecom Investigation Report', 40, 32);
    doc.setFontSize(8.5);
    doc.setTextColor(197, 166, 106);
    doc.text(
      'EVIDENCE-LINKED FORENSIC SUMMARY | SYNTHETIC DEMO DATA | REQUIRES OFFICER VERIFICATION',
      40,
      50
    );

    let y = 94;
    let sectionIdx = 1;
    const ensureSpace = (neededPt = 90) => {
      if (y + neededPt > 785) {
        doc.addPage();
        y = 48;
      }
    };
    const nextTableY = () =>
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
        ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20
        : y + 120;

    doc.setTextColor(16, 26, 48);

    // TIER I: VERIFIED CASE & EVIDENCE FACTS
    if (sections.caseDetails) {
      doc.setFontSize(12);
      doc.text(`PART I — VERIFIED CASE & EVIDENCE FACTS (${activeCase.caseNumber})`, 40, y);
      y += 16;
      doc.setFontSize(10);
      doc.text(activeCase.title, 40, y);
      y += 15;
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Assigned IO: ${activeCase.investigator} | Status: ${activeCase.status} | Priority: ${activeCase.priority} | Sign-off: ${activeCase.verificationStatus}`,
        40,
        y
      );
      y += 13;
      doc.text(
        `Generated By: ${user.name} (${user.role}) | ${timestamps.utc} (${timestamps.ist})${isSuspectSubsetActive ? ` | Scoped to ${includedSuspects.length} Selected Suspect(s)` : ''}`,
        40,
        y
      );
      y += 22;
    }

    if (sections.commSummary) {
      ensureSpace(120);
      doc.setTextColor(16, 26, 48);
      doc.setFontSize(11);
      doc.text(`${sectionIdx++}. Communication Summary (Verified Record Counts)`, 40, y);
      y += 8;
      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value', 'Notes']],
        body: [
          ['Total Normalized CDRs', String(analytics.totalCdrs), `${analytics.incomingCount} in / ${analytics.outgoingCount} out / ${analytics.smsCount} SMS`],
          ['Total IPDR Sessions', String(analytics.totalIpdrs), 'CGNAT attribution requires ISP verification'],
          ['Unique Phone Numbers', String(analytics.uniqueNumbers), `${includedSuspects.length} suspects selected`],
          ['Total / Avg Duration', formatDuration(analytics.totalDurationSec), `Avg voice call: ${analytics.avgDurationSec}s`],
          ['Night Activity (22:00-05:00)', String(analytics.nightCallCount), `${Math.round((analytics.nightCallCount / Math.max(1, analytics.totalCdrs)) * 100)}% of CDRs`],
          ['Data Quality Score', `${analytics.dataQualityScore.toFixed(1)}%`, 'Completeness across key normalized fields'],
        ],
        headStyles: { fillColor: [16, 26, 48], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
      });
      y = nextTableY();
    }

    if (sections.suspects && includedSuspects.length > 0) {
      ensureSpace(95);
      doc.setTextColor(16, 26, 48);
      doc.setFontSize(11);
      doc.text(`${sectionIdx++}. Selected Suspect Identifiers`, 40, y);
      y += 8;
      autoTable(doc, {
        startY: y,
        head: [['Label', 'Alias', 'Phone', 'Primary IMEI', 'Operator']],
        body: includedSuspects.map((s) => [s.label, s.alias, s.phoneNumber, s.primaryImei, s.operator]),
        headStyles: { fillColor: [23, 36, 59], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
      });
      y = nextTableY();
    }

    if (sections.datasets && activeCase.datasets.length > 0) {
      ensureSpace(95);
      doc.setTextColor(16, 26, 48);
      doc.setFontSize(11);
      doc.text(`${sectionIdx++}. Evidence Provenance & SHA-256 Integrity`, 40, y);
      y += 8;
      autoTable(doc, {
        startY: y,
        head: [['Evidence Ref', 'File Name', 'Type / Rows', 'SHA-256 Digest', 'Integrity Status']],
        body: activeCase.datasets.map((ds) => [
          ds.evidenceRefId || ds.id,
          ds.fileName,
          `${ds.fileType} (${ds.recordCount})`,
          ds.sha256Hash ? `${ds.sha256Hash.slice(0, 18)}…` : 'Not computed',
          ds.lastVerifiedBy ? `${ds.integrityStatus} (${ds.lastVerifiedBy})` : ds.integrityStatus,
        ]),
        headStyles: { fillColor: [23, 36, 59], fontSize: 8 },
        bodyStyles: { fontSize: 7.5 },
      });
      y = nextTableY();
    }

    if (sections.officerNotes && activeCase.notes && activeCase.notes.length > 0) {
      ensureSpace(95);
      doc.setTextColor(16, 26, 48);
      doc.setFontSize(11);
      doc.text(`${sectionIdx++}. Officer Investigation Notes`, 40, y);
      y += 8;
      autoTable(doc, {
        startY: y,
        head: [['Timestamp (UTC)', 'Officer', 'Category', 'Note']],
        body: activeCase.notes.slice(0, 10).map((n) => [
          n.createdAt.slice(0, 16).replace('T', ' '),
          `${n.authorName} (${n.authorRole})`,
          n.category,
          n.content,
        ]),
        headStyles: { fillColor: [23, 36, 59], fontSize: 8 },
        bodyStyles: { fontSize: 7.5 },
      });
      y = nextTableY();
    }

    // TIER II: ANALYTICAL OBSERVATIONS
    ensureSpace(40);
    doc.setTextColor(16, 26, 48);
    doc.setFontSize(12);
    doc.text('PART II — ANALYTICAL OBSERVATIONS (STATISTICAL & GRAPH CORRELATIONS)', 40, y);
    y += 18;

    if (sections.networkSnapshot && networkGraphSnapshot) {
      ensureSpace(260);
      doc.setTextColor(16, 26, 48);
      doc.setFontSize(11);
      doc.text(`${sectionIdx++}. Contact Network Graph Snapshot`, 40, y);
      y += 10;
      try {
        doc.addImage(networkGraphSnapshot, 'PNG', 40, y, 515, 250);
        y += 265;
      } catch {
        // Ignore image decoding failure gracefully
      }
    }

    if (sections.commonContacts && analytics.commonContacts.length > 0) {
      ensureSpace(95);
      doc.setTextColor(16, 26, 48);
      doc.setFontSize(11);
      doc.text(`${sectionIdx++}. Common Contact Bridge Observations`, 40, y);
      y += 8;
      autoTable(doc, {
        startY: y,
        head: [['Shared Number', 'Connected Suspects', 'Total Calls', 'Night Calls', 'Sample Citations']],
        body: analytics.commonContacts.slice(0, 6).map((c) => [
          c.phoneNumber,
          c.connectedSuspectLabels.join(', '),
          String(c.totalCalls),
          String(c.nightCalls),
          c.supportingRecordIds.slice(0, 2).join(', '),
        ]),
        headStyles: { fillColor: [23, 36, 59], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
      });
      y = nextTableY();
    }

    if (sections.imeiObservations && analytics.deviceAlerts.length > 0) {
      ensureSpace(95);
      doc.setTextColor(16, 26, 48);
      doc.setFontSize(11);
      doc.text(`${sectionIdx++}. IMEI / SIM Transition Observations (For Human Review)`, 40, y);
      y += 8;
      autoTable(doc, {
        startY: y,
        head: [['Type', 'Primary ID', 'Associated IDs', 'Window']],
        body: analytics.deviceAlerts.map((a) => [
          a.type,
          a.primaryIdentifier,
          a.associatedIdentifiers.join(', '),
          `${a.firstSeen.slice(0, 10)} to ${a.lastSeen.slice(0, 10)}`,
        ]),
        headStyles: { fillColor: [23, 36, 59], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
      });
      y = nextTableY();
    }

    if (sections.towerTimeline && analytics.towerStats.length > 0) {
      ensureSpace(95);
      doc.setTextColor(16, 26, 48);
      doc.setFontSize(11);
      doc.text(`${sectionIdx++}. Top Cell-Tower Usage (Non-GPS Approximate Sector Coverage)`, 40, y);
      y += 8;
      autoTable(doc, {
        startY: y,
        head: [['Cell ID', 'Synthetic Sector Area', 'Hits', 'Night Hits', 'Suspects']],
        body: analytics.towerStats.slice(0, 6).map((t) => [
          t.cell_id,
          t.area,
          String(t.totalHits),
          String(t.nightHits),
          t.suspectLabels.join(', ') || 'None',
        ]),
        headStyles: { fillColor: [23, 36, 59], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
      });
      y = nextTableY();
    }

    if (sections.ipdrSummary && scopedIpdrs.length > 0) {
      ensureSpace(95);
      doc.setTextColor(16, 26, 48);
      doc.setFontSize(11);
      doc.text(`${sectionIdx++}. IPDR Session Correlation (CGNAT Attribution Limitation Applies)`, 40, y);
      y += 8;
      autoTable(doc, {
        startY: y,
        head: [['Record ID', 'Subscriber', 'Public IP:Port', 'Dest IP:Port', 'Proto', 'Start (UTC)']],
        body: scopedIpdrs.slice(0, 10).map((r) => [
          r.record_id,
          r.subscriber_id,
          `${r.public_ip}:${r.source_port}`,
          `${r.destination_ip}:${r.destination_port}`,
          r.protocol,
          r.session_start.slice(0, 19).replace('T', ' '),
        ]),
        headStyles: { fillColor: [23, 36, 59], fontSize: 8 },
        bodyStyles: { fontSize: 7.5 },
      });
      y = nextTableY();
    }

    if (sections.aiFindings && aiHistory.length > 0) {
      ensureSpace(115);
      doc.setTextColor(16, 26, 48);
      doc.setFontSize(12);
      doc.text('PART III — AI-GENERATED INTERPRETATIONS (REQUIRES OFFICER VERIFICATION)', 40, y);
      y += 16;
      doc.setFontSize(11);
      doc.text(`${sectionIdx++}. AI Investigation Assistant Outputs (Source-Cited)`, 40, y);
      y += 8;
      autoTable(doc, {
        startY: y,
        head: [['Query', 'AI Interpretation Summary', 'Verified Record Citations']],
        body: aiHistory.slice(0, 5).map((h) => [
          h.question,
          h.summary,
          h.citations.slice(0, 4).map((c) => `${c.record_id} (${c.source_file}:${c.source_row})`).join('; '),
        ]),
        headStyles: { fillColor: [23, 36, 59], fontSize: 8 },
        bodyStyles: { fontSize: 7.5 },
      });
    }

    // Watermark footer on every page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(137, 147, 165);
      doc.text(
        `TRACE INTEL Forensic Report | Synthetic Demo Data | Page ${i} of ${pageCount} | Sign-Off: ${activeCase.verificationStatus}`,
        40,
        820
      );
    }

    doc.save(fileName);
    await api.recordExport({ caseId: activeCase.id, format: 'PDF', fileName }).catch(() => {});
    setStatusMsg({ type: 'success', text: `Exported PDF report: ${fileName}` });
  };

  const exportExcel = async () => {
    if (!canExport) {
      setStatusMsg({ type: 'error', text: t('viewer.exportDenied') });
      return;
    }
    const fileName = `${activeCase.caseNumber}_Investigation_Workbook_SYNTHETIC.xlsx`;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'TRACE INTEL Prototype';
    wb.created = new Date();

    const addStyledSheet = (
      name: string,
      headers: string[],
      rows: Array<Array<string | number>>
    ) => {
      const ws = wb.addWorksheet(name.slice(0, 31));
      ws.addRow(headers);
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF101A30' },
      };
      rows.forEach((row) => {
        ws.addRow(row.map((val) => safeExcelCell(val)));
      });
      ws.columns.forEach((col) => {
        col.width = 22;
      });
    };

    const summaryWs = wb.addWorksheet('Case Summary');
    const summaryRows: Array<Array<string | number>> = [
      ['TRACE INTEL — INVESTIGATION REPORT (SYNTHETIC DEMO DATA)', ''],
      ['DISCLAIMER', 'All records are synthetic demo data. Officer verification required before official use.'],
      ['Case Number', safeExcelCell(activeCase.caseNumber)],
      ['Title', safeExcelCell(activeCase.title)],
      ['Investigator', safeExcelCell(activeCase.investigator)],
      ['Verification Status', safeExcelCell(activeCase.verificationStatus)],
      ['Scope', isSuspectSubsetActive ? `Scoped to ${includedSuspects.length} Selected Suspect(s)` : 'Full Case Dataset'],
      ['Total CDRs', analytics.totalCdrs],
      ['Total IPDRs', analytics.totalIpdrs],
      ['Unique Phone Numbers', analytics.uniqueNumbers],
      ['Night Activity (22:00-05:00)', analytics.nightCallCount],
      ['Data Quality Score (%)', analytics.dataQualityScore],
    ];
    summaryRows.forEach((r) => summaryWs.addRow(r));
    summaryWs.getColumn(1).width = 28;
    summaryWs.getColumn(2).width = 64;

    if (sections.suspects) {
      addStyledSheet(
        'Selected Suspects',
        ['Label', 'Alias', 'Phone_Number', 'Primary_IMEI', 'Operator', 'Notes'],
        includedSuspects.map((s) => [s.label, s.alias, s.phoneNumber, s.primaryImei, s.operator, s.notes])
      );
    }

    if (sections.datasets) {
      addStyledSheet(
        'Evidence Provenance',
        [
          'Evidence_Ref_ID',
          'File_Name',
          'Type',
          'Schema_Format',
          'Operator',
          'Records',
          'SHA256_Digest',
          'Integrity_Status',
          'Last_Verified_By',
          'Uploaded_At',
        ],
        activeCase.datasets.map((ds) => [
          ds.evidenceRefId || ds.id,
          ds.fileName,
          ds.fileType,
          ds.schemaFormat,
          ds.operator,
          ds.recordCount,
          ds.sha256Hash || 'Pending',
          ds.integrityStatus,
          ds.lastVerifiedBy || 'Unverified',
          ds.uploadedAt,
        ])
      );
    }

    if (sections.officerNotes && activeCase.notes && activeCase.notes.length > 0) {
      addStyledSheet(
        'Officer Notes',
        ['Note_ID', 'Timestamp_UTC', 'Author', 'Role', 'Category', 'Content'],
        activeCase.notes.map((n) => [
          n.id,
          n.createdAt,
          n.authorName,
          n.authorRole,
          n.category,
          n.content,
        ])
      );
    }

    if (sections.commonContacts) {
      addStyledSheet(
        'Common Contacts',
        ['Shared_Number', 'Connected_Suspects', 'Total_Calls', 'Night_Calls', 'Total_Duration_Sec', 'Supporting_Record_IDs'],
        analytics.commonContacts.map((c) => [
          c.phoneNumber,
          c.connectedSuspectLabels.join(', '),
          c.totalCalls,
          c.nightCalls,
          c.totalDurationSec,
          c.supportingRecordIds.join(', '),
        ])
      );
    }

    if (sections.imeiObservations) {
      addStyledSheet(
        'IMEI_SIM_Review',
        ['Alert_Type', 'Primary_ID', 'Associated_IDs', 'First_Seen', 'Last_Seen', 'Review_Note'],
        analytics.deviceAlerts.map((a) => [
          a.type,
          a.primaryIdentifier,
          a.associatedIdentifiers.join(', '),
          a.firstSeen,
          a.lastSeen,
          a.confidenceNote,
        ])
      );
    }

    if (sections.towerTimeline) {
      addStyledSheet(
        'Tower Summary',
        ['Cell_ID', 'Synthetic_Area', 'Operator', 'Total_Hits', 'Night_Hits', 'Synthetic_Lat', 'Synthetic_Lng', 'Disclaimer'],
        analytics.towerStats.map((t) => [
          t.cell_id,
          t.area,
          t.operator,
          t.totalHits,
          t.nightHits,
          t.latitude,
          t.longitude,
          'Approximate sector coverage only (NOT GPS)',
        ])
      );
    }

    addStyledSheet(
      'Normalized CDRs',
      ['Record_ID', 'Caller', 'Receiver', 'Type', 'Timestamp_UTC', 'Duration_Sec', 'Cell_ID', 'IMEI', 'Source_File', 'Source_Row'],
      scopedCdrs.slice(0, 500).map((r) => [
        r.record_id,
        r.caller_number,
        r.receiver_number,
        r.call_type,
        r.timestamp,
        r.duration_seconds,
        r.cell_id,
        r.imei,
        r.source_file,
        r.source_row,
      ])
    );

    if (sections.ipdrSummary) {
      addStyledSheet(
        'Normalized IPDRs',
        ['Record_ID', 'Subscriber', 'Public_IP', 'Source_Port', 'Destination_IP', 'Destination_Port', 'Protocol', 'Session_Start', 'Session_End', 'Source_File', 'Source_Row'],
        scopedIpdrs.slice(0, 200).map((r) => [
          r.record_id,
          r.subscriber_id,
          r.public_ip,
          r.source_port,
          r.destination_ip,
          r.destination_port,
          r.protocol,
          r.session_start,
          r.session_end,
          r.source_file,
          r.source_row,
        ])
      );
    }

    if (sections.aiFindings) {
      addStyledSheet(
        'AI Findings',
        ['Timestamp_UTC', 'Engine', 'Question', 'Summary', 'Verified_Citations'],
        aiHistory.map((h) => [
          h.timestamp,
          h.modelLabel,
          h.question,
          h.summary,
          h.citations.map((c) => `${c.record_id} (${c.source_file}:${c.source_row})`).join('; '),
        ])
      );
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    await api.recordExport({ caseId: activeCase.id, format: 'XLSX', fileName }).catch(() => {});
    setStatusMsg({ type: 'success', text: `Exported Excel workbook: ${fileName}` });
  };

  const isVerified =
    activeCase.verificationStatus === 'Verified by Investigator' ||
    activeCase.verificationStatus === 'Verified by Administrator';

  const localizedVerification =
    activeCase.verificationStatus === 'Verified by Administrator'
      ? 'Verified & Locked by Administrator'
      : activeCase.verificationStatus === 'Verified by Investigator'
      ? t('shell.verifiedByInvestigator')
      : t('shell.pendingOfficerReview');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('reports.title')}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-1">
            {t('reports.subtitle')}
          </p>
        </div>
        {canExport ? (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={exportExcel}
              className="h-9 px-3.5 text-xs font-medium bg-white dark:bg-[#17243B] hover:bg-[#F8F9FB] dark:hover:bg-[#1E2F4C] text-[#17243B] dark:text-[#F4F5F7] border border-[#CBD2DE] dark:border-[#2D4063] rounded inline-flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#16A34A] dark:text-[#22C55E]" />
              {t('reports.exportExcel')}
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="h-9 px-4 text-xs font-medium bg-[#17243B] hover:bg-[#101A30] dark:bg-[#C5A66A] dark:hover:bg-[#d2b57c] text-white dark:text-[#101A30] rounded inline-flex items-center gap-1.5"
            >
              <FileDown className="w-4 h-4 text-[#C5A66A] dark:text-[#101A30]" />
              {t('reports.exportPdf')}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              aria-disabled="true"
              title={t('viewer.exportDenied')}
              onClick={exportExcel}
              className="h-9 px-3.5 text-xs font-medium bg-[#F5F7FA] dark:bg-[#131F35] text-[#8993A5] border border-[#E2E7EF] dark:border-[#243656] rounded inline-flex items-center gap-1.5 cursor-not-allowed opacity-70"
            >
              <Lock className="w-3.5 h-3.5" />
              {t('reports.exportExcel')}
            </button>
            <button
              type="button"
              aria-disabled="true"
              title={t('viewer.exportDenied')}
              onClick={exportPdf}
              className="h-9 px-4 text-xs font-medium bg-[#F5F7FA] dark:bg-[#131F35] text-[#8993A5] border border-[#E2E7EF] dark:border-[#243656] rounded inline-flex items-center gap-1.5 cursor-not-allowed opacity-70"
            >
              <Lock className="w-3.5 h-3.5" />
              {t('reports.exportPdf')}
            </button>
          </div>
        )}
      </div>

      {/* Centralized Case Report Navigator (Administrator & Investigator) */}
      {(user.role === 'Administrator' || user.role === 'Investigator') && cases.length > 0 && onSelectCase && (
        <div className="p-3.5 bg-white dark:bg-[#17243B] border border-[#CBD2DE] dark:border-[#2D4063] rounded flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A]" />
            <span className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              Centralized Case Report:
            </span>
            <select
              value={activeCase?.id || ''}
              onChange={(e) => onSelectCase(e.target.value)}
              className="h-8 px-2.5 bg-[#F5F7FA] dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] rounded font-mono text-xs text-[#17243B] dark:text-[#F4F5F7] max-w-md focus:outline-none"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.caseNumber} — {c.title} [{c.status} · IO: {c.investigator}]
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium inline-flex items-center gap-1.5 ${
                activeCase.verificationStatus === 'Verified by Administrator'
                  ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                  : activeCase.verificationStatus === 'Verified by Investigator'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}
            >
              {isVerified ? (
                <Lock className="w-3 h-3" />
              ) : (
                <AlertCircle className="w-3 h-3" />
              )}
              {activeCase.verificationStatus}
            </span>
            {canVerify && (
              <button
                type="button"
                disabled={verifying}
                onClick={handleVerifyReport}
                className="h-8 px-3 text-xs font-medium bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded inline-flex items-center gap-1.5 hover:bg-[#17243B] dark:hover:bg-[#d2b57c] disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {verifying ? 'Locking…' : user.role === 'Administrator' ? 'Verify & Lock Report' : 'Verify Report'}
              </button>
            )}
          </div>
        </div>
      )}

      {statusMsg && (
        <div
          className={`p-3.5 rounded border text-xs flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-[#DC2626] dark:text-red-300'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Builder Controls */}
        <aside className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5 space-y-5 text-xs">
          <div>
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('reports.sectionsTitle')}
            </h2>
            <p className="text-[#64748B] dark:text-[#8993A5] mt-0.5">{t('reports.sectionsSub')}</p>
            <div className="mt-3 space-y-2">
              {(
                [
                  ['caseDetails', t('reports.secCaseDetails')],
                  ['suspects', t('reports.secSuspects')],
                  ['datasets', `${t('reports.secDatasets')} & SHA-256`],
                  ['officerNotes', 'Officer Investigation Notes'],
                  ['commSummary', t('reports.secCommSummary')],
                  ['networkSnapshot', 'Network Graph Snapshot (PDF)'],
                  ['commonContacts', t('reports.secCommonContacts')],
                  ['towerTimeline', t('reports.secTowerTimeline')],
                  ['ipdrSummary', t('reports.secIpdrSummary')],
                  ['imeiObservations', t('reports.secImeiObs')],
                  ['aiFindings', 'AI Interpretations (Separated)'],
                ] as Array<[keyof typeof sections, string]>
              ).map(([k, label]) => (
                <label
                  key={k}
                  className="flex items-center gap-2 cursor-pointer text-[#334155] dark:text-[#CBD5E1]"
                >
                  <input
                    type="checkbox"
                    checked={sections[k]}
                    onChange={() => toggleSection(k)}
                    className="rounded border-[#CBD2DE] dark:border-[#2D4063] accent-[#17243B] dark:accent-[#C5A66A]"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-[#ECEFF4] dark:border-[#243656]">
            <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('reports.includedSuspects')}
            </h3>
            <div className="mt-2.5 space-y-2">
              {activeCase.suspects.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 cursor-pointer text-[#334155] dark:text-[#CBD5E1]"
                >
                  <input
                    type="checkbox"
                    checked={selectedSuspectIds.includes(s.id)}
                    onChange={() =>
                      setSelectedSuspectIds((prev) =>
                        prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                      )
                    }
                    className="rounded border-[#CBD2DE] dark:border-[#2D4063] accent-[#17243B] dark:accent-[#C5A66A]"
                  />
                  <span>
                    {s.label}{' '}
                    <span className="font-mono text-[#64748B] dark:text-[#8993A5]">
                      ({s.phoneNumber})
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Investigator Sign-Off */}
          <div className="pt-4 border-t border-[#ECEFF4] dark:border-[#243656] space-y-2.5">
            <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('reports.verificationTitle')}
            </h3>
            <p className="text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
              {t('reports.statusLabel')}{' '}
              <strong
                className={
                  activeCase.verificationStatus === 'Verified by Administrator'
                    ? 'text-purple-600 dark:text-purple-400'
                    : activeCase.verificationStatus === 'Verified by Investigator'
                    ? 'text-[#16A34A] dark:text-[#22C55E]'
                    : 'text-[#EA580C] dark:text-[#F97316]'
                }
              >
                {localizedVerification}
              </strong>
            </p>
            {activeCase.verifiedBy && (
              <p className="text-[11px] font-mono text-[#64748B] dark:text-[#8993A5]">
                {activeCase.verifiedBy} · {activeCase.verifiedAt?.slice(0, 16).replace('T', ' ')}
              </p>
            )}
            {canVerify ? (
              <button
                type="button"
                disabled={verifying}
                onClick={handleVerifyReport}
                className="w-full h-9 px-3 bg-[#17243B] hover:bg-[#101A30] dark:bg-[#C5A66A] dark:hover:bg-[#d2b57c] disabled:opacity-45 text-white dark:text-[#101A30] font-medium rounded inline-flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4 text-[#C5A66A] dark:text-[#101A30]" />
                {verifying
                  ? t('reports.recordingVerify')
                  : user.role === 'Administrator'
                  ? 'Lock & Verify Report'
                  : t('reports.recordVerifyBtn')}
              </button>
            ) : (
              <button
                type="button"
                aria-disabled="true"
                title="Official Investigator sign-off is performed by an assigned Investigator."
                onClick={handleVerifyReport}
                className="w-full h-9 px-3 bg-[#F5F7FA] dark:bg-[#131F35] text-[#8993A5] border border-[#E2E7EF] dark:border-[#243656] font-medium rounded inline-flex items-center justify-center gap-1.5 cursor-not-allowed opacity-70"
              >
                <Lock className="w-3.5 h-3.5" />
                {t('reports.recordVerifyBtn')}
              </button>
            )}
          </div>
        </aside>

        {/* Right Live Report Preview Sheet */}
        <section className="lg:col-span-2 bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-6 lg:p-8 space-y-6 text-xs">
          <div className="pb-5 border-b border-[#17243B] dark:border-[#C5A66A]/60 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                TRACE INTEL · {activeCase.caseNumber}
              </p>
              <h2 className="text-xl font-semibold text-[#17243B] dark:text-[#F4F5F7] mt-1">
                {activeCase.caseNumber} — {activeCase.title}
              </h2>
              <p className="text-[#64748B] dark:text-[#8993A5] mt-1">
                {t('cases.colInvestigator')}: {activeCase.investigator} · {t('cases.colCreated')}:{' '}
                {activeCase.createdDate} · {t('shell.verification')} {localizedVerification}
              </p>
            </div>
            <div className="text-right font-mono text-[11px] text-[#64748B] dark:text-[#8993A5] shrink-0">
              <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">TRACE INTEL</p>
              <p>{new Date().toISOString().slice(0, 10)}</p>
            </div>
          </div>

          {/* PART I HEADER */}
          <div className="pt-1">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[#A88748] dark:text-[#C5A66A]">
              Part I — Verified Facts &amp; Evidence Integrity
            </p>
          </div>

          {sections.commSummary && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {t('reports.secCommSummary')}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniMetric label={t('overview.kpiTotalCdrs')} value={String(analytics.totalCdrs)} />
                <MiniMetric label={t('overview.kpiTotalIpdrs')} value={String(analytics.totalIpdrs)} />
                <MiniMetric label={t('cdr.statNight')} value={String(analytics.nightCallCount)} />
                <MiniMetric
                  label={t('overview.kpiDataQuality')}
                  value={`${analytics.dataQualityScore.toFixed(1)}%`}
                />
              </div>
            </div>
          )}

          {sections.suspects && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {t('reports.secSuspects')} ({includedSuspects.length})
              </h3>
              <div className="border border-[#ECEFF4] dark:border-[#243656] rounded divide-y divide-[#ECEFF4] dark:divide-[#243656]">
                {includedSuspects.map((s) => (
                  <div key={s.id} className="px-3.5 py-2 flex flex-wrap justify-between gap-2">
                    <span className="font-medium text-[#17243B] dark:text-[#F4F5F7]">
                      {s.label} — {s.alias}
                    </span>
                    <span className="font-mono text-[#475569] dark:text-[#CBD5E1]">
                      {s.phoneNumber} · IMEI {s.primaryImei} · {s.operator}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sections.datasets && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {t('reports.secDatasets')} &amp; SHA-256 Integrity ({activeCase.datasets.length})
              </h3>
              <div className="border border-[#ECEFF4] dark:border-[#243656] rounded divide-y divide-[#ECEFF4] dark:divide-[#243656]">
                {activeCase.datasets.length === 0 ? (
                  <p className="px-3.5 py-2.5 text-[#64748B] dark:text-[#8993A5]">
                    {t('overview.noDatasets')}
                  </p>
                ) : (
                  activeCase.datasets.map((ds) => (
                    <div key={ds.id} className="px-3.5 py-2 flex flex-wrap justify-between gap-2">
                      <div>
                        <span className="font-mono font-semibold text-[#A88748] dark:text-[#C5A66A] mr-2">
                          {ds.evidenceRefId || ds.id}
                        </span>
                        <span className="font-mono font-medium text-[#17243B] dark:text-[#F4F5F7]">
                          {ds.fileName}
                        </span>
                        <span className="text-[#64748B] dark:text-[#8993A5] ml-1.5">
                          ({ds.fileType} · {ds.recordCount} rows)
                        </span>
                      </div>
                      <span className="font-mono text-[#475569] dark:text-[#CBD5E1]">
                        {ds.sha256Hash ? `${ds.sha256Hash.slice(0, 12)}… · ` : ''}
                        <strong
                          className={
                            ds.integrityStatus === 'Verified'
                              ? 'text-[#16A34A] dark:text-[#4ADE80]'
                              : ds.integrityStatus === 'Mismatch'
                              ? 'text-[#DC2626] dark:text-[#F87171]'
                              : 'text-[#B45309] dark:text-[#F59E0B]'
                          }
                        >
                          {ds.integrityStatus}
                        </strong>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {sections.officerNotes && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                Officer Investigation Notes ({activeCase.notes?.length || 0})
              </h3>
              <div className="border border-[#ECEFF4] dark:border-[#243656] rounded divide-y divide-[#ECEFF4] dark:divide-[#243656]">
                {!activeCase.notes || activeCase.notes.length === 0 ? (
                  <p className="px-3.5 py-2.5 text-[#64748B] dark:text-[#8993A5]">
                    No investigation notes recorded.
                  </p>
                ) : (
                  activeCase.notes.slice(0, 5).map((n) => (
                    <div key={n.id} className="px-3.5 py-2 space-y-0.5">
                      <p className="font-medium text-[#17243B] dark:text-[#F4F5F7]">
                        {n.authorName} · <span className="font-mono text-[#A88748] dark:text-[#C5A66A]">{n.category}</span> ·{' '}
                        <span className="font-mono text-[10px] text-[#8993A5]">{n.createdAt.slice(0, 16).replace('T', ' ')} UTC</span>
                      </p>
                      <p className="text-[#475569] dark:text-[#CBD5E1]">{n.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* PART II HEADER */}
          <div className="pt-3 border-t border-[#ECEFF4] dark:border-[#243656]">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[#A88748] dark:text-[#C5A66A]">
              Part II — Analytical Observations &amp; Correlations
            </p>
          </div>

          {sections.networkSnapshot && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                Contact Network Graph Snapshot
              </h3>
              {networkGraphSnapshot ? (
                <div className="border border-[#ECEFF4] dark:border-[#243656] rounded overflow-hidden bg-[#F5F5F2]">
                  <img
                    src={networkGraphSnapshot}
                    alt="Captured Contact Network Diagram"
                    className="w-full h-auto max-h-64 object-contain"
                  />
                </div>
              ) : (
                <p className="text-[#64748B] dark:text-[#8993A5]">
                  No network snapshot attached yet. Open Contact Network and click &ldquo;Attach to Report&rdquo; to embed the graph diagram in PDF exports.
                </p>
              )}
            </div>
          )}

          {sections.commonContacts && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {t('reports.secCommonContacts')}
              </h3>
              <div className="border border-[#ECEFF4] dark:border-[#243656] rounded divide-y divide-[#ECEFF4] dark:divide-[#243656]">
                {analytics.commonContacts.length === 0 ? (
                  <p className="px-3.5 py-2.5 text-[#64748B] dark:text-[#8993A5]">
                    {t('common.noData')}
                  </p>
                ) : (
                  analytics.commonContacts.slice(0, 5).map((c) => (
                    <div
                      key={c.phoneNumber}
                      className="px-3.5 py-2 flex flex-wrap justify-between gap-2"
                    >
                      <span className="font-mono font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                        {c.phoneNumber}
                      </span>
                      <span className="text-[#475569] dark:text-[#CBD5E1]">
                        {c.connectedSuspectLabels.join(', ')} · {c.totalCalls}{' '}
                        {t('overview.events')} ({c.nightCalls} {t('common.night')})
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {sections.imeiObservations && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {t('reports.secImeiObs')}
              </h3>
              {analytics.deviceAlerts.length === 0 ? (
                <p className="text-[#64748B] dark:text-[#8993A5]">{t('imei.noFlagged')}</p>
              ) : (
                analytics.deviceAlerts.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 bg-[#F8F9FB] dark:bg-[#132036] border border-[#ECEFF4] dark:border-[#243656] rounded"
                  >
                    <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                      {a.type} · <span className="font-mono">{a.primaryIdentifier}</span>
                    </p>
                    <p className="text-[#475569] dark:text-[#CBD5E1] mt-0.5">
                      <span className="font-mono">{a.associatedIdentifiers.join(', ')}</span>
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {sections.towerTimeline && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {t('reports.secTowerTimeline')}
              </h3>
              <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                {t('towers.disclaimerBody')}
              </p>
              <div className="border border-[#ECEFF4] dark:border-[#243656] rounded divide-y divide-[#ECEFF4] dark:divide-[#243656]">
                {analytics.towerStats.length === 0 ? (
                  <p className="px-3.5 py-2.5 text-[#64748B] dark:text-[#8993A5]">
                    {t('towers.noEvents')}
                  </p>
                ) : (
                  analytics.towerStats.slice(0, 4).map((tw) => (
                    <div key={tw.cell_id} className="px-3.5 py-2 flex justify-between gap-2">
                      <span className="font-mono font-medium text-[#17243B] dark:text-[#F4F5F7]">
                        {tw.cell_id} · {tw.area}
                      </span>
                      <span className="font-mono text-[#475569] dark:text-[#CBD5E1]">
                        {tw.totalHits} ({tw.nightHits} {t('common.night')})
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {sections.ipdrSummary && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {t('reports.secIpdrSummary')} ({scopedIpdrs.length})
              </h3>
              <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                {t('drawer.cgnatNoteBody')}
              </p>
              <div className="border border-[#ECEFF4] dark:border-[#243656] rounded divide-y divide-[#ECEFF4] dark:divide-[#243656]">
                {scopedIpdrs.length === 0 ? (
                  <p className="px-3.5 py-2.5 text-[#64748B] dark:text-[#8993A5]">
                    {t('ipdr.noRows')}
                  </p>
                ) : (
                  scopedIpdrs.slice(0, 5).map((r) => (
                    <div key={r.record_id} className="px-3.5 py-2 flex flex-wrap justify-between gap-2">
                      <span className="font-mono font-medium text-[#17243B] dark:text-[#F4F5F7]">
                        {r.public_ip}:{r.source_port} → {r.destination_ip}:{r.destination_port} (
                        {r.protocol})
                      </span>
                      <span className="font-mono text-[#475569] dark:text-[#CBD5E1]">
                        {r.subscriber_id} · {r.session_start.slice(5, 19).replace('T', ' ')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {sections.aiFindings && (
            <div className="space-y-2 pt-3 border-t border-[#ECEFF4] dark:border-[#243656]">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[#A88748] dark:text-[#C5A66A]">
                Part III — AI-Generated Interpretations (Requires Officer Verification)
              </p>
              <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                {t('reports.secAiFindings')} ({aiHistory.length})
              </h3>
              {aiHistory.length === 0 ? (
                <p className="text-[#64748B] dark:text-[#8993A5]">{t('ai.sideEmpty')}</p>
              ) : (
                aiHistory.slice(0, 4).map((h) => (
                  <div
                    key={h.id}
                    className="p-3 bg-[#F8F8F6] dark:bg-[#132036] border border-[#ECEFF4] dark:border-[#243656] rounded space-y-1"
                  >
                    <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                      Q: {h.question}
                    </p>
                    <p className="text-[#334155] dark:text-[#CBD5E1]">{h.summary}</p>
                    <p className="font-mono text-[10px] text-[#64748B] dark:text-[#8993A5]">
                      Citations: {h.citations.map((c) => c.record_id).join(', ') || 'None'}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const MiniMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-3 bg-[#F8F9FB] dark:bg-[#132036] border border-[#ECEFF4] dark:border-[#243656] rounded">
    <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">{label}</p>
    <p className="text-base font-mono tabular-nums font-semibold text-[#17243B] dark:text-[#F4F5F7] mt-0.5">
      {value}
    </p>
  </div>
);
