import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface EventPricingProps {
  regular_price: string;
  member_price: string;
  onFieldChange: <K extends keyof EventPricingState>(
    field: K,
    value: EventPricingState[K]
  ) => void;
}

export interface EventPricingState {
  regular_price: string;
  member_price: string;
}

export const EventPricing = ({
  regular_price,
  member_price,
  onFieldChange,
}: EventPricingProps) => {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="regular_price">
          Regular Price <span className="text-red-500">*</span>
        </Label>
        <Input
          id="regular_price"
          type="number"
          min="0"
          step="0.01"
          value={regular_price}
          onChange={(e) => onFieldChange("regular_price", e.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="member_price">
          Member Price <span className="text-red-500">*</span>
        </Label>
        <Input
          id="member_price"
          type="number"
          min="0"
          step="0.01"
          value={member_price}
          onChange={(e) => onFieldChange("member_price", e.target.value)}
          required
        />
      </div>
    </section>
  );
};

