import { Link } from 'react-router-dom'

export function Shell({ children, wide = false, footer = true }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_top,var(--color-rose-100),transparent_60%)]">
      <header className="px-5 pt-6 sm:px-8">
        <Link to="/" className="font-serif text-xl tracking-wide text-charcoal-900">
          The Chosen Path
        </Link>
      </header>
      <main className={`mx-auto w-full flex-1 px-5 py-8 sm:px-8 sm:py-12 ${wide ? 'max-w-6xl' : 'max-w-xl'}`}>
        {children}
      </main>
      {footer && (
        <footer className="px-5 pb-6 text-center text-xs text-charcoal-400 sm:px-8">
          Private &amp; confidential ·{' '}
          <Link
            to="/privacy"
            className="underline decoration-charcoal-400/40 underline-offset-2 hover:text-charcoal-700"
          >
            Privacy notice
          </Link>{' '}
          ·{' '}
          <Link to="/terms" className="underline decoration-charcoal-400/40 underline-offset-2 hover:text-charcoal-700">
            Terms &amp; payment
          </Link>
        </footer>
      )}
    </div>
  )
}

export function Spinner({ className = '' }) {
  return (
    <span
      className={`inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
      aria-hidden="true"
    />
  )
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-rose-500">
      <Spinner className="size-8" />
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function ErrorNote({ children }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {children}
    </p>
  )
}
