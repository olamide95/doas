"use client"

import { useParams } from "next/navigation"
import { DocumentPage } from "@/components/documents/document-view"

/** Printable letter, e-receipt or certificate. Public: the code is the key. */
export default function IssuedDocumentRoute() {
  const params = useParams<{ code: string }>()
  return <DocumentPage code={decodeURIComponent(params?.code ?? "")} />
}
