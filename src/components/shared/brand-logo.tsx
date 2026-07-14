"use client";

import { useState } from "react";

/**
 * Renders the business logo from a plain (non-data-URL) path, sized to a
 * fixed height with aspect ratio preserved via `w-auto` + `object-contain`
 * (never stretched or cropped). Falls back to rendering nothing - not a
 * broken-image icon or a thrown error - if the image fails to load, so
 * surrounding text branding remains the visible fallback.
 */
export function BrandLogo({
  src,
  alt,
  className = "h-12 w-auto object-contain",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const trimmed = src?.trim();
  if (!trimmed || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={trimmed} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}
