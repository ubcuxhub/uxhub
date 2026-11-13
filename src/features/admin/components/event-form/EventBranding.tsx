"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Image as ImageIcon } from "lucide-react";
import { ColourPicker } from "@/components/ui/colour-picker";
import { SegmentedToggle, SegmentedToggleItem } from "@/components/ui/segmented-toggle";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { Ticket } from "@/components/shared/Ticket";
import { resolveImagePreviewSrc } from "@/lib/event-image";
import type { EventFormState } from "./event-form-schema";

export function EventBranding({ state, disabled, onChange, onIcon, onHeader }: {
  state: EventFormState; disabled: boolean;
  onChange: <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => void;
  onIcon: (file: File | null) => void; onHeader: (file: File | null) => void;
}) {
  const [headerMode, setHeaderMode] = useState(state.header_image_url ? "image" : "colour");
  const [iconPreview, setIconPreview] = useState("");
  const [headerPreview, setHeaderPreview] = useState("");
  useEffect(() => () => { if (iconPreview) URL.revokeObjectURL(iconPreview); }, [iconPreview]);
  useEffect(() => () => { if (headerPreview) URL.revokeObjectURL(headerPreview); }, [headerPreview]);
  const pickIcon = (file: File | null) => { setIconPreview(file ? URL.createObjectURL(file) : ""); onIcon(file); };
  const pickHeader = (file: File | null) => { setHeaderPreview(file ? URL.createObjectURL(file) : ""); onHeader(file); };
  const iconSrc = iconPreview || (state.image_url ? resolveImagePreviewSrc(state.image_url) : "");
  const headerSrc = headerPreview || (state.header_image_url ? resolveImagePreviewSrc(state.header_image_url) : "");
  const [custom, setCustom] = useState<string[]>([]);
  const colours = Array.from(new Set([...custom, state.header_colour, state.event_colour].filter(hex => hex && !["#325DC4", "#C983C7", "#4A5E8A"].includes(hex.toUpperCase()))));
  return <div className="@container/branding space-y-6 rounded-xl border border-border bg-card p-5">
    <div className="border-b border-border-subtle pb-4"><h3 className="text-subheading">Header and colours</h3><p className="text-muted-foreground">Images and colours for the event page, the ticket and the featured card.</p></div>
    <div className="grid items-start gap-6 @min-[28rem]/branding:grid-cols-[220px_minmax(0,1fr)]">
      <ImageUpload presentation="icon" label="Icon" value={state.image_url} requirements={{ square: true, minWidth: 600, minHeight: 600 }} onChange={url => onChange("image_url", url)} onFileChange={pickIcon} disabled={disabled} />
      <p className="text-small text-muted-foreground sm:pt-8">Icons show in the event overview in the portal and on marketing pages.</p>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-4"><h3 className="text-small font-medium">Page header</h3><SegmentedToggle aria-label="Page header mode" value={headerMode} disabled={disabled} onValueChange={mode => { setHeaderMode(mode); if (mode === "colour") { onChange("header_image_url", ""); pickHeader(null); onChange("header_colour", state.header_colour || "#325DC4"); } else onChange("header_colour", ""); }}><SegmentedToggleItem value="image">Image</SegmentedToggleItem><SegmentedToggleItem value="colour">Colour</SegmentedToggleItem></SegmentedToggle></div>
    {headerMode === "image" ? <ImageUpload presentation="header" label="Header image" value={state.header_image_url} requirements={{ minWidth: 1600, minHeight: 400 }} onChange={url => onChange("header_image_url", url)} onFileChange={pickHeader} disabled={disabled} /> : <ColourPicker hideLabel label="Header colour" value={state.header_colour || "#325DC4"} customColours={colours} onCustomColoursChange={setCustom} disabled={disabled} onValueChange={hex => onChange("header_colour", hex)} />}
    <div aria-label="Header preview" className="overflow-hidden rounded-lg border border-border">
      <div className="relative h-22" style={{ backgroundColor: state.header_colour || "var(--muted)" }}>{headerMode === "image" && headerSrc && <Image src={headerSrc} alt="" fill className="object-cover" unoptimized />}</div>
      <div className="space-y-2 px-4 pb-4"><div className="relative -mt-7 flex size-14 items-center justify-center overflow-hidden rounded-lg border-3 border-card bg-muted">{iconSrc ? <Image src={iconSrc} alt="" fill className="object-cover" unoptimized /> : <ImageIcon className="size-5 text-muted-foreground" />}</div><p className="font-semibold">{state.name || "Untitled event"}</p><p className="text-small text-muted-foreground">Header preview</p></div>
    </div>
    <div className="grid gap-6 border-t border-border-subtle pt-4 @min-[48rem]/branding:grid-cols-[minmax(0,1fr)_340px]"><div className="space-y-4"><h3 className="text-small font-medium">Event colour</h3><p className="text-small text-muted-foreground">Colours the ticket, and the gradient on the featured card when the event is featured on the portal home.</p><ColourPicker hideLabel label="Event colour" value={state.event_colour} onValueChange={hex => onChange("event_colour", hex)} customColours={colours} onCustomColoursChange={setCustom} disabled={disabled} /></div><div className="space-y-2"><Ticket eventName={state.name || "Untitled event"} holderName="Member name" eventColour={state.event_colour} code={<span className="text-caption text-black">Sample</span>} /><p className="text-small text-muted-foreground">Ticket preview · sample only</p></div></div>
  </div>;
}
