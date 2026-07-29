"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";

interface CheckInTableCellProps {
  registrationId: string;
  sessionId: string;
  checked: boolean;
  onToggle: (registrationId: string, sessionId: string, currentlyChecked: boolean) => void;
  isUpdating: boolean;
}

export function CheckInTableCell({
  registrationId,
  sessionId,
  checked,
  onToggle,
  isUpdating,
}: CheckInTableCellProps) {
  return (
    <td className="px-4 py-3 text-center text-table">
      <div className="flex items-center justify-center">
        {isUpdating ? (
          <Spinner size="sm" />
        ) : (
          <Checkbox
            checked={checked}
            onCheckedChange={() => onToggle(registrationId, sessionId, checked)}
            disabled={isUpdating}
            className="rounded"
          />
        )}
      </div>
    </td>
  );
}
