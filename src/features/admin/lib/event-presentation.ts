import type { EventRow } from "@/lib/supabase/models";
import { parseWorkingDocument } from "./event-working-document";
import { datetimeLocalToTimestamptz } from "@/lib/date";
import { safeContentUrl } from "./event-content";
import { publicMarketingDestination } from "@/lib/event-marketing";
import { formStateFromEvent } from "../components/event-form/event-form-schema";
import { priceError } from "./event-configuration";

/** One saved-state adapter for staff editor, drawer and both previews.
 * Public rows never carry a working document (enforced in the database).
 */
export function eventWorkingDocument(event: EventRow) {
  if (event.status !== "draft" || event.publish_at || !event.working_document) return null;
  const document = parseWorkingDocument(event.working_document);
  const s = document.formState;
  const source = formStateFromEvent(event);
  return { ...document, formState: { ...s,
    ...(s.configuration_initialized === false ? {
      configuration_initialized: true, marketing_mode: source.marketing_mode, marketing_url: source.marketing_url,
      page_slug: source.page_slug, slug_edited: source.slug_edited, is_featured: source.is_featured,
      pricing_mode: source.pricing_mode, pricing_amount: source.pricing_amount,
    } : {}),
    ...(s.teams_configuration_initialized === false ? { teams_configuration_initialized: true, teams_enabled: source.teams_enabled, min_team_size: source.min_team_size, max_team_size: source.max_team_size, team_deadline: source.team_deadline } : {}),
    ...(s.schedule_configuration_initialized === false ? { schedule_configuration_initialized: true, agenda_enabled: source.agenda_enabled } : {}),
  } };
}

export function eventPresentation(event: EventRow): EventRow {
  const document = eventWorkingDocument(event);
  if (!document) return event;
  const s = document.formState;
  const amount = (value: string) => value.trim() && !priceError(value) ? Number(value) : null;
  const location = s.date_location?.location;
  const restricted = s.date_location?.audience === "going";
  return { ...event, name: s.name || "Untitled event", description: s.description || null,
    short_description: s.short_description || null, description_rich: s.description_rich as EventRow["description_rich"],
    configured_marketing_mode: s.marketing_mode, configured_marketing_url: s.marketing_url || null,
    marketing_url: s.marketing_mode === "external" && safeContentUrl(s.marketing_url) ? s.marketing_url : null,
    regular_price: s.pricing_mode === "free" ? 0 : amount(s.pricing_mode === "paid" ? s.pricing_amount : s.regular_price),
    member_price: s.pricing_mode === "legacy" ? amount(s.member_price) : 0,
    location_type: location?.type ?? event.location_type,
    location_building: location ? restricted ? location.public_summary : location.type === "online" ? "Online" : location.building : s.location_building || null,
    location_room: location ? restricted || location.type === "online" ? null : location.room : s.location_room || null,
    location_address: location ? restricted || location.type === "online" ? null : location.address : event.location_address,
    location_address_url: location ? restricted || location.type === "online" ? null : location.map_url : s.location_address_url || null,
    configured_slug: s.page_slug || event.slug, configured_slug_edited: s.slug_edited,
    starts_at: datetimeLocalToTimestamptz(s.starts_at), ends_at: datetimeLocalToTimestamptz(s.ends_at),
  };
}

export function eventMarketingHref(event: EventRow, publicPages = true) {
  const saved = eventPresentation(event);
  const destination = publicMarketingDestination(saved);
  if (destination.kind === "external") return destination.url;
  if (destination.kind !== "hosted" || !saved.slug) return null;
  if (saved.status === "draft") return `/events/${saved.slug}?preview=draft`;
  return publicPages && saved.status === "active" ? `/events/${saved.slug}` : null;
}
