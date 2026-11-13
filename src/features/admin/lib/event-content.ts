/** Serializable staff editor content; directory identities are read-only sources. */
export const PEOPLE_GROUPS = ["Judges", "Mentors", "Speakers", "Panelists", "Sponsors"] as const;
export type PeopleGroup = (typeof PEOPLE_GROUPS)[number] | "custom";
export interface ContentEntry {
  key: string;
  directory_id: string | null;
  name: string;
  position: string;
  description: string;
  url: string;
  image_url: string;
}
export interface PeopleSection {
  key: string;
  kind: PeopleGroup;
  title: string;
  items: ContentEntry[];
}
export const LINK_TYPES = ["slack_workspace", "participant_package", "event_recap", "other"] as const;
export type ResourceType = (typeof LINK_TYPES)[number];
export type ResourceAudience = "everyone" | "going" | "after_event";
export interface ResourceLink {
  id: string;
  type: ResourceType;
  label: string;
  url: string;
  visibility: ResourceAudience;
  label_edited?: boolean;
  audience_edited?: boolean;
}
export interface EventContent {
  revision: number;
  sections: PeopleSection[];
  links: ResourceLink[];
}
export const RESOURCE_DEFAULTS: Record<ResourceType, { title: string; label: string; visibility: ResourceAudience }> = {
  slack_workspace: { title: "Slack workspace", label: "Join the Slack", visibility: "everyone" },
  participant_package: { title: "Participant package", label: "Participant package", visibility: "going" },
  event_recap: { title: "Event recap", label: "Event recap", visibility: "after_event" },
  other: { title: "Other link", label: "", visibility: "everyone" },
};
export const emptyContent = (): EventContent => ({ revision: 0, sections: [], links: [] });
export const emptyContentEntry = (): ContentEntry => ({ key: crypto.randomUUID(), directory_id: null, name: "", position: "", description: "", url: "", image_url: "" });
export function safeContentUrl(value: string) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !!url.hostname && !url.username && !url.password && !/[\s\\]/.test(value) && /^https?:\/\//i.test(value);
  } catch { return false; }
}
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Structural validation also protects draft reads; old empty sections can be recovered. */
export function parseEventContent(input: unknown): EventContent {
  if (!input || typeof input !== "object") throw new Error("Invalid people and resource content.");
  const value = input as EventContent;
  if (!Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.sections) || !Array.isArray(value.links) || value.sections.length > 100 || value.links.length > 100) throw new Error("Invalid people and resource content.");
  const keys = new Set<string>();
  const allEntryKeys = new Set<string>();
  for (const section of value.sections) {
    if (!section || !uuid(section.key) || keys.has(section.key) || ![...PEOPLE_GROUPS, "custom"].includes(section.kind) || typeof section.title !== "string" || section.title.length > 120 || !Array.isArray(section.items) || section.items.length > 200) throw new Error("Invalid people section.");
    keys.add(section.key);
    const entries = new Set<string>();
    for (const item of section.items) {
      if (!item || !uuid(item.key) || entries.has(item.key) || allEntryKeys.has(item.key) || (item.directory_id !== null && !uuid(item.directory_id)) || [item.name, item.position, item.description, item.url, item.image_url].some(field => typeof field !== "string" || field.length > 5000)) throw new Error("Invalid section entry.");
      entries.add(item.key); allEntryKeys.add(item.key);
      if (item.url && !safeContentUrl(item.url)) throw new Error("Entry links must use a safe HTTP or HTTPS URL.");
      if (item.image_url && !safeContentUrl(item.image_url) && !/^\/(?!\/)/.test(item.image_url)) throw new Error("Upload the selected image before saving.");
    }
  }
  const links = new Set<string>();
  for (const link of value.links) {
    if (!link || !uuid(link.id) || links.has(link.id) || !LINK_TYPES.includes(link.type) || !["everyone", "going", "after_event"].includes(link.visibility) || [link.label, link.url].some(field => typeof field !== "string" || field.length > 5000)) throw new Error("Invalid resource link.");
    if ((link.label_edited !== undefined && typeof link.label_edited !== "boolean") || (link.audience_edited !== undefined && typeof link.audience_edited !== "boolean")) throw new Error("Invalid resource defaults.");
    links.add(link.id);
    if (link.url && !safeContentUrl(link.url)) throw new Error("Resource links must use a safe HTTP or HTTPS URL.");
  }
  return value;
}
export function eventContentProblem(content: EventContent, draft = false): string | null {
  try { parseEventContent(content); } catch (error) { return (error as Error).message; }
  const titles = new Set<string>();
  const groups = new Set<string>();
  for (const section of content.sections) {
    if (!section.items.length) return `${section.title || "Custom section"}: Add at least one item or remove this section.`;
    const title = section.title.trim().toLowerCase();
    if (!title || titles.has(title)) return "Section names must be nonblank and unique.";
    titles.add(title);
    if (section.kind !== "custom") {
      if (section.title !== section.kind || groups.has(section.kind)) return "Each predefined group can only be added once with its fixed name.";
      groups.add(section.kind);
    } else if (PEOPLE_GROUPS.some(group => group.toLowerCase() === title)) return "Custom sections cannot use a predefined group name.";
    const directoryIds = section.items.map(item => item.directory_id).filter(Boolean);
    if (new Set(directoryIds).size !== directoryIds.length) return "An existing entry can only be added once per section.";
    if (!draft && section.items.some(item => !item.name.trim())) return `${section.title}: Every entry needs a name.`;
  }
  if (!draft && content.links.some(link => !link.url || (link.type === "other" && !link.label.trim()))) return "Every resource needs a URL; Other links also need a label.";
  return null;
}
export function changeResourceType(link: ResourceLink, type: ResourceType): ResourceLink {
  const previous = RESOURCE_DEFAULTS[link.type];
  const next = RESOURCE_DEFAULTS[type];
  return { ...link, type, label: !link.label_edited && link.label === previous.label ? next.label : link.label,
    visibility: !link.audience_edited && link.visibility === previous.visibility && link.visibility === "everyone" ? next.visibility : link.visibility };
}

/** Upgrade saved version-one cards without dropping unfinished legacy entries. */
export function legacyEventContent(mentors: { id?: string; full_name: string; position: string; description: string; linkedin_url: string; profile_image_path: string }[], sponsors: { id?: string; name: string; brand_logo_path: string }[], source?: EventContent): EventContent {
  const result = emptyContent();
  if (mentors.length) result.sections.push({ key: crypto.randomUUID(), kind: "Mentors", title: "Mentors", items: mentors.map(item => ({ ...emptyContentEntry(), directory_id: item.id ?? null, name: item.full_name, position: item.position, description: item.description, url: item.linkedin_url, image_url: item.profile_image_path })) });
  if (sponsors.length) result.sections.push({ key: crypto.randomUUID(), kind: "Sponsors", title: "Sponsors", items: sponsors.map(item => ({ ...emptyContentEntry(), directory_id: item.id ?? null, name: item.name, image_url: item.brand_logo_path })) });
  if (source) return { ...source, sections: [...source.sections.filter(section => !["Mentors", "Sponsors"].includes(section.kind)), ...result.sections.map(section => ({ ...section, key: source.sections.find(existing => existing.kind === section.kind)?.key ?? section.key }))] };
  return result;
}
