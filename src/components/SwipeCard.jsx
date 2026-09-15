import { useRef, useState } from 'react'

const THRESHOLD = 110 // px of horizontal drag that counts as a swipe

/**
 * A draggable card. Drag past the threshold and release to swipe.
 *
 * props
 *   allow    { left: bool, right: bool }  which directions count
 *   exit     'left' | 'right' | null      set by the parent to fly the card out
 *   onSwipe  (direction) => void
 */
export function SwipeCard({ allow, exit, onSwipe, children }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef(null)
  const canDrag = (allow.left || allow.right) && !exit

  function onPointerDown(e) {
    if (!canDrag || e.button !== 0) return
    // Let buttons and form fields inside the card work normally.
    if (e.target.closest('button, input, select, textarea, label, a')) return
    start.current = e.clientX
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e) {
    if (start.current === null) return
    let next = e.clientX - start.current
    // Resist dragging toward a direction that isn't allowed.
    if ((next < 0 && !allow.left) || (next > 0 && !allow.right)) next /= 6
    setDx(next)
  }

  function onPointerUp() {
    if (start.current === null) return
    start.current = null
    setDragging(false)
    if (dx > THRESHOLD && allow.right) onSwipe('right')
    else if (dx < -THRESHOLD && allow.left) onSwipe('left')
    else setDx(0)
  }

  const offset = exit === 'right' ? window.innerWidth : exit === 'left' ? -window.innerWidth : dx
  const rotate = Math.max(-18, Math.min(18, offset / 18))
  const yesOpacity = exit === 'right' ? 1 : Math.max(0, Math.min(1, dx / THRESHOLD))
  const noOpacity = exit === 'left' ? 1 : Math.max(0, Math.min(1, -dx / THRESHOLD))

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        transform: `translateX(${offset}px) rotate(${rotate}deg)`,
        transition: dragging ? 'none' : 'transform 320ms cubic-bezier(.2,.8,.2,1)',
        touchAction: canDrag ? 'pan-y' : 'auto',
      }}
      className={`card relative flex min-h-[30rem] flex-col overflow-hidden p-7 select-none motion-reduce:transition-none sm:p-9 ${
        canDrag ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {allow.right && (
        <Stamp side="right" opacity={yesOpacity} className="border-sage-500 text-sage-600">
          Yes
        </Stamp>
      )}
      {allow.left && (
        <Stamp side="left" opacity={noOpacity} className="border-rose-500 text-rose-600">
          No
        </Stamp>
      )}
      {children}
    </div>
  )
}

function Stamp({ side, opacity, className, children }) {
  return (
    <span
      aria-hidden="true"
      style={{ opacity }}
      className={`pointer-events-none absolute top-6 rounded-lg border-[3px] px-3 py-1 text-2xl font-semibold tracking-widest uppercase ${
        side === 'right' ? 'left-6 -rotate-12' : 'right-6 rotate-12'
      } ${className}`}
    >
      {children}
    </span>
  )
}

export function CheckIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export function CrossIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
