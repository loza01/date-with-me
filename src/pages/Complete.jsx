import { useState } from 'react'
import { supabase, readableError } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { Shell, Spinner, ErrorNote } from '../components/Shell'

/**
 * Shown to every 100% match, now and on every later login. There is no way to
 * start another application, except on reusable test accounts.
 */
export default function Complete() {
  const { profile, refreshProfile } = useAuth()
  const [restarting, setRestarting] = useState(false)
  const [error, setError] = useState(null)

  async function restart() {
    setRestarting(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('restart_application')
    if (rpcError) {
      setError(readableError(rpcError))
      setRestarting(false)
      return
    }
    try {
      localStorage.removeItem(`enigma-intro-seen-${profile.id}`) // replay the introduction
    } catch {
      // Storage unavailable.
    }
    await refreshProfile() // back to "onboarding"
  }

  return (
    <Shell>
      <div aria-hidden="true" className="min-h-[60dvh]" />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/40 p-4 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-title"
      >
        <div className="card w-full max-w-md animate-[fadeUp_0.45s_ease-out] p-8 text-center sm:p-10">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-sage-200/60 text-3xl text-sage-700">
            ♥
          </div>
          <h1 id="match-title" className="mt-6 font-serif text-4xl text-charcoal-900">
            Thank you, this is a match.
          </h1>
          <div className="mx-auto my-5 h-px w-12 bg-rose-300" />
          <p className="font-serif text-2xl text-rose-600 italic">See you on FaceTime.</p>

          <div className="mt-8 flex flex-col items-center gap-3">
            {profile?.reusable && (
              <button onClick={restart} disabled={restarting} className="btn-primary">
                {restarting && <Spinner />}
                Start a new test application
              </button>
            )}
            <button onClick={() => supabase.auth.signOut()} className="btn-secondary">
              Log out
            </button>
          </div>
          {error && (
            <div className="mt-5">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}
