"use client";

import { Input } from "@/components/ui/input";
import type {
  AttendingRegistration,
  CheckInSession,
} from "../types/checkInTypes";
import { CheckInTableHeader } from "./CheckInTableHeader";
import { CheckInTableRow } from "./CheckInTableRow";

interface CheckInTableProps {
  sessions: CheckInSession[];
  registrations: AttendingRegistration[];
  filteredRegistrations: AttendingRegistration[];
  checkInStatuses: Map<string, string | null>;
  onToggle: (registrationId: string, sessionId: string, currentlyChecked: boolean) => void;
  updatingCells: Set<string>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function CheckInTable({
  sessions,
  registrations,
  filteredRegistrations,
  checkInStatuses,
  onToggle,
  updatingCells,
  searchQuery,
  onSearchChange,
}: CheckInTableProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-md"
        />
      </div>

      {filteredRegistrations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {registrations.length === 0
            ? "No users registered for the event"
            : "No users match your search criteria."}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full">
            <CheckInTableHeader sessions={sessions} />
            <tbody>
              {filteredRegistrations.map((registration) => (
                <CheckInTableRow
                  key={registration.id}
                  registration={registration}
                  sessions={sessions}
                  checkInStatuses={checkInStatuses}
                  onToggle={onToggle}
                  updatingCells={updatingCells}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
