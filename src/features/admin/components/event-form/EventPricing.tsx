import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

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
    <FieldGroup className="grid gap-4 md:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="regular_price">
          Regular Price <span className="text-destructive">*</span>
        </FieldLabel>
        <Input
          id="regular_price"
          type="number"
          min="0"
          step="0.01"
          value={regular_price}
          onChange={(e) => onFieldChange("regular_price", e.target.value)}
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="member_price">
          Member Price <span className="text-destructive">*</span>
        </FieldLabel>
        <Input
          id="member_price"
          type="number"
          min="0"
          step="0.01"
          value={member_price}
          onChange={(e) => onFieldChange("member_price", e.target.value)}
          required
        />
      </Field>
    </FieldGroup>
  );
};

