"use client";

import { useState, useMemo } from "react";
import { Search, BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface GlossaryEntry {
  term: string;
  acronym?: string;
  category: string;
  definition: string;
}

const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  // Procurement & Solicitation Types
  {
    term: "Request for Proposal",
    acronym: "RFP",
    category: "Solicitation",
    definition:
      "A formal solicitation document issued by the government requesting vendors to submit proposals for a specific requirement. Proposals are evaluated on technical approach, past performance, and price.",
  },
  {
    term: "Request for Quotation",
    acronym: "RFQ",
    category: "Solicitation",
    definition:
      "A solicitation used when the government intends to award based primarily on price. Typically used for commercial items or services where requirements are clearly defined.",
  },
  {
    term: "Request for Information",
    acronym: "RFI",
    category: "Solicitation",
    definition:
      "A pre-solicitation notice used by agencies to gather market intelligence. Not a commitment to procure, but responding can position you for the eventual solicitation.",
  },
  {
    term: "Sources Sought",
    category: "Solicitation",
    definition:
      "A notice published to determine if qualified businesses exist before issuing a formal solicitation. Helps the government decide on set-aside strategy and acquisition approach.",
  },
  {
    term: "Invitation for Bid",
    acronym: "IFB",
    category: "Solicitation",
    definition:
      "A sealed bid solicitation where award goes to the lowest priced, technically acceptable bidder. Used when requirements are clear and price is the primary evaluation factor.",
  },
  {
    term: "Broad Agency Announcement",
    acronym: "BAA",
    category: "Solicitation",
    definition:
      "A solicitation for basic and applied research proposals. Used by agencies like DARPA and DoD to fund innovative R&D. Proposals compete on scientific/technical merit.",
  },
  {
    term: "Task Order",
    acronym: "TO",
    category: "Solicitation",
    definition:
      "An order placed against an existing indefinite-delivery contract (IDIQ or BPA) for specific services or deliverables within the contract's scope.",
  },
  {
    term: "Delivery Order",
    acronym: "DO",
    category: "Solicitation",
    definition:
      "An order placed against an existing contract for supplies or materials. Similar to a task order but for tangible goods rather than services.",
  },

  // Contract Types
  {
    term: "Firm-Fixed-Price",
    acronym: "FFP",
    category: "Contract Type",
    definition:
      "A contract where the price is not subject to adjustment. The contractor bears full cost risk. Most common contract type for commercial services and well-defined requirements.",
  },
  {
    term: "Time and Materials",
    acronym: "T&M",
    category: "Contract Type",
    definition:
      "A contract providing for payment based on direct labor hours at specified rates plus actual cost of materials. Used when the scope of work is uncertain.",
  },
  {
    term: "Cost-Plus-Fixed-Fee",
    acronym: "CPFF",
    category: "Contract Type",
    definition:
      "A cost-reimbursement contract where the government pays all allowable costs plus a fixed fee (profit). The fee does not change based on actual costs.",
  },
  {
    term: "Cost-Plus-Incentive-Fee",
    acronym: "CPIF",
    category: "Contract Type",
    definition:
      "A cost-reimbursement contract with an incentive fee that adjusts based on actual costs vs. target costs. Encourages contractors to control costs.",
  },
  {
    term: "Cost-Plus-Award-Fee",
    acronym: "CPAF",
    category: "Contract Type",
    definition:
      "A cost-reimbursement contract where the contractor earns an award fee based on subjective evaluation of performance against criteria set in the contract.",
  },
  {
    term: "Indefinite Delivery/Indefinite Quantity",
    acronym: "IDIQ",
    category: "Contract Type",
    definition:
      "A contract providing for an indefinite quantity of supplies or services during a fixed period. Has minimum and maximum order quantities. Individual task/delivery orders are competed among awardees.",
  },
  {
    term: "Blanket Purchase Agreement",
    acronym: "BPA",
    category: "Contract Type",
    definition:
      "A simplified method of filling anticipated repetitive needs for supplies or services. Established with qualified vendors for recurring purchases below simplified acquisition threshold.",
  },
  {
    term: "Government-Wide Acquisition Contract",
    acronym: "GWAC",
    category: "Contract Type",
    definition:
      "A pre-competed, multiple-award IDIQ contract for IT solutions available to all federal agencies. Examples include Alliant 2, CIO-SP3, and VETS 2.",
  },
  {
    term: "Multiple Award Schedule",
    acronym: "MAS",
    category: "Contract Type",
    definition:
      "Formerly GSA Schedule, a long-term government-wide contract with commercial firms providing access to millions of commercial products and services at pre-negotiated prices.",
  },

  // Financial Terms
  {
    term: "Obligated Amount",
    category: "Financial",
    definition:
      "The amount of funds the government has legally committed (obligated) to pay for goods or services. Once obligated, funds are reserved and cannot be used for other purposes.",
  },
  {
    term: "Ceiling Price",
    category: "Financial",
    definition:
      "The maximum amount the government will pay under a contract. In T&M contracts, the ceiling cannot be exceeded without a modification. The contractor works at their own risk above the ceiling.",
  },
  {
    term: "Period of Performance",
    acronym: "PoP",
    category: "Financial",
    definition:
      "The timeframe during which the contractor must complete the work. Includes the base period and any option periods.",
  },
  {
    term: "Option Year",
    category: "Financial",
    definition:
      "An additional contract period beyond the base year that the government may exercise at its discretion. Common structure is 1 base year + 4 option years.",
  },
  {
    term: "Base Year",
    category: "Financial",
    definition:
      "The initial performance period of a contract, typically 12 months. Work during the base year establishes performance history that influences option year decisions.",
  },
  {
    term: "Simplified Acquisition Threshold",
    acronym: "SAT",
    category: "Financial",
    definition:
      "The dollar amount below which simplified acquisition procedures may be used. Currently set at $250,000. Procurements below this threshold have fewer requirements.",
  },
  {
    term: "Micro-Purchase Threshold",
    acronym: "MPT",
    category: "Financial",
    definition:
      "The dollar amount below which purchases can be made without competitive quotes. Currently $10,000 for most purchases. Government purchase card is commonly used.",
  },

  // Set-Aside & Small Business
  {
    term: "Set-Aside",
    category: "Small Business",
    definition:
      "A procurement restricted to a specific category of small businesses. The government reserves the contract for competition only among eligible businesses in that category.",
  },
  {
    term: "Small Business",
    acronym: "SB",
    category: "Small Business",
    definition:
      "A business meeting SBA size standards for its primary NAICS code, based on average annual revenue or number of employees. Eligible for set-aside contracts.",
  },
  {
    term: "8(a) Business Development Program",
    acronym: "8(a)",
    category: "Small Business",
    definition:
      "An SBA program for small, disadvantaged businesses. Participants can receive sole-source contracts up to $4.5M (services) or $7M (manufacturing) and compete in 8(a) set-asides.",
  },
  {
    term: "Historically Underutilized Business Zone",
    acronym: "HUBZone",
    category: "Small Business",
    definition:
      "A program for small businesses located in economically distressed areas. Provides a 10% price evaluation preference in full-and-open competitions and access to HUBZone set-asides.",
  },
  {
    term: "Service-Disabled Veteran-Owned Small Business",
    acronym: "SDVOSB",
    category: "Small Business",
    definition:
      "A small business owned and controlled by one or more service-disabled veterans. Eligible for SDVOSB set-aside contracts across all federal agencies.",
  },
  {
    term: "Women-Owned Small Business",
    acronym: "WOSB",
    category: "Small Business",
    definition:
      "A small business at least 51% owned and controlled by one or more women. WOSB set-asides are available in industries where women are underrepresented.",
  },
  {
    term: "Economically Disadvantaged Women-Owned Small Business",
    acronym: "EDWOSB",
    category: "Small Business",
    definition:
      "A WOSB where the women owners are economically disadvantaged (personal net worth under $750K). Eligible for additional set-aside categories beyond WOSB.",
  },
  {
    term: "Small Disadvantaged Business",
    acronym: "SDB",
    category: "Small Business",
    definition:
      "A small business that is at least 51% owned by one or more socially and economically disadvantaged individuals. Receives evaluation preferences in some competitions.",
  },
  {
    term: "Full and Open Competition",
    category: "Small Business",
    definition:
      "A procurement open to all responsible sources, not restricted by set-asides. Any business, regardless of size, can compete for the contract.",
  },
  {
    term: "Mentor-Protege Program",
    category: "Small Business",
    definition:
      "An SBA program allowing established firms (mentors) to partner with small businesses (proteges). The joint venture can compete as a small business and the protege gains experience.",
  },
  {
    term: "Joint Venture",
    acronym: "JV",
    category: "Small Business",
    definition:
      "A business arrangement where two or more companies combine resources to pursue a specific contract. Under SBA rules, a small business JV partner must perform a significant portion of the work.",
  },

  // Codes & Classification
  {
    term: "North American Industry Classification System",
    acronym: "NAICS",
    category: "Classification",
    definition:
      "A 6-digit code classifying businesses by industry type. Each solicitation assigns a NAICS code that determines the small business size standard for that procurement.",
  },
  {
    term: "Product and Service Code",
    acronym: "PSC",
    category: "Classification",
    definition:
      "A 4-character code describing the type of product or service being procured. Used for tracking and reporting federal spending by category.",
  },
  {
    term: "Federal Supply Classification",
    acronym: "FSC",
    category: "Classification",
    definition:
      "A 4-digit code used to classify products purchased by the federal government. Part of the broader Federal Cataloging System.",
  },
  {
    term: "Unique Entity Identifier",
    acronym: "UEI",
    category: "Classification",
    definition:
      "A 12-character alphanumeric ID assigned by SAM.gov to each registered entity. Replaced the DUNS number as the primary entity identifier for federal procurement.",
  },
  {
    term: "DUNS Number",
    category: "Classification",
    definition:
      "Formerly the primary business identifier for federal procurement (Data Universal Numbering System). Replaced by UEI in April 2022 but still referenced in older records.",
  },
  {
    term: "Commercial and Government Entity Code",
    acronym: "CAGE Code",
    category: "Classification",
    definition:
      "A 5-character code assigned to entities doing business with the federal government. Required for registration in SAM.gov and used in defense procurement.",
  },

  // SAM.gov & Registration
  {
    term: "System for Award Management",
    acronym: "SAM.gov",
    category: "Registration",
    definition:
      "The official government system where businesses register to do business with the federal government, search for contract opportunities, and access award data. Registration must be renewed annually.",
  },
  {
    term: "Entity Registration",
    category: "Registration",
    definition:
      "The process of registering a business in SAM.gov. Required before a company can receive federal contracts, grants, or other awards. Takes 7-10 business days to process.",
  },
  {
    term: "Representations and Certifications",
    acronym: "Reps & Certs",
    category: "Registration",
    definition:
      "Self-certifications made during SAM.gov registration about business size, ownership, and compliance with various federal regulations. Must be updated annually.",
  },
  {
    term: "Federal Procurement Data System",
    acronym: "FPDS",
    category: "Registration",
    definition:
      "The central repository of federal contracting data. Contains detailed information on contract actions over $10,000. Used for market research and competitive intelligence.",
  },
  {
    term: "USASpending",
    category: "Registration",
    definition:
      "The official source for spending data on federal awards including contracts, grants, and loans. Provides transparency into how federal money is spent.",
  },

  // Evaluation & Award
  {
    term: "Best Value",
    category: "Evaluation",
    definition:
      "An evaluation approach where the government considers factors in addition to price (technical capability, past performance, etc.) to determine which proposal offers the best overall value.",
  },
  {
    term: "Lowest Price Technically Acceptable",
    acronym: "LPTA",
    category: "Evaluation",
    definition:
      "An evaluation method where proposals are rated as either acceptable or unacceptable technically, and award goes to the lowest-priced acceptable offer. No technical tradeoffs.",
  },
  {
    term: "Past Performance",
    category: "Evaluation",
    definition:
      "A contractor's record of prior work quality, timeliness, and customer satisfaction. One of the most important evaluation factors in government source selections.",
  },
  {
    term: "Contractor Performance Assessment Reporting System",
    acronym: "CPARS",
    category: "Evaluation",
    definition:
      "The government system for documenting contractor performance evaluations. Past performance ratings in CPARS directly impact a contractor's ability to win future work.",
  },
  {
    term: "Technical Evaluation",
    category: "Evaluation",
    definition:
      "The process by which the government assesses proposals against technical evaluation criteria defined in the solicitation. May include oral presentations and demonstrations.",
  },
  {
    term: "Source Selection",
    category: "Evaluation",
    definition:
      "The formal process by which the government evaluates proposals and selects a contractor for award. Governed by the evaluation criteria stated in the solicitation.",
  },
  {
    term: "Protest",
    category: "Evaluation",
    definition:
      "A formal challenge to a contract award or solicitation filed with the GAO, Court of Federal Claims, or the agency. Must be filed within specific timeframes.",
  },
  {
    term: "Debriefing",
    category: "Evaluation",
    definition:
      "A post-award meeting where the government provides feedback to unsuccessful offerors about their proposal's strengths and weaknesses relative to the evaluation criteria.",
  },

  // Compliance & Regulations
  {
    term: "Federal Acquisition Regulation",
    acronym: "FAR",
    category: "Regulation",
    definition:
      "The primary set of rules governing the federal acquisition process. Contains policies and procedures for all executive agency procurements. Organized in 53 parts.",
  },
  {
    term: "Defense Federal Acquisition Regulation Supplement",
    acronym: "DFARS",
    category: "Regulation",
    definition:
      "Supplemental acquisition regulations specific to the Department of Defense. Adds defense-specific requirements on top of the FAR, including cybersecurity (CMMC).",
  },
  {
    term: "Cybersecurity Maturity Model Certification",
    acronym: "CMMC",
    category: "Regulation",
    definition:
      "A DoD framework requiring defense contractors to meet specific cybersecurity standards. Required for contracts involving Controlled Unclassified Information (CUI).",
  },
  {
    term: "Controlled Unclassified Information",
    acronym: "CUI",
    category: "Regulation",
    definition:
      "Government-created or -owned information that requires safeguarding but is not classified. Contractors handling CUI must meet NIST 800-171 security requirements.",
  },
  {
    term: "Organizational Conflict of Interest",
    acronym: "OCI",
    category: "Regulation",
    definition:
      "A situation where a contractor's existing relationships or access to information could give them an unfair competitive advantage or impair their objectivity.",
  },
  {
    term: "Contracting Officer",
    acronym: "CO",
    category: "Regulation",
    definition:
      "The government official with authority to enter into, administer, and terminate contracts. The only person who can legally bind the government to a contract.",
  },
  {
    term: "Contracting Officer's Representative",
    acronym: "COR",
    category: "Regulation",
    definition:
      "A government employee designated by the CO to monitor contractor performance and provide technical direction. Cannot make contractual changes or obligate funds.",
  },
  {
    term: "Statement of Work",
    acronym: "SOW",
    category: "Regulation",
    definition:
      "A document describing the specific tasks, deliverables, and timelines a contractor must perform. Prescribes how the work should be done.",
  },
  {
    term: "Performance Work Statement",
    acronym: "PWS",
    category: "Regulation",
    definition:
      "A results-oriented work statement describing the desired outcomes rather than how to achieve them. Gives the contractor more flexibility in approach.",
  },
  {
    term: "Statement of Objectives",
    acronym: "SOO",
    category: "Regulation",
    definition:
      "A high-level document describing the overall objectives the government wants to achieve. The contractor proposes the approach in their technical volume.",
  },
  {
    term: "Contract Line Item Number",
    acronym: "CLIN",
    category: "Regulation",
    definition:
      "A specific line item in a contract that identifies the supplies or services being procured, along with quantity and price. Used for invoicing and tracking.",
  },

  // Proposal & Capture
  {
    term: "Capture Management",
    category: "Proposal",
    definition:
      "The strategic process of identifying, qualifying, and winning government contracts. Begins well before the solicitation is released and includes customer engagement and teaming.",
  },
  {
    term: "Teaming Agreement",
    category: "Proposal",
    definition:
      "A formal agreement between a prime contractor and subcontractors to pursue a specific opportunity together. Defines roles, responsibilities, and work share.",
  },
  {
    term: "Prime Contractor",
    category: "Proposal",
    definition:
      "The company that holds the direct contract with the government and is responsible for all contract performance, including work performed by subcontractors.",
  },
  {
    term: "Subcontractor",
    acronym: "Sub",
    category: "Proposal",
    definition:
      "A company that performs work under an agreement with the prime contractor rather than directly with the government. A common path for smaller companies entering federal contracting.",
  },
  {
    term: "Technical Volume",
    category: "Proposal",
    definition:
      "The section of a proposal describing the contractor's approach, methodology, staffing, and management plan. Evaluated against technical criteria in the solicitation.",
  },
  {
    term: "Price Volume",
    category: "Proposal",
    definition:
      "The section of a proposal containing the cost/price breakdown. Must align with the technical approach and demonstrate fair and reasonable pricing.",
  },
  {
    term: "Past Performance Volume",
    category: "Proposal",
    definition:
      "The section of a proposal documenting relevant prior contracts that demonstrate the offeror's ability to perform similar work successfully.",
  },
  {
    term: "Oral Presentation",
    category: "Proposal",
    definition:
      "A live presentation to the evaluation panel as part of the proposal process. Increasingly used instead of or in addition to written technical volumes.",
  },
  {
    term: "Letter of Intent",
    acronym: "LOI",
    category: "Proposal",
    definition:
      "A document from a teaming partner or key personnel expressing commitment to participate on the contract if awarded. Often required as part of the proposal.",
  },

  // Vehicles & Programs
  {
    term: "General Services Administration",
    acronym: "GSA",
    category: "Vehicles",
    definition:
      "The federal agency that manages government property and procurement. Operates GSA Schedules (MAS) and GWACs that streamline the buying process for all agencies.",
  },
  {
    term: "Small Business Administration",
    acronym: "SBA",
    category: "Vehicles",
    definition:
      "The federal agency responsible for supporting small businesses. Manages the 8(a), HUBZone, WOSB, and Mentor-Protege programs, and sets small business size standards.",
  },
  {
    term: "Government Accountability Office",
    acronym: "GAO",
    category: "Vehicles",
    definition:
      "The congressional watchdog agency that reviews bid protests and audits government spending. GAO protest decisions are binding on agencies.",
  },
  {
    term: "Defense Information Systems Agency",
    acronym: "DISA",
    category: "Vehicles",
    definition:
      "A DoD agency providing IT and communications support. Manages large IT contracts and the DoD Information Network (DoDIN).",
  },
  {
    term: "Other Transaction Authority",
    acronym: "OTA",
    category: "Vehicles",
    definition:
      "A flexible contracting mechanism outside the FAR used primarily by DoD for research, prototyping, and production. Allows faster procurement with fewer regulations.",
  },
  {
    term: "Small Business Innovation Research",
    acronym: "SBIR",
    category: "Vehicles",
    definition:
      "A competitive program encouraging small businesses to engage in federal R&D with commercialization potential. Three phases: feasibility, development, and commercialization.",
  },
  {
    term: "Small Business Technology Transfer",
    acronym: "STTR",
    category: "Vehicles",
    definition:
      "Similar to SBIR but requires formal collaboration with a research institution. Designed to bridge the gap between basic science and commercialization.",
  },

  // Award & Performance
  {
    term: "Notice of Award",
    category: "Award",
    definition:
      "The official notification that a contract has been awarded. Triggers the protest window for unsuccessful offerors and begins the period of performance.",
  },
  {
    term: "Notice to Proceed",
    acronym: "NTP",
    category: "Award",
    definition:
      "Formal authorization from the contracting officer for the contractor to begin work. Work performed before NTP may not be reimbursable.",
  },
  {
    term: "Contract Modification",
    acronym: "Mod",
    category: "Award",
    definition:
      "A written change to the terms of an existing contract. Can modify scope, price, schedule, or other provisions. Must be signed by the contracting officer.",
  },
  {
    term: "Key Personnel",
    category: "Award",
    definition:
      "Individuals identified in the contract whose qualifications were evaluated during source selection. Replacing key personnel typically requires government approval.",
  },
  {
    term: "Quality Assurance Surveillance Plan",
    acronym: "QASP",
    category: "Award",
    definition:
      "A government document defining how contractor performance will be monitored and evaluated. Specifies performance standards, surveillance methods, and acceptable quality levels.",
  },
  {
    term: "Transition Plan",
    category: "Award",
    definition:
      "A plan for transferring work from an incumbent contractor to a new awardee (transition-in) or from the current contract to the follow-on (transition-out).",
  },
  {
    term: "Incumbent",
    category: "Award",
    definition:
      "The contractor currently performing the work on an existing contract. Incumbents often have an advantage in recompetes due to institutional knowledge.",
  },
  {
    term: "Recompete",
    category: "Award",
    definition:
      "A new solicitation for work that is currently being performed under an existing contract nearing expiration. The incumbent must compete again for the follow-on.",
  },

  // General
  {
    term: "Place of Performance",
    category: "General",
    definition:
      "The physical location where contract work is performed. May be government site, contractor site, or a combination. Affects pricing and staffing.",
  },
  {
    term: "Wage Determination",
    category: "General",
    definition:
      "The Department of Labor's prescribed minimum wages and fringe benefits for specific labor categories in a geographic area under the Service Contract Act.",
  },
  {
    term: "Service Contract Act",
    acronym: "SCA",
    category: "General",
    definition:
      "A federal law requiring contractors to pay service employees at least the prevailing wage rates and fringe benefits for the locality where services are performed.",
  },
  {
    term: "Responsibility Determination",
    category: "General",
    definition:
      "The CO's assessment of whether a prospective contractor has the financial resources, technical capability, performance record, and integrity to perform the contract.",
  },
  {
    term: "Sole Source",
    category: "General",
    definition:
      "A non-competitive procurement where only one contractor is solicited. Requires justification that competition is not feasible. Common in 8(a) program for contracts under threshold.",
  },
  {
    term: "Market Research",
    category: "General",
    definition:
      "The process of collecting information about capabilities in the market to determine the best approach for an acquisition. Includes reviewing SAM.gov, FPDS, and industry engagement.",
  },
  {
    term: "Pre-Proposal Conference",
    category: "General",
    definition:
      "A meeting held by the government after solicitation release to clarify requirements and answer questions from potential offerors. Attendance may or may not be mandatory.",
  },
  {
    term: "Compliance Matrix",
    category: "General",
    definition:
      "A document mapping each solicitation requirement to the specific section of the proposal that addresses it. Ensures no requirements are missed in the response.",
  },
];

const CATEGORIES = [
  "All",
  "Solicitation",
  "Contract Type",
  "Financial",
  "Small Business",
  "Classification",
  "Registration",
  "Evaluation",
  "Regulation",
  "Proposal",
  "Vehicles",
  "Award",
  "General",
];

interface GlossaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlossaryModal({ isOpen, onClose }: GlossaryModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredEntries = useMemo(() => {
    let entries = GLOSSARY_ENTRIES;

    if (selectedCategory !== "All") {
      entries = entries.filter((e) => e.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.term.toLowerCase().includes(q) ||
          e.acronym?.toLowerCase().includes(q) ||
          e.definition.toLowerCase().includes(q)
      );
    }

    return entries.sort((a, b) => a.term.localeCompare(b.term));
  }, [searchQuery, selectedCategory]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setSearchQuery("");
      setSelectedCategory("All");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-5" />
            Government Contracting Glossary
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 border-b border-border px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
            <Input
              placeholder="Search terms, acronyms, or definitions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedCategory === category
                    ? "bg-text text-background"
                    : "bg-background-secondary text-text-secondary hover:text-text"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          <div className="flex flex-col gap-1">
            {filteredEntries.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-secondary">
                No matching terms found
              </p>
            ) : (
              <>
                <p className="pb-2 text-xs text-text-secondary">
                  {filteredEntries.length} term{filteredEntries.length !== 1 && "s"}
                </p>
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.term}
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-text">
                        {entry.term}
                      </h3>
                      {entry.acronym && (
                        <Badge variant="secondary">{entry.acronym}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {entry.category}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                      {entry.definition}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
