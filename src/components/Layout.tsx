import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Upload,
  PhoneCall,
  Globe,
  Share2,
  MapPin,
  Cpu,
  MessageSquareText,
  FileText,
  ShieldCheck,
  Settings,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LogOut,
  ChevronDown,
  AlertTriangle,
  Sun,
  Moon,
  Languages,
  Check,
} from 'lucide-react';
import { AuthUser, CaseRecord, NavSection, CDRRecord, IPDRRecord } from '../shared/types';
import { BrandMark } from './BrandMark';
import { GlobalFooter } from './GlobalFooter';
import { CaseAnalyticsSummary } from '../shared/analytics';
import { usePreferences } from '../lib/preferences';
import { TranslationKey } from '../lib/i18n';

interface LayoutProps {
  user: AuthUser;
  cases: CaseRecord[];
  activeCase: CaseRecord | null;
  activeSection: NavSection;
  analytics: CaseAnalyticsSummary | null;
  cdrs: CDRRecord[];
  ipdrs: IPDRRecord[];
  onSelectSection: (section: NavSection) => void;
  onSelectCase: (caseId: string) => void;
  onLogout: () => void;
  onInspectCdr: (rec: CDRRecord) => void;
  onInspectIpdr: (rec: IPDRRecord) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', labelKey: 'nav.overview', icon: LayoutDashboard },
  { id: 'cases', labelKey: 'nav.cases', icon: Briefcase },
  { id: 'import', labelKey: 'nav.import', icon: Upload },
  { id: 'cdr', labelKey: 'nav.cdr', icon: PhoneCall },
  { id: 'ipdr', labelKey: 'nav.ipdr', icon: Globe },
  { id: 'network', labelKey: 'nav.network', icon: Share2 },
  { id: 'towers', labelKey: 'nav.towers', icon: MapPin },
  { id: 'imei', labelKey: 'nav.imei', icon: Cpu },
  { id: 'ai', labelKey: 'nav.ai', icon: MessageSquareText },
  { id: 'reports', labelKey: 'nav.reports', icon: FileText },
  { id: 'audit', labelKey: 'nav.audit', icon: ShieldCheck },
  { id: 'settings', labelKey: 'nav.settings', icon: Settings },
];

export const Layout: React.FC<LayoutProps> = ({
  user,
  cases,
  activeCase,
  activeSection,
  analytics,
  cdrs,
  ipdrs,
  onSelectSection,
  onSelectCase,
  onLogout,
  onInspectCdr,
  onInspectIpdr,
  children,
}) => {
  const { theme, toggleTheme, language, setLanguage, t } = usePreferences();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const visibleNavItems = useMemo(() => {
    if (user.role === 'Viewer') {
      return NAV_ITEMS.filter((item) => item.id !== 'audit' && item.id !== 'settings');
    }
    if (user.role === 'Administrator') {
      return NAV_ITEMS;
    }
    return NAV_ITEMS;
  }, [user.role]);

  const currentNav = visibleNavItems.find((n) => n.id === activeSection) || visibleNavItems[0];

  const searchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (q.length < 2) return null;
    const matchedSuspects = (activeCase?.suspects || []).filter(
      (s) =>
        s.phoneNumber.toLowerCase().includes(q) ||
        s.alias.toLowerCase().includes(q) ||
        s.label.toLowerCase().includes(q) ||
        s.primaryImei.toLowerCase().includes(q)
    );
    const matchedCdrs = cdrs
      .filter(
        (r) =>
          r.caller_number.toLowerCase().includes(q) ||
          r.receiver_number.toLowerCase().includes(q) ||
          r.cell_id.toLowerCase().includes(q) ||
          r.imei.toLowerCase().includes(q) ||
          r.record_id.toLowerCase().includes(q)
      )
      .slice(0, 6);
    const matchedIpdrs = ipdrs
      .filter(
        (r) =>
          r.public_ip.toLowerCase().includes(q) ||
          r.destination_ip.toLowerCase().includes(q) ||
          r.subscriber_id.toLowerCase().includes(q) ||
          r.record_id.toLowerCase().includes(q)
      )
      .slice(0, 4);
    return { matchedSuspects, matchedCdrs, matchedIpdrs };
  }, [globalSearch, activeCase, cdrs, ipdrs]);

  const notifications = useMemo(() => {
    if (!analytics || !activeCase) return [];
    const items: Array<{ id: string; title: string; detail: string; target: NavSection }> = [];
    for (const dev of analytics.deviceAlerts) {
      items.push({
        id: dev.id,
        title: dev.type === 'IMEI_CHANGE' ? t('alert.imeiTransition') : t('alert.simSwap'),
        detail: `${dev.primaryIdentifier} (${dev.suspectLabel || 'Subscriber'}) · ${dev.associatedIdentifiers.length} IDs`,
        target: 'imei',
      });
    }
    if (analytics.commonContacts.length > 0) {
      items.push({
        id: 'notif-common',
        title: t('alert.sharedContacts'),
        detail: `${analytics.commonContacts.length} (${analytics.commonContacts[0].phoneNumber})`,
        target: 'network',
      });
    }
    if (analytics.unusualPatterns.length > 0) {
      items.push({
        id: 'notif-burst',
        title: t('alert.unusualFreq'),
        detail: `${analytics.unusualPatterns[0].phoneNumber}: ${analytics.unusualPatterns[0].reason}`,
        target: 'cdr',
      });
    }
    if (activeCase.verificationStatus !== 'Verified by Investigator') {
      items.push({
        id: 'notif-verify',
        title: t('alert.verifyPending'),
        detail: `${activeCase.caseNumber} · ${t('shell.pendingOfficerReview')}`,
        target: 'reports',
      });
    }
    return items;
  }, [analytics, activeCase, t]);

  const handleNavClick = (section: NavSection) => {
    onSelectSection(section);
    setMobileMenuOpen(false);
  };

  const verificationLabel =
    activeCase?.verificationStatus === 'Verified by Investigator'
      ? t('shell.verifiedByInvestigator')
      : activeCase?.verificationStatus
      ? t('shell.pendingOfficerReview')
      : t('shell.pending');

  return (
    <div className="min-h-screen flex bg-[#F5F5F2] dark:bg-[#101A30] text-[#17243B] dark:text-[#F4F5F7] transition-colors">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-[#101A30] dark:bg-[#0B1222] text-[#F4F5F7] border-r border-[#1E2E4D] dark:border-[#1F3152] shrink-0 transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[256px]'
        }`}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-[#1E2E4D] dark:border-[#1F3152]">
          <BrandMark compact={sidebarCollapsed} darkSurface />
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 text-[#8993A5] hover:text-white rounded hover:bg-[#17243B] transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            const label = t(item.labelKey);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                title={sidebarCollapsed ? label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#17243B] text-white border border-[#2B3E61]'
                    : 'text-[#B5C0D0] hover:bg-[#17243B]/60 hover:text-white border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? 'text-[#C5A66A]' : 'text-[#8993A5]'}`}
                />
                {!sidebarCollapsed && <span className="truncate">{label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#1E2E4D] dark:border-[#1F3152] text-[11px] text-[#8993A5]">
          {!sidebarCollapsed ? (
            <div className="space-y-1 px-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[#E2E8F0] font-medium truncate">
                  {t(`role.${user.role}` as TranslationKey)}
                </p>
                {user.role === 'Viewer' && (
                  <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold tracking-wide bg-[#17243B] border border-[#C5A66A]/60 text-[#C5A66A] rounded shrink-0">
                    PERSONAL
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-[#8993A5]">
                {user.role === 'Viewer'
                  ? 'Isolated Personal Scope'
                  : user.role === 'Administrator'
                  ? 'Governance Scope'
                  : 'Assigned Case Scope'}
              </p>
            </div>
          ) : (
            <div
              className="flex justify-center"
              title={t(`role.${user.role}` as TranslationKey)}
            >
              <span className="text-[10px] font-mono text-[#C5A66A]">{user.badgeCode}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-[#101A30]/60" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-[#101A30] dark:bg-[#0B1222] text-[#F4F5F7] flex flex-col h-full shadow-2xl">
            <div className="h-14 px-4 flex items-center justify-between border-b border-[#1E2E4D]">
              <BrandMark darkSurface />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="p-1.5 text-[#8993A5] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Theme & Language Controls inside Drawer */}
            <div className="px-3.5 py-3 border-b border-[#1E2E4D] bg-[#17243B]/60 space-y-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#C5A66A]">
                {t('shell.preferences')}
              </p>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex-1 h-8 px-2.5 rounded border border-[#2B3E61] bg-[#101A30] hover:bg-[#17243B] text-xs font-medium text-[#F4F5F7] inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-[#C5A66A]" />
                      <span>{t('shell.themeLight')}</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-[#C5A66A]" />
                      <span>{t('shell.themeDark')}</span>
                    </>
                  )}
                </button>
                <div className="flex items-center rounded border border-[#2B3E61] bg-[#101A30] p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`px-2 py-1 rounded font-medium transition-colors ${
                      language === 'en' ? 'bg-[#C5A66A] text-[#101A30]' : 'text-[#B5C0D0]'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('hi')}
                    className={`px-2 py-1 rounded font-medium transition-colors ${
                      language === 'hi' ? 'bg-[#C5A66A] text-[#101A30]' : 'text-[#B5C0D0]'
                    }`}
                  >
                    हिंदी
                  </button>
                </div>
              </div>
            </div>

            <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[#17243B] text-white border border-[#2B3E61]'
                        : 'text-[#B5C0D0] hover:bg-[#17243B]/60 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#C5A66A]' : 'text-[#8993A5]'}`} />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Right Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Slim Top Navigation Bar */}
        <header className="h-14 bg-white dark:bg-[#17243B] border-b border-[#E2E7EF] dark:border-[#243656] px-4 lg:px-6 flex items-center justify-between gap-3 sticky top-0 z-30 transition-colors">
          {/* Left: Mobile Trigger + Global Search */}
          <div className="flex items-center gap-3 flex-1 max-w-md min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-[#17243B] dark:text-[#F4F5F7] hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] rounded"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-[#8993A5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                placeholder={t('shell.searchPlaceholder')}
                aria-label="Global case search"
                className="w-full h-9 pl-9 pr-3 text-sm bg-[#F5F7FA] dark:bg-[#101A30] border border-[#E2E7EF] dark:border-[#2A3F63] rounded text-[#17243B] dark:text-[#F4F5F7] placeholder:text-[#8993A5] focus:outline-none focus:bg-white dark:focus:bg-[#101A30] focus:border-[#17243B] dark:focus:border-[#C5A66A] transition-colors"
              />
              {searchFocused && searchResults && (
                <div className="absolute left-0 right-0 top-11 bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#2A3F63] rounded shadow-lg z-40 max-h-96 overflow-y-auto divide-y divide-[#E2E7EF] dark:divide-[#243656]">
                  {searchResults.matchedSuspects.length === 0 &&
                  searchResults.matchedCdrs.length === 0 &&
                  searchResults.matchedIpdrs.length === 0 ? (
                    <p className="p-4 text-xs text-[#64748B] dark:text-[#8993A5]">
                      {t('shell.noSearchMatch')}
                    </p>
                  ) : (
                    <>
                      {searchResults.matchedSuspects.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-[11px] font-semibold text-[#8993A5]">
                            {t('shell.suspects')}
                          </p>
                          {searchResults.matchedSuspects.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onMouseDown={() => {
                                onSelectSection('cases');
                                setGlobalSearch('');
                              }}
                              className="w-full text-left px-2 py-1.5 hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] rounded text-xs flex justify-between"
                            >
                              <span className="font-medium text-[#17243B] dark:text-[#F4F5F7]">
                                {s.label} — {s.alias}
                              </span>
                              <span className="font-mono text-[#64748B] dark:text-[#8993A5]">
                                {s.phoneNumber}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.matchedCdrs.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-[11px] font-semibold text-[#8993A5]">
                            {t('shell.cdrRecords')}
                          </p>
                          {searchResults.matchedCdrs.map((r) => (
                            <button
                              key={r.record_id}
                              type="button"
                              onMouseDown={() => {
                                onInspectCdr(r);
                                setGlobalSearch('');
                              }}
                              className="w-full text-left px-2 py-1.5 hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] rounded text-xs flex justify-between gap-2"
                            >
                              <span className="font-mono text-[#17243B] dark:text-[#F4F5F7] truncate">
                                {r.caller_number} {'->'} {r.receiver_number}
                              </span>
                              <span className="font-mono text-[#64748B] dark:text-[#8993A5] shrink-0">
                                {r.cell_id}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.matchedIpdrs.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-[11px] font-semibold text-[#8993A5]">
                            {t('shell.ipdrSessions')}
                          </p>
                          {searchResults.matchedIpdrs.map((r) => (
                            <button
                              key={r.record_id}
                              type="button"
                              onMouseDown={() => {
                                onInspectIpdr(r);
                                setGlobalSearch('');
                              }}
                              className="w-full text-left px-2 py-1.5 hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] rounded text-xs flex justify-between gap-2"
                            >
                              <span className="font-mono text-[#17243B] dark:text-[#F4F5F7] truncate">
                                {r.public_ip}:{r.source_port}
                              </span>
                              <span className="font-mono text-[#64748B] dark:text-[#8993A5] shrink-0">
                                {r.subscriber_id}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Case Selector + Theme Toggle + Language Dropdown + Alerts + User Profile */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Active Case Selector */}
            <div className="hidden xl:flex items-center gap-2">
              <label
                htmlFor="active-case-select"
                className="text-xs text-[#64748B] dark:text-[#8993A5] whitespace-nowrap"
              >
                {t('shell.activeCase')}
              </label>
              <select
                id="active-case-select"
                value={activeCase?.id || ''}
                disabled={cases.length === 0}
                onChange={(e) => onSelectCase(e.target.value)}
                className="h-9 max-w-[215px] px-2.5 text-xs font-medium bg-[#F5F7FA] dark:bg-[#101A30] border border-[#E2E7EF] dark:border-[#2A3F63] rounded text-[#17243B] dark:text-[#F4F5F7] focus:outline-none focus:border-[#17243B] dark:focus:border-[#C5A66A] disabled:opacity-60"
              >
                {cases.length === 0 ? (
                  <option value="">
                    {user.role === 'Viewer' ? 'No personal cases yet' : 'No assigned cases'}
                  </option>
                ) : (
                  cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.complaintId ? `${c.complaintId} (${c.caseNumber})` : c.caseNumber} — {c.title}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* A. Theme Switcher (Sun / Moon) */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? t('shell.switchToLight') : t('shell.switchToDark')}
              aria-label={theme === 'dark' ? t('shell.switchToLight') : t('shell.switchToDark')}
              className="h-9 w-9 flex items-center justify-center rounded border border-[#E2E7EF] dark:border-[#2A3F63] bg-white dark:bg-[#101A30] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D] text-[#17243B] dark:text-[#C5A66A] transition-colors shrink-0"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* B. Language Selector (English / हिंदी) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setLangMenuOpen((v) => !v);
                  setAlertsOpen(false);
                  setProfileOpen(false);
                }}
                aria-expanded={langMenuOpen}
                aria-haspopup="menu"
                aria-label={t('shell.languageLabel')}
                className="h-9 px-2.5 flex items-center gap-1.5 rounded border border-[#E2E7EF] dark:border-[#2A3F63] bg-white dark:bg-[#101A30] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D] text-xs font-medium text-[#17243B] dark:text-[#F4F5F7] transition-colors whitespace-nowrap"
              >
                <Languages className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A] shrink-0" />
                <span>{language === 'hi' ? 'हिंदी' : 'English'}</span>
                <ChevronDown className="w-3 h-3 text-[#8993A5]" />
              </button>

              {langMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setLangMenuOpen(false)} />
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-40 bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#2A3F63] rounded shadow-lg z-40 py-1 text-xs"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setLanguage('en');
                        setLangMenuOpen(false);
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] flex items-center justify-between text-[#17243B] dark:text-[#F4F5F7]"
                    >
                      <span>English</span>
                      {language === 'en' && <Check className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setLanguage('hi');
                        setLangMenuOpen(false);
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] flex items-center justify-between text-[#17243B] dark:text-[#F4F5F7]"
                    >
                      <span>हिंदी (Hindi)</span>
                      {language === 'hi' && <Check className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A]" />}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Notifications Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setAlertsOpen((v) => !v);
                  setProfileOpen(false);
                  setLangMenuOpen(false);
                }}
                aria-label="Investigation alerts"
                className="relative h-9 w-9 flex items-center justify-center rounded border border-[#E2E7EF] dark:border-[#2A3F63] bg-white dark:bg-[#101A30] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D] text-[#17243B] dark:text-[#F4F5F7] transition-colors"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded bg-[#101A30] dark:bg-[#C5A66A] text-[#C5A66A] dark:text-[#101A30] text-[10px] font-mono font-semibold flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>

              {alertsOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setAlertsOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#2A3F63] rounded shadow-lg z-40">
                    <div className="px-4 py-3 border-b border-[#E2E7EF] dark:border-[#243656] flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                        {t('shell.alertsTitle')}
                      </span>
                      <span className="text-[11px] text-[#64748B] dark:text-[#8993A5] font-mono">
                        {t('shell.alertsItems', { count: notifications.length })}
                      </span>
                    </div>
                    <div className="divide-y divide-[#E2E7EF] dark:divide-[#243656] max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-xs text-[#64748B] dark:text-[#8993A5]">
                          {t('shell.noAlerts')}
                        </p>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              setAlertsOpen(false);
                              onSelectSection(n.target);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] transition-colors flex items-start gap-2.5"
                          >
                            <AlertTriangle className="w-4 h-4 text-[#EA580C] dark:text-[#F97316] shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                                {n.title}
                              </p>
                              <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-0.5 leading-snug">
                                {n.detail}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((v) => !v);
                  setAlertsOpen(false);
                  setLangMenuOpen(false);
                }}
                className="h-9 pl-2 pr-2 flex items-center gap-2 rounded border border-[#E2E7EF] dark:border-[#2A3F63] bg-white dark:bg-[#101A30] hover:bg-[#F5F7FA] dark:hover:bg-[#1E2E4D] transition-colors"
              >
                <div className="w-6 h-6 rounded bg-[#101A30] dark:bg-[#C5A66A] text-[#C5A66A] dark:text-[#101A30] text-[11px] font-mono font-semibold flex items-center justify-center shrink-0">
                  {user.name
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div className="hidden md:block text-left leading-tight">
                  <p className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7] whitespace-nowrap">
                    {user.name}
                  </p>
                  <p className="text-[10px] text-[#64748B] dark:text-[#8993A5] whitespace-nowrap">
                    {user.role}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#8993A5]" />
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#2A3F63] rounded shadow-lg z-40 py-2">
                    <div className="px-4 py-2 border-b border-[#E2E7EF] dark:border-[#243656]">
                      <p className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                        {user.name}
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] font-mono">
                        {user.email}
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] mt-1">
                        {t('shell.roleLabel')}{' '}
                        <span className="text-[#17243B] dark:text-[#F4F5F7] font-medium">
                          {user.role}
                        </span>{' '}
                        · {user.badgeCode}
                      </p>
                    </div>
                    {user.role !== 'Viewer' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen(false);
                            onSelectSection('audit');
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] transition-colors"
                        >
                          {t('shell.securityAudit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen(false);
                            onSelectSection('settings');
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F5F7FA] dark:hover:bg-[#101A30] transition-colors"
                        >
                          {t('shell.accessSettings')}
                        </button>
                      </>
                    )}
                    <div className="border-t border-[#E2E7EF] dark:border-[#243656] mt-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-[#DC2626] dark:text-[#F87171] hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        {t('shell.signOut')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Sub-header Breadcrumb & Status */}
        <div className="bg-white dark:bg-[#131F35] border-b border-[#E2E7EF] dark:border-[#243656] px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs transition-colors">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[#64748B] dark:text-[#8993A5]">
            <button
              type="button"
              onClick={() => onSelectSection('overview')}
              className="hover:text-[#17243B] dark:hover:text-white transition-colors font-medium"
            >
              TRACE INTEL
            </button>
            <span aria-hidden="true">/</span>
            {activeCase && (
              <>
                <span className="font-mono text-[#17243B] dark:text-[#C5A66A]">
                  {activeCase.caseNumber}
                </span>
                <span aria-hidden="true">/</span>
              </>
            )}
            <span className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
              {t(currentNav.labelKey)}
            </span>
          </nav>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748B] dark:text-[#8993A5]">
            <span className="inline-flex items-center gap-1.5">
              {t('shell.roleLabel')}{' '}
              <strong className="text-[#17243B] dark:text-[#E2E8F0]">
                {t(`role.${user.role}` as TranslationKey)}
              </strong>
              {user.role === 'Viewer' && (
                <span
                  data-testid="viewer-scope-badge"
                  className="px-1.5 py-0.5 text-[10px] font-mono font-semibold tracking-wide bg-[#101A30] dark:bg-[#1E2E4D] text-[#C5A66A] border border-[#2B3E61] rounded"
                >
                  PERSONAL SCOPE
                </span>
              )}
            </span>
            {activeCase && (user.role !== 'Administrator' || Boolean(user.canAccessSensitiveCaseData)) && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {t('shell.verification')}{' '}
                  <strong
                    className={
                      activeCase.verificationStatus === 'Verified by Investigator'
                        ? 'text-[#16A34A] dark:text-[#22C55E]'
                        : 'text-[#EA580C] dark:text-[#F97316]'
                    }
                  >
                    {verificationLabel}
                  </strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Tablet/Mobile Case Selector Bar */}
        <div className="xl:hidden bg-white dark:bg-[#17243B] border-b border-[#E2E7EF] dark:border-[#243656] px-4 py-2 flex items-center gap-2">
          <span className="text-xs text-[#64748B] dark:text-[#8993A5] shrink-0">
            {t('shell.caseShort')}
          </span>
          <select
            value={activeCase?.id || ''}
            disabled={cases.length === 0}
            onChange={(e) => onSelectCase(e.target.value)}
            className="flex-1 h-8 px-2 text-xs bg-[#F5F7FA] dark:bg-[#101A30] border border-[#E2E7EF] dark:border-[#2A3F63] rounded text-[#17243B] dark:text-[#F4F5F7] disabled:opacity-60"
          >
            {cases.length === 0 ? (
              <option value="">
                {user.role === 'Viewer' ? 'No personal cases yet' : 'No assigned cases'}
              </option>
            ) : (
              cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.complaintId ? `${c.complaintId} (${c.caseNumber})` : c.caseNumber} — {c.title}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Main Workspace Viewport */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">{children}</main>

        {/* Global Official Cyber Crime Resources & Emergency Helplines Footer */}
        <GlobalFooter />
      </div>
    </div>
  );
};
