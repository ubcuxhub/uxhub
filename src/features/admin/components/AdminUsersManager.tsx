"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { PageContainer } from "@/components/shared/PageContainer";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  updateManagerUserAction,
  updateUserRoleAction,
} from "@/features/admin/actions";
import { formatUserName } from "@/lib/user-name";
import type { RoleAccess } from "@/lib/supabase/models";
import { toggleSetValue } from "../lib/directory";

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
  const activatingRow = useRef<HTMLTableRowElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const [membershipFilter, setMembershipFilter] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState<Set<RoleAccess>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");
  const [sortOption, setSortOption] = useState<SortOption>("name");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingRole, setPendingRole] = useState<RoleAccess | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
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

  const handleUserSelect = (user: UserRecord, element: HTMLTableRowElement) => {
    activatingRow.current = element;
    setSelectedUser(user);
    setOpen(true);
    setEditingField(null);
    setEditValue("");
  };

  const handleEditStart = (
    field: string,
    currentValue: string | number | boolean | null
  ) => {
    if (!canManageUsers || isSaving) return;
    setEditingField(field);
    if (field === "membership_type_id") {
      setEditValue(currentValue?.toString() || "__none__");
      return;
    }
    setEditValue(currentValue?.toString() ?? "");
  };

  const handleEditCancel = () => {
    setEditingField(null);
    setEditValue("");
  };

  const handleEditSave = async (field: string) => {
    if (!selectedUser || !canManageUsers || isSaving) return;

    setIsSaving(true);

    try {
      const normalizedEditValue =
        field === "first_name" || field === "last_name"
          ? editValue.trim()
          : editValue;
      const updateData: Record<string, string | number | boolean | null> = {
        [field]: normalizedEditValue,
      };

      if (field === "newsletter") {
        updateData[field] = editValue === "true";
      }

      if (field === "student_number" && editValue) {
        updateData[field] = parseInt(editValue, 10) || null;
      }

      if (field === "membership_type_id") {
        if (editValue === "__none__" || editValue === "") {
          updateData.membership_type_id = null;
        } else {
          const membershipType = membershipTypes.find(
            (membership) => membership.id === editValue
          );
          if (membershipType) {
            updateData.membership_type_id = editValue;
          }
        }
      }

      if (!selectedUser.id) {
        throw new Error("The selected user has no id.");
      }

      await updateManagerUserAction(selectedUser.id, field, updateData[field]);

      let updatedUser: UserRecord = {
        ...selectedUser,
        [field]: updateData[field],
      };

      if (field === "membership_type_id") {
        if (editValue === "__none__" || editValue === "") {
          updatedUser = {
            ...updatedUser,
            membership_type_id: null,
            membership_type_name: null,
          };
        } else {
          const membershipType = membershipTypes.find(
            (membership) => membership.id === editValue
          );
          updatedUser = {
            ...updatedUser,
            membership_type_id: editValue || null,
            membership_type_name: membershipType?.name || null,
          };
        }
      }

      setSelectedUser(updatedUser);
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === updatedUser.id ? updatedUser : user
        )
      );
      setEditingField(null);
      setEditValue("");
    } catch (err) {
      console.error("Error updating user:", err);
      alert("Failed to update user. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChangeRequest = (role: RoleAccess) => {
    if (
      !canManageUsers || !selectedUser || isSaving ||
      role === selectedUser.role_access
    ) {
      return;
    }

    setRoleError(null);
    setPendingRole(role);
  };

  const handleRoleChangeConfirm = async () => {
    if (!selectedUser?.id || !pendingRole) return;

    setIsSaving(true);
    setRoleError(null);

    try {
      const role = await updateUserRoleAction(selectedUser.id, pendingRole);
      const updatedUser = { ...selectedUser, role_access: role };

      setSelectedUser(updatedUser);
      setUsers((current) =>
        current.map((user) =>
          user.id === updatedUser.id ? updatedUser : user
        )
      );
      setPendingRole(null);
      await refreshUser();
      router.refresh();
    } catch (error) {
      setRoleError(
        error instanceof Error ? error.message : "Failed to update the role."
      );
    } finally {
      setIsSaving(false);
    }
  };

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
          if (isSaving || pendingRole !== null) return;
          setOpen(next);
          if (!next) handleEditCancel();
        }}
      >
        <DialogContent
          mobileFullscreen
          closeDisabled={isSaving || pendingRole !== null}
          className="flex flex-col sm:max-h-[90dvh] sm:max-w-2xl"
          onEscapeKeyDown={(event) => {
            if (isSaving || pendingRole !== null) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (isSaving || pendingRole !== null) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (activatingRow.current?.isConnected) activatingRow.current.focus();
            else heading.current?.focus();
          }}
        >
          <DialogHeader className="shrink-0 border-b pb-5 pl-5 pr-16 pt-16 text-left sm:border-0 sm:p-0 sm:pr-10">
            <DialogTitle>View User Info</DialogTitle>
            <DialogDescription>
              {canManageUsers
                ? "View and edit user information"
                : "View user information"}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-0 sm:pb-0">
            {open && selectedUser && (
              <UserDetailsPanel
                selectedUser={selectedUser}
                editingField={editingField}
                editValue={editValue}
                isSaving={isSaving}
                membershipTypes={membershipTypes}
                canManageUsers={canManageUsers}
                onEditStart={handleEditStart}
                onEditCancel={handleEditCancel}
                onEditSave={handleEditSave}
                onValueChange={setEditValue}
                onRoleChangeRequest={handleRoleChangeRequest}
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
            setRoleError(null);
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
        error={roleError}
        pending={isSaving}
        onConfirm={() => void handleRoleChangeConfirm()}
      />
    </PageContainer>
  );
}
