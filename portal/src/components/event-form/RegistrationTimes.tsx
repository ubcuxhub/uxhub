import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface RegistrationTimesProps {
  registration_start_time: string;
  registration_end_time: string;
  onFieldChange: <K extends keyof RegistrationTimesState>(
    field: K,
    value: RegistrationTimesState[K]
  ) => void;
}

export interface RegistrationTimesState {
  registration_start_time: string;
  registration_end_time: string;
}

export const RegistrationTimes = ({
  registration_start_time,
  registration_end_time,
  onFieldChange,
}: RegistrationTimesProps) => {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="registration_start_time">Registration Start Time</Label>
        <Input
          id="registration_start_time"
          type="datetime-local"
          value={registration_start_time}
          onChange={(e) => onFieldChange("registration_start_time", e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="registration_end_time">Registration End Time</Label>
        <Input
          id="registration_end_time"
          type="datetime-local"
          value={registration_end_time}
          onChange={(e) => onFieldChange("registration_end_time", e.target.value)}
        />
      </div>
    </section>
  );
};

