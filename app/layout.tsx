import type { Metadata, Viewport } from "next"
import { Inter, Archivo } from "next/font/google"
import { Toaster } from "@/components/ui/toast"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["500", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "DOAS",
    template: "%s · DOAS",
  },
  description:
    "Directorate of Outdoor Advertisement and Signage — permit applications, site visits and practitioner records.",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F4F3" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1A17" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${archivo.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
