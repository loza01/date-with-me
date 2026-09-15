import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { Shell, Spinner, ErrorNote, FullPageLoader } from '../components/Shell'

/** Opened from the reset email: the link signs the user in, then they choose a new password. */
export default function ResetPassword() {
  const { session, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (loading) return <FullPageLoader />

  if (!session) {
    return (
      <Shell>
        <div className="card p-6 text-center sm:p-10">
          <h1 className="font-serif text-3xl text-charcoal-900">This link has expired</h1>
          <p className="mt-3 text-charcoal-500">Reset links work once and only for a short time.</p>
          <Link to="/forgot-password" className="btn-primary mt-8">
            Send a new link
          </Link>
        </div>
      </Shell>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(
        /different from the old/i.test(updateError.message)
          ? 'Please choose a password you haven’t used before.'
          : 'Your password could not be changed. Please request a new link.',
      )
      setBusy(false)
      return
    }
    window.location.replace('/') // continue where they left off
  }

  return (
    <Shell>
      <div className="card p-6 sm:p-10">
        <h1 className="font-serif text-4xl text-charcoal-900">Choose a new password</h1>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="new-password" className="label">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="label">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input"
            />
          </div>
          <ErrorNote>{error}</ErrorNote>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy && <Spinner />}
            Save new password
          </button>
        </form>
      </div>
    </Shell>
  )
}
