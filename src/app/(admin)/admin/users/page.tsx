"use client";

import { useEffect, useState } from "react";
import {
  AdminPageSkeleton,
  AdminSidebar,
  UserDetailsPanel,
  UserDirectoryPanel,
  type MembershipTypeOption,
  type SearchOption,
  type SortOption,
  type UserRecord,
} from "@/features/admin";
import { ProtectedRoute } from "@/features/auth";
import { createClient } from "@/lib/supabase/client";

const AdminUsersManager = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOption, setSearchOption] = useState<SearchOption>("name");
  const [sortOption, setSortOption] = useState<SortOption>("name");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [membershipTypes, setMembershipTypes] = useState<MembershipTypeOption[]>([]);

  useEffect(() => {
    const supabase = createClient();

    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from("user_info")
          .select(
            `
            *,
            membership_types!membership_type_id(name)
          `
          )
          .order("name", { ascending: true });

        if (fetchError) {
          setError(fetchError.message);
        } else {
          const transformedData = (data ?? []).map(
            (user: {
              membership_types: { name: string } | { name: string }[] | null;
              [key: string]: unknown;
            }) => {
              let membershipTypeName: string | null = null;
              if (user.membership_types) {
                if (Array.isArray(user.membership_types)) {
                  membershipTypeName = user.membership_types[0]?.name || null;
                } else {
                  membershipTypeName = user.membership_types.name || null;
                }
              }

              return {
                ...user,
                membership_type_name: membershipTypeName,
              };
            }
          );

          setUsers(transformedData as unknown as UserRecord[]);
          setFilteredUsers(transformedData as unknown as UserRecord[]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    const fetchMembershipTypes = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("membership_types")
          .select("id, name")
          .order("name", { ascending: true });

        if (fetchError) {
          console.error("Error fetching membership types:", fetchError);
        } else {
          setMembershipTypes((data || []) as MembershipTypeOption[]);
        }
      } catch (err) {
        console.error("Error fetching membership types:", err);
      }
    };

    fetchUsers();
    fetchMembershipTypes();
  }, []);

  useEffect(() => {
    let filtered = [...users];

    if (searchQuery.trim()) {
      filtered = filtered.filter((user) => {
        const query = searchQuery.toLowerCase();
        if (searchOption === "name") {
          return user.name.toLowerCase().includes(query);
        }
        return user.email.toLowerCase().includes(query);
      });
    }

    filtered.sort((a, b) => {
      if (sortOption === "name") {
        return a.name.localeCompare(b.name);
      }
      return a.email.localeCompare(b.email);
    });

    setFilteredUsers(filtered);
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
    const supabase = createClient();

    try {
      const updateData: Record<string, string | number | boolean | null> = {
        [field]: editValue,
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

      const { error: updateError } = await supabase
        .from("user_info")
        .update(updateData)
        .eq("email", selectedUser.email);

      if (updateError) throw updateError;

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
    <ProtectedRoute admin loadingFallback={<AdminPageSkeleton />}>
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex-1 overflow-hidden flex">
          <UserDirectoryPanel
            users={filteredUsers}
            selectedUser={selectedUser}
            isLoading={isLoading}
            error={error}
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
      </div>
    </ProtectedRoute>
  );
};

export default AdminUsersManager;
