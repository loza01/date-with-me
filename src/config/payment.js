// Application review fee: all applicant-facing payment wording lives here.
// The checkout step itself is not active yet (needs a payment provider).

export const REVIEW_FEE = '€3.99'
export const TERMS_VERSION = '2026-09-15'

export const PAYMENT_DISCLAIMER = {
  title: `Application review fee: ${REVIEW_FEE}`,
  intro: 'Read this before you pay.',
  points: [
    [
      'A filter, not a purchase',
      `The ${REVIEW_FEE} fee is a deliberate barrier. Its only purpose is to filter out applicants who are not serious.`,
    ],
    ['What you are paying for', 'Your payment covers one review of your application. Nothing more.'],
    [
      'No guarantees',
      'Paying does NOT guarantee a date, a reply, a call, a meeting, contact of any kind, or access to me.',
    ],
    [
      'No refunds',
      'The fee is non-refundable once your review starts, whatever the outcome. That includes an application that ends automatically because of your answers, one you do not finish, or one you leave. This does not remove rights you have by law, for example if you were charged twice or in error.',
    ],
    [
      'My decision is final',
      'I alone decide who passes. My criteria are private, every decision is final, and no reasons are given.',
    ],
    ['Starts immediately', 'Your review begins the moment your payment is confirmed.'],
  ],
}

export const PAYMENT_CONSENT_TEXT = `I am 18 or older and I am the cardholder, or authorised to use this payment method. I understand that the ${REVIEW_FEE} fee pays ONLY for the review of my application and does not guarantee a date, a response or any contact. I ask for the review to start immediately after payment, and I acknowledge that I therefore lose my 14-day right of withdrawal and that the fee is non-refundable, whatever the outcome. I accept that every decision is made solely at the host’s discretion and is final. I have read and agree to the Terms & Payment Policy and the Privacy Notice.`
