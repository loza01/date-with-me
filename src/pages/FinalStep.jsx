import { useState } from 'react'
import { supabase, readableError } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { Shell, Spinner, ErrorNote } from '../components/Shell'

export default function FinalStep() {
  const { refreshProfile } = useAuth()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const digits = phone.replace(/\D/g, '')
  const looksValid = /^\+?[0-9 ().-]+$/.test(phone.trim()) && digits.length >= 7 && digits.length <= 15

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error: rpcError } = await supabase.rpc('submit_contact', { p_phone: phone })
    if (rpcError) {
      setError(readableError(rpcError))
      setBusy(false)
      return
    }
    await refreshProfile() // status "completed" → /complete
  }

  return (
    <Shell>
      <form onSubmit={handleSubmit} className="card animate-[fadeUp_0.4s_ease-out] p-7 text-center sm:p-10">
        <p className="text-xs font-medium tracking-[0.3em] text-sage-600 uppercase">100% match</p>
        <h1 className="mt-3 font-serif text-4xl text-charcoal-900 sm:text-5xl">Wonderful!</h1>
        <div className="mx-auto my-6 h-px w-12 bg-rose-300" />
        <p className="leading-relaxed text-charcoal-500">
          To ensure maximum privacy, I reveal my identity and photos directly through FaceTime. Please leave your phone
          number here.
        </p>

        <div className="mx-auto mt-8 max-w-sm text-left">
          <label htmlFor="phone" className="label">
            Phone number
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="+44 7700 900123"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input text-lg"
          />
          <p className="mt-1.5 text-xs text-charcoal-400">Include your country code. Shared only with me.</p>
        </div>

        <div className="mx-auto mt-6 max-w-sm">
          <ErrorNote>{error}</ErrorNote>
        </div>

        <button type="submit" disabled={busy || !looksValid} className="btn-primary mt-6 w-full max-w-sm">
          {busy && <Spinner />}
          Submit Application
        </button>
      </form>
    </Shell>
  )
}
