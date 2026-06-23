-- ============================================================
-- ENUM TYPES
-- ============================================================

create type application_status as enum ('pending', 'declined', 'accepted');

create type response_type as enum ('text', 'single_select', 'multi_select');

create type role_access_enum as enum ('basic', 'admin');

create type uni_year as enum ('1', '2', '3', '4', '5+');

create type user_type as enum ('ubcStudent', 'faculty', 'nonUbc');


-- ============================================================
-- TABLES
-- ============================================================

-- membership_types is referenced by user_info, so create it first
create table membership_types (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    description text not null,
    features text[],
    price decimal(10, 2) not null check (price >= 0),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table user_info (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid unique references auth.users(id) on update cascade,
    email text not null unique,
    name text not null,
    phone text,
    student_number bigint,
    faculty text,
    major text,
    year uni_year,
    user_type user_type not null default 'ubcStudent',
    dietary_restrictions text,
    preferred_pronouns text,
    newsletter boolean not null default false,
    membership_type_id uuid references membership_types(id) on delete restrict,
    membership_expires_at timestamp with time zone,
    membership_pre_ordered_type_id uuid references membership_types(id) on delete restrict,
    role_access role_access_enum not null,
    order_date_deprecated date, -- legacy, no longer used
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table events (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text not null,
    regular_price decimal(10, 2) not null check (regular_price >= 0),
    member_price decimal(10, 2) not null default 0 check (member_price >= 0),
    location_building text,
    location_room text,
    location_address_url text,
    start_date date,
    start_time time,
    end_date date,
    end_time time,
    max_capacity int not null check (max_capacity > 0),
    slug text,
    image_url text,
    registration_start_time timestamp with time zone default now(),
    registration_end_time timestamp with time zone default now() + interval '7 days',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    check (end_date is null or start_date is null or end_date >= start_date),
    check (registration_end_time >= registration_start_time)
);

create table event_registrations (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references events(id) on delete cascade,
    user_id uuid not null references user_info(id),
    reviewer_id uuid references user_info(id),
    status application_status not null default 'pending',
    attending boolean default false,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique (event_id, user_id)
);

create table check_in_sessions (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references events(id) on delete cascade,
    name text not null,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    check (end_time is null or start_time is null or end_time >= start_time)
);

create table check_ins (
    id uuid primary key default gen_random_uuid(),
    event_registration_id uuid not null references event_registrations(id) on delete cascade,
    check_in_session_id uuid not null references check_in_sessions(id) on delete cascade,
    checked_in_at timestamp with time zone default now(),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique (event_registration_id, check_in_session_id)
);

create table event_application_questions (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references events(id) on delete cascade,
    question text not null,
    response_type response_type not null,
    is_required boolean not null default true,
    max_char_limit int check (max_char_limit is null or max_char_limit > 0),
    response_options text[],
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table event_application_responses (
    id uuid primary key default gen_random_uuid(),
    event_application_question_id uuid not null references event_application_questions(id) on delete cascade,
    event_registration_id uuid not null references event_registrations(id) on delete cascade,
    response text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique (event_application_question_id, event_registration_id)
);


-- ============================================================
-- INDEXES
-- ============================================================

create index idx_user_info_membership_type_id on user_info(membership_type_id);
create index idx_user_info_auth_user_id on user_info(auth_user_id);
create index idx_event_registrations_event_id on event_registrations(event_id);
create index idx_event_registrations_user_id on event_registrations(user_id);
create index idx_event_registrations_reviewer_id on event_registrations(reviewer_id);
create index idx_check_in_sessions_event_id on check_in_sessions(event_id);
create index idx_check_ins_event_registration_id on check_ins(event_registration_id);
create index idx_check_ins_check_in_session_id on check_ins(check_in_session_id);
create index idx_event_application_questions_event_id on event_application_questions(event_id);
create index idx_event_application_responses_question_id on event_application_responses(event_application_question_id);
create index idx_event_application_responses_registration_id on event_application_responses(event_registration_id);


-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at on every row update
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Prevent non-admins from elevating role_access
create or replace function prevent_role_access_change()
returns trigger as $$
begin
    if old.role_access is distinct from new.role_access then
        if not is_admin() then
            raise exception 'Only admins can change role_access';
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

-- When a registered spot is cancelled, promote the oldest waitlisted registration
create or replace function promote_from_waitlist()
returns trigger as $$
declare
    next_waitlist record;
begin
    if old.status = 'registered' and new.status = 'cancelled' then
        select * into next_waitlist
        from event_registrations
        where event_id = old.event_id
          and status = 'waitlisted'
        order by created_at asc
        limit 1;

        if found then
            update event_registrations
            set status = 'registered'
            where id = next_waitlist.id;
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

-- Get the user_info.id for the currently authenticated user
create or replace function get_user_info_id()
returns uuid as $$
declare
    user_info_id uuid;
begin
    select id into user_info_id
    from user_info
    where auth_user_id = auth.uid();
    return user_info_id;
end;
$$ language plpgsql security definer;

-- Returns true if the current user has admin role_access
create or replace function is_admin()
returns boolean as $$
declare
    user_role role_access_enum;
begin
    select role_access into user_role
    from user_info
    where auth_user_id = auth.uid();
    return user_role = 'admin';
end;
$$ language plpgsql security definer;

-- Returns true if there is an authenticated session
create or replace function is_authenticated()
returns boolean as $$
begin
    return auth.uid() is not null;
end;
$$ language plpgsql security definer;


-- ============================================================
-- TRIGGERS
-- ============================================================

create trigger update_membership_types_updated_at before update on membership_types
    for each row execute function update_updated_at_column();

create trigger update_user_info_updated_at before update on user_info
    for each row execute function update_updated_at_column();

create trigger prevent_role_access_change_trigger before update on user_info
    for each row execute function prevent_role_access_change();

create trigger update_events_updated_at before update on events
    for each row execute function update_updated_at_column();

create trigger update_event_registrations_updated_at before update on event_registrations
    for each row execute function update_updated_at_column();

create trigger update_check_in_sessions_updated_at before update on check_in_sessions
    for each row execute function update_updated_at_column();

create trigger update_check_ins_updated_at before update on check_ins
    for each row execute function update_updated_at_column();

create trigger update_event_application_questions_updated_at before update on event_application_questions
    for each row execute function update_updated_at_column();

create trigger update_event_application_responses_updated_at before update on event_application_responses
    for each row execute function update_updated_at_column();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table membership_types enable row level security;
alter table user_info enable row level security;
alter table events enable row level security;
alter table event_registrations enable row level security;
alter table check_in_sessions enable row level security;
alter table check_ins enable row level security;
alter table event_application_questions enable row level security;
alter table event_application_responses enable row level security;


-- membership_types
create policy "Membership types are viewable by everyone"
    on membership_types for select
    using (true);

-- No insert/update/delete policies defined — only service_role can mutate.


-- user_info
create policy "visibility"
    on user_info for select to anon, authenticated
    using (true);

create policy "Users can insert own user_info"
    on user_info for insert to authenticated
    with check (auth.uid() = auth_user_id);

create policy "allow current user to update its own row"
    on user_info for update to authenticated
    using (email = auth.email())
    with check (email = auth.email());

create policy "admin_select_all"
    on user_info for select to authenticated
    using (role_access = 'admin');

create policy "admin_insert"
    on user_info for insert to authenticated
    with check (exists (
        select 1 from user_info me
        where me.auth_user_id = auth.uid() and me.role_access = 'admin'
    ));

create policy "admin_update"
    on user_info for update to authenticated
    using (exists (
        select 1 from user_info me
        where me.auth_user_id = auth.uid() and me.role_access = 'admin'
    ));

create policy "admin_delete"
    on user_info for delete to authenticated
    using (exists (
        select 1 from user_info me
        where me.auth_user_id = auth.uid() and me.role_access = 'admin'
    ));


-- events
create policy "everyone can view events"
    on events for select to anon, authenticated
    using (true);

create policy "admin_insert_events"
    on events for insert to authenticated
    with check (exists (
        select 1 from user_info u
        where u.auth_user_id = auth.uid() and u.role_access = 'admin'
    ));

create policy "admin_update_events"
    on events for update to authenticated
    using (exists (
        select 1 from user_info u
        where u.auth_user_id = auth.uid() and u.role_access = 'admin'
    ));

create policy "admin_delete_events"
    on events for delete to authenticated
    using (exists (
        select 1 from user_info u
        where u.auth_user_id = auth.uid() and u.role_access = 'admin'
    ));


-- event_registrations (permissive — app logic enforces ownership)
create policy "user can select event registrations"
    on event_registrations for select to authenticated
    using (true);

create policy "user can insert event registrations"
    on event_registrations for insert to authenticated
    with check (true);

create policy "user can update event registrations"
    on event_registrations for update to authenticated
    using (true) with check (true);

create policy "user can delete event registrations"
    on event_registrations for delete to authenticated
    using (true);


-- check_in_sessions
create policy "Authenticated users can view check-in sessions"
    on check_in_sessions for select to authenticated
    using (true);

create policy "Admins can insert check-in sessions"
    on check_in_sessions for insert to authenticated
    with check (exists (
        select 1 from user_info
        where user_info.auth_user_id = auth.uid() and user_info.role_access = 'admin'
    ));

create policy "Admins can update check-in sessions"
    on check_in_sessions for update to authenticated
    using (exists (
        select 1 from user_info
        where user_info.auth_user_id = auth.uid() and user_info.role_access = 'admin'
    ));

create policy "Admins can delete check-in sessions"
    on check_in_sessions for delete to authenticated
    using (exists (
        select 1 from user_info
        where user_info.auth_user_id = auth.uid() and user_info.role_access = 'admin'
    ));


-- check_ins
create policy "admin can view"
    on check_ins for select
    using (exists (
        select 1 from user_info u
        where u.auth_user_id = auth.uid() and u.role_access = 'admin'
    ));

create policy "admin can insert"
    on check_ins for insert to authenticated
    with check (exists (
        select 1 from user_info u
        where u.auth_user_id = auth.uid() and u.role_access = 'admin'
    ));

create policy "admin can update"
    on check_ins for update
    using (exists (
        select 1 from user_info u
        where u.auth_user_id = auth.uid() and u.role_access = 'admin'
    ));

create policy "admin can delete"
    on check_ins for delete to authenticated
    using (exists (
        select 1 from user_info u
        where u.auth_user_id = auth.uid() and u.role_access = 'admin'
    ));


-- event_application_questions
create policy "Authenticated users can view event_application_questions"
    on event_application_questions for select to authenticated
    using (true);

create policy "Admins can insert event_application_questions"
    on event_application_questions for insert to authenticated
    with check (exists (
        select 1 from user_info
        where user_info.auth_user_id = auth.uid() and user_info.role_access = 'admin'
    ));

create policy "Admins can update event_application_questions"
    on event_application_questions for update to authenticated
    using (exists (
        select 1 from user_info
        where user_info.auth_user_id = auth.uid() and user_info.role_access = 'admin'
    ));

create policy "Admins can delete event_application_questions"
    on event_application_questions for delete to authenticated
    using (exists (
        select 1 from user_info
        where user_info.auth_user_id = auth.uid() and user_info.role_access = 'admin'
    ));


-- event_application_responses (permissive — app logic enforces ownership)
create policy "Enable read access for all users"
    on event_application_responses for select to authenticated
    using (true);

create policy "Enable insert for authenticated users only"
    on event_application_responses for insert to authenticated
    with check (true);

create policy "Users can update their application"
    on event_application_responses for update to authenticated
    using (true);

create policy "Users can delete their applications"
    on event_application_responses for delete to authenticated
    using (true);
