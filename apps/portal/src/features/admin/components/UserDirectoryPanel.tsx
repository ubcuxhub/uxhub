"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import type {
  SearchOption,
  SortOption,
  UserRecord,
} from "../types/userManagementTypes";

interface UserDirectoryPanelProps {
  users: UserRecord[];
  selectedUser: UserRecord | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  searchOption: SearchOption;
  sortOption: SortOption;
  onSearchQueryChange: (value: string) => void;
  onSearchOptionChange: (value: SearchOption) => void;
  onSortOptionChange: (value: SortOption) => void;
  onUserSelect: (user: UserRecord) => void;
}

export function UserDirectoryPanel({
  users,
  selectedUser,
  isLoading,
  error,
  searchQuery,
  searchOption,
  sortOption,
  onSearchQueryChange,
  onSearchOptionChange,
  onSortOptionChange,
  onUserSelect,
}: UserDirectoryPanelProps) {
  return (
    <div className="w-1/2 border-r overflow-y-auto p-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold mb-2">User Directory</h1>
          <p className="text-sm text-muted-foreground">
            Search and manage all users
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder={`Search by ${searchOption}...`}
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="flex-1"
            />
            <select
              value={searchOption}
              onChange={(e) => onSearchOptionChange(e.target.value as SearchOption)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="name">Name</option>
              <option value="email">Email</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm">Sort by:</Label>
          <select
            value={sortOption}
            onChange={(e) => onSortOptionChange(e.target.value as SortOption)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="name">Name</option>
            <option value="email">Email</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="text-center text-sm text-destructive py-8">{error}</div>
        ) : users.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No users found
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <Card
                key={user.email}
                className={`cursor-pointer transition-colors ${
                  selectedUser?.email === user.email
                    ? "border-primary bg-muted"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => onUserSelect(user)}
              >
                <CardContent className="p-4">
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                  {user.phone && (
                    <div className="text-sm text-muted-foreground">{user.phone}</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
