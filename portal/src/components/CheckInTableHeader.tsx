"use client";

import type { CheckInSession } from "@/lib/utils/fetchCheckInData";

interface CheckInTableHeaderProps {
  sessions: CheckInSession[];
}

export function CheckInTableHeader({ sessions }: CheckInTableHeaderProps) {
  return (
    <thead>
      <tr className="border-b">
        <th className="px-4 py-3 text-left font-semibold">Name</th>
        {sessions.map((session) => (
          <th key={session.id} className="px-4 py-3 text-center font-semibold">
            {session.name}
          </th>
        ))}
      </tr>
    </thead>
  );
}

