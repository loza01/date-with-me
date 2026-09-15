import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase, readableError } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { Shell, Spinner, ErrorNote } from '../components/Shell'
import { Link } from 'react-router-dom'
import { PAYMENT_CONSENT_TEXT, PAYMENT_DISCLAIMER, REVIEW_FEE, TERMS_VERSION } from '../config/payment'

export default function Payment() {
  const { refreshProfile } = useAuth()
  const [params] = useSearchParams()
  const returning = params.has('session_id')
  const cancelled = params.has('cancelled')

  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState(null)

  // Every visit asks the server to check with Stripe, so a payment made in
  // another tab (or before the browser returned) is never lost.
  useEffect(() => {
    let active = true
    async function check(attempt = 1) {
      const { data, error: rpcError } = await supabase.rpc('confirm_payment')
      if (!active) return
      if (!rpcError && data?.paid) {
        await refreshProfile() // → questionnaire
        return
      }
      // Stripe can take a moment to mark a fresh payment as paid.
      if (returning && attempt < 6) {
        setTimeout(() => check(attempt + 1), 1500)
        return
      }
      if (rpcError && !/payments_not_configured/.test(rpcError.message)) setError(readableError(rpcError))
      setChecking(false)
    }
    check()
    return () => {
      active = false
    }
  }, [returning, refreshProfile])

  async function pay() {
    setBusy(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('start_checkout', {
      p_terms_version: agreed ? TERMS_VERSION : '',
      p_return_origin: window.location.origin,
    })
    if (rpcError || !data?.url) {
      setError(readableError(rpcError) ?? 'Payment could not be started. Please try again.')
      setBusy(false)
      return
    }
    window.location.assign(data.url) // Stripe's secure checkout page
  }

  if (checking) {
    return (
      <Shell>
        <div className="card flex flex-col items-center gap-4 p-10 text-center">
          <Spinner className="size-8 text-rose-500" />
          <p className="text-charcoal-500">{returning ? 'Confirming your payment…' : 'One moment…'}</p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="mb-6">
        <p className="text-xs font-medium tracking-[0.3em] text-rose-500 uppercase">Before the questions</p>
        <h1 className="mt-2 font-serif text-4xl text-charcoal-900">{PAYMENT_DISCLAIMER.title}</h1>
        <p className="mt-2 text-charcoal-500">{PAYMENT_DISCLAIMER.intro}</p>
      </div>

      <div className="card space-y-6 p-6 sm:p-9">
        {cancelled && (
          <p className="rounded-xl bg-cream-200 px-4 py-3 text-sm text-charcoal-700">
            Payment cancelled. You have not been charged.
          </p>
        )}

        <ol className="space-y-4">
          {PAYMENT_DISCLAIMER.points.map(([title, text], i) => (
            <li key={title} className="flex gap-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-sm font-semibold text-rose-600">
                {i + 1}
              </span>
              <p className="leading-relaxed text-charcoal-700">
                <strong className="text-charcoal-900">{title}.</strong> {text}
              </p>
            </li>
          ))}
        </ol>

        <label
          htmlFor="payment-consent"
          className="flex cursor-pointer gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-sm leading-relaxed text-charcoal-700"
        >
          <input
            id="payment-consent"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-rose-600"
          />
          <span>{PAYMENT_CONSENT_TEXT}</span>
        </label>
        <p className="-mt-3 text-xs text-charcoal-400">
          Read the{' '}
          <Link to="/terms" target="_blank" className="text-rose-600 hover:underline">
            Terms &amp; payment policy
          </Link>{' '}
          and the{' '}
          <Link to="/privacy" target="_blank" className="text-rose-600 hover:underline">
            Privacy notice
          </Link>
          .
        </p>

        <ErrorNote>{error}</ErrorNote>

        <button type="button" onClick={pay} disabled={!agreed || busy} className="btn-primary w-full">
          {busy && <Spinner />}
          Pay {REVIEW_FEE} and continue
        </button>
        <p className="text-center text-xs text-charcoal-400">
          Secure payment by Stripe. Your card details never reach this site.
        </p>
      </div>
    </Shell>
  )
}
