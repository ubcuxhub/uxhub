import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { CheckInSessionDraft } from "../../types/checkInTypes";

interface CheckInEventsSectionProps {
  checkInEvents: CheckInSessionDraft[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (
    index: number,
    field: keyof CheckInSessionDraft,
    value: string
  ) => void;
}

export const CheckInEventsSection = ({
  checkInEvents,
  onAdd,
  onRemove,
  onUpdate,
}: CheckInEventsSectionProps) => {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Check-In Sessions</h3>
          <p className="text-sm text-muted-foreground">
            Provide the check-in session details for attendees. Each entry must include
            a name, start time, and end time.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onAdd}
          className="shrink-0"
        >
          Add
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        {checkInEvents.map((item, index) => (
          <div
            key={`check-in-${index}`}
            className="grid gap-3 rounded-lg border p-4"
          >
            <div className="grid gap-2">
              <Label htmlFor={`check_name_${index}`}>
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id={`check_name_${index}`}
                value={item.name}
                onChange={(e) => onUpdate(index, "name", e.target.value)}
                required
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`check_start_time_${index}`}>
                  Start Time <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={`check_start_time_${index}`}
                  type="datetime-local"
                  value={item.start_time}
                  onChange={(e) => onUpdate(index, "start_time", e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`check_end_time_${index}`}>
                  End Time <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={`check_end_time_${index}`}
                  type="datetime-local"
                  value={item.end_time}
                  onChange={(e) => onUpdate(index, "end_time", e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                className="text-red-500 hover:text-red-600"
                onClick={() => onRemove(index)}
                disabled={checkInEvents.length === 1}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
