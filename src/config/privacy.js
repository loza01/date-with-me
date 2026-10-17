// Support and privacy contact shown to applicants.
export const SUPPORT_EMAIL = 'support@doomfast.com'
export const PRIVACY_CONTACT_EMAIL = SUPPORT_EMAIL

// Bump this when the notice changes; it is stored with each applicant's consent.
export const PRIVACY_VERSION = '2026-10-17'

// Keep in sync with the DATA RETENTION block in supabase/schema.sql.
export const RETENTION = [
  [
    'Application that ends (profile, photos, voice note, answers)',
    'Deleted immediately when you close the “not a match” message, or 7 days after the application ended if you leave without closing it.',
  ],
  ['Name and age of an application that ended', 'Kept for 12 months, then deleted automatically.'],
  [
    'Security blocklist (a scrambled code made from your email, plus your IP address)',
    'Kept for 12 months, then deleted automatically.',
  ],
  ['Unfinished application', 'Deleted 90 days after your last activity.'],
  [
    'Match (profile, photos, voice note, answers, phone number)',
    'Kept for up to 12 months after the match, then deleted.',
  ],
  [
    'Payment record (reference, amount, date, status)',
    'Kept for as long as Spanish tax and accounting law requires (generally up to 6 years), even if everything else is deleted.',
  ],
]
