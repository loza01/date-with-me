import { supabase } from './supabase'
import { blockDevice as setDeviceBlock } from './deviceBlock'

/**
 * Tear down everything the browser knows about the applicant:
 * Supabase session, local/session storage, cookies, and in-memory React
 * state (a full page load onto "/" discards the whole component tree).
 *
 * With { blockDevice: true } a block token is written AFTER the wipe, so
 * this browser can't be used to sign up again.
 */
export async function hardDisconnect({ blockDevice = false } = {}) {
  try {
    // Global scope revokes refresh tokens on every device, not just this one.
    await supabase?.auth.signOut({ scope: 'global' })
  } catch {
    // The account may already be banned; carry on clearing the browser.
  }

  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    // Storage can be unavailable in private modes.
  }

  document.cookie.split(';').forEach((cookie) => {
    const name = cookie.split('=')[0].trim()
    if (!name) return
    const expire = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    document.cookie = `${expire}; path=/`
    document.cookie = `${expire}; path=/; domain=${location.hostname}`
  })

  if (blockDevice) setDeviceBlock()

  window.location.replace('/')
}
