import { useEffect, useRef, useState } from 'react'
import { supabase, ID_BUCKET, readableError } from '../lib/supabase'
import { Spinner } from './Shell'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

/**
 * One government ID photo (or PDF), uploaded to the PRIVATE id bucket under
 * `<userId>/`. Reports the storage path (or null) via onChange.
 */
export function IdDocumentUploader({ userId, value, onChange }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null) // { url, isPdf }
  const [error, setError] = useState(null)

  // Restored from a saved draft: fetch a short-lived link to show it again.
  useEffect(() => {
    if (!value || preview) return
    supabase.storage
      .from(ID_BUCKET)
      .createSignedUrl(value, 600)
      .then(({ data }) => {
        if (data?.signedUrl) setPreview({ url: data.signedUrl, isPdf: value.endsWith('.pdf') })
      })
  }, [value, preview])

  async function upload(file) {
    setError(null)
    if (!file) return
    if (!ACCEPTED.includes(file.type)) return setError('Please upload a JPG, PNG, WEBP, HEIC or PDF.')
    if (file.size > MAX_BYTES) return setError('The file must be under 10 MB.')

    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/id-${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from(ID_BUCKET).upload(path, file, { contentType: file.type })
    setUploading(false)
    if (uploadError) return setError(readableError(uploadError))

    if (value) supabase.storage.from(ID_BUCKET).remove([value]) // replace the earlier upload
    if (preview?.url.startsWith('blob:')) URL.revokeObjectURL(preview.url)
    setPreview({ url: URL.createObjectURL(file), isPdf: file.type === 'application/pdf' })
    onChange(path)
  }

  async function remove() {
    if (value) await supabase.storage.from(ID_BUCKET).remove([value])
    setPreview(null)
    onChange(null)
  }

  return (
    <div className="space-y-3">
      {value && preview ? (
        <div className="flex items-center gap-4 rounded-2xl border border-sage-200 bg-sage-200/20 p-3">
          {preview.isPdf ? (
            <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-cream-200 text-sm font-medium text-charcoal-500">
              PDF
            </div>
          ) : (
            <img
              src={preview.url}
              alt="Your ID document"
              className="h-20 w-28 shrink-0 rounded-xl object-cover blur-[2px]"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-sage-700">✓ ID uploaded securely</p>
            <p className="text-xs text-charcoal-400">Private: seen only by me, never shown publicly.</p>
          </div>
          <button type="button" onClick={remove} className="text-sm font-medium text-rose-600 hover:underline">
            Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-cream-300 bg-cream-50 px-4 py-6 text-center transition hover:border-rose-300"
        >
          {uploading ? (
            <span className="flex items-center gap-2 text-charcoal-500">
              <Spinner className="text-rose-500" /> Uploading securely…
            </span>
          ) : (
            <>
              <span className="font-medium text-charcoal-900">Upload driver’s license or passport</span>
              <span className="text-sm text-charcoal-400">Photo or PDF, up to 10 MB</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        hidden
        data-id-document
        onChange={(e) => {
          upload(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {error && (
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
