import { useEffect, useRef } from 'react'

const BALLOON_COLORS = ['#e598a4', '#bf4c61', '#f2c3ca', '#6f9274', '#f0c36d', '#8fb3d9', '#d56d7e']
const CONFETTI_COLORS = ['#bf4c61', '#f0c36d', '#6f9274', '#8fb3d9', '#e598a4', '#fffcf8']

// Random layouts are generated once when the module loads, so rendering stays pure.
const BALLOONS = Array.from({ length: 28 }, (_, i) => ({
  left: Math.random() * 100,
  delay: Math.random() * 1.8,
  duration: 4.5 + Math.random() * 3,
  size: 42 + Math.random() * 34,
  sway: (Math.random() * 2 - 1) * 40,
  color: BALLOON_COLORS[i % BALLOON_COLORS.length],
}))

const CONFETTI = Array.from({ length: 120 }, (_, i) => ({
  left: Math.random() * 100,
  delay: Math.random() * 1.2,
  duration: 2.6 + Math.random() * 2.2,
  rotate: Math.random() * 720,
  w: 6 + Math.random() * 6,
  h: 10 + Math.random() * 8,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}))

/** Balloons floating up across the whole screen. */
function Balloons() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {BALLOONS.map((b, i) => (
        <span
          key={i}
          className="absolute bottom-[-140px] block animate-[balloonUp_var(--d)_ease-in_var(--delay)_forwards] motion-reduce:hidden"
          style={{ left: `${b.left}%`, '--d': `${b.duration}s`, '--delay': `${b.delay}s`, '--sway': `${b.sway}px` }}
        >
          <svg width={b.size} height={b.size * 1.9} viewBox="0 0 40 76">
            <ellipse cx="20" cy="20" rx="18" ry="20" fill={b.color} />
            <ellipse cx="13" cy="12" rx="4" ry="6" fill="#fff" opacity="0.35" />
            <path d="M17 39 L20 43 L23 39 Z" fill={b.color} />
            <path d="M20 43 C 16 52, 24 58, 19 76" stroke="#7a7470" strokeWidth="1" fill="none" />
          </svg>
        </span>
      ))}
    </div>
  )
}

/** Confetti raining down. */
function Confetti() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {CONFETTI.map((p, i) => (
        <span
          key={i}
          className="absolute top-[-20px] block rounded-sm animate-[confettiFall_var(--d)_linear_var(--delay)_forwards] motion-reduce:hidden"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.h,
            background: p.color,
            '--d': `${p.duration}s`,
            '--delay': `${p.delay}s`,
            '--r': `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  )
}

/** A short fanfare made with the Web Audio API (no sound files). */
function playFanfare() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const note = (freq, start, length, type = 'triangle', volume = 0.18) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, ctx.currentTime + start)
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + length)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + length + 0.05)
    }
    // G4 C5 E5 G5 … C6 with a closing chord
    ;[
      [392, 0, 0.18],
      [523.25, 0.16, 0.18],
      [659.25, 0.32, 0.18],
      [783.99, 0.48, 0.3],
      [659.25, 0.78, 0.14],
      [783.99, 0.92, 0.2],
    ].forEach(([f, s, l]) => note(f, s, l))
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f) => note(f, 1.15, 1.3, 'sine', 0.12))
    setTimeout(() => ctx.close(), 3000)
  } catch {
    // Sound is a bonus; ignore if the browser blocks it.
  }
}

function useFocus() {
  const ref = useRef(null)
  useEffect(() => ref.current?.focus(), [])
  return ref
}

export function MilestonePopup({ onContinue }) {
  const buttonRef = useFocus()
  return (
    <>
      <Balloons />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/30 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="milestone-title"
      >
        <div className="card w-full max-w-sm animate-[popIn_0.45s_cubic-bezier(.2,1.4,.4,1)] p-8 text-center">
          <p className="text-5xl" aria-hidden="true">
            🎈
          </p>
          <h2 id="milestone-title" className="mt-4 font-serif text-3xl text-charcoal-900">
            Ok ok, seems few to go!
          </h2>
          <button ref={buttonRef} type="button" onClick={onContinue} className="btn-primary mt-8 w-full">
            Continue
          </button>
        </div>
      </div>
    </>
  )
}

export function ChampionPopup({ onContinue }) {
  const buttonRef = useFocus()
  useEffect(() => {
    playFanfare()
  }, [])
  return (
    <>
      <Confetti />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/40 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="champion-title"
      >
        <div className="card w-full max-w-sm animate-[popIn_0.5s_cubic-bezier(.2,1.4,.4,1)] p-8 text-center">
          <p
            className="inline-block animate-[trophy_1.2s_ease-in-out_infinite] text-7xl motion-reduce:animate-none"
            aria-hidden="true"
          >
            🏆
          </p>
          <h2 id="champion-title" className="mt-4 font-serif text-4xl text-charcoal-900">
            Champion!
          </h2>
          <p className="mt-2 text-charcoal-500">You reached the last question.</p>
          <button ref={buttonRef} type="button" onClick={onContinue} className="btn-primary mt-8 w-full">
            Continue
          </button>
        </div>
      </div>
    </>
  )
}
