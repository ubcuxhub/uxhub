import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface EventScheduleProps {
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  onFieldChange: <K extends keyof EventScheduleState>(
    field: K,
    value: EventScheduleState[K]
  ) => void;
}

export interface EventScheduleState {
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
}

export const EventSchedule = ({
  start_date,
  start_time,
  end_date,
  end_time,
  onFieldChange,
}: EventScheduleProps) => {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="start_date">Start Date</Label>
        <Input
          id="start_date"
          type="date"
          value={start_date}
          onChange={(e) => onFieldChange("start_date", e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="start_time">Start Time</Label>
        <Input
          id="start_time"
          type="time"
          value={start_time}
          onChange={(e) => onFieldChange("start_time", e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="end_date">End Date</Label>
        <Input
          id="end_date"
          type="date"
          value={end_date}
          onChange={(e) => onFieldChange("end_date", e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="end_time">End Time</Label>
        <Input
          id="end_time"
          type="time"
          value={end_time}
          onChange={(e) => onFieldChange("end_time", e.target.value)}
        />
      </div>
    </section>
  );
};

