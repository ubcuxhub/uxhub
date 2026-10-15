"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { BUCKETS } from "@/lib/supabase-helpers/buckets";
import type { UserInfoRow } from "@/lib/supabase/models";
import { formatTimestamp } from "@/lib/date";
import { normalizeInterests } from "../lib/user-profile";
import {
  removeUserProfilePhotoAction, saveUserBirthDateAction,
  saveUserInterestsAction, setStudentVerificationAction,
} from "../user-profile-actions";

interface Props {
  section: "photo" | "verification" | "birthday" | "interests";
  user: UserInfoRow;
  verifierName?: string;
  canEdit: boolean;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onUpdate: (user: UserInfoRow) => void;
  children?: ReactNode;
}

export function UserProfileSection({ section, user, verifierName, canEdit, busy, onBusy, onUpdate, children }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  async function save(operation: () => Promise<UserInfoRow>) {
    if (busy) return;
    onBusy(true);
    setError(null);
    try {
      onUpdate(await operation());
      setEditing(false);
      setFile(null);
      setPreview(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save. Try again.");
    } finally {
      onBusy(false);
    }
  }

  function addTag() {
    if (!draft.trim()) return tags;
    const next = normalizeInterests([...tags, draft]);
    setTags(next);
    setDraft("");
    return next;
  }

  const errorMessage = error ? <p role="alert" className="text-small text-destructive">{error}</p> : null;
  const controls = (operation: () => Promise<UserInfoRow>) => (
    <div className="flex gap-2">
      <Button disabled={busy} onClick={() => save(operation)}>{busy ? "Saving…" : "Save"}</Button>
      <Button variant="outline" disabled={busy} onClick={() => { setEditing(false); setError(null); }}>Cancel</Button>
    </div>
  );

  if (section === "photo") {
    const photoUrl = user.profile_photo_path
      ? createClient().storage.from(BUCKETS.profilePhotos).getPublicUrl(user.profile_photo_path).data.publicUrl
      : null;
    return (
      <section aria-label="Profile photo" className="space-y-2">
        <div className="flex items-start gap-4">
          <ProfileAvatar key={preview || photoUrl || "empty"} src={preview || photoUrl} name={user.first_name} />
          {children}
        </div>
        {canEdit && <div className="space-y-2">
            <Label htmlFor={`photo-${user.id}`}>Profile photo</Label>
            <Input ref={fileInput} id={`photo-${user.id}`} type="file" accept="image/jpeg,image/png" disabled={busy}
              onChange={(event) => {
                const chosen = event.target.files?.[0] ?? null;
                setFile(chosen); setPreview(chosen ? URL.createObjectURL(chosen) : null); setError(null);
              }} />
            <p className="text-small text-muted-foreground">JPEG or PNG, up to 4 MiB. Photos are public.</p>
        </div>}
        {canEdit && <div className="flex flex-wrap gap-2">
          {file && <>
            <Button disabled={busy} onClick={() => save(async () => {
              const form = new FormData();
              form.set("file", file);
              form.set("expectedPath", user.profile_photo_path ?? "");
              const response = await fetch(`/api/admin/users/${user.id}/photo`, { method: "POST", body: form });
              const data = await response.json();
              if (!response.ok) throw new Error(data.error || "Unable to upload photo.");
              return data.user;
            })}>{busy ? "Saving…" : "Save photo"}</Button>
            <Button variant="outline" disabled={busy} onClick={() => { setFile(null); setPreview(null); setError(null); if (fileInput.current) fileInput.current.value = ""; }}>Cancel photo</Button>
          </>}
          {user.profile_photo_path && <Button variant="outline" disabled={busy} onClick={() => save(() => removeUserProfilePhotoAction(user.id, user.profile_photo_path))}>Remove photo</Button>}
        </div>}
        {errorMessage}
      </section>
    );
  }

  if (section === "verification") return (
    <section aria-label="Student Verification" className="space-y-2">
      <h3 className="text-small font-medium">Student Verification</h3>
      <p className="text-small">{user.student_verified_at ? "Verified" : "Unverified"}</p>
      {user.student_verified_at && <p className="text-small text-muted-foreground">
        {formatTimestamp(user.student_verified_at)} · {verifierName || "Former or unavailable manager"}
      </p>}
      {canEdit && <Button variant="outline" disabled={busy} onClick={() => save(() => setStudentVerificationAction(user.id, !user.student_verified_at))}>
        {user.student_verified_at ? "Clear verification" : "Verify student"}
      </Button>}
      {errorMessage}
    </section>
  );

  return (
    <section aria-label={section === "birthday" ? "Birthday" : "Interests"} className="space-y-2">
      <h3 className="text-small font-medium">{section === "birthday" ? "Birthday" : "Interests"}</h3>
      {editing ? <>
        {section === "birthday" ? <Input aria-label="Birthday" type="date" value={draft} max={new Date().toISOString().slice(0, 10)} disabled={busy} onChange={(event) => setDraft(event.target.value)} /> : <>
          <div className="flex flex-wrap gap-2">{tags.map((tag) => <Button key={tag} variant="outline" disabled={busy} aria-label={`Remove interest ${tag}`} onClick={() => setTags(tags.filter((item) => item !== tag))}>{tag}<X className="size-3" /></Button>)}</div>
          <div className="flex gap-2">
            <Input aria-label="New interest" value={draft} maxLength={50} disabled={busy} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); try { addTag(); setError(null); } catch (cause) { setError((cause as Error).message); } }
            }} />
            <Button variant="outline" disabled={busy} onClick={() => { try { addTag(); setError(null); } catch (cause) { setError((cause as Error).message); } }}>Add tag</Button>
          </div>
          <p className="text-small text-muted-foreground">Up to 20 tags, 50 characters each.</p>
        </>}
        {controls(async () => section === "birthday" ? saveUserBirthDateAction(user.id, draft || null) : saveUserInterestsAction(user.id, addTag()))}
      </> : <div className="flex items-center justify-between gap-2 rounded-md border border-input px-3 py-2 text-small">
        <span>{section === "birthday" ? user.birth_date || "—" : user.interests.join(", ") || "—"}</span>
        {canEdit && <Button variant="ghost" className="h-6 px-2" disabled={busy} onClick={() => {
          setDraft(section === "birthday" ? user.birth_date ?? "" : ""); setTags(user.interests); setError(null); setEditing(true);
        }}>Edit</Button>}
      </div>}
      {errorMessage}
    </section>
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
