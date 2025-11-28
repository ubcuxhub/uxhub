-- Create ENUM types first
create type user_type_enum as enum ('ubcStudent', 'faculty', 'nonUbc');
create type role_access_enum as enum ('basic', 'admin');
create type response_type_enum as enum ('text', 'single_select', 'multi_select');

-- Create membership_types first since user_info references it
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
    auth_user_id uuid not null unique references auth.users(id) on delete cascade,
    email text not null unique,
    name text not null,
    phone text,
    student_number int check (student_number > 0),
    faculty text,
    major text,
    year text,
    user_type user_type_enum not null,
    dietary_restrictions text,
    preferred_pronouns text,
    newsletter boolean default false,
    membership_type_id uuid not null references membership_types(id) on delete restrict,
    role_access role_access_enum default 'basic',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table events (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text not null,
    regular_price decimal(10, 2) not null check (regular_price >= 0),
    member_price decimal(10, 2) default 0 not null check (member_price >= 0),
    location_building text,
    location_room text,
    location_address_url text,
    start_date date,
    start_time time,
    end_date date,
    end_time time,
    max_capacity int not null check (max_capacity > 0),
    image_url text,
    registration_start_time timestamp with time zone default now(),
    registration_end_time timestamp with time zone default now() + interval '1 week',

    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    check (end_date is null or start_date is null or end_date >= start_date),
    check (registration_end_time >= registration_start_time)
);

create table event_registrations (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references events(id) on delete cascade,
    user_id uuid not null references user_info(id) on delete cascade,
    reviewer_id uuid references user_info(id) on delete set null,
    accepted boolean default false,
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
    response_type response_type_enum not null,
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


-- Create indexes on foreign keys for better query performance
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

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Function to prevent non-admins from changing role_access
create or replace function prevent_role_access_change()
returns trigger as $$
begin
    -- If role_access is being changed and user is not admin, prevent it
    if old.role_access is distinct from new.role_access then
        if not is_admin() then
            raise exception 'Only admins can change role_access';
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

-- Triggers to automatically update updated_at
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

-- Enable Row Level Security on all tables
alter table membership_types enable row level security;
alter table user_info enable row level security;
alter table events enable row level security;
alter table event_registrations enable row level security;
alter table check_in_sessions enable row level security;
alter table check_ins enable row level security;
alter table event_application_questions enable row level security;
alter table event_application_responses enable row level security;



-- Helper function to get the current user's user_info id
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

-- Helper function to check if current user is admin
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

-- Helper function to check if user is authenticated
create or replace function is_authenticated()
returns boolean as $$
begin
    return auth.uid() is not null;
end;
$$ language plpgsql security definer;

-- RLS Policies for membership_types
-- Everyone can read membership types
create policy "Membership types are viewable by everyone"
    on membership_types for select
    using (true);

-- Only admins can insert/update/delete membership types
create policy "Only admins can insert membership types"
    on membership_types for insert
    with check (is_admin());

create policy "Only admins can update membership types"
    on membership_types for update
    using (is_admin());

create policy "Only admins can delete membership types"
    on membership_types for delete
    using (is_admin());

-- RLS Policies for user_info
-- Users can read their own record
create policy "Users can view their own profile"
    on user_info for select
    using (auth_user_id = auth.uid() or is_admin());

-- Users can insert their own record (during signup)
create policy "Users can insert their own profile"
    on user_info for insert
    with check (auth_user_id = auth.uid());

-- Users can update their own record (except role_access)
-- Note: Preventing role_access changes should be handled via trigger or application logic
create policy "Users can update their own profile"
    on user_info for update
    using (auth_user_id = auth.uid() or is_admin())
    with check (auth_user_id = auth.uid() or is_admin());

-- Only admins can delete user records
create policy "Only admins can delete user profiles"
    on user_info for delete
    using (is_admin());

-- RLS Policies for events
-- Everyone can read events
create policy "Events are viewable by everyone"
    on events for select
    using (true);

-- Only admins can insert/update/delete events
create policy "Only admins can insert events"
    on events for insert
    with check (is_admin());

create policy "Only admins can update events"
    on events for update
    using (is_admin());

create policy "Only admins can delete events"
    on events for delete
    using (is_admin());

-- RLS Policies for event_registrations
-- Users can read their own registrations
create policy "Users can view their own registrations"
    on event_registrations for select
    using (user_id = get_user_info_id() or is_admin());

-- Authenticated users can insert their own registrations
create policy "Authenticated users can register for events"
    on event_registrations for insert
    with check (
        is_authenticated() and
        user_id = get_user_info_id()
    );

-- Users can update their own registrations (for accepting offers)
-- Admins can update any registration
-- Note: Application logic should prevent users from changing reviewer_id, accepted, event_id, or user_id
create policy "Users can update their own registrations"
    on event_registrations for update
    using (user_id = get_user_info_id() or is_admin())
    with check (user_id = get_user_info_id() or is_admin());

-- Only admins can delete registrations
create policy "Only admins can delete registrations"
    on event_registrations for delete
    using (is_admin());

-- RLS Policies for check_in_sessions
-- Everyone can read check-in sessions
create policy "Check-in sessions are viewable by everyone"
    on check_in_sessions for select
    using (true);

-- Only admins can insert/update/delete check-in sessions
create policy "Only admins can insert check-in sessions"
    on check_in_sessions for insert
    with check (is_admin());

create policy "Only admins can update check-in sessions"
    on check_in_sessions for update
    using (is_admin());

create policy "Only admins can delete check-in sessions"
    on check_in_sessions for delete
    using (is_admin());

-- RLS Policies for check_ins
-- Users can read their own check-ins
create policy "Users can view their own check-ins"
    on check_ins for select
    using (
        exists (
            select 1 from event_registrations
            where event_registrations.id = check_ins.event_registration_id
            and event_registrations.user_id = get_user_info_id()
        ) or is_admin()
    );

-- Only admins can insert/update/delete check-ins
create policy "Only admins can insert check-ins"
    on check_ins for insert
    with check (is_admin());

create policy "Only admins can update check-ins"
    on check_ins for update
    using (is_admin());

create policy "Only admins can delete check-ins"
    on check_ins for delete
    using (is_admin());

-- RLS Policies for event_application_questions
-- Everyone can read application questions
create policy "Application questions are viewable by everyone"
    on event_application_questions for select
    using (true);

-- Only admins can insert/update/delete application questions
create policy "Only admins can insert application questions"
    on event_application_questions for insert
    with check (is_admin());

create policy "Only admins can update application questions"
    on event_application_questions for update
    using (is_admin());

create policy "Only admins can delete application questions"
    on event_application_questions for delete
    using (is_admin());

-- RLS Policies for event_application_responses
-- Users can read their own responses
create policy "Users can view their own application responses"
    on event_application_responses for select
    using (
        exists (
            select 1 from event_registrations
            where event_registrations.id = event_application_responses.event_registration_id
            and event_registrations.user_id = get_user_info_id()
        ) or is_admin()
    );

-- Users can insert/update their own responses
create policy "Users can insert their own application responses"
    on event_application_responses for insert
    with check (
        is_authenticated() and
        exists (
            select 1 from event_registrations
            where event_registrations.id = event_application_responses.event_registration_id
            and event_registrations.user_id = get_user_info_id()
        )
    );

create policy "Users can update their own application responses"
    on event_application_responses for update
    using (
        exists (
            select 1 from event_registrations
            where event_registrations.id = event_application_responses.event_registration_id
            and event_registrations.user_id = get_user_info_id()
        ) or is_admin()
    )
    with check (
        exists (
            select 1 from event_registrations
            where event_registrations.id = event_application_responses.event_registration_id
            and event_registrations.user_id = get_user_info_id()
        ) or is_admin()
    );

-- Only admins can delete responses
create policy "Only admins can delete application responses"
    on event_application_responses for delete
    using (is_admin());
