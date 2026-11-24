import React, { useId, useState, useEffect } from 'react';
import { Search, SlidersHorizontal, RotateCcw, X, Moon, AlertCircle } from 'lucide-react';
import {
  ForensicFilters,
  FilterFieldOptions,
  getActiveFilterTokens,
  ActiveFilterToken,
} from '../shared/filtering';
import { getCurrentIstDateString, validateDateRange } from '../shared/dateConstraints';
import { usePreferences } from '../lib/preferences';

export type EnabledFilterField =
  | 'search'
  | 'dateRange'
  | 'timeRange'
  | 'suspect'
  | 'phoneNumber'
  | 'callType'
  | 'towerId'
  | 'imei'
  | 'nightOnly'
  | 'publicIp'
  | 'sourcePort'
  | 'destinationPort'
  | 'protocol'
  | 'subscriberId';

interface ForensicFilterBarProps {
  filters: ForensicFilters;
  options: FilterFieldOptions;
  enabledFields: EnabledFilterField[];
  searchPlaceholder?: string;
  resultSummary?: string;
  onChange: (next: ForensicFilters) => void;
  onReset: () => void;
  extraControls?: React.ReactNode;
}

const INPUT_CLASS =
  'w-full h-9 px-2.5 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2A3F63] rounded text-xs text-[#17243B] dark:text-[#F4F5F7] placeholder:text-[#8993A5] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#C5A66A] transition-colors';

const MONO_INPUT_CLASS =
  'w-full h-9 px-2.5 bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2A3F63] rounded font-mono text-[11px] text-[#17243B] dark:text-[#F4F5F7] placeholder:text-[#8993A5] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#C5A66A] transition-colors';

const MONO_INPUT_ERROR_CLASS =
  'w-full h-9 px-2.5 bg-red-50/40 dark:bg-red-950/25 border border-[#DC2626] dark:border-[#F87171] rounded font-mono text-[11px] text-[#17243B] dark:text-[#F4F5F7] placeholder:text-[#8993A5] focus:outline-none focus:border-[#DC2626] transition-colors';

export const ForensicFilterBar: React.FC<ForensicFilterBarProps> = ({
  filters,
  options,
  enabledFields,
  searchPlaceholder,
  resultSummary,
  onChange,
  onReset,
  extraControls,
}) => {
  const { t } = usePreferences();
  const phoneListId = useId();
  const [maxIstDate, setMaxIstDate] = useState<string>(() => getCurrentIstDateString());
  const [dateValidationError, setDateValidationError] = useState<{
    field: 'start' | 'end' | 'range';
    message: string;
  } | null>(null);

  // Dynamically refresh Asia/Kolkata max date so midnight IST rollovers take effect without reload
  useEffect(() => {
    const syncIstDate = () => setMaxIstDate(getCurrentIstDateString());
    const timer = window.setInterval(syncIstDate, 60_000);
    window.addEventListener('focus', syncIstDate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', syncIstDate);
    };
  }, []);

  const has = (field: EnabledFilterField) => enabledFields.includes(field);

  const patch = (partial: Partial<ForensicFilters>) => {
    onChange({ ...filters, ...partial });
  };

  const handleDateChange = (field: 'startDate' | 'endDate', rawValue: string) => {
    const currentMax = getCurrentIstDateString();
    if (currentMax !== maxIstDate) setMaxIstDate(currentMax);

    const nextStart = field === 'startDate' ? rawValue : filters.startDate;
    const nextEnd = field === 'endDate' ? rawValue : filters.endDate;

    // Allow clearing either date cleanly
    if (!rawValue) {
      setDateValidationError(null);
      patch({ [field]: '' } as Partial<ForensicFilters>);
      return;
    }

    const validation = validateDateRange(nextStart, nextEnd);
    if (!validation.isValid) {
      if (validation.startError === 'FUTURE_DATE') {
        setDateValidationError({
          field: 'start',
          message: t('filter.dateFutureStart', {
            date: nextStart,
            maxDate: validation.maxDate,
          }),
        });
      } else if (validation.endError === 'FUTURE_DATE') {
        setDateValidationError({
          field: 'end',
          message: t('filter.dateFutureEnd', {
            date: nextEnd,
            maxDate: validation.maxDate,
          }),
        });
      } else if (validation.rangeError === 'START_AFTER_END') {
        setDateValidationError({
          field: 'range',
          message: t('filter.dateStartAfterEnd', {
            start: nextStart,
            end: nextEnd,
          }),
        });
      } else {
        setDateValidationError({
          field: field === 'startDate' ? 'start' : 'end',
          message: t('filter.dateInvalidFormat', { maxDate: validation.maxDate }),
        });
      }
      // Strictly prevent invalid or future dates from entering active filter state
      return;
    }

    setDateValidationError(null);
    patch({ [field]: rawValue } as Partial<ForensicFilters>);
  };

  const handleResetAll = () => {
    setDateValidationError(null);
    onReset();
  };

  const activeTokens = getActiveFilterTokens(filters, options);

  const clearSingleToken = (token: ActiveFilterToken) => {
    if (token.key === 'dateRange') {
      setDateValidationError(null);
      patch({ startDate: '', endDate: '' });
    } else if (token.key === 'timeRange') {
      patch({ startTime: '', endTime: '' });
    } else if (token.key === 'nightOnly') {
      patch({ nightOnly: false });
    } else if (
      token.key === 'search' ||
      token.key === 'phoneNumber' ||
      token.key === 'sourcePort'
    ) {
      patch({ [token.key]: '' } as Partial<ForensicFilters>);
    } else {
      patch({ [token.key]: 'ALL' } as Partial<ForensicFilters>);
    }
  };

  const startDatePickerMax =
    filters.endDate && filters.endDate < maxIstDate ? filters.endDate : maxIstDate;

  return (
    <section
      aria-label={t('filter.title')}
      className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded p-4 space-y-3 text-xs transition-colors"
    >
      {/* Top Row Header + Reset / Clear */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E2E7EF] dark:border-[#243656]">
        <div className="flex items-center gap-2 text-[#17243B] dark:text-[#F4F5F7]">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />
          <span className="font-semibold">{t('filter.title')}</span>
          {resultSummary && (
            <>
              <span className="text-[#CBD2DE] dark:text-[#2A3F63]" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-[11px] text-[#64748B] dark:text-[#8993A5]">
                {resultSummary}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeTokens.length > 0 && (
            <button
              type="button"
              onClick={handleResetAll}
              className="h-7 px-2.5 text-[11px] font-medium text-[#DC2626] dark:text-[#F87171] hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded inline-flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <X className="w-3 h-3" />
              {t('common.clearFilters', { count: activeTokens.length })}
            </button>
          )}
          <button
            type="button"
            onClick={handleResetAll}
            className="h-7 px-2.5 text-[11px] font-medium text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2A3F63] rounded inline-flex items-center gap-1 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3" />
            {t('common.reset')}
          </button>
        </div>
      </div>

      {/* Filter Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
        {has('search') && (
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#8993A5] mb-1">
              {t('filter.keyword')}
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8993A5] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => patch({ search: e.target.value })}
                placeholder={searchPlaceholder || t('shell.searchPlaceholder')}
                className="w-full h-9 pl-8 pr-3 bg-[#F5F7FA] dark:bg-[#101A30] border border-[#E2E7EF] dark:border-[#2A3F63] rounded text-xs text-[#17243B] dark:text-[#F4F5F7] placeholder:text-[#8993A5] focus:outline-none focus:bg-white dark:focus:bg-[#101A30] focus:border-[#2563EB] dark:focus:border-[#C5A66A]"
              />
            </div>
          </div>
        )}

        {has('dateRange') && (
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#8993A5] mb-1">
              {t('filter.dateRange', { maxDate: maxIstDate })}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="date"
                value={filters.startDate}
                max={startDatePickerMax}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
                onBlur={(e) => {
                  if (e.target.value && e.target.value !== filters.startDate) {
                    handleDateChange('startDate', e.target.value);
                  }
                }}
                aria-label="Start date"
                aria-invalid={
                  dateValidationError?.field === 'start' || dateValidationError?.field === 'range'
                }
                className={
                  dateValidationError?.field === 'start' || dateValidationError?.field === 'range'
                    ? MONO_INPUT_ERROR_CLASS
                    : MONO_INPUT_CLASS
                }
              />
              <input
                type="date"
                value={filters.endDate}
                min={filters.startDate || undefined}
                max={maxIstDate}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
                onBlur={(e) => {
                  if (e.target.value && e.target.value !== filters.endDate) {
                    handleDateChange('endDate', e.target.value);
                  }
                }}
                aria-label="End date"
                aria-invalid={
                  dateValidationError?.field === 'end' || dateValidationError?.field === 'range'
                }
                className={
                  dateValidationError?.field === 'end' || dateValidationError?.field === 'range'
                    ? MONO_INPUT_ERROR_CLASS
                    : MONO_INPUT_CLASS
                }
              />
            </div>
          </div>
        )}

        {has('timeRange') && (
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#8993A5] mb-1">
              {t('filter.timeRange')}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="time"
                value={filters.startTime}
                onChange={(e) => patch({ startTime: e.target.value })}
                aria-label="Start time UTC"
                className={MONO_INPUT_CLASS}
              />
              <input
                type="time"
                value={filters.endTime}
                onChange={(e) => patch({ endTime: e.target.value })}
                aria-label="End time UTC"
                className={MONO_INPUT_CLASS}
              />
            </div>
          </div>
        )}

        {has('suspect') && (
          <div>
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#8993A5] mb-1">
              {t('filter.suspect')}
            </label>
            <select
              value={filters.suspectPhone}
              onChange={(e) => patch({ suspectPhone: e.target.value })}
              aria-label="Filter by suspect"
              className={INPUT_CLASS}
            >
              <option value="ALL">{t('filter.allSuspects', { count: options.suspects.length })}</option>
              {options.suspects.map((s) => (
                <option key={s.phoneNumber} value={s.phoneNumber}>
                  {s.label} ({s.phoneNumber})
                </option>
              ))}
            </select>
          </div>
        )}

        {has('phoneNumber') && (
          <div>
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#8993A5] mb-1">
              {t('filter.phoneNumber')}
            </label>
            <input
              type="text"
              list={phoneListId}
              value={filters.phoneNumber}
              onChange={(e) => patch({ phoneNumber: e.target.value })}
              placeholder={t('filter.phonePlaceholder')}
              aria-label="Filter by phone number"
              className={MONO_INPUT_CLASS}
            />
            <datalist id={phoneListId}>
              {options.phoneNumbers.map((num) => (
                <option key={num} value={num} />
              ))}
            </datalist>
          </div>
        )}

        {has('callType') && (
          <div>
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#8993A5] mb-1">
              {t('filter.callType')}
            </label>
            <select
              value={filters.callType}
              onChange={(e) => patch({ callType: e.target.value })}
              aria-label="Filter by incoming or outgoing call type"
              className={INPUT_CLASS}
            >
              <option value="ALL">{t('filter.allCallTypes')}</option>
              <option value="INCOMING">{t('filter.incomingVoice')}</option>
              <option value="OUTGOING">{t('filter.outgoingVoice')}</option>
              <option value="VOICE_ONLY">{t('filter.voiceOnly')}</option>
              <option value="SMS_IN">{t('filter.smsIn')}</option>
              <option value="SMS_OUT">{t('filter.smsOut')}</option>
              <option value="SMS_ONLY">{t('filter.smsOnly')}</option>
            </select>
          </div>
        )}

        {has('towerId') && (
          <div>
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#8993A5] mb-1">
              {t('filter.towerId')}
            </label>
            <select
              value={filters.towerId}
              onChange={(e) => patch({ towerId: e.target.value })}
              aria-label="Filter by cell tower ID"
              className={MONO_INPUT_CLASS}
            >
              <option value="ALL">{t('filter.allTowers', { count: options.towers.length })}</option>
              {options.towers.map((tw) => (
                <option key={tw.cell_id} value={tw.cell_id}>
                  {tw.cell_id} — {tw.area}
                </option>
              ))}
            </select>
          </div>
        )}

        {has('imei') && (
          <div>
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#8993A5] mb-1">
              {t('filter.imei')}
            </label>
            <select
              value={filters.imei}
              onChange={(e) => patch({ imei: e.target.value })}
              aria-label="Filter by handset IMEI"
              className={MONO_INPUT_CLASS}
            >
              <option value="ALL">{t('filter.allImeis', { count: options.imeis.length })}</option>
              <option value="__MISSING__">{t('filter.missingImei')}</option>
              {options.imeis.map((im) => (
                <option key={im} value={im}>
                  {im}
                </option>
              ))}
            </select>
          </div>
        )}

        {has('subscriberId') && (
          <div>
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#8993A5] mb-1">
              {t('filter.subscriber')}
            </label>
            <select
              value={filters.subscriberId}
              onChange={(e) => patch({ subscriberId: e.target.value })}
              aria-label="Filter by IPDR subscriber"
              className={MONO_INPUT_CLASS}
            >
              <option value="ALL">
                {t('filter.allSubscribers', { count: options.subscribers.length })}
              </option>
              {options.subscribers.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        )}

        {has('publicIp') && (
          <div>
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#8993A5] mb-1">
              {t('filter.publicIp')}
            </label>
            <select
              value={filters.publicIp}
              onChange={(e) => patch({ publicIp: e.target.value })}
              aria-label="Filter by public NAT IP"
              className={MONO_INPUT_CLASS}
            >
              <option value="ALL">
                {t('filter.allPublicIps', { count: options.publicIps.length })}
              </option>
              {options.publicIps.map((ip) => (
                <option key={ip} value={ip}>
                  {ip}
                </option>
              ))}
            </select>
          </div>
        )}

        {has('sourcePort') && (
          <div>
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#8993A5] mb-1">
              {t('filter.sourcePort')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={filters.sourcePort}
              onChange={(e) => patch({ sourcePort: e.target.value.replace(/[^\d]/g, '') })}
              placeholder="e.g. 48210"
              aria-label="Filter by source port"
              className={MONO_INPUT_CLASS}
            />
          </div>
        )}

        {has('destinationPort') && (
          <div>
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#8993A5] mb-1">
              {t('filter.destPort')}
            </label>
            <select
              value={filters.destinationPort}
              onChange={(e) => patch({ destinationPort: e.target.value })}
              aria-label="Filter by destination port"
              className={MONO_INPUT_CLASS}
            >
              <option value="ALL">{t('filter.allDestPorts')}</option>
              {options.destinationPorts.map((p) => (
                <option key={p} value={String(p)}>
                  Port {p}
                </option>
              ))}
            </select>
          </div>
        )}

        {has('protocol') && (
          <div>
            <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#8993A5] mb-1">
              {t('filter.protocol')}
            </label>
            <select
              value={filters.protocol}
              onChange={(e) => patch({ protocol: e.target.value })}
              aria-label="Filter by protocol"
              className={INPUT_CLASS}
            >
              <option value="ALL">{t('filter.allProtocols')}</option>
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="QUIC">QUIC</option>
              <option value="ICMP">ICMP</option>
            </select>
          </div>
        )}

        {has('nightOnly') && (
          <div className="flex flex-col justify-end">
            <button
              type="button"
              onClick={() => patch({ nightOnly: !filters.nightOnly })}
              className={`h-9 px-3 rounded border font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                filters.nightOnly
                  ? 'bg-[#EA580C] dark:bg-[#C5A66A] text-white dark:text-[#101A30] border-[#EA580C] dark:border-[#C5A66A]'
                  : 'bg-white dark:bg-[#101A30] text-[#17243B] dark:text-[#F4F5F7] border-[#CBD2DE] dark:border-[#2A3F63] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D]'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              {t('filter.nightToggle')}
            </button>
          </div>
        )}
      </div>

      {/* Inline Date Restriction Validation Error */}
      {dateValidationError && (
        <div
          role="alert"
          className="px-3 py-2 rounded border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/35 text-[#DC2626] dark:text-[#F87171] flex items-center justify-between gap-2 text-[11px]"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{dateValidationError.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setDateValidationError(null)}
            aria-label="Dismiss date validation error"
            className="p-0.5 hover:opacity-75 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Optional extra module controls */}
      {extraControls && (
        <div className="pt-2.5 border-t border-[#E2E7EF] dark:border-[#243656]">{extraControls}</div>
      )}

      {/* Active Filter Summary Strip */}
      {activeTokens.length > 0 && (
        <div className="pt-2 border-t border-[#E2E7EF] dark:border-[#243656] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#475569] dark:text-[#9AA6BA]">
          <span className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
            {t('filter.activeLabel')}
          </span>
          {activeTokens.map((tok, i) => (
            <React.Fragment key={tok.key}>
              {i > 0 && (
                <span className="text-[#CBD2DE] dark:text-[#2A3F63]" aria-hidden="true">
                  ·
                </span>
              )}
              <button
                type="button"
                onClick={() => clearSingleToken(tok)}
                title={`Remove ${tok.label} filter`}
                className="inline-flex items-center gap-1 text-[#17243B] dark:text-[#F4F5F7] hover:text-[#DC2626] dark:hover:text-[#F87171] transition-colors"
              >
                <span className="text-[#64748B] dark:text-[#8993A5]">{tok.label}:</span>
                <span className="font-mono font-medium">{tok.value}</span>
                <X className="w-3 h-3 text-[#8993A5]" />
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </section>
  );
};
