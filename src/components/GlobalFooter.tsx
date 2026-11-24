import React, { useState } from 'react';
import {
  ExternalLink,
  Phone,
  Shield,
  Globe,
  Landmark,
  AlertCircle,
  Lock,
  Smartphone,
  ShieldCheck,
  Building2,
  X,
} from 'lucide-react';
import { BrandMark } from './BrandMark';
import { usePreferences } from '../lib/preferences';
import { TranslationKey } from '../lib/i18n';

interface OfficialResource {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  url: string;
  domain: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface HelplineEntry {
  id: string;
  numbers: Array<{ display: string; tel: string }>;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  priority?: boolean;
  accent: 'red' | 'orange' | 'blue' | 'teal' | 'gold';
}

const INDIA_GOV_RESOURCES: OfficialResource[] = [
  {
    id: 'cybercrime',
    nameKey: 'footer.res.cybercrime.name',
    descKey: 'footer.res.cybercrime.desc',
    url: 'https://cybercrime.gov.in/',
    domain: 'cybercrime.gov.in',
    icon: Shield,
  },
  {
    id: 'cyberpolice',
    nameKey: 'footer.res.cyberpolice.name',
    descKey: 'footer.res.cyberpolice.desc',
    url: 'https://cyberpolice.nic.in/',
    domain: 'cyberpolice.nic.in',
    icon: Lock,
  },
  {
    id: 'i4c',
    nameKey: 'footer.res.i4c.name',
    descKey: 'footer.res.i4c.desc',
    url: 'https://i4c.mha.gov.in/',
    domain: 'i4c.mha.gov.in',
    icon: ShieldCheck,
  },
  {
    id: 'certin',
    nameKey: 'footer.res.certin.name',
    descKey: 'footer.res.certin.desc',
    url: 'https://www.cert-in.org.in/',
    domain: 'www.cert-in.org.in',
    icon: AlertCircle,
  },
  {
    id: 'csk',
    nameKey: 'footer.res.csk.name',
    descKey: 'footer.res.csk.desc',
    url: 'https://www.csk.gov.in/',
    domain: 'www.csk.gov.in',
    icon: Globe,
  },
  {
    id: 'sanchar',
    nameKey: 'footer.res.sanchar.name',
    descKey: 'footer.res.sanchar.desc',
    url: 'https://sancharsaathi.gov.in/',
    domain: 'sancharsaathi.gov.in',
    icon: Smartphone,
  },
  {
    id: 'mha',
    nameKey: 'footer.res.mha.name',
    descKey: 'footer.res.mha.desc',
    url: 'https://www.mha.gov.in/',
    domain: 'www.mha.gov.in',
    icon: Landmark,
  },
];

const RAJASTHAN_RESOURCES: OfficialResource[] = [
  {
    id: 'rajpolice',
    nameKey: 'footer.res.rajpolice.name',
    descKey: 'footer.res.rajpolice.desc',
    url: 'https://police.rajasthan.gov.in/',
    domain: 'police.rajasthan.gov.in',
    icon: Building2,
  },
  {
    id: 'rajcitizen',
    nameKey: 'footer.res.rajcitizen.name',
    descKey: 'footer.res.rajcitizen.desc',
    url: 'https://police.rajasthan.gov.in/portal/CitizenServicesNew',
    domain: 'police.rajasthan.gov.in',
    icon: ShieldCheck,
  },
  {
    id: 'rajcyber',
    nameKey: 'footer.res.rajcyber.name',
    descKey: 'footer.res.rajcyber.desc',
    url: 'https://police.rajasthan.gov.in/old/Investigation_Home.aspx',
    domain: 'police.rajasthan.gov.in',
    icon: Shield,
  },
];

const HELPLINES: HelplineEntry[] = [
  {
    id: '1930',
    numbers: [{ display: '1930', tel: '1930' }],
    titleKey: 'footer.help.1930.title',
    descKey: 'footer.help.1930.desc',
    priority: true,
    accent: 'red',
  },
  {
    id: '112',
    numbers: [{ display: '112', tel: '112' }],
    titleKey: 'footer.help.112.title',
    descKey: 'footer.help.112.desc',
    priority: true,
    accent: 'orange',
  },
  {
    id: '1090',
    numbers: [{ display: '1090', tel: '1090' }],
    titleKey: 'footer.help.1090.title',
    descKey: 'footer.help.1090.desc',
    accent: 'gold',
  },
  {
    id: '1098',
    numbers: [{ display: '1098', tel: '1098' }],
    titleKey: 'footer.help.1098.title',
    descKey: 'footer.help.1098.desc',
    accent: 'blue',
  },
  {
    id: '181',
    numbers: [{ display: '181', tel: '181' }],
    titleKey: 'footer.help.181.title',
    descKey: 'footer.help.181.desc',
    accent: 'teal',
  },
  {
    id: '1095',
    numbers: [{ display: '1095', tel: '1095' }],
    titleKey: 'footer.help.1095.title',
    descKey: 'footer.help.1095.desc',
    accent: 'blue',
  },
  {
    id: '101',
    numbers: [{ display: '101', tel: '101' }],
    titleKey: 'footer.help.101.title',
    descKey: 'footer.help.101.desc',
    accent: 'orange',
  },
  {
    id: '102-108',
    numbers: [
      { display: '102', tel: '102' },
      { display: '108', tel: '108' },
    ],
    titleKey: 'footer.help.102108.title',
    descKey: 'footer.help.102108.desc',
    accent: 'teal',
  },
];

type LegalDoc = 'privacy' | 'terms' | 'security' | null;

export const GlobalFooter: React.FC = () => {
  const { t, theme, language } = usePreferences();
  const [legalModal, setLegalModal] = useState<LegalDoc>(null);

  const legalContent: Record<Exclude<LegalDoc, null>, { title: string; body: string[] }> = {
    privacy: {
      title: t('footer.privacyPolicy'),
      body:
        language === 'hi'
          ? [
              'TRACE INTEL केवल अधिकृत विश्लेषण एवं प्रदर्शन डेटासेट के लिए निर्मित है। वास्तविक नागरिकों या लाइव टेलीकॉम सब्सक्राइबर का अनधिकृत व्यक्तिगत डेटा अपलोड नहीं किया जाना चाहिए।',
              'थीम (लाइट/डार्क) और भाषा (अंग्रेज़ी/हिंदी) प्राथमिकताएँ केवल आपके ब्राउज़र के localStorage में सहेजी जाती हैं। किसी बाहरी ट्रैकिंग सेवा के साथ डेटा साझा नहीं किया जाता है।',
            ]
          : [
              'TRACE INTEL includes built-in synthetic demonstration datasets for evaluation alongside case-scoped imported files. Do not upload unauthorized personal subscriber records.',
              'Interface preferences (Light/Dark theme and English/Hindi language) are persisted locally in your browser via localStorage. No personal analytics telemetry is transmitted to third-party trackers.',
            ],
    },
    terms: {
      title: t('footer.termsOfUse'),
      body:
        language === 'hi'
          ? [
              'TRACE INTEL एक स्वतंत्र विश्लेषणात्मक प्लेटफ़ॉर्म है और यह भारत सरकार या राजस्थान पुलिस का आधिकारिक पोर्टल नहीं है।',
              'विश्लेषणात्मक सारांश, नेटवर्क सहसंबंध और AI जांच सहायक निष्कर्ष केवल सहायता हेतु हैं; किसी भी औपचारिक उपयोग से पहले अधिकृत जांच अधिकारी द्वारा मूल ऑपरेटर रिकॉर्ड से सत्यापन अनिवार्य है।',
            ]
          : [
              'TRACE INTEL is an independent analytical platform. It is not an official Government of India or Rajasthan Police portal and carries no official government affiliation.',
              'Analytical summaries, graph correlations, and AI Investigation Assistant outputs are assistive indicators only and must be independently verified by an authorized officer against certified operator records.',
            ],
    },
    security: {
      title: t('footer.securityDisclaimer'),
      body:
        language === 'hi'
          ? [
              'सभी केस एक्सेस, भूमिका-आधारित अनुमतियाँ (RBAC), डेटा इम्पोर्ट और AI प्रश्न सर्वर-साइड सत्र टोकन द्वारा नियंत्रित किए जाते हैं और ऑडिट लॉग में दर्ज होते हैं।',
              'फुटर में दिए गए सभी सरकारी पोर्टल लिंक सुरक्षित रूप से नए ब्राउज़र टैब (noopener noreferrer) में खुलते हैं और कभी भी iframe में एम्बेड नहीं किए जाते।',
            ]
          : [
              'Case access, role-based access control (RBAC), CSV/XLSX normalization, and grounded AI queries are enforced server-side with bearer tokens and logged to the audit feed.',
              'All external Government of India and Rajasthan Police reference portals open strictly in a new tab with rel="noopener noreferrer" and are never embedded inside iframes.',
            ],
    },
  };

  return (
    <footer
      aria-label={t('footer.heading')}
      className="mt-8 border-t border-[#E2E7EF] dark:border-[#243656] bg-white dark:bg-[#131F35] text-[#17243B] dark:text-[#F4F5F7] transition-colors"
    >
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6 space-y-6">
        {/* Top Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 pb-4 border-b border-[#E2E7EF] dark:border-[#243656]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A88748] dark:text-[#C5A66A]">
              {t('footer.officialSourceIndia')} · {t('footer.officialSourceRaj')}
            </p>
            <h2 className="text-lg font-semibold text-[#17243B] dark:text-[#F4F5F7] mt-0.5">
              {t('footer.heading')}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#8993A5] mt-1">
              {t('footer.subheading')}
            </p>
          </div>
          <div className="text-[11px] font-mono text-[#64748B] dark:text-[#8993A5] shrink-0">
            {t('footer.lastVerifiedLabel')}: <span className="text-[#17243B] dark:text-[#F4F5F7]">2026-11-21</span>
          </div>
        </div>

        {/* SECTION A & B: Official Portals */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* SECTION A — INDIA GOVERNMENT CYBER RESOURCES */}
          <div className="xl:col-span-8 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-[#17243B] dark:text-[#F4F5F7] flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#2563EB] dark:text-[#3B82F6]" />
                {t('footer.secIndiaTitle')}
              </h3>
              <span className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                {t('footer.openExternal')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {INDIA_GOV_RESOURCES.map((res) => {
                const Icon = res.icon;
                return (
                  <a
                    key={res.id}
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-3.5 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F5F7FA] dark:bg-[#17243B] hover:border-[#2563EB] dark:hover:border-[#C5A66A] transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <Icon className="w-4 h-4 text-[#2563EB] dark:text-[#3B82F6] shrink-0 mt-0.5" />
                          <span className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7] group-hover:text-[#2563EB] dark:group-hover:text-[#C5A66A] leading-snug transition-colors">
                            {t(res.nameKey)}
                          </span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-[#8993A5] group-hover:text-[#2563EB] dark:group-hover:text-[#C5A66A] shrink-0 mt-0.5 transition-colors" />
                      </div>
                      <p className="text-[11px] text-[#64748B] dark:text-[#9AA6BA] leading-relaxed">
                        {t(res.descKey)}
                      </p>
                    </div>
                    <div className="pt-1.5 border-t border-[#E2E7EF]/80 dark:border-[#243656] flex items-center justify-between gap-2 text-[10px]">
                      <span className="font-mono text-[#A88748] dark:text-[#C5A66A] truncate">
                        {res.domain}
                      </span>
                      <span className="text-[#64748B] dark:text-[#8993A5] shrink-0">
                        {t('footer.officialSourceIndia')}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>

          {/* SECTION B — RAJASTHAN GOVERNMENT AND POLICE RESOURCES */}
          <div className="xl:col-span-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-[#17243B] dark:text-[#F4F5F7] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#0D9488] dark:text-[#14B8A6]" />
              {t('footer.secRajasthanTitle')}
            </h3>

            <div className="space-y-3">
              {RAJASTHAN_RESOURCES.map((res) => {
                const Icon = res.icon;
                return (
                  <a
                    key={res.id}
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block p-3.5 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F5F7FA] dark:bg-[#17243B] hover:border-[#0D9488] dark:hover:border-[#C5A66A] transition-colors space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <Icon className="w-4 h-4 text-[#0D9488] dark:text-[#14B8A6] shrink-0 mt-0.5" />
                        <span className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7] group-hover:text-[#0D9488] dark:group-hover:text-[#C5A66A] leading-snug transition-colors">
                          {t(res.nameKey)}
                        </span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[#8993A5] group-hover:text-[#0D9488] dark:group-hover:text-[#C5A66A] shrink-0 mt-0.5 transition-colors" />
                    </div>
                    <p className="text-[11px] text-[#64748B] dark:text-[#9AA6BA] leading-relaxed">
                      {t(res.descKey)}
                    </p>
                    <div className="pt-1.5 border-t border-[#E2E7EF]/80 dark:border-[#243656] flex items-center justify-between gap-2 text-[10px]">
                      <span className="font-mono text-[#A88748] dark:text-[#C5A66A] truncate">
                        {res.domain}
                      </span>
                      <span className="text-[#64748B] dark:text-[#8993A5] shrink-0">
                        {t('footer.officialSourceRaj')}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION C — IMPORTANT HELPLINE NUMBERS */}
        <div className="space-y-3 pt-2 border-t border-[#E2E7EF] dark:border-[#243656]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-[#17243B] dark:text-[#F4F5F7] flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#DC2626] dark:text-[#EF4444]" />
              {t('footer.secHelplinesTitle')}
            </h3>
            <span className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
              {t('footer.clickToCall')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {HELPLINES.map((help) => {
              const isPriority = Boolean(help.priority);
              const numberColor =
                help.accent === 'red'
                  ? 'text-[#DC2626] dark:text-[#F87171]'
                  : help.accent === 'orange'
                  ? 'text-[#EA580C] dark:text-[#FB923C]'
                  : help.accent === 'teal'
                  ? 'text-[#0D9488] dark:text-[#2DD4BF]'
                  : help.accent === 'gold'
                  ? 'text-[#A88748] dark:text-[#C5A66A]'
                  : 'text-[#2563EB] dark:text-[#60A5FA]';

              return (
                <div
                  key={help.id}
                  className={`p-3.5 rounded border transition-colors flex flex-col justify-between gap-2 ${
                    isPriority
                      ? 'bg-[#FDF4F4] dark:bg-[#23192B] border-[#F2C6C6] dark:border-[#5C2D3D]'
                      : 'bg-[#F5F7FA] dark:bg-[#17243B] border-[#E2E7EF] dark:border-[#243656]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {help.numbers.map((num, idx) => (
                          <React.Fragment key={num.tel}>
                            {idx > 0 && (
                              <span className="text-sm font-mono text-[#8993A5]" aria-hidden="true">
                                /
                              </span>
                            )}
                            <a
                              href={`tel:${num.tel}`}
                              className={`inline-flex items-center gap-1.5 font-mono text-lg font-bold tabular-nums hover:underline ${numberColor}`}
                              aria-label={`${t(help.titleKey)} ${num.display}`}
                            >
                              <Phone className="w-3.5 h-3.5 shrink-0" />
                              {num.display}
                            </a>
                          </React.Fragment>
                        ))}
                      </div>
                      {isPriority && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#DC2626] dark:text-[#F87171]">
                          {t('footer.priorityHelpline')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7] leading-snug">
                      {t(help.titleKey)}
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#9AA6BA] leading-relaxed">
                      {t(help.descKey)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Compact Footer Brand, Legal Links & Reference Notice */}
        <div className="pt-4 border-t border-[#E2E7EF] dark:border-[#243656] space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <BrandMark darkSurface={theme === 'dark'} />
              <span className="hidden sm:inline text-[#CBD2DE] dark:text-[#2E4368]" aria-hidden="true">
                |
              </span>
              <span className="text-xs text-[#64748B] dark:text-[#8993A5]">
                {t('footer.brandDesc')}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs">
              <button
                type="button"
                onClick={() => setLegalModal('privacy')}
                className="text-[#17243B] dark:text-[#F4F5F7] hover:text-[#A88748] dark:hover:text-[#C5A66A] font-medium transition-colors"
              >
                {t('footer.privacyPolicy')}
              </button>
              <span className="text-[#CBD2DE] dark:text-[#2E4368]" aria-hidden="true">
                ·
              </span>
              <button
                type="button"
                onClick={() => setLegalModal('terms')}
                className="text-[#17243B] dark:text-[#F4F5F7] hover:text-[#A88748] dark:hover:text-[#C5A66A] font-medium transition-colors"
              >
                {t('footer.termsOfUse')}
              </button>
              <span className="text-[#CBD2DE] dark:text-[#2E4368]" aria-hidden="true">
                ·
              </span>
              <button
                type="button"
                onClick={() => setLegalModal('security')}
                className="text-[#17243B] dark:text-[#F4F5F7] hover:text-[#A88748] dark:hover:text-[#C5A66A] font-medium transition-colors"
              >
                {t('footer.securityDisclaimer')}
              </button>
              <span className="text-[#CBD2DE] dark:text-[#2E4368]" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-[11px] text-[#64748B] dark:text-[#8993A5]">
                {t('footer.versionLabel')}: v1.4.0
              </span>
            </div>
          </div>

          <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] leading-relaxed">
            {t('footer.disclaimerPrimary')} {t('footer.disclaimerSecondary')}
          </p>
        </div>
      </div>

      {/* Legal Policy Modal */}
      {legalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#101A30]/60"
          role="dialog"
          aria-modal="true"
          aria-label={legalContent[legalModal].title}
        >
          <div className="fixed inset-0" onClick={() => setLegalModal(null)} />
          <div className="relative z-10 w-full max-w-lg bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#2A3F63] rounded shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E7EF] dark:border-[#243656] flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                TRACE INTEL — {legalContent[legalModal].title}
              </h3>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                aria-label={t('footer.closeModal')}
                className="p-1 text-[#64748B] dark:text-[#8993A5] hover:text-[#17243B] dark:hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
              {legalContent[legalModal].body.map((para, idx) => (
                <p key={idx}>{para}</p>
              ))}
              <p className="pt-2 border-t border-[#E2E7EF] dark:border-[#243656] text-[11px] text-[#64748B] dark:text-[#8993A5]">
                {t('footer.disclaimerPrimary')}
              </p>
            </div>
            <div className="px-5 py-3 border-t border-[#E2E7EF] dark:border-[#243656] bg-[#F5F7FA] dark:bg-[#131F35] flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="h-8 px-4 text-xs font-medium bg-[#101A30] dark:bg-[#C5A66A] text-white dark:text-[#101A30] rounded hover:opacity-90 transition-opacity"
              >
                {t('footer.closeModal')}
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
