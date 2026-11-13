-- UX Hub database: proposed schema (public), drafted 2026-10-03, updated
-- 2026-11-05 with the event page: builder settings, people sections, teams,
-- links and online meeting details.
-- Driven by the 2026-27 epics: Applications & registration, Event tickets,
-- Platform (audit log), Admin (dashboard, history, CSV export), and Student
-- experience (newsletter moves to Mailchimp, the event page).
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
CREATE TYPE event_application_status AS ENUM ('submitted', 'accepted', 'rejected', 'waitlisted');
CREATE TYPE audit_source       AS ENUM ('trigger', 'app');
CREATE TYPE event_location_type   AS ENUM ('in_person', 'online', 'hybrid');
CREATE TYPE event_link_type       AS ENUM ('slack_workspace', 'participant_package',
                                           'event_recap', 'other');
CREATE TYPE event_link_visibility AS ENUM ('everyone', 'going', 'after_event');


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

-- draft is hidden from students. active is visible once publish_at is null or
-- has passed, so scheduling needs no job. Past vs upcoming comes from ends_at.
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
  publish_at              timestamptz,
  starts_at               timestamptz,
  ends_at                 timestamptz,
  registration_opens_at   timestamptz,
  registration_closes_at  timestamptz,
  location_type           event_location_type NOT NULL DEFAULT 'in_person',
  location_building       text,
  location_room           text,
  location_address        text,
  location_address_url    text,
  max_capacity            integer NOT NULL CHECK (max_capacity > 0),
  regular_price           numeric(10,2) NOT NULL CHECK (regular_price >= 0),
  member_price            numeric(10,2) NOT NULL DEFAULT 0 CHECK (member_price >= 0),
  requires_application    boolean NOT NULL DEFAULT false,
  mentors_enabled         boolean NOT NULL DEFAULT false,
  sponsors_enabled        boolean NOT NULL DEFAULT false,
  agenda_enabled          boolean NOT NULL DEFAULT true,
  -- Page header: an image or a colour (#RRGGBB), never both.
  header_image_url        text,
  header_colour           text CHECK (header_colour ~ '^#[0-9A-Fa-f]{6}$'),
  -- Ticket gradient and featured card.
  event_colour            text CHECK (event_colour ~ '^#[0-9A-Fa-f]{6}$'),
  is_featured             boolean NOT NULL DEFAULT false,
  -- External event website (e.g. Devpost); /events/[slug] when null.
  marketing_url           text,
  -- Teams: null sizes mean no limit, a null deadline means teams never lock.
  teams_enabled           boolean NOT NULL DEFAULT false,
  min_team_size           integer CHECK (min_team_size >= 1),
  max_team_size           integer CHECK (max_team_size >= 1),
  team_deadline           timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at),
  CHECK (registration_closes_at >= registration_opens_at),
  CHECK (num_nonnulls(header_image_url, header_colour) <= 1),
  CHECK (min_team_size <= max_team_size)
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
  description     text,
  website_url     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One card per section on the event page: Judges, Mentors, Speakers,
-- Panelists or a custom title. The builder offers the presets; the database
-- only knows titles.
CREATE TABLE event_people_sections (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  title      text NOT NULL CHECK (btrim(title) <> ''),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, id)
);

CREATE UNIQUE INDEX event_people_sections_event_title_key
  ON event_people_sections (event_id, lower(btrim(title)));

-- The people in each section are mentors rows, whatever the section is
-- called, so one person can sit in several sections of an event.
CREATE TABLE event_mentors (
  event_id   uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  section_id uuid NOT NULL,
  mentor_id  uuid NOT NULL REFERENCES mentors (id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  PRIMARY KEY (section_id, mentor_id),
  FOREIGN KEY (event_id, section_id)
    REFERENCES event_people_sections (event_id, id) ON DELETE CASCADE
);

CREATE INDEX event_mentors_event_id_idx ON event_mentors (event_id, sort_order);

CREATE TABLE event_sponsors (
  event_id   uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES sponsors (id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  PRIMARY KEY (event_id, sponsor_id)
);

-- One row per event per date, each holding timed items. Will replace
-- events.agenda once no code reads that column.
CREATE TABLE event_agenda_days (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  date     date NOT NULL,
  title    text,
  UNIQUE (event_id, date)
);

-- Building and room each fall back on their own: a null building means the
-- event's building, and a null room means the event's room.
CREATE TABLE event_agenda_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_agenda_day_id uuid NOT NULL REFERENCES event_agenda_days (id) ON DELETE CASCADE,
  title               text NOT NULL,
  start_time          time NOT NULL,
  end_time            time NOT NULL,
  building            text,
  room                text,
  CHECK (end_time > start_time)
);

CREATE INDEX event_agenda_items_event_agenda_day_id_start_time_idx ON event_agenda_items (event_agenda_day_id, start_time);

-- Header buttons (Slack, Other), the participant package and the recap. RLS
-- shows everyone links to anyone who can see the event, going links to ticket
-- holders, and after_event links once the event has ended.
CREATE TABLE event_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  type       event_link_type NOT NULL,
  label      text CHECK (label IS NULL OR btrim(label) <> ''),
  url        text NOT NULL CHECK (btrim(url) <> ''),
  visibility event_link_visibility NOT NULL DEFAULT 'everyone',
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (type <> 'other' OR label IS NOT NULL)
);

CREATE INDEX event_links_event_id_idx ON event_links (event_id, sort_order);

-- Online meeting details, off events (which anyone can read) so only ticket
-- holders and admins see where to join.
CREATE TABLE event_private_details (
  event_id         uuid PRIMARY KEY REFERENCES events (id) ON DELETE CASCADE,
  meeting_url      text NOT NULL CHECK (btrim(meeting_url) <> ''),
  meeting_id       text,
  meeting_passcode text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
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
-- ticket. Waitlisted applicants are moved to accepted by an admin. Who decided
-- and when lives in audit_events.
CREATE TABLE event_applications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES user_info (id),
  status           event_application_status NOT NULL DEFAULT 'submitted',
  offer_expires_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id),
  CHECK (status <> 'accepted' OR offer_expires_at IS NOT NULL)
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

-- Replaces event_registrations. Tickets are never released or cancelled.
-- Seats taken = active tickets + accepted, unexpired applications without a ticket.
CREATE TABLE event_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES user_info (id),
  purchase_id uuid UNIQUE REFERENCES purchases (id) ON DELETE SET NULL,
  qr_token    text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
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

-- Never edited. A mistaken check-in is deleted so the person can be scanned again.
CREATE TABLE check_ins (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_session_id uuid NOT NULL REFERENCES check_in_sessions (id) ON DELETE CASCADE,
  ticket_id           uuid NOT NULL REFERENCES event_tickets (id) ON DELETE CASCADE,
  checked_in_at       timestamptz NOT NULL DEFAULT now(),
  checked_in_by       uuid REFERENCES user_info (id),
  UNIQUE (ticket_id, check_in_session_id)
);


-- Teams

-- Ticket holders create a team (and its invite code) or join one by code, one
-- team per event, before the event's team deadline and within max_team_size.
-- The owner deletes the team; others leave. An admin-made team has no owner.
-- Students change teams only through the team functions below.
CREATE TABLE teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  name        text CHECK (name IS NULL OR btrim(name) <> ''),
  invite_code text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(5), 'hex'),
  owner_id    uuid REFERENCES user_info (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, event_id)
);

CREATE INDEX teams_event_id_idx ON teams (event_id);

CREATE TABLE team_members (
  event_id  uuid NOT NULL,
  team_id   uuid NOT NULL,
  user_id   uuid NOT NULL REFERENCES user_info (id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id),
  FOREIGN KEY (team_id, event_id) REFERENCES teams (id, event_id) ON DELETE CASCADE
);

CREATE INDEX team_members_team_id_idx ON team_members (team_id, joined_at);


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
--   (p_mentors fills the event's Mentors section and leaves other sections alone)
-- delete_event_atomically(target_event_id uuid) RETURNS void
-- event_seat_counts(p_event_ids uuid[])
--   RETURNS TABLE (event_id uuid, tickets integer, held_offers integer, seats_left integer)
-- reserve_event_ticket(p_event_id uuid, p_user_id uuid, p_purchase_id uuid DEFAULT NULL)
--   RETURNS TABLE (ticket_id uuid, failure_reason text)
-- check_in_by_token(p_qr_token text, p_session_id uuid)
--   RETURNS TABLE (ticket_id uuid, attendee_name text, already_checked_in_at timestamptz)
-- Team functions, service role only. Each returns a failure reason (NO_TICKET,
-- TEAMS_LOCKED, TEAM_FULL, ...) or null on success:
-- create_team(p_event_id uuid, p_user_id uuid, p_name text DEFAULT NULL)
--   RETURNS TABLE (team_id uuid, failure_reason text)
-- join_team(p_invite_code text, p_user_id uuid)
--   RETURNS TABLE (team_id uuid, failure_reason text)
-- leave_team(p_event_id uuid, p_user_id uuid) RETURNS text
-- delete_team(p_team_id uuid, p_user_id uuid) RETURNS text
-- team_change_blocked(p_event_id uuid, p_user_id uuid) RETURNS text
-- current_user_team_ids() RETURNS SETOF uuid   -- for the team RLS policies
--
-- Triggers:
-- event_mentors_default_section()   -- BEFORE INSERT on event_mentors: a row
--   without section_id goes in the event's Mentors section, so code written
--   before people sections (an older seed) still works
-- free_team_spots_of_deleted_user() -- AFTER UPDATE OF deleted_at on user_info:
--   a deleted account leaves its teams; an owned team passes to the teammate
--   who joined first, or is deleted if nobody else is on it
-- audit_row_change() RETURNS trigger


-- Storage

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('event-images', 'event-images', true, 4194304, ARRAY['image/jpeg', 'image/png']);
