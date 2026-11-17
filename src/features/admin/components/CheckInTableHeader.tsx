"use client";

import type { CheckInSession } from "../types";

interface CheckInTableHeaderProps {
  sessions: CheckInSession[];
}

export function CheckInTableHeader({ sessions }: CheckInTableHeaderProps) {
  return (
    <thead>
      <tr className="border-b border-border-subtle">
        <th className="px-4 py-3 text-left text-table">Name</th>
        {sessions.map((session) => (
          <th key={session.id} className="px-4 py-3 text-center text-table">
            {session.name}
          </th>
        ))}
        <th className="w-12 px-2 py-3">
          <span className="sr-only">Ticket actions</span>
        </th>
      </tr>
    </thead>
  );
}
