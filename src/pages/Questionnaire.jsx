import { useEffect, useEffectEvent, useReducer, useState } from 'react'
import { supabase, readableError, PHOTO_BUCKET, VOICE_BUCKET, ID_BUCKET } from '../lib/supabase'
import { hardDisconnect } from '../lib/disconnect'
import { useAuth } from '../context/useAuth'
import { QUESTIONS } from '../config/questions'
import { Shell, ErrorNote } from '../components/Shell'
import { ClosingModal } from '../components/ClosingModal'
import { ChampionPopup, MilestonePopup } from '../components/Celebration'
import { SwipeCard, CheckIcon, CrossIcon } from '../components/SwipeCard'
import { ageOn, formatBirthday } from '../lib/birthday'
import { nationalityLabel } from '../config/countries'

/*
 * Card flow
 *
 *   answering ──SWIPE──▶ submitting ──ADVANCE─▶ answering (next card)
 *       ▲                   │ ├─────DONE────▶ done   → /final-step
 *       └──────FAILED───────┘ └─────END─────▶ ended  → closing modal
 *
 * The page knows nothing about which answers matter: the server replies only
 * { success, step, done }.
 */
const EXIT_ANIMATION_MS = 320
const MILESTONE_AFTER = 10 // "Ok ok, seems few to go!" after this many answers
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function initState(profile) {
  return {
    phase: profile.status === 'rejected' ? 'ended' : 'answering',
    step: Math.min(profile.current_step, QUESTIONS.length - 1),
    exit: null,
    error: null,
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'SWIPE':
      return state.phase === 'answering'
        ? { ...state, phase: 'submitting', exit: action.direction, error: null }
        : state
    case 'ADVANCE':
      return { phase: 'answering', step: action.step, exit: null, error: null }
    case 'DONE':
      return { ...state, phase: 'done' }
    case 'END':
      return { ...state, phase: 'ended', exit: null, error: null }
    case 'FAILED':
      return { ...state, phase: 'answering', exit: null, error: action.error }
    default:
      return state
  }
}

export default function Questionnaire() {
  const { profile, refreshProfile } = useAuth()
  const [state, dispatch] = useReducer(reducer, profile, initState)
  const question = QUESTIONS[state.step]

  // Celebrations: once each per application.
  const [celebration, setCelebration] = useState(null) // 'milestone' | 'champion' | null
  function celebrateOnce(kind) {
    // consent_at is set each time a profile is submitted, so a new application celebrates again.
    const key = `celebrated-${kind}-${profile.id}-${profile.consent_at ?? profile.created_at}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch {
      // Storage unavailable: celebrate anyway.
    }
    setCelebration(kind)
  }

  // Answer from input cards (religion, height…); belongs to the card it was typed on.
  const [draftEntry, setDraftEntry] = useState({ step: state.step, value: null })
  const draft = draftEntry.step === state.step ? draftEntry.value : null
  const setDraft = (value) => setDraftEntry({ step: state.step, value })

  async function swipe(direction, answer) {
    if (state.phase !== 'answering') return
    dispatch({ type: 'SWIPE', direction })

    const [{ data, error }] = await Promise.all([
      supabase.rpc('submit_answer', { p_question_id: question.id, p_answer: answer }),
      wait(EXIT_ANIMATION_MS), // let the card fly out before showing what's next
    ])

    if (error) {
      dispatch({ type: 'FAILED', error: readableError(error) })
      if (/out_of_order|not_screening/.test(error.message)) await refreshProfile()
      return
    }

    if (!data.success) dispatch({ type: 'END' })
    else if (data.done) {
      dispatch({ type: 'DONE' })
      await refreshProfile() // status "contact" → router moves to /final-step
    } else {
      dispatch({ type: 'ADVANCE', step: data.step })
      if (data.step === QUESTIONS.length - 1) celebrateOnce('champion')
      else if (data.step === MILESTONE_AFTER) celebrateOnce('milestone')
    }
  }

  // What each direction/button means for the current card.
  const actions = {
    binary: { left: { value: 'no' }, right: { value: 'yes' } },
    confirm: { right: { value: 'yes' } },
    relocation: { left: { value: 'no' }, right: { value: 'yes' } },
    choice: { right: draft },
    height: { right: draft },
    multi: { right: draft },
    pair: { right: draft },
    text: { right: question.optional ? (draft ?? { value: '' }) : draft },
  }[question.type]

  const canLeft = Boolean(actions.left)
  const canRight = Boolean(actions.right)
  const busy = state.phase !== 'answering' || Boolean(celebration)

  // Keyboard: ← / → when focus isn't in a form field.
  const onKey = useEffectEvent((e) => {
    if (celebration || e.target.closest?.('input, select, textarea')) return
    if (e.key === 'ArrowRight' && canRight) swipe('right', actions.right)
    if (e.key === 'ArrowLeft' && canLeft) swipe('left', actions.left)
  })
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Multi-select cards report every change; the server decides if it matters.
  async function checkSelection(answer) {
    const { data, error } = await supabase.rpc('check_selection', { p_question_id: question.id, p_answer: answer })
    if (!error && data && !data.success) dispatch({ type: 'END' })
  }

  async function sendExitMessageAndDisconnect(message) {
    // The purge: delete every uploaded file through the Storage API first
    // (the server refuses to close the application while any remain).
    const purgeError = await purgeOwnFiles(profile.id)
    if (purgeError) return purgeError

    const { data, error } = await supabase.rpc('submit_exit_message', { p_message: message })
    if (error) return readableError(error)
    // Reusable test accounts are reset server-side, so don't block this browser.
    await hardDisconnect({ blockDevice: !data?.reusable })
    return null
  }

  const ended = state.phase === 'ended'

  return (
    <>
      <div aria-hidden={ended} className={ended ? 'pointer-events-none blur-sm select-none' : ''}>
        <Shell>
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-medium tracking-[0.2em] text-rose-500 uppercase">
              <span>Do we match?</span>
              <span className="tabular-nums">
                {state.step + 1} / {QUESTIONS.length}
              </span>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-cream-300">
              <div
                className="h-full rounded-full bg-rose-500 transition-[width] duration-500"
                style={{ width: `${(state.step / QUESTIONS.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="relative">
            {/* Decorative stack behind the active card */}
            <div aria-hidden="true" className="card absolute inset-x-6 -bottom-4 top-4 opacity-50" />
            <div aria-hidden="true" className="card absolute inset-x-3 -bottom-2 top-2 opacity-80" />

            {ended ? (
              // Card hidden behind the modal.
              <div className="card relative min-h-[30rem]" />
            ) : (
              <div key={question.id} className="relative animate-[fadeUp_0.35s_ease-out]">
                <SwipeCard
                  allow={{ left: canLeft && !busy, right: canRight && !busy }}
                  exit={state.exit}
                  onSwipe={(dir) => swipe(dir, dir === 'right' ? actions.right : actions.left)}
                >
                  <p className="text-xs font-medium tracking-[0.25em] text-rose-500 uppercase">{question.eyebrow}</p>
                  <h1
                    className={
                      question.type === 'pair'
                        ? 'sr-only'
                        : 'mt-3 font-serif text-3xl leading-snug text-charcoal-900 sm:text-[2.1rem]'
                    }
                  >
                    {question.title}
                  </h1>
                  {question.intro && <p className="mt-3 leading-relaxed text-charcoal-500">{question.intro}</p>}
                  {question.hint && <p className="mt-2 text-sm text-charcoal-400">{question.hint}</p>}

                  <div className="mt-auto pt-8">
                    <CardBody
                      question={question}
                      profile={profile}
                      onDraft={setDraft}
                      onSelectionChange={checkSelection}
                      disabled={busy}
                    />
                  </div>

                  {/* Answer buttons live at the bottom of the card */}
                  <div className="mt-8 border-t border-cream-300/70 pt-6">
                    <div className="flex items-center justify-center gap-4 sm:gap-5">
                      {canLeft && (
                        <RoundButton label="No" onClick={() => swipe('left', actions.left)} disabled={busy} tone="no">
                          <CrossIcon className="size-7" />
                        </RoundButton>
                      )}
                      {question.type === 'relocation' && (
                        <button
                          type="button"
                          onClick={() => swipe('right', { value: 'maybe' })}
                          disabled={busy}
                          className="btn-secondary h-16 px-6"
                        >
                          Let’s see…
                        </button>
                      )}
                      <RoundButton
                        label={question.type === 'confirm' ? 'Confirm' : 'Yes'}
                        onClick={() => swipe('right', actions.right)}
                        disabled={busy || !canRight}
                        tone="yes"
                      >
                        <CheckIcon className="size-7" />
                      </RoundButton>
                    </div>
                    <p className="mt-3 text-center text-xs text-charcoal-400">
                      {canLeft
                        ? 'Swipe right for yes, left for no'
                        : question.type === 'confirm'
                          ? 'Swipe right or tap ✓ to confirm'
                          : question.type === 'text'
                            ? question.optional
                              ? 'Optional. Tap ✓ to continue'
                              : 'Write at least 10 characters, then tap ✓'
                            : question.type === 'pair'
                              ? 'Answer both, then tap ✓'
                              : 'Tap ✓ to continue'}
                    </p>
                  </div>
                </SwipeCard>
              </div>
            )}
          </div>

          {!ended && (
            <>
              {state.error && (
                <div className="mt-8">
                  <ErrorNote>{state.error}</ErrorNote>
                </div>
              )}
            </>
          )}
        </Shell>
      </div>

      {ended && <ClosingModal onSubmit={sendExitMessageAndDisconnect} />}
      {!ended && celebration === 'milestone' && <MilestonePopup onContinue={() => setCelebration(null)} />}
      {!ended && celebration === 'champion' && <ChampionPopup onContinue={() => setCelebration(null)} />}
    </>
  )
}

function RoundButton({ label, tone, children, ...props }) {
  const tones = {
    yes: 'bg-sage-600 text-cream-50 hover:bg-sage-700 focus-visible:ring-sage-200',
    no: 'bg-cream-50 text-rose-600 border border-rose-200 hover:bg-rose-50 focus-visible:ring-rose-100',
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`flex size-16 items-center justify-center rounded-full shadow-md transition outline-none focus-visible:ring-4 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
      {...props}
    >
      {children}
    </button>
  )
}

async function purgeOwnFiles(userId) {
  for (const bucket of [PHOTO_BUCKET, VOICE_BUCKET, ID_BUCKET]) {
    const { data: files, error } = await supabase.storage.from(bucket).list(userId, { limit: 1000 })
    if (error) return readableError(error)
    if (files?.length) {
      const { error: removeError } = await supabase.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`))
      if (removeError) return readableError(removeError)
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Card bodies                                                          */
/* ------------------------------------------------------------------ */

function CardBody({ question, profile, onDraft, onSelectionChange, disabled }) {
  switch (question.type) {
    case 'confirm':
      return question.id === 'age' ? (
        <div>
          <p className="font-serif text-7xl text-rose-600 tabular-nums">
            {ageOn(profile.date_of_birth) ?? profile.age}
          </p>
          {profile.date_of_birth && (
            <p className="mt-2 text-charcoal-500">Born {formatBirthday(profile.date_of_birth)}</p>
          )}
        </div>
      ) : (
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact term="Nationality" value={nationalityLabel(profile.nationality)} />
          <Fact term="Lives in" value={profile.residence_country} />
        </dl>
      )
    case 'choice':
      return <ChoiceBody options={question.options} columns={question.columns} onDraft={onDraft} disabled={disabled} />
    case 'multi':
      return (
        <MultiBody
          options={question.options}
          onDraft={onDraft}
          onSelectionChange={onSelectionChange}
          disabled={disabled}
        />
      )
    case 'pair':
      return <PairBody fields={question.fields} onDraft={onDraft} disabled={disabled} />
    case 'text':
      return (
        <TextBody
          placeholder={question.placeholder}
          optional={question.optional}
          onDraft={onDraft}
          disabled={disabled}
        />
      )
    case 'height':
      return <HeightBody onDraft={onDraft} disabled={disabled} />
    default:
      return null
  }
}

function Fact({ term, value }) {
  return (
    <div className="rounded-2xl bg-cream-100 px-5 py-4">
      <dt className="text-xs tracking-wider text-charcoal-400 uppercase">{term}</dt>
      <dd className="mt-1 font-serif text-2xl text-charcoal-900">{value}</dd>
    </div>
  )
}

function ChoiceBody({ options, columns = 2, onDraft, disabled }) {
  const [value, setValue] = useState('')
  return (
    <fieldset className={`grid gap-2.5 ${columns === 1 ? 'grid-cols-1' : 'grid-cols-2'}`} disabled={disabled}>
      <legend className="sr-only">Choose one</legend>
      {options.map((opt) => {
        const checked = value === opt.value
        return (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-center justify-center rounded-2xl border px-3 py-3 text-center text-sm font-medium transition has-focus-visible:ring-4 has-focus-visible:ring-rose-100 ${
              checked
                ? 'border-rose-400 bg-rose-50 text-rose-700'
                : 'border-cream-300 bg-cream-50 hover:border-rose-200'
            }`}
          >
            <input
              type="radio"
              name="choice"
              className="sr-only"
              checked={checked}
              onChange={() => {
                setValue(opt.value)
                onDraft({ value: opt.value })
              }}
            />
            {opt.label}
          </label>
        )
      })}
    </fieldset>
  )
}

function MultiBody({ options, onDraft, onSelectionChange, disabled }) {
  const [selected, setSelected] = useState([])

  function toggle(option) {
    const next = selected.includes(option.value)
      ? selected.filter((v) => v !== option.value)
      : [...selected, option.value]
    setSelected(next)
    onDraft(next.length ? { values: next } : null)
    if (next.length) onSelectionChange({ values: next })
  }

  return (
    <fieldset className="flex flex-wrap gap-2" disabled={disabled}>
      <legend className="sr-only">Select all that apply</legend>
      {options.map((opt) => {
        const checked = selected.includes(opt.value)
        return (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition has-focus-visible:ring-4 has-focus-visible:ring-rose-100 ${
              checked
                ? 'border-rose-400 bg-rose-50 text-rose-700'
                : 'border-cream-300 bg-cream-50 hover:border-rose-200'
            }`}
          >
            <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(opt)} />
            {checked && <span aria-hidden="true">✓</span>}
            {opt.label}
          </label>
        )
      })}
    </fieldset>
  )
}

function PairBody({ fields, onDraft, disabled }) {
  const [answers, setAnswers] = useState({})

  function choose(key, value) {
    const next = { ...answers, [key]: value }
    setAnswers(next)
    onDraft(fields.every((f) => next[f.key]) ? next : null)
  }

  return (
    <div className="space-y-6">
      {fields.map((field) => (
        <fieldset key={field.key} disabled={disabled}>
          <legend className="mb-3 font-serif text-2xl leading-snug text-charcoal-900 sm:text-[1.7rem]">
            {field.label}
          </legend>
          <div className="grid grid-cols-2 gap-2.5">
            {['yes', 'no'].map((value) => {
              const checked = answers[field.key] === value
              return (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center justify-center rounded-2xl border px-3 py-3 text-sm font-medium transition has-focus-visible:ring-4 has-focus-visible:ring-rose-100 ${
                    checked
                      ? 'border-rose-400 bg-rose-50 text-rose-700'
                      : 'border-cream-300 bg-cream-50 hover:border-rose-200'
                  }`}
                >
                  <input
                    type="radio"
                    name={field.key}
                    className="sr-only"
                    checked={checked}
                    onChange={() => choose(field.key, value)}
                  />
                  {value === 'yes' ? 'Yes' : 'No'}
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

const TEXT_MIN = 10
const TEXT_MAX = 1000

function TextBody({ placeholder, optional, onDraft, disabled }) {
  const [value, setValue] = useState('')
  return (
    <div>
      <label htmlFor="card-text" className="sr-only">
        Your answer
      </label>
      <textarea
        id="card-text"
        rows={5}
        maxLength={TEXT_MAX}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value)
          const trimmed = e.target.value.trim()
          onDraft(optional || trimmed.length >= TEXT_MIN ? { value: trimmed } : null)
        }}
        className="input resize-none"
      />
      <p className="mt-1.5 text-right text-xs text-charcoal-400 tabular-nums">
        {value.length}/{TEXT_MAX}
      </p>
    </div>
  )
}

function HeightBody({ onDraft, disabled }) {
  const [unit, setUnit] = useState('cm')
  const [cm, setCm] = useState('')
  const [feet, setFeet] = useState('')
  const [inches, setInches] = useState('')

  const centimetres = unit === 'cm' ? Number(cm) : Math.round((Number(feet || 0) * 12 + Number(inches || 0)) * 2.54)
  const valid = centimetres >= 100 && centimetres <= 250

  useEffect(() => {
    onDraft(valid ? { value: centimetres, unit_entered: unit } : null)
  }, [centimetres, valid, unit, onDraft])

  return (
    <fieldset disabled={disabled}>
      <div className="mb-4 inline-flex rounded-full border border-cream-300 bg-cream-100 p-1">
        {['cm', 'ft/in'].map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => setUnit(u)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              unit === u ? 'bg-cream-50 text-charcoal-900 shadow-sm' : 'text-charcoal-500'
            }`}
          >
            {u}
          </button>
        ))}
      </div>

      {unit === 'cm' ? (
        <UnitInput id="cm" label="Height in centimetres" unit="cm" value={cm} onChange={setCm} min={100} max={250} />
      ) : (
        <div className="flex gap-3">
          <UnitInput id="feet" label="Feet" unit="ft" value={feet} onChange={setFeet} min={3} max={8} />
          <UnitInput id="inches" label="Inches" unit="in" value={inches} onChange={setInches} min={0} max={11} />
        </div>
      )}
    </fieldset>
  )
}

function UnitInput({ id, label, unit, value, onChange, min, max }) {
  return (
    <div className="relative max-w-40 flex-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input pr-12 text-lg"
      />
      <span className="absolute top-1/2 right-4 -translate-y-1/2 text-charcoal-400">{unit}</span>
    </div>
  )
}
