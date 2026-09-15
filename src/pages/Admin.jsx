import { useEffect, useMemo, useState } from 'react'
import { supabase, photoUrl, readableError, PHOTO_BUCKET, VOICE_BUCKET, ID_BUCKET } from '../lib/supabase'
import { formatBirthday } from '../lib/birthday'
import { describePhone } from '../lib/phone'
import { careerLabel } from '../config/careers'
import { nationalityLabel, residenceLabel } from '../config/countries'
import { QUESTIONS } from '../config/questions'
import { Shell, Spinner } from '../components/Shell'
import { useAuth } from '../context/useAuth'

export default function Admin() {
  const { session } = useAuth()
  const [tab, setTab] = useState('all')
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    async function load() {
      const [profiles, responses, contacts, messages, due] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('questionnaire_responses').select('*').order('id'),
        supabase.from('applicant_contacts').select('user_id, phone'),
        supabase.from('failed_applicants_messages').select('*').order('created_at', { ascending: false }),
        supabase.rpc('retention_due'),
      ])
      const failed = [profiles, responses, contacts, messages, due].find((r) => r.error)
      if (failed) {
        setLoadError(failed.error.message)
        return
      }

      const byUser = (rows) => rows.reduce((acc, r) => ((acc[r.user_id] ??= []).push(r), acc), {})
      const answers = byUser(responses.data)
      const phones = Object.fromEntries(contacts.data.map((c) => [c.user_id, c.phone]))

      // Voice notes live in a private bucket: fetch one-hour playback links.
      const voicePaths = profiles.data.map((r) => r.voice_path).filter(Boolean)
      const signed = voicePaths.length
        ? ((await supabase.storage.from(VOICE_BUCKET).createSignedUrls(voicePaths, 3600)).data ?? [])
        : []
      const voiceUrls = Object.fromEntries(signed.map((v) => [v.path, v.signedUrl]))

      // Government IDs are private too.
      const idPaths = profiles.data.map((r) => r.id_document_path).filter(Boolean)
      const signedIds = idPaths.length
        ? ((await supabase.storage.from(ID_BUCKET).createSignedUrls(idPaths, 3600)).data ?? [])
        : []
      const idUrls = Object.fromEntries(signedIds.map((v) => [v.path, v.signedUrl]))

      // Leave the admin's own account out of the applicant list.
      const people = profiles.data
        .filter((r) => r.id !== session.user.id)
        .map((r) => ({
          ...r,
          answers: answers[r.id] ?? [],
          phone: phones[r.id],
          voiceUrl: voiceUrls[r.voice_path],
          idUrl: idUrls[r.id_document_path],
        }))

      setData({
        people,
        passed: people.filter((p) => p.match_passed).sort((a, b) => Number(b.is_priority) - Number(a.is_priority)),
        trash: messages.data,
        due: due.data,
      })
    }
    load()
  }, [session.user.id, reloadKey])

  const tabs = [
    { key: 'all', label: 'All applicants', count: data?.people.length },
    { key: 'passed', label: 'Passed', count: data?.passed.length },
    { key: 'phones', label: 'Phone log', count: data?.passed.filter((p) => p.phone).length },
    { key: 'trash', label: 'Trash Can', count: data?.trash.length },
    {
      key: 'retention',
      label: 'Data retention',
      count: data ? data.due.ids.length + data.due.applications.length : undefined,
    },
    { key: 'settings', label: 'Settings' },
  ]

  return (
    <Shell wide>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-4xl text-charcoal-900">Dashboard</h1>
          <p className="mt-1 text-charcoal-500">Private. Visible only to you.</p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="btn-secondary self-start px-5 py-2 text-sm sm:self-auto"
        >
          Log out
        </button>
      </div>

      <div className="mb-8 overflow-x-auto">
        <div role="tablist" className="inline-flex rounded-full border border-cream-300 bg-cream-50 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition sm:px-5 ${
                tab === t.key ? 'bg-charcoal-900 text-cream-50' : 'text-charcoal-500 hover:text-charcoal-900'
              }`}
            >
              {t.label}
              {t.count !== undefined && <span className="ml-1.5 tabular-nums opacity-60">{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {loadError ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Couldn’t load applicants: {loadError}
        </p>
      ) : !data ? (
        <div className="flex justify-center py-20 text-rose-500">
          <Spinner className="size-8" />
        </div>
      ) : tab === 'settings' ? (
        <SettingsPanel />
      ) : tab === 'retention' ? (
        <RetentionPanel due={data.due} onDone={reload} />
      ) : tab === 'all' ? (
        <AllApplicants people={data.people} onChanged={reload} />
      ) : tab === 'passed' ? (
        data.passed.length === 0 ? (
          <Empty>No one has passed 100% yet.</Empty>
        ) : (
          <ul className="grid items-start gap-6 lg:grid-cols-2">
            {data.passed.map((a) => (
              <PassedCard key={a.id} applicant={a} />
            ))}
          </ul>
        )
      ) : tab === 'phones' ? (
        <PhoneLog people={data.passed.filter((p) => p.phone)} />
      ) : data.trash.length === 0 ? (
        <Empty>The trash can is empty.</Empty>
      ) : (
        <TrashLog entries={data.trash} />
      )}
    </Shell>
  )
}

function Empty({ children }) {
  return <p className="py-20 text-center text-charcoal-400">{children}</p>
}

/* ------------------------------------------------------------------ */
/* Passed applicants                                                    */
/* ------------------------------------------------------------------ */

function PassedCard({ applicant: a }) {
  return (
    <li className="card relative overflow-hidden">
      {a.is_priority && <PriorityRibbon />}

      <div
        className="grid h-56 gap-1 sm:h-64"
        style={{ gridTemplateColumns: `repeat(${a.photo_paths.length}, minmax(0, 1fr))` }}
      >
        {a.photo_paths.map((p) => (
          <a
            key={p}
            href={photoUrl(p)}
            target="_blank"
            rel="noreferrer"
            className="block h-full overflow-hidden bg-cream-200"
          >
            <img src={photoUrl(p)} alt="" className="size-full object-cover transition hover:scale-105" />
          </a>
        ))}
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="font-serif text-3xl text-charcoal-900">
            {a.full_name}, <span className="tabular-nums">{a.age}</span>
          </h2>
          <p className="mt-1 text-sm text-charcoal-500">
            {careerLabel(a.occupation)} · {nationalityLabel(a.nationality, a.nationality_detail)}
            {` · lives in ${residenceLabel(a.residence_country, a.residence_detail)}`}
          </p>
        </div>

        {a.phone && <QuickConnect phone={a.phone} />}

        <IdVerification person={a} />

        <FinalPhase answers={a.answers} />

        {a.voiceUrl && (
          <div>
            <p className="label">Voice introduction</p>
            <audio controls preload="none" src={a.voiceUrl} className="w-full" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <SocialLink href={a.x_url} label="X / Twitter" />
          <SocialLink href={a.linkedin_url} label="LinkedIn" />
          <SocialLink href={a.instagram_url} label="Instagram" />
        </div>

        <dl className="grid gap-4 text-sm">
          <Detail term="Hobbies" value={a.hobbies.join(', ')} />
          <Detail term="Interests" value={a.interests.join(', ')} />
          <Detail term="Lifestyle" value={a.lifestyle} />
          <Detail term="Values & expectations" value={a.values_expectations} />
          <Detail term="Email" value={a.email} />
        </dl>
      </div>
    </li>
  )
}

const FINAL_PHASE = [
  ['lifestyle_vision', 'Lifestyle vision'],
  ['financial_strategy', 'Financial strategy'],
  ['talents', 'Talents & uniqueness'],
  ['love_expression', 'How he expresses love & care'],
  ['questions_for_me', 'Questions for you'],
]

function FinalPhase({ answers = [] }) {
  const byId = Object.fromEntries(answers.map((x) => [x.question_id, x]))
  if (!FINAL_PHASE.some(([id]) => byId[id])) return null
  return (
    <div className="space-y-3 rounded-2xl bg-rose-50/60 p-4">
      <p className="text-xs font-medium tracking-[0.2em] text-rose-500 uppercase">Lifestyle &amp; financial cohesion</p>
      {FINAL_PHASE.map(([id, label]) =>
        byId[id]?.answer?.value || byId[id]?.answer?.values ? (
          <div key={id}>
            <p className="text-sm text-charcoal-500">{label}</p>
            <p className="whitespace-pre-line text-charcoal-900">{formatAnswer(id, byId[id].answer)}</p>
          </div>
        ) : null,
      )}
    </div>
  )
}

function IdVerification({ person: p }) {
  if (!p.id_document_path) return null
  const isPdf = p.id_document_path.endsWith('.pdf')
  return (
    <div className="rounded-2xl border border-cream-300 bg-cream-100/60 p-4">
      <p className="label mb-3">Identity verification</p>
      <div className="flex items-center gap-4">
        {p.idUrl && (
          <a
            href={p.idUrl}
            target="_blank"
            rel="noreferrer"
            className="block shrink-0 overflow-hidden rounded-xl bg-cream-200"
          >
            {isPdf ? (
              <span className="flex h-20 w-28 items-center justify-center text-sm font-medium text-charcoal-500">
                PDF
              </span>
            ) : (
              <img src={p.idUrl} alt={`ID document for ${p.full_name}`} className="h-20 w-28 object-cover" />
            )}
          </a>
        )}
        <div className="text-sm">
          <p className="text-charcoal-500">Date of birth given</p>
          <p className="font-serif text-xl text-charcoal-900">{formatBirthday(p.date_of_birth) || '—'}</p>
          {p.idUrl && (
            <a href={p.idUrl} target="_blank" rel="noreferrer" className="font-medium text-rose-600 hover:underline">
              Open ID to check name &amp; birthday ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function PriorityRibbon() {
  return (
    <div className="pointer-events-none absolute top-0 right-0 z-10 size-32 overflow-hidden">
      <span className="absolute top-7 -right-10 block w-44 rotate-45 bg-amber-400 py-1.5 text-center text-xs font-semibold tracking-wide text-charcoal-900 shadow-md">
        ⭐ Priority
      </span>
    </div>
  )
}

function QuickConnect({ phone, large = false }) {
  const p = describePhone(phone)
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-sage-200/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className={large ? 'text-5xl' : 'text-4xl'} role="img" aria-label={p.country}>
          {p.flag}
        </span>
        <div>
          <p className="text-xs tracking-wider text-sage-700 uppercase">{p.country}</p>
          <p className={`font-serif text-charcoal-900 tabular-nums ${large ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}>
            <span className="text-sage-700">{p.code}</span> {p.national}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={`tel:${p.dial}`}
          className="inline-flex flex-1 items-center justify-center rounded-full bg-charcoal-900 px-4 py-2.5 text-sm font-medium text-cream-50 transition hover:bg-charcoal-700 sm:flex-none"
        >
          Call
        </a>
        <a
          href={`facetime://${p.dial}`}
          className="inline-flex flex-1 items-center justify-center rounded-full bg-sage-600 px-4 py-2.5 text-sm font-medium text-cream-50 transition hover:bg-sage-700 sm:flex-none"
        >
          FaceTime
        </a>
        <a
          href={`https://wa.me/${p.dial.replace(/\D/g, '')}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center rounded-full border border-sage-500 bg-cream-50 px-4 py-2.5 text-sm font-medium text-sage-700 transition hover:bg-sage-200/50 sm:flex-none"
        >
          WhatsApp
        </a>
      </div>
    </div>
  )
}

function PhoneLog({ people }) {
  if (people.length === 0) return <Empty>No phone numbers yet.</Empty>
  return (
    <ul className="grid gap-4">
      {people.map((p) => (
        <li key={p.id} className="card relative overflow-hidden p-4 sm:p-5">
          {p.is_priority && <PriorityRibbon />}
          <p className="mb-3 font-serif text-xl text-charcoal-900">
            {p.full_name}, <span className="tabular-nums">{p.age}</span>
            <span className="ml-2 font-sans text-sm text-charcoal-400">
              {careerLabel(p.occupation)} · {residenceLabel(p.residence_country, p.residence_detail)}
            </span>
          </p>
          <QuickConnect phone={p.phone} large />
        </li>
      ))}
    </ul>
  )
}

function SocialLink({ href, label }) {
  // Links are validated server-side; only ever render https URLs.
  if (!href?.startsWith('https://')) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="rounded-full border border-cream-300 bg-cream-50 px-4 py-2 text-sm font-medium text-charcoal-700 transition hover:border-rose-300 hover:text-rose-700"
    >
      {label} ↗
    </a>
  )
}

function Detail({ term, value }) {
  if (!value) return null
  return (
    <div>
      <dt className="label">{term}</dt>
      <dd className="wrap-break-word whitespace-pre-line text-charcoal-700">{value}</dd>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Trash Can: name, age, final message only                             */
/* ------------------------------------------------------------------ */

function TrashLog({ entries }) {
  return (
    <div className="card overflow-hidden">
      <ul className="divide-y divide-cream-300/70">
        {entries.map((e) => (
          <li key={e.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6 sm:px-6">
            <p className="font-medium text-charcoal-900">
              {e.full_name ?? 'Unknown'}
              <span className="font-normal text-charcoal-400">, {e.age ?? '?'}</span>
            </p>
            {e.message ? (
              <p className="font-serif text-lg text-charcoal-700 italic">{e.message}</p>
            ) : (
              <p className="text-sm text-charcoal-400">Not a match · {new Date(e.created_at).toLocaleDateString()}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* All applicants: everyone registered, with profile and every answer   */
/* ------------------------------------------------------------------ */

const STATUS = {
  onboarding: { label: 'Profile not finished', style: 'bg-cream-200 text-charcoal-500' },
  payment: { label: 'Awaiting payment', style: 'bg-amber-50 text-amber-700' },
  screening: { label: 'Answering questions', style: 'bg-cream-200 text-charcoal-700' },
  contact: { label: 'Passed, no phone yet', style: 'bg-sage-200/40 text-sage-700' },
  completed: { label: '100% Match Passed', style: 'bg-sage-200/70 text-sage-700' },
  rejected: { label: 'Dealbreaker', style: 'bg-rose-50 text-rose-700' },
  closed: { label: 'Dealbreaker · closed', style: 'bg-rose-50 text-rose-700' },
}

const STATUS_FILTERS = [
  { key: 'all', label: 'Everyone' },
  {
    key: 'progress',
    label: 'In progress',
    match: (p) => ['onboarding', 'payment', 'screening', 'contact'].includes(p.status),
  },
  { key: 'passed', label: 'Passed', match: (p) => p.match_passed },
  { key: 'rejected', label: 'Dealbreaker', match: (p) => ['rejected', 'closed'].includes(p.status) },
  { key: 'priority', label: '⭐ Priority', match: (p) => p.is_priority },
]

function AllApplicants({ people, onChanged }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [openId, setOpenId] = useState(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = STATUS_FILTERS.find((f) => f.key === filter)?.match
    return people.filter(
      (p) =>
        (!match || match(p)) &&
        (!q ||
          [
            p.full_name,
            p.email,
            p.nationality,
            nationalityLabel(p.nationality, p.nationality_detail),
            p.residence_country,
            p.residence_detail,
          ].some((v) => v?.toLowerCase().includes(q))),
    )
  }, [people, query, filter])

  if (people.length === 0) return <Empty>No one has registered yet.</Empty>

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="search" className="sr-only">
          Search applicants
        </label>
        <input
          id="search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email or country"
          className="input sm:max-w-xs"
        />
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                filter === f.key ? 'bg-rose-600 text-cream-50' : 'bg-cream-50 text-charcoal-700 hover:bg-cream-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty>No one matches.</Empty>
      ) : (
        <ul className="grid gap-3">
          {visible.map((p) => (
            <li key={p.id} className="card overflow-hidden">
              <button
                onClick={() => setOpenId(openId === p.id ? null : p.id)}
                aria-expanded={openId === p.id}
                className="flex w-full items-center gap-4 p-4 text-left sm:p-5"
              >
                {p.photo_paths[0] ? (
                  <img
                    src={photoUrl(p.photo_paths[0])}
                    alt=""
                    className="size-12 shrink-0 rounded-full object-cover sm:size-14"
                  />
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-cream-200 text-charcoal-400 sm:size-14">
                    ?
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-xl text-charcoal-900">
                    {p.full_name || <span className="text-charcoal-400">No name yet</span>}
                    {p.age && <span className="text-charcoal-400">, {p.age}</span>}
                  </p>
                  <p className="truncate text-sm text-charcoal-500">
                    {p.email} · joined {new Date(p.created_at).toLocaleDateString()}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">
                    <StatusTags person={p} />
                  </div>
                </div>
                <div className="hidden shrink-0 flex-wrap justify-end gap-1.5 sm:flex">
                  <StatusTags person={p} />
                </div>
                <span
                  aria-hidden="true"
                  className={`text-charcoal-400 transition ${openId === p.id ? 'rotate-180' : ''}`}
                >
                  ⌄
                </span>
              </button>

              {openId === p.id && <PersonDetail person={p} onChanged={onChanged} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StatusTags({ person: p }) {
  const status = STATUS[p.status]
  return (
    <>
      {p.reusable && (
        <span className="rounded-full bg-charcoal-900/5 px-2.5 py-1 text-xs font-medium text-charcoal-500">
          Test account
        </span>
      )}
      {p.is_priority && (
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">⭐ Priority</span>
      )}
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.style}`}>
        {status.label}
        {p.status === 'screening' && ` · ${p.current_step}/${QUESTIONS.length}`}
      </span>
    </>
  )
}

function PersonDetail({ person: p, onChanged }) {
  const profileStarted = Boolean(p.full_name)
  return (
    <>
      <div className="grid gap-8 border-t border-cream-300/70 p-4 sm:p-6 lg:grid-cols-2">
        <div className="space-y-5">
          <h3 className="text-xs font-medium tracking-[0.2em] text-rose-500 uppercase">Profile</h3>

          {!profileStarted ? (
            <p className="text-sm text-charcoal-400">Signed up but hasn’t submitted a profile yet.</p>
          ) : (
            <>
              {p.photo_paths.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {p.photo_paths.map((path) => (
                    <a
                      key={path}
                      href={photoUrl(path)}
                      target="_blank"
                      rel="noreferrer"
                      className="block aspect-3/4 overflow-hidden rounded-xl bg-cream-200"
                    >
                      <img src={photoUrl(path)} alt="" className="size-full object-cover" />
                    </a>
                  ))}
                </div>
              )}

              {p.phone && <QuickConnect phone={p.phone} />}

              <IdVerification person={p} />

              {p.voiceUrl && (
                <div>
                  <p className="label">
                    Voice introduction
                    {p.voice_duration_seconds && (
                      <span className="font-normal text-charcoal-400"> ({Math.round(p.voice_duration_seconds)}s)</span>
                    )}
                  </p>
                  <audio controls preload="none" src={p.voiceUrl} className="w-full" />
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <SocialLink href={p.x_url} label="X / Twitter" />
                <SocialLink href={p.linkedin_url} label="LinkedIn" />
                <SocialLink href={p.instagram_url} label="Instagram" />
              </div>

              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <Detail term="Nationality" value={nationalityLabel(p.nationality, p.nationality_detail)} />
                <Detail term="Lives in" value={residenceLabel(p.residence_country, p.residence_detail)} />
                <Detail term="Career" value={p.occupation && careerLabel(p.occupation)} />
                <Detail term="Email" value={p.email} />
                <Detail
                  term="Review fee"
                  value={p.paid_at ? `Paid ${new Date(p.paid_at).toLocaleDateString()}` : null}
                />
                <Detail term="Hobbies" value={p.hobbies.join(', ')} />
                <Detail term="Interests" value={p.interests.join(', ')} />
              </dl>
              <dl className="grid gap-4 text-sm">
                <Detail term="Lifestyle" value={p.lifestyle} />
                <Detail term="Values & expectations" value={p.values_expectations} />
              </dl>
            </>
          )}
        </div>

        <div className="space-y-5">
          <h3 className="text-xs font-medium tracking-[0.2em] text-rose-500 uppercase">
            Answers{' '}
            <span className="text-charcoal-400 normal-case tracking-normal">
              ({p.answers.length}/{QUESTIONS.length})
            </span>
          </h3>

          {p.answers.length === 0 ? (
            <p className="text-sm text-charcoal-400">No answers yet.</p>
          ) : (
            <ol className="divide-y divide-cream-300/70 overflow-hidden rounded-2xl border border-cream-300/70 text-sm">
              {p.answers.map((a) => (
                <li
                  key={a.id}
                  className={`flex flex-col gap-1 px-4 py-3 ${isWritten(a.question_id) ? '' : 'sm:flex-row sm:justify-between sm:gap-6'} ${a.is_dealbreaker ? 'bg-rose-50' : ''}`}
                >
                  <span className="text-charcoal-500">{questionTitle(a.question_id)}</span>
                  <span
                    className={`font-medium ${isWritten(a.question_id) ? 'whitespace-pre-line' : 'shrink-0 sm:text-right'} ${a.is_dealbreaker ? 'text-rose-700' : 'text-charcoal-900'}`}
                  >
                    {a.is_dealbreaker && '🛑 '}
                    {formatAnswer(a.question_id, a.answer)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      <DataActions person={p} onChanged={onChanged} />
    </>
  )
}

function isWritten(id) {
  return QUESTIONS.find((q) => q.id === id)?.type === 'text'
}

function questionTitle(id) {
  return QUESTIONS.find((q) => q.id === id)?.title ?? id
}

function formatAnswer(questionId, answer) {
  if (Array.isArray(answer.values)) {
    const options = QUESTIONS.find((q) => q.id === questionId)?.options ?? []
    return answer.values.map((v) => options.find((o) => o.value === v)?.label ?? v).join(', ')
  }
  if (questionId === 'marriage_children') {
    const yn = (v) => ({ yes: 'Yes', no: 'No' })[v] ?? '—'
    return `Married/divorced: ${yn(answer.previously_married)} · Children: ${yn(answer.has_children)}`
  }
  if (questionId === 'age') return String(answer.value)
  if (questionId === 'height') return `${answer.value} cm`
  if (questionId === 'location')
    return `${nationalityLabel(answer.nationality, answer.nationality_detail)} · lives in ${residenceLabel(answer.residence_country, answer.residence_detail)}`
  if (questionId === 'relocation') return { yes: 'Yes', maybe: 'Let’s see…', no: 'No' }[answer.value] ?? answer.value
  const option = QUESTIONS.find((q) => q.id === questionId)?.options?.find((o) => o.value === answer.value)
  if (option) return option.label
  return { yes: 'Yes', no: 'No' }[answer.value] ?? String(answer.value)
}

/* ------------------------------------------------------------------ */
/* Data retention                                                       */
/* ------------------------------------------------------------------ */

// File bytes can only be removed through the Storage API, so the dashboard
// deletes files first and then asks the database to finish.
async function deleteFiles(userId, buckets) {
  for (const bucket of buckets) {
    const { data: files, error } = await supabase.storage.from(bucket).list(userId, { limit: 1000 })
    if (error) throw error
    if (files?.length) {
      const { error: removeError } = await supabase.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`))
      if (removeError) throw removeError
    }
  }
}

async function deleteIdDocument(userId) {
  await deleteFiles(userId, [ID_BUCKET])
  const { error } = await supabase.rpc('admin_forget_id', { p_user_id: userId })
  if (error) throw error
}

async function deleteApplication(userId) {
  await deleteFiles(userId, [PHOTO_BUCKET, VOICE_BUCKET, ID_BUCKET])
  const { error } = await supabase.rpc('admin_delete_application', { p_user_id: userId })
  if (error) throw error
}

function useAction(onDone) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  async function run(key, fn) {
    setBusy(key)
    setError(null)
    try {
      await fn()
      onDone?.()
    } catch (e) {
      setError(readableError(e))
    } finally {
      setBusy(null)
    }
  }
  return { busy, error, run }
}

function DataActions({ person: p, onChanged }) {
  const { busy, error, run } = useAction(onChanged)
  if (p.reusable) return null
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-cream-300/70 px-4 py-3 sm:px-6">
      <span className="text-xs tracking-wider text-charcoal-400 uppercase">Data</span>
      {p.id_document_path && (
        <button
          onClick={() => run('id', () => deleteIdDocument(p.id))}
          disabled={Boolean(busy)}
          className="rounded-full border border-cream-300 px-3.5 py-1.5 text-sm text-charcoal-700 hover:border-rose-300 disabled:opacity-50"
        >
          {busy === 'id' ? 'Deleting…' : 'Delete ID now'}
        </button>
      )}
      <button
        onClick={() => {
          if (
            window.confirm(
              `Delete ALL data for ${p.full_name || p.email}? This removes the account, files and answers and cannot be undone.`,
            )
          ) {
            run('all', () => deleteApplication(p.id))
          }
        }}
        disabled={Boolean(busy)}
        className="rounded-full border border-rose-200 px-3.5 py-1.5 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
      >
        {busy === 'all' ? 'Deleting…' : 'Delete all data'}
      </button>
      {error && <span className="text-sm text-rose-700">{error}</span>}
    </div>
  )
}

function RetentionPanel({ due, onDone }) {
  const { busy, error, run } = useAction(onDone)
  const total = due.ids.length + due.applications.length

  async function deleteEverythingDue() {
    for (const item of due.ids) await deleteIdDocument(item.id)
    for (const item of due.applications) await deleteApplication(item.id)
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 text-sm leading-relaxed text-charcoal-700 sm:p-6">
        <p className="font-medium text-charcoal-900">Your retention rules (from the Privacy notice)</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>ID photos of matches: delete 30 days after the match.</li>
          <li>Applications that ended but the popup was never closed: delete after 7 days.</li>
          <li>Unfinished applications: delete after 90 days without activity.</li>
          <li>Matches: delete 12 months after the match.</li>
          <li>Trash Can entries and the ban list: deleted automatically after 12 months.</li>
        </ul>
      </div>

      {total === 0 ? (
        <Empty>Nothing is due for deletion. ✓</Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-charcoal-700">
              <strong>{total}</strong> item{total === 1 ? '' : 's'} due for deletion.
            </p>
            <button
              onClick={() => run('everything', deleteEverythingDue)}
              disabled={Boolean(busy)}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              {busy === 'everything' ? 'Deleting…' : 'Delete everything due'}
            </button>
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          <ul className="card divide-y divide-cream-300/70 overflow-hidden">
            {due.ids.map((item) => (
              <li key={`id-${item.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span>
                  <strong className="font-medium">{item.full_name}</strong>
                  <span className="text-charcoal-500">
                    {' '}
                    · ID photo · matched {new Date(item.since).toLocaleDateString()}
                  </span>
                </span>
                <button
                  onClick={() => run(`id-${item.id}`, () => deleteIdDocument(item.id))}
                  disabled={Boolean(busy)}
                  className="text-sm font-medium text-rose-600 hover:underline disabled:opacity-50"
                >
                  {busy === `id-${item.id}` ? 'Deleting…' : 'Delete ID'}
                </button>
              </li>
            ))}
            {due.applications.map((item) => (
              <li key={`app-${item.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span>
                  <strong className="font-medium">{item.full_name || item.email}</strong>
                  <span className="text-charcoal-500">
                    {' '}
                    · {item.reason} · since {new Date(item.since).toLocaleDateString()}
                  </span>
                </span>
                <button
                  onClick={() => run(`app-${item.id}`, () => deleteApplication(item.id))}
                  disabled={Boolean(busy)}
                  className="text-sm font-medium text-rose-600 hover:underline disabled:opacity-50"
                >
                  {busy === `app-${item.id}` ? 'Deleting…' : 'Delete application'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Settings: payments                                                   */
/* ------------------------------------------------------------------ */

function SettingsPanel() {
  const [settings, setSettings] = useState(null)
  const { busy, error, run } = useAction(load)

  async function load() {
    const { data, error: rpcError } = await supabase.rpc('admin_payment_settings')
    if (rpcError) throw rpcError
    setSettings(data)
  }
  useEffect(() => {
    load().catch(() => setSettings({ error: true }))
  }, [])

  if (!settings)
    return (
      <div className="flex justify-center py-20 text-rose-500">
        <Spinner className="size-8" />
      </div>
    )

  const fee = settings.fee_cents ? `€${(settings.fee_cents / 100).toFixed(2)}` : '—'
  return (
    <div className="card max-w-2xl space-y-5 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-charcoal-900">Review fee ({fee})</h2>
          <p className="mt-1 text-sm text-charcoal-500">
            When on, eligible applicants must pay before the questions. When off, they go straight to the questions.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${settings.enabled ? 'bg-sage-200/70 text-sage-700' : 'bg-cream-200 text-charcoal-500'}`}
        >
          {settings.enabled ? 'On' : 'Off'}
        </span>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-cream-100 p-3">
          <dt className="text-charcoal-400">Stripe</dt>
          <dd className="font-medium text-charcoal-900">
            {settings.key_configured
              ? settings.test_mode
                ? 'Connected (test mode)'
                : 'Connected (live)'
              : 'Not connected'}
          </dd>
        </div>
        <div className="rounded-xl bg-cream-100 p-3">
          <dt className="text-charcoal-400">Paid reviews</dt>
          <dd className="font-medium text-charcoal-900 tabular-nums">{settings.paid_count ?? 0}</dd>
        </div>
        <div className="rounded-xl bg-cream-100 p-3">
          <dt className="text-charcoal-400">Refunds</dt>
          <dd className="font-medium text-charcoal-900">None (see Terms)</dd>
        </div>
      </dl>

      {!settings.key_configured && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Connect a Stripe account first. Until then payments stay off and applicants are not charged.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <button
        onClick={() =>
          run('toggle', async () => {
            const { error: rpcError } = await supabase.rpc('admin_set_payments_enabled', {
              p_enabled: !settings.enabled,
            })
            if (rpcError) throw rpcError
          })
        }
        disabled={Boolean(busy) || (!settings.enabled && !settings.key_configured)}
        className={settings.enabled ? 'btn-secondary' : 'btn-primary'}
      >
        {busy ? 'Saving…' : settings.enabled ? 'Turn payments off' : 'Turn payments on'}
      </button>
    </div>
  )
}
