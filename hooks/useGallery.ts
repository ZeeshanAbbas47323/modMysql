"use client";

import { useEffect, useRef } from "react";
import {
  deleteGalleryAsset,
  loadGalleryAssets,
  saveGalleryAsset,
  updateGalleryMeta,
} from "@/lib/gallery";
import { currentUserEmail, onAuthChange } from "@/lib/auth-client";
import { useBuilder } from "@/lib/store";
import type { LibraryAsset } from "@/lib/types";

// Keeps the asset library in sync with the signed-in user's gallery:
//   • on sign-in, loads their stored images into the library;
//   • mirrors every library change (import / edit / crop / rename / delete) back
//     to Supabase Storage + the gallery_assets table;
//   • on account switch, clears the previous user's images so a gallery is only
//     ever visible to its owner.
// Signed out (or before the schema is applied) it stays inert — the builder
// keeps working on localStorage exactly as before.

type Signature = { src: string; name: string; flags: string };

function signatureOf(a: LibraryAsset): Signature {
  return {
    src: a.src,
    name: a.name,
    flags: `${+!!a.bgRemoved}${+!!a.upscaled}${+!!a.cropped}${+!!a.textRemoved}`,
  };
}

export function useGallery() {
  const syncedRef = useRef<Map<string, Signature>>(new Map());
  const syncedUserRef = useRef<string | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    let active = true;

    const clearLoadedGallery = () => {
      const ids = [...syncedRef.current.keys()];
      syncedRef.current = new Map();
      if (ids.length > 0) useBuilder.getState().removeAssets(ids);
    };

    const loadForUser = async (userId: string) => {
      // a different user signed in — drop the previous owner's images first
      if (syncedUserRef.current && syncedUserRef.current !== userId) {
        clearLoadedGallery();
      }
      syncedUserRef.current = userId;

      const assets = await loadGalleryAssets();
      if (!active) return;
      const store = useBuilder.getState();
      const present = new Set(store.assets.map((a) => a.id));
      for (const a of assets) syncedRef.current.set(a.id, signatureOf(a));
      const fresh = assets.filter((a) => !present.has(a.id));
      if (fresh.length > 0) store.addAssets(fresh);

      // push any images uploaded while signed out into the gallery
      for (const a of useBuilder.getState().assets) {
        if (!syncedRef.current.has(a.id)) {
          syncedRef.current.set(a.id, signatureOf(a));
          void saveGalleryAsset(a);
        }
      }
    };

    const refresh = async () => {
      const userId = await currentUserEmail();
      enabledRef.current = !!userId;
      if (userId) await loadForUser(userId);
    };

    void refresh();
    const unsubAuth = onAuthChange(() => void refresh());

    // mirror library mutations to Supabase (only while signed in)
    let lastAssets = useBuilder.getState().assets;
    const unsubStore = useBuilder.subscribe((state) => {
      if (state.assets === lastAssets) return;
      lastAssets = state.assets;
      if (!enabledRef.current) return;

      const synced = syncedRef.current;
      const present = new Set<string>();
      for (const a of state.assets) {
        present.add(a.id);
        const prev = synced.get(a.id);
        const sig = signatureOf(a);
        if (!prev || prev.src !== sig.src || prev.flags !== sig.flags) {
          synced.set(a.id, sig);
          void saveGalleryAsset(a);
        } else if (prev.name !== sig.name) {
          synced.set(a.id, sig);
          void updateGalleryMeta(a.id, { name: a.name });
        }
      }
      for (const id of [...synced.keys()]) {
        if (!present.has(id)) {
          synced.delete(id);
          void deleteGalleryAsset(id);
        }
      }
    });

    return () => {
      active = false;
      unsubAuth();
      unsubStore();
    };
  }, []);
}
