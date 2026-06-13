import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

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
    <FieldGroup className="grid gap-4 md:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="location_building">Location Building</FieldLabel>
        <Input
          id="location_building"
          value={location_building}
          onChange={(e) => onFieldChange("location_building", e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="location_room">Location Room</FieldLabel>
        <Input
          id="location_room"
          value={location_room}
          onChange={(e) => onFieldChange("location_room", e.target.value)}
        />
      </Field>
      <Field className="md:col-span-2">
        <FieldLabel htmlFor="location_address_url">
          Location Address URL
        </FieldLabel>
        <Input
          id="location_address_url"
          type="url"
          value={location_address_url}
          onChange={(e) => onFieldChange("location_address_url", e.target.value)}
        />
      </Field>
    </FieldGroup>
  );
};

