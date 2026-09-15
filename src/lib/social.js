// Client-side mirror of the URL checks in complete_profile(). The server
// re-validates; these just give instant feedback.
const PATTERNS = {
  x: /^https:\/\/(www\.|mobile\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/?([?#].*)?$/i,
  linkedin: /^https:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\/(in|pub)\/[^\s/?#]+\/?([?#].*)?$/i,
  instagram: /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]{1,30}\/?([?#].*)?$/i,
}

/** "x.com/name" → "https://x.com/name"; trims whitespace. */
export function normalizeUrl(value) {
  const v = value.trim()
  if (!v) return ''
  return /^https?:\/\//i.test(v) ? v.replace(/^http:\/\//i, 'https://') : `https://${v}`
}

export function isValidSocial(kind, value) {
  return PATTERNS[kind].test(normalizeUrl(value))
}
