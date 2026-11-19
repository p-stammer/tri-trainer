/**
 * Eindeutige IDs. crypto.randomUUID() ist nur in "sicheren Kontexten" (HTTPS/localhost)
 * verfügbar – beim Testen über das lokale Netz (http://192.168…) fehlt es auf dem iPhone.
 * Deshalb gibt es einen Fallback über crypto.getRandomValues (überall verfügbar).
 */
export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // Version 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // Variante
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
