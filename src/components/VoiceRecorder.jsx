import { useEffect, useRef, useState } from 'react'
import { supabase, VOICE_BUCKET, readableError } from '../lib/supabase'
import { Spinner } from './Shell'

const MAX_SECONDS = 30
const MIN_SECONDS = 10

// Chrome/Firefox record WebM/Opus, Safari records MP4/AAC.
const FORMATS = [
  { mime: 'audio/webm;codecs=opus', type: 'audio/webm', ext: 'webm' },
  { mime: 'audio/webm', type: 'audio/webm', ext: 'webm' },
  { mime: 'audio/mp4', type: 'audio/mp4', ext: 'm4a' },
  { mime: 'audio/ogg;codecs=opus', type: 'audio/ogg', ext: 'ogg' },
]

function pickFormat() {
  if (typeof MediaRecorder === 'undefined') return null
  return FORMATS.find((f) => MediaRecorder.isTypeSupported(f.mime)) ?? null
}

/**
 * Records a 10–30 second voice introduction, uploads it to the private
 * voice bucket, and reports { path, duration } (or null) via onChange.
 */
export function VoiceRecorder({ userId, value, onChange }) {
  const [phase, setPhase] = useState(value ? 'done' : 'idle') // idle | recording | uploading | done
  const [elapsed, setElapsed] = useState(0)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [error, setError] = useState(null)

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const startedAtRef = useRef(0)
  const tickRef = useRef(null)
  const stopTimerRef = useRef(null)

  const format = pickFormat()

  // Restored from a saved draft: fetch a short-lived link to play it back.
  useEffect(() => {
    if (!value?.path || previewUrl) return
    supabase.storage
      .from(VOICE_BUCKET)
      .createSignedUrl(value.path, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setPreviewUrl(data.signedUrl)
      })
  }, [value?.path, previewUrl])

  useEffect(() => () => stopEverything(), [])

  function stopEverything() {
    clearInterval(tickRef.current)
    clearTimeout(stopTimerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  async function start() {
    setError(null)
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      setError('Voice recording isn’t supported in this browser. Please try the latest Chrome or Safari.')
      return
    }

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Microphone access was blocked. Allow it in your browser settings and try again.')
      return
    }

    streamRef.current = stream
    const chunks = []
    const recorder = new MediaRecorder(stream, { mimeType: format.mime })
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    recorder.onstop = () => finish(new Blob(chunks, { type: format.type }))
    recorderRef.current = recorder

    recorder.start()
    startedAtRef.current = performance.now()
    setElapsed(0)
    setPhase('recording')
    tickRef.current = setInterval(() => setElapsed((performance.now() - startedAtRef.current) / 1000), 100)
    stopTimerRef.current = setTimeout(() => recorder.state === 'recording' && recorder.stop(), MAX_SECONDS * 1000)
  }

  function stop() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  async function finish(blob) {
    const duration = Math.min(MAX_SECONDS, (performance.now() - startedAtRef.current) / 1000)
    stopEverything()

    if (duration < MIN_SECONDS) {
      setPhase(value ? 'done' : 'idle')
      setError(`That was only ${Math.floor(duration)} seconds. Please speak for at least ${MIN_SECONDS} seconds.`)
      return
    }

    setPhase('uploading')
    const path = `${userId}/intro-${crypto.randomUUID()}.${format.ext}`
    const { error: uploadError } = await supabase.storage
      .from(VOICE_BUCKET)
      .upload(path, blob, { contentType: format.type })

    if (uploadError) {
      setPhase(value ? 'done' : 'idle')
      setError(readableError(uploadError))
      return
    }

    // Replace any earlier take.
    if (value?.path) supabase.storage.from(VOICE_BUCKET).remove([value.path])
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)

    setPreviewUrl(URL.createObjectURL(blob))
    onChange({ path, duration: Math.round(duration * 10) / 10 })
    setPhase('done')
  }

  const progress = Math.min(1, elapsed / MAX_SECONDS)

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-cream-300 bg-cream-100/60 p-6 text-center">
        {phase === 'recording' ? (
          <>
            <p className="flex items-center justify-center gap-2 text-sm font-medium text-rose-600">
              <span className="size-2.5 animate-pulse rounded-full bg-rose-500" />
              Recording
            </p>
            <p className="mt-2 font-serif text-5xl text-charcoal-900 tabular-nums">
              0:{String(Math.floor(elapsed)).padStart(2, '0')}
              <span className="text-2xl text-charcoal-400"> / 0:{MAX_SECONDS}</span>
            </p>
            <div className="mx-auto mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-cream-300">
              <div
                className={`h-full rounded-full ${elapsed >= MIN_SECONDS ? 'bg-sage-500' : 'bg-rose-400'}`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-charcoal-400">
              {elapsed < MIN_SECONDS
                ? `Keep going: at least ${MIN_SECONDS} seconds`
                : 'Stops automatically at 30 seconds'}
            </p>
            <button type="button" onClick={stop} className="btn-primary mt-5">
              <span className="size-3 rounded-sm bg-cream-50" />
              Stop
            </button>
          </>
        ) : phase === 'uploading' ? (
          <div className="flex items-center justify-center gap-3 py-6 text-charcoal-500">
            <Spinner className="text-rose-500" /> Saving your recording…
          </div>
        ) : phase === 'done' ? (
          <>
            <p className="text-sm font-medium text-sage-700">
              ✓ Voice introduction saved{value?.duration ? ` (${Math.round(value.duration)}s)` : ''}
            </p>
            {previewUrl && <audio controls src={previewUrl} className="mx-auto mt-4 w-full max-w-sm" />}
            <button type="button" onClick={start} className="btn-secondary mt-5">
              Record again
            </button>
          </>
        ) : (
          <>
            <p className="text-charcoal-500">
              Introduce yourself in your own voice: who you are, what you do, and what you’re looking for.
            </p>
            <button type="button" onClick={start} className="btn-primary mt-5">
              <MicIcon className="size-5" />
              Start recording
            </button>
            <p className="mt-3 text-xs text-charcoal-400">
              {MIN_SECONDS}–{MAX_SECONDS} seconds · heard only by me
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function MicIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}
