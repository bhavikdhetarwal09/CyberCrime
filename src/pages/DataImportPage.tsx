import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Trash2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { AuthUser, CaseRecord, CallDirection, CDRRecord, IPDRRecord } from '../shared/types';
import { SAMPLE_IMPORT_FILES } from '../shared/syntheticData';
import {
  STANDARD_CDR_TEMPLATE,
  STANDARD_IPDR_TEMPLATE,
  CsvTemplateDefinition,
} from '../shared/csvTemplates';
import { api, ApiError } from '../lib/api';
import { usePreferences } from '../lib/preferences';

interface DataImportPageProps {
  user: AuthUser;
  activeCase: CaseRecord | null;
  onImportComplete: () => Promise<void>;
}

interface StagedFile {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  fileSha256?: string;
  fileType: 'CDR' | 'IPDR';
  schemaPreset: 'AIRTEL_CDR' | 'JIO_CDR' | 'ISP_IPDR' | 'CUSTOM';
  operator: string;
  headers: string[];
  rawRows: Array<Record<string, string>>;
  mapping: Record<string, string>;
  status: 'Staged' | 'Importing' | 'Imported' | 'Error';
  progress: number;
  errorMessage?: string;
}

async function computeSha256Hex(buffer: ArrayBuffer): Promise<string | undefined> {
  try {
    if (typeof window === 'undefined' || !window.crypto?.subtle) return undefined;
    const digest = await window.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return undefined;
  }
}

const CDR_TARGET_FIELDS = [
  { key: 'caller_number', label: 'Caller Number', required: true },
  { key: 'receiver_number', label: 'Receiver Number', required: true },
  { key: 'call_type', label: 'Call Type / Direction', required: false },
  { key: 'timestamp', label: 'Timestamp (UTC/ISO)', required: true },
  { key: 'duration_seconds', label: 'Duration (Seconds)', required: false },
  { key: 'cell_id', label: 'Cell Tower ID', required: false },
  { key: 'imei', label: 'Handset IMEI', required: false },
  { key: 'imsi', label: 'Subscriber IMSI', required: false },
  { key: 'operator', label: 'Operator', required: false },
];

const IPDR_TARGET_FIELDS = [
  { key: 'public_ip', label: 'Public NAT IP', required: true },
  { key: 'source_port', label: 'Source Port', required: true },
  { key: 'destination_ip', label: 'Destination IP', required: true },
  { key: 'destination_port', label: 'Destination Port', required: false },
  { key: 'session_start', label: 'Session Start Time', required: true },
  { key: 'session_end', label: 'Session End Time', required: false },
  { key: 'subscriber_id', label: 'Subscriber ID / MSISDN', required: false },
  { key: 'protocol', label: 'Protocol (TCP/UDP/QUIC)', required: false },
  { key: 'operator', label: 'ISP / Operator', required: false },
  { key: 'bytes_transferred', label: 'Bytes Transferred', required: false },
];

function buildMappingForSchema(
  headers: string[],
  fileType: 'CDR' | 'IPDR'
): {
  schemaPreset: 'AIRTEL_CDR' | 'JIO_CDR' | 'ISP_IPDR' | 'CUSTOM';
  operator: string;
  mapping: Record<string, string>;
} {
  const lower = new Map(headers.map((h) => [h.toLowerCase().trim(), h]));
  const findCol = (candidates: string[]) => {
    for (const c of candidates) {
      if (lower.has(c)) return lower.get(c)!;
    }
    return '';
  };

  if (fileType === 'IPDR') {
    return {
      schemaPreset: 'ISP_IPDR',
      operator: 'Multi-ISP Demo',
      mapping: {
        public_ip: findCol(['nat_public_ip', 'public_ip', 'src_ip']),
        source_port: findCol(['src_port', 'source_port']),
        destination_ip: findCol(['dst_ip', 'destination_ip']),
        destination_port: findCol(['dst_port', 'destination_port']),
        session_start: findCol(['start_time_utc', 'session_start', 'start_time']),
        session_end: findCol(['end_time_utc', 'session_end', 'end_time']),
        subscriber_id: findCol(['msisdn_subscriber', 'subscriber_id', 'msisdn']),
        protocol: findCol(['l4_proto', 'protocol', 'proto']),
        operator: findCol(['isp_name', 'operator']),
        bytes_transferred: findCol(['bytes_total', 'bytes_transferred', 'bytes']),
      },
    };
  }

  if (lower.has('a_party') || lower.has('cgi_tower')) {
    return {
      schemaPreset: 'JIO_CDR',
      operator: 'Jio-Demo',
      mapping: {
        caller_number: findCol(['a_party', 'caller_number']),
        receiver_number: findCol(['b_party', 'receiver_number']),
        call_type: findCol(['service_type', 'call_type']),
        timestamp: findCol(['event_timestamp', 'timestamp']),
        duration_seconds: findCol(['call_duration', 'duration_seconds']),
        cell_id: findCol(['cgi_tower', 'cell_id']),
        imei: findCol(['device_imei', 'imei']),
        imsi: findCol(['sim_imsi', 'imsi']),
        operator: findCol(['network', 'operator']),
      },
    };
  }

  return {
    schemaPreset: lower.has('calling_no') ? 'AIRTEL_CDR' : 'CUSTOM',
    operator: lower.has('calling_no') ? 'Airtel-Demo' : 'Custom Operator',
    mapping: {
      caller_number: findCol(['calling_no', 'caller_number', 'caller', 'a_number', 'from']),
      receiver_number: findCol(['called_no', 'receiver_number', 'receiver', 'b_number', 'to']),
      call_type: findCol(['call_direction', 'call_type', 'direction', 'type']),
      timestamp: findCol(['date_time_utc', 'timestamp', 'date_time', 'datetime']),
      duration_seconds: findCol(['dur_sec', 'duration_seconds', 'duration']),
      cell_id: findCol(['first_cell_id', 'cell_id', 'tower_id', 'tower']),
      imei: findCol(['handset_imei', 'imei']),
      imsi: findCol(['subscriber_imsi', 'imsi']),
      operator: findCol(['circle_operator', 'operator']),
    },
  };
}

function autoDetectMapping(headers: string[]): {
  fileType: 'CDR' | 'IPDR';
  schemaPreset: 'AIRTEL_CDR' | 'JIO_CDR' | 'ISP_IPDR' | 'CUSTOM';
  operator: string;
  mapping: Record<string, string>;
} {
  const lower = new Map(headers.map((h) => [h.toLowerCase().trim(), h]));
  const fileType: 'CDR' | 'IPDR' =
    lower.has('public_ip') ||
    lower.has('nat_public_ip') ||
    lower.has('dst_ip') ||
    lower.has('destination_ip')
      ? 'IPDR'
      : 'CDR';
  return {
    fileType,
    ...buildMappingForSchema(headers, fileType),
  };
}

function excelCellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value && value.result !== undefined && value.result !== null) {
      return value.result instanceof Date ? value.result.toISOString() : String(value.result);
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
    return '';
  }
  return String(value);
}

function normalizeCallDirection(raw: string): CallDirection {
  const v = raw.trim().toUpperCase();
  if (v.includes('SMS') && (v.includes('IN') || v.includes('MT'))) return 'SMS_IN';
  if (v.includes('SMS')) return 'SMS_OUT';
  if (v.includes('IN') || v.includes('MT')) return 'INCOMING';
  return 'OUTGOING';
}

function validateAndNormalizeStagedFile(file: StagedFile) {
  const missingValues: Array<{ row: number; field: string }> = [];
  const invalidTimestamps: Array<{ row: number; rawValue: string }> = [];
  const duplicateRows: number[] = [];
  const seenKeys = new Set<string>();
  const normalizedRecords: Array<Partial<CDRRecord> | Partial<IPDRRecord>> = [];

  const m = file.mapping;

  file.rawRows.forEach((raw, idx) => {
    const rowNum = idx + 2;
    const getVal = (targetKey: string) => {
      const col = m[targetKey];
      return col ? String(raw[col] ?? '').trim() : '';
    };

    if (file.fileType === 'CDR') {
      const caller = getVal('caller_number');
      const receiver = getVal('receiver_number');
      const rawTs = getVal('timestamp');
      const imei = getVal('imei');
      const cell = getVal('cell_id');
      const dur = Number(getVal('duration_seconds')) || 0;
      const callType = normalizeCallDirection(getVal('call_type'));
      const imsi = getVal('imsi');
      const op = getVal('operator') || file.operator;

      if (!caller) missingValues.push({ row: rowNum, field: 'caller_number (required)' });
      if (!receiver) missingValues.push({ row: rowNum, field: 'receiver_number (required)' });
      if (m.imei && !imei) missingValues.push({ row: rowNum, field: 'imei' });
      if (m.cell_id && !cell) missingValues.push({ row: rowNum, field: 'cell_id' });

      const parsedTs = Date.parse(rawTs);
      if (!rawTs || Number.isNaN(parsedTs)) {
        invalidTimestamps.push({ row: rowNum, rawValue: rawTs || '(empty)' });
        return; // skip invalid timestamp row from normalized commit
      }
      if (!caller || !receiver) {
        return; // do not commit CDR rows missing mandatory caller/receiver identifiers
      }

      const isoTs = new Date(parsedTs).toISOString();
      const dedupKey = `${caller}|${receiver}|${isoTs}|${dur}|${callType}`;
      if (seenKeys.has(dedupKey)) {
        duplicateRows.push(rowNum);
        return;
      }
      seenKeys.add(dedupKey);

      const flags: string[] = [];
      if (!imei) flags.push('Missing IMEI');
      if (!cell) flags.push('Missing Cell ID');

      normalizedRecords.push({
        caller_number: caller,
        receiver_number: receiver,
        call_type: callType,
        timestamp: isoTs,
        duration_seconds: Math.max(0, Math.round(dur)),
        cell_id: cell || 'UNKNOWN',
        imei,
        imsi,
        operator: op,
        source_file: file.fileName,
        source_row: rowNum,
        quality_flags: flags.length > 0 ? flags : undefined,
      });
    } else {
      const pubIp = getVal('public_ip');
      const srcPort = Math.min(65535, Math.max(0, Math.round(Number(getVal('source_port')) || 0)));
      const dstIp = getVal('destination_ip');
      const dstPort = Math.min(65535, Math.max(0, Math.round(Number(getVal('destination_port')) || 443)));
      const rawStart = getVal('session_start');
      const rawEnd = getVal('session_end') || rawStart;
      const sub = getVal('subscriber_id') || 'Unmapped (CGNAT)';
      const rawProto = getVal('protocol').toUpperCase();
      const protocol: 'TCP' | 'UDP' | 'QUIC' | 'ICMP' =
        rawProto === 'UDP' || rawProto === 'QUIC' || rawProto === 'ICMP' ? rawProto : 'TCP';
      const op = getVal('operator') || file.operator;
      const bytes = Math.max(0, Math.round(Number(getVal('bytes_transferred')) || 0));

      if (!pubIp) missingValues.push({ row: rowNum, field: 'public_ip (required)' });
      if (!dstIp) missingValues.push({ row: rowNum, field: 'destination_ip (required)' });

      const parsedStart = Date.parse(rawStart);
      if (!rawStart || Number.isNaN(parsedStart)) {
        invalidTimestamps.push({ row: rowNum, rawValue: rawStart || '(empty)' });
        return;
      }
      if (!pubIp || !dstIp) {
        return; // do not commit IPDR rows missing mandatory public/destination IP
      }
      const parsedEnd = Date.parse(rawEnd);
      const isoStart = new Date(parsedStart).toISOString();
      const isoEnd = Number.isNaN(parsedEnd) ? isoStart : new Date(parsedEnd).toISOString();

      const dedupKey = `${pubIp}|${srcPort}|${dstIp}|${isoStart}`;
      if (seenKeys.has(dedupKey)) {
        duplicateRows.push(rowNum);
        return;
      }
      seenKeys.add(dedupKey);

      const serviceIndicator =
        dstPort === 443
          ? 'HTTPS / Encrypted Traffic'
          : dstPort === 5222
          ? 'XMPP / VoIP Signaling'
          : dstPort === 3478
          ? 'STUN / VoIP Relay'
          : dstPort === 53
          ? 'DNS Query'
          : `Port ${dstPort} Traffic`;

      normalizedRecords.push({
        public_ip: pubIp,
        source_port: srcPort,
        destination_ip: dstIp,
        destination_port: dstPort,
        session_start: isoStart,
        session_end: isoEnd,
        bytes_transferred: bytes,
        subscriber_id: sub,
        protocol,
        service_indicator: serviceIndicator,
        operator: op,
        source_file: file.fileName,
        source_row: rowNum,
      });
    }
  });

  return {
    missingValues,
    invalidTimestamps,
    duplicateRows,
    normalizedRecords,
  };
}

export const DataImportPage: React.FC<DataImportPageProps> = ({
  user,
  activeCase,
  onImportComplete,
}) => {
  const { t } = usePreferences();
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [expandedTemplateId, setExpandedTemplateId] = useState<'CDR' | 'IPDR' | null>(null);

  const canImport =
    activeCase !== null &&
    ((user.role === 'Viewer' && activeCase.ownerUserId === user.id) ||
      user.role === 'Investigator' ||
      (user.role === 'Administrator' && Boolean(user.canAccessSensitiveCaseData)));

  const selectedFile = stagedFiles.find((f) => f.id === selectedFileId) || stagedFiles[0] || null;

  const validation = useMemo(() => {
    if (!selectedFile) return null;
    return validateAndNormalizeStagedFile(selectedFile);
  }, [selectedFile]);

  const stageParsedData = (
    fileName: string,
    fileSizeBytes: number,
    headers: string[],
    rawRows: Array<Record<string, string>>,
    fileSha256?: string
  ) => {
    const detected = autoDetectMapping(headers);
    const id = `STG-${Date.now()}-${Math.floor(Math.random() * 999)}`;
    const next: StagedFile = {
      id,
      fileName,
      fileSizeBytes,
      fileSha256,
      fileType: detected.fileType,
      schemaPreset: detected.schemaPreset,
      operator: detected.operator,
      headers,
      rawRows,
      mapping: detected.mapping,
      status: 'Staged',
      progress: 100,
    };
    setStagedFiles((prev) => [next, ...prev]);
    setSelectedFileId(id);
    setBanner(null);
  };

  const handleFiles = async (files: FileList | File[]) => {
    const MAX_FILE_BYTES = 10 * 1024 * 1024;
    const arr = Array.from(files);
    for (const file of arr) {
      if (file.size > MAX_FILE_BYTES) {
        setBanner({
          type: 'error',
          text: `"${file.name}" exceeds the 10 MB prototype file size limit.`,
        });
        continue;
      }
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'csv') {
        const rawBuf = await file.arrayBuffer();
        const sha256 = await computeSha256Hex(rawBuf);
        Papa.parse<Record<string, string>>(file, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => {
            const headers = result.meta.fields || [];
            stageParsedData(file.name, file.size, headers, result.data || [], sha256);
          },
          error: (err) => {
            setBanner({ type: 'error', text: `Failed to parse ${file.name}: ${err.message}` });
          },
        });
      } else if (ext === 'xlsx') {
        try {
          const buf = await file.arrayBuffer();
          const sha256 = await computeSha256Hex(buf);
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(buf);
          const sheet = workbook.worksheets[0];
          if (!sheet || sheet.rowCount < 2) {
            setBanner({
              type: 'error',
              text: `Excel workbook "${file.name}" contains no readable worksheet rows.`,
            });
            continue;
          }
          const headerRow = sheet.getRow(1);
          const headers: string[] = [];
          headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            headers[colNumber - 1] = excelCellToString(cell.value).trim();
          });
          const cleanHeaders = headers.filter(Boolean);
          const stringRows: Array<Record<string, string>> = [];
          sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) return;
            const obj: Record<string, string> = {};
            let hasValue = false;
            headers.forEach((h, colIdx) => {
              if (!h) return;
              const strVal = excelCellToString(row.getCell(colIdx + 1).value).trim();
              if (strVal) hasValue = true;
              obj[h] = strVal;
            });
            if (hasValue) stringRows.push(obj);
          });
          stageParsedData(file.name, file.size, cleanHeaders, stringRows, sha256);
        } catch (err) {
          setBanner({
            type: 'error',
            text: `Failed to parse Excel workbook ${file.name}: ${err instanceof Error ? err.message : 'Invalid file'}`,
          });
        }
      } else if (ext === 'xls') {
        setBanner({
          type: 'error',
          text: `Legacy binary .xls ("${file.name}") is disabled for security. Save as .xlsx or .csv and re-upload.`,
        });
      } else {
        setBanner({
          type: 'error',
          text: `Unsupported file type for "${file.name}". Please upload CSV or XLSX files.`,
        });
      }
    }
  };

  const loadSampleIntoStaging = async (key: keyof typeof SAMPLE_IMPORT_FILES) => {
    const sample = SAMPLE_IMPORT_FILES[key];
    const parsed = Papa.parse<Record<string, string>>(sample.content, {
      header: true,
      skipEmptyLines: true,
    });
    const encoded = new TextEncoder().encode(sample.content);
    const sha256 = await computeSha256Hex(encoded.buffer);
    stageParsedData(
      sample.fileName,
      encoded.byteLength,
      parsed.meta.fields || [],
      parsed.data || [],
      sha256
    );
  };

  const triggerCsvDownload = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadSampleFile = (key: keyof typeof SAMPLE_IMPORT_FILES) => {
    const sample = SAMPLE_IMPORT_FILES[key];
    triggerCsvDownload(sample.fileName, sample.content);
  };

  const downloadStandardTemplate = (template: CsvTemplateDefinition) => {
    triggerCsvDownload(template.fileName, template.csvContent);
    setTemplateMenuOpen(false);
    setBanner({
      type: 'success',
      text: `Downloaded ${template.fileName} (${template.rowCount} synthetic example rows). Upload it directly or replace the example rows with your synthetic test records.`,
    });
  };

  const updateSelectedFile = (updater: (f: StagedFile) => StagedFile) => {
    if (!selectedFile) return;
    setStagedFiles((prev) => prev.map((f) => (f.id === selectedFile.id ? updater(f) : f)));
  };

  const commitFileToCase = async (file: StagedFile) => {
    if (!activeCase) return;
    const val = validateAndNormalizeStagedFile(file);
    if (val.normalizedRecords.length === 0) {
      setBanner({
        type: 'error',
        text: 'No valid rows available to import. Check column mapping and timestamp formatting.',
      });
      return;
    }

    setStagedFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, status: 'Importing', progress: 55 } : f))
    );
    try {
      const res = await api.importDataset(activeCase.id, {
        fileType: file.fileType,
        fileName: file.fileName,
        schemaFormat:
          file.schemaPreset === 'AIRTEL_CDR'
            ? 'Operator A (Airtel Standard CSV)'
            : file.schemaPreset === 'JIO_CDR'
            ? 'Operator B (Jio Telecom Format)'
            : file.schemaPreset === 'ISP_IPDR'
            ? 'NAT Session IPDR'
            : 'Custom Mapped Schema',
        operator: file.operator,
        fileSizeBytes: file.fileSizeBytes,
        records: val.normalizedRecords,
        warningCount: val.missingValues.length + val.invalidTimestamps.length,
        duplicateCount: val.duplicateRows.length,
        fileSha256: file.fileSha256,
      });
      setStagedFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: 'Imported', progress: 100 } : f))
      );
      await onImportComplete();
      setBanner({
        type: 'success',
        text: `Imported ${val.normalizedRecords.length} normalized ${file.fileType} records from "${file.fileName}" as ${res.dataset.evidenceRefId} (SHA-256 recorded; verify in Case Management).`,
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Import failed.';
      setStagedFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: 'Error', errorMessage: msg } : f))
      );
      setBanner({ type: 'error', text: msg });
    }
  };

  const targetFields =
    selectedFile?.fileType === 'IPDR' ? IPDR_TARGET_FIELDS : CDR_TARGET_FIELDS;

  if (!activeCase) {
    return (
      <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-10 text-center space-y-2">
        <h2 className="text-base font-semibold text-[#17243B] dark:text-[#F4F5F7]">
          No Active Case Selected for Data Import
        </h2>
        <p className="text-xs text-[#64748B] dark:text-[#8993A5]">
          {user.role === 'Viewer'
            ? 'Create a personal complaint or case first in My Cases before uploading your CDR or IPDR files.'
            : 'Select an assigned case from the top bar before importing telecom evidence files.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('import.title')}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-1">
            {t('import.subtitle')}{' '}
            <span className="font-mono text-[#17243B] dark:text-[#F4F5F7]">
              {activeCase?.caseNumber || 'active case'}
            </span>
            .
          </p>
        </div>

        {/* Download Template Dropdown Button */}
        <div className="relative self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setTemplateMenuOpen((v) => !v)}
            aria-expanded={templateMenuOpen}
            aria-haspopup="menu"
            className="h-9 px-3.5 text-xs font-medium bg-white dark:bg-[#17243B] hover:bg-[#F8F9FB] dark:hover:bg-[#1E2F4C] text-[#17243B] dark:text-[#F4F5F7] border border-[#CBD2DE] dark:border-[#2D4063] rounded inline-flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />
            <span>{t('import.downloadTemplate')}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#64748B] dark:text-[#8993A5]" />
          </button>

          {templateMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setTemplateMenuOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 mt-1.5 w-72 bg-white dark:bg-[#17243B] border border-[#DCE1EA] dark:border-[#243656] rounded shadow-lg z-30 py-1.5 text-xs"
              >
                <div className="px-3.5 py-2 border-b border-[#ECEFF4] dark:border-[#243656]">
                  <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                    {t('import.stdTemplatesTitle')}
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] mt-0.5">
                    {t('import.stdTemplatesSub')}
                  </p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => downloadStandardTemplate(STANDARD_CDR_TEMPLATE)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-[#F5F7FA] dark:hover:bg-[#1E2F4C] transition-colors flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-medium text-[#17243B] dark:text-[#F4F5F7]">
                      {t('import.cdrTemplate')}
                    </p>
                    <p className="text-[11px] font-mono text-[#64748B] dark:text-[#8993A5]">
                      {STANDARD_CDR_TEMPLATE.fileName}
                    </p>
                  </div>
                  <Download className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A] shrink-0" />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => downloadStandardTemplate(STANDARD_IPDR_TEMPLATE)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-[#F5F7FA] dark:hover:bg-[#1E2F4C] transition-colors flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-medium text-[#17243B] dark:text-[#F4F5F7]">
                      {t('import.ipdrTemplate')}
                    </p>
                    <p className="text-[11px] font-mono text-[#64748B] dark:text-[#8993A5]">
                      {STANDARD_IPDR_TEMPLATE.fileName}
                    </p>
                  </div>
                  <Download className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A] shrink-0" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {!canImport && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded text-xs text-amber-900 dark:text-amber-200">
          {t('import.readonlyWarn', { role: user.role })}
        </div>
      )}

      {banner && (
        <div
          className={`p-3.5 rounded border text-xs flex items-center gap-2 ${
            banner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-[#DC2626] dark:text-red-300'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Upload Dropzone + Sample Schemas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (canImport && e.dataTransfer.files.length > 0) {
              handleFiles(e.dataTransfer.files);
            }
          }}
          className={`lg:col-span-2 bg-white dark:bg-[#17243B] border-2 border-dashed rounded p-8 text-center transition-colors ${
            isDragging
              ? 'border-[#C5A66A] bg-[#FBF9F2] dark:bg-[#1F2D42]'
              : 'border-[#CBD2DE] dark:border-[#2D4063]'
          }`}
        >
          <Upload className="w-8 h-8 text-[#17243B] dark:text-[#C5A66A] mx-auto" />
          <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7] mt-3">
            {t('import.dropTitle')}
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-1">{t('import.dropSub')}</p>
          <label className="mt-4 inline-flex items-center gap-2 h-9 px-4 text-xs font-medium bg-[#17243B] hover:bg-[#101A30] dark:bg-[#C5A66A] dark:hover:bg-[#d2b57c] text-white dark:text-[#101A30] rounded cursor-pointer">
            <span>{t('import.browseBtn')}</span>
            <input
              type="file"
              multiple
              disabled={!canImport}
              accept=".csv,.xlsx"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
          </label>
        </div>

        {/* Built-in Synthetic Sample Schemas */}
        <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('import.samplesTitle')}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
              {t('import.samplesSub')}
            </p>
          </div>
          {(Object.keys(SAMPLE_IMPORT_FILES) as Array<keyof typeof SAMPLE_IMPORT_FILES>).map(
            (key) => {
              const s = SAMPLE_IMPORT_FILES[key];
              return (
                <div
                  key={key}
                  className="p-3 bg-[#F8F9FB] dark:bg-[#132036] border border-[#E2E7EF] dark:border-[#243656] rounded flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7] truncate">
                      {s.schemaLabel}
                    </p>
                    <p className="text-[11px] font-mono text-[#64748B] dark:text-[#8993A5] truncate">
                      {s.fileName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadSampleFile(key)}
                      title="Download raw CSV"
                      className="p-1.5 text-[#475569] dark:text-[#CBD5E1] hover:text-[#17243B] dark:hover:text-[#F4F5F7] bg-white dark:bg-[#101A30] border border-[#DCE1EA] dark:border-[#2D4063] rounded"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!canImport}
                      onClick={() => loadSampleIntoStaging(key)}
                      className="px-2.5 py-1.5 text-[11px] font-medium bg-[#17243B] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded hover:bg-[#101A30] dark:hover:bg-[#d2b57c] disabled:opacity-50"
                    >
                      {t('import.stageBtn')}
                    </button>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Standardized CSV Templates & Formatting Guide */}
      <section className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
        <div className="px-5 py-4 border-b border-[#ECEFF4] dark:border-[#243656] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('import.guideTitle')}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5">
              {t('import.guideSub')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => downloadStandardTemplate(STANDARD_CDR_TEMPLATE)}
              className="h-9 px-3.5 text-xs font-medium bg-[#17243B] hover:bg-[#101A30] dark:bg-[#C5A66A] dark:hover:bg-[#d2b57c] text-white dark:text-[#101A30] rounded inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#C5A66A] dark:text-[#101A30]" />
              {t('import.dlCdrBtn')}
            </button>
            <button
              type="button"
              onClick={() => downloadStandardTemplate(STANDARD_IPDR_TEMPLATE)}
              className="h-9 px-3.5 text-xs font-medium bg-white dark:bg-[#101A30] hover:bg-[#F8F9FB] dark:hover:bg-[#1E2F4C] text-[#17243B] dark:text-[#F4F5F7] border border-[#CBD2DE] dark:border-[#2D4063] rounded inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />
              {t('import.dlIpdrBtn')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#ECEFF4] dark:divide-[#243656]">
          {[STANDARD_CDR_TEMPLATE, STANDARD_IPDR_TEMPLATE].map((tpl) => {
            const isExpanded = expandedTemplateId === tpl.id;
            const requiredCols = tpl.fields.filter((f) => f.required);
            const optionalCols = tpl.fields.filter((f) => !f.required);
            return (
              <div key={tpl.id} className="p-5 space-y-3.5 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                      {tpl.title}
                    </p>
                    <p className="text-[11px] font-mono text-[#64748B] dark:text-[#8993A5] mt-0.5">
                      {tpl.fileName} · {tpl.fields.length} columns · {tpl.rowCount} synthetic
                      example rows
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedTemplateId((cur) => (cur === tpl.id ? null : tpl.id))
                    }
                    className="text-xs font-medium text-[#17243B] dark:text-[#C5A66A] hover:text-[#A88748] inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <span>{isExpanded ? t('import.hideSpec') : t('import.showSpec')}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-[#334155] dark:text-[#CBD5E1]">
                    {t('import.reqHeaders', { count: requiredCols.length })}
                  </p>
                  <p className="font-mono text-[11px] text-[#17243B] dark:text-[#F4F5F7] leading-relaxed">
                    {requiredCols.map((f) => f.column).join(' · ')}
                  </p>
                  <p className="text-[11px] font-semibold text-[#64748B] dark:text-[#8993A5] pt-1">
                    {t('import.optHeaders', { count: optionalCols.length })}
                  </p>
                  <p className="font-mono text-[11px] text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                    {optionalCols.map((f) => f.column).join(' · ')}
                  </p>
                </div>

                <div className="p-3 bg-[#F8F9FB] dark:bg-[#132036] border border-[#ECEFF4] dark:border-[#243656] rounded space-y-1">
                  <p className="text-[11px] font-semibold text-[#17243B] dark:text-[#F4F5F7] flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A] shrink-0" />
                    {t('import.rulesTitle')}
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                    {tpl.instructions.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>

                {isExpanded && (
                  <div className="border border-[#ECEFF4] dark:border-[#243656] rounded overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-[#F8F9FB] dark:bg-[#132036] border-b border-[#ECEFF4] dark:border-[#243656] text-[#64748B] dark:text-[#8993A5]">
                          <th className="py-2 px-3">Column Header</th>
                          <th className="py-2 px-3">Req</th>
                          <th className="py-2 px-3">Example</th>
                          <th className="py-2 px-3">Expected Format</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECEFF4] dark:divide-[#243656]">
                        {tpl.fields.map((field) => (
                          <tr key={field.column}>
                            <td className="py-1.5 px-3 font-mono font-medium text-[#17243B] dark:text-[#F4F5F7]">
                              {field.column}
                            </td>
                            <td className="py-1.5 px-3 font-medium">
                              {field.required ? (
                                <span className="text-[#DC2626] dark:text-[#EF4444]">Required</span>
                              ) : (
                                <span className="text-[#64748B] dark:text-[#8993A5]">Optional</span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 font-mono text-[#334155] dark:text-[#CBD5E1]">
                              {field.example}
                            </td>
                            <td className="py-1.5 px-3 text-[#475569] dark:text-[#CBD5E1]">
                              {field.notes}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Staged Files Queue */}
      {stagedFiles.length > 0 && (
        <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded">
          <div className="px-5 py-3.5 border-b border-[#ECEFF4] dark:border-[#243656] flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t('import.queueTitle', { count: stagedFiles.length })}
            </h2>
            <span className="text-xs text-[#64748B] dark:text-[#8993A5]">
              {t('import.queueSub')}
            </span>
          </div>
          <div className="divide-y divide-[#ECEFF4] dark:divide-[#243656]">
            {stagedFiles.map((f) => (
              <div
                key={f.id}
                onClick={() => setSelectedFileId(f.id)}
                className={`px-5 py-3 flex flex-wrap items-center justify-between gap-4 cursor-pointer text-xs ${
                  selectedFile?.id === f.id
                    ? 'bg-[#F1F5F9] dark:bg-[#1D2D49]'
                    : 'hover:bg-[#F8F9FB] dark:hover:bg-[#1A2A45]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileSpreadsheet className="w-4 h-4 text-[#17243B] dark:text-[#C5A66A] shrink-0" />
                  <div className="min-w-0">
                    <p className="font-mono font-medium text-[#17243B] dark:text-[#F4F5F7] truncate">
                      {f.fileName}
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                      {f.fileType} · {(f.fileSizeBytes / 1024).toFixed(1)} KB · {f.rawRows.length}{' '}
                      raw rows · {f.operator}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-24 h-1.5 bg-[#E2E6ED] dark:bg-[#243656] rounded overflow-hidden">
                    <div
                      className="h-full bg-[#17243B] dark:bg-[#C5A66A]"
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                  <span
                    className={`font-medium ${
                      f.status === 'Imported'
                        ? 'text-[#16A34A] dark:text-[#22C55E]'
                        : f.status === 'Error'
                        ? 'text-[#DC2626] dark:text-[#EF4444]'
                        : 'text-[#475569] dark:text-[#CBD5E1]'
                    }`}
                  >
                    {f.status}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStagedFiles((prev) => prev.filter((item) => item.id !== f.id));
                    }}
                    aria-label="Remove staged file"
                    className="p-1 text-[#8993A5] hover:text-[#DC2626] dark:hover:text-[#EF4444]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mapping + Validation + Preview Workspace for Selected Staged File */}
      {selectedFile && validation && (
        <div className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#ECEFF4] dark:border-[#243656]">
            <div>
              <p className="text-xs font-mono text-[#64748B] dark:text-[#8993A5]">
                {t('import.inspectorEyebrow')}
              </p>
              <h2 className="text-base font-semibold text-[#17243B] dark:text-[#F4F5F7] mt-0.5">
                {selectedFile.fileName}
              </h2>
              {selectedFile.fileSha256 && (
                <p className="text-[11px] font-mono text-[#64748B] dark:text-[#8993A5] mt-1">
                  Raw File SHA-256: <span className="text-[#17243B] dark:text-[#C5A66A]">{selectedFile.fileSha256.slice(0, 24)}…{selectedFile.fileSha256.slice(-8)}</span>
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 p-1 bg-[#F5F7FA] dark:bg-[#101A30] border border-[#DCE1EA] dark:border-[#243656] rounded">
                {(['CDR', 'IPDR'] as const).map((schemaType) => (
                  <button
                    key={schemaType}
                    type="button"
                    onClick={() =>
                      updateSelectedFile((f) => {
                        const remapped = buildMappingForSchema(f.headers, schemaType);
                        return {
                          ...f,
                          fileType: schemaType,
                          schemaPreset: remapped.schemaPreset,
                          mapping: remapped.mapping,
                        };
                      })
                    }
                    className={`px-3 py-1 text-xs font-medium rounded ${
                      selectedFile.fileType === schemaType
                        ? 'bg-white dark:bg-[#1F3150] text-[#17243B] dark:text-[#F4F5F7] shadow-xs'
                        : 'text-[#64748B] dark:text-[#8993A5]'
                    }`}
                  >
                    {schemaType} Schema
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={selectedFile.operator}
                onChange={(e) => updateSelectedFile((f) => ({ ...f, operator: e.target.value }))}
                placeholder="Operator label"
                className="h-9 px-3 text-xs bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded"
              />
              <button
                type="button"
                disabled={!canImport || selectedFile.status === 'Importing' || selectedFile.status === 'Imported'}
                onClick={() => commitFileToCase(selectedFile)}
                className="h-9 px-4 text-xs font-medium bg-[#17243B] hover:bg-[#101A30] dark:bg-[#C5A66A] dark:hover:bg-[#d2b57c] disabled:opacity-50 text-white dark:text-[#101A30] rounded flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>
                  {selectedFile.status === 'Imported'
                    ? t('import.committedBtn')
                    : t('import.commitBtn', { count: validation.normalizedRecords.length })}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#C5A66A] dark:text-[#101A30]" />
              </button>
            </div>
          </div>

          {/* Validation Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 bg-[#F8F9FB] dark:bg-[#132036] border border-[#E2E7EF] dark:border-[#243656] rounded">
              <p className="text-[#64748B] dark:text-[#8993A5]">{t('import.validRows')}</p>
              <p className="text-xl font-mono tabular-nums font-semibold text-[#16A34A] dark:text-[#22C55E] mt-1">
                {validation.normalizedRecords.length}
              </p>
            </div>
            <div className="p-3.5 bg-[#F8F9FB] dark:bg-[#132036] border border-[#E2E7EF] dark:border-[#243656] rounded">
              <p className="text-[#64748B] dark:text-[#8993A5]">{t('import.missingWarnings')}</p>
              <p
                className={`text-xl font-mono tabular-nums font-semibold mt-1 ${
                  validation.missingValues.length > 0
                    ? 'text-[#EA580C] dark:text-[#F97316]'
                    : 'text-[#17243B] dark:text-[#F4F5F7]'
                }`}
              >
                {validation.missingValues.length}
              </p>
            </div>
            <div className="p-3.5 bg-[#F8F9FB] dark:bg-[#132036] border border-[#E2E7EF] dark:border-[#243656] rounded">
              <p className="text-[#64748B] dark:text-[#8993A5]">{t('import.duplicatesSkipped')}</p>
              <p
                className={`text-xl font-mono tabular-nums font-semibold mt-1 ${
                  validation.duplicateRows.length > 0
                    ? 'text-[#EA580C] dark:text-[#F97316]'
                    : 'text-[#17243B] dark:text-[#F4F5F7]'
                }`}
              >
                {validation.duplicateRows.length}
              </p>
            </div>
            <div className="p-3.5 bg-[#F8F9FB] dark:bg-[#132036] border border-[#E2E7EF] dark:border-[#243656] rounded">
              <p className="text-[#64748B] dark:text-[#8993A5]">{t('import.invalidTimestamps')}</p>
              <p
                className={`text-xl font-mono tabular-nums font-semibold mt-1 ${
                  validation.invalidTimestamps.length > 0
                    ? 'text-[#DC2626] dark:text-[#EF4444]'
                    : 'text-[#17243B] dark:text-[#F4F5F7]'
                }`}
              >
                {validation.invalidTimestamps.length}
              </p>
            </div>
          </div>

          {/* Validation Details */}
          {(validation.invalidTimestamps.length > 0 ||
            validation.duplicateRows.length > 0 ||
            validation.missingValues.length > 0) && (
            <div className="p-4 bg-[#FBF9F2] dark:bg-[#221F17] border border-[#E6DFC9] dark:border-[#4A3F26] rounded text-xs space-y-1.5 text-[#4A3B1E] dark:text-[#E5D3AD]">
              <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                {t('import.validationFindings')}
              </p>
              {validation.invalidTimestamps.length > 0 && (
                <p>
                  <strong>Invalid timestamps rejected:</strong>{' '}
                  {validation.invalidTimestamps
                    .slice(0, 5)
                    .map((i) => `Row ${i.row} ("${i.rawValue}")`)
                    .join(', ')}
                </p>
              )}
              {validation.duplicateRows.length > 0 && (
                <p>
                  <strong>Exact duplicate rows deduplicated:</strong> Rows{' '}
                  {validation.duplicateRows.slice(0, 8).join(', ')}
                </p>
              )}
              {validation.missingValues.length > 0 && (
                <p>
                  <strong>Missing optional/key values flagged:</strong>{' '}
                  {validation.missingValues
                    .slice(0, 6)
                    .map((m) => `Row ${m.row} (${m.field})`)
                    .join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Operator Column Mapping Grid */}
          <div>
            <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7] mb-3">
              {t('import.mappingTitle', { type: selectedFile.fileType })}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {targetFields.map((tf) => (
                <div
                  key={tf.key}
                  className="p-3 bg-[#F8F9FB] dark:bg-[#132036] border border-[#E2E7EF] dark:border-[#243656] rounded flex flex-col gap-1.5"
                >
                  <label className="font-medium text-[#17243B] dark:text-[#F4F5F7]">
                    {tf.label}
                    {tf.required && <span className="text-[#DC2626] dark:text-[#EF4444] ml-1">*</span>}
                  </label>
                  <select
                    value={selectedFile.mapping[tf.key] || ''}
                    onChange={(e) =>
                      updateSelectedFile((f) => ({
                        ...f,
                        mapping: { ...f.mapping, [tf.key]: e.target.value },
                      }))
                    }
                    className="h-8 px-2 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2D4063] text-[#17243B] dark:text-[#F4F5F7] rounded text-xs font-mono"
                  >
                    <option value="">{t('import.notMapped')}</option>
                    {selectedFile.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Normalized Preview Table */}
          <div>
            <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7] mb-2">
              {t('import.previewTitle')}
            </h3>
            <div className="border border-[#ECEFF4] dark:border-[#243656] rounded overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8F9FB] dark:bg-[#132036] border-b border-[#ECEFF4] dark:border-[#243656] text-[11px] text-[#64748B] dark:text-[#8993A5]">
                    <th className="py-2 px-3">Row</th>
                    {selectedFile.fileType === 'CDR' ? (
                      <>
                        <th className="py-2 px-3">{t('cdr.colCaller')}</th>
                        <th className="py-2 px-3">{t('cdr.colReceiver')}</th>
                        <th className="py-2 px-3">{t('cdr.colType')}</th>
                        <th className="py-2 px-3">{t('cdr.colTimestamp')}</th>
                        <th className="py-2 px-3 text-right">Dur(s)</th>
                        <th className="py-2 px-3">{t('cdr.colCellId')}</th>
                        <th className="py-2 px-3">IMEI</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2 px-3">{t('filter.publicIp')}</th>
                        <th className="py-2 px-3">{t('filter.sourcePort')}</th>
                        <th className="py-2 px-3">Dest IP:Port</th>
                        <th className="py-2 px-3">{t('drawer.sessionStart')}</th>
                        <th className="py-2 px-3">{t('ipdr.colSubMapping')}</th>
                        <th className="py-2 px-3">{t('ipdr.colProtocol')}</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEFF4] dark:divide-[#243656] font-mono tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
                  {validation.normalizedRecords.slice(0, 8).map((rec, idx) =>
                    selectedFile.fileType === 'CDR' ? (
                      <tr key={idx}>
                        <td className="py-2 px-3 text-[#64748B] dark:text-[#8993A5]">
                          #{(rec as Partial<CDRRecord>).source_row}
                        </td>
                        <td className="py-2 px-3">{(rec as Partial<CDRRecord>).caller_number}</td>
                        <td className="py-2 px-3">{(rec as Partial<CDRRecord>).receiver_number}</td>
                        <td className="py-2 px-3 font-sans">{(rec as Partial<CDRRecord>).call_type}</td>
                        <td className="py-2 px-3">{(rec as Partial<CDRRecord>).timestamp?.slice(0, 19)}</td>
                        <td className="py-2 px-3 text-right">
                          {(rec as Partial<CDRRecord>).duration_seconds}
                        </td>
                        <td className="py-2 px-3">{(rec as Partial<CDRRecord>).cell_id}</td>
                        <td className="py-2 px-3 text-[#64748B] dark:text-[#8993A5]">
                          {(rec as Partial<CDRRecord>).imei || '(missing)'}
                        </td>
                      </tr>
                    ) : (
                      <tr key={idx}>
                        <td className="py-2 px-3 text-[#64748B] dark:text-[#8993A5]">
                          #{(rec as Partial<IPDRRecord>).source_row}
                        </td>
                        <td className="py-2 px-3">{(rec as Partial<IPDRRecord>).public_ip}</td>
                        <td className="py-2 px-3">{(rec as Partial<IPDRRecord>).source_port}</td>
                        <td className="py-2 px-3">
                          {(rec as Partial<IPDRRecord>).destination_ip}:
                          {(rec as Partial<IPDRRecord>).destination_port}
                        </td>
                        <td className="py-2 px-3">
                          {(rec as Partial<IPDRRecord>).session_start?.slice(0, 19)}
                        </td>
                        <td className="py-2 px-3">{(rec as Partial<IPDRRecord>).subscriber_id}</td>
                        <td className="py-2 px-3">{(rec as Partial<IPDRRecord>).protocol}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
