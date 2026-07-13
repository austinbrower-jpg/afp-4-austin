import { describe, expect, it } from "vitest";
import { createUnconfiguredPdfStorage } from "./storage";
describe("PDF storage abstraction", () => { it("defines future providers without uploading PDFs", async () => { const adapter=createUnconfiguredPdfStorage("s3"); expect(adapter.provider).toBe("s3"); await expect(adapter.put({ key:"invoice.pdf", bytes:new Uint8Array(), contentType:"application/pdf" })).rejects.toThrow("intentionally not implemented"); }); });
