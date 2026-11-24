import React from 'react';
import { X, FileSpreadsheet, PhoneCall, Globe, ShieldAlert, Copy, Check } from 'lucide-react';
import { CDRRecord, IPDRRecord, CellTower } from '../shared/types';
import { formatDuration } from '../shared/analytics';
import { usePreferences } from '../lib/preferences';

export type InspectedEvidence =
  | { kind: 'CDR'; record: CDRRecord; tower?: CellTower }
  | { kind: 'IPDR'; record: IPDRRecord }
  | { kind: 'MULTI_CDR'; title: string; subtitle: string; records: CDRRecord[] };

function formatDualTimestamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  const ist = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(parsed));
  const utc = new Date(parsed).toISOString().slice(0, 19).replace('T', ' ');
  return `${ist} IST (${utc} UTC)`;
}

interface EvidenceDrawerProps {
  evidence: InspectedEvidence | null;
  onClose: () => void;
  onInspectSingle?: (rec: CDRRecord) => void;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  evidence,
  onClose,
  onInspectSingle,
}) => {
  const { t } = usePreferences();
  const [copied, setCopied] = React.useState(false);

  if (!evidence) return null;

  const copyReference = () => {
    let refText = '';
    if (evidence.kind === 'CDR') {
      const r = evidence.record;
      refText = `${r.record_id} | File: ${r.source_file} (Row ${r.source_row}) | ${r.caller_number} -> ${r.receiver_number} | ${r.timestamp}`;
    } else if (evidence.kind === 'IPDR') {
      const r = evidence.record;
      refText = `${r.record_id} | File: ${r.source_file} (Row ${r.source_row}) | ${r.public_ip}:${r.source_port} -> ${r.destination_ip}:${r.destination_port} | ${r.session_start}`;
    } else {
      refText = `${evidence.title} (${evidence.records.length} records)`;
    }
    navigator.clipboard?.writeText(refText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#101A30]/55"
      role="dialog"
      aria-modal="true"
      aria-label={t('drawer.eyebrow')}
    >
      <div className="fixed inset-0" onClick={onClose} />
      <aside className="relative z-10 w-full max-w-lg bg-white dark:bg-[#17243B] h-full border-l border-[#E2E7EF] dark:border-[#243656] flex flex-col shadow-xl">
        <div className="px-6 py-4 border-b border-[#1E2E4D] flex items-center justify-between gap-4 bg-[#101A30] text-white">
          <div className="min-w-0">
            <p className="text-xs text-[#C5A66A] font-medium">{t('drawer.eyebrow')}</p>
            <h3 className="text-base font-semibold truncate mt-0.5">
              {evidence.kind === 'CDR'
                ? evidence.record.record_id
                : evidence.kind === 'IPDR'
                ? evidence.record.record_id
                : evidence.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={copyReference}
              className="px-2.5 py-1.5 text-xs font-medium text-[#F4F5F7] bg-[#17243B] hover:bg-[#223454] border border-[#2C3E5E] rounded flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? t('drawer.copied') : t('drawer.copyRef')}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close evidence inspector"
              className="p-1.5 text-[#8993A5] hover:text-white rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Provenance Block */}
          {evidence.kind !== 'MULTI_CDR' && (
            <div className="p-4 bg-[#F5F7FA] dark:bg-[#101A30] border border-[#E2E7EF] dark:border-[#243656] rounded">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7] mb-2">
                <FileSpreadsheet className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A]" />
                <span>{t('drawer.provenanceTitle')}</span>
              </div>
              <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                <div>
                  <dt className="text-[#64748B] dark:text-[#8993A5]">{t('drawer.sourceFile')}</dt>
                  <dd className="font-mono text-[#17243B] dark:text-[#F4F5F7] mt-0.5 break-all">
                    {evidence.record.source_file}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#64748B] dark:text-[#8993A5]">{t('drawer.sourceRow')}</dt>
                  <dd className="font-mono tabular-nums text-[#17243B] dark:text-[#F4F5F7] mt-0.5">
                    Row #{evidence.record.source_row}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#64748B] dark:text-[#8993A5]">{t('drawer.recordId')}</dt>
                  <dd className="font-mono text-[#17243B] dark:text-[#F4F5F7] mt-0.5">
                    {evidence.record.record_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#64748B] dark:text-[#8993A5]">{t('drawer.operator')}</dt>
                  <dd className="text-[#17243B] dark:text-[#F4F5F7] mt-0.5">
                    {evidence.record.operator}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {evidence.kind === 'CDR' && (
            <>
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7] mb-3">
                  <PhoneCall className="w-4 h-4 text-[#2563EB] dark:text-[#3B82F6]" />
                  <span>{t('drawer.cdrAttrs')}</span>
                </div>
                <dl className="divide-y divide-[#E2E7EF] dark:divide-[#243656] border-t border-b border-[#E2E7EF] dark:border-[#243656] text-sm">
                  <Row label={t('drawer.callerNumber')} value={evidence.record.caller_number} mono />
                  <Row label={t('drawer.receiverNumber')} value={evidence.record.receiver_number} mono />
                  <Row label={t('drawer.callType')} value={evidence.record.call_type} />
                  <Row
                    label="Timestamp (IST / UTC)"
                    value={formatDualTimestamp(evidence.record.timestamp)}
                    mono
                  />
                  <Row
                    label={t('drawer.duration')}
                    value={`${formatDuration(evidence.record.duration_seconds)} (${evidence.record.duration_seconds}s)`}
                    mono
                  />
                  <Row label={t('drawer.cellTowerId')} value={evidence.record.cell_id} mono />
                  {evidence.tower && (
                    <Row
                      label={t('drawer.towerSectorArea')}
                      value={`${evidence.tower.tower_name} (${evidence.tower.latitude.toFixed(4)}, ${evidence.tower.longitude.toFixed(4)})`}
                    />
                  )}
                  <Row
                    label={t('drawer.handsetImei')}
                    value={evidence.record.imei || t('drawer.missingSource')}
                    mono
                  />
                  <Row
                    label={t('drawer.subscriberImsi')}
                    value={evidence.record.imsi || t('drawer.missingSource')}
                    mono
                  />
                </dl>
              </div>

              {evidence.record.quality_flags && evidence.record.quality_flags.length > 0 && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-semibold mb-1">{t('drawer.qualityFlags')}</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {evidence.record.quality_flags.map((f, idx) => (
                      <li key={idx}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {evidence.kind === 'IPDR' && (
            <>
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7] mb-3">
                  <Globe className="w-4 h-4 text-[#0D9488] dark:text-[#14B8A6]" />
                  <span>{t('drawer.ipdrAttrs')}</span>
                </div>
                <dl className="divide-y divide-[#E2E7EF] dark:divide-[#243656] border-t border-b border-[#E2E7EF] dark:border-[#243656] text-sm">
                  <Row label={t('drawer.subMapping')} value={evidence.record.subscriber_id} mono />
                  <Row label={t('drawer.publicNatIp')} value={evidence.record.public_ip} mono />
                  <Row label={t('drawer.sourcePort')} value={String(evidence.record.source_port)} mono />
                  <Row label={t('drawer.destIp')} value={evidence.record.destination_ip} mono />
                  <Row label={t('drawer.destPort')} value={String(evidence.record.destination_port)} mono />
                  <Row label={t('drawer.protocol')} value={evidence.record.protocol} mono />
                  <Row label={t('drawer.serviceIndicator')} value={evidence.record.service_indicator} />
                  <Row
                    label={`${t('drawer.sessionStart')} (IST / UTC)`}
                    value={formatDualTimestamp(evidence.record.session_start)}
                    mono
                  />
                  <Row
                    label={`${t('drawer.sessionEnd')} (IST / UTC)`}
                    value={formatDualTimestamp(evidence.record.session_end)}
                    mono
                  />
                  <Row
                    label={t('drawer.volume')}
                    value={`${(evidence.record.bytes_transferred / 1024 / 1024).toFixed(2)} MB`}
                    mono
                  />
                </dl>
              </div>
            </>
          )}

          {evidence.kind === 'MULTI_CDR' && (
            <div>
              <p className="text-xs text-[#64748B] dark:text-[#8993A5] mb-3">{evidence.subtitle}</p>
              <div className="border border-[#E2E7EF] dark:border-[#243656] rounded divide-y divide-[#E2E7EF] dark:divide-[#243656]">
                {evidence.records.slice(0, 40).map((r) => (
                  <button
                    key={r.record_id}
                    type="button"
                    onClick={() => onInspectSingle?.(r)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-[#17243B] dark:text-[#F4F5F7] font-medium truncate">
                        {r.caller_number} {'->'} {r.receiver_number}
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] font-mono tabular-nums mt-0.5">
                        {r.record_id} · {r.source_file}:Row {r.source_row} · {r.timestamp.slice(0, 19).replace('T', ' ')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-[#17243B] dark:text-[#F4F5F7]">{r.call_type}</p>
                      <p className="text-[11px] font-mono tabular-nums text-[#64748B] dark:text-[#8993A5]">
                        {r.duration_seconds}s · {r.cell_id}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subtle Provenance & Verification Notice */}
          <div className="p-3.5 bg-[#F5F7FA] dark:bg-[#101A30] border border-[#DCE3EE] dark:border-[#243656] rounded flex items-start gap-2.5 text-xs text-[#475569] dark:text-[#CBD5E1]">
            <ShieldAlert className="w-4 h-4 text-[#2563EB] dark:text-[#C5A66A] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">{t('drawer.verifyNoticeTitle')}</p>
              <p className="mt-0.5 leading-relaxed">{t('drawer.verifyNoticeBody')}</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="py-2.5 flex items-baseline justify-between gap-4">
    <dt className="text-xs text-[#64748B] dark:text-[#8993A5] shrink-0">{label}</dt>
    <dd
      className={`text-xs text-[#17243B] dark:text-[#F4F5F7] text-right break-all ${
        mono ? 'font-mono tabular-nums' : 'font-medium'
      }`}
    >
      {value}
    </dd>
  </div>
);
