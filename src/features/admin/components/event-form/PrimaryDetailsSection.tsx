"use client";

import { ImageUpload } from "@/components/shared/ImageUpload";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PublicationPicker } from "./PublicationPicker";
import { EventSchedule } from "./EventSchedule";
import { RegistrationTimes } from "./RegistrationTimes";
import {
  isFreePricing,
  type EventFormState,
} from "./event-form-schema";

interface PrimaryDetailsSectionProps {
  formState: EventFormState;
  isSubmitting: boolean;
  onImageFileChange: (file: File | null) => void;
  onFieldChange: <K extends keyof EventFormState>(
    field: K,
    value: EventFormState[K]
  ) => void;
}

const required = <span className="text-destructive">*</span>;

export function PrimaryDetailsSection({
  formState,
  isSubmitting,
  onImageFileChange,
  onFieldChange,
}: PrimaryDetailsSectionProps) {
  const isFree = isFreePricing(
    formState.regular_price,
    formState.member_price
  );

  const setFree = (checked: boolean) => {
    onFieldChange("regular_price", checked ? "0" : "");
    onFieldChange("member_price", checked ? "0" : "");
  };

  return (
    <FieldSet className="gap-4">
      <FieldLegend>Primary Details</FieldLegend>
      <div className="grid gap-6 rounded-xl border bg-card p-5 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.4fr)]">
        <FieldGroup className="content-start gap-4">
          <ImageUpload
            value={formState.image_url}
            onChange={(value) => onFieldChange("image_url", value)}
            onFileChange={onImageFileChange}
            disabled={isSubmitting}
          />
          <Field>
            <FieldLabel htmlFor="event_status">Event Status</FieldLabel>
            <Select
              value={formState.status}
              onValueChange={(value) =>
                onFieldChange("status", value as EventFormState["status"])
              }
            >
              <SelectTrigger id="event_status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  {/* Archiving is going away (docs/registration-rollout.md).
                      An event archived before then still shows its status,
                      but nothing else can be moved to it. */}
                  {formState.status === "archived" && (
                    <SelectItem value="archived" disabled>
                      Archived
                    </SelectItem>
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <PublicationPicker
            value={formState.publish_at}
            onChange={(value) => onFieldChange("publish_at", value)}
            disabled={isSubmitting || formState.status !== "draft"}
          />
          <Field>
            <FieldLabel htmlFor="event_type">Event Type</FieldLabel>
            <Select
              value={formState.event_type}
              onValueChange={(value) =>
                onFieldChange("event_type", value as EventFormState["event_type"])
              }
            >
              <SelectTrigger id="event_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="flagship">Flagship</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="regular_price">Regular Price {required}</FieldLabel>
            <Input
              id="regular_price"
              type="number"
              min="0"
              step="0.01"
              value={formState.regular_price}
              onChange={(event) =>
                onFieldChange("regular_price", event.target.value)
              }
              disabled={isFree}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="member_price">Member Price {required}</FieldLabel>
            <Input
              id="member_price"
              type="number"
              min="0"
              step="0.01"
              value={formState.member_price}
              onChange={(event) =>
                onFieldChange("member_price", event.target.value)
              }
              disabled={isFree}
              required
            />
          </Field>
          <div className="flex items-center gap-2">
            <Switch
              id="free_event"
              checked={isFree}
              onCheckedChange={setFree}
            />
            <FieldLabel htmlFor="free_event">Free</FieldLabel>
          </div>
          <Field>
            <FieldLabel htmlFor="max_capacity">Max Capacity {required}</FieldLabel>
            <Input
              id="max_capacity"
              type="number"
              min="1"
              value={formState.max_capacity}
              onChange={(event) =>
                onFieldChange("max_capacity", event.target.value)
              }
              required
            />
          </Field>
        </FieldGroup>

        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="event_name">Event Name {required}</FieldLabel>
            <Input
              id="event_name"
              value={formState.name}
              onChange={(event) => onFieldChange("name", event.target.value)}
              required
            />
          </Field>
          <EventSchedule
            starts_at={formState.starts_at}
            ends_at={formState.ends_at}
            onFieldChange={onFieldChange}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="location_building">Location Building</FieldLabel>
              <Input
                id="location_building"
                value={formState.location_building}
                onChange={(event) =>
                  onFieldChange("location_building", event.target.value)
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="location_room">Location Room</FieldLabel>
              <Input
                id="location_room"
                value={formState.location_room}
                onChange={(event) =>
                  onFieldChange("location_room", event.target.value)
                }
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="location_address_url">
              Location Address URL
            </FieldLabel>
            <Input
              id="location_address_url"
              type="url"
              value={formState.location_address_url}
              onChange={(event) =>
                onFieldChange("location_address_url", event.target.value)
              }
            />
          </Field>
          <RegistrationTimes
            registration_opens_at={formState.registration_opens_at}
            registration_closes_at={formState.registration_closes_at}
            onFieldChange={onFieldChange}
          />
          <Field>
            <FieldLabel htmlFor="short_description">
              Short Description {required}
            </FieldLabel>
            <Textarea
              id="short_description"
              maxLength={180}
              value={formState.short_description}
              onChange={(event) =>
                onFieldChange("short_description", event.target.value)
              }
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="description">Full Description {required}</FieldLabel>
            <Textarea
              id="description"
              className="min-h-36"
              value={formState.description}
              onChange={(event) =>
                onFieldChange("description", event.target.value)
              }
              required
            />
          </Field>
        </FieldGroup>
      </div>
    </FieldSet>
  );
}
