import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && key)

export const supabase = isConfigured ? createClient(url, key) : null

export const PHOTO_BUCKET = 'applicant-photos'
export const VOICE_BUCKET = 'applicant-voice'
export const ID_BUCKET = 'applicant-ids'

export function photoUrl(path) {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
}

// Turn Postgres exception names from our RPCs into readable text.
const RPC_ERRORS = {
  not_authenticated: 'Your session has expired. Please log in again.',
  profile_locked: 'Your profile has already been submitted.',
  missing_fields: 'Please complete every field.',
  photos_must_be_3_to_4: 'Please upload between 3 and 4 photos.',
  invalid_photo: 'One of your photos could not be verified. Please re-upload it.',
  not_screening: 'This questionnaire is no longer available.',
  out_of_order: 'Your progress changed in another tab. Reloading your place…',
  invalid_answer: 'Please provide a valid answer.',
  not_allowed: 'This step is no longer available.',
  invalid_x_url: 'Please enter a valid X (Twitter) profile link, e.g. https://x.com/yourname',
  missing_social: 'Please add your LinkedIn or Instagram profile.',
  invalid_linkedin_url: 'Please enter a valid LinkedIn profile link, e.g. https://linkedin.com/in/yourname',
  invalid_instagram_url: 'Please enter a valid Instagram profile link, e.g. https://instagram.com/yourname',
  missing_voice: 'Please record your voice introduction.',
  invalid_voice_length: 'Your voice introduction must be between 10 and 30 seconds.',
  invalid_date_of_birth: 'Please select your full date of birth. You must be at least 18.',
  application_closed: 'This application has been closed.',
  'Access Denied': 'This application has been closed.',
  files_remaining: 'Please try again. Your uploads are still being removed.',
  consent_required: 'Please tick the consent box to submit your profile.',
  payments_not_configured: 'Payments are not available right now. Please try again later.',
  payment_provider_error: 'The payment provider could not be reached. Please try again.',
  payment_consent_required: 'Please tick the box to agree before paying.',
  invalid_return_url: 'Payment could not be started from this address.',
  invalid_phone: 'Please enter a valid phone number, including your country code.',
  email_blocked: 'This email address cannot be used to apply.',
}

export function readableError(error) {
  if (!error) return null
  const code = Object.keys(RPC_ERRORS).find((k) => error.message?.includes(k))
  return code ? RPC_ERRORS[code] : error.message || 'Something went wrong. Please try again.'
}
