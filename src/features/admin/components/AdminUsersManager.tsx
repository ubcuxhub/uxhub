"use client";

import { useMemo, useState } from "react";
import {
  UserDetailsPanel,
  UserDirectoryPanel,
  type MembershipTypeOption,
  type SearchOption,
  type SortOption,
  type UserRecord,
} from "@/features/admin";
import { updateAdminUserAction } from "@/features/admin/actions";
import { formatUserName } from "@/lib/user-name";

interface AdminUsersManagerProps {
  initialUsers: UserRecord[];
  membershipTypes: MembershipTypeOption[];
}

export function AdminUsersManager({
  initialUsers,
  membershipTypes,
}: AdminUsersManagerProps) {
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOption, setSearchOption] = useState<SearchOption>("name");
  const [sortOption, setSortOption] = useState<SortOption>("name");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
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
          const membershipType = membershipTypes.find((mt) => mt.id === editValue);
          if (membershipType) {
            updateData.membership_type_id = editValue;
          }
        }
      }

      if (!selectedUser.id) {
        throw new Error("The selected user has no id.");
      }

      await updateAdminUserAction(
        selectedUser.id,
        field,
        updateData[field]
      );

      let updatedUser: UserRecord = { ...selectedUser, [field]: updateData[field] };

      if (field === "membership_type_id") {
        if (editValue === "__none__" || editValue === "") {
          updatedUser = {
            ...updatedUser,
            membership_type_id: null,
            membership_type_name: null,
          };
        } else {
          const membershipType = membershipTypes.find((mt) => mt.id === editValue);
          updatedUser = {
            ...updatedUser,
            membership_type_id: editValue || null,
            membership_type_name: membershipType?.name || null,
          };
        }
      }

      setSelectedUser(updatedUser);
      setUsers((prevUsers) =>
        prevUsers.map((user) => (user.email === updatedUser.email ? updatedUser : user))
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
            onEditStart={handleEditStart}
            onEditCancel={handleEditCancel}
            onEditSave={handleEditSave}
            onValueChange={setEditValue}
          />
    </div>
  );
}
