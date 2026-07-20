"use client";
import { FlowLink } from "@/components/shared/FlowLink";
import { FACULTIES, YEAR_LEVELS } from "@/lib/constants";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { Pencil, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateUserInfoById } from "@/lib/supabase-helpers/users";
import {
  fetchMembershipTypeById,
  fetchMembershipTypes,
} from "@/lib/supabase-helpers/memberships";
import {
  fetchPurchaseHistoryForUser,
  type PurchaseHistoryItem,
} from "@/lib/supabase-helpers/event-registrations";
import { PageContainer } from "@/components/shared/PageContainer";
import { cn } from "@/lib/utils";
import type { MembershipTypeRow } from "@/features/memberships";
import type { UniversityYear, UserType } from "@/types/models";

const supabase = createClient();

const USER_TYPES: Array<{ value: UserType; label: string }> = [
  { value: "ubcStudent", label: "UBC Student" },
  { value: "faculty", label: "Faculty" },
  { value: "nonUbc", label: "Non-UBC" },
];

type ProfileFormData = {
  name: string;
  phone: string;
  student_number: string;
  faculty: string;
  major: string;
  year: UniversityYear | "";
  dietary_restrictions: string;
  preferred_pronouns: string;
  user_type: UserType;
};

// Perks shown in the "Member benefits" card to non-members. Edit this list to
// change the copy (placeholder content — replace with final wording).
const MEMBER_BENEFITS = [
  "Discounted tickets to UX Hub events and workshops",
  "Priority access to UXathon, design sprints, and office tours",
  "Members-only socials and networking nights",
  "Access to the member resource library and Figma kits",
];

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(value);

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
      })
    : "";

const Profile = () => {
  const { user, refreshUser } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    name: "",
    phone: "",
    student_number: "",
    faculty: "",
    major: "",
    year: "",
    dietary_restrictions: "",
    preferred_pronouns: "",
    user_type: "ubcStudent",
  });
  const [loading, setLoading] = useState(false);
  const [purchases, setPurchases] = useState<PurchaseHistoryItem[]>([]);
  const [membershipTiers, setMembershipTiers] = useState<MembershipTypeRow[]>(
    []
  );
  const [currentMembership, setCurrentMembership] =
    useState<MembershipTypeRow | null>(null);
  const [newsletterSaving, setNewsletterSaving] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const isMember = Boolean(user?.membership_type_id);

  // Public URL for the user's avatar by convention (avatars/<user id>). The
  // version query param busts the browser cache after a re-upload. If no file
  // exists (or the bucket isn't set up yet) the <img> errors and we fall back
  // to the logo placeholder.
  const AVATAR_BUCKET = "avatars";
  const avatarSrc = user
    ? `${
        supabase.storage.from(AVATAR_BUCKET).getPublicUrl(user.id).data
          .publicUrl
      }?v=${avatarVersion}`
    : "";

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        phone: user.phone || "",
        student_number: user.student_number?.toString() || "",
        faculty: user.faculty || "",
        major: user.major || "",
        year: user.year || "",
        dietary_restrictions: user.dietary_restrictions || "",
        preferred_pronouns: user.preferred_pronouns || "",
        user_type: user.user_type || "ubcStudent",
      });
    }
  }, [user]);

  // Purchase history (event registrations + event details).
  useEffect(() => {
    if (!user) return;
    fetchPurchaseHistoryForUser(supabase, user.id)
      .then(setPurchases)
      .catch((e) => console.error("Error loading purchase history:", e));
  }, [user]);

  // Membership tiers (for member-benefits/types) + the user's current tier.
  useEffect(() => {
    fetchMembershipTypes(supabase, { orderBy: "price" })
      .then(setMembershipTiers)
      .catch((e) => console.error("Error loading membership tiers:", e));
  }, []);

  useEffect(() => {
    if (!user?.membership_type_id) {
      setCurrentMembership(null);
      return;
    }
    fetchMembershipTypeById(supabase, user.membership_type_id)
      .then(setCurrentMembership)
      .catch((e) => console.error("Error loading current membership:", e));
  }, [user?.membership_type_id]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateUserInfoById(supabase, user.id, {
        name: formData.name,
        phone: formData.phone,
        student_number: formData.student_number
          ? parseInt(formData.student_number)
          : null,
        faculty: formData.faculty || null,
        major: formData.major || null,
        year: formData.year || null,
        dietary_restrictions: formData.dietary_restrictions || null,
        preferred_pronouns: formData.preferred_pronouns || null,
        // Membership classification changes go through the validated purchase
        // flow so eligibility and audience-specific fields stay consistent.
        user_type: user.user_type,
      });
      await refreshUser();
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleNewsletterToggle = async () => {
    if (!user || newsletterSaving) return;
    setNewsletterSaving(true);
    try {
      await updateUserInfoById(supabase, user.id, { newsletter: !user.newsletter });
      await refreshUser();
    } catch (error) {
      console.error("Error updating newsletter preference:", error);
    } finally {
      setNewsletterSaving(false);
    }
  };

  const handleAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const { error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(user.id, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      setAvatarBroken(false);
      setAvatarVersion((v) => v + 1); // cache-bust the public URL
    } catch (error) {
      console.error("Avatar upload failed:", error);
      alert(
        'Could not upload photo. Make sure the "avatars" storage bucket exists.'
      );
    } finally {
      setUploadingAvatar(false);
      e.target.value = ""; // allow re-selecting the same file
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSave();
  };

  if (!user) return null;

  return (
    <PageContainer>
      <h1 className="mb-6 text-h1">My Profile</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* ---------- LEFT: membership status + purchase history ---------- */}
        <div className="lg:col-span-2 space-y-6">
          {/* Membership status */}
          <Card>
            <CardContent className="flex items-center justify-between gap-4 py-6">
              {isMember ? (
                <>
                  <div>
                    <p className="text-h2 font-bold">
                      you&apos;re a registered member!
                    </p>
                  </div>
                  <Star className="flex-shrink-0 fill-primary text-primary" />
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-h2 font-bold">
                    you&apos;re not a member yet
                  </p>
                  <p className="text-small text-muted-foreground">
                    Join UX Hub to unlock member perks and event discounts.
                  </p>
                  <Button asChild>
                    <FlowLink href="/portal/membership/join">Join now</FlowLink>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Purchase history */}
          <Card>
            <CardHeader>
              <CardTitle>my purchase history</CardTitle>
            </CardHeader>
          </Card>

          {purchases.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-small text-muted-foreground">
                No purchases yet — your event tickets will show up here.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {purchases.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="aspect-video w-full rounded-md bg-muted overflow-hidden mb-3">
                      {item.event?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.event.image_url}
                          alt={item.event?.name ?? "Event"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full grid place-items-center text-muted-foreground/40 text-small">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="font-semibold">
                          {item.event?.name ?? "Event"}
                        </p>
                        <p className="text-small text-muted-foreground">
                          {item.event ? formatPrice(item.event.regular_price) : ""}
                        </p>
                      </div>
                      <p className="text-small text-muted-foreground">
                        {formatDate(item.event?.start_date ?? item.created_at)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Member benefits + types (non-members only) */}
          {!isMember && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-subheading">Member benefits</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal list-inside space-y-1 text-small text-muted-foreground">
                    {MEMBER_BENEFITS.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-subheading">Member types</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal list-inside space-y-1 text-small text-muted-foreground">
                    {membershipTiers.map((t) => (
                      <li key={t.id} className="capitalize">
                        {t.name} — {formatPrice(t.price)}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* ---------- RIGHT: profile info + newsletter ---------- */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Profile Information</CardTitle>
              {!isEditing ? (
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2"
                >
                  <Pencil />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={loading}
                  >
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row gap-6">
                {/* Avatar — click to upload; logo shown at 50% opacity when
                    no photo has been uploaded yet */}
                <label className="group relative h-32 w-32 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg bg-muted grid place-items-center">
                  {!avatarBroken ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarSrc}
                      alt="Profile photo"
                      onError={() => setAvatarBroken(true)}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src="/logo.png"
                      alt=""
                      aria-hidden
                      className="h-16 w-16 object-contain opacity-50"
                    />
                  )}
                  <div className="absolute inset-0 hidden items-center justify-center bg-black/50 text-table text-white group-hover:flex">
                    {uploadingAvatar ? "Uploading…" : "Change photo"}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                  />
                </label>

                <div className="flex-1 space-y-4">
                  <Field label="name">
                    {isEditing ? (
                      <Input
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        onKeyDown={handleKeyDown}
                      />
                    ) : (
                      user.name
                    )}
                  </Field>

                  <Field label="pronouns">
                    {isEditing ? (
                      <Input
                        value={formData.preferred_pronouns}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            preferred_pronouns: e.target.value,
                          })
                        }
                        onKeyDown={handleKeyDown}
                        placeholder="e.g. she/her"
                      />
                    ) : (
                      user.preferred_pronouns || "—"
                    )}
                  </Field>

                  <Field label="email">{user.email}</Field>

                  <Field label="student #">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={formData.student_number}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            student_number: e.target.value,
                          })
                        }
                        onKeyDown={handleKeyDown}
                      />
                    ) : (
                      user.student_number || "—"
                    )}
                  </Field>
                </div>
              </div>

              {/* Additional editable fields (shown in edit mode so nothing is lost) */}
              {isEditing && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">User Type</Label>
                    <Select
                      disabled
                      value={formData.user_type}
                      onValueChange={(value: UserType) =>
                        setFormData({ ...formData, user_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select user type" />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Phone</Label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Faculty</Label>
                    <Select
                      value={formData.faculty}
                      onValueChange={(value: string) =>
                        setFormData({ ...formData, faculty: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a faculty" />
                      </SelectTrigger>
                      <SelectContent>
                        {FACULTIES.map((faculty) => (
                          <SelectItem key={faculty} value={faculty}>
                            {faculty}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Major</Label>
                    <Input
                      value={formData.major}
                      onChange={(e) =>
                        setFormData({ ...formData, major: e.target.value })
                      }
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Year</Label>
                    <Select
                      value={formData.year}
                      onValueChange={(value: UniversityYear) =>
                        setFormData({ ...formData, year: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {YEAR_LEVELS.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">
                      Dietary Restrictions
                    </Label>
                    <Input
                      value={formData.dietary_restrictions}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dietary_restrictions: e.target.value,
                        })
                      }
                      onKeyDown={handleKeyDown}
                      placeholder="e.g. Vegetarian"
                    />
                  </div>
                </div>
              )}

              {/* Fields with no data model yet (mid-fi placeholders) */}
              {!isEditing && (
                <div className="mt-6 pt-6 border-t space-y-4">
                  <Field label="why ux?">
                    <span className="text-muted-foreground/60">—</span>
                  </Field>
                  <Field label="fun fact about me">
                    <span className="text-muted-foreground/60">—</span>
                  </Field>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Newsletter toggle */}
          <Card>
            <CardContent className="flex items-center justify-between py-6">
              <span className="text-subheading">
                Subscribe to the newsletter
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={user.newsletter}
                disabled={newsletterSaving}
                onClick={handleNewsletterToggle}
                className={cn(
                  "relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
                  user.newsletter ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform",
                    user.newsletter ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
};

// Small label/value row used by the profile card.
const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1">
    <Label className="text-muted-foreground">{label}</Label>
    <div className="font-medium min-h-9 flex items-center">{children}</div>
  </div>
);

export default Profile;
