import type { Metadata } from "next"
import { Landing } from "@/components/landing/landing"
import { CONTACT } from "@/components/landing/content"

export const metadata: Metadata = {
  title: "DOAS Abuja — Department of Outdoor Advertisement and Signage, FCTA",
  description:
    "Department of Outdoor Advertisement and Signage (DOAS), FCT Administration. Current notices and circulars, billboard spacing and safety standards, practitioner revalidation, site approvals, first-party signage and the Customer Service Unit in Jahi, Abuja.",
  keywords: [
    "DOAS Abuja",
    "Department of Outdoor Advertisement and Signage",
    "billboard permit FCT",
    "billboard spacing standards Abuja",
    "practitioner revalidation DOAS",
    "stop-work order billboard Abuja",
    "first-party signage Abuja",
    "outdoor advertising regulation Nigeria",
    "FCTA signage",
    "DOAS Jahi office",
  ],
  openGraph: {
    type: "website",
    title: "DOAS — Department of Outdoor Advertisement and Signage, FCTA",
    description:
      "Notices in force, billboard standards, services and the Customer Service Unit for outdoor advertising across the Federal Capital Territory.",
    siteName: "DOAS Abuja",
    locale: "en_NG",
  },
  alternates: { canonical: "/" },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "GovernmentOrganization",
  name: "Department of Outdoor Advertisement and Signage",
  alternateName: "DOAS",
  description:
    "The department of the Federal Capital Territory Administration responsible for the control and regulation of outdoor advertisement and signage in the FCT.",
  parentOrganization: {
    "@type": "GovernmentOrganization",
    name: "Federal Capital Territory Administration",
    alternateName: "FCTA",
  },
  areaServed: { "@type": "AdministrativeArea", name: "Federal Capital Territory, Abuja, Nigeria" },
  address: {
    "@type": "PostalAddress",
    streetAddress: "Abuja Enterprise Agency Building, adjacent BON Octagon Hotel, Wole Soyinka Way",
    addressLocality: "Jahi, Abuja",
    addressRegion: "FCT",
    addressCountry: "NG",
  },
  telephone: CONTACT.phones.map((p) => p.tel),
  email: CONTACT.email,
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "08:00",
      closes: "16:00",
    },
  ],
}

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Landing />
    </>
  )
}
