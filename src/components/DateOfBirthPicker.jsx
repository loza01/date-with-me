import { ageOn, toIsoDate } from '../lib/birthday'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const THIS_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 83 }, (_, i) => THIS_YEAR - 18 - i) // 18 to 100 years ago
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

/** Day / Month / Year dropdowns. The applicant picks an exact birthday; age is calculated. */
export function DateOfBirthPicker({ value = {}, onChange }) {
  const iso = toIsoDate(value)
  const age = ageOn(iso)
  const complete = value.year && value.month && value.day
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value })

  return (
    <div>
      <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-2">
        <select aria-label="Day" value={value.day ?? ''} onChange={set('day')} className="input appearance-none px-3">
          <option value="" disabled>
            Day
          </option>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          aria-label="Month"
          value={value.month ?? ''}
          onChange={set('month')}
          className="input appearance-none px-3"
        >
          <option value="" disabled>
            Month
          </option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label="Year"
          value={value.year ?? ''}
          onChange={set('year')}
          className="input appearance-none px-3"
        >
          <option value="" disabled>
            Year
          </option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <p className={`mt-1.5 text-xs ${complete && !iso ? 'text-rose-700' : 'text-charcoal-400'}`}>
        {complete && !iso
          ? 'That date doesn’t exist. Please check the day.'
          : iso
            ? `Age: ${age} (calculated from your date of birth)`
            : 'Must match the date of birth on your ID.'}
      </p>
    </div>
  )
}
