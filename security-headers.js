// Security headers for the production site. Used by `vite preview` and kept in
// sync with vercel.json and public/_headers for hosting.
const SUPABASE = 'https://*.supabase.co'

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // 'unsafe-eval' is required by the obfuscator's anti-debugging runtime.
  "script-src 'self' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${SUPABASE}`,
  `media-src 'self' blob: ${SUPABASE}`,
  `connect-src 'self' ${SUPABASE} wss://*.supabase.co`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'microphone=(self), camera=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
}
