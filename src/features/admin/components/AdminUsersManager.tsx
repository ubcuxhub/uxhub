"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useUser } from "@/context/UserContext";
import {
  UserDetailsPanel,
  UserDirectoryPanel,
  type MembershipTypeOption,
  type SearchOption,
  type SortOption,
  type UserRecord,
} from "@/features/admin";
import {
  updateManagerUserAction,
  updateUserRoleAction,
} from "@/features/admin/actions";
import { formatUserName } from "@/lib/user-name";
import type { RoleAccess } from "@/types/models";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOption, setSearchOption] = useState<SearchOption>("name");
  const [sortOption, setSortOption] = useState<SortOption>("name");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingRole, setPendingRole] = useState<RoleAccess | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const filteredUsers = useMemo(() => {
    let filtered = [...users];

    if (searchQuery.trim()) {
      filtered = filtered.filter((user) => {
        const query = searchQuery.toLowerCase();
        if (searchOption === "name") {
          return formatUserName(user).toLowerCase().includes(query);
        }
        return user.email.toLowerCase().includes(query);
      });
    }

    filtered.sort((a, b) => {
      if (sortOption === "name") {
        return (
          a.last_name.localeCompare(b.last_name) ||
          a.first_name.localeCompare(b.first_name)
        );
      }
      return a.email.localeCompare(b.email);
    });

    return filtered;
  }, [users, searchQuery, searchOption, sortOption]);

  const handleUserSelect = (user: UserRecord) => {
    setSelectedUser(user);
    setEditingField(null);
    setEditValue("");
  };

  const handleEditStart = (
    field: string,
    currentValue: string | number | boolean | null
  ) => {
    if (!canManageUsers) return;
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
    if (!selectedUser) return;

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
    if (!canManageUsers || !selectedUser || role === selectedUser.role_access) {
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
    <div className="flex min-h-full overflow-hidden">
      <UserDirectoryPanel
        users={filteredUsers}
        selectedUser={selectedUser}
        isLoading={false}
        error={null}
        searchQuery={searchQuery}
        searchOption={searchOption}
        sortOption={sortOption}
        onSearchQueryChange={setSearchQuery}
        onSearchOptionChange={setSearchOption}
        onSortOptionChange={setSortOption}
        onUserSelect={handleUserSelect}
      />
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
    </div>
  );
}
