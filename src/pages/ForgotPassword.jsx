import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Shell, Spinner, ErrorNote } from '../components/Shell'
import { SUPPORT_EMAIL } from '../config/privacy'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setBusy(false)
    // Same message whether or not the account exists.
    if (resetError && !/rate limit/i.test(resetError.message)) setError('Something went wrong. Please try again.')
    else if (resetError) setError('Too many requests. Please wait a few minutes and try again.')
    else setSent(true)
  }

  return (
    <Shell>
      <div className="card p-6 sm:p-10">
        <h1 className="font-serif text-4xl text-charcoal-900">Reset your password</h1>
        {sent ? (
          <>
            <p className="mt-4 leading-relaxed text-charcoal-600">
              If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way from{' '}
              <strong>{SUPPORT_EMAIL}</strong>. Check your spam folder if it doesn’t arrive within a few minutes.
            </p>
            <Link to="/login" className="btn-secondary mt-8 w-full">
              Back to log in
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <p className="text-charcoal-500">Enter the email you applied with and we’ll send you a reset link.</p>
            <div>
              <label htmlFor="reset-email" className="label">
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </div>
            <ErrorNote>{error}</ErrorNote>
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy && <Spinner />}
              Send reset link
            </button>
            <p className="text-center text-sm">
              <Link to="/login" className="font-medium text-rose-600 hover:underline">
                Back to log in
              </Link>
            </p>
          </form>
        )}
      </div>
    </Shell>
  )
}
