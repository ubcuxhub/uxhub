-- Add rich event detail fields for the public event page.
-- These support the Mentors, Agenda, Sponsors, and Description-image sections.

-- Gallery images shown in the "Event Description" section
alter table events add column if not exists description_images text[];

-- Mentors: array of { name, role, company, image_url, linkedin_url, bio }
alter table events add column if not exists mentors jsonb;

-- Agenda: array of { time, title, description, room }
alter table events add column if not exists agenda jsonb;

-- Sponsor logos shown on the event page
alter table events add column if not exists sponsor_logos text[];
