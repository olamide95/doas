import type { Metadata, Viewport } from "next"
import { Fraunces, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google"
import "./globals.css"

/* ------------------------------------------------------------------ */
/* Typeface pairing                                                    */
/* Fraunces  — display serif: weight, warmth, institutional gravity    */
/* Jakarta   — UI sans: clean, high legibility at small sizes          */
/* JetBrains — figures, reference numbers, tabular data                */
/* ------------------------------------------------------------------ */

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
})

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["500", "700"],
})

const SITE = "https://doas.abj.gov.ng"

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "DOAS — Department of Outdoor Advertisement and Signage, FCTA Abuja",
    template: "%s · DOAS Abuja",
  },
  description:
    "Official portal of the FCTA Department of Outdoor Advertisement and Signage. Register first-party storefront signage, apply for billboard and mobile advert permits, verify a permit, and stay compliant with the Abuja Master Plan.",
  keywords: [
    "DOAS Abuja",
    "signage permit Abuja",
    "first party signage regularization",
    "billboard permit FCT",
    "outdoor advertising Nigeria",
    "FCTA signage registration",
    "AMAC signage permit",
    "mobile advert permit Abuja",
    "shop sign approval Abuja",
  ],
  authors: [{ name: "Federal Capital Territory Administration" }],
  applicationName: "DOAS FCTA",
  alternates: { canonical: SITE },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: SITE,
    siteName: "DOAS — FCTA",
    title: "Every sign in Abuja, accounted for — DOAS, FCTA",
    description:
      "Register your signage, obtain a permit and track every file online. One register for all six FCT Area Councils.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Department of Outdoor Advertisement and Signage, Abuja" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DOAS — Department of Outdoor Advertisement and Signage, Abuja",
    description: "Register signage, obtain permits and stay compliant with FCTA advertising law.",
    images: ["/og.png"],
  },
  icons: { icon: "/doas-logo.png", apple: "/doas-logo.png" },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFAF4" },
    { media: "(prefers-color-scheme: dark)", color: "#061101" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "GovernmentOrganization",
  name: "Department of Outdoor Advertisement and Signage",
  alternateName: "DOAS",
  parentOrganization: { "@type": "GovernmentOrganization", name: "Federal Capital Territory Administration" },
  url: SITE,
  logo: `${SITE}/doas-logo.png`,
  telephone: "+234 9 291 9181",
  email: "service@doas.abj.gov.ng",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Katampe Road, Jahi",
    addressLocality: "Abuja",
    addressRegion: "Federal Capital Territory",
    postalCode: "900321",
    addressCountry: "NG",
  },
  openingHours: "Mo-Fr 08:00-16:00",
  areaServed: ["AMAC", "Abaji", "Bwari", "Gwagwalada", "Kuje", "Kwali"],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" suppressHydrationWarning>
      <body className={`${jakarta.variable} ${fraunces.variable} ${jetbrains.variable} font-sans antialiased`}>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }}
        />
      </body>
    </html>
  )
}
