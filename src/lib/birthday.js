// Client-side mirror of the age calculation in complete_profile(). The server
// recalculates it; this is only for showing the applicant their age.

/** { year, month, day } → 'YYYY-MM-DD', or '' if incomplete or not a real date. */
export function toIsoDate({ year, month, day } = {}) {
  if (!year || !month || !day) return ''
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  const real =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  return real ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''
}

/** Whole years between the birthday and today. */
export function ageOn(isoDate, today = new Date()) {
  if (!isoDate) return null
  const [y, m, d] = isoDate.split('-').map(Number)
  let age = today.getFullYear() - y
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1
  return age
}

export function formatBirthday(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
