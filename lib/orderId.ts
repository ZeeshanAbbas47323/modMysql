// Unique, human-readable Order ID for every export: GS-YYYYMMDD-XXXX
// XXXX is Crockford base32 (no I/L/O/U) from a CSPRNG. Works in the browser and
// Node (both expose globalThis.crypto.getRandomValues).

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateOrderId(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  let suffix = "";
  for (let i = 0; i < bytes.length; i++) suffix += ALPHABET[bytes[i] % 32];
  return `GS-${y}${m}${d}-${suffix}`;
}
