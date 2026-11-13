"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Globe, Plus, Trash2 } from "lucide-react";
import { SortableSection, ReorderControls } from "@/components/shared/SortableSection";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { Hubbo } from "@/components/shared/Hubbo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { searchEventDirectoryAction } from "@/features/admin/actions";
import { personContentEntry, sponsorContentEntry } from "@/lib/supabase-helpers/event-content";
import type { MentorRow, SponsorRow } from "@/lib/supabase/models";
import { changeResourceType, emptyContentEntry, eventContentProblem, LINK_TYPES, PEOPLE_GROUPS, RESOURCE_DEFAULTS, safeContentUrl, type ContentEntry, type EventContent, type PeopleSection, type ResourceAudience, type ResourceType } from "../../lib/event-content";

function move<T>(items: T[], from: number, to: number) {
  const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next;
}

function DirectoryPicker({ section, people, sponsors, onAdd }: { section: PeopleSection; people: MentorRow[]; sponsors: SponsorRow[]; onAdd: (item: ContentEntry) => void }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ people?: MentorRow[]; sponsors?: SponsorRow[] }>({ people, sponsors });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true); setError(null);
      searchEventDirectoryAction(section.kind === "Sponsors" ? "sponsors" : "people", query).then(rows => { if (active) setResult(rows); }).catch(() => { if (active) setError("Couldn’t load the directory. Try again."); }).finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, section.kind, retry]);
  const entries = section.kind === "Sponsors" ? (result.sponsors ?? []).map(row => ({ id: row.id, label: row.name, description: row.description ?? "", entry: () => sponsorContentEntry(row) })) : (result.people ?? []).map(row => ({ id: row.id, label: row.full_name, description: row.position ?? "", entry: () => personContentEntry(row) }));
  const available = entries.filter(entry => !section.items.some(item => item.directory_id === entry.id));
  return <Field><FieldLabel htmlFor={`directory-${section.key}`}>Add from directory</FieldLabel><SearchableDropdown id={`directory-${section.key}`} placeholder={section.kind === "Sponsors" ? "Search sponsors" : "Search people"} value={null} options={available.map(entry => ({ value: entry.id, label: entry.label, description: entry.description }))} onQueryChange={setQuery} loading={loading} onValueChange={id => { const entry = available.find(entry => entry.id === id); if (entry) onAdd(entry.entry()); }} noResults={() => "No matching entries. You can add a new entry below."} />{error && <><FieldError>{error}</FieldError><Button type="button" variant="outline" onClick={() => setRetry(value => value + 1)}>Try again</Button></>}</Field>;
}

function EntryEditor({ item, sponsor, onChange, showErrors }: { item: ContentEntry; sponsor: boolean; showErrors: boolean; onChange: (item: ContentEntry) => void }) {
  const id = useId();
  const latest = useRef(item);
  const latestChange = useRef(onChange);
  useEffect(() => { latest.current = item; latestChange.current = onChange; }, [item, onChange]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadSequence = useRef(0);
  useEffect(() => () => { uploadSequence.current++; }, []);
  const update = (field: keyof ContentEntry, value: string) => onChange({ ...item, [field]: value });
  const upload = async (file: File | null) => {
    const sequence = ++uploadSequence.current;
    if (!file) return;
    setUploading(true); setUploadError(null);
    latestChange.current({ ...latest.current, image_url: "upload:pending" });
    try {
      const body = new FormData(); body.append("file", file); body.append("eventName", item.name || "Event entry"); body.append("kind", "entry");
      const response = await fetch("/api/upload-event-image", { method: "POST", body });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.url) throw new Error(result?.error || "Couldn’t upload image. Select the file to try again.");
      if (sequence === uploadSequence.current) latestChange.current({ ...latest.current, image_url: result.url });
    } catch (error) { if (sequence === uploadSequence.current) setUploadError(error instanceof Error ? error.message : "Couldn’t upload image."); }
    finally { if (sequence === uploadSequence.current) setUploading(false); }
  };
  return <div className="grid min-w-0 gap-4 sm:grid-cols-2">
    <p className="text-small text-muted-foreground sm:col-span-2">Changes apply only to this event.</p>
    <Field><FieldLabel htmlFor={`${id}-name`}>{sponsor ? "Name" : "Full name"}</FieldLabel><Input id={`${id}-name`} aria-invalid={showErrors && !item.name.trim()} aria-describedby={showErrors && !item.name.trim() ? `${id}-name-error` : undefined} value={item.name} onChange={event => update("name", event.target.value)} aria-required />{showErrors && !item.name.trim() && <FieldError id={`${id}-name-error`}>Name is required.</FieldError>}</Field>
    {!sponsor && <Field><FieldLabel htmlFor={`${id}-position`}>Position (optional)</FieldLabel><Input id={`${id}-position`} value={item.position} onChange={event => update("position", event.target.value)} /></Field>}
    <Field><FieldLabel htmlFor={`${id}-url`}>{sponsor ? "Website" : "LinkedIn URL"} (optional)</FieldLabel><Input id={`${id}-url`} aria-describedby={item.url && !safeContentUrl(item.url) ? `${id}-url-error` : undefined} value={item.url} onChange={event => update("url", event.target.value)} aria-invalid={!!item.url && !safeContentUrl(item.url)} />{item.url && !safeContentUrl(item.url) && <FieldError id={`${id}-url-error`}>Use a safe HTTP or HTTPS URL.</FieldError>}</Field>
    <Field><FieldLabel htmlFor={`${id}-description`}>Description (optional)</FieldLabel><Textarea id={`${id}-description`} value={item.description} onChange={event => update("description", event.target.value)} /></Field>
    <ImageUpload id={`${id}-image`} label={sponsor ? "Logo (optional)" : "Profile image (optional)"} value={item.image_url} requirements={{ square: false }} uploading={uploading} error={uploadError} onChange={url => { if (!url) { uploadSequence.current++; setUploading(false); } update("image_url", url); }} onFileChange={file => { void upload(file); }} />
  </div>;
}

export function EventPeopleEditor({ content, onChange, people = [], sponsors = [], showErrors }: { content: EventContent; onChange: (content: EventContent) => void; people?: MentorRow[]; sponsors?: SponsorRow[]; showErrors: boolean }) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [editing, setEditing] = useState<string[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const pendingSection = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingSection.current) return;
    const target = document.getElementById(`people-section-${pendingSection.current}`);
    if (!target) return;
    pendingSection.current = null;
    target.scrollIntoView({ block: "start", behavior: "instant" });
    target.focus({ preventScroll: true });
  }, [content.sections]);
  const sectionProblem = eventContentProblem({ ...content, links: [] });
  const update = (index: number, section: PeopleSection) => onChange({ ...content, sections: content.sections.map((current, i) => i === index ? section : current) });
  const changeEntry = (index: number, key: string, entry: ContentEntry) => { const section = content.sections[index]; update(index, { ...section, items: section.items.map(item => item.key === key ? entry : item) }); };
  const moveSection = (from: number, to: number) => { onChange({ ...content, sections: move(content.sections, from, to) }); setAnnouncement(`${content.sections[from].title} moved to ${to + 1} of ${content.sections.length}`); };
  const moveEntry = (sectionIndex: number, from: number, to: number) => { const section = content.sections[sectionIndex]; update(sectionIndex, { ...section, items: move(section.items, from, to) }); setAnnouncement(`${section.items[from].name || "Entry"} moved to ${to + 1} of ${section.items.length}`); };
  const remove = (key: string) => onChange({ ...content, sections: content.sections.filter(section => section.key !== key) });
  useEffect(() => {
    if (!showErrors) return;
    const reveal = () => {
      const invalid = content.sections.filter(section => !section.items.length || !section.title.trim() || section.items.some(item => !item.name.trim() || (item.url && !safeContentUrl(item.url))));
      setCollapsed(current => current.filter(key => !invalid.some(section => section.key === key)));
    };
    const timer = setTimeout(reveal, 0);
    const navigate = () => { reveal(); setTimeout(() => document.querySelector<HTMLElement>("#builder-people [data-content-error], #builder-people [aria-invalid=true], #builder-people input")?.focus(), 0); };
    window.addEventListener("event-content-invalid", navigate);
    return () => { clearTimeout(timer); window.removeEventListener("event-content-invalid", navigate); };
  }, [showErrors, content.sections]);
  return <div className="min-w-0 space-y-5"><p className="text-muted-foreground">One section per group on the event page. Drag sections to change their order.</p>
    <Card className="py-5"><CardContent className="space-y-3"><p className="font-medium">Add a section</p><div className="flex flex-wrap gap-2">{[...PEOPLE_GROUPS, "custom" as const].map(kind => <Button key={kind} type="button" variant="outline" disabled={kind !== "custom" && content.sections.some(section => section.kind === kind)} onClick={() => { const key = crypto.randomUUID(); pendingSection.current = key; onChange({ ...content, sections: [...content.sections, { key, kind, title: kind === "custom" ? "" : kind, items: [] }] }); }}>{kind !== "custom" && <Plus aria-hidden />}{kind === "custom" ? "Custom section" : kind}</Button>)}</div></CardContent></Card>
    {!content.sections.length ? <EmptyState media={<Hubbo emotion="resting" size="card" />} title="No sections yet" description="Add judges, mentors, speakers, panelists or sponsors with the buttons above. Each becomes its own list on the event page." /> : <div className="space-y-3"><p className="text-small text-muted-foreground">Drag sections to reorder.</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setCollapsed(content.sections.map(section => section.key))}>Collapse all</Button><Button type="button" variant="outline" onClick={() => setCollapsed([])}>Expand all</Button></div></div>}
    {showErrors && sectionProblem && <FieldError tabIndex={-1} data-content-error>{sectionProblem}</FieldError>}
    <span role="status" className="sr-only">{announcement}</span>
    {content.sections.map((section, sectionIndex) => <SortableSection key={section.key} sectionId={`people-section-${section.key}`} dragType="application/x-event-section" title={section.title || "Custom section"} countLabel={`${section.items.length} ${section.kind === "Sponsors" ? "sponsors" : "people"}`} index={sectionIndex} count={content.sections.length} open={!collapsed.includes(section.key)} invalid={showErrors && !section.items.length} onOpenChange={open => setCollapsed(current => open ? current.filter(key => key !== section.key) : [...current, section.key])} onMove={to => moveSection(sectionIndex, to)} onDragStart={event => { event.dataTransfer.setData("application/x-event-section", section.key); event.dataTransfer.effectAllowed = "move"; }} onDrop={(event, placement) => { const from = content.sections.findIndex(row => row.key === event.dataTransfer.getData("application/x-event-section")); const insertion = sectionIndex + (placement === "after" ? 1 : 0); const to = insertion - (from < insertion ? 1 : 0); if (from >= 0 && from !== to) moveSection(from, to); }} actions={<Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Remove ${section.title || "custom section"}`} onClick={() => section.items.length ? setRemoving(section.key) : remove(section.key)}><Trash2 aria-hidden /></Button>}>
      <div className="min-w-0 space-y-4">
        {section.kind === "custom" && <Field><FieldLabel htmlFor={`section-${section.key}`}>Section name</FieldLabel><Input id={`section-${section.key}`} value={section.title} maxLength={120} onChange={event => update(sectionIndex, { ...section, title: event.target.value })} aria-required /></Field>}
        {!section.items.length && <FieldError>Add at least one item or remove this section.</FieldError>}
        <Table aria-label={`${section.title || "Custom section"} entries`} variant="separated" className="min-w-[34rem]" scrollerClassName="max-w-full"><TableBody>{section.items.map((item, index) => <TableRow key={item.key} className="bg-transparent [&>td]:bg-section" onDragOver={event => event.preventDefault()} onDrop={event => { const data = event.dataTransfer.getData(`application/x-event-entry-${section.key}`); if (!data) return; event.stopPropagation(); event.preventDefault(); const from = section.items.findIndex(row => row.key === data); if (from >= 0 && from !== index) moveEntry(sectionIndex, from, index); }}>
          <TableCell><div className="flex items-center gap-3"><Avatar name={item.name || "New entry"} src={item.image_url} size={40} decorative /><div><p className="font-medium">{item.name || "New entry"}</p><p className="text-small text-muted-foreground">{section.kind === "Sponsors" ? item.description : item.position}</p></div></div></TableCell>
          <TableCell>{item.url && safeContentUrl(item.url) && <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`${item.name} ${section.kind === "Sponsors" ? "website" : "on LinkedIn"}`} className="inline-flex items-center gap-2 text-small underline"><Globe className="size-3.5" aria-hidden />{section.kind === "Sponsors" ? "Website" : "LinkedIn"}</a>}</TableCell>
          <TableCell><div className="flex items-center justify-end gap-1"><ReorderControls label={item.name || `entry ${index + 1}`} index={index} count={section.items.length} onMove={to => moveEntry(sectionIndex, index, to)} onDragStart={event => { event.stopPropagation(); event.dataTransfer.setData(`application/x-event-entry-${section.key}`, item.key); event.dataTransfer.effectAllowed = "move"; }} /><Button type="button" variant="outline" aria-expanded={editing.includes(item.key)} onClick={() => setEditing(current => current.includes(item.key) ? current.filter(key => key !== item.key) : [...current, item.key])}>{editing.includes(item.key) ? "Close editor" : "Edit"}</Button><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${item.name || "entry"}`} onClick={() => update(sectionIndex, { ...section, items: section.items.filter(row => row.key !== item.key) })}><Trash2 aria-hidden /></Button></div></TableCell>
        </TableRow>)}</TableBody></Table>
        {section.items.filter(item => editing.includes(item.key) || (showErrors && !item.name.trim())).map(item => <Card key={item.key} className="bg-section py-4"><CardContent><EntryEditor showErrors={showErrors} item={item} sponsor={section.kind === "Sponsors"} onChange={entry => changeEntry(sectionIndex, item.key, entry)} /></CardContent></Card>)}
        <DirectoryPicker section={section} people={people} sponsors={sponsors} onAdd={item => update(sectionIndex, { ...section, items: [...section.items, item] })} />
        <Button type="button" variant="outline" onClick={() => { const item = emptyContentEntry(); update(sectionIndex, { ...section, items: [...section.items, item] }); setEditing(current => [...current, item.key]); }}><Plus aria-hidden />{section.kind === "Sponsors" ? "Add new sponsor" : "Add new person"}</Button>
      </div>
    </SortableSection>)}
    <Dialog open={removing !== null} onOpenChange={open => { if (!open) setRemoving(null); }}><DialogContent><DialogHeader><DialogTitle>Remove this section?</DialogTitle><DialogDescription>This removes its entries from this event. Shared directory records and other events stay unchanged.</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" onClick={() => setRemoving(null)}>Keep section</Button><Button type="button" variant="destructive" onClick={() => { if (removing) remove(removing); setRemoving(null); }}>Remove section</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

export function EventResourcesEditor({ content, onChange, showErrors }: { content: EventContent; onChange: (content: EventContent) => void; showErrors: boolean }) {
  const update = (index: number, patch: Partial<EventContent["links"][number]>) => onChange({ ...content, links: content.links.map((link, i) => index === i ? { ...link, ...patch } : link) });
  return <Card className="min-w-0 py-5"><CardContent className="min-w-0 space-y-4"><p className="text-muted-foreground">Choose who sees each link. Hidden links appear on their own once a member’s status changes.</p>
    {!content.links.length && <EmptyState title="No links yet" description="Add a Slack workspace or participant package using the buttons below." />}
    {content.links.map((link, index) => <div key={link.id} className="space-y-3 rounded-lg bg-section p-4"><div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <Field><FieldLabel htmlFor={`type-${link.id}`}>Type</FieldLabel><Select value={link.type} onValueChange={value => update(index, changeResourceType(link, value as ResourceType))}><SelectTrigger id={`type-${link.id}`}><SelectValue /></SelectTrigger><SelectContent>{LINK_TYPES.map(type => <SelectItem key={type} value={type}>{RESOURCE_DEFAULTS[type].title}</SelectItem>)}</SelectContent></Select></Field>
      <Field><FieldLabel htmlFor={`audience-${link.id}`}>Who can see it</FieldLabel><Select value={link.visibility} onValueChange={value => update(index, { visibility: value as ResourceAudience, audience_edited: true })}><SelectTrigger id={`audience-${link.id}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="everyone">Everyone</SelectItem><SelectItem value="going">Going attendees and staff</SelectItem><SelectItem value="after_event">Everyone after the event</SelectItem></SelectContent></Select></Field>
      <Field><FieldLabel htmlFor={`label-${link.id}`}>Button label{link.type === "other" ? "" : " (optional)"}</FieldLabel><Input id={`label-${link.id}`} aria-describedby={showErrors && link.type === "other" && !link.label.trim() ? `label-error-${link.id}` : undefined} value={link.label} placeholder={RESOURCE_DEFAULTS[link.type].label} onChange={event => update(index, { label: event.target.value, label_edited: true })} aria-invalid={showErrors && link.type === "other" && !link.label.trim()} />{showErrors && link.type === "other" && !link.label.trim() && <FieldError id={`label-error-${link.id}`}>Other links need a label.</FieldError>}</Field>
      <Field><FieldLabel htmlFor={`url-${link.id}`}>Link</FieldLabel><Input id={`url-${link.id}`} aria-describedby={(showErrors || !!link.url) && !safeContentUrl(link.url) ? `url-error-${link.id}` : undefined} value={link.url} onChange={event => update(index, { url: event.target.value })} aria-invalid={(showErrors || !!link.url) && !safeContentUrl(link.url)} />{(showErrors || !!link.url) && !safeContentUrl(link.url) && <FieldError id={`url-error-${link.id}`}>Use an absolute HTTP or HTTPS URL without a username or password.</FieldError>}</Field>
    </div><div className="flex justify-end"><Button type="button" variant="ghost" aria-label={`Remove link ${index + 1}`} onClick={() => onChange({ ...content, links: content.links.filter(row => row.id !== link.id) })}><Trash2 aria-hidden />Remove link</Button></div></div>)}
    <p className="font-medium">Add a link</p><div className="flex flex-wrap gap-2">{LINK_TYPES.map(type => <Button key={type} type="button" variant="outline" onClick={() => onChange({ ...content, links: [...content.links, { id: crypto.randomUUID(), type, label: RESOURCE_DEFAULTS[type].label, visibility: RESOURCE_DEFAULTS[type].visibility, url: "" }] })}>{RESOURCE_DEFAULTS[type].title}</Button>)}</div>
    <div className="grid gap-4 sm:grid-cols-3">{[["Event header", "Slack links show as buttons beside the status."], ["Registration card", "The participant package shows next to the ticket."], ["After the event", "The event recap link shows in the Event recap card once the event is past. The ticket stays, marked no longer valid."]].map(([title, description]) => <div key={title} className="rounded-lg bg-section p-4"><p className="font-medium">{title}</p><p className="text-small text-muted-foreground">{description}</p></div>)}</div>
  </CardContent></Card>;
}
