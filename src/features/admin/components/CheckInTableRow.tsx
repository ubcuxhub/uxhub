"use client";

import type {
  CheckInAttendee,
  CheckInSession,
} from "../types";
import { CheckInTableCell } from "./CheckInTableCell";

interface CheckInTableRowProps {
  attendee: CheckInAttendee;
  sessions: CheckInSession[];
  checkInStatuses: Map<string, string | null>;
  onToggle: (ticketId: string, sessionId: string, currentlyChecked: boolean) => void;
  updatingCells: Set<string>;
}

export function CheckInTableRow({
  attendee,
  sessions,
  checkInStatuses,
  onToggle,
  updatingCells,
}: CheckInTableRowProps) {
  return (
    <tr className="border-b hover:bg-muted/50">
      <td className="px-4 py-3 text-table">{attendee.user_name}</td>
      {sessions.map((session) => {
        const key = `${attendee.id}_${session.id}`;
        const checkedInAt = checkInStatuses.get(key);
        const checked = checkedInAt !== null && checkedInAt !== undefined;
        const isUpdating = updatingCells.has(key);

        return (
          <CheckInTableCell
            key={session.id}
            ticketId={attendee.id}
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
