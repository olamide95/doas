/* ==================================================================
   DOAS — website content
   Single source of truth for every public fact on the landing page,
   the chat assistant and the notify dialog. Update a phone number,
   a notice or a service here and it changes everywhere.

   Source: DOAS Website Content and Developer Brief (content cut-off
   2 October 2026). Items marked "CONFIRM" need DOAS sign-off before
   launch, per the brief's confirmation register.
   ================================================================== */

import {
  Archive,
  BadgeCheck,
  Briefcase,
  Building2,
  ClipboardCheck,
  Database,
  Eye,
  FileCheck,
  HardHat,
  Inbox,
  Landmark,
  Lightbulb,
  Megaphone,
  RadioTower,
  Receipt,
  Ruler,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Store,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react"

/* ------------------------------------------------------------------ */
/* Contact                                                             */
/* ------------------------------------------------------------------ */

export const CONTACT = {
  addressLines: ["Abuja Enterprise Agency Building", "Adjacent BON Octagon Hotel", "Wole Soyinka Way, Jahi, Abuja"],
  addressOneLine: "Abuja Enterprise Agency Building, adjacent BON Octagon Hotel, Wole Soyinka Way, Jahi, Abuja",
  addressShort: "Wole Soyinka Way, Jahi, Abuja",
  landmark: "Adjacent BON Octagon Hotel",
  phones: [
    { display: "0816 916 2144", tel: "+2348169162144" },
    { display: "0209 291 9181", tel: "+2342092919181" },
  ],
  email: "service@doas.abj.gov.ng",
  hours: "Monday – Friday, 8:00am – 4:00pm",
  hoursShort: "Mon – Fri · 8:00am – 4:00pm",
  mapsQuery: "Abuja Enterprise Agency, Wole Soyinka Way, Jahi, Abuja",
} as const

export const PHONE_LINE = CONTACT.phones.map((p) => p.display).join(" · ")

export const COUNCILS = ["Abuja Municipal", "Abaji", "Bwari", "Gwagwalada", "Kuje", "Kwali"]

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

export const ABOUT = {
  lead:
    "The Department of Outdoor Advertisement and Signage (DOAS) is the department of the Federal Capital Territory Administration responsible for the control and regulation of Out-Of-Home advertising and signage in the FCT.",
  body: [
    "The Department works to standardise advertising practice, protect public safety, preserve environmental aesthetics and improve regulatory service delivery and internally generated revenue.",
    "DOAS engages outdoor advertising practitioners, property owners, first-party compliance facilitators and other stakeholders through applications, approvals, technical assessment, monitoring, records management, billing support and enforcement. Its reform programme places emphasis on professional conduct, transparent records, lawful processes and the use of technology.",
  ],
}

export const MANDATE = [
  "Regulate the siting, development, presentation and maintenance of OOH advertising and signage structures.",
  "Assess applications and approvals against applicable planning, structural, spacing, safety and environmental requirements.",
  "Maintain records of practitioners, approvals, sites and structures, and support accurate billing and revenue reconciliation.",
  "Monitor compliance, investigate reported violations and undertake authorised enforcement.",
  "Engage practitioners and stakeholders on standards, compliance, safety and service delivery.",
]

export const VISION =
  "To achieve a centralized system of control and regulation of outdoor advertisement and signage in line with global best practices, with emphasis on an aesthetically pleasing, eco-friendly environment and enhanced Internally Generated Revenue (IGR)."

export const MISSION =
  "To strategically standardize the practice and business of outdoor advertisement and signage through innovation and technology to ensure efficiency and optimal benefit to all stakeholders."

// CONFIRM: value explanations are proposed copy in the brief.
export const VALUES: { name: string; body: string; icon: LucideIcon }[] = [
  { name: "Professionalism", body: "Deliver services with competence, respect and adherence to approved standards.", icon: BadgeCheck },
  { name: "Fairness", body: "Apply requirements consistently and handle applications and complaints impartially.", icon: Scale },
  { name: "Safety", body: "Protect workers, road users and the public throughout the life of an advertising structure.", icon: HardHat },
  { name: "Accountability", body: "Maintain traceable decisions, records and transactions and accept responsibility for official actions.", icon: ClipboardCheck },
  { name: "Public Interest", body: "Preserve public access, environmental quality and the wider interests of the FCT.", icon: Landmark },
]

/* ------------------------------------------------------------------ */
/* Director                                                            */
/* ------------------------------------------------------------------ */

export const DIRECTOR = {
  name: "",
  title: "",
  since: "",
  portrait: "/photos/director.jpg", // CONFIRM: official photograph required
  // CONFIRM: draft welcome message for the Director's review.
  welcome:
    "Welcome to the Department of Outdoor Advertisement and Signage. Our commitment is to a safe, orderly and aesthetically pleasing outdoor advertising environment in the Federal Capital Territory. We work with practitioners and stakeholders to uphold approved standards, protect the public and improve the quality of our services.",
   profile:
    "Azaki Sunday Kachiwoyi, PhD, is the Overseeing Director of the Department of Outdoor Advertisement and Signage, Federal Capital Territory Administration. He assumed office on 31 August 2026. The direction communicated under his leadership emphasises professional service, standardisation, public safety, environmental aesthetics, accountability and the digitisation of DOAS processes.",
  priorities: [
    "Standardised practice and technical controls",
    "Professional service, integrity and fairness",
    "Digitised applications, records and approvals",
    "Environmental protection and safe operations",
    "Stakeholder cooperation for compliant businesses",
  ],
}

/* ------------------------------------------------------------------ */
/* Notices                                                             */
/* Times are West Africa Time (Africa/Lagos, UTC+01:00).               */
/* A notice with `closes` moves to the archive automatically after the */
/* deadline; standing orders stay in force until changed here.         */
/* ------------------------------------------------------------------ */

export type Tone = "clear" | "wait" | "stop" | "move" | "idle"

export type Notice = {
  id: string
  category: string
  title: string
  source: string
  summary: string
  points: string[]
  /** ISO timestamps with +01:00 offset, for time-boxed exercises */
  opens?: string
  closes?: string
  window?: string
  /** standing orders: shown as "In force" with this tone */
  tone?: Tone
  link?: { label: string; href: string }
}

export const NOTICES: Notice[] = [
  {
    id: "stop-work",
    category: "Order",
    title: "Temporary stop-work order on new billboard construction",
    source: "In force · confirmed by the Stakeholders' Communiqué of 17 Sep 2026",
    summary:
      "New billboard construction, excavation, foundation work and erection are suspended until further official direction. No practitioner may commence or continue structural work without express written clearance from DOAS.",
    points: [
      "Flex replacement on existing structures and critical maintenance to prevent an immediate safety hazard remain subject to DOAS requirements.",
      "Exemptions are written, site-specific and conditional. A request for remedial or construction works is not permission to proceed.",
      "Violations may attract site or licence revocation and prosecution.",
    ],
    tone: "stop",
  },
  {
    id: "new-site-payment",
    category: "Payment",
    title: "Do not pay for newly approved billboard sites",
    source: "In force · until further notice",
    summary:
      "Practitioners are instructed not to pay for newly approved billboard sites until further notice. Approved bills and liabilities for existing or old structures remain unaffected.",
    points: [],
    tone: "wait",
  },
  {
    id: "certification-fee",
    category: "Circular",
    title: "Practitioner revalidation certification fee",
    source: "Circular dated 29 Sep 2026",
    summary:
      "₦1,000,000 per successful practitioner. Payment follows publication of the successful list and individual written notification by DOAS — it is not payable when documents are submitted.",
    points: [
      "Pay through Remita only, using DOAS-approved billing details.",
      "Submit evidence of payment for verification before the revalidated licence is issued.",
    ],
    tone: "move",
  },
  {
    id: "spacing",
    category: "Standard",
    title: "Billboard spacing and siting standards",
    source: "Adopted September 2026 · Stakeholders' Communiqué, 17 Sep 2026",
    summary:
      "Minimum board-to-board spacing for every new structure, a limit of two alternating billboards at junctions, and protection of walkways, trees and flower beds.",
    points: [],
    tone: "move",
    link: { label: "See the standards", href: "#standards" },
  },
  {
    id: "removal",
    category: "Directive",
    title: "Removal: high-tension lines, bus stops, walkways and setbacks",
    source: "21 days from the date of the official notice served",
    summary:
      "Billboards beneath high-tension electricity lines, and structures at bus stops, on walkways or in violation of roadside setbacks, must be removed within 21 days of the applicable official notice. Structures on flower beds must be relocated as directed.",
    points: [],
    tone: "stop",
  },
  {
    id: "integrity",
    category: "Integrity",
    title: "No inducement, no site trading, no conflicting allocations",
    source: "Stakeholders' Communiqué, 17 Sep 2026",
    summary:
      "Inducement of staff, unauthorised site trading and conflicting allocations are prohibited. Deal only with the Customer Service Unit — not individual officers or informal intermediaries.",
    points: [],
    tone: "wait",
    link: { label: "Report an improper demand", href: "#contact" },
  },
  {
    id: "site-revalidation",
    category: "Exercise",
    title: "Site approval revalidation exercise",
    source: "Approvals issued January 2025 – August 2026",
    summary:
      "Holders of site approvals issued from January 2025 to August 2026 submit the complete relevant approval documents through the Customer Service Unit. One site per submission form.",
    points: ["Non-submission attracts regulatory action, including loss of the affected site or approval."],
    opens: "2026-09-21T08:00:00+01:00",
    closes: "2026-10-05T16:00:00+01:00",
    window: "21 Sep – 5 Oct 2026, 4:00pm",
  },
  {
    id: "practitioner-revalidation",
    category: "Exercise",
    title: "Practitioner revalidation exercise",
    source: "All outdoor advertising practitioners in the FCT",
    summary:
      "Every outdoor advertising practitioner in the FCT is required to participate and submit the approved documents through the Customer Service Unit.",
    points: [],
    opens: "2026-09-29T08:00:00+01:00",
    closes: "2026-10-09T23:59:00+01:00", // CONFIRM: final issued deadline notice
    window: "29 Sep – 9 Oct 2026",
  },
]

/** The gold strip under the hero — short lines people remember, not notices. */
export const TAGLINES = [
  "Zero tolerance for illegal billboards",
  "Permit first, installation second",
  "Unapproved signs will be decommissioned",
  "Compliance keeps your brand safe",
  "Register your business signage today",
  "Enforcing standards across the FCT",
]


// CONFIRM: set `href` once the signed PDF is uploaded to /public/downloads.
export const DOWNLOADS: { title: string; note: string; href?: string }[] = [
  { title: "Practitioner revalidation certification fee", note: "Circular · 29 Sep 2026" },
  { title: "Stakeholders' Communiqué & billboard standards", note: "17 Sep 2026" },
  { title: "Site & Billboard Approval Revalidation Form", note: "One site per form" },
  { title: "CSU Document Collection & Acknowledgment Form", note: "With applicant copy" },
  { title: "Practitioner revalidation checklist", note: "Submission documents" },
  { title: "HSE & PPE policy", note: "Signed current version" },
]

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */

export type NotifyIntent =
  | "practitioner"
  | "revalidation"
  | "site"
  | "first-party"
  | "telecom"
  | "billing"
  | "report"
  | "meeting"
  | "status"
  | "general"

export type Audience = "practitioners" | "sites" | "businesses" | "support"

export const AUDIENCES: { id: Audience; label: string; blurb: string }[] = [
  { id: "practitioners", label: "Practitioners", blurb: "Licensing and revalidation for outdoor advertising companies." },
  { id: "sites", label: "Sites & structures", blurb: "Approvals, certificates and permits for billboard sites." },
  { id: "businesses", label: "Businesses & telecom", blurb: "Signs on your own premises, and telecom sites." },
  { id: "support", label: "Billing & complaints", blurb: "Payments, reconciliation and reporting a problem." },
]

export type Service = {
  audience: Audience
  icon: LucideIcon
  title: string
  body: string
  points: string[]
  unit: string
  status: { tone: Tone; label: string }
  cta: string
  intent: NotifyIntent
}

export const SERVICES: Service[] = [
  {
    audience: "practitioners",
    icon: Briefcase,
    title: "Practitioner registration & licence",
    body: "For outdoor advertising companies entering the FCT market. New entrants provide a financial-capacity bond and professional association support or credentials, as set out in the approved eligibility checklist.",
    points: ["Bond is separate from any certification fee", "Checklist issued at the Customer Service Unit"],
    unit: "Customer Service Unit",
    status: { tone: "idle", label: "Enquire at CSU" },
    cta: "Get the eligibility checklist",
    intent: "practitioner",
  },
  {
    audience: "practitioners",
    icon: BadgeCheck,
    title: "Practitioner revalidation & certification",
    body: "All practitioners in the FCT take part in revalidation. Successful practitioners are notified in writing and pay the ₦1,000,000 certification fee through Remita before the revalidated licence is issued.",
    points: ["Fee is not payable at document submission", "Payment evidence is verified by Accounts"],
    unit: "CSU · Accounts",
    status: { tone: "wait", label: "Fee after written notice" },
    cta: "Notify me about my licence",
    intent: "revalidation",
  },
  {
    audience: "sites",
    icon: Building2,
    title: "Billboard site applications & approval revalidation",
    body: "Apply for a billboard site, or revalidate an approval. Each submission covers one site only. For a board in front of or around private property, obtain the owner's consent letter before you apply.",
    points: ["Payment on newly approved sites is suspended", "Complete approval documents required"],
    unit: "CSU · Planning, Design & Beautification",
    status: { tone: "wait", label: "New-site payment on hold" },
    cta: "Notify me when filing opens",
    intent: "site",
  },
  {
    audience: "sites",
    icon: Ruler,
    title: "Site assessment & Site Build Permit",
    body: "A Site Assessment Certificate precedes a Site Build Permit. Assessment checks the site against planning, structural, spacing, safety and environmental requirements.",
    points: ["Spacing minimums apply to every new structure", "New construction is currently suspended"],
    unit: "Planning, Design & Beautification",
    status: { tone: "stop", label: "Stop-work order in force" },
    cta: "Notify me when it resumes",
    intent: "site",
  },
  {
    audience: "sites",
    icon: FileCheck,
    title: "Setting Out Certificate",
    body: "Required before any new construction or maintenance on a site, together with every other applicable written approval.",
    points: ["Issued per site", "Coordinated with siting and spacing checks"],
    unit: "Planning, Design & Beautification",
    status: { tone: "wait", label: "Required before works" },
    cta: "Ask about a certificate",
    intent: "site",
  },
  {
    audience: "sites",
    icon: Wrench,
    title: "Maintenance, flex replacement & exemptions",
    body: "Flex replacement and critical safety maintenance on existing structures remain subject to DOAS requirements. Any other work needs a written, site-specific exemption before it starts.",
    points: ["An exemption request is not permission", "Work only within the written conditions"],
    unit: "Office of the Overseeing Director",
    status: { tone: "wait", label: "Written exemption required" },
    cta: "Request exemption guidance",
    intent: "site",
  },
  {
    audience: "sites",
    icon: Lightbulb,
    title: "Temporary lamppost allocations",
    body: "Time-bound allocations on lampposts, issued for a fixed term with site-specific conditions attached to each allocation.",
    points: ["Fixed term per allocation", "Conditions vary by site"],
    unit: "Customer Service Unit",
    status: { tone: "idle", label: "Term & conditions apply" },
    cta: "Ask about allocations",
    intent: "site",
  },
  {
    audience: "businesses",
    icon: Store,
    title: "First-party signage compliance",
    body: "For signs on your own business premises — shops, offices, banks, hotels and filling stations. Businesses and first-party compliance facilitators confirm requirements and regularise signage through the Customer Service Unit.",
    points: ["Deal only with CSU or an approved facilitator", "Pay only against an official bill"],
    unit: "CSU · Business Development",
    status: { tone: "clear", label: "Open at CSU" },
    cta: "Get first-party requirements",
    intent: "first-party",
  },
  {
    audience: "businesses",
    icon: RadioTower,
    title: "Telecom site documentation",
    body: "Documentation, inventory and administrative requirements for telecom sites, handled by the Telecom Team within its approved remit.",
    points: ["Site documentation and compliance follow-up", "Applicable administrative requirements"],
    unit: "Telecom Team",
    status: { tone: "clear", label: "Open at CSU" },
    cta: "Get telecom requirements",
    intent: "telecom",
  },
  {
    audience: "support",
    icon: Receipt,
    title: "Billing enquiries, payment verification & reconciliation",
    body: "Query a bill, verify a payment or reconcile outstanding bills on old structures. Bring the bill number, site reference, the amount in question and your supporting evidence.",
    points: ["A payment receipt does not replace an approval", "Individual records stay private"],
    unit: "Accounts",
    status: { tone: "clear", label: "Open" },
    cta: "Raise a billing enquiry",
    intent: "billing",
  },
  {
    audience: "support",
    icon: ShieldAlert,
    title: "Safety complaints & compliance enquiries",
    body: "Report an unsafe structure, suspected illegal work, a disputed allocation or an improper demand by anyone claiming to act for DOAS.",
    points: ["Give the exact location and a photograph", "Reports are routed for inspection"],
    unit: "Monitoring, Evaluation & Enforcement",
    status: { tone: "clear", label: "Open" },
    cta: "Report a structure",
    intent: "report",
  },
]

/* ------------------------------------------------------------------ */
/* How an application moves                                            */
/* ------------------------------------------------------------------ */

export const PROCESS = [
  { desk: "Applicant", step: "Read notices, choose a service", note: "Check what is in force — some services are restricted while the stop-work order applies." },
  { desk: "Customer Service Unit", step: "Submit & get acknowledged", note: "CSU receives your documents, issues an acknowledgement copy with a reference and routes the file." },
  { desk: "Technical divisions", step: "Review recorded", note: "Planning, spacing, safety and environmental checks are carried out and written to the file." },
  { desk: "Overseeing Director", step: "Authorised decision", note: "The decision is taken by the authorised office and recorded against your reference." },
  { desk: "Accounts", step: "Payment verified", note: "Where payment applies, it is made against an official bill at the permitted stage and verified." },
  { desk: "RSDM", step: "Record & outcome", note: "The approved record is kept and you receive the official outcome with any conditions." },
]

export const GUARDRAILS = [
  { t: "Four separate statuses", d: "Submission, acknowledgement, payment and approval are distinct, and each is recorded on its own." },
  { t: "A receipt is not an approval", d: "Paying a bill never replaces a regulatory approval. Keep both documents." },
  { t: "No work before written approval", d: "Submitting an application does not authorise site occupation, excavation, construction or erection." },
]

export const CHECKLIST = [
  { t: "Company details", d: "The practitioner's registered company name and a phone number and email CSU can reach." },
  { t: "Exact site location", d: "Street, landmark and Area Council — enough to identify the site without doubt." },
  { t: "Board type and size", d: "Unipole, gantry, 48 sheet, portrait or other type, with its dimensions." },
  { t: "Site status & approvals", d: "Whether the site is new or existing, with the complete relevant approval documents." },
  { t: "Property owner's consent", d: "A valid consent letter where the board is in front of or around private property." },
  { t: "Payment evidence", d: "Receipts or payment status where applicable — always against an official DOAS bill." },
]

/* ------------------------------------------------------------------ */
/* Safety & standards                                                  */
/* ------------------------------------------------------------------ */

export const SPACING: { type: string; m: number; note?: string }[] = [
  { type: "Gantry", m: 1000 },
  { type: "Eye Catcher", m: 1000 },
  { type: "Flag Pole", m: 1000 },
  { type: "Large Format", m: 500 },
  { type: "Unipole", m: 500 },
  { type: "96 Sheet", m: 400 },
  { type: "Portrait", m: 400 },
  { type: "Light Box & 48 Sheet", m: 200 },
  { type: "Existing Portrait", m: 200, note: "Only where expressly permitted" },
]

export const SITING_RULES = [
  "A maximum of two alternating billboards at any junction or intersection.",
  "No billboard beneath high-tension electricity lines or in a high-tension corridor.",
  "Structures on flower beds are relocated as directed.",
  "Keep walkways, bus stops, roadside setbacks and street furniture clear.",
  "Obtain adjacent property consent before an applicable application.",
]

export const ENVIRONMENT_RULES = [
  "Do not cut, trim, damage or fell trees for visibility without DOAS written clearance. Parks and Recreation approval alone is not enough.",
  "Keep every board neatly flexed or covered with approved material — including between paid campaigns.",
  "Naked, torn, untidy or exposed skeleton boards are prohibited.",
]

export const SAFETY_RULES = [
  "Use appropriate PPE and follow the approved HSE procedure for the activity.",
  "Secure the work area and protect pedestrians, workers and road users.",
  "Hold every required certificate, approval or written exemption before work starts.",
  "Keep structures and display materials in safe condition.",
  "Brief employees, installers and contractors on the safety requirements.",
]

/* ------------------------------------------------------------------ */
/* Divisions & units — CONFIRM approved organogram before launch       */
/* ------------------------------------------------------------------ */

export const DIVISIONS: { name: string; short?: string; body: string; icon: LucideIcon }[] = [
  { name: "Office of the Overseeing Director", body: "Leadership, policy direction, approvals, inter-divisional coordination and official decisions.", icon: Landmark },
  { name: "Customer Service Unit", short: "CSU", body: "Official reception, enquiries, document collection, acknowledgement and routing of submissions.", icon: Inbox },
  { name: "Planning, Design & Beautification", short: "PDB", body: "Site planning, technical assessment, siting and setting-out coordination, spacing controls and environmental aesthetics.", icon: Ruler },
  { name: "Monitoring, Evaluation & Enforcement", short: "MEE", body: "Compliance monitoring, field inspection, enforcement reports, authorised removal and custody hand-over.", icon: Eye },
  { name: "Records, Statistics & Data Management", short: "RSDM", body: "Records custody, indexing, digitisation, enumeration, statistics, the site database and GIS support.", icon: Database },
  { name: "Accounts", body: "Billing and payment records, receipt verification, reconciliation and financial reporting.", icon: Wallet },
  { name: "Audit", body: "Independent checks, financial and inventory accountability and controlled release documentation.", icon: ShieldCheck },
  { name: "Business Development", body: "Stakeholder and programme development, and oversight of approved business or facilitator engagements.", icon: Briefcase },
  { name: "Administration", body: "Staff administration, postings, attendance, official communication channels and administrative support.", icon: Users },
  { name: "Telecom Team", body: "Telecom site documentation, regulatory coordination, inventory and compliance follow-up.", icon: RadioTower },
  { name: "Procurement", body: "Procurement records and reporting on departmental acquisitions.", icon: Archive },
  { name: "Public Relations", body: "Approved public information, stakeholder communications, announcements and media coordination.", icon: Megaphone },
]

export const REGISTER_FEATURES = [
  { t: "A unique Site ID", d: "Each verified structure gets one identifier, from approval to removal." },
  { t: "Location & GIS", d: "Coordinates, zoning and the site on a master map." },
  { t: "Practitioner & board type", d: "Who owns it, what it is and how big it is." },
  { t: "Approvals & dated photos", d: "Setting-out, approvals and inspections, in one history." },
  { t: "QR or barcode on site", d: "Scan a structure to see its approved public status." },
  { t: "Privacy by role", d: "Bills, personal data and enforcement evidence stay restricted." },
]

/* ------------------------------------------------------------------ */
/* FAQs                                                                */
/* ------------------------------------------------------------------ */

export const FAQS = [
  {
    q: "What does DOAS do?",
    a: "DOAS is the department of the FCT Administration responsible for the control and regulation of outdoor advertisement and signage in the Federal Capital Territory. It assesses applications, issues approvals, keeps the records of practitioners, sites and structures, monitors compliance and carries out authorised enforcement.",
  },
  {
    q: "Can I start building a new billboard now?",
    a: "No. A temporary stop-work order suspends new billboard construction, excavation, foundation work and erection until further official direction. You may not begin or continue structural work without express written clearance from DOAS. Violations may attract site or licence revocation and prosecution.",
  },
  {
    q: "Should I pay for a newly approved billboard site?",
    a: "Not yet. Practitioners are instructed not to pay for newly approved sites until further notice. Approved bills and liabilities for existing or old structures are unaffected and remain payable.",
  },
  {
    q: "When do I pay the revalidation certification fee?",
    a: "Only after DOAS publishes the successful list and notifies you individually in writing. The fee is ₦1,000,000 per successful practitioner, paid through Remita. It is not payable when you submit documents. Submit your payment evidence for verification before the revalidated licence is issued.",
  },
  {
    q: "What do I need before applying for a billboard near private property?",
    a: "A valid consent letter from the property owner or their authorised representative, obtained before you apply. Before any construction or maintenance you also need a Setting Out Certificate and every other applicable written approval.",
  },
  {
    q: "How far apart must billboards be?",
    a: "For new structures: 1 km for gantries, eye catchers and flag poles; 500 m for large format and unipoles; 400 m for 96 sheet and portrait; 200 m for light box and 48 sheet. No more than two alternating billboards are allowed at a junction. Meeting the spacing minimum does not by itself mean a site is approved.",
  },
  {
    q: "Can I trim a tree that blocks my billboard?",
    a: "Not without prior written clearance from DOAS. Cutting, trimming, damaging or felling trees to improve visibility is prohibited, and Parks and Recreation approval alone does not authorise it.",
  },
  {
    q: "Does a payment receipt mean my site is approved?",
    a: "No. Submission, acknowledgement, payment and approval are separate steps. A receipt never replaces a regulatory approval, and an application never authorises site occupation, excavation, construction or erection.",
  },
  {
    q: "Who should I deal with at DOAS?",
    a: "The Customer Service Unit is the official reception and enquiry point. Submit documents and make enquiries there — not through individual officers or informal intermediaries. Report any request for an inducement or any unofficial payment demand.",
  },
  {
    q: "Where is the DOAS office?",
    a: `${CONTACT.addressOneLine}. Office hours are ${CONTACT.hours}. Call ${CONTACT.phones[0].display} or ${CONTACT.phones[1].display}.`,
  },
]

/* ------------------------------------------------------------------ */
/* Photography — drop real frames into /public/photos.                 */
/* Missing files fall back to a branded gradient, so nothing breaks.    */
/* Recommended: 2400×1500, JPEG q80, landscape.                         */
/* ------------------------------------------------------------------ */

export type Photo = { src: string; alt: string; caption: string; place: string }

export const HERO_PHOTOS: Photo[] = [
  { src: "/hero-city-gate.jpg", alt: "Abuja City Gate at dusk", caption: "The first thing visitors see of Abuja.", place: "City Gate · Airport Road" },
  { src: "/photos/hero-cbd.jpg", alt: "Central Business District skyline", caption: "A skyline that belongs to the city.", place: "Central Business District" },
  { src: "/photos/hero-expressway.jpg", alt: "Unipole billboard beside an expressway at golden hour", caption: "Room to breathe between boards.", place: "Kubwa Expressway" },
]

export const GALLERY: Photo[] = [
  { src: "/photos/g-unipole.jpg", alt: "Unipole billboard on an arterial road", caption: "Unipole — 500 m minimum spacing between new structures", place: "Standards" },
  { src: "/photos/g-led.jpg", alt: "Large-format screen at a junction at night", caption: "No more than two alternating billboards at a junction", place: "Siting" },
  { src: "/photos/g-storefront.jpg", alt: "Business fascia sign on a commercial frontage", caption: "First-party signage on a business's own premises", place: "First-party" },
  { src: "/photos/g-enforcement.jpg", alt: "Officers inspecting a billboard structure", caption: "Monitoring, Evaluation & Enforcement on field inspection", place: "Compliance" },
  { src: "/photos/g-office.jpg", alt: "The DOAS Customer Service Unit", caption: "The Customer Service Unit — official reception for every submission", place: "Jahi" },
]