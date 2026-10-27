"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUser } from "@/lib/auth/user-context";
import { UserDetailsPanel } from "@/features/admin/components/UserDetailsPanel";
import {
  UserDirectoryPanel,
} from "@/features/admin/components/UserDirectoryPanel";
import {
  type MembershipTypeOption,
  type SortDirection,
  type SortOption,
  type UserRecord,
} from "@/features/admin/types";
import {
  saveManagerUserDetailsAction,
  updateUserRoleAction,
} from "@/features/admin/actions";
import { formatUserName } from "@/lib/user-name";
import type { UserInfoRow } from "@/lib/supabase/models";
import type { RoleAccess } from "@/lib/supabase/models";
import { toggleSetValue } from "../lib/directory";
import { createUserEditDraft, hasUserEdits, userEditChanges, type UserEditDraft } from "../lib/user-edit";
import { removeUserProfilePhotoAction, setStudentVerificationAction } from "../user-profile-actions";

interface AdminUsersManagerProps {
  initialUsers: UserRecord[];
  membershipTypes: MembershipTypeOption[];
  canManageUsers: boolean;
}

export function AdminUsersManager({
  initialUsers,
  membershipTypes,
  canManageUsers,
}: AdminUsersManagerProps) {
  const router = useRouter();
  const { refreshUser } = useUser();
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<UserEditDraft | null>(null);
  const editMode = draft !== null;
  const [discardTarget, setDiscardTarget] = useState<"edit" | "close" | null>(null);
  const photoPreview = draft?.photo?.preview;
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);
  const activatingRow = useRef<HTMLTableRowElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const [membershipFilter, setMembershipFilter] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState<Set<RoleAccess>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");
  const [sortOption, setSortOption] = useState<SortOption>("name");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingRole, setPendingRole] = useState<RoleAccess | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const directoryMembershipTypes = useMemo(() => {
    // Editing offers active tiers only; filtering also includes historical tiers.
    const options = new Map(membershipTypes.map((tier) => [tier.id, tier]));
    for (const user of users) {
      if (
        user.membership_type_id &&
        user.membership_type_name &&
        !options.has(user.membership_type_id)
      ) {
        options.set(user.membership_type_id, {
          id: user.membership_type_id,
          name: user.membership_type_name,
        });
      }
    }
    return [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [membershipTypes, users]);
  const filteredUsers = useMemo(() => {
    let filtered = users.filter(
      (user) =>
        (membershipFilter.size === 0 ||
          membershipFilter.has(user.membership_type_id ?? "__none__")) &&
        (roleFilter.size === 0 || roleFilter.has(user.role_access))
    );

    if (searchQuery.trim()) {
      filtered = filtered.filter((user) => {
        const query = searchQuery.trim().toLowerCase();
        return (
          formatUserName(user).toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
        );
      });
    }

    filtered.sort((a, b) => {
      const nameComparison =
        a.last_name.localeCompare(b.last_name) ||
        a.first_name.localeCompare(b.first_name);
      let comparison = nameComparison;
      if (sortOption === "created_at") {
        if (!a.created_at && !b.created_at) return nameComparison;
        if (!a.created_at) return 1;
        if (!b.created_at) return -1;
        comparison = Date.parse(a.created_at) - Date.parse(b.created_at);
      }
      return sortDirection === "ascending" ? comparison : -comparison;
    });

    return filtered;
  }, [users, searchQuery, sortDirection, sortOption, membershipFilter, roleFilter]);

  const commitUser = (saved: UserRecord) => {
    setSelectedUser(saved);
    setUsers((current) => current.map((user) => user.id === saved.id ? saved : user));
  };

  const handleUserSelect = (user: UserRecord, element: HTMLTableRowElement) => {
    activatingRow.current = element;
    setSelectedUser(user);
    setOpen(true);
    setDraft(null);
    setSaveError(null);
  };

  const updateDraft = (changes: Partial<UserEditDraft>) => {
    if (isSaving || !canManageUsers) return;
    setDraft((current) => current ? { ...current, ...changes } : current);
    setSaveError(null);
  };

  const requestClose = () => {
    if (isSaving || pendingRole !== null || discardTarget !== null) return;
    if (selectedUser && draft && hasUserEdits(selectedUser, draft)) {
      setDiscardTarget("close");
    } else {
      setDraft(null);
      setSaveError(null);
      setOpen(false);
    }
  };

  const saveEdits = async () => {
    if (!selectedUser || !draft || !canManageUsers || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    let updated = selectedUser;
    let savedAny = false;
    try {
      const changes = userEditChanges(updated, draft, membershipTypes);
      if (Object.keys(changes).length) {
        const saved = await saveManagerUserDetailsAction(updated.id, changes);
        updated = {
          ...updated, ...saved,
          order_date: saved.order_date_deprecated,
          membership_type_name: saved.membership_type_id === updated.membership_type_id
            ? updated.membership_type_name
            : membershipTypes.find((tier) => tier.id === saved.membership_type_id)?.name ?? null,
        };
        commitUser(updated);
        savedAny = true;
        const savedDraft = createUserEditDraft(updated);
        setDraft((current) => current ? { ...current, fields: savedDraft.fields, birthDate: savedDraft.birthDate, interests: savedDraft.interests, newInterest: "" } : current);
      }
      if (draft.verified !== !!updated.student_verified_at) {
        updated = { ...updated, ...await setStudentVerificationAction(updated.id, draft.verified) };
        commitUser(updated);
        savedAny = true;
      }
      if (draft.photo !== undefined) {
        let saved: UserInfoRow;
        if (draft.photo) {
          const form = new FormData();
          form.set("file", draft.photo.file);
          form.set("expectedPath", updated.profile_photo_path ?? "");
          const response = await fetch(`/api/admin/users/${updated.id}/photo`, { method: "POST", body: form });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Unable to upload photo.");
          saved = data.user;
        } else if (updated.profile_photo_path) {
          saved = await removeUserProfilePhotoAction(updated.id, updated.profile_photo_path);
        } else saved = updated;
        updated = { ...updated, ...saved };
        commitUser(updated);
        savedAny = true;
        setDraft((current) => current ? { ...current, photo: undefined } : current);
      }
      // Run role changes last so a manager editing their own role keeps access until saving finishes.
      if (draft.role !== updated.role_access) {
        const role = await updateUserRoleAction(updated.id, draft.role);
        updated = { ...updated, role_access: role };
        commitUser(updated);
        savedAny = true;
        await refreshUser();
        router.refresh();
      }
      setDraft(null);
      setPendingRole(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save changes. Try again.";
      setSaveError(savedAny ? `Some changes were saved. ${message} Your remaining edits are still here; retry saving to finish.` : message);
    } finally {
      setIsSaving(false);
    }
  };

  const requestSave = () => {
    if (!selectedUser || !draft || isSaving || !canManageUsers) return;
    try {
      userEditChanges(selectedUser, draft, membershipTypes);
      setSaveError(null);
      if (draft.role !== selectedUser.role_access) setPendingRole(draft.role);
      else void saveEdits();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Check the form and try again.");
    }
  };

  const verifier = users.find((user) => user.id === selectedUser?.student_verified_by);

  return (
    <PageContainer className="flex flex-col gap-8">
      <header>
        <h1
          ref={heading}
          tabIndex={-1}
          className="mb-2 text-h1 tracking-tight"
        >
          User Directory
        </h1>
        <p className="text-muted-foreground">Search and manage all users</p>
      </header>
      <UserDirectoryPanel
        users={filteredUsers}
        membershipTypes={directoryMembershipTypes}
        searchQuery={searchQuery}
        sortOption={sortOption}
        sortDirection={sortDirection}
        membershipFilter={membershipFilter}
        roleFilter={roleFilter}
        onSearchQueryChange={setSearchQuery}
        onSortOptionChange={setSortOption}
        onSortDirectionToggle={() =>
          setSortDirection((current) => current === "ascending" ? "descending" : "ascending")
        }
        onMembershipFilterToggle={(value) =>
          setMembershipFilter((current) => toggleSetValue(current, value))
        }
        onRoleFilterToggle={(value) =>
          setRoleFilter((current) => toggleSetValue(current, value))
        }
        onClearFilters={() => {
          setMembershipFilter(new Set());
          setRoleFilter(new Set());
        }}
        onUserSelect={handleUserSelect}
      />
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          mobileFullscreen
          closeDisabled={isSaving || pendingRole !== null || discardTarget !== null}
          className="flex flex-col sm:max-h-[90dvh] sm:max-w-2xl"
          onEscapeKeyDown={(event) => {
            if (isSaving || pendingRole !== null || discardTarget !== null) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (isSaving || pendingRole !== null || discardTarget !== null) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (activatingRow.current?.isConnected) activatingRow.current.focus();
            else heading.current?.focus();
          }}
        >
          <DialogHeader className="shrink-0 space-y-0 border-b pb-5 pl-5 pr-16 pt-16 text-left sm:border-0 sm:p-0 sm:pr-10">
            <DialogTitle asChild className="text-h1">
              <h1>User Information</h1>
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-0 sm:pb-0">
            {saveError && pendingRole === null && <p role="alert" className="mb-4 text-small text-destructive">{saveError}</p>}
            {selectedUser && (
              <UserDetailsPanel
                key={selectedUser.id}
                selectedUser={selectedUser}
                verifierName={verifier ? formatUserName(verifier) : undefined}
                draft={draft}
                onDraftChange={updateDraft}
                isSaving={isSaving}
                membershipTypes={membershipTypes}
                canManageUsers={canManageUsers}
                editMode={editMode}
                headerAction={canManageUsers ? (
                  <div className="flex gap-2">
                    {editMode && <Button type="button" variant="outline" size="icon" className="rounded-full"
                      aria-label="Discard changes" title="Discard changes" disabled={isSaving || pendingRole !== null || discardTarget !== null}
                      onClick={() => setDiscardTarget("edit")}>
                      <X aria-hidden="true" />
                    </Button>}
                    <Button type="button" variant={editMode ? "secondary" : "outline"} size="icon" className="rounded-full"
                      aria-label={editMode ? "Save changes" : "Edit User"} title={editMode ? "Save changes" : "Edit User"}
                      aria-pressed={editMode} disabled={isSaving || pendingRole !== null || discardTarget !== null}
                      onClick={() => {
                        if (editMode) requestSave();
                        else { setSaveError(null); setDraft(createUserEditDraft(selectedUser)); }
                      }}>
                      {editMode ? <Check className="text-success" aria-hidden="true" /> : <Pencil aria-hidden="true" />}
                    </Button>
                  </div>
                ) : undefined}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={pendingRole !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRole(null);
            setSaveError(null);
          }
        }}
        title="Change role access?"
        description={
          selectedUser && pendingRole
            ? `Change ${formatUserName(selectedUser)} from ${selectedUser.role_access} to ${pendingRole}?`
            : "Confirm this role change."
        }
        confirmLabel="Change role"
        pendingLabel="Changing role..."
        confirmVariant={pendingRole === "basic" ? "destructive" : "default"}
        error={saveError}
        pending={isSaving}
        onConfirm={() => void saveEdits()}
      />
      <ConfirmDialog open={discardTarget !== null} onOpenChange={(next) => { if (!next) setDiscardTarget(null); }}
        title="do you want to discard all changes?" description="Your unsaved changes will be discarded."
        confirmLabel="Yes" cancelLabel="No" pending={isSaving}
        onConfirm={() => {
          if (discardTarget === "close") setOpen(false);
          setDraft(null);
          setSaveError(null);
          setDiscardTarget(null);
        }}
      />
    </PageContainer>
  );
}
