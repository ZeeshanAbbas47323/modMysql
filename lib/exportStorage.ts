"use client";

// Uploads exported PNG/PDF files to the signed-in user's own S3 folder (via the
// /api/exports/* routes) so a previous export can be re-downloaded byte-for-
// byte later. Degrades gracefully (returns null / []) when signed out.

/**
 * Upload exported files to the user's own order folder. Returns the storage
 * prefix on success, or null (failure / not signed in) so callers degrade
 * gracefully — history is still saved either way.
 */
export async function uploadExportFiles(
  files: { name: string; blob: Blob }[],
  orderId: string
): Promise<string | null> {
  if (files.length === 0) return null;
  try {
    let prefix: string | null = null;
    for (const f of files) {
      const presignRes = await fetch("/api/exports/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          fileName: f.name,
          contentType: f.blob.type || "application/octet-stream",
        }),
      });
      if (!presignRes.ok) return null;
      const { url, prefix: p } = await presignRes.json();
      prefix = p;
      const putRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": f.blob.type || "application/octet-stream" },
        body: f.blob,
      });
      if (!putRes.ok) return null;
    }
    return prefix;
  } catch {
    return null;
  }
}

/** Signed URLs for every file in a stored export folder (owner-scoped). */
export async function signedUrlsForFolder(
  prefix: string
): Promise<{ name: string; url: string }[]> {
  try {
    const res = await fetch(`/api/exports/files?prefix=${encodeURIComponent(prefix)}`);
    if (!res.ok) return [];
    const { files } = await res.json();
    return files ?? [];
  } catch {
    return [];
  }
}
