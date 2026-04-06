import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/shared/ImageUpload";

interface BasicEventInfoProps {
  name: string;
  description: string;
  max_capacity: string;
  image_url: string;
  isSubmitting: boolean;
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
  onFieldChange,
}: BasicEventInfoProps) => {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="name">
          Event Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => onFieldChange("name", e.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="max_capacity">
          Max Capacity <span className="text-red-500">*</span>
        </Label>
        <Input
          id="max_capacity"
          type="number"
          min="0"
          value={max_capacity}
          onChange={(e) => onFieldChange("max_capacity", e.target.value)}
          required
        />
      </div>
      <div className="grid gap-2 md:col-span-2">
        <ImageUpload
          value={image_url}
          onChange={(path) => onFieldChange("image_url", path)}
          eventName={name || "event"}
          disabled={isSubmitting}
        />
      </div>
      <div className="grid gap-2 md:col-span-2">
        <Label htmlFor="description">
          Description <span className="text-red-500">*</span>
        </Label>
        <textarea
          id="description"
          className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={description}
          onChange={(e) => onFieldChange("description", e.target.value)}
          required
        />
      </div>
    </section>
  );
};
