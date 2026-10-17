import { useEffect, useState } from 'react'
import { supabase, readableError } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { AFRICAN, AFRICAN_COUNTRY_SUGGESTIONS, COUNTRY_OPTIONS, NATIONALITY_OPTIONS } from '../config/countries'
import { CAREERS } from '../config/careers'
import { Shell, Spinner, ErrorNote } from '../components/Shell'
import { PhotoUploader } from '../components/PhotoUploader'
import { TagInput } from '../components/TagInput'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { DateOfBirthPicker } from '../components/DateOfBirthPicker'
import { EnigmaIntro } from '../components/EnigmaIntro'
import { ageOn, toIsoDate } from '../lib/birthday'
import { Link } from 'react-router-dom'
import { PRIVACY_VERSION } from '../config/privacy'
import { isValidSocial, normalizeUrl } from '../lib/social'

const EMPTY = {
  fullName: '',
  dob: {}, // { day, month, year }
  nationality: '',
  nationalityDetail: '',
  residenceCountry: '',
  residenceDetail: '',
  occupation: '',
  hobbies: [],
  interests: [],
  lifestyle: '',
  valuesExpectations: '',
  xUrl: '',
  linkedinUrl: '',
  instagramUrl: '',
  photoPaths: [],
  voice: null, // { path, duration }
  consent: false,
}

// Every required item, grouped by wizard step. Drives the % meter and the gate.
const REQUIREMENTS = [
  {
    title: 'About you',
    checks: {
      fullName: (v) => v.trim().length > 0,
      dob: (v) => ageOn(toIsoDate(v)) >= 18,
      nationality: (v, f) => Boolean(v) && (v !== AFRICAN || f.nationalityDetail.trim().length > 1),
      residenceCountry: (v, f) => Boolean(v) && (v !== AFRICAN || f.residenceDetail.trim().length > 1),
      occupation: Boolean,
    },
  },
  {
    title: 'Socials',
    checks: {
      xUrl: (v) => isValidSocial('x', v),
      // LinkedIn OR Instagram; whichever is filled in must be valid.
      linkedinUrl: (v, f) =>
        (v || f.instagramUrl) &&
        (!v || isValidSocial('linkedin', v)) &&
        (!f.instagramUrl || isValidSocial('instagram', f.instagramUrl)),
    },
  },
  {
    title: 'Your life',
    checks: {
      hobbies: (v) => v.length > 0,
      interests: (v) => v.length > 0,
      lifestyle: (v) => v.trim().length > 0,
      valuesExpectations: (v) => v.trim().length > 0,
    },
  },
  {
    title: 'Photos',
    checks: {
      photoPaths: (v) => v.length >= 3 && v.length <= 4,
    },
  },
  {
    title: 'Voice & consent',
    checks: {
      voice: (v) => Boolean(v?.path),
      consent: (v) => v === true,
    },
  },
]

const TOTAL = REQUIREMENTS.reduce((n, s) => n + Object.keys(s.checks).length, 0)

function stepComplete(form, i) {
  return Object.entries(REQUIREMENTS[i].checks).every(([key, ok]) => ok(form[key], form))
}

export default function Onboarding() {
  const { session, refreshProfile } = useAuth()
  const draftKey = `onboarding-draft-${session.user.id}`

  const [form, setForm] = useState(() => {
    try {
      return { ...EMPTY, ...JSON.parse(localStorage.getItem(draftKey)) }
    } catch {
      return EMPTY
    }
  })
  const [step, setStep] = useState(0)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)

  // The Enigma introduction plays once per account, before any inputs.
  const introKey = `enigma-intro-seen-${session.user.id}`
  const [introDone, setIntroDone] = useState(() => {
    try {
      return localStorage.getItem(introKey) === '1'
    } catch {
      return false
    }
  })
  function finishIntro() {
    try {
      localStorage.setItem(introKey, '1')
    } catch {
      // Storage unavailable; the intro simply shows again next time.
    }
    setIntroDone(true)
    window.scrollTo(0, 0)
  }

  // Keep a draft so a reload doesn't lose typed answers or uploaded photos.
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(form))
    } catch {
      // Storage unavailable; the form still works.
    }
  }, [draftKey, form])

  const set = (key) => (valueOrUpdater) =>
    setForm((f) => ({
      ...f,
      [key]: typeof valueOrUpdater === 'function' ? valueOrUpdater(f[key]) : valueOrUpdater,
    }))

  const done = REQUIREMENTS.reduce(
    (n, s) => n + Object.entries(s.checks).filter(([key, ok]) => ok(form[key], form)).length,
    0,
  )
  const percent = Math.round((done / TOTAL) * 100)
  const isLastStep = step === REQUIREMENTS.length - 1

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!isLastStep) {
      if (stepComplete(form, step)) setStep(step + 1)
      return
    }
    if (percent < 100) {
      setError('Your profile must be 100% complete before you can continue.')
      return
    }

    setBusy(true)
    const { data: result, error: rpcError } = await supabase.rpc('complete_profile', {
      p_full_name: form.fullName,
      p_date_of_birth: toIsoDate(form.dob),
      p_nationality: form.nationality,
      p_residence_country: form.residenceCountry,
      p_occupation: form.occupation,
      p_hobbies: form.hobbies,
      p_interests: form.interests,
      p_lifestyle: form.lifestyle,
      p_values_expectations: form.valuesExpectations,
      p_photo_paths: form.photoPaths,
      p_x_url: normalizeUrl(form.xUrl),
      p_linkedin_url: normalizeUrl(form.linkedinUrl),
      p_instagram_url: normalizeUrl(form.instagramUrl),
      p_voice_path: form.voice?.path,
      p_voice_duration: form.voice?.duration,
      p_nationality_detail: form.nationality === AFRICAN ? form.nationalityDetail.trim() : null,
      p_residence_detail: form.residenceCountry === AFRICAN ? form.residenceDetail.trim() : null,
      p_consent_version: form.consent ? PRIVACY_VERSION : '',
    })
    setBusy(false)
    if (rpcError) return setError(readableError(rpcError))

    localStorage.removeItem(draftKey)
    // Not eligible: no welcome, no payment. The router shows the closing popup.
    if (!result?.success) return refreshProfile()
    setShowWelcome(true)
  }

  if (!introDone) return <EnigmaIntro onFinish={finishIntro} />

  return (
    <Shell>
      <div className="mb-8">
        <div className="flex items-baseline justify-between">
          <h1 className="font-serif text-4xl text-charcoal-900">Your profile</h1>
          <span className={`text-sm font-medium tabular-nums ${percent === 100 ? 'text-sage-600' : 'text-rose-600'}`}>
            {percent}% complete
          </span>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-cream-300"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Profile completion"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${percent === 100 ? 'bg-sage-500' : 'bg-rose-500'}`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <ol className="mt-5 grid grid-cols-5 gap-1.5 text-xs">
          {REQUIREMENTS.map((s, i) => {
            const reachable = i <= step || REQUIREMENTS.slice(0, i).every((_, j) => stepComplete(form, j))
            return (
              <li key={s.title}>
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => setStep(i)}
                  aria-current={i === step ? 'step' : undefined}
                  className={`w-full truncate rounded-full px-1.5 py-2 font-medium transition disabled:cursor-not-allowed ${
                    i === step
                      ? 'bg-charcoal-900 text-cream-50'
                      : stepComplete(form, i)
                        ? 'bg-sage-200/60 text-sage-700'
                        : 'bg-cream-50 text-charcoal-400'
                  }`}
                >
                  {stepComplete(form, i) && i !== step ? '✓' : i + 1}
                  <span className="hidden sm:inline"> {s.title}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      <form onSubmit={handleSubmit} noValidate className="card space-y-6 p-6 sm:p-10">
        {step === 0 && (
          <>
            <Field id="fullName" label="Name">
              <input
                id="fullName"
                autoComplete="name"
                value={form.fullName}
                onChange={(e) => set('fullName')(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Date of birth">
              <DateOfBirthPicker value={form.dob} onChange={set('dob')} />
            </Field>
            <Field id="occupation" label="Career">
              <Select id="occupation" value={form.occupation} onChange={set('occupation')} options={CAREERS} />
            </Field>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field id="nationality" label="Nationality">
                <Select
                  id="nationality"
                  value={form.nationality}
                  onChange={set('nationality')}
                  options={NATIONALITY_OPTIONS}
                />
                {form.nationality === AFRICAN && (
                  <ExactCountry
                    id="nationalityDetail"
                    value={form.nationalityDetail}
                    onChange={set('nationalityDetail')}
                    label="Which African nationality exactly?"
                  />
                )}
              </Field>
              <Field id="residenceCountry" label="Country you live in">
                <Select
                  id="residenceCountry"
                  value={form.residenceCountry}
                  onChange={set('residenceCountry')}
                  options={COUNTRY_OPTIONS}
                />
                {form.residenceCountry === AFRICAN && (
                  <ExactCountry
                    id="residenceDetail"
                    value={form.residenceDetail}
                    onChange={set('residenceDetail')}
                    label="Which country in Africa exactly?"
                  />
                )}
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-sm text-charcoal-500">
              For verification only. Add your X profile and at least one of LinkedIn or Instagram.
            </p>
            <SocialField
              id="xUrl"
              label="X (Twitter)"
              kind="x"
              placeholder="https://x.com/yourname"
              value={form.xUrl}
              onChange={set('xUrl')}
            />
            <SocialField
              id="linkedinUrl"
              label="LinkedIn"
              kind="linkedin"
              placeholder="https://linkedin.com/in/yourname"
              value={form.linkedinUrl}
              onChange={set('linkedinUrl')}
              optional={Boolean(form.instagramUrl)}
            />
            <SocialField
              id="instagramUrl"
              label="Instagram"
              kind="instagram"
              placeholder="https://instagram.com/yourname"
              value={form.instagramUrl}
              onChange={set('instagramUrl')}
              optional={Boolean(form.linkedinUrl)}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Field id="hobbies" label="Hobbies" hint="Type and press Enter">
              <TagInput id="hobbies" tags={form.hobbies} onChange={set('hobbies')} placeholder="e.g. hiking, cooking" />
            </Field>
            <Field id="interests" label="Interests" hint="Type and press Enter">
              <TagInput
                id="interests"
                tags={form.interests}
                onChange={set('interests')}
                placeholder="e.g. history, travel"
              />
            </Field>
            <Field id="lifestyle" label="Lifestyle details">
              <textarea
                id="lifestyle"
                rows={5}
                value={form.lifestyle}
                onChange={(e) => set('lifestyle')(e.target.value)}
                className="input resize-y"
                placeholder="Describe a typical day: work, routines, weekends, fitness, how you unwind…"
              />
            </Field>
            <Field id="valuesExpectations" label="What are your values and expectations?">
              <textarea
                id="valuesExpectations"
                rows={5}
                maxLength={2000}
                value={form.valuesExpectations}
                onChange={(e) => set('valuesExpectations')(e.target.value)}
                className="input resize-y"
                placeholder="What matters most to you, and what you expect from a partner and a relationship…"
              />
            </Field>
          </>
        )}

        {step === 3 && (
          <Field label="Photos" hint="Exactly 3 or 4 clear photos of you">
            <PhotoUploader userId={session.user.id} paths={form.photoPaths} onChange={set('photoPaths')} />
          </Field>
        )}

        {step === 4 && (
          <Field label="Voice introduction" hint="10–30 seconds">
            <VoiceRecorder userId={session.user.id} value={form.voice} onChange={set('voice')} />
          </Field>
        )}

        {step === 4 && (
          <label
            htmlFor="consent"
            className="flex cursor-pointer gap-3 rounded-2xl border border-cream-300 bg-cream-100/60 p-4 text-sm leading-relaxed text-charcoal-700"
          >
            <input
              id="consent"
              type="checkbox"
              checked={form.consent}
              onChange={(e) => set('consent')(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-rose-600"
            />
            <span>
              I have read the{' '}
              <Link to="/privacy" target="_blank" className="font-medium text-rose-600 hover:underline">
                Privacy notice
              </Link>{' '}
              and give my explicit consent to the processing of my data for this application, including my photos,
              voice note, and answers that reveal my religious beliefs and health.
            </span>
          </label>
        )}

        <ErrorNote>{error}</ErrorNote>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} className="btn-secondary">
              Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={busy || (isLastStep ? percent < 100 : !stepComplete(form, step))}
            className="btn-primary"
          >
            {busy && <Spinner />}
            {isLastStep ? 'Complete profile' : 'Next'}
          </button>
        </div>
      </form>

      {showWelcome && <WelcomeModal onProceed={refreshProfile} />}
    </Shell>
  )
}

function Field({ id, label, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        {id ? (
          <label htmlFor={id} className="label">
            {label}
          </label>
        ) : (
          <span className="label">{label}</span>
        )}
        {hint && <span className="text-xs text-charcoal-400">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function SocialField({ id, label, kind, value, onChange, placeholder, optional }) {
  const invalid = value.trim() && !isValidSocial(kind, value)
  return (
    <Field
      id={id}
      label={label}
      hint={kind === 'x' ? 'Required' : optional ? 'Optional' : 'LinkedIn or Instagram required'}
    >
      <input
        id={id}
        type="url"
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(invalid)}
        className={`input ${invalid ? 'border-rose-400' : ''}`}
      />
      {invalid && <p className="mt-1.5 text-xs text-rose-700">That doesn’t look like a {label} profile link.</p>}
    </Field>
  )
}

function ExactCountry({ id, value, onChange, label }) {
  return (
    <div className="mt-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        list={`${id}-list`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        autoComplete="off"
        className="input"
      />
      <datalist id={`${id}-list`}>
        {AFRICAN_COUNTRY_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  )
}

function Select({ id, value, onChange, options }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input appearance-none">
      <option value="" disabled>
        Select…
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function WelcomeModal({ onProceed }) {
  const [busy, setBusy] = useState(false)
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal-900/30 p-4 backdrop-blur-md sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="card w-full max-w-md animate-[fadeUp_0.4s_ease-out] p-8 text-center sm:p-10">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-rose-50 text-2xl text-rose-500">
          ♥
        </div>
        <h2 id="welcome-title" className="mt-5 font-serif text-3xl text-charcoal-900">
          Profile complete!
        </h2>
        <p className="mt-3 leading-relaxed text-charcoal-500">
          Now, let’s see if we match. Please answer the following questions honestly based on your true lifestyle and
          values.
        </p>
        <button
          autoFocus
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await onProceed() // router opens the payment step, or the questions when payments are off
          }}
          className="btn-primary mt-8 w-full"
        >
          {busy && <Spinner />}
          Proceed
        </button>
      </div>
    </div>
  )
}
