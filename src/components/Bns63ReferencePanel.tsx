import React, { useState } from 'react';
import {
  Scale,
  X,
  ExternalLink,
  BookOpen,
  FileCheck2,
  ShieldAlert,
  Info,
  Landmark,
} from 'lucide-react';
import {
  BNS_63_METADATA,
  BNS_63_STATUTORY_ACTS,
  BNS_63_SEVEN_DESCRIPTIONS,
  BNS_63_EXPLANATIONS_AND_EXCEPTIONS,
  BNS_63_CROSS_REFERENCES,
  BNS_63_FORENSIC_REFERENCE_NOTES,
  BNS_63_OFFICIAL_SOURCES,
} from '../data/bns63Data';

interface Bns63ReferencePanelProps {
  onClose: () => void;
}

type BnsTabId = 'definition' | 'explanations' | 'cross-refs' | 'sources';

export const Bns63ReferencePanel: React.FC<Bns63ReferencePanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<BnsTabId>('definition');

  const tabs: Array<{ id: BnsTabId; label: string }> = [
    { id: 'definition', label: 'Statutory Definition' },
    { id: 'explanations', label: 'Explanations & Exceptions' },
    { id: 'cross-refs', label: 'BNS/BNSS & Investigation Notes' },
    { id: 'sources', label: 'Authoritative Sources' },
  ];

  return (
    <section
      aria-labelledby="bns-63-heading"
      className="bg-white dark:bg-[#17243B] border border-[#E2E7EF] dark:border-[#243656] rounded overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 bg-[#101A30] text-white border-b border-[#243656] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-mono text-[#C5A66A] tracking-wide">
            LEGAL REFERENCE · {BNS_63_METADATA.actNumber} · {BNS_63_METADATA.chapter}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Scale className="w-4 h-4 text-[#C5A66A] shrink-0" />
            <h2 id="bns-63-heading" className="text-base font-semibold text-white">
              {BNS_63_METADATA.sectionNumber} — {BNS_63_METADATA.statuteFull}
            </h2>
          </div>
          <p className="text-xs text-[#B5C0D0] mt-1">
            Statutory definition of the offence of rape · Effective {BNS_63_METADATA.commencementDate} ·{' '}
            {BNS_63_METADATA.erstwhileIpc}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://www.indiacode.nic.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-3 rounded bg-[#C5A66A] hover:bg-[#d3b67c] text-[#101A30] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <span>India Code</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close BNS 63 reference section"
            className="h-8 px-2.5 rounded border border-[#2E4368] bg-[#17243B] hover:bg-[#223454] text-xs font-medium text-[#E2E8F0] inline-flex items-center gap-1 whitespace-nowrap transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Strict Separation Notice: Legal Reference vs Investigation Tools */}
      <div className="px-5 py-3 bg-[#F8F8F6] dark:bg-[#131F35] border-b border-[#E2E7EF] dark:border-[#243656] flex flex-col md:flex-row md:items-center justify-between gap-2 text-[11px] text-[#475569] dark:text-[#9AA6BA]">
        <span className="inline-flex items-start gap-2 leading-relaxed">
          <Landmark className="w-3.5 h-3.5 text-[#A88748] dark:text-[#C5A66A] shrink-0 mt-0.5" />
          <span>
            <strong className="text-[#17243B] dark:text-[#F4F5F7]">Legal Reference Only (Not an Investigation Tool):</strong>{' '}
            This section summarizes statutory provisions from official Government of India publications for officer reference. It does not execute legal filings, confer statutory powers, or replace official bare act verification on India Code.
          </span>
        </span>
      </div>

      {/* Navigation Tabs */}
      <div className="px-5 pt-3 border-b border-[#E2E7EF] dark:border-[#243656] bg-white dark:bg-[#17243B] flex flex-wrap items-center gap-1.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-[#101A30] dark:border-[#C5A66A] text-[#101A30] dark:text-[#C5A66A]'
                  : 'border-transparent text-[#64748B] dark:text-[#9AA6BA] hover:text-[#17243B] dark:hover:text-[#F4F5F7]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content Body */}
      <div className="p-5 space-y-5 text-xs text-[#334155] dark:text-[#CBD5E1]">
        {/* TAB 1: STATUTORY DEFINITION */}
        {activeTab === 'definition' && (
          <div className="space-y-5">
            {/* Key Statutory Facts Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35]">
                <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Enacted Statute</p>
                <p className="mt-1 font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  BNS, 2023 (Act 45 of 2023)
                </p>
              </div>
              <div className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35]">
                <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Commencement Date</p>
                <p className="mt-1 font-semibold font-mono tabular-nums text-[#17243B] dark:text-[#F4F5F7]">
                  01 July 2024
                </p>
              </div>
              <div className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35]">
                <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Erstwhile Provision</p>
                <p className="mt-1 font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  Section 375, IPC 1860
                </p>
              </div>
              <div className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35]">
                <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">Punishment Provision</p>
                <p className="mt-1 font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  Section 64, BNS 2023
                </p>
              </div>
            </div>

            {/* Statutory Distinction Note for Telecom/Cyber Officers */}
            <div className="p-3.5 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F5F5F2] dark:bg-[#101A30] flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#A88748] dark:text-[#C5A66A] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  Statutory Citation Distinction (BNS Section 63 vs. BSA Section 63)
                </p>
                <p className="text-[11px] text-[#475569] dark:text-[#9AA6BA] leading-relaxed">
                  <strong>Section 63 of the Bharatiya Nyaya Sanhita (BNS), 2023</strong> defines the substantive criminal offence of rape (replacing IPC Section 375). Do not confuse it with{' '}
                  <strong>Section 63 of the Bharatiya Sakshya Adhiniyam (BSA), 2023</strong>, which governs the admissibility and certification of electronic records (replacing Section 65B of the Indian Evidence Act, 1872).
                </p>
              </div>
            </div>

            {/* Four Acts + Seven Circumstances */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#101A30] dark:text-[#C5A66A]" />
                  <h3 className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                    Specified Acts Under Section 63 BNS — Clauses (a) to (d)
                  </h3>
                </div>
                <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                  A man is said to commit &ldquo;rape&rdquo; if he commits any of the following acts under any of the seven circumstances listed alongside:
                </p>
                <div className="space-y-2">
                  {BNS_63_STATUTORY_ACTS.map((item) => (
                    <div
                      key={item.code}
                      className="p-3 rounded border border-[#E2E7EF] dark:border-[#243656] bg-white dark:bg-[#131F35]"
                    >
                      <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                        <span className="font-mono text-[#A88748] dark:text-[#C5A66A] mr-1.5">
                          {item.code}
                        </span>
                        {item.heading}
                      </p>
                      <p className="text-[11px] text-[#475569] dark:text-[#9AA6BA] mt-1 leading-relaxed">
                        {item.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#101A30] dark:text-[#C5A66A]" />
                  <h3 className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                    Seven Statutory Circumstances (First to Seventh)
                  </h3>
                </div>
                <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                  An act under clauses (a)–(d) constitutes the offence when committed under any of these descriptions:
                </p>
                <div className="divide-y divide-[#E2E7EF] dark:divide-[#243656] border border-[#E2E7EF] dark:border-[#243656] rounded bg-white dark:bg-[#131F35]">
                  {BNS_63_SEVEN_DESCRIPTIONS.map((desc) => (
                    <div key={desc.code} className="px-3.5 py-2.5">
                      <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                        <span className="font-mono text-[#A88748] dark:text-[#C5A66A] mr-1.5">
                          {desc.code}.
                        </span>
                        {desc.heading}
                      </p>
                      <p className="text-[11px] text-[#475569] dark:text-[#9AA6BA] mt-0.5 leading-relaxed">
                        {desc.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EXPLANATIONS & EXCEPTIONS */}
        {activeTab === 'explanations' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                Statutory Explanations &amp; Proviso
              </h3>
              {BNS_63_EXPLANATIONS_AND_EXCEPTIONS.explanations.map((exp) => (
                <div
                  key={exp.label}
                  className="p-3.5 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35] space-y-1"
                >
                  <p className="text-[11px] font-mono text-[#A88748] dark:text-[#C5A66A]">
                    {exp.label} · {exp.title}
                  </p>
                  <p className="text-xs text-[#17243B] dark:text-[#E2E8F0] leading-relaxed">
                    {exp.text}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                Statutory Exceptions Under Section 63 BNS
              </h3>
              {BNS_63_EXPLANATIONS_AND_EXCEPTIONS.exceptions.map((exc) => (
                <div
                  key={exc.label}
                  className="p-3.5 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35] space-y-1"
                >
                  <p className="text-[11px] font-mono text-[#A88748] dark:text-[#C5A66A]">
                    {exc.label} · {exc.title}
                  </p>
                  <p className="text-xs text-[#17243B] dark:text-[#E2E8F0] leading-relaxed">
                    {exc.text}
                  </p>
                </div>
              ))}
              <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] leading-relaxed pt-1">
                Always consult the official gazetted bare act on India Code and binding Supreme Court / High Court jurisprudence when applying statutory exceptions to specific case facts.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: CROSS-REFERENCES & INVESTIGATION REFERENCE */}
        {activeTab === 'cross-refs' && (
          <div className="space-y-5">
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                Connected Provisions (BNS, 2023 &amp; BNSS, 2023)
              </h3>
              <div className="overflow-x-auto border border-[#E2E7EF] dark:border-[#243656] rounded">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8F8F6] dark:bg-[#131F35] border-b border-[#E2E7EF] dark:border-[#243656] text-[11px] text-[#64748B] dark:text-[#9AA6BA]">
                      <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">Provision</th>
                      <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">Statute</th>
                      <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">Subject</th>
                      <th className="py-2.5 px-3.5 font-semibold">Statutory Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E7EF] dark:divide-[#243656]">
                    {BNS_63_CROSS_REFERENCES.map((ref) => (
                      <tr key={`${ref.statute}-${ref.provision}`} className="align-top">
                        <td className="py-2.5 px-3.5 font-mono font-semibold text-[#101A30] dark:text-[#C5A66A] whitespace-nowrap">
                          {ref.provision}
                        </td>
                        <td className="py-2.5 px-3.5 text-[#475569] dark:text-[#9AA6BA] whitespace-nowrap">
                          {ref.statute}
                        </td>
                        <td className="py-2.5 px-3.5 font-medium text-[#17243B] dark:text-[#F4F5F7] whitespace-nowrap">
                          {ref.scope}
                        </td>
                        <td className="py-2.5 px-3.5 text-[11px] text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                          {ref.detail}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35] space-y-2.5">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-[#101A30] dark:text-[#C5A66A]" />
                <h3 className="text-xs font-semibold text-[#17243B] dark:text-[#F4F5F7]">
                  Digital &amp; Telecom Investigation Reference Notes (Informational Guidance)
                </h3>
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-[#8993A5]">
                Distinct from statutory provisions above: general documentation considerations when officers use TRACE INTEL analytical modules (CDR, IPDR, Tower Replay) in authorized investigations.
              </p>
              <ul className="space-y-1.5 list-disc pl-5 text-[11px] text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                {BNS_63_FORENSIC_REFERENCE_NOTES.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* TAB 4: AUTHORITATIVE SOURCES */}
        {activeTab === 'sources' && (
          <div className="space-y-3">
            <p className="text-[11px] text-[#64748B] dark:text-[#9AA6BA] leading-relaxed">
              Consult the official Government of India repositories below for the authoritative bare act text, Gazette notifications, and statutory amendments. TRACE INTEL is an independent analytical workspace and is not integrated with India Code or any court filing system.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {BNS_63_OFFICIAL_SOURCES.map((src) => (
                <a
                  key={src.url}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded border border-[#E2E7EF] dark:border-[#243656] bg-[#F8F8F6] dark:bg-[#131F35] hover:border-[#101A30] dark:hover:border-[#C5A66A] transition-colors flex flex-col justify-between gap-2 group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-[#17243B] dark:text-[#F4F5F7] group-hover:text-[#101A30] dark:group-hover:text-[#C5A66A]">
                        {src.label}
                      </p>
                      <ExternalLink className="w-3.5 h-3.5 text-[#8993A5] group-hover:text-[#101A30] dark:group-hover:text-[#C5A66A] shrink-0 mt-0.5" />
                    </div>
                    <p className="text-[11px] text-[#64748B] dark:text-[#8993A5] mt-0.5">
                      {src.authority}
                    </p>
                    <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1] mt-2 leading-relaxed">
                      {src.description}
                    </p>
                  </div>
                  <p className="text-[11px] font-mono text-[#2563EB] dark:text-[#C5A66A]">
                    {src.domain}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
