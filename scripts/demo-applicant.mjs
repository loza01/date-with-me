/**
 * Demo applicant account for testing the applicant journey.
 *
 *   npm run demo-applicant
 *
 * First run: creates the account (email already confirmed) and prints a password.
 * Later runs: resets it to a brand-new applicant (unbanned, unblocked, answers,
 * photos, voice note, ID and phone removed; past final messages stay in the Trash Can).
 * The password stays the same.
 *
 * The account is also listed in public.reusable_emails, so a dealbreaker resets it
 * automatically; this script is only needed to force a reset.
 *
 * Needs SUPABASE_SECRET_KEY in .env. Run it only on your own computer.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const DEMO_EMAIL = 'lozaevita@gmail.com'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const [k, ...v] = l.split('=')
      return [k, v.join('=').trim().replace(/^"|"$/g, '')]
    }),
)
if (!env.SUPABASE_SECRET_KEY) throw new Error('SUPABASE_SECRET_KEY is missing from .env')

const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 })
if (listError) throw listError
const existing = list.users.find((u) => u.email === DEMO_EMAIL)

if (!existing) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const chunk = () => Array.from(randomBytes(4), (b) => alphabet[b % alphabet.length]).join('')
  const password = `${chunk()}-${chunk()}-${chunk()}-${chunk()}`

  // If a previous run banned this email, lift the ban first.
  await admin.from('banned_applicants').delete().eq('email', DEMO_EMAIL)
  const { error } = await admin.auth.admin.createUser({ email: DEMO_EMAIL, password, email_confirm: true })
  if (error) throw error
  console.log('Demo applicant created.')
  console.log(`  Email:    ${DEMO_EMAIL}`)
  console.log(`  Password: ${password}`)
  process.exit(0)
}

const id = existing.id
for (const bucket of ['applicant-photos', 'applicant-voice', 'applicant-ids']) {
  const { data: files } = await admin.storage.from(bucket).list(id)
  if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${id}/${f.name}`))
}
for (const table of ['questionnaire_responses', 'applicant_contacts']) {
  const { error } = await admin.from(table).delete().eq('user_id', id)
  if (error) throw error
}
await admin.from('banned_applicants').delete().eq('email', DEMO_EMAIL)

const { error: resetError } = await admin
  .from('profiles')
  .update({
    full_name: null,
    age: null,
    nationality: null,
    residence_country: null,
    occupation: null,
    hobbies: [],
    interests: [],
    lifestyle: null,
    photo_paths: [],
    x_url: null,
    linkedin_url: null,
    instagram_url: null,
    voice_path: null,
    voice_duration_seconds: null,
    date_of_birth: null,
    id_document_path: null,
    consent_at: null,
    consent_version: null,
    payment_terms_version: null,
    paid_at: null,
    nationality_detail: null,
    residence_detail: null,
    values_expectations: null,
    is_priority: false,
    match_passed: false,
    status: 'onboarding',
    current_step: 0,
    rejected_at_question: null,
    updated_at: new Date().toISOString(),
  })
  .eq('id', id)
if (resetError) throw resetError

const { error: unbanError } = await admin.auth.admin.updateUserById(id, { ban_duration: 'none' })
if (unbanError) throw unbanError

console.log(`Demo applicant ${DEMO_EMAIL} reset to a fresh application (same password).`)
console.log('If this browser shows "This application is closed", use a private window')
console.log('or clear the block: see README → "To unblock a browser you use for testing".')
