


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."application_status" AS ENUM (
    'pending',
    'declined',
    'accepted'
);


ALTER TYPE "public"."application_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."application_status" IS 'status for the registration';



CREATE TYPE "public"."event_status" AS ENUM (
    'draft',
    'active',
    'archived'
);


ALTER TYPE "public"."event_status" OWNER TO "postgres";


CREATE TYPE "public"."response_type" AS ENUM (
    'text',
    'single_select',
    'multi_select'
);


ALTER TYPE "public"."response_type" OWNER TO "postgres";


CREATE TYPE "public"."role_access_enum" AS ENUM (
    'basic',
    'admin'
);


ALTER TYPE "public"."role_access_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."role_access_enum" IS 'role of user';



CREATE TYPE "public"."student_status" AS ENUM (
    'undergraduate',
    'graduate',
    'other'
);


ALTER TYPE "public"."student_status" OWNER TO "postgres";


CREATE TYPE "public"."uni_year" AS ENUM (
    '1',
    '2',
    '3',
    '4',
    '5+'
);


ALTER TYPE "public"."uni_year" OWNER TO "postgres";


COMMENT ON TYPE "public"."uni_year" IS 'university year level';



CREATE TYPE "public"."user_type" AS ENUM (
    'ubcStudent',
    'faculty',
    'nonUbc'
);


ALTER TYPE "public"."user_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_event_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := lower(
      regexp_replace(
        regexp_replace(trim(new.name), '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
      )
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."generate_event_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_info_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    user_info_id uuid;
begin
    select id into user_info_id
    from user_info
    where auth_user_id = auth.uid();
    return user_info_id;
end;
$$;


ALTER FUNCTION "public"."get_user_info_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    user_role role_access_enum;
begin
    select role_access into user_role
    from user_info
    where auth_user_id = auth.uid();
    return user_role = 'admin';
end;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_authenticated"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
    return auth.uid() is not null;
end;
$$;


ALTER FUNCTION "public"."is_authenticated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_role_access_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    if old.role_access is distinct from new.role_access then
        if not is_admin() then
            raise exception 'Only admins can change role_access';
        end if;
    end if;
    return new;
end;
$$;


ALTER FUNCTION "public"."prevent_role_access_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."promote_from_waitlist"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  next_waitlist record;
begin
  if old.status = 'registered' and new.status = 'cancelled' then
    select * into next_waitlist
    from public.event_registrations
    where event_id = old.event_id
      and status = 'waitlisted'
    order by created_at asc
    limit 1;

    if found then
      update public.event_registrations
      set status = 'registered'
      where id = next_waitlist.id;
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."promote_from_waitlist"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_paid_event_ticket_reservation"("p_purchase_id" "uuid") RETURNS "void"
    LANGUAGE "sql"
    AS $$
    delete from public.event_registrations
    where purchase_id = p_purchase_id
      and status = 'pending'
      and coalesce(attending, false) = false;
$$;


ALTER FUNCTION "public"."release_paid_event_ticket_reservation"("p_purchase_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_paid_event_ticket"("p_event_id" "uuid", "p_user_id" "uuid", "p_purchase_id" "uuid") RETURNS TABLE("registration_id" "uuid", "failure_reason" "text")
    LANGUAGE "plpgsql"
    AS $$
declare
    v_event public.events%rowtype;
    v_existing_registration public.event_registrations%rowtype;
    v_registration_id uuid;
    v_occupied_count integer;
begin
    select *
    into v_event
    from public.events
    where id = p_event_id
    for update;

    if not found then
        return query select null::uuid, 'EVENT_NOT_FOUND'::text;
        return;
    end if;

    select *
    into v_existing_registration
    from public.event_registrations
    where purchase_id = p_purchase_id;

    if found then
        return query select v_existing_registration.id, null::text;
        return;
    end if;

    if exists (
        select 1
        from public.event_application_questions
        where event_id = p_event_id
    ) then
        return query select null::uuid, 'APPLICATION_REQUIRED'::text;
        return;
    end if;

    if v_event.registration_start_time is not null
        and now() < v_event.registration_start_time then
        return query select null::uuid, 'REGISTRATION_NOT_OPEN'::text;
        return;
    end if;

    if v_event.registration_end_time is not null
        and now() > v_event.registration_end_time then
        return query select null::uuid, 'REGISTRATION_CLOSED'::text;
        return;
    end if;

    select *
    into v_existing_registration
    from public.event_registrations
    where event_id = p_event_id
      and user_id = p_user_id;

    if found then
        return query select v_existing_registration.id, 'ALREADY_REGISTERED'::text;
        return;
    end if;

    select count(*)
    into v_occupied_count
    from public.event_registrations
    where event_id = p_event_id
      and (
          purchase_id is not null
          or status = 'accepted'
          or coalesce(attending, false) = true
      );

    if v_occupied_count >= v_event.max_capacity then
        return query select null::uuid, 'SOLD_OUT'::text;
        return;
    end if;

    insert into public.event_registrations (
        event_id,
        user_id,
        status,
        attending,
        purchase_id
    )
    values (
        p_event_id,
        p_user_id,
        'pending',
        false,
        p_purchase_id
    )
    returning id into v_registration_id;

    return query select v_registration_id, null::text;
end;
$$;


ALTER FUNCTION "public"."reserve_paid_event_ticket"("p_event_id" "uuid", "p_user_id" "uuid", "p_purchase_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    new.updated_at = now();
    return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."check_in_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_in_sessions_check" CHECK ((("end_time" IS NULL) OR ("start_time" IS NULL) OR ("end_time" >= "start_time")))
);


ALTER TABLE "public"."check_in_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."check_ins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_registration_id" "uuid" NOT NULL,
    "check_in_session_id" "uuid" NOT NULL,
    "checked_in_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."check_ins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_application_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "question" "text" NOT NULL,
    "response_type" "public"."response_type" NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "max_char_limit" integer,
    "response_options" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_application_questions_max_char_limit_check" CHECK ((("max_char_limit" IS NULL) OR ("max_char_limit" > 0)))
);


ALTER TABLE "public"."event_application_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_application_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_application_question_id" "uuid" NOT NULL,
    "event_registration_id" "uuid" NOT NULL,
    "response" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_application_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reviewer_id" "uuid",
    "attending" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" "public"."application_status" DEFAULT 'pending'::"public"."application_status",
    "purchase_id" "uuid"
);


ALTER TABLE "public"."event_registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "regular_price" numeric(10,2) NOT NULL,
    "member_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "location_building" "text",
    "location_room" "text",
    "location_address_url" "text",
    "start_date" "date",
    "start_time" time without time zone,
    "end_date" "date",
    "end_time" time without time zone,
    "max_capacity" integer NOT NULL,
    "image_url" "text",
    "registration_start_time" timestamp with time zone DEFAULT "now"(),
    "registration_end_time" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "slug" "text" NOT NULL,
    "description_images" "text"[],
    "mentors" "jsonb",
    "agenda" "jsonb",
    "sponsor_logos" "text"[],
    "status" "public"."event_status" DEFAULT 'draft'::"public"."event_status" NOT NULL,
    CONSTRAINT "events_check" CHECK ((("end_date" IS NULL) OR ("start_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "events_check1" CHECK (("registration_end_time" >= "registration_start_time")),
    CONSTRAINT "events_max_capacity_check" CHECK (("max_capacity" > 0)),
    CONSTRAINT "events_member_price_check" CHECK (("member_price" >= (0)::numeric)),
    CONSTRAINT "events_regular_price_check" CHECK (("regular_price" >= (0)::numeric))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."membership_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "features" "text"[],
    "price" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "slug" "text" NOT NULL,
    CONSTRAINT "membership_types_price_check" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."membership_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "status" "text" NOT NULL,
    "amount_cents" bigint NOT NULL,
    "currency" "text" NOT NULL,
    "event_id" "uuid",
    "membership_type_id" "uuid",
    "square_payment_id" "text",
    "square_customer_id" "text",
    "idempotency_key" "text" NOT NULL,
    "failure_reason" "text",
    "fulfilled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "purchases_amount_cents_check" CHECK (("amount_cents" >= 0)),
    CONSTRAINT "purchases_check" CHECK (((("kind" = 'event_ticket'::"text") AND ("event_id" IS NOT NULL) AND ("membership_type_id" IS NULL)) OR (("kind" = 'membership'::"text") AND ("membership_type_id" IS NOT NULL) AND ("event_id" IS NULL)))),
    CONSTRAINT "purchases_currency_check" CHECK (("char_length"("currency") = 3)),
    CONSTRAINT "purchases_kind_check" CHECK (("kind" = ANY (ARRAY['event_ticket'::"text", 'membership'::"text"]))),
    CONSTRAINT "purchases_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'authorized'::"text", 'completed'::"text", 'canceled'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."square_webhook_events" (
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."square_webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_info" (
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "order_date_deprecated" "date",
    "student_number" bigint,
    "auth_user_id" "uuid",
    "faculty" "text",
    "major" "text",
    "year" "public"."uni_year",
    "role_access" "public"."role_access_enum" NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_type" "public"."user_type" DEFAULT 'ubcStudent'::"public"."user_type" NOT NULL,
    "dietary_restrictions" "text",
    "newsletter" boolean DEFAULT false NOT NULL,
    "preferred_pronouns" "text",
    "membership_type_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "membership_expires_at" timestamp with time zone,
    "membership_pre_ordered_type_id" "uuid",
    "square_customer_id" "text",
    "faculty_email" "text",
    "school_institution" "text",
    "student_status" "public"."student_status"
);


ALTER TABLE "public"."user_info" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_info" IS 'All the current members of uxhub';



COMMENT ON COLUMN "public"."user_info"."auth_user_id" IS 'foreign key to supabase auth';



COMMENT ON COLUMN "public"."user_info"."year" IS 'university year';



COMMENT ON COLUMN "public"."user_info"."role_access" IS 'basic or admin role access';



COMMENT ON COLUMN "public"."user_info"."faculty_email" IS 'UBC faculty email supplied for faculty membership eligibility';



COMMENT ON COLUMN "public"."user_info"."school_institution" IS 'School or institution supplied by Non-UBC users';



COMMENT ON COLUMN "public"."user_info"."student_status" IS 'Study level supplied by Non-UBC users';



ALTER TABLE ONLY "public"."check_in_sessions"
    ADD CONSTRAINT "check_in_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."check_ins"
    ADD CONSTRAINT "check_ins_event_registration_id_check_in_session_id_key" UNIQUE ("event_registration_id", "check_in_session_id");



ALTER TABLE ONLY "public"."check_ins"
    ADD CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_application_questions"
    ADD CONSTRAINT "event_application_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_application_responses"
    ADD CONSTRAINT "event_application_responses_event_application_question_id_e_key" UNIQUE ("event_application_question_id", "event_registration_id");



ALTER TABLE ONLY "public"."event_application_responses"
    ADD CONSTRAINT "event_application_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."user_info"
    ADD CONSTRAINT "members_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."membership_types"
    ADD CONSTRAINT "membership_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."membership_types"
    ADD CONSTRAINT "membership_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."membership_types"
    ADD CONSTRAINT "membership_types_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_square_payment_id_key" UNIQUE ("square_payment_id");



ALTER TABLE ONLY "public"."square_webhook_events"
    ADD CONSTRAINT "square_webhook_events_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."user_info"
    ADD CONSTRAINT "user_info_old_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_info"
    ADD CONSTRAINT "user_info_old_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_check_in_sessions_event_id" ON "public"."check_in_sessions" USING "btree" ("event_id");



CREATE INDEX "idx_check_ins_check_in_session_id" ON "public"."check_ins" USING "btree" ("check_in_session_id");



CREATE INDEX "idx_check_ins_event_registration_id" ON "public"."check_ins" USING "btree" ("event_registration_id");



CREATE INDEX "idx_event_application_questions_event_id" ON "public"."event_application_questions" USING "btree" ("event_id");



CREATE INDEX "idx_event_application_responses_question_id" ON "public"."event_application_responses" USING "btree" ("event_application_question_id");



CREATE INDEX "idx_event_application_responses_registration_id" ON "public"."event_application_responses" USING "btree" ("event_registration_id");



CREATE INDEX "idx_event_registrations_event_id" ON "public"."event_registrations" USING "btree" ("event_id");



CREATE UNIQUE INDEX "idx_event_registrations_purchase_id" ON "public"."event_registrations" USING "btree" ("purchase_id") WHERE ("purchase_id" IS NOT NULL);



CREATE INDEX "idx_event_registrations_reviewer_id" ON "public"."event_registrations" USING "btree" ("reviewer_id");



CREATE INDEX "idx_event_registrations_user_id" ON "public"."event_registrations" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_events_slug" ON "public"."events" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_purchases_event_id" ON "public"."purchases" USING "btree" ("event_id");



CREATE INDEX "idx_purchases_membership_type_id" ON "public"."purchases" USING "btree" ("membership_type_id");



CREATE INDEX "idx_purchases_status" ON "public"."purchases" USING "btree" ("status");



CREATE INDEX "idx_purchases_user_id" ON "public"."purchases" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "prevent_role_access_change_trigger" BEFORE UPDATE ON "public"."user_info" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_role_access_change"();



CREATE OR REPLACE TRIGGER "set_event_slug" BEFORE INSERT ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."generate_event_slug"();



CREATE OR REPLACE TRIGGER "update_check_in_sessions_updated_at" BEFORE UPDATE ON "public"."check_in_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_check_ins_updated_at" BEFORE UPDATE ON "public"."check_ins" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_event_application_questions_updated_at" BEFORE UPDATE ON "public"."event_application_questions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_event_application_responses_updated_at" BEFORE UPDATE ON "public"."event_application_responses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_event_registrations_updated_at" BEFORE UPDATE ON "public"."event_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_events_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_membership_types_updated_at" BEFORE UPDATE ON "public"."membership_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_purchases_updated_at" BEFORE UPDATE ON "public"."purchases" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_info_updated_at" BEFORE UPDATE ON "public"."user_info" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."check_in_sessions"
    ADD CONSTRAINT "check_in_sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."check_ins"
    ADD CONSTRAINT "check_ins_check_in_session_id_fkey" FOREIGN KEY ("check_in_session_id") REFERENCES "public"."check_in_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."check_ins"
    ADD CONSTRAINT "check_ins_event_registration_id_fkey" FOREIGN KEY ("event_registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_application_questions"
    ADD CONSTRAINT "event_application_questions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_application_responses"
    ADD CONSTRAINT "event_application_responses_event_application_question_id_fkey" FOREIGN KEY ("event_application_question_id") REFERENCES "public"."event_application_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_application_responses"
    ADD CONSTRAINT "event_application_responses_event_registration_id_fkey" FOREIGN KEY ("event_registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user_info"("id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_info"("id");



ALTER TABLE ONLY "public"."user_info"
    ADD CONSTRAINT "members_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_membership_type_id_fkey" FOREIGN KEY ("membership_type_id") REFERENCES "public"."membership_types"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_info"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_info"
    ADD CONSTRAINT "user_info_membership_pre_ordered_type_id_fkey" FOREIGN KEY ("membership_pre_ordered_type_id") REFERENCES "public"."membership_types"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_info"
    ADD CONSTRAINT "user_info_old_membership_type_id_fkey" FOREIGN KEY ("membership_type_id") REFERENCES "public"."membership_types"("id") ON DELETE RESTRICT;



CREATE POLICY "Admins can delete check-in sessions" ON "public"."check_in_sessions" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_info"
  WHERE (("user_info"."auth_user_id" = "auth"."uid"()) AND ("user_info"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "Admins can delete event_application_questions" ON "public"."event_application_questions" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_info"
  WHERE (("user_info"."auth_user_id" = "auth"."uid"()) AND ("user_info"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "Admins can insert check-in sessions" ON "public"."check_in_sessions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_info"
  WHERE (("user_info"."auth_user_id" = "auth"."uid"()) AND ("user_info"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "Admins can insert event_application_questions" ON "public"."event_application_questions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_info"
  WHERE (("user_info"."auth_user_id" = "auth"."uid"()) AND ("user_info"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "Admins can update check-in sessions" ON "public"."check_in_sessions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_info"
  WHERE (("user_info"."auth_user_id" = "auth"."uid"()) AND ("user_info"."role_access" = 'admin'::"public"."role_access_enum"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_info"
  WHERE (("user_info"."auth_user_id" = "auth"."uid"()) AND ("user_info"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "Admins can update event_application_questions" ON "public"."event_application_questions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_info"
  WHERE (("user_info"."auth_user_id" = "auth"."uid"()) AND ("user_info"."role_access" = 'admin'::"public"."role_access_enum"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_info"
  WHERE (("user_info"."auth_user_id" = "auth"."uid"()) AND ("user_info"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "Authenticated users can view check-in sessions" ON "public"."check_in_sessions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view event_application_questions" ON "public"."event_application_questions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."event_application_responses" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."event_application_responses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Membership types are viewable by everyone" ON "public"."membership_types" FOR SELECT USING (true);



CREATE POLICY "Users can delete their applications" ON "public"."event_application_responses" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Users can insert own user_info" ON "public"."user_info" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "auth_user_id"));



CREATE POLICY "Users can update their application" ON "public"."event_application_responses" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "admin can delete" ON "public"."check_ins" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_info" "u"
  WHERE (("u"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("u"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "admin can delete failed event purchases" ON "public"."purchases" FOR DELETE TO "authenticated" USING ((("kind" = 'event_ticket'::"text") AND ("status" = 'failed'::"text") AND ("event_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."user_info" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("u"."role_access" = 'admin'::"public"."role_access_enum"))))));



CREATE POLICY "admin can insert" ON "public"."check_ins" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_info" "u"
  WHERE (("u"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("u"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "admin can select purchases" ON "public"."purchases" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_info" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("u"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "admin can update" ON "public"."check_ins" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_info" "u"
  WHERE (("u"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("u"."role_access" = 'admin'::"public"."role_access_enum"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_info" "u"
  WHERE (("u"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("u"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "admin can view" ON "public"."check_ins" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_info" "u"
  WHERE (("u"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("u"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "admin_delete" ON "public"."user_info" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_info" "me"
  WHERE (("me"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("me"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "admin_delete_events" ON "public"."events" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_info" "u"
  WHERE (("u"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("u"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "admin_insert" ON "public"."user_info" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_info" "me"
  WHERE (("me"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("me"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "admin_insert_events" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_info" "u"
  WHERE (("u"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("u"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "admin_select_all" ON "public"."user_info" FOR SELECT TO "authenticated" USING (("role_access" = 'admin'::"public"."role_access_enum"));



CREATE POLICY "admin_select_all_events" ON "public"."events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_info" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("u"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "admin_update" ON "public"."user_info" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_info" "me"
  WHERE (("me"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("me"."role_access" = 'admin'::"public"."role_access_enum"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_info" "me"
  WHERE (("me"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("me"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "admin_update_events" ON "public"."events" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_info" "u"
  WHERE (("u"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("u"."role_access" = 'admin'::"public"."role_access_enum"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_info" "u"
  WHERE (("u"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("u"."role_access" = 'admin'::"public"."role_access_enum")))));



CREATE POLICY "allow current user to update its own row" ON "public"."user_info" FOR UPDATE TO "authenticated" USING (("email" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("email" = ( SELECT "auth"."email"() AS "email")));



ALTER TABLE "public"."check_in_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."check_ins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_application_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_application_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "everyone can view active events" ON "public"."events" FOR SELECT TO "authenticated", "anon" USING (("status" = 'active'::"public"."event_status"));



ALTER TABLE "public"."membership_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."square_webhook_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user can delete event registrations" ON "public"."event_registrations" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "user can insert event registrations" ON "public"."event_registrations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "user can select event registrations" ON "public"."event_registrations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user can select own purchases" ON "public"."purchases" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_info"
  WHERE (("user_info"."id" = "purchases"."user_id") AND ("user_info"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "user can update event registrations" ON "public"."event_registrations" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."user_info" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "visibility" ON "public"."user_info" FOR SELECT TO "authenticated", "anon" USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."check_ins";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."event_registrations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."events";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."generate_event_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_event_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_event_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_info_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_info_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_info_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_authenticated"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_authenticated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_authenticated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_role_access_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_role_access_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_role_access_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."promote_from_waitlist"() TO "anon";
GRANT ALL ON FUNCTION "public"."promote_from_waitlist"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."promote_from_waitlist"() TO "service_role";



GRANT ALL ON FUNCTION "public"."release_paid_event_ticket_reservation"("p_purchase_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."release_paid_event_ticket_reservation"("p_purchase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_paid_event_ticket_reservation"("p_purchase_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reserve_paid_event_ticket"("p_event_id" "uuid", "p_user_id" "uuid", "p_purchase_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_paid_event_ticket"("p_event_id" "uuid", "p_user_id" "uuid", "p_purchase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_paid_event_ticket"("p_event_id" "uuid", "p_user_id" "uuid", "p_purchase_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."check_in_sessions" TO "anon";
GRANT ALL ON TABLE "public"."check_in_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."check_in_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."check_ins" TO "anon";
GRANT ALL ON TABLE "public"."check_ins" TO "authenticated";
GRANT ALL ON TABLE "public"."check_ins" TO "service_role";



GRANT ALL ON TABLE "public"."event_application_questions" TO "anon";
GRANT ALL ON TABLE "public"."event_application_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."event_application_questions" TO "service_role";



GRANT ALL ON TABLE "public"."event_application_responses" TO "anon";
GRANT ALL ON TABLE "public"."event_application_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."event_application_responses" TO "service_role";



GRANT ALL ON TABLE "public"."event_registrations" TO "anon";
GRANT ALL ON TABLE "public"."event_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."event_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."membership_types" TO "anon";
GRANT ALL ON TABLE "public"."membership_types" TO "authenticated";
GRANT ALL ON TABLE "public"."membership_types" TO "service_role";



GRANT ALL ON TABLE "public"."purchases" TO "anon";
GRANT ALL ON TABLE "public"."purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."purchases" TO "service_role";



GRANT ALL ON TABLE "public"."square_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."square_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."square_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."user_info" TO "anon";
GRANT ALL ON TABLE "public"."user_info" TO "authenticated";
GRANT ALL ON TABLE "public"."user_info" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































