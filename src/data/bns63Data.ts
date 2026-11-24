export interface Bns63OfficialSource {
  label: string;
  authority: string;
  url: string;
  domain: string;
  description: string;
}

export interface Bns63ClauseItem {
  code: string;
  heading: string;
  summary: string;
}

export interface Bns63CrossReference {
  provision: string;
  statute: string;
  scope: string;
  detail: string;
}

export const BNS_63_METADATA = {
  sectionNumber: 'Section 63',
  statuteFull: 'Bharatiya Nyaya Sanhita, 2023 (BNS)',
  actNumber: 'Act No. 45 of 2023',
  chapter: 'Chapter V — Of Offences Against Woman and Child',
  enactedDate: '25 December 2023',
  commencementDate: '1 July 2024',
  erstwhileIpc: 'Corresponding to Section 375 of the Indian Penal Code, 1860 (repealed)',
  punishmentSection: 'Section 64 of the Bharatiya Nyaya Sanhita, 2023',
};

export const BNS_63_STATUTORY_ACTS: Bns63ClauseItem[] = [
  {
    code: 'Clause (a)',
    heading: 'Penetration',
    summary:
      'Penetrating the penis, to any extent, into the vagina, mouth, urethra, or anus of a woman, or making her do so with him or any other person.',
  },
  {
    code: 'Clause (b)',
    heading: 'Insertion of Object or Body Part',
    summary:
      'Inserting, to any extent, any object or a part of the body, not being the penis, into the vagina, urethra, or anus of a woman, or making her do so with him or any other person.',
  },
  {
    code: 'Clause (c)',
    heading: 'Manipulation Causing Penetration',
    summary:
      'Manipulating any part of the body of a woman so as to cause penetration into the vagina, urethra, anus, or any part of body of such woman, or making her do so with him or any other person.',
  },
  {
    code: 'Clause (d)',
    heading: 'Oral Contact',
    summary:
      'Applying the mouth to the vagina, anus, or urethra of a woman, or making her do so with him or any other person.',
  },
];

export const BNS_63_SEVEN_DESCRIPTIONS: Bns63ClauseItem[] = [
  {
    code: 'First',
    heading: 'Against Her Will',
    summary: 'Committed against the will of the woman.',
  },
  {
    code: 'Second',
    heading: 'Without Her Consent',
    summary: 'Committed without the consent of the woman.',
  },
  {
    code: 'Third',
    heading: 'Consent Obtained Under Fear',
    summary:
      'With her consent, when consent is obtained by putting her or any person in whom she is interested in fear of death or of hurt.',
  },
  {
    code: 'Fourth',
    heading: 'Deception as to Lawful Marriage',
    summary:
      'With her consent, when the man knows he is not her husband and consent is given because she believes he is another man to whom she is or believes herself to be lawfully married.',
  },
  {
    code: 'Fifth',
    heading: 'Unsoundness of Mind or Intoxication',
    summary:
      'With her consent, when at the time of giving consent, by reason of unsoundness of mind, intoxication, or administration of any stupefying or unwholesome substance, she is unable to understand the nature and consequences of that to which she gives consent.',
  },
  {
    code: 'Sixth',
    heading: 'Under Eighteen Years of Age',
    summary: 'With or without her consent, when she is under eighteen years of age.',
  },
  {
    code: 'Seventh',
    heading: 'Inability to Communicate Consent',
    summary: 'When she is unable to communicate consent.',
  },
];

export const BNS_63_EXPLANATIONS_AND_EXCEPTIONS = {
  explanations: [
    {
      label: 'Explanation 1',
      title: 'Anatomical Scope',
      text: 'For the purposes of Section 63, "vagina" shall also include labia majora.',
    },
    {
      label: 'Explanation 2',
      title: 'Definition of Consent',
      text: 'Consent means an unequivocal voluntary agreement when the woman by words, gestures, or any form of verbal or non-verbal communication communicates willingness to participate in the specific sexual act.',
    },
    {
      label: 'Proviso to Explanation 2',
      title: 'Absence of Physical Resistance',
      text: 'A woman who does not physically resist to the act of penetration shall not by the reason only of that fact be regarded as consenting to the sexual activity.',
    },
  ],
  exceptions: [
    {
      label: 'Exception 1',
      title: 'Medical Procedure or Intervention',
      text: 'A medical procedure or intervention shall not constitute rape.',
    },
    {
      label: 'Exception 2',
      title: 'Marital Exception (Age Threshold: 18 Years)',
      text: 'Sexual intercourse or sexual acts by a man with his own wife, the wife not being under eighteen years of age, is not rape. (Under the BNS, 2023, the statutory age threshold in this exception stands at 18 years, compared to 15 years in the repealed IPC Section 375 text.)',
    },
  ],
};

export const BNS_63_CROSS_REFERENCES: Bns63CrossReference[] = [
  {
    provision: 'Section 64(1) & 64(2)',
    statute: 'Bharatiya Nyaya Sanhita, 2023 (BNS)',
    scope: 'Punishment for Rape',
    detail:
      'Prescribes rigorous imprisonment of not less than 10 years (extendable to imprisonment for life) and fine under sub-section (1), and enhanced punishment extending to imprisonment for the remainder of natural life with fine for specified aggravated categories under sub-section (2).',
  },
  {
    provision: 'Section 72',
    statute: 'Bharatiya Nyaya Sanhita, 2023 (BNS)',
    scope: 'Protection of Victim Identity',
    detail:
      'Penalizes unauthorized printing or publication of the name or any matter that may make known the identity of a victim of specified offences, including Section 64 (formerly IPC Section 228A).',
  },
  {
    provision: 'Section 173',
    statute: 'Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)',
    scope: 'FIR Registration & Women Officer Mandate',
    detail:
      'Governs recording of First Information Reports (including Zero FIR and electronic communication), with mandatory recording by a woman police officer or any woman officer in specified offences against women.',
  },
  {
    provision: 'Section 183',
    statute: 'Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)',
    scope: 'Recording of Statement by Magistrate',
    detail:
      'Provides for recording confessions and statements before a Judicial Magistrate, including mandatory Magistrate recording of the victim’s statement in offences punishable under Section 64 BNS.',
  },
  {
    provision: 'Section 184',
    statute: 'Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)',
    scope: 'Medical Examination of Victim',
    detail:
      'Governs timely medical examination of the victim by a registered medical practitioner with consent within 24 hours of receiving information regarding commission of the offence.',
  },
];

export const BNS_63_FORENSIC_REFERENCE_NOTES: string[] = [
  'Corroborate reported incident windows and movement claims strictly through lawfully requisitioned CDR, cell tower sector records, and IPDR logs authorized under applicable BNSS / Telegraph / IT Act procedures.',
  'Preserve digital communications, call recordings, location metadata, and device extractions with intact cryptographic hashes and documented chain-of-custody records.',
  'Maintain strict statutory confidentiality regarding victim identity across case titles, exported reports, and shared exhibits in compliance with Section 72 BNS and departmental SOPs.',
  'Verify whether electronic record certificates are required under Section 63 of the Bharatiya Sakshya Adhiniyam, 2023 (BSA) — a separate statute from BNS Section 63 — before filing digital evidence in court.',
];

export const BNS_63_OFFICIAL_SOURCES: Bns63OfficialSource[] = [
  {
    label: 'India Code — Digital Repository of All Central & State Acts',
    authority: 'Legislative Department, Ministry of Law & Justice, Govt. of India',
    url: 'https://www.indiacode.nic.in/',
    domain: 'indiacode.nic.in',
    description:
      'Authoritative repository to inspect the complete enacted text of the Bharatiya Nyaya Sanhita, 2023 (Act No. 45 of 2023) and subsequent official updates.',
  },
  {
    label: 'Legislative Department — Central Acts & Gazette Texts',
    authority: 'Ministry of Law & Justice, Govt. of India',
    url: 'https://legislative.gov.in/',
    domain: 'legislative.gov.in',
    description:
      'Official publication portal for enacted central legislation, BNS/BNSS/BSA bare act PDFs, and legislative notifications.',
  },
  {
    label: 'Ministry of Home Affairs (MHA)',
    authority: 'Government of India',
    url: 'https://www.mha.gov.in/',
    domain: 'mha.gov.in',
    description:
      'Nodal ministry administering the Bharatiya Nyaya Sanhita, 2023, BNSS 2023, and official implementation circulars.',
  },
  {
    label: 'National Cyber Crime Reporting Portal',
    authority: 'I4C, Ministry of Home Affairs, Govt. of India',
    url: 'https://cybercrime.gov.in/',
    domain: 'cybercrime.gov.in',
    description:
      'Official citizen portal for reporting cyber-enabled offences, including crimes against women and children.',
  },
];
