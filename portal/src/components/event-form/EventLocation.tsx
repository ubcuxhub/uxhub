import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface EventLocationProps {
  location_building: string;
  location_room: string;
  location_address_url: string;
  onFieldChange: <K extends keyof EventLocationState>(
    field: K,
    value: EventLocationState[K]
  ) => void;
}

export interface EventLocationState {
  location_building: string;
  location_room: string;
  location_address_url: string;
}

export const EventLocation = ({
  location_building,
  location_room,
  location_address_url,
  onFieldChange,
}: EventLocationProps) => {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="location_building">Location Building</Label>
        <Input
          id="location_building"
          value={location_building}
          onChange={(e) => onFieldChange("location_building", e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="location_room">Location Room</Label>
        <Input
          id="location_room"
          value={location_room}
          onChange={(e) => onFieldChange("location_room", e.target.value)}
        />
      </div>
      <div className="grid gap-2 md:col-span-2">
        <Label htmlFor="location_address_url">Location Address URL</Label>
        <Input
          id="location_address_url"
          type="url"
          value={location_address_url}
          onChange={(e) => onFieldChange("location_address_url", e.target.value)}
        />
      </div>
    </section>
  );
};

