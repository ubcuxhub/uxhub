"use client";
import { FACULTIES, YEAR_LEVELS } from "@/lib/constants";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
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
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const supabase = createClient();

const Profile = () => {
  const { user, refreshUser } = useUser();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    student_number: "",
    faculty: "",
    major: "",
    year: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        phone: user.phone || "",
        student_number: user.student_number?.toString() || "",
        faculty: user.faculty || "",
        major: user.major || "",
        year: user.year || "",
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("user_info")
        .update({
          name: formData.name,
          phone: formData.phone,
          student_number: formData.student_number
            ? parseInt(formData.student_number)
            : null,
          faculty: formData.faculty || null,
          major: formData.major || null,
          year: formData.year || null,
        })
        .eq("auth_user_id", user.auth_user_id);

      if (error) throw error;

      await refreshUser();
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    }
  };

  if (!user) return null;

  return (
    <ProtectedRoute>
      <div className="container mx-auto max-w-2xl py-10 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">My Profile</h1>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Membership</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/memberships")}
            >
              Manage
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Type</Label>
                <div className="font-medium capitalize">
                  {user.membership_type || "None"}
                </div>
              </div>
              {user.role_access === "admin" && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Role Access</Label>
                  <div className="font-medium capitalize">
                    {user.role_access}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Profile Information</CardTitle>
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  Save
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="grid gap-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Name</Label>
                {isEditing ? (
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    onKeyDown={handleKeyDown}
                  />
                ) : (
                  <div className="font-medium min-h-10 flex items-center">
                    {user.name}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Email</Label>
                <div
                  className={cn(
                    "font-medium min-h-10 flex items-center",
                    isEditing && "text-muted-foreground/80"
                  )}
                >
                  {user.email}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Phone</Label>
                {isEditing ? (
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    onKeyDown={handleKeyDown}
                  />
                ) : (
                  <div className="font-medium min-h-10 flex items-center">
                    {user.phone}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Student Number</Label>
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
                  <div className="font-medium min-h-10 flex items-center">
                    {user.student_number || "-"}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Faculty</Label>
                {isEditing ? (
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
                ) : (
                  <div className="font-medium min-h-10 flex items-center">
                    {user.faculty || "-"}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Major</Label>
                {isEditing ? (
                  <Input
                    value={formData.major}
                    onChange={(e) =>
                      setFormData({ ...formData, major: e.target.value })
                    }
                    onKeyDown={handleKeyDown}
                  />
                ) : (
                  <div className="font-medium min-h-10 flex items-center">
                    {user.major || "-"}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Year</Label>
                {isEditing ? (
                  <Select
                    value={formData.year}
                    onValueChange={(value: string) =>
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
                ) : (
                  <div className="font-medium min-h-10 flex items-center">
                    {user.year || "-"}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
};

export default Profile;
