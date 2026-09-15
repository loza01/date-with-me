import { useRef, useState } from 'react'
import { supabase, PHOTO_BUCKET, photoUrl, readableError } from '../lib/supabase'
import { Spinner } from './Shell'

const MAX_PHOTOS = 4
const MAX_BYTES = 8 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

/** Uploads straight to Supabase Storage under `<userId>/`. */
export function PhotoUploader({ userId, paths, onChange }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState(null)

  const remaining = MAX_PHOTOS - paths.length - uploading

  async function uploadFiles(fileList) {
    setError(null)
    const files = Array.from(fileList).filter((f) => ACCEPTED.includes(f.type))
    if (files.length < fileList.length) setError('Only JPG, PNG, WEBP or HEIC images are accepted.')

    const batch = files.slice(0, Math.max(remaining, 0))
    if (files.length > batch.length) setError(`You can upload up to ${MAX_PHOTOS} photos.`)

    const tooBig = batch.find((f) => f.size > MAX_BYTES)
    if (tooBig) {
      setError('Each photo must be under 8 MB.')
      return
    }

    setUploading((n) => n + batch.length)
    const uploaded = []
    for (const file of batch) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${userId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, { contentType: file.type })
      if (uploadError) setError(readableError(uploadError))
      else uploaded.push(path)
      setUploading((n) => n - 1)
    }
    if (uploaded.length) onChange((current) => [...current, ...uploaded])
  }

  async function removePhoto(path) {
    onChange((current) => current.filter((p) => p !== path))
    await supabase.storage.from(PHOTO_BUCKET).remove([path])
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {paths.map((path, i) => (
          <div key={path} className="group relative aspect-3/4 overflow-hidden rounded-2xl bg-cream-200">
            <img src={photoUrl(path)} alt={`Your photo ${i + 1}`} className="size-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(path)}
              className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-charcoal-900/60 text-cream-50 backdrop-blur transition hover:bg-charcoal-900/80"
              aria-label={`Remove photo ${i + 1}`}
            >
              ×
            </button>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div
            key={`uploading-${i}`}
            className="flex aspect-3/4 items-center justify-center rounded-2xl bg-cream-200 text-rose-500"
          >
            <Spinner />
          </div>
        ))}
      </div>

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            uploadFiles(e.dataTransfer.files)
          }}
          className={`flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragging ? 'border-rose-400 bg-rose-50' : 'border-cream-300 bg-cream-50 hover:border-rose-300'
          }`}
        >
          <span className="font-medium text-charcoal-900">Drag photos here or tap to choose</span>
          <span className="text-sm text-charcoal-400">
            {paths.length} of 3–4 added · JPG, PNG, WEBP or HEIC, up to 8 MB
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        multiple
        hidden
        onChange={(e) => {
          uploadFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {error && <p className="text-sm text-rose-700">{error}</p>}
    </div>
  )
}
