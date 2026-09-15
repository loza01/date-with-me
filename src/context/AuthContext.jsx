import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hardDisconnect } from '../lib/disconnect'
import { clearDeviceBlock } from '../lib/deviceBlock'
import { AuthContext } from './sessionContext'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef(null)

  const loadUserData = useCallback(async (currentSession) => {
    if (!currentSession) {
      setProfile(null)
      setIsAdmin(false)
      return
    }

    // Every signed-up user has a profile row. Right after sign-in the first
    // request can go out before the new token is attached and come back empty,
    // so retry briefly instead of treating the user as having no profile.
    let profileRow = null
    let adminFlag = false
    for (let attempt = 1; attempt <= 5; attempt++) {
      const [profileResult, adminResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', currentSession.user.id).maybeSingle(),
        supabase.rpc('is_admin'),
      ])
      profileRow = profileResult.data
      adminFlag = adminResult.data
      if (profileRow) break
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt))
    }

    // A closed applicant should never hold a live session. If one slips
    // through (e.g. an old tab), wipe it immediately.
    if (profileRow?.status === 'closed' && !adminFlag) {
      await hardDisconnect({ blockDevice: true })
      return
    }

    // Reusable test accounts lift a device block left by an earlier test run.
    if (profileRow?.reusable) clearDeviceBlock()

    setProfile(profileRow)
    setIsAdmin(Boolean(adminFlag))
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      userIdRef.current = data.session?.user.id ?? null
      await loadUserData(data.session)
      if (active) setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'INITIAL_SESSION') return
      setSession(newSession)

      // Token refreshes keep the same user; only re-fetch on a real switch,
      // and hold routing until the new user's profile has arrived.
      const newUserId = newSession?.user.id ?? null
      if (newUserId === userIdRef.current) return
      userIdRef.current = newUserId
      setLoading(true)
      // Supabase warns against awaiting other Supabase calls inside this
      // callback, so defer the profile fetch to the next tick.
      setTimeout(async () => {
        await loadUserData(newSession)
        if (active) setLoading(false)
      }, 0)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadUserData])

  const refreshProfile = useCallback(() => loadUserData(session), [loadUserData, session])

  return (
    <AuthContext.Provider value={{ session, profile, isAdmin, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
