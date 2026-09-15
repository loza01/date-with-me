import { useState } from 'react'

export function TagInput({ id, tags, onChange, placeholder }) {
  const [draft, setDraft] = useState('')

  function commit() {
    const value = draft.trim().replace(/,$/, '')
    if (value && !tags.some((t) => t.toLowerCase() === value.toLowerCase()) && tags.length < 15) {
      onChange([...tags, value])
    }
    setDraft('')
  }

  return (
    <div className="input flex flex-wrap items-center gap-2 py-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-rose-100 py-1 pr-1.5 pl-3 text-sm text-rose-700"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            className="flex size-5 items-center justify-center rounded-full hover:bg-rose-200"
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Backspace' && !draft && tags.length) {
            onChange(tags.slice(0, -1))
          }
        }}
        onBlur={commit}
        placeholder={tags.length ? '' : placeholder}
        className="min-w-32 flex-1 bg-transparent py-1 outline-none placeholder:text-charcoal-400"
      />
    </div>
  )
}
