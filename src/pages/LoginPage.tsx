import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sun,
  Moon,
  Languages,
  KeyRound,
  RefreshCw,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import { GlobalFooter } from '../components/GlobalFooter';
import { AuthUser, UserRole, LoginChallengeResponse } from '../shared/types';
import { api, ApiError } from '../lib/api';
import { usePreferences } from '../lib/preferences';
import { TranslationKey } from '../lib/i18n';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser, aiConfigured: boolean) => void;
}

interface RoleConfig {
  role: UserRole;
  defaultEmail: string;
  defaultPassword: string;
  requiresOtp: boolean;
  descKey: TranslationKey;
}

const ROLE_CONFIGS: RoleConfig[] = [
  {
    role: 'Administrator',
    defaultEmail: 'admin@traceintel.demo',
    defaultPassword: 'DemoAdmin#2026',
    requiresOtp: true,
    descKey: 'login.roleAdminDesc',
  },
  {
    role: 'Investigator',
    defaultEmail: 'investigator@traceintel.demo',
    defaultPassword: 'DemoInvest#2026',
    requiresOtp: true,
    descKey: 'login.roleInvDesc',
  },
  {
    role: 'Viewer',
    defaultEmail: 'viewer@traceintel.demo',
    defaultPassword: 'DemoViewer#2026',
    requiresOtp: false,
    descKey: 'login.roleViewerDesc',
  },
];

const DEFAULT_EMAILS = new Set(ROLE_CONFIGS.map((r) => r.defaultEmail));

function formatCountdown(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { theme, toggleTheme, language, setLanguage, t } = usePreferences();

  // Step 1: Primary credentials & Access Role
  const [role, setRole] = useState<UserRole>('Investigator');
  const [email, setEmail] = useState('investigator@traceintel.demo');
  const [password, setPassword] = useState('DemoInvest#2026');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2: Two-Level Server-Side OTP (Administrator & Investigator only)
  const [otpChallenge, setOtpChallenge] = useState<LoginChallengeResponse | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpExpiryLeft, setOtpExpiryLeft] = useState(0);
  const [resendCooldownLeft, setResendCooldownLeft] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!otpChallenge) return;
    const timer = window.setInterval(() => {
      setOtpExpiryLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldownLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpChallenge]);

  const handleRoleSelect = (nextRole: UserRole) => {
    setRole(nextRole);
    setError(null);
    const config = ROLE_CONFIGS.find((r) => r.role === nextRole);
    if (config && (!email.trim() || DEFAULT_EMAILS.has(email.trim().toLowerCase()))) {
      setEmail(config.defaultEmail);
      setPassword(config.defaultPassword);
    }
  };

  const handlePrimarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResendNotice(null);
    setLoading(true);
    try {
      const res = await api.login({
        email: email.trim(),
        password,
        role,
        rememberSession,
      });

      if (res.requiresOtp) {
        setOtpChallenge(res);
        setOtpInput('');
        setOtpExpiryLeft(res.expiresInSeconds);
        setResendCooldownLeft(res.resendCooldownSeconds);
        setAttemptsRemaining(res.maxAttempts);
      } else {
        onLoginSuccess(res.user, res.aiConfigured);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t('login.authReachError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpChallenge) return;
    setError(null);
    setResendNotice(null);
    setLoading(true);
    try {
      const res = await api.verifyOtp({
        challengeId: otpChallenge.challengeId,
        otp: otpInput.trim(),
      });
      onLoginSuccess(res.user, res.aiConfigured);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (typeof err.attemptsRemaining === 'number') {
          setAttemptsRemaining(err.attemptsRemaining);
        }
      } else {
        setError(t('login.authReachError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!otpChallenge || resendCooldownLeft > 0 || resending) return;
    setError(null);
    setResendNotice(null);
    setResending(true);
    try {
      const refreshed = await api.resendOtp({ challengeId: otpChallenge.challengeId });
      setOtpChallenge(refreshed);
      setOtpInput('');
      setOtpExpiryLeft(refreshed.expiresInSeconds);
      setResendCooldownLeft(refreshed.resendCooldownSeconds);
      setAttemptsRemaining(refreshed.maxAttempts);
      setResendNotice(t('login.otpDispatchTitle'));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (typeof err.retryAfterSeconds === 'number') {
          setResendCooldownLeft(err.retryAfterSeconds);
        }
      } else {
        setError(t('login.authReachError'));
      }
    } finally {
      setResending(false);
    }
  };

  const resetToPrimaryLogin = () => {
    setOtpChallenge(null);
    setOtpInput('');
    setError(null);
    setResendNotice(null);
    setAttemptsRemaining(null);
  };

  const selectedRoleConfig = ROLE_CONFIGS.find((r) => r.role === role) || ROLE_CONFIGS[1];

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F2] dark:bg-[#0E172A] text-[#17243B] dark:text-[#F4F5F7] transition-colors">
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Institutional Brand Surface — Clean, Minimal, Focused */}
        <div className="lg:w-[44%] bg-[#101A30] dark:bg-[#0B1222] text-[#F4F5F7] px-8 py-10 lg:px-16 lg:py-14 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#1E2E4D]">
          <div>
            <BrandMark darkSurface />
          </div>

          <div className="my-12 lg:my-0 max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C5A66A]">
              {t('login.eyebrow')}
            </p>
            <h1 className="mt-4 text-3xl lg:text-[38px] font-semibold leading-[1.16] tracking-tight text-white">
              {t('login.heroTitle')}
            </h1>
            <div className="mt-7 h-0.5 w-14 bg-[#C5A66A]" aria-hidden="true" />
          </div>

          <div className="text-xs text-[#7D8BA1] font-mono tracking-wide">
            TRACE INTEL · v1.0
          </div>
        </div>

        {/* Right Authentication Workspace */}
        <div className="flex-1 flex flex-col">
          {/* Top-right Theme & Language Bar */}
          <div className="px-6 py-4 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? t('shell.switchToLight') : t('shell.switchToDark')}
              aria-label={theme === 'dark' ? t('shell.switchToLight') : t('shell.switchToDark')}
              className="h-9 px-3 rounded border border-[#DCE3EE] dark:border-[#243656] bg-white dark:bg-[#17243B] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D] text-xs font-medium text-[#17243B] dark:text-[#C5A66A] inline-flex items-center gap-1.5 transition-colors"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4" />
                  <span>{t('shell.themeLight')}</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4" />
                  <span>{t('shell.themeDark')}</span>
                </>
              )}
            </button>

            <div className="inline-flex items-center rounded border border-[#DCE3EE] dark:border-[#243656] bg-white dark:bg-[#17243B] p-0.5 text-xs">
              <Languages className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A] ml-2 mr-1" />
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  language === 'en'
                    ? 'bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30]'
                    : 'text-[#64748B] dark:text-[#8993A5]'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  language === 'hi'
                    ? 'bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30]'
                    : 'text-[#64748B] dark:text-[#8993A5]'
                }`}
              >
                हिंदी
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center px-6 py-8 lg:px-12 lg:pb-14">
            <div className="w-full max-w-[448px]">
              {/* Authentication Card */}
              <div className="bg-white dark:bg-[#17243B] border border-[#DCE3EE] dark:border-[#243656] rounded-md p-7 lg:p-8 shadow-sm">
                {!otpChallenge ? (
                  <>
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold text-[#101A30] dark:text-[#F4F5F7]">
                        {t('login.signInHeading')}
                      </h2>
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
                        {t('login.signInSub')}
                      </p>
                    </div>

                    {error && (
                      <div
                        role="alert"
                        className="mb-5 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded flex items-start gap-2 text-xs text-[#DC2626] dark:text-[#F87171]"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <form onSubmit={handlePrimarySubmit} className="space-y-5">
                      {/* Access Role Section (Integrated directly into Login Form — 3 Roles Only) */}
                      <div>
                        <span className="block text-xs font-semibold text-[#17243B] dark:text-[#E2E8F0] mb-2">
                          {t('login.roleLabel')}
                        </span>
                        <div
                          role="radiogroup"
                          aria-label={t('login.roleLabel')}
                          className="space-y-2"
                        >
                          {ROLE_CONFIGS.map((cfg) => {
                            const active = role === cfg.role;
                            return (
                              <button
                                key={cfg.role}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => handleRoleSelect(cfg.role)}
                                className={`w-full text-left px-3.5 py-2.5 rounded border transition-colors flex items-center justify-between gap-3 ${
                                  active
                                    ? 'bg-[#EEF4FC] dark:bg-[#101A30] border-[#1D4ED8] dark:border-[#C5A66A]'
                                    : 'bg-[#F8FAFC] dark:bg-[#131F35] border-[#E2E8F0] dark:border-[#243656] hover:border-[#94A3B8] dark:hover:border-[#3B527A]'
                                }`}
                              >
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <span
                                    className={`mt-1 w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                      active
                                        ? 'border-[#1D4ED8] dark:border-[#C5A66A]'
                                        : 'border-[#94A3B8] dark:border-[#475569]'
                                    }`}
                                  >
                                    {active && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8] dark:bg-[#C5A66A]" />
                                    )}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-[#101A30] dark:text-[#F4F5F7]">
                                      {t(`role.${cfg.role}` as TranslationKey)}
                                    </p>
                                    <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] mt-0.5 truncate">
                                      {t(cfg.descKey)}
                                    </p>
                                  </div>
                                </div>
                                <span
                                  className={`text-[10px] font-mono shrink-0 px-2 py-0.5 rounded border ${
                                    cfg.requiresOtp
                                      ? 'text-[#1D4ED8] dark:text-[#93C5FD] border-[#BFDBFE] dark:border-[#1E3A5F] bg-white dark:bg-[#17243B]'
                                      : 'text-[#475569] dark:text-[#94A3B8] border-[#CBD5E1] dark:border-[#2A3F63] bg-white dark:bg-[#17243B]'
                                  }`}
                                >
                                  {cfg.requiresOtp ? t('login.otpBadge') : t('login.directBadge')}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="login-email"
                          className="block text-xs font-medium text-[#334155] dark:text-[#CBD5E1] mb-1.5"
                        >
                          {t('login.emailLabel')}
                        </label>
                        <input
                          id="login-email"
                          type="text"
                          required
                          autoComplete="username"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="investigator@traceintel.demo"
                          className="w-full h-10 px-3 text-sm bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2A3F63] rounded text-[#101A30] dark:text-[#F4F5F7] focus:outline-none focus:border-[#1D4ED8] dark:focus:border-[#C5A66A]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="login-password"
                          className="block text-xs font-medium text-[#334155] dark:text-[#CBD5E1] mb-1.5"
                        >
                          {t('login.passwordLabel')}
                        </label>
                        <div className="relative">
                          <input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full h-10 pl-3 pr-10 text-sm bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2A3F63] rounded text-[#101A30] dark:text-[#F4F5F7] focus:outline-none focus:border-[#1D4ED8] dark:focus:border-[#C5A66A]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] dark:text-[#8993A5] hover:text-[#17243B] dark:hover:text-white"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-0.5">
                        <label className="flex items-center gap-2 text-xs text-[#334155] dark:text-[#CBD5E1] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rememberSession}
                            onChange={(e) => setRememberSession(e.target.checked)}
                            className="rounded border-[#CBD2DE] dark:border-[#2A3F63] accent-[#101A30] dark:accent-[#C5A66A]"
                          />
                          <span>{t('login.extendSession')}</span>
                        </label>
                        <span className="text-[11px] font-mono text-[#64748B] dark:text-[#8993A5] flex items-center gap-1">
                          <Lock className="w-3 h-3" /> {t('login.bearerSession')}
                        </span>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-10 mt-1 bg-[#101A30] dark:bg-[#C5A66A] hover:bg-[#17243B] dark:hover:bg-[#d3b67c] disabled:opacity-60 text-white dark:text-[#101A30] text-sm font-medium rounded flex items-center justify-center gap-2 transition-colors"
                      >
                        <span>
                          {loading
                            ? t('login.verifying')
                            : selectedRoleConfig.requiresOtp
                            ? t('login.continueOtpBtn')
                            : t('login.submitBtn')}
                        </span>
                        {!loading && <ArrowRight className="w-4 h-4 text-[#C5A66A] dark:text-[#101A30]" />}
                      </button>
                    </form>
                    <p className="mt-5 pt-4 border-t border-[#E2E7EF] dark:border-[#243656] text-[11px] text-[#64748B] dark:text-[#8993A5] leading-relaxed">
                      Built-in evaluation profiles load synthetic demonstration CDR/IPDR records for offline analysis and workflow verification.
                    </p>
                  </>
                ) : (
                  /* Level 2: Server-Side OTP Verification Step (Administrator & Investigator) */
                  <div className="space-y-5">
                    <div>
                      <button
                        type="button"
                        onClick={resetToPrimaryLogin}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:text-[#101A30] dark:hover:text-white mb-4"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {t('login.otpBackBtn')}
                      </button>

                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded bg-[#EEF4FC] dark:bg-[#101A30] border border-[#BFDBFE] dark:border-[#2A3F63] flex items-center justify-center text-[#1D4ED8] dark:text-[#C5A66A]">
                          <KeyRound className="w-4 h-4" />
                        </span>
                        <div>
                          <h2 className="text-lg font-semibold text-[#101A30] dark:text-[#F4F5F7]">
                            {t('login.otpHeading')}
                          </h2>
                          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                            {t('login.otpSub', {
                              channel: otpChallenge.maskedChannel,
                              role: t(`role.${otpChallenge.role}` as TranslationKey),
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Server-Issued Temporary Verification Code (when present) */}
                    {otpChallenge.verificationDispatchCode && (
                      <div className="p-3.5 rounded border border-[#CBD5E1] dark:border-[#2A3F63] bg-[#F8FAFC] dark:bg-[#101A30] space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-[#17243B] dark:text-[#E2E8F0] inline-flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#1D4ED8] dark:text-[#C5A66A]" />
                            {t('login.otpDispatchTitle')}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-base font-bold tracking-[0.22em] tabular-nums text-[#101A30] dark:text-[#C5A66A] px-2.5 py-0.5 rounded bg-white dark:bg-[#17243B] border border-[#DCE3EE] dark:border-[#243656]">
                              {otpChallenge.verificationDispatchCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => setOtpInput(otpChallenge.verificationDispatchCode || '')}
                              className="px-2 py-1 text-[11px] font-medium rounded border border-[#CBD5E1] dark:border-[#2A3F63] bg-white dark:bg-[#17243B] hover:border-[#1D4ED8] dark:hover:border-[#C5A66A] text-[#101A30] dark:text-[#C5A66A] transition-colors whitespace-nowrap"
                            >
                              Use OTP
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] leading-relaxed">
                          {t('login.otpDispatchSub')}
                        </p>
                      </div>
                    )}

                    {resendNotice && (
                      <div className="p-2.5 rounded border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{resendNotice}</span>
                      </div>
                    )}

                    {error && (
                      <div
                        role="alert"
                        className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded flex items-start gap-2 text-xs text-[#DC2626] dark:text-[#F87171]"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            htmlFor="otp-code-input"
                            className="block text-xs font-medium text-[#334155] dark:text-[#CBD5E1]"
                          >
                            {t('login.otpInputLabel')}
                          </label>
                          <span
                            className={`text-[11px] font-mono inline-flex items-center gap-1 ${
                              otpExpiryLeft > 0
                                ? 'text-[#475569] dark:text-[#94A3B8]'
                                : 'text-[#DC2626] dark:text-[#F87171]'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {otpExpiryLeft > 0
                              ? t('login.otpExpiresIn', { time: formatCountdown(otpExpiryLeft) })
                              : t('login.otpExpired')}
                          </span>
                        </div>
                        <input
                          id="otp-code-input"
                          type="text"
                          inputMode="numeric"
                          pattern="\d{6}"
                          maxLength={6}
                          required
                          autoFocus
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder={t('login.otpPlaceholder')}
                          className="w-full h-11 px-4 text-center font-mono text-lg tracking-[0.35em] bg-white dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2A3F63] rounded text-[#101A30] dark:text-[#F4F5F7] focus:outline-none focus:border-[#1D4ED8] dark:focus:border-[#C5A66A]"
                        />
                        {attemptsRemaining !== null && (
                          <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-[#8993A5]">
                            {t('login.otpAttemptsLeft', { count: attemptsRemaining })}
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={loading || otpInput.length !== 6 || otpExpiryLeft === 0}
                        className="w-full h-10 bg-[#101A30] dark:bg-[#C5A66A] hover:bg-[#17243B] dark:hover:bg-[#d3b67c] disabled:opacity-55 text-white dark:text-[#101A30] text-sm font-medium rounded flex items-center justify-center gap-2 transition-colors"
                      >
                        <span>{loading ? t('login.otpVerifying') : t('login.otpVerifyBtn')}</span>
                        {!loading && <ArrowRight className="w-4 h-4 text-[#C5A66A] dark:text-[#101A30]" />}
                      </button>

                      <div className="pt-1 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          disabled={resendCooldownLeft > 0 || resending}
                          className="inline-flex items-center gap-1.5 font-medium text-[#1D4ED8] dark:text-[#C5A66A] hover:underline disabled:opacity-50 disabled:no-underline"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                          {resendCooldownLeft > 0
                            ? t('login.otpResendWait', { seconds: resendCooldownLeft })
                            : t('login.otpResendBtn')}
                        </button>
                        <span className="text-[11px] font-mono text-[#64748B] dark:text-[#8993A5]">
                          {t(`role.${otpChallenge.role}` as TranslationKey)}
                        </span>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Official Cyber Crime Resources & Emergency Helplines Footer */}
      <GlobalFooter />
    </div>
  );
};
