export type PdfStorageProvider = "vercel-blob" | "supabase" | "s3" | "google-drive";
export interface PdfStorageObject { key: string; url: string; provider: PdfStorageProvider; contentType: "application/pdf"; sizeBytes?: number; }
export interface PdfStoragePutInput { key: string; bytes: Uint8Array; contentType: "application/pdf"; metadata?: Record<string, string>; }
export interface PdfStorageAdapter { readonly provider: PdfStorageProvider; getPublicUrl(key: string): Promise<string>; put(input: PdfStoragePutInput): Promise<PdfStorageObject>; remove(key: string): Promise<void>; }
export function createUnconfiguredPdfStorage(provider: PdfStorageProvider): PdfStorageAdapter { return { provider, async getPublicUrl() { throw new Error(`${provider} PDF storage is not configured.`); }, async put() { throw new Error(`${provider} PDF uploads are intentionally not implemented in this code-only phase.`); }, async remove() { throw new Error(`${provider} PDF deletion is not configured.`); } }; }
