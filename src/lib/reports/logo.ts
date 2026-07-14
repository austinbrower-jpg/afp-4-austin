"use client";

export interface ResolvedLogo {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * jsPDF's addImage() embeds raster data uncompressed unless given an
 * explicit format + compression level - for a 2000x2000 source that turns a
 * ~36KB PNG into a 16MB+ PDF. This extracts the format jsPDF expects
 * ("PNG", "JPEG", ...) from a data URL's mime type, defaulting to PNG.
 */
export function imageFormatFromDataUrl(dataUrl: string): string {
  const match = /^data:image\/(\w+);/i.exec(dataUrl);
  const type = match?.[1]?.toUpperCase() ?? "PNG";
  return type === "JPG" ? "JPEG" : type;
}

/** Loads an image (any URL or data URI) and reads its natural pixel size. */
function loadImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to load logo image"));
    img.src = src;
  });
}

/**
 * Resolves a logo path (typically a same-origin static asset like
 * "/branding/battle-bound-branding-logo.png") to an embeddable data URL plus
 * its natural pixel dimensions, so PDF and print-HTML exports always contain
 * the logo and can size it without stretching or cropping.
 *
 * Never throws - returns null on any failure (missing file, network error,
 * decode error) so callers can fall back to text-only branding instead of
 * breaking export.
 */
export async function resolveLogoDataUrl(logoPath: string): Promise<ResolvedLogo | null> {
  const trimmed = logoPath.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.startsWith("data:image")) {
      const { width, height } = await loadImageDimensions(trimmed);
      return { dataUrl: trimmed, width, height };
    }
    const response = await fetch(trimmed);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error("Failed to read logo image"));
      reader.readAsDataURL(blob);
    });
    const { width, height } = await loadImageDimensions(dataUrl);
    return { dataUrl, width, height };
  } catch {
    return null;
  }
}
