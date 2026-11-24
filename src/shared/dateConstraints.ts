export const APP_TIMEZONE = 'Asia/Kolkata';

export type DateFieldErrorCode = 'INVALID_FORMAT' | 'FUTURE_DATE';
export type DateRangeErrorCode = DateFieldErrorCode | 'START_AFTER_END';

export interface DateRangeValidationResult {
  isValid: boolean;
  maxDate: string; // Dynamic current date in Asia/Kolkata (YYYY-MM-DD)
  startError: DateFieldErrorCode | null;
  endError: DateFieldErrorCode | null;
  rangeError: 'START_AFTER_END' | null;
  errorCode: DateRangeErrorCode | null;
  message: string | null;
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Dynamically computes today's calendar date (YYYY-MM-DD) in Asia/Kolkata (IST).
 * Never hardcoded — always derived from the supplied or current system clock.
 */
export function getCurrentIstDateString(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (year && month && day) {
    return `${year}-${month}-${day}`;
  }
  // Safe fallback using IST fixed UTC+05:30 offset if Intl parts are unavailable
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
}

/**
 * Converts an ISO timestamp into its Asia/Kolkata calendar date (YYYY-MM-DD).
 */
export function getIstDateFromTimestamp(isoTimestamp: string): string | null {
  const parsed = Date.parse(isoTimestamp);
  if (Number.isNaN(parsed)) return null;
  return getCurrentIstDateString(new Date(parsed));
}

/**
 * Validates strict YYYY-MM-DD format and ensures the calendar day genuinely exists
 * (e.g., rejects 2026-02-30 or 2026-13-01).
 */
export function isValidIsoDateString(value: string): boolean {
  const trimmed = value.trim();
  const match = ISO_DATE_RE.exec(trimmed);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

/**
 * Checks whether a YYYY-MM-DD date string is strictly in the future relative to
 * the dynamic current date in Asia/Kolkata.
 */
export function isFutureIstDate(dateStr: string, now: Date = new Date()): boolean {
  if (!dateStr || !isValidIsoDateString(dateStr)) return false;
  return dateStr.trim() > getCurrentIstDateString(now);
}

/**
 * Validates startDate and endDate against dynamic Asia/Kolkata current date and ordering.
 * - Rejects malformed dates.
 * - Rejects future dates for both startDate and endDate (> today in Asia/Kolkata).
 * - Rejects inverted ranges where startDate > endDate.
 */
export function validateDateRange(
  startDate: string,
  endDate: string,
  now: Date = new Date()
): DateRangeValidationResult {
  const maxDate = getCurrentIstDateString(now);
  const start = (startDate || '').trim();
  const end = (endDate || '').trim();

  let startError: DateFieldErrorCode | null = null;
  let endError: DateFieldErrorCode | null = null;
  let rangeError: 'START_AFTER_END' | null = null;

  if (start) {
    if (!isValidIsoDateString(start)) {
      startError = 'INVALID_FORMAT';
    } else if (start > maxDate) {
      startError = 'FUTURE_DATE';
    }
  }

  if (end) {
    if (!isValidIsoDateString(end)) {
      endError = 'INVALID_FORMAT';
    } else if (end > maxDate) {
      endError = 'FUTURE_DATE';
    }
  }

  if (!startError && !endError && start && end && start > end) {
    rangeError = 'START_AFTER_END';
  }

  let errorCode: DateRangeErrorCode | null = null;
  let message: string | null = null;

  if (startError === 'INVALID_FORMAT' || endError === 'INVALID_FORMAT') {
    errorCode = 'INVALID_FORMAT';
    message = 'Enter a valid calendar date in YYYY-MM-DD format.';
  } else if (startError === 'FUTURE_DATE') {
    errorCode = 'FUTURE_DATE';
    message = `Future start date (${start}) is not allowed. Maximum selectable date is ${maxDate} (IST / Asia/Kolkata).`;
  } else if (endError === 'FUTURE_DATE') {
    errorCode = 'FUTURE_DATE';
    message = `Future end date (${end}) is not allowed. Maximum selectable date is ${maxDate} (IST / Asia/Kolkata).`;
  } else if (rangeError === 'START_AFTER_END') {
    errorCode = 'START_AFTER_END';
    message = `Start date (${start}) cannot be later than end date (${end}).`;
  }

  return {
    isValid: !startError && !endError && !rangeError,
    maxDate,
    startError,
    endError,
    rangeError,
    errorCode,
    message,
  };
}
