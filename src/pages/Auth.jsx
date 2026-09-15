import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Shell, Spinner, ErrorNote } from '../components/Shell'
import { isDeviceBlocked } from '../lib/deviceBlock'

export default function Auth({ mode, hideSignupLink = false }) {
  const isSignup = mode === 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [ipBanned, setIpBanned] = useState(false)

  // Banned IP addresses can't open the sign-up form either (also enforced on
  // the server by the Auth hook and when a profile is submitted).
  useEffect(() => {
    if (!isSignup) return
    supabase.rpc('signup_allowed').then(({ data }) => setIpBanned(data === false))
  }, [isSignup])

  if (isSignup && (isDeviceBlocked() || ipBanned)) {
    return (
      <Shell footer={false}>
        <section className="flex min-h-[70dvh] items-center justify-center text-center">
          <p className="font-serif text-2xl text-charcoal-400">This application is closed.</p>
        </section>
      </Shell>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (isSignup) {
      if (password.length < 8) return setError('Password must be at least 8 characters.')
      if (password !== confirm) return setError('Passwords do not match.')
    }

    setBusy(true)
    if (isSignup) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      if (signUpError) {
        setError(
          /database error|email_blocked|application has been closed|hook/i.test(signUpError.message)
            ? 'This email address cannot be used to apply.'
            : signUpError.message,
        )
      } else if (!data.session) setNotice('Check your inbox to confirm your email, then log in to continue.')
      // With a session, AuthContext picks it up and routing moves on.
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        // Banned (closed) applicants get a neutral message.
        setError(
          /banned/i.test(signInError.message) ? 'This application has been closed.' : 'Incorrect email or password.',
        )
      }
    }
    setBusy(false)
  }

  return (
    <Shell>
      <div className="card p-6 sm:p-10">
        <h1 className="font-serif text-4xl text-charcoal-900">
          {isSignup ? 'Begin your application' : 'Welcome back'}
        </h1>
        <p className="mt-2 text-charcoal-500">
          {isSignup ? 'Create a private account to get started.' : 'Log in to continue where you left off.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </div>
          {isSignup && (
            <div>
              <label htmlFor="confirm" className="label">
                Confirm Password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input"
              />
            </div>
          )}

          {!isSignup && (
            <p className="-mt-2 text-right text-sm">
              <Link to="/forgot-password" className="font-medium text-rose-600 hover:underline">
                Forgot password?
              </Link>
            </p>
          )}

          <ErrorNote>{error}</ErrorNote>
          {notice && <p className="rounded-xl bg-cream-200 px-4 py-3 text-sm text-charcoal-700">{notice}</p>}

          {isSignup && (
            <p className="text-xs leading-relaxed text-charcoal-400">
              By applying you accept the{' '}
              <Link to="/terms" className="font-medium text-rose-600 hover:underline">
                Terms &amp; payment policy
              </Link>{' '}
              (the review fee is non-refundable). Your information is handled as described in the{' '}
              <Link to="/privacy" className="font-medium text-rose-600 hover:underline">
                Privacy notice
              </Link>
              .
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy && <Spinner />}
            {isSignup ? 'Create account' : 'Log in'}
          </button>
        </form>

        {!hideSignupLink && (
          <p className="mt-6 text-center text-sm text-charcoal-500">
            {isSignup ? 'Already applied? ' : 'New here? '}
            <Link to={isSignup ? '/login' : '/signup'} className="font-medium text-rose-600 hover:underline">
              {isSignup ? 'Log in' : 'Apply now'}
            </Link>
          </p>
        )}
      </div>
    </Shell>
  )
}
