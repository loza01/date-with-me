/**
 * Marks this browser as belonging to a rejected applicant so the sign-up
 * page stays closed. Stored in localStorage, sessionStorage and a cookie so
 * clearing one isn't enough. A private window or another browser gets
 * around it; the server-side email block and account ban still apply there.
 *
 * To unblock a browser you use for testing, run in its console:
 *   localStorage.removeItem('tcp_device_block'); document.cookie = 'tcp_device_block=; max-age=0; path=/'
 */
const KEY = 'tcp_device_block'

export function blockDevice() {
  const token = JSON.stringify({ blockedAt: new Date().toISOString() })
  try {
    localStorage.setItem(KEY, token)
    sessionStorage.setItem(KEY, token)
  } catch {
    // Storage unavailable; the cookie below still applies.
  }
  document.cookie = `${KEY}=1; max-age=${60 * 60 * 24 * 365 * 5}; path=/; SameSite=Strict`
}

export function clearDeviceBlock() {
  try {
    localStorage.removeItem(KEY)
    sessionStorage.removeItem(KEY)
  } catch {
    // Storage unavailable.
  }
  document.cookie = `${KEY}=; max-age=0; path=/; SameSite=Strict`
}

export function isDeviceBlocked() {
  try {
    if (localStorage.getItem(KEY) || sessionStorage.getItem(KEY)) return true
  } catch {
    // Fall through to the cookie check.
  }
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${KEY}=`))
}
