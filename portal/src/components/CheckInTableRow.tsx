"use client";

import type { AttendingRegistration, CheckInSession } from "@/lib/utils/fetchCheckInData";
import { CheckInTableCell } from "./CheckInTableCell";

interface CheckInTableRowProps {
  registration: AttendingRegistration;
  sessions: CheckInSession[];
  checkInStatuses: Map<string, string | null>;
  onToggle: (registrationId: string, sessionId: string, currentlyChecked: boolean) => void;
  updatingCells: Set<string>;
}

export function CheckInTableRow({
  registration,
  sessions,
  checkInStatuses,
  onToggle,
  updatingCells,
}: CheckInTableRowProps) {
  return (
    <tr className="border-b hover:bg-muted/50">
      <td className="px-4 py-3 font-medium">{registration.user_name}</td>
      {sessions.map((session) => {
        const key = `${registration.id}_${session.id}`;
        const checkedInAt = checkInStatuses.get(key);
        const checked = checkedInAt !== null && checkedInAt !== undefined;
        const isUpdating = updatingCells.has(key);

        return (
          <CheckInTableCell
            key={session.id}
            registrationId={registration.id}
            sessionId={session.id}
            checked={checked}
            onToggle={onToggle}
            isUpdating={isUpdating}
          />
        );
      })}
    </tr>
  );
}

