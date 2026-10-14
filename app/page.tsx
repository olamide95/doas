import type { Metadata } from "next"
import { Landing } from "@/components/landing/landing"

export const metadata: Metadata = {
  title: "DOAS Abuja — Outdoor Advertisement & Signage Permits, FCTA",
  description:
    "Official portal of the Department of Outdoor Advertisement and Signage (DOAS), FCT Administration. Register first-party signage, apply for billboard and mobile advert permits, verify a permit, and stay compliant with FCT outdoor advertising regulations.",
  keywords: [
    "DOAS Abuja",
    "signage permit Abuja",
    "billboard permit FCT",
    "first party signage regularization",
    "outdoor advertising Nigeria",
    "FCTA signage registration",
    "Jahi DOAS office",
  ],
  openGraph: {
    type: "website",
    title: "DOAS — Department of Outdoor Advertisement and Signage, FCTA",
    description:
      "Register signage, obtain permits and verify compliance with outdoor advertising regulations across the Federal Capital Territory.",
    siteName: "DOAS Abuja",
    locale: "en_NG",
  },
  alternates: { canonical: "/" },
}

export default function HomePage() {
  return <Landing />
}
