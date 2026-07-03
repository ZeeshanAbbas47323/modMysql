"use client";

import type { LibraryAsset } from "./types";

// User-specific image gallery backed by AWS S3 (bytes) + MySQL (metadata, via
// the /api/assets* routes). Everything no-ops gracefully when signed out (the
// routes 401 and these functions just return early), so the app still works
// on localStorage-only asset state.

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

type AssetItem = {
  id: string;
  name: string;
  mimeType: string;
  naturalWidth: number;
  naturalHeight: number;
  sizeBytes: number;
  dpi?: number;
  bgRemoved: boolean;
  upscaled: boolean;
  cropped: boolean;
  textRemoved: boolean;
  createdAt: number;
  url: string;
};

/** Upload/replace an asset's bytes + metadata in the signed-in user's gallery. */
export async function saveGalleryAsset(asset: LibraryAsset): Promise<void> {
  try {
    const contentType = asset.mimeType || "image/png";
    const presignRes = await fetch("/api/assets/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: asset.id, contentType }),
    });
    if (!presignRes.ok) return; // not signed in, or unsupported type
    const { s3Key, url } = await presignRes.json();

    const blob = await dataUrlToBlob(asset.src);
    const putRes = await fetch(url, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
    if (!putRes.ok) return;

    await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: asset.id,
        s3Key,
        name: asset.name,
        mimeType: asset.mimeType,
        naturalWidth: asset.naturalWidth,
        naturalHeight: asset.naturalHeight,
        sizeBytes: asset.sizeBytes,
        dpi: asset.dpi ?? null,
        bgRemoved: !!asset.bgRemoved,
        upscaled: !!asset.upscaled,
        cropped: !!asset.cropped,
        textRemoved: !!asset.textRemoved,
      }),
    });
  } catch {
    /* network/permission issue — the local asset still works */
  }
}

/** Update lightweight metadata (e.g. a rename) without re-uploading bytes. */
export async function updateGalleryMeta(id: string, patch: { name?: string }): Promise<void> {
  if (patch.name === undefined) return;
  try {
    await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: patch.name }),
    });
  } catch {
    /* ignore */
  }
}

/** Delete an asset (storage object + row) from the signed-in user's gallery. */
export async function deleteGalleryAsset(id: string): Promise<void> {
  try {
    await fetch(`/api/assets/${id}`, { method: "DELETE" });
  } catch {
    /* ignore */
  }
}

/** Load the signed-in user's gallery as builder-ready assets (data URLs). */
export async function loadGalleryAssets(): Promise<LibraryAsset[]> {
  try {
    const res = await fetch("/api/assets", { cache: "no-store" });
    if (!res.ok) return [];
    const { assets } = (await res.json()) as { assets: AssetItem[] };

    const loaded = await Promise.all(
      assets.map(async (a): Promise<LibraryAsset | null> => {
        try {
          const blobRes = await fetch(a.url);
          if (!blobRes.ok) return null;
          const blob = await blobRes.blob();
          return {
            id: a.id,
            name: a.name,
            src: await blobToDataUrl(blob),
            naturalWidth: a.naturalWidth,
            naturalHeight: a.naturalHeight,
            sizeBytes: a.sizeBytes,
            mimeType: a.mimeType,
            createdAt: a.createdAt,
            dpi: a.dpi,
            bgRemoved: a.bgRemoved,
            upscaled: a.upscaled,
            cropped: a.cropped,
            textRemoved: a.textRemoved,
          };
        } catch {
          return null;
        }
      })
    );
    return loaded.filter((a): a is LibraryAsset => a !== null);
  } catch {
    return [];
  }
}
