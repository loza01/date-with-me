// `value`s must match c_priority_careers in supabase/schema.sql.
export const CAREERS = [
  { value: 'business', label: 'Business / Entrepreneur' },
  { value: 'tech', label: 'Tech / Engineering' },
  { value: 'finance', label: 'Finance' },
  { value: 'doctor', label: 'Medical Doctor' },
  { value: 'education', label: 'Education' },
  { value: 'law', label: 'Law' },
  { value: 'healthcare', label: 'Healthcare (other)' },
  { value: 'creative', label: 'Arts / Creative' },
  { value: 'trades', label: 'Skilled Trades' },
  { value: 'public_service', label: 'Public Service / Military' },
  { value: 'other', label: 'Other' },
]

export const careerLabel = (value) => CAREERS.find((c) => c.value === value)?.label ?? value
