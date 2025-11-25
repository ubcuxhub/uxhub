create table user_info (
    id uuid primary key default gen_random_uuid(),

    email text not null,
    name text not null,
    phone text,
    student_number int,
    faculty text,
    major text,
    year text,
    dietary_restrictions text,  -- new
    preferred_pronouns text,  -- new
    newsletter boolean default false, -- changed from text to boolean

    -- membership_type_id uuid not null, -- change to reference to membership_types table, so that each type can have its own features, price, and description.
    -- foreign key (membership_type_id) references membership_types(id) on delete restrict, -- added
    membership_type text not null, -- "NonUbc", "Innovator", "Explorer", "Faculty"
    role_access text default 'basic', -- "basic", "admin"
    auth_user_id uuid not null,
    foreign key (auth_user_id) references auth.users(id) on delete cascade,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
    -- order_date date, -- removed
);

-- create table membership_types ( -- new
--     id uuid primary key default gen_random_uuid(),
--     name text not null,
--     description text not null,
--     features text[],
--     price decimal(10, 2) not null
-- );

create table events (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text not null, -- added
    regular_price decimal(10, 2) not null,
    member_price decimal(10, 2) default 0 not null,
    location_building text,
    location_room text,
    location_address_url text,
    start_date date, -- changed
    start_time time, -- changed
    end_date date, -- changed
    end_time time, -- changed
    max_capacity int not null,
    image_url text,

    is_active boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table event_registrations ( -- new
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null,
    foreign key (event_id) references events(id) on delete cascade,
    user_id uuid not null,
    foreign key (user_id) references user_info(id) on delete cascade,
    reviewed_by admin_user_id uuid,
    foreign key (reviewed_by) references user_info(id) on delete cascade,
    accepted boolean default false,
    attending boolean default false,
    checked_in boolean default false,
    checked_in_at timestamp with time zone,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table event_application_questions (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null,
    -- type text not null, -- "textbox", "dropdown" -> for future
    -- dropdown_options text[], -> for future
    foreign key (event_id) references events(id) on delete cascade,
    question text not null,
    max_char_limit int,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table event_application_responses ( -- new
    id uuid primary key default gen_random_uuid(),
    event_application_question_id uuid not null,
    foreign key (event_application_question_id) references event_application_questions(id) on delete cascade,
    response text not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);
