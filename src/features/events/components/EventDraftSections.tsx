import { ListCard, ListRow } from "@/components/shared/ListRow";
import type { EventRow } from "@/lib/supabase/models";
import { eventWorkingDocument } from "@/features/admin/lib/event-presentation";
import { legacyEventContent, RESOURCE_DEFAULTS } from "@/features/admin/lib/event-content";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Staff previews render the saved unfinished sections without publishing them. */
export function EventDraftSections({ event }: { event: EventRow }) {
  const document = eventWorkingDocument(event);
  const content = document?.formState.content ?? (document ? legacyEventContent(document.mentors, document.sponsors) : null);
  if (!content) return null;
  return <div className="space-y-6">{content.sections.map(section => <ListCard key={section.key} title={section.title || "Untitled section"} summary={`${section.items.length} saved entries`}>
    {section.items.map(item => <ListRow key={item.key} name={item.name || "Unnamed entry"} description={[item.position, item.description].filter(Boolean).join(" · ")} lead={section.kind === "Sponsors" ? { kind: "organization", logoSrc: item.image_url } : { kind: "person", src: item.image_url }} link={item.url ? { href: item.url, label: "Website" } : undefined} />)}
  </ListCard>)}{content.links.length > 0 && <Card className="p-6"><h3 className="text-subheading">Links and resources</h3><div className="flex flex-wrap gap-4">{content.links.map(link => link.url ? <Button key={link.id} asChild variant="outline"><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label || RESOURCE_DEFAULTS[link.type].title}</a></Button> : <Button key={link.id} disabled variant="outline">{link.label || RESOURCE_DEFAULTS[link.type].title}</Button>)}</div></Card>}</div>;
}
