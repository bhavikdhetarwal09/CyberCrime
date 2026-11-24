export type PortalColumnId = 'report' | 'learning' | 'volunteer';

export type PortalOptionId =
  | 'report-crime'
  | 'track-complaint'
  | 'anonymous-reporting'
  | 'social-media-abuse'
  | 'advisories-alerts'
  | 'cyber-safety-tips'
  | 'daily-threat-digits'
  | 'rti-statistics'
  | 'volunteer-overview'
  | 'volunteer-register';

export interface PortalOptionMeta {
  id: PortalOptionId;
  column: PortalColumnId;
  title: string;
  shortDesc: string;
  badgeText?: string;
}

export interface OfficialLinkRef {
  label: string;
  url: string;
  domain: string;
  authority: string;
  note?: string;
}

export interface VerifiedAdvisory {
  id: string;
  title: string;
  summary: string;
  publishedDate: string;
  sourceOrg: string;
  priority: 'Critical' | 'High' | 'Advisory';
  sector: string;
  url: string;
}

export interface SafetyTipCategory {
  id: string;
  title: string;
  summary: string;
  tips: string[];
}

export interface NcrbYearlyStat {
  year: string;
  cases: number;
  yoyLabel: string;
  source: string;
}

export interface SocialPlatformGuide {
  id: string;
  platform: string;
  company: string;
  inAppSteps: string;
  primaryUrl: string;
  primaryLabel: string;
  secondaryUrl?: string;
  secondaryLabel?: string;
}

export interface RtiPublicDocument {
  id: string;
  title: string;
  category: 'RTI Resource' | 'Official Statistics' | 'Government Publication' | 'Telecom Safety';
  source: string;
  datedReference: string;
  description: string;
  url: string;
  domain: string;
}

export const OFFICIAL_NCRP_HOME: OfficialLinkRef = {
  label: 'National Cyber Crime Reporting Portal',
  url: 'https://cybercrime.gov.in/',
  domain: 'cybercrime.gov.in',
  authority: 'Indian Cyber Crime Coordination Centre (I4C), Ministry of Home Affairs, Govt. of India',
};

export const PORTAL_COLUMNS: Array<{
  id: PortalColumnId;
  heading: string;
  subtitle: string;
  options: PortalOptionMeta[];
}> = [
  {
    id: 'report',
    heading: 'REPORT CYBER CRIME',
    subtitle: 'Official citizen reporting guidance, complaint tracking & urgent helplines',
    options: [
      {
        id: 'report-crime',
        column: 'report',
        title: 'Report a Crime',
        shortDesc: 'Financial fraud, phishing, identity theft, hacking & evidence preparation steps.',
        badgeText: 'Urgent',
      },
      {
        id: 'track-complaint',
        column: 'report',
        title: 'Track Your Complaint',
        shortDesc: 'Official status verification using Acknowledgement Number & mobile OTP.',
      },
      {
        id: 'anonymous-reporting',
        column: 'report',
        title: 'Anonymous Reporting',
        shortDesc: 'Eligibility scope, statutory categories & limitations on cybercrime.gov.in.',
      },
      {
        id: 'social-media-abuse',
        column: 'report',
        title: 'Social Media Abuse',
        shortDesc: 'Evidence capture, platform reporting channels & official escalation guidance.',
      },
    ],
  },
  {
    id: 'learning',
    heading: 'LEARNING CORNER',
    subtitle: 'Verified CERT-In advisories, cyber hygiene, official statistics & RTI records',
    options: [
      {
        id: 'advisories-alerts',
        column: 'learning',
        title: 'Advisories & Alerts',
        shortDesc: 'Dated CERT-In (CIAD) warnings, vulnerability notes & active threat alerts.',
      },
      {
        id: 'cyber-safety-tips',
        column: 'learning',
        title: 'Cyber Safety Tips',
        shortDesc: 'Actionable safeguards for banking, UPI, OTPs, passwords & mobile security.',
      },
      {
        id: 'daily-threat-digits',
        column: 'learning',
        title: 'Daily Threat Digits',
        shortDesc: 'Verified NCRB & MHA/I4C historical cybercrime statistics & fraud trends.',
      },
      {
        id: 'rti-statistics',
        column: 'learning',
        title: 'RTI & Statistics Notes',
        shortDesc: 'Official RTI portals, NCRB reports & public government reference documents.',
      },
    ],
  },
  {
    id: 'volunteer',
    heading: 'CYBER VOLUNTEER',
    subtitle: 'I4C citizen participation initiative for a safer Indian cyberspace',
    options: [
      {
        id: 'volunteer-overview',
        column: 'volunteer',
        title: 'Program Overview',
        shortDesc: 'Official I4C objectives, volunteer roles, content scope & participation rules.',
      },
      {
        id: 'volunteer-register',
        column: 'volunteer',
        title: 'Register as Volunteer',
        shortDesc: 'Eligibility, required documents & direct link to official MHA registration.',
      },
    ],
  },
];

export const VERIFIED_ADVISORIES: VerifiedAdvisory[] = [
  {
    id: 'CIAD-2026-0062',
    title: 'Abuse of Business Payment Workflows and Use of AI-Driven Agentic Offensive Frameworks across Sectors',
    summary:
      'Highlights automated and AI-assisted offensive frameworks targeting enterprise payment initiation and disbursement workflows across sectors.',
    publishedDate: '20 Nov 2026',
    sourceOrg: 'CERT-In (MeitY, Govt. of India)',
    priority: 'High',
    sector: 'Cross-Sector / Finance',
    url: 'https://www.cert-in.org.in/',
  },
  {
    id: 'CIAD-2026-0060',
    title: 'The Gentlemen Ransomware',
    summary:
      'Documents observed tactics, initial access vectors, and mitigation recommendations associated with The Gentlemen ransomware operations.',
    publishedDate: '13 Nov 2026',
    sourceOrg: 'CERT-In (MeitY, Govt. of India)',
    priority: 'High',
    sector: 'Enterprise / Infrastructure',
    url: 'https://www.cert-in.org.in/',
  },
  {
    id: 'CIAD-2026-0058',
    title: 'Escalation of AI-Driven Attacks on BFSI Entities by Threat Actor "CRAFTY FALCON"',
    summary:
      'Focuses on targeted attacks against payment and disbursement APIs across banks, NBFCs, and fintech platforms, with API hardening guidance.',
    publishedDate: '04 Nov 2026',
    sourceOrg: 'CERT-In (MeitY, Govt. of India)',
    priority: 'Critical',
    sector: 'BFSI / FinTech',
    url: 'https://www.cert-in.org.in/',
  },
  {
    id: 'CIAD-2026-0052',
    title: 'Advisory to MSME — Remote Code Execution Vulnerabilities in PHP ("PHP2Shell")',
    summary:
      'Critical warning regarding active in-the-wild exploitation affecting unpatched PHP versions used on MSME web portals and hosted services.',
    publishedDate: '22 Oct 2026',
    sourceOrg: 'CERT-In (MeitY, Govt. of India)',
    priority: 'Critical',
    sector: 'MSME / Web Services',
    url: 'https://www.cert-in.org.in/',
  },
  {
    id: 'CIAD-2026-0037',
    title: 'Emerging Threats Targeting Microsoft 365 (M365)',
    summary:
      'Covers large-scale password spraying, device-code phishing (PhaaS), ROPC OAuth abuse, and Business Email Compromise bypassing legacy MFA.',
    publishedDate: '07 Aug 2026',
    sourceOrg: 'CERT-In (MeitY, Govt. of India)',
    priority: 'High',
    sector: 'Cloud / Enterprise Email',
    url: 'https://www.cert-in.org.in/',
  },
  {
    id: 'CIAD-2025-0055',
    title: 'WhatsApp Account Takeover Campaign (GhostPairing)',
    summary:
      'Alert detailing fraudulent device-linking and account takeover techniques targeting messaging users, with session audit recommendations.',
    publishedDate: '19 Dec 2025',
    sourceOrg: 'CERT-In (MeitY, Govt. of India)',
    priority: 'Advisory',
    sector: 'Citizens / Messaging',
    url: 'https://www.cert-in.org.in/',
  },
];

export const CYBER_SAFETY_CATEGORIES: SafetyTipCategory[] = [
  {
    id: 'banking',
    title: 'Online Banking Safety',
    summary: 'Protect net-banking credentials, cards, and bank alert channels from compromise.',
    tips: [
      'Always type your bank URL manually or use the official verified mobile banking app; never log in via links in SMS, WhatsApp, or search ads.',
      'Enable instant SMS and email transaction alerts for all debit, credit, and net-banking activity and set conservative daily transfer limits.',
      'Never install remote-access apps (such as AnyDesk, TeamViewer, or QuickSupport) at the request of callers claiming to be bank or KYC executives.',
      'Verify SSL/HTTPS and exact domain spelling before entering credentials; avoid accessing net-banking on public or unsecured Wi-Fi networks.',
    ],
  },
  {
    id: 'upi',
    title: 'UPI & Payment Fraud Prevention',
    summary: 'Core safeguards against collect-request scams, fake QR codes, and refund fraud.',
    tips: [
      'Remember the fundamental UPI rule: entering your UPI PIN is ONLY required to SEND money — never to receive a refund, prize, or payment.',
      'Decline unexpected "Collect" payment requests and never scan QR codes sent by unknown buyers or callers promising cashbacks or marketplace transfers.',
      'Verify the beneficiary name displayed inside the UPI app before confirming any transfer, and keep a separate low-balance account for routine UPI payments.',
      'If money is debited fraudulently, dial 1930 immediately and log the UTR/Transaction ID on cybercrime.gov.in within the golden hour to freeze funds.',
    ],
  },
  {
    id: 'phishing',
    title: 'Phishing Emails & Suspicious Links',
    summary: 'Identify spoofed domains, urgent social-engineering lures, and malicious APK attachments.',
    tips: [
      'Inspect the full sender email address and link destination carefully; government portals in India end in .gov.in or .nic.in.',
      'Treat urgent messages warning of "KYC suspension", "unpaid electricity/e-Challan fines", or "digital arrest" as high-risk social engineering.',
      'Never download or install .apk files shared over WhatsApp, Telegram, or SMS pretending to be RTO e-Challan, bank KYC, or courier apps.',
      'Independently verify suspicious notices by calling the official customer-care number printed on the back of your card or official website.',
    ],
  },
  {
    id: 'passwords',
    title: 'Password Security',
    summary: 'Prevent credential-stuffing and brute-force takeovers across email and financial accounts.',
    tips: [
      'Use a unique passphrase of at least 12–16 characters mixing upper/lowercase letters, numbers, and symbols for every critical account.',
      'Never reuse your primary email password on shopping, social media, or third-party websites; compromise of one site exposes reused accounts.',
      'Enable Multi-Factor Authentication (MFA) using an authenticator app or hardware key rather than relying solely on passwords.',
      'Avoid storing plain-text passwords in unencrypted notes, screenshots, or shared spreadsheets.',
    ],
  },
  {
    id: 'otp',
    title: 'OTP Protection',
    summary: 'Defend One-Time Passwords against vishing, call forwarding, and SIM-swap abuse.',
    tips: [
      'Never share an OTP, CVV, MPIN, or ATM PIN with anyone over phone calls, SMS, or screen-sharing—no bank or police officer will ever ask for it.',
      'Read the full SMS text accompanying every OTP to verify the merchant name, transaction amount, and purpose (e.g., card addition vs. login).',
      'Watch out for call-forwarding codes (*21*, *401*, etc.) dictated by fraudsters to divert verification calls and OTPs.',
      'If your mobile signal abruptly drops to "No Service" for an unusual period, immediately check with your telecom operator for unauthorized SIM swap activity.',
    ],
  },
  {
    id: 'social',
    title: 'Social Media Privacy',
    summary: 'Limit exposure to impersonation, sextortion, doxxing, and targeted social engineering.',
    tips: [
      'Lock profile visibility to trusted contacts and avoid posting date of birth, residential address, boarding passes, or family routines publicly.',
      'Enable two-step verification (2FA) and login alerts across WhatsApp, Instagram, Facebook, X, and LinkedIn, and periodically audit linked devices.',
      'Never accept unknown video calls or share private photos/videos with unverified online contacts; report blackmail immediately without paying.',
      'Verify friend requests claiming to be acquaintances asking for urgent UPI transfers by calling the person on their known phone number.',
    ],
  },
  {
    id: 'mobile',
    title: 'Mobile Device Security',
    summary: 'Harden Android and iOS smartphones against spyware, rogue apps, and theft.',
    tips: [
      'Install apps strictly from official app stores (Google Play Store / Apple App Store) and keep "Install unknown apps" disabled.',
      'Keep the operating system and security patches up to date; review and revoke unnecessary Accessibility, SMS, and Device Admin permissions.',
      'Protect your SIM card with a SIM PIN and set a strong screen lock; enable Find My Device / Find My iPhone.',
      'Use the Government of India Sanchar Saathi portal (sancharsaathi.gov.in) to block lost/stolen handsets via CEIR and check SIMs registered in your name.',
    ],
  },
  {
    id: 'identity',
    title: 'Digital Identity Protection',
    summary: 'Safeguard Aadhaar, PAN, passport copies, and biometric data against misuse.',
    tips: [
      'Share masked Aadhaar copies where full Aadhaar is not legally required, and lock Aadhaar biometrics via UIDAI mAadhaar when not needed.',
      'Periodically review your credit report (CIBIL/Experian) and Sanchar Saathi TAFCOP portal to detect unauthorized loans or mobile connections.',
      'Watermark scanned identity documents with the date and specific purpose before submitting them to private organizations.',
      'Avoid uploading personal ID cards, PAN details, or bank statements to unverified online tools or public cloud links.',
    ],
  },
];

export const NCRB_VERIFIED_STATS: NcrbYearlyStat[] = [
  {
    year: '2021',
    cases: 52974,
    yoyLabel: 'Baseline',
    source: 'NCRB "Crime in India 2021" (MHA)',
  },
  {
    year: '2022',
    cases: 65893,
    yoyLabel: '+24.4% YoY',
    source: 'NCRB "Crime in India 2022" (MHA)',
  },
  {
    year: '2023',
    cases: 86128,
    yoyLabel: '+30.7% YoY',
    source: 'NCRB "Crime in India 2023" (MHA)',
  },
];

export const SOCIAL_PLATFORM_GUIDES: SocialPlatformGuide[] = [
  {
    id: 'facebook',
    platform: 'Facebook (Meta)',
    company: 'Meta Platforms',
    inAppSteps:
      'Open the offending post, comment, message, or fake profile → click/tap the three dots (…) → select Report → choose Harassment/Bullying or "Pretending to be someone else".',
    primaryUrl: 'https://www.facebook.com/safety/bullying',
    primaryLabel: 'Meta Safety Center (Harassment)',
    secondaryUrl: 'https://www.facebook.com/help/contact/295309487209484',
    secondaryLabel: 'Report Impersonating Profile',
  },
  {
    id: 'instagram',
    platform: 'Instagram (Meta)',
    company: 'Meta Platforms',
    inAppSteps:
      'Open the abusive post, comment, DM, or impersonating account → tap the three dots (…) → tap Report → select Harassment/Bullying or "Pretending to be someone else".',
    primaryUrl: 'https://help.instagram.com/165828726894770',
    primaryLabel: 'Instagram Harassment Help',
    secondaryUrl: 'https://help.instagram.com/contact/636276399721841',
    secondaryLabel: 'Impersonation Report Form',
  },
  {
    id: 'whatsapp',
    platform: 'WhatsApp',
    company: 'Meta Platforms',
    inAppSteps:
      'Export the chat with media and capture screenshots first for police evidence. Then open chat/group info → scroll down → tap Report (optionally Block and delete).',
    primaryUrl: 'https://faq.whatsapp.com/1142461713307604',
    primaryLabel: 'WhatsApp Reporting & Blocking Guide',
  },
  {
    id: 'x',
    platform: 'X (formerly Twitter)',
    company: 'X Corp.',
    inAppSteps:
      'Click the three dots (…) on the offending post or profile → select Report → pick Harassment, Hateful Conduct, or "Pretending to be me or someone else".',
    primaryUrl: 'https://help.x.com/en/rules-and-policies/how-to-report-violations',
    primaryLabel: 'X Rules & Violation Reporting',
  },
  {
    id: 'youtube',
    platform: 'YouTube (Google)',
    company: 'Google LLC',
    inAppSteps:
      'Click the three dots (…) or Flag icon beneath the video/comment (or About tab on a channel) → select Report → choose Harassment, Cyberbullying, or Impersonation.',
    primaryUrl: 'https://support.google.com/youtube/answer/2802268',
    primaryLabel: 'YouTube Harassment Policy & Reporting',
    secondaryUrl: 'https://support.google.com/youtube/answer/2801895',
    secondaryLabel: 'YouTube Privacy Complaint Process',
  },
];

export const RTI_AND_PUBLIC_DOCUMENTS: RtiPublicDocument[] = [
  {
    id: 'rti-online',
    title: 'RTI Online Portal — Government of India',
    category: 'RTI Resource',
    source: 'Department of Personnel & Training (DoPT), Govt. of India',
    datedReference: 'Active Central Portal (Verified Nov 2026)',
    description:
      'Official portal for Indian citizens to file Right to Information (RTI) requests and first appeals online with Central Ministries/Departments including the Ministry of Home Affairs (MHA).',
    url: 'https://rtionline.gov.in/',
    domain: 'rtionline.gov.in',
  },
  {
    id: 'ncrp-rti',
    title: 'National Cyber Crime Reporting Portal — RTI & Public Notices',
    category: 'RTI Resource',
    source: 'Indian Cyber Crime Coordination Centre (I4C), MHA',
    datedReference: 'Portal Public Disclosures (Verified Nov 2026)',
    description:
      'Official RTI disclosures, CPIO contact details, and public notices published under the National Cyber Crime Reporting Portal.',
    url: 'https://cybercrime.gov.in/Webform/RTI.aspx',
    domain: 'cybercrime.gov.in',
  },
  {
    id: 'ncrb-cii',
    title: 'NCRB "Crime in India" Annual Statistical Reports',
    category: 'Official Statistics',
    source: 'National Crime Records Bureau (NCRB), MHA',
    datedReference: 'Published Annual Editions (2021, 2022 & 2023 Data)',
    description:
      'Official national repository of registered cybercrime statistics broken down by State/UT, IT Act & IPC/BNS sections, motive, and disposal status.',
    url: 'https://www.ncrb.gov.in/',
    domain: 'ncrb.gov.in',
  },
  {
    id: 'i4c-portal',
    title: 'I4C Official Portal — Policy Frameworks & Awareness Publications',
    category: 'Government Publication',
    source: 'Indian Cyber Crime Coordination Centre (I4C), MHA',
    datedReference: 'Attached Office of MHA (Effective Jul 2024; Verified Nov 2026)',
    description:
      'Information on I4C verticals including CFCFRMS (Helpline 1930), Suspect Registry, Samanvaya, Pratibimb, and citizen awareness bulletins.',
    url: 'https://i4c.mha.gov.in/',
    domain: 'i4c.mha.gov.in',
  },
  {
    id: 'ncrp-faq',
    title: 'NCRP Official Citizen FAQs & Reporting Manual',
    category: 'Government Publication',
    source: 'National Cyber Crime Reporting Portal, MHA',
    datedReference: 'Official Portal Reference (Verified Nov 2026)',
    description:
      'Authoritative guidance on complaint categories, mandatory evidence fields, acknowledgement tracking, and state nodal police officer contact lists.',
    url: 'https://cybercrime.gov.in/FAQ.aspx',
    domain: 'cybercrime.gov.in',
  },
  {
    id: 'sanchar-saathi',
    title: 'Sanchar Saathi — CEIR IMEI Blocking & TAFCOP SIM Audit',
    category: 'Telecom Safety',
    source: 'Department of Telecommunications (DoT), Govt. of India',
    datedReference: 'Active Citizen Telecom Portal (Verified Nov 2026)',
    description:
      'Verify mobile connections registered under your name (TAFCOP), block/trace lost or stolen handsets via IMEI (CEIR), and report suspected fraud communications (Chakshu).',
    url: 'https://sancharsaathi.gov.in/',
    domain: 'sancharsaathi.gov.in',
  },
];
