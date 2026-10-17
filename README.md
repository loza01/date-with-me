# The Chosen Path

A private application website. Applicants sign up, watch a short introduction, complete a verified profile, pass an eligibility check, pay a review fee (optional), and answer a screening questionnaire. A private dashboard shows every application.

**Stack:** React 19 + Vite · Tailwind CSS v4 · Supabase (Postgres, Auth, Storage, Vault) · Stripe Checkout.

## Getting started

```bash
npm install
npm run dev            # http://localhost:5173
```

Create a `.env` file (it is git-ignored):

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon or publishable key>
```

Run `supabase/schema.sql` in the Supabase SQL Editor. It can be re-run safely; every change is applied in place.

To give an account access to the dashboard, run:

```sql
insert into public.admins (user_id) select id from auth.users where email = '<admin email>';
```

| Command                  | Purpose                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `npm run dev`            | Development server                                                  |
| `npm run build`          | Production build (minified and obfuscated)                          |
| `npx vite preview`       | Serve the production build locally with production security headers |
| `npm run lint`           | ESLint                                                              |
| `npm run format`         | Prettier                                                            |
| `npm run demo-applicant` | Create or reset the reusable test applicant                         |

## Application flow

| Status       | Route            | What happens                                                                                                                                                                                          |
| ------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onboarding` | `/onboarding`    | Introduction slides, then the profile form: date of birth, nationality and country, career, social links, background, values and expectations, 3–4 photos, 10–30 s voice note, consent |
| `payment`    | `/payment`       | Eligible applicants pay the review fee (only when payments are on)                                                                                                                                    |
| `screening`  | `/questionnaire` | The question cards, one at a time                                                                                                                                                                     |
| `contact`    | `/final-step`    | Phone number                                                                                                                                                                                          |
| `completed`  | `/complete`      | Match popup                                                                                                                                                                                           |
| `rejected`   | `/questionnaire` | "Not a match" popup                                                                                                                                                                                   |

- **Eligibility:** nationality and country of residence are checked when the profile is submitted, before any payment. See `public.is_approved_location()`.
- **Questions:** the cards are defined in `src/config/questions.js`, which holds wording only. Every rule lives in `public.submit_answer()`, and the server replies only `{ success, step, done }`.

## Rejection

Closing the "not a match" popup:

1. deletes the applicant's files through the Storage API;
2. calls `submit_exit_message()`, which in one transaction:
   - records name and age in `failed_applicants_messages`;
   - adds an md5 hash of the email and the IP address to `banned_applicants`;
   - deletes the account, which cascades to the profile, answers, contact details and sessions;
3. signs out, clears browser storage and sets a device block.

Banned emails and IP addresses are refused by triggers on `auth.users`, `profiles` and `applicant_contacts`, and optionally by the `hook_before_user_created` Auth hook.

Accounts listed in `reusable_emails` are reset instead of banned. Use one for testing.

## Emails (support@doomfast.com)

The site shows `support@doomfast.com` (`SUPPORT_EMAIL` in `src/config/privacy.js`) in the footer, the privacy notice, the terms and the match popup. Applicants reset forgotten passwords at `/forgot-password`, and the link in the email opens `/reset-password`.

To send sign-up confirmation and reset emails **from** support@doomfast.com:

1. **Custom SMTP:** Supabase → Authentication → Emails → **SMTP Settings** → enable, and enter your doomfast.com mail provider's details. Set the sender email to `support@doomfast.com` and the sender name to `The Chosen Path`.
2. **Templates:** Supabase → Authentication → Emails → **Templates**. Paste `supabase/email-templates/confirm-signup.html` into "Confirm signup" and `supabase/email-templates/reset-password.html` into "Reset password". The subject lines are at the top of each file.
3. **URL configuration:** Supabase → Authentication → **URL Configuration**. Set Site URL to `https://doomfast.com`, and add `https://doomfast.com/reset-password`, `https://www.doomfast.com/reset-password` and `http://localhost:5173/reset-password` to Redirect URLs.
4. **Domain verification:** add the SPF and DKIM DNS records your mail provider gives you for doomfast.com, so emails don't land in spam.

## Review fee (Stripe)

Postgres calls Stripe directly through the `http` extension, with the secret key stored in Vault. The questions unlock only after `confirm_payment()` verifies with Stripe that the session was paid, and checks the amount, currency and applicant.

To enable it:

1. Store the key: `select vault.create_secret('sk_…', 'stripe_secret_key');`
2. Make sure `https://doomfast.com` and `https://www.doomfast.com` are in `app_settings.allowed_return_origins` (the schema adds them on a fresh install).
3. Dashboard → **Settings** → **Turn payments on**.

The wording is in `src/config/payment.js`. The Terms page is `/terms`.

## Privacy and retention

- **Privacy notice:** `/privacy`. Set `PRIVACY_CONTACT_EMAIL` in `src/config/privacy.js` before launch.
- **Consent:** each applicant's consent time and notice version are stored with the profile.
- **Automatic deletion:** Trash Can entries and the ban list are deleted after 12 months by a nightly `pg_cron` job.
- **Dashboard deletion:** ID documents, abandoned or unfinished applications, and old matches are listed in the dashboard's **Data retention** tab.

## Dashboard

The dashboard is at `/funtest`, and its login form is at `/funtest?access=true`. Anyone else sees a generic 404. Its tabs are All applicants, Passed, Phone log, Trash Can, Data retention and Settings.

## Security

- **Database access:** Row Level Security is on every table. Signed-out visitors have no table privileges, and every write goes through a `SECURITY DEFINER` function that checks the caller's status.
- **Storage:** photos use unguessable paths; ID documents and voice notes are in private buckets, opened with short-lived signed links.
- **Production build:** the code is obfuscated, file names are hashed, and there are no source maps. There are also deterrents against DevTools: context-menu and shortcut blocking, and a debugger trap.
- **Security headers:** CSP, frame blocking, nosniff, referrer and permissions policy. They're defined in `security-headers.js` and mirrored in `vercel.json` and `public/_headers`.
- **Keep this repository private.** `supabase/schema.sql` contains the screening rules.
