export const ADMIN_PATH = '/funtest'

/** Where a signed-in user belongs, based on server-side status. */
export function homeFor({ profile, isAdmin }) {
  if (isAdmin) return ADMIN_PATH
  switch (profile?.status) {
    case 'onboarding':
      return '/onboarding'
    case 'payment':
      return '/payment'
    case 'screening':
    case 'rejected':
      return '/questionnaire'
    case 'contact':
      return '/final-step'
    case 'completed':
      return '/complete'
    default:
      return '/'
  }
}
