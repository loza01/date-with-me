import { useEffect, useRef, useState } from 'react'
import { Spinner, ErrorNote } from './Shell'

/**
 * Blocking closing modal: one sentence and a Close button. It cannot be
 * dismissed any other way (no Escape, no backdrop click). Close runs the
 * disconnect sequence.
 */
export function ClosingModal({ onSubmit }) {
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    buttonRef.current?.focus()
    const blockEscape = (e) => e.key === 'Escape' && e.preventDefault()
    document.addEventListener('keydown', blockEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', blockEscape)
      document.body.style.overflow = ''
    }
  }, [])

  async function close() {
    setClosing(true)
    setError(null)
    const failure = await onSubmit('')
    // On success the page is replaced, so we only get here on failure.
    if (failure) {
      setError(failure)
      setClosing(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/40 p-4 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="closing-title"
    >
      <div className="card w-full max-w-sm animate-[fadeUp_0.4s_ease-out] p-8 text-center sm:p-10">
        <h2 id="closing-title" className="font-serif text-3xl leading-snug text-charcoal-900">
          Oh no, unfortunately this is not a match.
        </h2>

        {error && (
          <div className="mt-5">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        <button ref={buttonRef} type="button" onClick={close} disabled={closing} className="btn-secondary mt-8 w-full">
          {closing && <Spinner />}
          Close
        </button>
      </div>
    </div>
  )
}
