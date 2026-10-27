"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Pencil, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { BUCKETS } from "@/lib/supabase-helpers/buckets";
import type { UserInfoRow } from "@/lib/supabase/models";
import { formatTimestamp } from "@/lib/date";
import { normalizeInterests, PROFILE_PHOTO_MAX_BYTES } from "../lib/user-profile";
import type { UserEditDraft } from "../lib/user-edit";

interface Props {
  section: "photo" | "verification" | "birthday" | "interests";
  user: UserInfoRow;
  verifierName?: string;
  canEdit: boolean;
  busy: boolean;
  draft: UserEditDraft | null;
  onDraftChange: (changes: Partial<UserEditDraft>) => void;
  children?: ReactNode;
}

export function UserProfileSection({ section, user, verifierName, canEdit, busy, draft, onDraftChange, children }: Props) {
  const verificationId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const errorMessage = error ? <p role="alert" className="text-small text-destructive">{error}</p> : null;

  function addTag() {
    if (!draft?.newInterest.trim()) return;
    try {
      onDraftChange({ interests: normalizeInterests([...draft.interests, draft.newInterest]), newInterest: "" });
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  if (section === "photo") {
    const photoUrl = user.profile_photo_path
      ? createClient().storage.from(BUCKETS.profilePhotos).getPublicUrl(user.profile_photo_path).data.publicUrl
      : null;
    const preview = draft?.photo?.preview;
    const displayedPhoto = draft?.photo === null ? null : preview || photoUrl;
    return (
      <section aria-label="Profile photo" className="space-y-2">
        <div className="flex items-start gap-4">
          {canEdit ? <button type="button" aria-label="Change profile photo" title="Change profile photo" disabled={busy}
            className="group relative shrink-0 cursor-pointer rounded-full bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-50"
            onClick={() => fileInput.current?.click()}>
            <div className="rounded-full transition-opacity group-enabled:group-hover:opacity-50 group-enabled:group-focus-visible:opacity-50 motion-reduce:transition-none">
              <ProfileAvatar key={displayedPhoto || "empty"} src={displayedPhoto} name={user.first_name} />
            </div>
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full text-foreground opacity-0 transition-opacity group-enabled:group-hover:opacity-100 group-enabled:group-focus-visible:opacity-100 motion-reduce:transition-none" aria-hidden="true">
              <Pencil className="size-5" />
            </span>
          </button> : <ProfileAvatar key={photoUrl || "empty"} src={photoUrl} name={user.first_name} />}
          {children}
        </div>
        {canEdit && <div className="space-y-2">
            <input ref={fileInput} id={`photo-${user.id}`} aria-label="Profile photo" type="file" accept="image/jpeg,image/png" disabled={busy} className="sr-only" tabIndex={-1}
              onChange={(event) => {
                const chosen = event.target.files?.[0];
                if (!chosen || busy) return;
                if (!["image/jpeg", "image/png"].includes(chosen.type) || chosen.size > PROFILE_PHOTO_MAX_BYTES) {
                  setError("Choose a JPEG or PNG up to 4 MiB.");
                } else {
                  onDraftChange({ photo: { file: chosen, preview: URL.createObjectURL(chosen) } });
                  setError(null);
                }
                event.target.value = "";
              }} />
            <p className="text-small text-muted-foreground">{busy ? "Saving…" : "Click the photo to change it. JPEG or PNG, up to 4 MiB. Photos are public."}</p>
            {displayedPhoto && <Button variant="outline" disabled={busy} onClick={() => { onDraftChange({ photo: null }); setError(null); }}>Remove photo</Button>}
        </div>}
        {errorMessage}
      </section>
    );
  }

  if (section === "verification") return (
    <section aria-label="Student Verification" className="space-y-2">
      <Label htmlFor={verificationId} className="flex items-center gap-2 text-small font-normal">
        <Checkbox id={verificationId} checked={canEdit && draft ? draft.verified : !!user.student_verified_at} disabled={!canEdit || busy}
          onCheckedChange={(checked) => onDraftChange({ verified: checked })} />
        Student Verification
      </Label>
      {user.student_verified_at && (!canEdit || draft?.verified) && <p className="text-small text-muted-foreground">
        {formatTimestamp(user.student_verified_at)} · {verifierName || "Former or unavailable manager"}
      </p>}
      {errorMessage}
    </section>
  );

  return (
    <section aria-label={section === "birthday" ? "Birthday" : "Interests"} className={section === "birthday" ? "flex flex-col gap-2" : "flex flex-col gap-4"}>
      <h3 className="text-body font-medium">{section === "birthday" ? "Birthday" : "Interests"}</h3>
      {canEdit ? <>
        {section === "birthday" ? <Input className="text-small" aria-label="Birthday" type="date" value={draft?.birthDate ?? ""} max={new Date().toISOString().slice(0, 10)} disabled={busy} onChange={(event) => onDraftChange({ birthDate: event.target.value })} /> : <>
          <div className="flex flex-wrap gap-4">{(draft?.interests ?? []).map((tag) => (
            <InterestTag key={tag} tag={tag}>
              <button type="button" disabled={busy} aria-label={`Remove interest ${tag}`}
                className="cursor-pointer rounded-sm p-1 hover:bg-info/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onDraftChange({ interests: draft?.interests.filter((item) => item !== tag) })}>
                <X className="size-3" aria-hidden="true" />
              </button>
            </InterestTag>
          ))}</div>
          <div className="flex gap-2">
            <Input className="text-small" aria-label="New interest" value={draft?.newInterest ?? ""} maxLength={50} disabled={busy} onChange={(event) => onDraftChange({ newInterest: event.target.value })} onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); addTag(); }
            }} />
            <Button variant="outline" disabled={busy} onClick={() => { addTag(); }}>Add tag</Button>
          </div>
          <p className="text-small text-muted-foreground">Up to 20 tags, 50 characters each.</p>
        </>}
      </> : <div className={section === "interests" ? "flex items-start justify-between gap-3 text-small" : "flex items-center justify-between gap-2 rounded-md border border-input px-3 py-2 text-small"}>
        {section === "interests" ? (
          <div className="flex min-w-0 flex-wrap gap-4">
            {user.interests.length ? user.interests.map((tag) => <InterestTag key={tag} tag={tag} />) : <span className="text-muted-foreground">—</span>}
          </div>
        ) : <span>{user.birth_date || "—"}</span>}
      </div>}
      {errorMessage}
    </section>
  );
}

function InterestTag({ tag, children }: { tag: string; children?: ReactNode }) {
  return (
    <Badge variant="outline" className="min-h-8 max-w-full gap-1 rounded-lg border-info bg-info-bg px-4 py-1.5 text-small text-info">
      <span className="min-w-0 break-words">{tag}</span>
      {children}
    </Badge>
  );
}

function ProfileAvatar({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
    {src && !failed ? (
      // Public storage URLs already have immutable object names.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={`${name}'s profile photo`} className="size-full object-cover" onError={() => setFailed(true)} />
    ) : <UserRound className="size-8 text-muted-foreground" aria-hidden="true" />}
  </div>;
}
