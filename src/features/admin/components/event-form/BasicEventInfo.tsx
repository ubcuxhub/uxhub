import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/shared/ImageUpload";

interface BasicEventInfoProps {
  name: string;
  description: string;
  max_capacity: string;
  image_url: string;
  isSubmitting: boolean;
  onImageFileChange?: (file: File | null) => void;
  onFieldChange: <K extends keyof BasicEventInfoState>(
    field: K,
    value: BasicEventInfoState[K]
  ) => void;
}

export interface BasicEventInfoState {
  name: string;
  description: string;
  max_capacity: string;
  image_url: string;
}

export const BasicEventInfo = ({
  name,
  description,
  max_capacity,
  image_url,
  isSubmitting,
  onImageFileChange,
  onFieldChange,
}: BasicEventInfoProps) => {
  return (
    <FieldGroup className="grid gap-4 md:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="name">
          Event Name <span className="text-destructive">*</span>
        </FieldLabel>
        <Input
          id="name"
          value={name}
          onChange={(e) => onFieldChange("name", e.target.value)}
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="max_capacity">
          Max Capacity <span className="text-destructive">*</span>
        </FieldLabel>
        <Input
          id="max_capacity"
          type="number"
          min="0"
          value={max_capacity}
          onChange={(e) => onFieldChange("max_capacity", e.target.value)}
          required
        />
      </Field>
      <Field className="md:col-span-2">
        <ImageUpload
          value={image_url}
          onChange={(path) => onFieldChange("image_url", path)}
          onFileChange={onImageFileChange}
          disabled={isSubmitting}
        />
      </Field>
      <Field className="md:col-span-2">
        <FieldLabel htmlFor="description">
          Description <span className="text-destructive">*</span>
        </FieldLabel>
        <Textarea
          id="description"
          className="min-h-[120px]"
          value={description}
          onChange={(e) => onFieldChange("description", e.target.value)}
          required
        />
      </Field>
    </FieldGroup>
  );
};
