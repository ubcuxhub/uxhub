-- UX Hub database: proposed schema (public), drafted 2026-10-03.
-- Driven by the 2026-27 epics: Applications & registration, Event tickets,
-- Platform (audit log), Admin (dashboard, history, CSV export), and Student
-- experience (newsletter moves to Mailchimp).
-- RLS is enabled on every table; policies are omitted here.
--
-- Assumptions still open:
--   1. An accepted offer holds a seat until it is paid for or expires.
--   2. Memberships move to their own table now rather than later.
--   3. Free events issue tickets too, so every attendee has a QR code.

CREATE TYPE role_access_enum   AS ENUM ('basic', 'admin', 'manager');
CREATE TYPE user_type          AS ENUM ('ubcStudent', 'faculty', 'nonUbc');
CREATE TYPE student_status     AS ENUM ('undergraduate', 'graduate', 'other');
CREATE TYPE uni_year           AS ENUM ('1', '2', '3', '4', '5+');
CREATE TYPE event_status       AS ENUM ('draft', 'active');
CREATE TYPE event_type         AS ENUM ('regular', 'flagship');
CREATE TYPE response_type      AS ENUM ('short_text', 'long_text', 'checkbox',
                                        'multiple_choice', 'dropdown', 'file_upload');
CREATE TYPE application_status AS ENUM ('submitted', 'accepted', 'rejected',
                                        'waitlisted', 'withdrawn');
CREATE TYPE check_in_method    AS ENUM ('scan', 'manual');
CREATE TYPE audit_source       AS ENUM ('trigger', 'app');


-- Users and memberships

CREATE TABLE membership_types (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL,
  name                text NOT NULL UNIQUE,
  description         text NOT NULL,
  price               numeric(10,2) NOT NULL CHECK (price >= 0),
  eligible_user_types user_type[] NOT NULL DEFAULT '{}',
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Membership columns, newsletter and order_date_deprecated are gone.
CREATE TABLE user_info (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id         uuid UNIQUE REFERENCES auth.users (id) ON UPDATE CASCADE,
  email                text NOT NULL UNIQUE,
  first_name           text NOT NULL CHECK (first_name = btrim(first_name) AND first_name <> ''),
  last_name            text NOT NULL CHECK (last_name = btrim(last_name) AND last_name <> ''),
  role_access          role_access_enum NOT NULL,
  user_type            user_type NOT NULL DEFAULT 'ubcStudent',
  student_number       bigint,
  student_status       student_status,
  year                 uni_year,
  faculty              text,
  major                text,
  faculty_email        text,
  school_institution   text,
  phone                text,
  preferred_pronouns   text,
  dietary_restrictions text,
  square_customer_id   text,
  deleted_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_settings (
  id                      boolean PRIMARY KEY DEFAULT true CHECK (id),
  membership_term_ends_at timestamptz,
  updated_by              uuid REFERENCES user_info (id),
  updated_at              timestamptz NOT NULL DEFAULT now()
);


-- Events

-- draft is hidden from students, active is visible. Past vs upcoming comes
-- from ends_at, not from status.
CREATE TABLE events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    text NOT NULL UNIQUE,
  name                    text NOT NULL,
  short_description       text,
  description             text NOT NULL,
  description_images      text[],
  image_url               text,
  agenda                  jsonb,
  event_type              event_type NOT NULL DEFAULT 'regular',
  status                  event_status NOT NULL DEFAULT 'draft',
  starts_at               timestamptz,
  ends_at                 timestamptz,
  registration_start_time timestamptz,
  registration_end_time   timestamptz,
  location_building       text,
  location_room           text,
  location_address_url    text,
  max_capacity            integer NOT NULL CHECK (max_capacity > 0),
  regular_price           numeric(10,2) NOT NULL CHECK (regular_price >= 0),
  member_price            numeric(10,2) NOT NULL DEFAULT 0 CHECK (member_price >= 0),
  requires_application    boolean NOT NULL DEFAULT false,
  mentors_enabled         boolean NOT NULL DEFAULT false,
  sponsors_enabled        boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at),
  CHECK (registration_end_time >= registration_start_time)
);

CREATE TABLE mentors (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name          text NOT NULL,
  position           text,
  description        text,
  linkedin_url       text,
  profile_image_path text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sponsors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  brand_logo_path text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE event_mentors (
  event_id   uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  mentor_id  uuid NOT NULL REFERENCES mentors (id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  PRIMARY KEY (event_id, mentor_id)
);

CREATE TABLE event_sponsors (
  event_id   uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES sponsors (id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  PRIMARY KEY (event_id, sponsor_id)
);

CREATE TABLE event_application_questions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  question            text NOT NULL,
  description         text,
  response_type       response_type NOT NULL,
  response_options    text[],
  is_required         boolean NOT NULL DEFAULT false,
  max_char_limit      integer CHECK (max_char_limit > 0),
  restrict_file_types boolean NOT NULL DEFAULT false,
  allowed_file_types  text[],
  max_file_size_bytes bigint CHECK (max_file_size_bytes > 0),
  sort_order          integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);


-- Payments (Square)

CREATE TABLE purchases (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         uuid NOT NULL REFERENCES user_info (id) ON DELETE CASCADE,
  kind                            text NOT NULL CHECK (kind IN ('event_ticket', 'membership')),
  status                          text NOT NULL CHECK (status IN ('pending', 'authorized', 'completed', 'canceled', 'failed')),
  amount_cents                    bigint NOT NULL CHECK (amount_cents >= 0),
  currency                        text NOT NULL CHECK (char_length(currency) = 3),
  event_id                        uuid REFERENCES events (id) ON DELETE RESTRICT,
  membership_type_id              uuid REFERENCES membership_types (id) ON DELETE RESTRICT,
  square_payment_id               text UNIQUE,
  square_customer_id              text,
  idempotency_key                 text NOT NULL UNIQUE,
  failure_reason                  text,
  fulfilled_at                    timestamptz,
  confirmation_email_attempted_at timestamptz,
  confirmation_email_sent_at      timestamptz,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind = 'event_ticket' AND event_id IS NOT NULL AND membership_type_id IS NULL) OR
    (kind = 'membership' AND membership_type_id IS NOT NULL AND event_id IS NULL)
  )
);

CREATE TABLE square_webhook_events (
  event_id     text PRIMARY KEY,
  event_type   text NOT NULL,
  payload      jsonb NOT NULL,
  processed_at timestamptz DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- One row per membership term. A null purchase_id means an admin granted it.
-- A pending membership purchase replaces membership_pre_ordered_type_id.
CREATE TABLE memberships (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES user_info (id) ON DELETE CASCADE,
  membership_type_id uuid NOT NULL REFERENCES membership_types (id) ON DELETE RESTRICT,
  purchase_id        uuid UNIQUE REFERENCES purchases (id) ON DELETE SET NULL,
  starts_at          timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > starts_at)
);

CREATE INDEX memberships_user_id_expires_at_idx ON memberships (user_id, expires_at DESC);


-- Applications

-- An offer has expired when it is accepted, past offer_expires_at, and has no
-- ticket. Waitlisted applicants are moved to accepted by an admin.
CREATE TABLE event_applications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES user_info (id),
  status           application_status NOT NULL DEFAULT 'submitted',
  offer_expires_at timestamptz,
  decided_by       uuid REFERENCES user_info (id),
  decided_at       timestamptz,
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE event_application_responses (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_application_question_id uuid NOT NULL REFERENCES event_application_questions (id) ON DELETE CASCADE,
  application_id                uuid NOT NULL REFERENCES event_applications (id) ON DELETE CASCADE,
  response                      text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_application_question_id, application_id)
);

-- Reviewer comment thread. Admins read and create; only the author edits or deletes.
CREATE TABLE application_notes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES event_applications (id) ON DELETE CASCADE,
  author_id      uuid NOT NULL REFERENCES user_info (id),
  body           text NOT NULL CHECK (btrim(body) <> ''),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX application_notes_application_id_idx ON application_notes (application_id, created_at);


-- Tickets and check-in

-- Replaces event_registrations. A ticket is active while released_at is null.
-- Releasing sets released_at and keeps the row and its purchase_id, so
-- re-registering clears it again without a new charge.
-- Seats taken = active tickets + accepted, unexpired applications without a ticket.
CREATE TABLE event_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES user_info (id),
  purchase_id uuid UNIQUE REFERENCES purchases (id) ON DELETE SET NULL,
  qr_token    text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  released_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE check_in_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  name       text NOT NULL,
  start_time timestamptz,
  end_time   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time IS NULL OR start_time IS NULL OR end_time >= start_time)
);

CREATE TABLE check_ins (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_session_id uuid NOT NULL REFERENCES check_in_sessions (id) ON DELETE CASCADE,
  ticket_id           uuid NOT NULL REFERENCES event_tickets (id) ON DELETE CASCADE,
  checked_in_at       timestamptz NOT NULL DEFAULT now(),
  checked_in_by       uuid REFERENCES user_info (id),
  method              check_in_method NOT NULL DEFAULT 'scan',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, check_in_session_id)
);


-- Audit log

-- Insert-only. source = 'trigger' is the admin change log, 'app' the user
-- activity feed. delete_account must scrub `changes` on rows about that user.
CREATE TABLE audit_events (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  source          audit_source NOT NULL,
  action          text NOT NULL,
  actor_id        uuid REFERENCES user_info (id),
  subject_user_id uuid REFERENCES user_info (id),
  entity_type     text NOT NULL,
  entity_id       uuid,
  changes         jsonb,
  metadata        jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX audit_events_entity_idx ON audit_events (entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_events_source_idx ON audit_events (source, occurred_at DESC);


-- Functions (bodies omitted)
--
-- is_admin() RETURNS boolean
-- is_manager() RETURNS boolean
-- is_authenticated() RETURNS boolean
-- current_user_info_id() RETURNS uuid
-- get_user_info_id() RETURNS uuid
-- set_user_role(p_target_user_id uuid, p_role role_access_enum) RETURNS role_access_enum
-- delete_account(p_auth_user_id uuid) RETURNS void
-- save_admin_event_atomically(p_event_id uuid, p_slug text, p_event jsonb,
--   p_application_questions jsonb, p_check_in_sessions jsonb, p_mentors jsonb,
--   p_sponsors jsonb, p_expected_image_url text) RETURNS jsonb
-- delete_event_atomically(target_event_id uuid) RETURNS void
-- event_seat_counts(p_event_ids uuid[])
--   RETURNS TABLE (event_id uuid, tickets integer, held_offers integer, seats_left integer)
-- reserve_event_ticket(p_event_id uuid, p_user_id uuid, p_purchase_id uuid DEFAULT NULL)
--   RETURNS TABLE (ticket_id uuid, failure_reason text)
-- release_event_ticket(p_ticket_id uuid) RETURNS void
-- check_in_by_token(p_qr_token text, p_session_id uuid, p_method check_in_method)
--   RETURNS TABLE (ticket_id uuid, attendee_name text, already_checked_in_at timestamptz)
-- audit_row_change() RETURNS trigger


-- Storage

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('event-images', 'event-images', true, 4194304, ARRAY['image/jpeg', 'image/png']);
