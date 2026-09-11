"use client"

/**
 * Existing panels import from "@/components/ui/use-toast". The implementation
 * now lives in ./toast — this keeps those imports valid.
 */
export { useToast, toast, dismiss, Toaster } from "./toast"
export type { ToastOptions, ToastVariant, ToastHandle } from "./toast"
