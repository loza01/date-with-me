import { Link } from 'react-router-dom'
import { Shell } from '../components/Shell'
import { PRIVACY_CONTACT_EMAIL, PRIVACY_VERSION, RETENTION } from '../config/privacy'

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="font-serif text-2xl text-charcoal-900">{title}</h2>
      <div className="space-y-2 leading-relaxed text-charcoal-700">{children}</div>
    </section>
  )
}

export default function Privacy() {
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
          <h1 className="font-serif text-4xl text-charcoal-900">Privacy notice</h1>
          <p className="mt-2 text-sm text-charcoal-400">Last updated {PRIVACY_VERSION}</p>
        </header>

        <Section title="Who runs this site">
          <p>
            This private application site is run by one person, based in Spain (“I”, “me”). For anything about your
            data, email {contact}.
          </p>
        </Section>

        <Section title="What I collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Your email address and password (the password is handled by our login provider and never seen by me).
            </li>
            <li>Your profile: name, date of birth, nationality, country, career, hobbies, interests and lifestyle.</li>
            <li>3–4 photos, a short voice introduction, and links to your X, LinkedIn or Instagram profile.</li>
            <li>A photo of your driver’s licence or passport, to verify your identity and age.</li>
            <li>
              Your answers to the questionnaire. Some reveal <strong>religious beliefs and health information</strong>,
              which the law treats as especially sensitive.
            </li>
            <li>Your phone number, only if we are a match.</li>
            <li>
              If you pay the review fee: the payment reference, amount, date and status. Your card details are handled
              by the payment provider and are never seen or stored by me.
            </li>
            <li>Your IP address, to protect the site.</li>
          </ul>
        </Section>

        <Section title="Why, and on what basis">
          <p>
            I use your information only to decide whether we are a compatible match, to verify your identity and age, to
            contact you if we match, and to stop an application from being repeated after it has ended.
          </p>
          <p>
            I rely on your <strong>explicit consent</strong>, which you give with the checkbox before submitting your
            profile (GDPR Articles 6(1)(a) and 9(2)(a)). You can withdraw it at any time by emailing me; your
            application then ends and your data is deleted.
          </p>
          <p>
            Your answers are checked automatically against my personal criteria, and an application can end
            automatically as a result. If you have questions about this, email me.
          </p>
        </Section>

        <Section title="Who can see it">
          <p>
            Only me. The data is stored with Supabase, our database provider, in the European Union (Ireland). Your ID
            and voice note are kept in private storage. Payments are processed by a payment provider, which acts on my
            behalf. Your information is never sold or shared with anyone else.
          </p>
        </Section>

        <Section title="Payments and refunds">
          <p>
            The application review fee is <strong>non-refundable</strong>, as explained in the{' '}
            <Link to="/terms" className="font-medium text-rose-600 hover:underline">
              Terms &amp; payment policy
            </Link>
            . Paying does not guarantee a date, a reply or any contact. Payment records are kept for accounting and tax
            purposes, even after the rest of your application has been deleted.
          </p>
        </Section>

        <Section title="How long I keep it">
          <div className="overflow-x-auto rounded-2xl border border-cream-300/70">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-cream-300/70">
                {RETENTION.map(([what, rule]) => (
                  <tr key={what} className="align-top">
                    <th scope="row" className="w-2/5 px-4 py-3 font-medium text-charcoal-900">
                      {what}
                    </th>
                    <td className="px-4 py-3 text-charcoal-700">{rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Your rights">
          <p>
            You can ask to see, correct or delete your data, to restrict or object to its use, or to receive a copy.
            Email {contact}. You can also complain to the Spanish data protection authority,{' '}
            <a
              href="https://www.aepd.es"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-rose-600 hover:underline"
            >
              AEPD
            </a>
            .
          </p>
        </Section>

        <Section title="Age">
          <p>This site is only for adults aged 18 or over.</p>
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
