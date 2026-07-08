// PNG physical-resolution (DPI) metadata.
//
// PNG stores print resolution in the `pHYs` chunk as pixels-per-meter.
// Browser `canvas.toBlob()` output carries no pHYs chunk at all, so readers
// (Windows Explorer, Photoshop, RIP software) assume the 96 DPI default even
// though the pixel dimensions are correct. These helpers build a pHYs chunk
// and inject it into an encoded PNG without touching the pixel data.

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** PNG pHYs unit is pixels per METER: dpi / 0.0254 (300 DPI → 11811). */
export function dpiToPixelsPerMeter(dpi: number): number {
  return Math.round(dpi / 0.0254);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** A complete pHYs chunk (length + type + data + CRC) for the given DPI. */
export function physChunk(dpi: number): Uint8Array {
  const ppm = dpiToPixelsPerMeter(dpi);
  const out = new Uint8Array(12 + 9);
  const view = new DataView(out.buffer);
  view.setUint32(0, 9); // data length
  out[4] = 0x70; // p
  out[5] = 0x48; // H
  out[6] = 0x59; // Y
  out[7] = 0x73; // s
  view.setUint32(8, ppm); // x pixels per unit
  view.setUint32(12, ppm); // y pixels per unit
  out[16] = 1; // unit: meter
  view.setUint32(17, crc32(out.subarray(4, 17)));
  return out;
}

/**
 * Return a copy of `png` with its pHYs chunk set to `dpi` (inserted right
 * after IHDR; any existing pHYs chunks are dropped). Pixel data is untouched.
 * Throws if the bytes are not a valid PNG.
 */
export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  if (
    png.length < 8 ||
    PNG_SIGNATURE.some((b, i) => png[i] !== b)
  ) {
    throw new Error("Not a PNG file.");
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const parts: Uint8Array[] = [png.subarray(0, 8)];
  let offset = 8;
  let injected = false;
  while (offset + 12 <= png.length) {
    const len = view.getUint32(offset);
    const type = String.fromCharCode(
      png[offset + 4],
      png[offset + 5],
      png[offset + 6],
      png[offset + 7]
    );
    const end = offset + 12 + len;
    if (end > png.length) break; // truncated chunk — keep what we have
    if (type !== "pHYs") {
      parts.push(png.subarray(offset, end));
    }
    if (type === "IHDR" && !injected) {
      parts.push(physChunk(dpi));
      injected = true;
    }
    offset = end;
    if (type === "IEND") break;
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Blob-level convenience wrapper around {@link setPngDpi}. */
export async function setPngBlobDpi(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return new Blob([setPngDpi(bytes, dpi) as BlobPart], { type: "image/png" });
}
