// International calling codes → country (ISO 3166 alpha-2), longest prefix wins.
const CALLING_CODES = {
  1: ['US', 'United States / Canada'],
  7: ['RU', 'Russia / Kazakhstan'],
  20: ['EG', 'Egypt'],
  27: ['ZA', 'South Africa'],
  30: ['GR', 'Greece'],
  31: ['NL', 'Netherlands'],
  32: ['BE', 'Belgium'],
  33: ['FR', 'France'],
  34: ['ES', 'Spain'],
  36: ['HU', 'Hungary'],
  39: ['IT', 'Italy'],
  40: ['RO', 'Romania'],
  41: ['CH', 'Switzerland'],
  43: ['AT', 'Austria'],
  44: ['GB', 'United Kingdom'],
  45: ['DK', 'Denmark'],
  46: ['SE', 'Sweden'],
  47: ['NO', 'Norway'],
  48: ['PL', 'Poland'],
  49: ['DE', 'Germany'],
  51: ['PE', 'Peru'],
  52: ['MX', 'Mexico'],
  53: ['CU', 'Cuba'],
  54: ['AR', 'Argentina'],
  55: ['BR', 'Brazil'],
  56: ['CL', 'Chile'],
  57: ['CO', 'Colombia'],
  58: ['VE', 'Venezuela'],
  60: ['MY', 'Malaysia'],
  61: ['AU', 'Australia'],
  62: ['ID', 'Indonesia'],
  63: ['PH', 'Philippines'],
  64: ['NZ', 'New Zealand'],
  65: ['SG', 'Singapore'],
  66: ['TH', 'Thailand'],
  81: ['JP', 'Japan'],
  82: ['KR', 'South Korea'],
  84: ['VN', 'Vietnam'],
  86: ['CN', 'China'],
  90: ['TR', 'Turkey'],
  91: ['IN', 'India'],
  92: ['PK', 'Pakistan'],
  94: ['LK', 'Sri Lanka'],
  98: ['IR', 'Iran'],
  211: ['SS', 'South Sudan'],
  212: ['MA', 'Morocco'],
  213: ['DZ', 'Algeria'],
  216: ['TN', 'Tunisia'],
  218: ['LY', 'Libya'],
  220: ['GM', 'Gambia'],
  221: ['SN', 'Senegal'],
  225: ['CI', 'Côte d’Ivoire'],
  233: ['GH', 'Ghana'],
  234: ['NG', 'Nigeria'],
  237: ['CM', 'Cameroon'],
  243: ['CD', 'DR Congo'],
  249: ['SD', 'Sudan'],
  250: ['RW', 'Rwanda'],
  251: ['ET', 'Ethiopia'],
  252: ['SO', 'Somalia'],
  253: ['DJ', 'Djibouti'],
  254: ['KE', 'Kenya'],
  255: ['TZ', 'Tanzania'],
  256: ['UG', 'Uganda'],
  260: ['ZM', 'Zambia'],
  263: ['ZW', 'Zimbabwe'],
  291: ['ER', 'Eritrea'],
  350: ['GI', 'Gibraltar'],
  351: ['PT', 'Portugal'],
  352: ['LU', 'Luxembourg'],
  353: ['IE', 'Ireland'],
  354: ['IS', 'Iceland'],
  355: ['AL', 'Albania'],
  356: ['MT', 'Malta'],
  357: ['CY', 'Cyprus'],
  358: ['FI', 'Finland'],
  359: ['BG', 'Bulgaria'],
  370: ['LT', 'Lithuania'],
  371: ['LV', 'Latvia'],
  372: ['EE', 'Estonia'],
  373: ['MD', 'Moldova'],
  374: ['AM', 'Armenia'],
  375: ['BY', 'Belarus'],
  376: ['AD', 'Andorra'],
  377: ['MC', 'Monaco'],
  378: ['SM', 'San Marino'],
  380: ['UA', 'Ukraine'],
  381: ['RS', 'Serbia'],
  382: ['ME', 'Montenegro'],
  383: ['XK', 'Kosovo'],
  385: ['HR', 'Croatia'],
  386: ['SI', 'Slovenia'],
  387: ['BA', 'Bosnia and Herzegovina'],
  389: ['MK', 'North Macedonia'],
  420: ['CZ', 'Czechia'],
  421: ['SK', 'Slovakia'],
  423: ['LI', 'Liechtenstein'],
  852: ['HK', 'Hong Kong'],
  886: ['TW', 'Taiwan'],
  961: ['LB', 'Lebanon'],
  962: ['JO', 'Jordan'],
  966: ['SA', 'Saudi Arabia'],
  971: ['AE', 'United Arab Emirates'],
  972: ['IL', 'Israel'],
  974: ['QA', 'Qatar'],
  995: ['GE', 'Georgia'],
}

const flagEmoji = (iso) =>
  iso === 'XK' ? '🇽🇰' : String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))

/**
 * '+44 7700 900123' → { flag: '🇬🇧', country: 'United Kingdom', code: '+44',
 *   national: '7700 900 123', dial: '+447700900123' }
 */
export function describePhone(raw) {
  const dial = raw.replace(/[^\d+]/g, '').replace(/^00/, '+')
  const digits = dial.replace(/\D/g, '')
  if (!dial.startsWith('+')) {
    return { flag: '📞', country: 'No country code', code: '', national: groupDigits(digits), dial: digits }
  }
  for (const len of [3, 2, 1]) {
    const code = digits.slice(0, len)
    if (CALLING_CODES[code]) {
      const [iso, country] = CALLING_CODES[code]
      return { flag: flagEmoji(iso), country, code: `+${code}`, national: groupDigits(digits.slice(len)), dial }
    }
  }
  return { flag: '🌐', country: 'Unknown country', code: '+', national: groupDigits(digits), dial }
}

/** Groups of 3 (last group up to 4) so the number is easy to read aloud. */
function groupDigits(d) {
  const groups = []
  let rest = d
  while (rest.length > 4) {
    groups.push(rest.slice(0, 3))
    rest = rest.slice(3)
  }
  if (rest) groups.push(rest)
  return groups.join(' ')
}
