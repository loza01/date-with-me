-- =====================================================================
-- The Chosen Path — Supabase schema (v3)
-- Paste this whole file into Supabase Dashboard → SQL Editor → Run.
-- Safe to re-run after editing the rules.
--
-- Design notes
-- * All screening rules live in submit_answer() below, NOT in the React
--   bundle, so they can't be skipped or tampered with from the browser.
-- * Applicants never write tables directly. Every write goes through a
--   SECURITY DEFINER function that checks their current status first.
-- * Rejection is recorded the moment a dealbreaker is answered, so
--   closing the tab doesn't reset anything.
--
-- Upgrading from v2? Just re-run this file; new columns are added in place.
-- Already ran the v1 schema on this project? Run this once first:
--   drop table if exists public.final_messages, public.questionnaire_responses,
--     public.profiles cascade;
--   drop function if exists public.complete_profile(text, int, text, text[], text, text[]);
--   drop function if exists public.submit_final_message(text);
--   drop type if exists public.application_status;
-- =====================================================================

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
do $$ begin
  create type public.application_status as enum (
    'onboarding',  -- signed up, profile not 100% complete
    'screening',   -- swiping through the questionnaire
    'contact',     -- passed every card, phone number not yet given
    'completed',   -- 100% Match Passed, phone number saved
    'rejected',    -- hit a dealbreaker, exit message not yet sent
    'closed'       -- exit message sent, account banned, email blocked
  );
exception when duplicate_object then null; end $$;

-- v8: eligible profile waiting for the €3.99 review fee
alter type public.application_status add value if not exists 'payment' after 'onboarding';

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  email                 text,
  full_name             text,
  age                   int check (age between 18 and 120),
  nationality           text,
  residence_country     text,
  occupation            text,
  hobbies               text[] not null default '{}',
  interests             text[] not null default '{}',
  lifestyle             text,
  photo_paths           text[] not null default '{}',
  is_priority           boolean not null default false,
  match_passed          boolean not null default false,
  status                public.application_status not null default 'onboarding',
  current_step          int not null default 0,
  rejected_at_question  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- v3: social verification + voice introduction
alter table public.profiles add column if not exists x_url                  text;
alter table public.profiles add column if not exists linkedin_url           text;
alter table public.profiles add column if not exists instagram_url          text;
alter table public.profiles add column if not exists voice_path             text;
alter table public.profiles add column if not exists voice_duration_seconds numeric;

-- v7: privacy consent (recorded when the profile is submitted)
alter table public.profiles add column if not exists consent_at      timestamptz;
alter table public.profiles add column if not exists consent_version text;

-- v4: age verification (exact birthday + government ID)
alter table public.profiles add column if not exists date_of_birth    date;
alter table public.profiles add column if not exists id_document_path text;

-- v5: priority_star was renamed to is_priority
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'priority_star') then
    alter table public.profiles rename column priority_star to is_priority;
  end if;
end $$;

create index if not exists profiles_dashboard_idx
  on public.profiles (match_passed desc, is_priority desc, created_at desc);

create table if not exists public.questionnaire_responses (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  question_id     text not null,
  answer          jsonb not null,
  is_dealbreaker  boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (user_id, question_id)
);

-- Contact details for applicants who pass. Admin-only.
create table if not exists public.applicant_contacts (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  phone       text not null,
  created_at  timestamptz not null default now()
);

-- Trash Can: ONLY the name, age and final message of a disqualified applicant.
-- No link to the account, which is deleted.
create table if not exists public.failed_applicants_messages (
  id          bigint generated always as identity primary key,
  full_name   text,
  age         int,
  message     text not null check (char_length(message) <= 300),
  created_at  timestamptz not null default now()
);
alter table public.failed_applicants_messages add column if not exists full_name text;
alter table public.failed_applicants_messages add column if not exists age       int;
alter table public.failed_applicants_messages drop column if exists user_id;  -- v5

-- Test accounts that are never banned: a dealbreaker or a finished
-- application simply lets them start again.
create table if not exists public.reusable_emails (
  email text primary key check (email = lower(email))
);
insert into public.reusable_emails (email) values ('lozaevita@gmail.com') on conflict do nothing;

alter table public.profiles add column if not exists reusable boolean not null default false;
update public.profiles p
   set reusable = exists (select 1 from public.reusable_emails r where r.email = lower(p.email));

-- Blocklist: md5 hash of the email + IP address of every disqualified applicant.
create table if not exists public.banned_applicants (
  id          bigint generated always as identity primary key,
  email_hash  text,
  ip_address  inet,
  banned_at   timestamptz not null default now()
);
-- v5 → v6: plain emails become md5 hashes
alter table public.banned_applicants add column if not exists email_hash text;
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'banned_applicants' and column_name = 'email') then
    update public.banned_applicants set email_hash = md5(lower(trim(email))) where email is not null and email_hash is null;
    alter table public.banned_applicants drop column email;
  end if;
end $$;
create index if not exists banned_applicants_email_hash_idx on public.banned_applicants (email_hash);
create index if not exists banned_applicants_ip_idx         on public.banned_applicants (ip_address);

-- v5: carry over the old email-only blocklist
do $$ begin
  if to_regclass('public.blocked_emails') is not null then
    insert into public.banned_applicants (email_hash, banned_at)
    select md5(lower(trim(email))), blocked_at from public.blocked_emails;
    drop table public.blocked_emails;
  end if;
end $$;

-- Your account(s). After signing up once, run:
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com';
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- Site settings (admin-controlled).
create table if not exists public.app_settings (
  key   text primary key,
  value jsonb not null
);
insert into public.app_settings (key, value) values
  ('payments_enabled', 'false'),
  ('review_fee_cents', '399'),
  ('review_fee_currency', '"eur"'),
  -- Where Stripe may send applicants back to. Add the live site address here.
  ('allowed_return_origins', '["https://doomfast.com", "https://www.doomfast.com", "http://localhost:5173", "http://localhost:4173", "http://localhost:5190"]')
on conflict (key) do nothing;

-- Payment records. No foreign key on purpose: accounting records must survive
-- when an application (and its account) is deleted.
create table if not exists public.payments (
  id                 bigint generated always as identity primary key,
  user_id            uuid,
  stripe_session_id  text unique not null,
  stripe_payment_intent text,
  amount_cents       int not null,
  currency           text not null,
  status             text not null default 'open' check (status in ('open', 'paid', 'expired')),
  terms_version      text not null,
  created_at         timestamptz not null default now(),
  paid_at            timestamptz
);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);

alter table public.profiles add column if not exists payment_terms_version text;
-- v9: exact country written by applicants who choose "African"
alter table public.profiles add column if not exists nationality_detail text;
alter table public.profiles add column if not exists residence_detail   text;
-- v10: open answer on the profile
alter table public.profiles add column if not exists values_expectations text;
alter table public.profiles add column if not exists paid_at               timestamptz;

-- ---------------------------------------------------------------------
-- Ban helpers
-- ---------------------------------------------------------------------
-- The caller's IP address, as seen by the Supabase API gateway.
create or replace function public.request_ip()
returns inet
language plpgsql stable
set search_path = ''
as $$
declare
  v_headers jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  v_raw     text;
begin
  v_raw := coalesce(
    v_headers ->> 'cf-connecting-ip',
    trim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)),
    v_headers ->> 'x-real-ip');
  return nullif(v_raw, '')::inet;
exception when others then
  return null;
end;
$$;

create or replace function public.is_banned(p_email text, p_ip inet)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select not exists (select 1 from public.reusable_emails where email = lower(trim(coalesce(p_email, ''))))
     and exists (select 1 from public.banned_applicants b
                 where (p_email is not null and b.email_hash = md5(lower(trim(p_email))))
                    or (p_ip is not null and b.ip_address = p_ip));
$$;

-- Called by the sign-up page before showing the form.
create or replace function public.signup_allowed()
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select not public.is_banned(null, public.request_ip());
$$;

-- Supabase Auth hook ("Before User Created"): blocks banned emails AND IPs at
-- registration. Enable it in Dashboard → Authentication → Hooks.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_email text := event -> 'user' ->> 'email';
  v_ip    inet;
begin
  begin
    v_ip := nullif(event -> 'metadata' ->> 'ip_address', '')::inet;
  exception when others then
    v_ip := null;
  end;
  if public.is_banned(v_email, v_ip) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'This application has been closed.'));
  end if;
  return '{}'::jsonb;
end;
$$;

-- Runs right when a banned email or network tries to apply. Works on every
-- Supabase plan (no Auth hook needed). Attached below to the two submission
-- points: a profile entering the questionnaire, and the final phone number.
create or replace function public.check_banned_applicants()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_email text;
begin
  if tg_table_name = 'profiles' then
    -- only when an application is actually submitted
    if not (old.status = 'onboarding' and new.status in ('screening', 'payment')) then
      return new;
    end if;
    v_email := new.email;
  else
    select email into v_email from public.profiles where id = new.user_id;
  end if;

  if public.is_banned(v_email, public.request_ip()) then
    raise exception 'Access Denied: This account or network has been restricted from creating new applications.';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Auth triggers: block banned emails, auto-create a profile row
-- ---------------------------------------------------------------------
create or replace function public.block_banned_signups()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if public.is_banned(new.email, null) then
    raise exception 'email_blocked';
  end if;
  return new;
end;
$$;

drop trigger if exists before_auth_user_created on auth.users;
create trigger before_auth_user_created
  before insert on auth.users
  for each row execute function public.block_banned_signups();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, reusable)
  values (new.id, new.email,
          exists (select 1 from public.reusable_emails r where r.email = lower(trim(new.email))));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists ensure_applicant_not_banned on public.profiles;
create trigger ensure_applicant_not_banned
  before update of status on public.profiles
  for each row execute function public.check_banned_applicants();

drop trigger if exists ensure_applicant_not_banned on public.applicant_contacts;
create trigger ensure_applicant_not_banned
  before insert on public.applicant_contacts
  for each row execute function public.check_banned_applicants();

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles                   enable row level security;
alter table public.questionnaire_responses    enable row level security;
alter table public.applicant_contacts         enable row level security;
alter table public.failed_applicants_messages enable row level security;
alter table public.banned_applicants          enable row level security;
alter table public.admins                     enable row level security;
alter table public.reusable_emails            enable row level security;
alter table public.app_settings               enable row level security;
alter table public.payments                   enable row level security;
revoke insert, update, delete on public.app_settings from anon, authenticated;
revoke insert, update, delete on public.payments     from anon, authenticated;
revoke insert, update, delete on public.reusable_emails from anon, authenticated;

-- Signed-out visitors never read or write tables directly (defence in depth on
-- top of RLS). Everything they need goes through granted functions.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- No direct writes from the browser; the RPCs below do all of them.
revoke insert, update, delete on public.profiles                   from anon, authenticated;
revoke insert, update, delete on public.questionnaire_responses    from anon, authenticated;
revoke insert, update, delete on public.applicant_contacts         from anon, authenticated;
revoke insert, update, delete on public.failed_applicants_messages from anon, authenticated;
revoke insert, update, delete on public.banned_applicants          from anon, authenticated;
revoke insert, update, delete on public.admins                     from anon, authenticated;

drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "responses: admin read" on public.questionnaire_responses;
create policy "responses: admin read" on public.questionnaire_responses
  for select to authenticated
  using (public.is_admin());

drop policy if exists "contacts: admin read" on public.applicant_contacts;
create policy "contacts: admin read" on public.applicant_contacts
  for select to authenticated
  using (public.is_admin());

drop policy if exists "failed messages: admin read" on public.failed_applicants_messages;
create policy "failed messages: admin read" on public.failed_applicants_messages
  for select to authenticated
  using (public.is_admin());

drop policy if exists "payments: admin read" on public.payments;
create policy "payments: admin read" on public.payments
  for select to authenticated
  using (public.is_admin());

drop policy if exists "banned applicants: admin read" on public.banned_applicants;
create policy "banned applicants: admin read" on public.banned_applicants
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- Storage: public bucket for applicant photos, one folder per user
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('applicant-photos', 'applicant-photos', true, 8388608,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

drop policy if exists "photos: upload own folder while onboarding" on storage.objects;
create policy "photos: upload own folder while onboarding" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'applicant-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.status = 'onboarding')
  );

-- Removing a file through the Storage API also needs SELECT on the row.
drop policy if exists "photos: read own folder" on storage.objects;
create policy "photos: read own folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'applicant-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "photos: delete own while onboarding" on storage.objects;
drop policy if exists "photos: delete own while onboarding or rejected" on storage.objects;
create policy "photos: delete own while onboarding or rejected" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'applicant-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.status in ('onboarding', 'rejected'))
  );

-- Voice introductions: PRIVATE bucket. Only the admin can play them,
-- through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('applicant-voice', 'applicant-voice', false, 5242880,
        array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/aac'])
on conflict (id) do nothing;

drop policy if exists "voice: upload own folder while onboarding" on storage.objects;
create policy "voice: upload own folder while onboarding" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'applicant-voice'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.status = 'onboarding')
  );

drop policy if exists "voice: read own folder or admin" on storage.objects;
create policy "voice: read own folder or admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'applicant-voice'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "voice: delete own while onboarding" on storage.objects;
drop policy if exists "voice: delete own while onboarding or rejected" on storage.objects;
create policy "voice: delete own while onboarding or rejected" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'applicant-voice'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.status in ('onboarding', 'rejected'))
  );

-- Government ID photos: PRIVATE bucket. Only the admin can open them,
-- through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('applicant-ids', 'applicant-ids', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "ids: upload own folder while onboarding" on storage.objects;
create policy "ids: upload own folder while onboarding" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'applicant-ids'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.status = 'onboarding')
  );

drop policy if exists "ids: read own folder or admin" on storage.objects;
create policy "ids: read own folder or admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'applicant-ids'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "ids: delete own while onboarding" on storage.objects;
drop policy if exists "ids: delete own while onboarding or rejected" on storage.objects;
create policy "ids: delete own while onboarding or rejected" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'applicant-ids'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.status in ('onboarding', 'rejected'))
  );

-- Retention clean-up: the admin may delete any applicant file.
drop policy if exists "applicant files: admin delete" on storage.objects;
create policy "applicant files: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('applicant-photos', 'applicant-voice', 'applicant-ids') and public.is_admin());

drop policy if exists "applicant photos: admin list" on storage.objects;
create policy "applicant photos: admin list" on storage.objects
  for select to authenticated
  using (bucket_id = 'applicant-photos' and public.is_admin());

-- ---------------------------------------------------------------------
-- Rule 2 (checked when the profile is submitted, BEFORE any payment):
-- BOTH nationality and country of residence must pass.
--   Approved list: USA, UK, Ethiopia, Andorra, Austria, Belgium, Croatia,
--   Denmark, Netherlands, Finland, France, Georgia, Germany, Ghana, Greece,
--   Iceland, Ireland, Israel, Japan, Luxembourg, Norway, Russia, Sweden,
--   Switzerland.
--   "African" + the exact country written by the applicant: passes only for
--   the accepted African countries below. REJECTED: Angola, Nigeria, Togo,
--   South Africa, every Muslim-majority/plurality African country, and
--   anything not recognised.
--   "Other": rejected.
-- ---------------------------------------------------------------------
drop function if exists public.is_approved_location(text, text);

-- Written African country → canonical name (or null if not recognised).
create or replace function public.african_country(p_text text)
returns text
language sql immutable
set search_path = ''
as $$
  with norm as (
    select trim(regexp_replace(regexp_replace(regexp_replace(
             translate(lower(coalesce(p_text, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ’''.,-_/()', 'aaaaaaeeeeiiiiooooouuuucn          '),
             '\s+', ' ', 'g'),
             '^(the |republic of (the )?)', ''),
             ' (republic)$', '')) as t
  )
  select a.canonical
    from norm, (values
      ('algeria','Algeria'),('algerian','Algeria'),
      ('angola','Angola'),('angolan','Angola'),
      ('benin','Benin'),('beninese','Benin'),
      ('botswana','Botswana'),('motswana','Botswana'),('batswana','Botswana'),
      ('burkina faso','Burkina Faso'),('burkinabe','Burkina Faso'),
      ('burundi','Burundi'),('burundian','Burundi'),
      ('cabo verde','Cabo Verde'),('cape verde','Cabo Verde'),('cape verdean','Cabo Verde'),('cabo verdean','Cabo Verde'),
      ('cameroon','Cameroon'),('cameroonian','Cameroon'),
      ('central african','Central African Republic'),('central african republic','Central African Republic'),('car','Central African Republic'),
      ('chad','Chad'),('chadian','Chad'),
      ('comoros','Comoros'),('comorian','Comoros'),
      ('congo','Congo'),('congo brazzaville','Congo'),('congolese brazzaville','Congo'),
      ('democratic republic of congo','DR Congo'),('d r congo','DR Congo'),('d r c','DR Congo'),('democratic republic of the congo','DR Congo'),('dr congo','DR Congo'),('drc','DR Congo'),('congo kinshasa','DR Congo'),('congolese','DR Congo'),
      ('cote d ivoire','Côte d’Ivoire'),('cote divoire','Côte d’Ivoire'),('ivory coast','Côte d’Ivoire'),('ivorian','Côte d’Ivoire'),
      ('djibouti','Djibouti'),('djiboutian','Djibouti'),
      ('egypt','Egypt'),('egyptian','Egypt'),
      ('equatorial guinea','Equatorial Guinea'),('equatoguinean','Equatorial Guinea'),
      ('eritrea','Eritrea'),('eritrean','Eritrea'),
      ('eswatini','Eswatini'),('swaziland','Eswatini'),('swazi','Eswatini'),
      ('ethiopia','Ethiopia'),('ethiopian','Ethiopia'),
      ('gabon','Gabon'),('gabonese','Gabon'),
      ('gambia','Gambia'),('gambian','Gambia'),
      ('ghana','Ghana'),('ghanaian','Ghana'),
      ('guinea','Guinea'),('guinean','Guinea'),
      ('guinea bissau','Guinea-Bissau'),('bissau guinean','Guinea-Bissau'),
      ('kenya','Kenya'),('kenyan','Kenya'),
      ('lesotho','Lesotho'),('basotho','Lesotho'),('mosotho','Lesotho'),
      ('liberia','Liberia'),('liberian','Liberia'),
      ('libya','Libya'),('libyan','Libya'),
      ('madagascar','Madagascar'),('malagasy','Madagascar'),
      ('malawi','Malawi'),('malawian','Malawi'),
      ('mali','Mali'),('malian','Mali'),
      ('mauritania','Mauritania'),('mauritanian','Mauritania'),
      ('mauritius','Mauritius'),('mauritian','Mauritius'),
      ('morocco','Morocco'),('moroccan','Morocco'),
      ('mozambique','Mozambique'),('mozambican','Mozambique'),
      ('namibia','Namibia'),('namibian','Namibia'),
      ('niger','Niger'),('nigerien','Niger'),
      ('nigeria','Nigeria'),('nigerian','Nigeria'),
      ('rwanda','Rwanda'),('rwandan','Rwanda'),
      ('sao tome and principe','São Tomé and Príncipe'),('sao tome','São Tomé and Príncipe'),('santomean','São Tomé and Príncipe'),
      ('senegal','Senegal'),('senegalese','Senegal'),
      ('seychelles','Seychelles'),('seychellois','Seychelles'),
      ('sierra leone','Sierra Leone'),('sierra leonean','Sierra Leone'),
      ('somalia','Somalia'),('somali','Somalia'),('somalian','Somalia'),('somaliland','Somalia'),
      ('south africa','South Africa'),('south african','South Africa'),
      ('south sudan','South Sudan'),('south sudanese','South Sudan'),
      ('sudan','Sudan'),('sudanese','Sudan'),
      ('tanzania','Tanzania'),('tanzanian','Tanzania'),
      ('togo','Togo'),('togolese','Togo'),
      ('tunisia','Tunisia'),('tunisian','Tunisia'),
      ('uganda','Uganda'),('ugandan','Uganda'),
      ('zambia','Zambia'),('zambian','Zambia'),
      ('zimbabwe','Zimbabwe'),('zimbabwean','Zimbabwe')
    ) as a(alias, canonical)
   where a.alias = norm.t
   limit 1;
$$;

create or replace function public.is_approved_location(
  p_nationality text, p_residence text,
  p_nationality_detail text default null, p_residence_detail text default null
)
returns boolean
language sql immutable
set search_path = ''
as $$
  with lists as (
    select
      array['United States', 'United Kingdom', 'Ethiopia', 'Andorra', 'Austria', 'Belgium', 'Croatia',
            'Denmark', 'Netherlands', 'Finland', 'France', 'Georgia', 'Germany', 'Ghana', 'Greece',
            'Iceland', 'Ireland', 'Israel', 'Japan', 'Luxembourg', 'Norway', 'Russia', 'Sweden',
            'Switzerland'] as approved,
      -- African countries accepted when written after choosing "African"
      array['Benin', 'Botswana', 'Burundi', 'Cabo Verde', 'Cameroon', 'Central African Republic', 'Congo',
            'DR Congo', 'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Ghana', 'Kenya',
            'Lesotho', 'Liberia', 'Madagascar', 'Malawi', 'Mauritius', 'Mozambique', 'Namibia', 'Rwanda',
            'São Tomé and Príncipe', 'Seychelles', 'South Sudan', 'Tanzania', 'Uganda', 'Zambia',
            'Zimbabwe'] as african
  )
  select coalesce(
       (p_nationality = any (approved)
         or (p_nationality = 'African' and public.african_country(p_nationality_detail) = any (african)))
   and (p_residence = any (approved)
         or (p_residence = 'African' and public.african_country(p_residence_detail) = any (african))),
   false)
  from lists;
$$;

-- ---------------------------------------------------------------------
-- RPC: finish onboarding (the 100% gate)
-- ---------------------------------------------------------------------
-- Older signatures, replaced below
drop function if exists public.complete_profile(text, int, text, text, text, text[], text[], text, text[]);
drop function if exists public.complete_profile(text, int, text, text, text, text[], text[], text, text[], text, text, text, text, numeric);
drop function if exists public.complete_profile(text, date, text, text, text, text[], text[], text, text[], text, text, text, text, numeric, text);
drop function if exists public.complete_profile(text, date, text, text, text, text[], text[], text, text[], text, text, text, text, numeric, text, text) cascade;  -- v8 (before African detail)
drop function if exists public.complete_profile(text, date, text, text, text, text[], text[], text, text[], text, text, text, text, numeric, text, text, text, text) cascade;  -- v9 (before values & expectations)
do $$ begin  -- v7 returned void; the jsonb version below replaces it
  if exists (select 1 from pg_proc where oid = to_regprocedure('public.complete_profile(text, date, text, text, text, text[], text[], text, text[], text, text, text, text, numeric, text, text)')
             and prorettype = 'void'::regtype) then
    drop function public.complete_profile(text, date, text, text, text, text[], text[], text, text[], text, text, text, text, numeric, text, text);
  end if;
end $$;

create or replace function public.complete_profile(
  p_full_name         text,
  p_date_of_birth     date,
  p_nationality       text,
  p_residence_country text,
  p_occupation        text,
  p_hobbies           text[],
  p_interests         text[],
  p_lifestyle         text,
  p_photo_paths       text[],
  p_x_url             text,
  p_linkedin_url      text,
  p_instagram_url     text,
  p_voice_path        text,
  p_voice_duration    numeric,
  p_id_document_path  text default null, -- no longer collected; kept so older clients still work
  p_consent_version   text default null,
  p_nationality_detail text default null,
  p_residence_detail   text default null,
  p_values_expectations text default null
)
-- {"success": true}  → next step (payment, or questions when payments are off)
-- {"success": false} → not eligible: application ended, nothing charged
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  -- Priority careers get a ⭐ on the dashboard.
  c_priority_careers text[] := array['business', 'tech', 'finance', 'doctor'];

  v_uid      uuid := auth.uid();
  v_path     text;
  v_age      int;
  v_eligible boolean;
  v_next     public.application_status;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (select 1 from public.profiles
                 where id = v_uid and status = 'onboarding') then
    raise exception 'profile_locked';
  end if;

  -- Explicit consent to the privacy notice (required for religion/health data).
  if coalesce(trim(p_consent_version), '') = '' then
    raise exception 'consent_required';
  end if;

  -- Banned email or IP address: cannot apply again under a new account.
  if public.is_banned((select email from public.profiles where id = v_uid), public.request_ip()) then
    raise exception 'application_closed';
  end if;

  -- Age is calculated from the exact birthday, never typed in.
  if p_date_of_birth is null or p_date_of_birth > current_date then
    raise exception 'invalid_date_of_birth';
  end if;
  v_age := date_part('year', age(current_date, p_date_of_birth))::int;
  if v_age not between 18 and 100 then
    raise exception 'invalid_date_of_birth';
  end if;

  if coalesce(trim(p_full_name), '') = ''
     or coalesce(p_nationality, '') = ''
     or coalesce(p_residence_country, '') = ''
     or coalesce(p_occupation, '') = ''
     or coalesce(array_length(p_hobbies, 1), 0) = 0
     or coalesce(array_length(p_interests, 1), 0) = 0
     or coalesce(trim(p_lifestyle), '') = ''
     or coalesce(trim(p_values_expectations), '') = '' then
    raise exception 'missing_fields';
  end if;

  -- Social verification: X is required, plus LinkedIn or Instagram.
  if coalesce(p_x_url, '') !~* '^https://(www\.|mobile\.)?(x|twitter)\.com/[A-Za-z0-9_]{1,15}/?([?#].*)?$' then
    raise exception 'invalid_x_url';
  end if;
  if coalesce(p_linkedin_url, '') = '' and coalesce(p_instagram_url, '') = '' then
    raise exception 'missing_social';
  end if;
  if coalesce(p_linkedin_url, '') <> ''
     and p_linkedin_url !~* '^https://([a-z]{2,3}\.)?(www\.)?linkedin\.com/(in|pub)/[^\s/?#]+/?([?#].*)?$' then
    raise exception 'invalid_linkedin_url';
  end if;
  if coalesce(p_instagram_url, '') <> ''
     and p_instagram_url !~* '^https://(www\.)?instagram\.com/[A-Za-z0-9_.]{1,30}/?([?#].*)?$' then
    raise exception 'invalid_instagram_url';
  end if;

  -- Voice intro: recorded in the browser, 10–30 seconds.
  if coalesce(p_voice_path, '') = ''
     or split_part(p_voice_path, '/', 1) <> v_uid::text
     or not exists (select 1 from storage.objects
                    where bucket_id = 'applicant-voice' and name = p_voice_path) then
    raise exception 'missing_voice';
  end if;
  if p_voice_duration is null or p_voice_duration not between 10 and 31 then
    raise exception 'invalid_voice_length';
  end if;

  if coalesce(array_length(p_photo_paths, 1), 0) not between 3 and 4 then
    raise exception 'photos_must_be_3_to_4';
  end if;

  foreach v_path in array p_photo_paths loop
    if split_part(v_path, '/', 1) <> v_uid::text
       or not exists (select 1 from storage.objects
                      where bucket_id = 'applicant-photos' and name = v_path) then
      raise exception 'invalid_photo';
    end if;
  end loop;

  if (p_nationality = 'African' and coalesce(trim(p_nationality_detail), '') = '')
     or (p_residence_country = 'African' and coalesce(trim(p_residence_detail), '') = '') then
    raise exception 'missing_fields';
  end if;

  v_eligible := public.is_approved_location(p_nationality, p_residence_country, p_nationality_detail, p_residence_detail);
  v_next := case
    when not v_eligible then 'rejected'
    when coalesce((select value::text::boolean from public.app_settings where key = 'payments_enabled'), false)
      then 'payment'
    else 'screening'
  end;

  update public.profiles
     set full_name         = trim(p_full_name),
         date_of_birth     = p_date_of_birth,
         age               = v_age,
         nationality       = p_nationality,
         residence_country = p_residence_country,
         nationality_detail = case when p_nationality = 'African' then left(trim(p_nationality_detail), 80) end,
         residence_detail   = case when p_residence_country = 'African' then left(trim(p_residence_detail), 80) end,
         occupation        = p_occupation,
         is_priority       = p_occupation = any (c_priority_careers),
         hobbies           = p_hobbies,
         interests         = p_interests,
         lifestyle         = trim(p_lifestyle),
         values_expectations = left(trim(p_values_expectations), 2000),
         photo_paths       = p_photo_paths,
         x_url             = p_x_url,
         linkedin_url      = nullif(p_linkedin_url, ''),
         instagram_url     = nullif(p_instagram_url, ''),
         voice_path        = p_voice_path,
         voice_duration_seconds = round(p_voice_duration, 1),
         id_document_path  = p_id_document_path,
         consent_at        = now(),
         consent_version   = trim(p_consent_version),
         status            = v_next,
         rejected_at_question = case when v_eligible then null else 'location' end,
         updated_at        = now()
   where id = v_uid;

  if not v_eligible then
    insert into public.questionnaire_responses (user_id, question_id, answer, is_dealbreaker)
    values (v_uid, 'location',
            jsonb_build_object('nationality', p_nationality, 'residence_country', p_residence_country,
                               'nationality_detail', p_nationality_detail, 'residence_detail', p_residence_detail), true)
    on conflict (user_id, question_id) do nothing;
    return jsonb_build_object('success', false);
  end if;
  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: answer one card — THE MATRIX
-- Deliberately neutral response, so the Network tab reveals nothing:
--   {"success": false}                           application ended
--   {"success": true, "step": n}                 next card
--   {"success": true, "step": n, "done": true}   all cards answered
-- ---------------------------------------------------------------------
create or replace function public.submit_answer(p_question_id text, p_answer jsonb)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  -- Cards must be answered in exactly this order.
  c_order text[] := array[
    'orientation',          -- 0  straight men only
    'age',                  -- 1
    'religion',             -- 3
    'church',               -- 4
    'height',               -- 5
    'tattoos',              -- 6
    'piercings',            -- 6
    'masculine',            -- 8
    'fifty_fifty',          -- 7  modern 50/50 partnership: YES is a dealbreaker
    'impatient',            -- 8
    'understands_faster',   -- humility: YES is a dealbreaker
    'boss_vulnerability',   -- humility: YES is a dealbreaker
    'meant_for_big_things', -- humility: YES is a dealbreaker
    'naive_own_fault',      -- empathy: YES is a dealbreaker
    'family',               -- 9
    'marriage_children',    -- married/divorced? has children? YES to either is a dealbreaker
    'family_intent',        -- family intent: must be husband AND father
    'children',             -- 10  fewer than 3 children is a dealbreaker
    'chronic_health',       -- 12
    'mental_health',        -- 12
    'relocation',           -- 13
    -- Final phase (not dealbreakers): lifestyle & financial cohesion
    'lifestyle_vision',
    'financial_strategy',
    'talents',
    'love_expression',      -- multi-select, not scored
    'questions_for_me'      -- optional: anything they want to ask
  ];

  -- Yes/No swipe cards and the ONLY acceptable swipe for each.
  c_binary jsonb := '{
    "orientation":         "yes",
    "church":              "yes",
    "tattoos":             "no",
    "piercings":           "no",
    "fifty_fifty":         "no",
    "masculine":           "yes",
    "impatient":           "no",
    "understands_faster":   "no",
    "boss_vulnerability":   "no",
    "meant_for_big_things": "no",
    "naive_own_fault":      "no",
    "family":              "yes",
    "children":            "yes",
    "chronic_health":      "no",
    "mental_health":       "no"
  }';

  v_uid     uuid := auth.uid();
  v_profile public.profiles;
  v_value   text := p_answer ->> 'value';
  v_height  numeric;
  v_ok      boolean;
  v_step    int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;

  if v_profile.status is distinct from 'screening' then
    raise exception 'not_screening';
  end if;

  v_step := v_profile.current_step;
  if v_step >= array_length(c_order, 1) or c_order[v_step + 1] <> p_question_id then
    raise exception 'out_of_order';
  end if;

  if c_binary ? p_question_id then
    if v_value not in ('yes', 'no') or v_value is null then
      raise exception 'invalid_answer';
    end if;
    v_ok := v_value = c_binary ->> p_question_id;

  elsif p_question_id = 'age' then
    -- 1. Age 28–40, calculated from the date of birth on the day they answer.
    v_profile.age := coalesce(date_part('year', age(current_date, v_profile.date_of_birth))::int, v_profile.age);
    v_ok := v_profile.age between 28 and 40;

  elsif p_question_id = 'religion' then
    -- 3. Catholic or Orthodox Christian only.
    if v_value is null then
      raise exception 'invalid_answer';
    end if;
    v_ok := v_value in ('catholic', 'orthodox');

  elsif p_question_id = 'height' then
    -- 5. 182–190 cm (the client always sends centimetres).
    begin
      v_height := v_value::numeric;
    exception when others then
      raise exception 'invalid_answer';
    end;
    if v_height is null or v_height not between 100 and 250 then
      raise exception 'invalid_answer';
    end if;
    v_ok := v_height between 182 and 190;

  elsif p_question_id = 'marriage_children' then
    -- One card, two questions: both must be answered, and both must be NO.
    if coalesce(p_answer ->> 'previously_married', '') not in ('yes', 'no')
       or coalesce(p_answer ->> 'has_children', '') not in ('yes', 'no') then
      raise exception 'invalid_answer';
    end if;
    v_ok := p_answer ->> 'previously_married' = 'no' and p_answer ->> 'has_children' = 'no';

  elsif p_question_id = 'love_expression' then
    -- How do you express your love and care? Any number of options, not scored.
    if jsonb_typeof(p_answer -> 'values') is distinct from 'array'
       or jsonb_array_length(p_answer -> 'values') = 0
       or exists (select 1 from jsonb_array_elements_text(p_answer -> 'values') g
                  where g <> all (array['active_listening', 'anticipatory_service', 'physical_affection',
                                       'generosity_of_time', 'words_of_affirmation', 'personalized_giving',
                                       'total_forgiveness', 'culinary_care', 'radical_empathy'])) then
      raise exception 'invalid_answer';
    end if;
    v_ok := true;

  elsif p_question_id in ('lifestyle_vision', 'talents') then
    -- Final phase: open answers, recorded for the admin.
    if char_length(trim(coalesce(v_value, ''))) not between 10 and 1000 then
      raise exception 'invalid_answer';
    end if;
    v_ok := true;

  elsif p_question_id = 'family_intent' then
    -- Family intent matrix: BOTH a husband AND a father, nothing less.
    if v_value is null or v_value not in ('husband_and_father', 'dual_partnership') then
      raise exception 'invalid_answer';
    end if;
    v_ok := v_value = 'husband_and_father';

  elsif p_question_id = 'questions_for_me' then
    -- Optional two-way question: anything up to 1000 characters, or nothing.
    if char_length(coalesce(v_value, '')) > 1000 then
      raise exception 'invalid_answer';
    end if;
    v_ok := true;

  elsif p_question_id = 'financial_strategy' then
    if v_value is null or v_value not in ('build_empire', 'sole_provider', 'individual_careers') then
      raise exception 'invalid_answer';
    end if;
    v_ok := true;

  elsif p_question_id = 'relocation' then
    -- 13. "Yes" or "Let's see..." pass; "No" is a dealbreaker.
    if v_value not in ('yes', 'maybe', 'no') or v_value is null then
      raise exception 'invalid_answer';
    end if;
    v_ok := v_value in ('yes', 'maybe');
  end if;

  insert into public.questionnaire_responses (user_id, question_id, answer, is_dealbreaker)
  values (
    v_uid, p_question_id,
    case p_question_id
      when 'age' then jsonb_build_object('value', v_profile.age)
      when 'location' then jsonb_build_object(
        'nationality', v_profile.nationality,
        'residence_country', v_profile.residence_country)
      else p_answer
    end,
    not v_ok
  );

  if not v_ok then
    update public.profiles
       set status = 'rejected',
           rejected_at_question = p_question_id,
           updated_at = now()
     where id = v_uid;
    return jsonb_build_object('success', false);
  end if;

  update public.profiles
     set current_step = v_step + 1,
         status = case when v_step + 1 = array_length(c_order, 1)
                       then 'contact'::public.application_status
                       else status end,
         updated_at = now()
   where id = v_uid;

  if v_step + 1 = array_length(c_order, 1) then
    return jsonb_build_object('success', true, 'step', v_step + 1, 'done', true);
  end if;
  return jsonb_build_object('success', true, 'step', v_step + 1);
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: live check while a multi-select card changes. The browser calls this
-- on EVERY tick, identically for every option, so the page never knows which
-- option matters. No multi-select card currently disqualifies, so this only
-- validates and returns {"success": true}; nothing is saved.
-- ---------------------------------------------------------------------
create or replace function public.check_selection(p_question_id text, p_answer jsonb)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
begin
  if p_question_id not in ('love_expression') or jsonb_typeof(p_answer -> 'values') is distinct from 'array' then
    raise exception 'invalid_answer';
  end if;
  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------
-- PAYMENTS (Stripe Checkout, called straight from Postgres)
-- The Stripe secret key lives in Supabase Vault as 'stripe_secret_key':
--   select vault.create_secret('sk_live_…', 'stripe_secret_key');
-- ---------------------------------------------------------------------
do $$ begin
  create extension if not exists http with schema extensions;
exception when others then
  raise notice 'http extension not available (%); payments cannot be used', sqlerrm;
end $$;

create or replace function public.stripe_request(p_method text, p_path text, p_body text default null)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_key  text;
  v_resp record;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'stripe_secret_key' limit 1;
  if v_key is null then
    raise exception 'payments_not_configured';
  end if;
  select * into v_resp from extensions.http((
    p_method,
    'https://api.stripe.com/v1/' || p_path,
    array[extensions.http_header('Authorization', 'Bearer ' || v_key)],
    'application/x-www-form-urlencoded',
    p_body
  )::extensions.http_request);
  if v_resp.status >= 400 then
    raise exception 'payment_provider_error';
  end if;
  return v_resp.content::jsonb;
end;
$$;

-- Starts a €3.99 Stripe Checkout session and returns its URL.
create or replace function public.start_checkout(p_terms_version text, p_return_origin text)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_profile  public.profiles;
  v_cents    int  := (select value::text::int from public.app_settings where key = 'review_fee_cents');
  v_currency text := (select value #>> '{}' from public.app_settings where key = 'review_fee_currency');
  v_session  jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_profile from public.profiles where id = v_uid and status = 'payment';
  if not found then
    raise exception 'not_allowed';
  end if;
  if coalesce(trim(p_terms_version), '') = '' then
    raise exception 'payment_consent_required';
  end if;
  if not exists (select 1 from public.app_settings, jsonb_array_elements_text(value) o
                 where key = 'allowed_return_origins' and o = p_return_origin) then
    raise exception 'invalid_return_url';
  end if;
  if public.is_banned(v_profile.email, public.request_ip()) then
    raise exception 'application_closed';
  end if;

  v_session := public.stripe_request('POST', 'checkout/sessions', concat_ws('&',
    'mode=payment',
    'success_url=' || extensions.urlencode(p_return_origin || '/payment?session_id={CHECKOUT_SESSION_ID}'),
    'cancel_url=' || extensions.urlencode(p_return_origin || '/payment?cancelled=1'),
    'client_reference_id=' || v_uid,
    'metadata[user_id]=' || v_uid,
    'customer_email=' || extensions.urlencode(v_profile.email),
    'line_items[0][quantity]=1',
    'line_items[0][price_data][currency]=' || v_currency,
    'line_items[0][price_data][unit_amount]=' || v_cents,
    'line_items[0][price_data][product_data][name]=' || extensions.urlencode('Application review fee (non-refundable)')
  ));

  insert into public.payments (user_id, stripe_session_id, amount_cents, currency, terms_version)
  values (v_uid, v_session ->> 'id', v_cents, v_currency, trim(p_terms_version));

  update public.profiles
     set payment_terms_version = trim(p_terms_version), updated_at = now()
   where id = v_uid;

  return jsonb_build_object('url', v_session ->> 'url');
end;
$$;

-- Asks Stripe whether the applicant's checkout was paid. Only Stripe's answer
-- counts; the browser's return page is never trusted.
create or replace function public.confirm_payment()
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_status   public.application_status;
  v_cents    int  := (select value::text::int from public.app_settings where key = 'review_fee_cents');
  v_currency text := (select value #>> '{}' from public.app_settings where key = 'review_fee_currency');
  v_payment  public.payments;
  v_session  jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select status into v_status from public.profiles where id = v_uid for update;
  if v_status is distinct from 'payment' then
    return jsonb_build_object('paid', v_status in ('screening', 'contact', 'completed'));
  end if;

  for v_payment in
    select * from public.payments where user_id = v_uid and status = 'open' order by created_at desc limit 5
  loop
    v_session := public.stripe_request('GET', 'checkout/sessions/' || v_payment.stripe_session_id);
    if v_session ->> 'payment_status' = 'paid'
       and v_session -> 'metadata' ->> 'user_id' = v_uid::text
       and (v_session ->> 'amount_total')::int = v_cents
       and v_session ->> 'currency' = v_currency then
      update public.payments
         set status = 'paid', paid_at = now(), stripe_payment_intent = v_session ->> 'payment_intent'
       where id = v_payment.id;
      update public.profiles
         set status = 'screening', paid_at = now(), updated_at = now()
       where id = v_uid;
      return jsonb_build_object('paid', true);
    elsif v_session ->> 'status' = 'expired' then
      update public.payments set status = 'expired' where id = v_payment.id;
    end if;
  end loop;

  return jsonb_build_object('paid', false);
end;
$$;

-- Dashboard: payment settings (admin only).
create or replace function public.admin_payment_settings()
returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  return jsonb_build_object(
    'enabled', coalesce((select value::text::boolean from public.app_settings where key = 'payments_enabled'), false),
    'key_configured', exists (select 1 from vault.decrypted_secrets where name = 'stripe_secret_key'),
    'test_mode', exists (select 1 from vault.decrypted_secrets where name = 'stripe_secret_key' and decrypted_secret like 'sk_test_%'),
    'fee_cents', (select value::text::int from public.app_settings where key = 'review_fee_cents'),
    'currency', (select value #>> '{}' from public.app_settings where key = 'review_fee_currency'),
    'paid_count', (select count(*) from public.payments where status = 'paid')
  );
end;
$$;

create or replace function public.admin_set_payments_enabled(p_enabled boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  if p_enabled and not exists (select 1 from vault.decrypted_secrets where name = 'stripe_secret_key') then
    raise exception 'payments_not_configured';
  end if;
  update public.app_settings set value = to_jsonb(p_enabled) where key = 'payments_enabled';
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: 14. phone capture → 100% Match Passed
-- ---------------------------------------------------------------------
create or replace function public.submit_contact(p_phone text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_phone  text := trim(coalesce(p_phone, ''));
  v_digits text := regexp_replace(v_phone, '\D', '', 'g');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (select 1 from public.profiles
                 where id = v_uid and status = 'contact') then
    raise exception 'not_allowed';
  end if;

  if v_phone !~ '^\+?[0-9 ().-]+$' or length(v_digits) not between 7 and 15 then
    raise exception 'invalid_phone';
  end if;

  insert into public.applicant_contacts (user_id, phone) values (v_uid, v_phone);

  update public.profiles
     set status = 'completed', match_passed = true, updated_at = now()
   where id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------
-- Internal: wipe an application back to a fresh sign-up (reusable accounts)
-- ---------------------------------------------------------------------
create or replace function public.reset_application(p_uid uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  delete from public.questionnaire_responses where user_id = p_uid;
  delete from public.applicant_contacts where user_id = p_uid;
  update public.profiles
     set full_name = null, age = null, nationality = null, residence_country = null,
         occupation = null, hobbies = '{}', interests = '{}', lifestyle = null,
         photo_paths = '{}', x_url = null, linkedin_url = null, instagram_url = null,
         voice_path = null, voice_duration_seconds = null,
         date_of_birth = null, id_document_path = null,
         consent_at = null, consent_version = null, payment_terms_version = null, paid_at = null,
         nationality_detail = null, residence_detail = null, values_expectations = null,
         is_priority = false, match_passed = false,
         status = 'onboarding', current_step = 0, rejected_at_question = null,
         updated_at = now()
   where id = p_uid;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: Phase 3 exit sequence, in ONE transaction:
--   1. save only name, age and the final message (Trash Can)
--   2. write email + IP address to banned_applicants
--   3. purge: delete the account, which cascades to the profile, answers,
--      phone number and sessions (the browser deletes the files first, see
--      below)
--   4. session lock: all sessions and refresh tokens go with the account
-- Files must already be removed through the Storage API (Supabase blocks
-- deleting file bytes from SQL); this refuses to finish while any remain.
-- Reusable test accounts: message saved, application reset, never banned.
-- Returns {"reusable": bool}
-- ---------------------------------------------------------------------
drop function if exists public.submit_exit_message(text);

create or replace function public.submit_exit_message(p_message text)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_profile from public.profiles
   where id = v_uid and status = 'rejected'
   for update;
  if not found then
    raise exception 'not_allowed';
  end if;

  if exists (select 1 from storage.objects
             where bucket_id in ('applicant-photos', 'applicant-voice', 'applicant-ids')
               and name like v_uid::text || '/%') then
    raise exception 'files_remaining';
  end if;

  insert into public.failed_applicants_messages (full_name, age, message)
  values (v_profile.full_name, v_profile.age, left(coalesce(trim(p_message), ''), 300));

  if v_profile.reusable then
    perform public.reset_application(v_uid);
    return jsonb_build_object('reusable', true);
  end if;

  insert into public.banned_applicants (email_hash, ip_address)
  values (md5(lower(trim(v_profile.email))), public.request_ip());

  delete from auth.sessions where user_id = v_uid;
  delete from auth.users where id = v_uid;  -- cascades to every applicant table

  return jsonb_build_object('reusable', false);
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: reusable test accounts only. Start a new application from scratch.
-- ---------------------------------------------------------------------
create or replace function public.restart_application()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and reusable) then
    raise exception 'not_allowed';
  end if;
  perform public.reset_application(v_uid);
end;
$$;

-- ---------------------------------------------------------------------
-- DATA RETENTION (keep in sync with src/config/privacy.js)
--   ID document ............ rejected: immediately · match: 30 days after the match
--   Rejected application ... immediately when the "not a match" popup is closed · never closed: 7 days
--   Unfinished application . 90 days after last activity
--   Match .................. 12 months after the match
--   Trash Can (name, age) .. 12 months   (automatic, pg_cron)
--   Ban list ............... 12 months   (automatic, pg_cron)
-- Anything with files is listed by retention_due() and deleted from the
-- dashboard, because file bytes can only be removed through the Storage API.
-- Reusable test accounts and admins are never included.
-- ---------------------------------------------------------------------
create or replace function public.retention_due()
returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;

  return jsonb_build_object(
    'ids', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'path', p.id_document_path, 'since', c.created_at) order by c.created_at)
        from public.profiles p join public.applicant_contacts c on c.user_id = p.id
       where p.id_document_path is not null and not p.reusable
         and c.created_at < now() - interval '30 days'), '[]'::jsonb),
    'applications', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'full_name', x.full_name, 'email', x.email, 'reason', x.reason, 'since', x.since) order by x.since)
        from (
          select p.id, p.full_name, p.email, 'Ended, but the "not a match" popup was never closed' as reason, p.updated_at as since
            from public.profiles p
           where p.status = 'rejected' and p.updated_at < now() - interval '7 days'
          union all
          select p.id, p.full_name, p.email, 'Unfinished for 90 days', p.updated_at
            from public.profiles p
           where p.status in ('onboarding', 'payment', 'screening', 'contact') and p.updated_at < now() - interval '90 days'
          union all
          select p.id, p.full_name, p.email, 'Match older than 12 months', c.created_at
            from public.profiles p join public.applicant_contacts c on c.user_id = p.id
           where p.status = 'completed' and c.created_at < now() - interval '12 months'
        ) x
        join public.profiles p2 on p2.id = x.id
       where not p2.reusable
         and not exists (select 1 from public.admins a where a.user_id = x.id)), '[]'::jsonb)
  );
end;
$$;

-- After the dashboard has deleted the ID file.
create or replace function public.admin_forget_id(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  if exists (select 1 from storage.objects
             where bucket_id = 'applicant-ids' and name like p_user_id::text || '/%') then
    raise exception 'files_remaining';
  end if;
  update public.profiles set id_document_path = null, updated_at = now() where id = p_user_id;
end;
$$;

-- After the dashboard has deleted all of the applicant's files.
create or replace function public.admin_delete_application(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  select * into v_profile from public.profiles where id = p_user_id;
  if not found or v_profile.reusable or exists (select 1 from public.admins where user_id = p_user_id) then
    raise exception 'not_allowed';
  end if;
  if exists (select 1 from storage.objects
             where bucket_id in ('applicant-photos', 'applicant-voice', 'applicant-ids')
               and name like p_user_id::text || '/%') then
    raise exception 'files_remaining';
  end if;
  -- A disqualified applicant who left without a final message is still blocked.
  if v_profile.status = 'rejected' then
    insert into public.banned_applicants (email_hash) values (md5(lower(trim(v_profile.email))));
  end if;
  delete from auth.sessions where user_id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

-- Records without files: removed automatically every night.
create or replace function public.retention_cleanup_records()
returns void
language sql
security definer set search_path = ''
as $$
  delete from public.failed_applicants_messages where created_at < now() - interval '12 months';
  delete from public.banned_applicants where banned_at < now() - interval '12 months';
$$;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'retention-cleanup';
  perform cron.schedule('retention-cleanup', '17 3 * * *', 'select public.retention_cleanup_records()');
exception when others then
  raise notice 'pg_cron not available (%); run select public.retention_cleanup_records() manually', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------
revoke all on function public.handle_new_user()       from public, anon, authenticated;
revoke all on function public.block_banned_signups()  from public, anon, authenticated;
revoke all on function public.complete_profile(text, date, text, text, text, text[], text[], text, text[], text, text, text, text, numeric, text, text, text, text, text) from public, anon;
revoke all on function public.submit_answer(text, jsonb)    from public, anon;
revoke all on function public.check_selection(text, jsonb)  from public, anon;
revoke all on function public.submit_contact(text)          from public, anon;
revoke all on function public.submit_exit_message(text)     from public, anon;
revoke all on function public.reset_application(uuid)       from public, anon, authenticated;
revoke all on function public.restart_application()         from public, anon;
revoke all on function public.is_admin()                    from public, anon;
revoke all on function public.is_banned(text, inet)         from public, anon, authenticated;
revoke all on function public.request_ip()                  from public;
revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
revoke all on function public.check_banned_applicants()     from public, anon, authenticated;
revoke all on function public.retention_cleanup_records()   from public, anon, authenticated;
revoke all on function public.stripe_request(text, text, text) from public, anon, authenticated;
revoke all on function public.start_checkout(text, text)    from public, anon;
revoke all on function public.confirm_payment()             from public, anon;
revoke all on function public.admin_payment_settings()      from public, anon;
revoke all on function public.admin_set_payments_enabled(boolean) from public, anon;
revoke all on function public.retention_due()               from public, anon;
revoke all on function public.admin_forget_id(uuid)         from public, anon;
revoke all on function public.admin_delete_application(uuid) from public, anon;

grant execute on function public.complete_profile(text, date, text, text, text, text[], text[], text, text[], text, text, text, text, numeric, text, text, text, text, text) to authenticated;
grant execute on function public.submit_answer(text, jsonb) to authenticated;
grant execute on function public.check_selection(text, jsonb) to authenticated;
grant execute on function public.retention_due()            to authenticated;
grant execute on function public.start_checkout(text, text) to authenticated;
grant execute on function public.confirm_payment()          to authenticated;
grant execute on function public.admin_payment_settings()   to authenticated;
grant execute on function public.admin_set_payments_enabled(boolean) to authenticated;
grant execute on function public.admin_forget_id(uuid)      to authenticated;
grant execute on function public.admin_delete_application(uuid) to authenticated;
grant execute on function public.submit_contact(text)       to authenticated;
grant execute on function public.submit_exit_message(text)  to authenticated;
grant execute on function public.restart_application()      to authenticated;
grant execute on function public.is_admin()                 to authenticated;
grant execute on function public.signup_allowed()           to anon, authenticated;
grant execute on function public.request_ip()               to anon, authenticated;
-- Supabase Auth runs hooks as supabase_auth_admin.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema public to supabase_auth_admin;
    grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
  end if;
end $$;
