"use client";

import type { CheckInSession } from "../types/checkInTypes";

interface CheckInTableHeaderProps {
  sessions: CheckInSession[];
}

export function CheckInTableHeader({ sessions }: CheckInTableHeaderProps) {
  return (
    <thead>
      <tr className="border-b">
        <th className="px-4 py-3 text-left text-table">Name</th>
        {sessions.map((session) => (
          <th key={session.id} className="px-4 py-3 text-center text-table">
            {session.name}
          </th>
        ))}
      </tr>
    </thead>
  );
}
