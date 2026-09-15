import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const SLIDES = [
  {
    kicker: 'I',
    title: 'The Hook',
    body: 'You are here because you are curious about the woman behind this private application. I value ultimate privacy, discretion, and good standards. If you are a 100% match and follow these requirements from start to finish, the veil will lift, and I’ll reveal my identity directly to you. For now, look closely at the clues ->',
  },
  {
    kicker: 'II',
    title: 'The Heritage & Covenant',
    body: 'I carry the ancient, light-skinned beauty and deep cultural pride of an East African woman, I am Orthodox. I’m 30 years old and stand at 160 cm.',
  },
  {
    kicker: 'III',
    title: 'The Mind',
    body: 'I’m genuinely secure in myself and love using my brain. I’m respectful and humble. I’m a Computer Science engineer and I work in tech.',
  },
  {
    kicker: 'IV',
    title: 'The Lifestyle',
    body: 'Entirely healthy, highly active, and exceptionally fit, I switch between travelling the world and enjoying quiet, elegant moments at home. I love to cook.',
  },
  {
    kicker: 'V',
    title: 'The Warning & Invitation',
    warning: true,
    body: 'This portal does not look for ordinary connections. If your mind is sharp and your intentions are serious, complete this application honestly. Also, if you are here for fun to see how this app works, you can explore :) But it doesn’t guarantee the possibility of meeting me. Looking forward to the men who will reach the last question! :)',
  },
]

/** Full-screen slideshow shown before any application inputs. */
export function EnigmaIntro({ onFinish }) {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]
  const last = index === SLIDES.length - 1

  const next = () => (last ? onFinish() : setIndex((i) => i + 1))
  const back = () => setIndex((i) => Math.max(0, i - 1))

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-charcoal-900 text-cream-50">
      {/* Soft light behind the text */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
          slide.warning
            ? 'bg-[radial-gradient(ellipse_at_top,rgba(191,76,97,0.45),transparent_65%)]'
            : 'bg-[radial-gradient(ellipse_at_top,rgba(242,195,202,0.14),transparent_60%)]'
        }`}
      />

      <header className="relative flex items-center justify-between px-5 pt-6 sm:px-8">
        <span className="font-serif text-xl tracking-wide text-cream-100">The Chosen Path</span>
        <span className="text-xs tracking-[0.3em] text-cream-200/60 uppercase tabular-nums">
          {index + 1} / {SLIDES.length}
        </span>
      </header>

      <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-10 sm:px-8">
        <div key={index} className="animate-[fadeUp_0.6s_ease-out] motion-reduce:animate-none">
          {slide.warning ? (
            <div className="rounded-3xl border border-rose-300/60 bg-rose-700/25 p-6 shadow-[0_0_60px_-10px_rgba(191,76,97,0.6)] backdrop-blur-sm sm:p-9">
              <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.35em] text-rose-200 uppercase">
                <span
                  aria-hidden="true"
                  className="flex size-7 items-center justify-center rounded-full border border-rose-200/70 text-sm"
                >
                  !
                </span>
                {slide.title}
              </p>
              <p className="mt-6 font-serif text-2xl leading-relaxed text-cream-50 sm:text-3xl">{slide.body}</p>
            </div>
          ) : (
            <>
              <p className="font-serif text-6xl text-rose-300/80 italic sm:text-7xl">{slide.kicker}</p>
              <p className="mt-4 text-xs font-medium tracking-[0.35em] text-rose-200 uppercase">{slide.title}</p>
              <div className="my-6 h-px w-16 bg-rose-300/60" />
              <p className="font-serif text-2xl leading-relaxed text-cream-100 sm:text-[1.9rem] sm:leading-relaxed">
                {slide.body}
              </p>
            </>
          )}
        </div>
      </main>

      <footer className="relative px-6 pb-8 sm:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="flex gap-2" aria-hidden="true">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? 'w-8 bg-rose-300' : 'w-1.5 bg-cream-50/30'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                className="px-3 py-3 text-sm text-cream-200/70 transition hover:text-cream-50"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              autoFocus
              className="inline-flex items-center gap-2 rounded-full bg-cream-50 px-7 py-3.5 font-medium text-charcoal-900 shadow-lg transition outline-none hover:bg-rose-100 focus-visible:ring-4 focus-visible:ring-rose-300/50"
            >
              {last ? 'Begin my application' : 'Next'}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-cream-200/40">
          <Link to="/privacy" className="underline underline-offset-2 hover:text-cream-100">
            Privacy notice
          </Link>
          {' · '}
          <Link to="/terms" className="underline underline-offset-2 hover:text-cream-100">
            Terms &amp; payment
          </Link>
        </p>
      </footer>
    </div>
  )
}
