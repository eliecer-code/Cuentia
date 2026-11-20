/**
 * Genera un token criptográfico aleatorio en hexadecimal (por defecto 32 bytes = 256 bits).
 */
export function generateSecureTokenHex(bytes = 32): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Calcula SHA-256 en hexadecimal usando Web Crypto API nativo (sin dependencias externas).
 */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
