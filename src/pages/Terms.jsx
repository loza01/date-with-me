import { Link } from 'react-router-dom'
import { Shell } from '../components/Shell'
import { PRIVACY_CONTACT_EMAIL } from '../config/privacy'
import { PAYMENT_DISCLAIMER, REVIEW_FEE, TERMS_VERSION } from '../config/payment'

function Section({ n, title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="font-serif text-2xl text-charcoal-900">
        <span className="text-rose-400">{n}.</span> {title}
      </h2>
      <div className="space-y-2 leading-relaxed text-charcoal-700">{children}</div>
    </section>
  )
}

export default function Terms() {
  const contact = PRIVACY_CONTACT_EMAIL ? (
    <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="font-medium text-rose-600 hover:underline">
      {PRIVACY_CONTACT_EMAIL}
    </a>
  ) : (
    <span className="rounded bg-rose-50 px-1.5 text-rose-700">[contact email to be added]</span>
  )

  return (
    <Shell>
      <article className="card space-y-8 p-6 sm:p-10">
        <header>
          <h1 className="font-serif text-4xl text-charcoal-900">Terms &amp; payment policy</h1>
          <p className="mt-2 text-sm text-charcoal-400">Last updated {TERMS_VERSION}</p>
        </header>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 text-rose-800">
          <p className="font-semibold">In short</p>
          <p className="mt-1">
            The {REVIEW_FEE} fee pays for an application review only. It is <strong>non-refundable</strong> and does
            <strong> not</strong> guarantee a date, a reply or any contact. I alone decide who passes.
          </p>
        </div>

        <Section n="1" title="What this site is">
          <p>
            A private, invitation-style application process run by one individual based in Spain (“I”, “me”). It is not
            a dating platform, agency or matchmaking service, and it offers no service beyond reviewing applications.
          </p>
        </Section>

        <Section n="2" title="Who may apply">
          <p>
            You must be 18 or older and apply honestly, in your own name, with your own photos and documents. False
            information ends your application without a refund.
          </p>
        </Section>

        <Section n="3" title={`The ${REVIEW_FEE} review fee`}>
          <ul className="list-disc space-y-1.5 pl-5">
            {PAYMENT_DISCLAIMER.points.map(([title, text]) => (
              <li key={title}>
                <strong>{title}.</strong> {text}
              </li>
            ))}
          </ul>
          <p>
            The fee is only asked for after your basic eligibility (nationality and country of residence) has been
            confirmed. If you are not eligible, you are not asked to pay.
          </p>
        </Section>

        <Section n="4" title="No refunds and your right of withdrawal">
          <p>
            Before paying, you ask for your review to start immediately and you acknowledge that, as a result, you lose
            the 14-day right of withdrawal that normally applies to online purchases in the EU. Once your review has
            started, the fee is not refunded for any reason, including:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>your application ending automatically because of your answers;</li>
            <li>not receiving a reply, a date or any contact;</li>
            <li>leaving or not finishing the application;</li>
            <li>your application being closed because information you gave was false.</li>
          </ul>
          <p>
            This does not affect rights you have by law that cannot be excluded, for example if you were charged twice,
            charged the wrong amount, or charged without your permission. In that case, email {contact}.
          </p>
        </Section>

        <Section n="5" title="Decisions">
          <p>
            Your answers are checked against my personal criteria, partly automatically. I keep complete discretion over
            who passes. Criteria are not published, decisions are final, and no reasons are given. If your application
            ends, your data is deleted and you may not apply again (see the{' '}
            <Link to="/privacy" className="font-medium text-rose-600 hover:underline">
              Privacy notice
            </Link>
            ).
          </p>
        </Section>

        <Section n="6" title="Disputes and chargebacks">
          <p>
            Please email {contact} before contacting your bank. A payment for a review that was provided as described in
            these terms is not an unauthorised charge. Where a chargeback is raised anyway, I may share proof of your
            consent and of the review with the payment provider.
          </p>
        </Section>

        <Section n="7" title="Law">
          <p>
            These terms are governed by Spanish law. This does not remove protections you have under the law of the
            country you live in.
          </p>
        </Section>

        <p className="pt-2">
          <Link to="/" className="text-sm font-medium text-rose-600 hover:underline">
            ← Back
          </Link>
        </p>
      </article>
    </Shell>
  )
}
