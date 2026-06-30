"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FACULTIES, YEAR_LEVELS } from "@/lib/constants";

export interface AuthProfileFormData {
  email: string;
  name: string;
  phone: string;
  studentNumber: string;
  faculty: string;
  major: string;
  year: string;
}

interface AuthProfileFieldsProps {
  emailReadOnly?: boolean;
  formData: AuthProfileFormData;
  onChange: (field: keyof AuthProfileFormData, value: string) => void;
}

export function AuthProfileFields({
  emailReadOnly = false,
  formData,
  onChange,
}: AuthProfileFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          placeholder="John Doe"
          required
          value={formData.name}
          onChange={(e) => onChange("name", e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          placeholder="m@example.com"
          required
          readOnly={emailReadOnly}
          value={formData.email}
          onChange={(e) => onChange("email", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => onChange("phone", e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="student-number">Student Number</Label>
          <Input
            id="student-number"
            type="number"
            value={formData.studentNumber}
            onChange={(e) => onChange("studentNumber", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="faculty">Faculty</Label>
          <Select
            value={formData.faculty}
            onValueChange={(value: string) => onChange("faculty", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select faculty" />
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
        <div className="grid gap-2">
          <Label htmlFor="year">Year</Label>
          <Select
            value={formData.year}
            onValueChange={(value: string) => onChange("year", value)}
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
      </div>

      <div className="grid gap-2">
        <Label htmlFor="major">Major</Label>
        <Input
          id="major"
          value={formData.major}
          onChange={(e) => onChange("major", e.target.value)}
        />
      </div>
    </div>
  );
}
