"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AdminSidebar } from "@/components/AdminSidebar";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/lib/types/membershipTypes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type UserRecord = User & { id?: string };

type SortOption = "name" | "email";

type SearchOption = "name" | "email";

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

  useEffect(() => {
    const supabase = createClient();
    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("user_info")
          .select("*")
          .order("name", { ascending: true });

        if (error) {
          setError(error.message);
        } else {
          setUsers((data ?? []) as UserRecord[]);
          setFilteredUsers((data ?? []) as UserRecord[]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    let filtered = [...users];

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter((user) => {
        const query = searchQuery.toLowerCase();
        if (searchOption === "name") {
          return user.name.toLowerCase().includes(query);
        } else {
          return user.email.toLowerCase().includes(query);
        }
      });
    }

    // Apply sort
    filtered.sort((a, b) => {
      if (sortOption === "name") {
        return a.name.localeCompare(b.name);
      } else {
        return a.email.localeCompare(b.email);
      }
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
    currentValue: string | number | null
  ) => {
    setEditingField(field);
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
      const updateData: Record<string, string | number | null> = {
        [field]: editValue,
      };

      // Convert numeric fields
      if (field === "student_number" && editValue) {
        updateData[field] = parseInt(editValue, 10) || null;
      }

      const { error } = await supabase
        .from("user_info")
        .update(updateData)
        .eq("email", selectedUser.email);

      if (error) throw error;

      // Update local state
      const updatedUser = { ...selectedUser, [field]: updateData[field] };
      setSelectedUser(updatedUser);

      // Update users list
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.email === updatedUser.email ? updatedUser : u))
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

  const renderEditableField = (
    label: string,
    field: string,
    value: string | number | null | undefined
  ) => {
    const isEditing = editingField === field;
    const displayValue = (value ?? null)?.toString() ?? "—";

    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        {isEditing ? (
          <div className="flex gap-2">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1"
              autoFocus
            />
            <Button
              size="sm"
              onClick={() => handleEditSave(field)}
              disabled={isSaving}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleEditCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
            <span className={!value ? "text-muted-foreground" : ""}>
              {displayValue}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleEditStart(field, value ?? null)}
              className="h-6 px-2 text-xs"
            >
              Edit
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <ProtectedRoute admin>
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex-1 overflow-hidden flex">
          {/* Left Column - User Directory */}
          <div className="w-1/2 border-r overflow-y-auto p-6">
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-semibold mb-2">User Directory</h1>
                <p className="text-sm text-muted-foreground">
                  Search and manage all users
                </p>
              </div>

              {/* Search */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder={`Search by ${searchOption}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <select
                    value={searchOption}
                    onChange={(e) =>
                      setSearchOption(e.target.value as SearchOption)
                    }
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="name">Name</option>
                    <option value="email">Email</option>
                  </select>
                </div>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <Label className="text-sm">Sort by:</Label>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="name">Name</option>
                  <option value="email">Email</option>
                </select>
              </div>

              {/* User List */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : error ? (
                <div className="text-center text-sm text-destructive py-8">
                  {error}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No users found
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map((user) => (
                    <Card
                      key={user.email}
                      className={`cursor-pointer transition-colors ${
                        selectedUser?.email === user.email
                          ? "border-primary bg-muted"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => handleUserSelect(user)}
                    >
                      <CardContent className="p-4">
                        <div className="font-semibold">{user.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {user.email}
                        </div>
                        {user.phone && (
                          <div className="text-sm text-muted-foreground">
                            {user.phone}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - User Details */}
          <div className="w-1/2 overflow-y-auto p-6">
            {selectedUser ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">User Details</h2>
                  <p className="text-sm text-muted-foreground">
                    View and edit user information
                  </p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {renderEditableField("Name", "name", selectedUser.name)}
                    {renderEditableField("Email", "email", selectedUser.email)}
                    {renderEditableField("Phone", "phone", selectedUser.phone)}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Membership Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {renderEditableField(
                      "Membership Type",
                      "membership_type",
                      selectedUser.membership_type
                    )}
                    {renderEditableField(
                      "Order Date",
                      "order_date",
                      selectedUser.order_date
                    )}
                    {renderEditableField(
                      "Newsletter",
                      "newsletter",
                      selectedUser.newsletter
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Academic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {renderEditableField(
                      "Student Number",
                      "student_number",
                      selectedUser.student_number
                    )}
                    {renderEditableField(
                      "Faculty",
                      "faculty",
                      selectedUser.faculty
                    )}
                    {renderEditableField("Major", "major", selectedUser.major)}
                    {renderEditableField("Year", "year", selectedUser.year)}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>System Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {renderEditableField(
                      "Role Access",
                      "role_access",
                      selectedUser.role_access
                    )}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Auth User ID
                      </Label>
                      <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                        {selectedUser.auth_user_id}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg font-medium mb-2">No user selected</p>
                  <p className="text-sm">
                    Select a user from the directory to view and edit their
                    information
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default AdminUsersManager;
