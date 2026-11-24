import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  ShieldAlert,
  Search,
  UserX,
  MessageSquareWarning,
  BellRing,
  ShieldCheck,
  BarChart3,
  FileText,
  Users,
  UserPlus,
  Phone,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  BookOpen,
  Compass,
} from 'lucide-react';
import {
  PORTAL_COLUMNS,
  PortalColumnId,
  PortalOptionId,
  VERIFIED_ADVISORIES,
  CYBER_SAFETY_CATEGORIES,
  NCRB_VERIFIED_STATS,
  SOCIAL_PLATFORM_GUIDES,
  RTI_AND_PUBLIC_DOCUMENTS,
  OFFICIAL_NCRP_HOME,
} from '../data/portalServicesData';
import { usePreferences } from '../lib/preferences';

const CATEGORY_CONFIG: Record<
  PortalColumnId,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    activeBorder: string;
  }
> = {
  report: {
    label: 'Report Cyber Crime',
    icon: ShieldAlert,
    iconColor: 'text-red-500',
    activeBorder: 'border-red-500/60',
  },
  learning: {
    label: 'Learning Corner',
    icon: BookOpen,
    iconColor: 'text-amber-500',
    activeBorder: 'border-amber-500/60',
  },
  volunteer: {
    label: 'Cyber Volunteers',
    icon: Users,
    iconColor: 'text-emerald-500',
    activeBorder: 'border-emerald-500/60',
  },
};

const OPTION_ICONS: Record<PortalOptionId, React.ComponentType<{ className?: string }>> = {
  'report-crime': ShieldAlert,
  'track-complaint': Search,
  'anonymous-reporting': UserX,
  'social-media-abuse': MessageSquareWarning,
  'advisories-alerts': BellRing,
  'cyber-safety-tips': ShieldCheck,
  'daily-threat-digits': BarChart3,
  'rti-statistics': FileText,
  'volunteer-overview': Users,
  'volunteer-register': UserPlus,
};

export const PortalServicesSection: React.FC = () => {
  const { chartTheme } = usePreferences();
  const [openDropdown, setOpenDropdown] = useState<PortalColumnId | null>(null);
  const [selectedOption, setSelectedOption] = useState<PortalOptionId | null>(null);
  const [advisorySearch, setAdvisorySearch] = useState('');
  const [advisoryPriority, setAdvisoryPriority] = useState<'ALL' | 'Critical' | 'High' | 'Advisory'>('ALL');
  const [activeSafetyCat, setActiveSafetyCat] = useState<string>(CYBER_SAFETY_CATEGORIES[0].id);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
        setSelectedOption(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdown(null);
        setSelectedOption(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleToggleDropdown = (colId: PortalColumnId) => {
    if (openDropdown === colId) {
      setOpenDropdown(null);
      setSelectedOption(null);
    } else {
      setOpenDropdown(colId);
      setSelectedOption(null);
    }
  };

  const handleSelectOption = (optionId: PortalOptionId) => {
    const ownerCol = PORTAL_COLUMNS.find((c) => c.options.some((o) => o.id === optionId));
    if (ownerCol) {
      setOpenDropdown(ownerCol.id);
    }
    setSelectedOption(optionId);
  };

  const handleBackToOptions = () => {
    setSelectedOption(null);
  };

  const handleClose = () => {
    setOpenDropdown(null);
    setSelectedOption(null);
  };

  const filteredAdvisories = useMemo(() => {
    const q = advisorySearch.trim().toLowerCase();
    return VERIFIED_ADVISORIES.filter((adv) => {
      if (advisoryPriority !== 'ALL' && adv.priority !== advisoryPriority) return false;
      if (!q) return true;
      return (
        adv.id.toLowerCase().includes(q) ||
        adv.title.toLowerCase().includes(q) ||
        adv.summary.toLowerCase().includes(q) ||
        adv.sector.toLowerCase().includes(q)
      );
    });
  }, [advisorySearch, advisoryPriority]);

  const activeSafetyItem = useMemo(
    () => CYBER_SAFETY_CATEGORIES.find((c) => c.id === activeSafetyCat) || CYBER_SAFETY_CATEGORIES[0],
    [activeSafetyCat]
  );

  const activeColumn = useMemo(
    () => (openDropdown ? PORTAL_COLUMNS.find((c) => c.id === openDropdown) || null : null),
    [openDropdown]
  );

  const activeMeta = useMemo(() => {
    if (!selectedOption) return null;
    for (const col of PORTAL_COLUMNS) {
      const found = col.options.find((o) => o.id === selectedOption);
      if (found) return { column: col, option: found };
    }
    return null;
  }, [selectedOption]);

  const tooltipStyle = {
    backgroundColor: '#0E172A',
    borderColor: '#243656',
    color: '#F4F5F7',
    fontSize: '12px',
    borderRadius: '6px',
  };

  return (
    <div ref={toolbarRef} className="relative z-30">
      {/* Compact Single-Row Toolbar */}
      <div className="h-11 px-3 sm:px-4 bg-[#101A30] dark:bg-[#0B1222] border border-[#1E2E4D] dark:border-[#243656] rounded flex items-center justify-between gap-2 sm:gap-3 text-xs shadow-sm">
        {/* Left: Compass icon + 'PORTAL SERVICES:' */}
        <div className="flex items-center gap-2 shrink-0">
          <Compass className="w-4 h-4 text-[#C5A66A]" />
          <span className="font-mono font-bold tracking-wider text-xs text-[#C5A66A] whitespace-nowrap">
            PORTAL SERVICES:
          </span>
        </div>

        {/* 3 Side-by-Side Dropdown Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {(['report', 'learning', 'volunteer'] as const).map((colId) => {
            const config = CATEGORY_CONFIG[colId];
            const Icon = config.icon;
            const isOpen = openDropdown === colId;
            return (
              <button
                key={colId}
                type="button"
                aria-expanded={isOpen}
                onClick={() => handleToggleDropdown(colId)}
                className={`h-8 px-2.5 sm:px-3 rounded text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-all border ${
                  isOpen
                    ? `bg-[#17243B] dark:bg-[#17243B] text-white ${config.activeBorder} shadow-sm`
                    : 'bg-[#131F35] dark:bg-[#101A30] hover:bg-[#17243B] dark:hover:bg-[#131F35] text-[#E2E8F0] border-[#243656] hover:border-[#3B527A]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${config.iconColor} shrink-0`} />
                <span className="truncate">{config.label}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#8993A5] transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-[#C5A66A]' : ''
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Right side quick access helpline badges */}
        <div className="hidden lg:flex items-center gap-2 shrink-0 text-[11px]">
          <a
            href="tel:1930"
            className="h-7 px-2.5 rounded bg-red-600 hover:bg-red-700 text-white font-mono font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors"
            title="National Cyber Crime Helpline 1930"
          >
            <Phone className="w-3 h-3" />
            <span>1930</span>
          </a>
          <a
            href="tel:112"
            className="h-7 px-2.5 rounded bg-[#17243B] hover:bg-[#223454] border border-[#2E4368] text-[#F4F5F7] font-mono font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors"
            title="National Emergency Police 112"
          >
            <Phone className="w-3 h-3 text-[#C5A66A]" />
            <span>112</span>
          </a>
          <a
            href={OFFICIAL_NCRP_HOME.url}
            target="_blank"
            rel="noopener noreferrer"
            className="h-7 px-2.5 rounded bg-[#C5A66A] hover:bg-[#d3b67c] text-[#101A30] font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors"
          >
            <span>cybercrime.gov.in</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Dark Floating Dropdown */}
      {openDropdown && activeColumn && (
        <div
          role="dialog"
          aria-modal="true"
          className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#101A30] text-[#F4F5F7] border border-[#2E4368] rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-md"
        >
          {/* VIEW A: Sub-options Grid when no specific option is selected */}
          {!selectedOption && (
            <div className="p-4 sm:p-5 space-y-3.5">
              {/* Category Header Strip */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#243656]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-7 h-7 rounded bg-[#17243B] border border-[#2E4368] flex items-center justify-center shrink-0">
                    {(() => {
                      const Icon = CATEGORY_CONFIG[activeColumn.id].icon;
                      return <Icon className={`w-4 h-4 ${CATEGORY_CONFIG[activeColumn.id].iconColor}`} />;
                    })()}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold font-mono tracking-wider text-[#C5A66A] truncate uppercase">
                      {activeColumn.heading}
                    </h3>
                    <p className="text-[11px] text-[#8993A5] truncate">
                      {activeColumn.subtitle}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close dropdown"
                  className="h-7 w-7 rounded border border-[#243656] bg-[#17243B] text-[#8993A5] hover:text-white hover:border-[#3B527A] flex items-center justify-center shrink-0 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Emergency Banner inside Report Cyber Crime */}
              {activeColumn.id === 'report' && (
                <div className="p-3 rounded-lg border border-red-900/60 bg-red-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="font-semibold text-red-300">
                      24×7 Financial Cyber Fraud:
                    </span>
                    <span className="text-[11px] text-[#CBD5E1]">
                      Call immediately for CFCFRMS bank lien holds.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href="tel:1930"
                      className="px-2.5 py-1 rounded bg-red-600 font-mono font-bold text-white hover:bg-red-700 transition-colors"
                    >
                      Call 1930
                    </a>
                    <a
                      href="tel:112"
                      className="px-2.5 py-1 rounded bg-[#17243B] border border-[#2E4368] font-mono font-bold text-white hover:border-[#C5A66A] transition-colors"
                    >
                      Police 112
                    </a>
                  </div>
                </div>
              )}

              {/* Grid of Sub-Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeColumn.options.map((opt) => {
                  const Icon = OPTION_ICONS[opt.id];
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectOption(opt.id)}
                      className="w-full text-left p-3 rounded-lg bg-[#17243B] hover:bg-[#1E2E4D] border border-[#243656] hover:border-[#C5A66A]/70 transition-all group flex items-start justify-between gap-3 shadow-sm"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="w-8 h-8 rounded bg-[#101A30] border border-[#243656] text-[#C5A66A] flex items-center justify-center shrink-0 mt-0.5 group-hover:border-[#C5A66A]/50 transition-colors">
                          <Icon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-white group-hover:text-[#C5A66A] transition-colors">
                              {opt.title}
                            </span>
                            {opt.badgeText && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-950/60 text-red-300 border border-red-800/60">
                                {opt.badgeText}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#8993A5] group-hover:text-[#CBD5E1] mt-0.5 leading-snug line-clamp-2 transition-colors">
                            {opt.shortDesc}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#64748B] group-hover:text-[#C5A66A] shrink-0 mt-2 transition-colors" />
                    </button>
                  );
                })}
              </div>

              {/* Volunteer Attribution Banner inside Cyber Volunteers */}
              {activeColumn.id === 'volunteer' && (
                <div className="p-2.5 rounded-lg border border-[#243656] bg-[#131F35] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#8993A5]">
                  <span>
                    <strong className="text-white">Official I4C Initiative (MHA):</strong> 3 official roles — Unlawful Content Flagger, Awareness Promoter, and Cyber Expert.
                  </span>
                  <a
                    href="https://cybercrime.gov.in/Webform/VLT_Terms.aspx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-[#C5A66A] hover:underline whitespace-nowrap shrink-0"
                  >
                    Volunteer Portal <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* VIEW B: Detail View when a sub-option is selected */}
          {selectedOption && (
            <div className="flex flex-col">
              {/* Detail View Header */}
              <div className="px-5 py-3 border-b border-[#243656] bg-[#131F35] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={handleBackToOptions}
                    className="h-7 px-2.5 rounded border border-[#2E4368] bg-[#17243B] text-xs font-medium text-[#E2E8F0] hover:text-white hover:border-[#C5A66A] inline-flex items-center gap-1.5 shrink-0 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-[#C5A66A] tracking-wider uppercase">
                      {activeMeta?.column.heading}
                    </p>
                    <h3 className="text-sm font-semibold text-white truncate">
                      {activeMeta?.option.title}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close detail panel"
                  className="h-7 px-2.5 rounded border border-[#2E4368] bg-[#17243B] text-xs font-medium text-[#8993A5] hover:text-white hover:border-[#3B527A] inline-flex items-center gap-1 shrink-0 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Close</span>
                </button>
              </div>

              {/* Scrollable Detail Body */}
              <div className="p-5 max-h-[72vh] overflow-y-auto space-y-5 text-xs text-[#CBD5E1]">
{/* ==================== 1A. REPORT A CRIME ==================== */}
                {selectedOption === 'report-crime' && (
                  <>
                    {/* Dedicated Emergency Cybercrime Reporting Experience (All 6 Prioritized Actions) */}
                    <div className="p-4 rounded border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-[#DC2626] dark:text-[#F87171] flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          Urgent &amp; Emergency Cybercrime Reporting Pathways
                        </p>
                        <span className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8]">
                          Official Govt. of India Channels
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 rounded bg-white dark:bg-[#101A30] border border-red-200 dark:border-red-900/50 space-y-1.5">
                          <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                            1. Financial Cyber Fraud (Immediate)
                          </p>
                          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                            Call the toll-free National Cyber Crime Helpline immediately to initiate real-time bank/wallet lien holds under CFCFRMS, then submit details online.
                          </p>
                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            <a
                              href="tel:1930"
                              className="font-mono font-bold text-sm text-[#DC2626] dark:text-[#F87171] hover:underline inline-flex items-center gap-1"
                            >
                              <Phone className="w-3.5 h-3.5" /> Call 1930
                            </a>
                            <a
                              href="https://cybercrime.gov.in/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline inline-flex items-center gap-1"
                            >
                              cybercrime.gov.in <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        <div className="p-3 rounded bg-white dark:bg-[#101A30] border border-[#E2E7EF] dark:border-[#243656] space-y-1.5">
                          <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                            2. Other Cybercrime Offences
                          </p>
                          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                            File phishing, hacking, identity theft, impersonation, ransomware, or cybercrimes against women and children on the official NCRP webform.
                          </p>
                          <a
                            href="https://cybercrime.gov.in/Webform/Crime_Autho.aspx"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline inline-flex items-center gap-1 pt-1"
                          >
                            Open Official Reporting Form <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>

                        <div className="p-3 rounded bg-white dark:bg-[#101A30] border border-[#E2E7EF] dark:border-[#243656] space-y-1.5">
                          <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                            3. Emergency Police Assistance
                          </p>
                          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                            For immediate physical danger, active extortion threats, stalking, or emergency local police intervention anywhere in India.
                          </p>
                          <a
                            href="tel:112"
                            className="font-mono font-bold text-sm text-[#101A30] dark:text-[#F4F5F7] hover:underline inline-flex items-center gap-1 pt-1"
                          >
                            <Phone className="w-3.5 h-3.5 text-[#DC2626]" /> Dial 112 (Emergency)
                          </a>
                        </div>

                        <div className="p-3 rounded bg-white dark:bg-[#101A30] border border-[#E2E7EF] dark:border-[#243656] space-y-1.5">
                          <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                            4. Track Existing Complaint &amp; Social Media Abuse
                          </p>
                          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                            Monitor an already filed complaint with your Acknowledgement Number or report platform impersonation and harassment.
                          </p>
                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSelectOption('track-complaint')}
                              className="font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline"
                            >
                              Track Complaint →
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectOption('social-media-abuse')}
                              className="font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline"
                            >
                              Social Media Abuse →
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Types of Cybercrime */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                        Types of Cybercrime Covered on the National Portal
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {[
                          ['Online Financial Fraud', 'UPI/IMPS/NEFT fraud, debit/credit card theft, fake loan/investment apps, KYC scams, and unauthorized wallet transfers.'],
                          ['Phishing & Social Engineering', 'Spoofed banking links, malicious .apk e-Challan/KYC downloads, SMS smishing, and fake courier/customs notices.'],
                          ['Identity Theft & Impersonation', 'Stolen Aadhaar/PAN misuse, SIM swap account takeovers, forged social profiles, and CEO/colleague email impersonation.'],
                          ['Hacking & Unauthorized Access', 'Compromised email/social accounts, website defacement, malware/ransomware infection, and unauthorized data theft.'],
                          ['Cybercrime Against Women & Children', 'CSAM/CSEAM, non-consensual intimate imagery, cyberstalking, morphing, and online harassment (priority channel).'],
                          ['Online Job, Matrimonial & Extortion Scams', 'Advance-fee job offers, sextortion video calls, digital arrest impersonation, and blackmail threats.'],
                        ].map(([title, desc]) => (
                          <div
                            key={title}
                            className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35]"
                          >
                            <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">{title}</p>
                            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1 leading-relaxed">
                              {desc}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Information Required + Evidence Preparation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] space-y-2">
                        <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          Information Required Before Reporting
                        </h4>
                        <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                          <li>Exact date and approximate time of the incident (IST).</li>
                          <li>Brief factual chronology of events (at least 200 characters recommended on NCRP).</li>
                          <li>For financial fraud: Bank/Wallet name, Account/Card/UPI ID, exact Transaction/UTR Reference Number, and amount debited.</li>
                          <li>Suspect identifiers (if known): Mobile numbers, email addresses, website URLs, social media handles, or bank account numbers.</li>
                          <li>Active Indian mobile number for OTP registration and national ID (e.g., Aadhaar/PAN/Driving License) for citizen login.</li>
                        </ul>
                      </div>

                      <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] space-y-2">
                        <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          5. Evidence Preparation Guidance
                        </h4>
                        <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                          <li>Preserve complete bank statements and SMS/email debit alerts showing UTR, timestamp, and beneficiary details.</li>
                          <li>Capture uncropped full-screen screenshots of abusive messages, fraudulent URLs, UPI handles, and caller logs.</li>
                          <li>Save original phishing emails with full headers (Show Original / .eml) rather than forwarding edited text.</li>
                          <li>Do NOT delete chats, uninstall fraudulent apps before recording package/file details, or alter file timestamps.</li>
                        </ul>
                      </div>
                    </div>

                    {/* Official Submission Steps */}
                    <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35] space-y-2.5">
                      <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                        Official Reporting Steps on cybercrime.gov.in
                      </h4>
                      <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
                        <li>Open <strong>https://cybercrime.gov.in/</strong> and click <em>File a Complaint</em>, then review and accept the portal terms.</li>
                        <li>Select <em>Citizen Login</em>, choose your State/UT, and authenticate via OTP on your registered Indian mobile number.</li>
                        <li>Select the relevant crime category (Financial Fraud, Women/Children, or Other Cybercrime), enter incident/transaction details, and attach supporting evidence PDFs/images.</li>
                        <li>Review the draft carefully, click <strong>Submit</strong>, and save the generated <strong>Acknowledgement Number</strong> for future tracking and police coordination.</li>
                      </ol>
                      <div className="pt-2 flex flex-wrap items-center gap-3">
                        <a
                          href="https://cybercrime.gov.in/Webform/Crime_Autho.aspx"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-9 px-4 rounded bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] font-medium inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                        >
                          <span>Proceed to Official Reporting Portal</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href="https://cybercrime.gov.in/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline inline-flex items-center gap-1"
                        >
                          Open cybercrime.gov.in Homepage <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-[10px] text-[#64748B] dark:text-[#8993A5]">
                        Source: National Cyber Crime Reporting Portal (I4C, MHA). If a direct form link requires session initialization, start from https://cybercrime.gov.in/. TRACE INTEL does not submit or store citizen complaints.
                      </p>
                    </div>
                  </>
                )}

                {/* ==================== 1B. TRACK YOUR COMPLAINT ==================== */}
                {selectedOption === 'track-complaint' && (
                  <>
                    <div className="p-3.5 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35] flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A] shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        <strong>Official Portal Verification Only:</strong> TRACE INTEL does not host or simulate a government complaint tracking database. Always verify live complaint status directly on the Ministry of Home Affairs portal using your official Acknowledgement Number.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] space-y-2">
                        <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          What You Need to Track Your Complaint
                        </h4>
                        <ul className="list-disc pl-4 space-y-1.5 text-[11px] leading-relaxed">
                          <li>
                            <strong>Complaint Acknowledgement / Reference Number:</strong> The unique numeric reference ID sent by SMS/email when your complaint was registered on NCRP or via Helpline 1930.
                          </li>
                          <li>
                            <strong>Registered Mobile Number:</strong> The exact Indian mobile number linked to your complaint to receive a one-time verification code (OTP).
                          </li>
                          <li>
                            <strong>CAPTCHA Verification:</strong> On-screen security code required on the official MHA status check page.
                          </li>
                        </ul>
                      </div>

                      <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] space-y-2">
                        <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          Status Information Displayed Officially
                        </h4>
                        <ul className="list-disc pl-4 space-y-1.5 text-[11px] leading-relaxed">
                          <li>Current complaint stage (Under Process, Accepted, Forwarded to Police Station, or Closed).</li>
                          <li>Assigned State/UT Cyber Police Station or investigating unit remarks.</li>
                          <li>Linked FIR / e-Zero FIR number if converted into a formal First Information Report.</li>
                          <li>For financial fraud (1930 / CFCFRMS): Bank or payment intermediary hold/lien updates where applicable.</li>
                        </ul>
                      </div>
                    </div>

                    <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35] space-y-2.5">
                      <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                        Step-by-Step Official Tracking Instructions
                      </h4>
                      <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
                        <li>Open the official Track Complaint Status facility on <strong>cybercrime.gov.in</strong>.</li>
                        <li>Enter your <strong>Acknowledgement Number</strong> and click <em>Get OTP</em>.</li>
                        <li>Enter the OTP received on your registered mobile number along with the displayed CAPTCHA, then click <strong>Submit</strong>.</li>
                        <li>You can also log into your Citizen Login dashboard on <strong>cybercrime.gov.in</strong> to download the complaint PDF or view history across multiple filings.</li>
                      </ol>
                      <div className="pt-2 flex flex-wrap items-center gap-3">
                        <a
                          href="https://cybercrime.gov.in/Webform/chkackstatus.aspx"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-9 px-4 rounded bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] font-medium inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                        >
                          <span>Track Status on cybercrime.gov.in</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href="https://cybercrime.gov.in/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline inline-flex items-center gap-1"
                        >
                          Fallback: Open Portal Homepage <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-[10px] text-[#64748B] dark:text-[#8993A5]">
                        Source: National Cyber Crime Reporting Portal (I4C, MHA) — Verified Reference.
                      </p>
                    </div>
                  </>
                )}

                {/* ==================== 1C. ANONYMOUS REPORTING ==================== */}
                {selectedOption === 'anonymous-reporting' && (
                  <>
                    <div className="p-4 rounded border border-[#C5A66A]/60 bg-[#F8F8F6] dark:bg-[#131F35] space-y-1.5">
                      <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7] flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A] shrink-0" />
                        Important Scope &amp; Eligibility Notice
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        Anonymous reporting on <strong>cybercrime.gov.in</strong> is officially provided for <strong>specified sensitive categories only</strong> — primarily Child Pornography / Child Sexual Abuse Material (CP/CSAM), Child Sexual Exploitative and Abuse Material (CSEAM), and sexually explicit / rape / gang-rape content under the <em>Report Women / Children Related Crime</em> workflow. <strong>It is NOT a universal anonymous reporting channel for financial fraud, hacking, or general cybercrime</strong>, which require registered mobile verification for statutory investigation and bank intervention.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] space-y-2">
                        <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          Eligible Categories &amp; What to Provide
                        </h4>
                        <ul className="list-disc pl-4 space-y-1.5 text-[11px] leading-relaxed">
                          <li>Online Child Sexual Abuse / Exploitative Material (CSAM / CSEAM).</li>
                          <li>Sexually explicit content, rape, or gang-rape imagery/videos hosted online.</li>
                          <li>Required incident inputs: Category of crime, approximate date/time, website URL or platform name, State/UT (if known), brief description, and optional supporting screenshots/evidence.</li>
                          <li>No complainant name, mobile number, or personal identity proof is mandatory in the anonymous women/children reporting workflow.</li>
                        </ul>
                      </div>

                      <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] space-y-2">
                        <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          Key Limitations to Understand
                        </h4>
                        <ul className="list-disc pl-4 space-y-1.5 text-[11px] leading-relaxed">
                          <li>Because personal contact details are not collected, complainants cannot receive SMS/OTP status updates or track progress via mobile verification.</li>
                          <li>Police investigators cannot contact an anonymous submitter for follow-up clarifications, bank recovery signatures, or witness statements.</li>
                          <li>If you are a victim seeking FIR registration, financial recovery, or case status tracking, use the standard <strong>Report &amp; Track</strong> citizen registration option instead.</li>
                        </ul>
                      </div>
                    </div>

                    <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35] flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          Official Anonymous Reporting Access
                        </p>
                        <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                          Navigate to <em>Report Women/Children Related Crime → Report Anonymously</em> on cybercrime.gov.in.
                        </p>
                      </div>
                      <a
                        href="https://cybercrime.gov.in/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 px-4 rounded bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] font-medium inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity shrink-0"
                      >
                        <span>Open cybercrime.gov.in</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </>
                )}

                {/* ==================== 1D. SOCIAL MEDIA ABUSE ==================== */}
                {selectedOption === 'social-media-abuse' && (
                  <>
                    <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35] space-y-2">
                      <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                        Step 1: Preserve Evidence Before Blocking or Deleting
                      </h4>
                      <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                        <li>Copy the <strong>exact URL / web link</strong> of the abusive profile, post, reel, video, or channel (not just the display name, which can be changed).</li>
                        <li>Take uncropped full-screen screenshots showing date, time, handle/username, and offending content or threats.</li>
                        <li>For WhatsApp or messaging apps, export the chat with media before reporting or blocking the sender.</li>
                        <li>Record any phone numbers, email addresses, or payment IDs shared by the perpetrator.</li>
                      </ul>
                    </div>

                    <div className="space-y-2.5">
                      <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                        Step 2: Report Directly to the Social Media Platform
                      </h4>
                      <div className="space-y-2.5">
                        {SOCIAL_PLATFORM_GUIDES.map((p) => (
                          <div
                            key={p.id}
                            className="p-3.5 rounded border border-[#E2E7EF] dark:border-[#243656] flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                          >
                            <div className="space-y-1 min-w-0">
                              <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                                {p.platform}{' '}
                                <span className="font-normal text-[#64748B] dark:text-[#8993A5]">
                                  · {p.company}
                                </span>
                              </p>
                              <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                                {p.inAppSteps}
                              </p>
                            </div>
                            <div className="flex flex-col gap-1.5 shrink-0 sm:text-right">
                              <a
                                href={p.primaryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline inline-flex sm:justify-end items-center gap-1 whitespace-nowrap"
                              >
                                {p.primaryLabel} <ExternalLink className="w-3 h-3" />
                              </a>
                              {p.secondaryUrl && p.secondaryLabel && (
                                <a
                                  href={p.secondaryUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-medium text-[#475569] dark:text-[#94A3B8] hover:text-[#17243B] dark:hover:text-[#F4F5F7] hover:underline inline-flex sm:justify-end items-center gap-1 whitespace-nowrap"
                                >
                                  {p.secondaryLabel} <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35] flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5 max-w-xl">
                        <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          Step 3: Official Law Enforcement Escalation
                        </p>
                        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                          For impersonation, stalking, morphing, extortion, or non-consensual content, file a formal cybercrime complaint on <strong>cybercrime.gov.in</strong> with preserved URLs/screenshots. Dial <strong>112</strong> immediately if there is any physical safety threat.
                        </p>
                      </div>
                      <a
                        href="https://cybercrime.gov.in/Webform/Crime_Autho.aspx"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 px-4 rounded bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] font-medium inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity shrink-0"
                      >
                        <span>Report on cybercrime.gov.in</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </>
                )}

                {/* ==================== 2A. ADVISORIES & ALERTS ==================== */}
                {selectedOption === 'advisories-alerts' && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-3.5 h-3.5 text-[#8993A5] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={advisorySearch}
                          onChange={(e) => setAdvisorySearch(e.target.value)}
                          placeholder="Filter by CIAD ID, sector, or threat keyword..."
                          aria-label="Filter verified advisories"
                          className="w-full h-9 pl-8 pr-3 text-xs bg-[#F8F8F6] dark:bg-[#101A30] border border-[#CBD2DE] dark:border-[#2A3F63] rounded text-[#17243B] dark:text-[#F4F5F7] placeholder:text-[#8993A5] focus:outline-none focus:border-[#101A30] dark:focus:border-[#C5A66A]"
                        />
                      </div>
                      <div className="inline-flex items-center p-0.5 bg-[#F5F5F2] dark:bg-[#101A30] border border-[#E2E7EF] dark:border-[#243656] rounded">
                        {(['ALL', 'Critical', 'High', 'Advisory'] as const).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setAdvisoryPriority(lvl)}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                              advisoryPriority === lvl
                                ? 'bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30]'
                                : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#17243B] dark:hover:text-white'
                            }`}
                          >
                            {lvl === 'ALL' ? 'All' : lvl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="divide-y divide-[#E2E7EF] dark:divide-[#243656] border border-[#E2E7EF] dark:border-[#243656] rounded">
                      {filteredAdvisories.length === 0 ? (
                        <p className="p-5 text-center text-[#64748B] dark:text-[#8993A5]">
                          No verified advisories match your current filter.
                        </p>
                      ) : (
                        filteredAdvisories.map((adv) => (
                          <article key={adv.id} className="p-4 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                              <div className="flex flex-wrap items-center gap-2 font-mono">
                                <span className="font-semibold text-[#101A30] dark:text-[#C5A66A]">
                                  {adv.id}
                                </span>
                                <span aria-hidden="true" className="text-[#8993A5]">·</span>
                                <span
                                  className={`font-sans font-semibold ${
                                    adv.priority === 'Critical'
                                      ? 'text-[#DC2626] dark:text-[#F87171]'
                                      : adv.priority === 'High'
                                      ? 'text-[#EA580C] dark:text-[#FB923C]'
                                      : 'text-[#2563EB] dark:text-[#60A5FA]'
                                  }`}
                                >
                                  {adv.priority}
                                </span>
                                <span aria-hidden="true" className="text-[#8993A5]">·</span>
                                <span className="font-sans text-[#64748B] dark:text-[#8993A5]">
                                  {adv.sector}
                                </span>
                              </div>
                              <span className="font-mono tabular-nums text-[#64748B] dark:text-[#8993A5]">
                                Published: {adv.publishedDate}
                              </span>
                            </div>
                            <h4 className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7] leading-snug">
                              {adv.title}
                            </h4>
                            <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                              {adv.summary}
                            </p>
                            <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                              <span className="text-[#64748B] dark:text-[#8993A5]">
                                Source: {adv.sourceOrg}
                              </span>
                              <a
                                href={adv.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline inline-flex items-center gap-1"
                              >
                                Read More on CERT-In <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </article>
                        ))
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748B] dark:text-[#8993A5]">
                      <span>
                        Official advisory circulars and IoCs are maintained by CERT-In &amp; Cyber Swachhta Kendra.
                      </span>
                      <div className="flex items-center gap-3">
                        <a
                          href="https://www.cert-in.org.in/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline inline-flex items-center gap-1"
                        >
                          cert-in.org.in <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href="https://www.csk.gov.in/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline inline-flex items-center gap-1"
                        >
                          csk.gov.in <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </>
                )}

                {/* ==================== 2B. CYBER SAFETY TIPS ==================== */}
                {selectedOption === 'cyber-safety-tips' && (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {CYBER_SAFETY_CATEGORIES.map((cat) => {
                        const active = cat.id === activeSafetyItem.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActiveSafetyCat(cat.id)}
                            className={`px-3 py-1.5 rounded text-[11px] font-medium border transition-colors whitespace-nowrap ${
                              active
                                ? 'bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] border-[#101A30] dark:border-[#C5A66A]'
                                : 'bg-[#F8F8F6] dark:bg-[#131F35] text-[#334155] dark:text-[#CBD5E1] border-[#E2E7EF] dark:border-[#243656] hover:border-[#94A3B8]'
                            }`}
                          >
                            {cat.title}
                          </button>
                        );
                      })}
                    </div>

                    <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35] space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          {activeSafetyItem.title}
                        </h4>
                        <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] mt-0.5">
                          {activeSafetyItem.summary}
                        </p>
                      </div>
                      <ul className="space-y-2.5">
                        {activeSafetyItem.tips.map((tip, idx) => (
                          <li
                            key={idx}
                            className="p-3 rounded bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] flex items-start gap-2.5 text-xs leading-relaxed"
                          >
                            <CheckCircle2 className="w-4 h-4 text-[#16A34A] dark:text-[#4ADE80] shrink-0 mt-0.5" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748B] dark:text-[#8993A5] pt-1">
                      <span>Official awareness references:</span>
                      <div className="flex flex-wrap items-center gap-3">
                        <a
                          href="https://cybercrime.gov.in/Webform/CyberSafetyTips.aspx"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline inline-flex items-center gap-1"
                        >
                          NCRP Cyber Safety Tips <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href="https://www.csk.gov.in/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline inline-flex items-center gap-1"
                        >
                          Cyber Swachhta Kendra <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href="https://sancharsaathi.gov.in/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline inline-flex items-center gap-1"
                        >
                          Sanchar Saathi <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </>
                )}

                {/* ==================== 2C. DAILY THREAT DIGITS ==================== */}
                {selectedOption === 'daily-threat-digits' && (
                  <>
                    <div className="p-3.5 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35] flex items-start gap-2.5 text-[11px]">
                      <Info className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A] shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        <strong>Verified Historical Government Data Notice:</strong> Because no public real-time government cybercrime ticker API is available, TRACE INTEL never fabricates live daily counts. All figures below reflect dated, officially published <strong>NCRB "Crime in India"</strong> and <strong>MHA / PIB (I4C / CFCFRMS)</strong> disclosures.
                      </p>
                    </div>

                    {/* Verified MHA / I4C & NCRB KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded border border-[#E2E7EF] dark:border-[#243656] bg-white dark:bg-[#101A30]">
                        <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                          NCRB Registered Cybercrimes (2023)
                        </p>
                        <p className="text-xl font-mono font-bold tabular-nums text-[#101A30] dark:text-[#F4F5F7] mt-1">
                          86,128
                        </p>
                        <p className="text-[10px] text-[#EA580C] dark:text-[#FB923C] mt-0.5">
                          +30.7% vs 2022 (65,893) · Historical
                        </p>
                      </div>
                      <div className="p-3.5 rounded border border-[#E2E7EF] dark:border-[#243656] bg-white dark:bg-[#101A30]">
                        <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                          CFCFRMS / 1930 Amount Saved
                        </p>
                        <p className="text-xl font-mono font-bold tabular-nums text-[#16A34A] dark:text-[#4ADE80] mt-1">
                          ₹11,158+ Cr
                        </p>
                        <p className="text-[10px] text-[#64748B] dark:text-[#8993A5] mt-0.5">
                          MHA / PIB Cumulative Update (Mid-2026)
                        </p>
                      </div>
                      <div className="p-3.5 rounded border border-[#E2E7EF] dark:border-[#243656] bg-white dark:bg-[#101A30]">
                        <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                          Financial Fraud Complaints Handled
                        </p>
                        <p className="text-xl font-mono font-bold tabular-nums text-[#2563EB] dark:text-[#60A5FA] mt-1">
                          32.80+ Lakh
                        </p>
                        <p className="text-[10px] text-[#64748B] dark:text-[#8993A5] mt-0.5">
                          MHA / PIB CFCFRMS Disclosure (Mid-2026)
                        </p>
                      </div>
                    </div>

                    {/* Verified Historical NCRB Trend Chart */}
                    <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656]">
                      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                        <div>
                          <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                            Verified Annual Registered Cybercrime Trend in India (2021–2023)
                          </h4>
                          <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                            Source: National Crime Records Bureau (NCRB), Crime in India Reports (Historical Published Series)
                          </p>
                        </div>
                        <span className="font-mono text-[10px] text-[#A88748] dark:text-[#C5A66A]">
                          Official Historical Series
                        </span>
                      </div>
                      <div className="h-[210px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={NCRB_VERIFIED_STATS} margin={{ top: 8, right: 16, left: 6, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                            <XAxis dataKey="year" tick={{ fontSize: 11, fill: chartTheme.axisTick }} />
                            <YAxis tick={{ fontSize: 11, fill: chartTheme.axisTick }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar
                              dataKey="cases"
                              name="Registered Cases (NCRB)"
                              fill={chartTheme.incoming}
                              radius={[4, 4, 0, 0]}
                              maxBarSize={68}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-[#E2E7EF] dark:border-[#243656] text-[11px]">
                        {NCRB_VERIFIED_STATS.map((row) => (
                          <div key={row.year} className="font-mono tabular-nums">
                            <span className="text-[#64748B] dark:text-[#8993A5]">{row.year}: </span>
                            <strong className="text-[#17243B] dark:text-[#F4F5F7]">
                              {row.cases.toLocaleString()}
                            </strong>{' '}
                            <span className="font-sans text-[10px] text-[#64748B] dark:text-[#8993A5]">
                              ({row.yoyLabel})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Primary Reported Threat Categories */}
                    <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35] space-y-2">
                      <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                        Major Threat Categories Documented by NCRB, I4C &amp; CERT-In
                      </h4>
                      <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                        <li><strong>Online Financial &amp; UPI Fraud:</strong> Primary volume driver on Helpline 1930 / CFCFRMS, including investment scams, mule accounts, and fraudulent payment APIs.</li>
                        <li><strong>Identity Theft &amp; Impersonation:</strong> Account takeovers (WhatsApp/M365), SIM swaps, and fake government/police impersonation calls.</li>
                        <li><strong>Malicious APK &amp; Phishing Campaigns:</strong> Fraudulent RTO e-Challan, bank KYC, and utility-disconnection links targeting Android devices.</li>
                        <li><strong>Cyber Exploitation &amp; Online Harassment:</strong> Extortion, morphed media, and crimes against women and children prioritized on NCRP.</li>
                      </ul>
                      <div className="pt-1 flex flex-wrap gap-3 text-[11px]">
                        <a
                          href="https://www.ncrb.gov.in/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline inline-flex items-center gap-1"
                        >
                          NCRB Official Reports <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href="https://i4c.mha.gov.in/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline inline-flex items-center gap-1"
                        >
                          I4C MHA Portal <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </>
                )}

                {/* ==================== 2D. RTI & STATISTICS NOTES ==================== */}
                {selectedOption === 'rti-statistics' && (
                  <>
                    <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                      Organized directory of official Government of India Right to Information (RTI) portals, publicly released cybercrime statistics, and authoritative reference publications. Each item cites its issuing authority and verification date.
                    </p>
                    <div className="divide-y divide-[#E2E7EF] dark:divide-[#243656] border border-[#E2E7EF] dark:border-[#243656] rounded">
                      {RTI_AND_PUBLIC_DOCUMENTS.map((doc) => (
                        <div key={doc.id} className="p-4 space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <span className="font-semibold text-[#A88748] dark:text-[#C5A66A]">
                              {doc.category}
                            </span>
                            <span className="font-mono text-[#64748B] dark:text-[#8993A5]">
                              {doc.datedReference}
                            </span>
                          </div>
                          <h4 className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                            {doc.title}
                          </h4>
                          <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                            {doc.description}
                          </p>
                          <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <span className="text-[#64748B] dark:text-[#8993A5]">
                              Source: {doc.source}
                            </span>
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline inline-flex items-center gap-1"
                            >
                              Open {doc.domain} <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ==================== 3A. CYBER VOLUNTEER — PROGRAM OVERVIEW ==================== */}
                {selectedOption === 'volunteer-overview' && (
                  <>
                    {/* Clear Separation: Official Govt Program Information vs TRACE INTEL Summary */}
                    <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35] space-y-2">
                      <p className="text-[10px] font-mono font-semibold text-[#A88748] dark:text-[#C5A66A] tracking-wide">
                        OFFICIAL GOVERNMENT PROGRAM INFORMATION · I4C, MINISTRY OF HOME AFFAIRS (MHA)
                      </p>
                      <h4 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                        Cyber Crime Volunteer Program
                      </h4>
                      <p className="text-[11px] leading-relaxed">
                        Conceived by the <strong>Indian Cyber Crime Coordination Centre (I4C)</strong> under the Ministry of Home Affairs, Government of India, the Cyber Crime Volunteer Program brings together Indian citizens who wish to contribute toward a clean, safe, and law-abiding cyberspace in coordination with State/UT Law Enforcement Agencies.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                        Official Volunteer Categories &amp; Roles
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                          [
                            '1. Unlawful Content Flagger',
                            'Identifies and reports unlawful online content via the official NCRP portal to assist law enforcement in lawful takedown/review.',
                          ],
                          [
                            '2. Cyber Awareness Promoter',
                            'Supports cyber hygiene education and fraud-prevention outreach across schools, colleges, and community groups.',
                          ],
                          [
                            '3. Cyber Expert',
                            'Domain specialists offering technical assistance and advisory insights on cybercrime challenges to designated authorities.',
                          ],
                        ].map(([roleTitle, roleDesc]) => (
                          <div
                            key={roleTitle}
                            className="p-3.5 rounded border border-[#E2E7EF] dark:border-[#243656]"
                          >
                            <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">{roleTitle}</p>
                            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1 leading-relaxed">
                              {roleDesc}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] space-y-2">
                        <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          Official Unlawful Content Scope (I4C Concept Note)
                        </h4>
                        <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                          <li>Content against the sovereignty and integrity of India.</li>
                          <li>Content against the defence of India or security of the State.</li>
                          <li>Content affecting friendly relations with foreign States.</li>
                          <li>Content aimed at disturbing public order or communal harmony.</li>
                          <li>Child Sexual Abuse Material (CSAM) and unlawful women/children abuse content.</li>
                        </ul>
                      </div>

                      <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] space-y-2">
                        <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          Eligibility, Verification &amp; Participation Guidelines
                        </h4>
                        <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                          <li><strong>Eligibility:</strong> Any Indian citizen with a valid Indian mobile number and government identity/address proof.</li>
                          <li><strong>Verification:</strong> Awareness Promoters and Cyber Experts undergo KYC/background verification by designated State/UT Nodal Authorities.</li>
                          <li><strong>Conduct &amp; Confidentiality:</strong> Volunteers must strictly uphold confidentiality, never claim police/law-enforcement authority, and act within constitutional boundaries (Article 19).</li>
                        </ul>
                      </div>
                    </div>

                    {/* Explicit TRACE INTEL Explanatory Note */}
                    <div className="p-3.5 rounded border border-[#E2E7EF] dark:border-[#243656] bg-white dark:bg-[#101A30] flex flex-wrap items-center justify-between gap-3 text-[11px]">
                      <div className="max-w-xl">
                        <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          TRACE INTEL Explanatory Note
                        </p>
                        <p className="text-[#64748B] dark:text-[#8993A5] mt-0.5 leading-relaxed">
                          This summary is provided by TRACE INTEL for officer and citizen reference only. TRACE INTEL is not affiliated with I4C/MHA and does not administer volunteer vetting or approvals.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectOption('volunteer-register')}
                        className="h-8 px-3.5 rounded bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] font-medium hover:opacity-90 transition-opacity shrink-0"
                      >
                        View Registration Guide →
                      </button>
                    </div>
                  </>
                )}

                {/* ==================== 3B. CYBER VOLUNTEER — REGISTER AS VOLUNTEER ==================== */}
                {selectedOption === 'volunteer-register' && (
                  <>
                    <div className="p-3.5 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35] flex items-start gap-2.5 text-[11px]">
                      <Info className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A] shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        <strong>Official Registration Notice:</strong> TRACE INTEL does not collect volunteer applications, issue government credentials, or approve participants. Complete registration directly on the official Ministry of Home Affairs portal (<strong>cybercrime.gov.in</strong>).
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] space-y-2">
                        <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          Eligibility &amp; Officially Listed Requirements
                        </h4>
                        <ul className="list-disc pl-4 space-y-1.5 text-[11px] leading-relaxed">
                          <li>Must be an Indian citizen residing in a State/UT of India.</li>
                          <li>Active Indian mobile number for OTP-based Login ID creation.</li>
                          <li>Passport-size photograph and updated resume/CV (as required by selected category).</li>
                          <li>Valid Government Identity &amp; Address Proof (Aadhaar Card, PAN Card, Voter ID, or Passport).</li>
                          <li>Agreement to official MHA Cyber Volunteer terms, confidentiality, and code of conduct.</li>
                        </ul>
                      </div>

                      <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] space-y-2">
                        <h4 className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          Official Registration Process
                        </h4>
                        <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
                          <li>Visit the official Cyber Volunteer Terms &amp; Registration page on <strong>cybercrime.gov.in</strong>.</li>
                          <li>Read and accept the official Terms &amp; Conditions.</li>
                          <li>Create a Login ID using your State/UT and mobile OTP verification.</li>
                          <li>Complete personal profile steps, upload required ID/address documents &amp; resume, and select your preferred volunteer category.</li>
                          <li>Submit for State/UT Nodal Authority review (where applicable for Awareness Promoter / Cyber Expert roles).</li>
                        </ol>
                      </div>
                    </div>

                    <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35] flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                          Official Government Volunteer Registration Portal
                        </p>
                        <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                          Direct link to NCRP Cyber Volunteer enrollment (I4C, Ministry of Home Affairs).
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <a
                          href="https://cybercrime.gov.in/Webform/VLT_Terms.aspx"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-9 px-4 rounded bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] font-medium inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                        >
                          <span>Register on cybercrime.gov.in</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href="https://cybercrime.gov.in/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-[#2563EB] dark:text-[#C5A66A] hover:underline inline-flex items-center gap-1"
                        >
                          Portal Homepage <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
