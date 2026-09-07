"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatMembershipTypeName } from "@/features/memberships/lib/display";
import { parseMembershipPrice } from "@/features/admin/lib/membership-type";
import { updateMembershipTypeAction } from "@/features/admin/actions";
import type { MembershipTypeRow } from "@/types/models";

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

/** The two-decimal string the price input edits. */
function toPriceInput(price: number) {
  return price.toFixed(2);
}

interface TierDraft {
  active: boolean;
  description: string;
  price: string;
}

function toDraft(tier: MembershipTypeRow): TierDraft {
  return {
    active: tier.active,
    description: tier.description,
    price: toPriceInput(Number(tier.price)),
  };
}

function TierEditor({ tier }: { tier: MembershipTypeRow }) {
  const [saved, setSaved] = useState(() => toDraft(tier));
  const [draft, setDraft] = useState(() => toDraft(tier));
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedPrice = parseMembershipPrice(draft.price);
  const priceChanged = draft.price !== saved.price;
  const dirty =
    draft.description !== saved.description ||
    draft.active !== saved.active ||
    priceChanged;

  const update = (patch: Partial<TierDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const commit = async () => {
    if (parsedPrice === null) {
      setError("Enter a valid price.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const next = await updateMembershipTypeAction(tier.id, {
        active: draft.active,
        description: draft.description,
        price: parsedPrice,
      });
      const applied = {
        active: next.active,
        description: next.description,
        price: toPriceInput(next.price),
      };
      setSaved(applied);
      setDraft(applied);
      setConfirming(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save the tier.",
      );
    } finally {
      setPending(false);
    }
  };

  const save = () => {
    // A price change reaches checkouts already in flight, so it gets the same
    // typed challenge the term-end date uses. Copy and availability edits do
    // not move money and save straight away.
    if (priceChanged) {
      setConfirming(true);
      return;
    }
    void commit();
  };

  const descriptionId = `tier-description-${tier.id}`;
  const priceId = `tier-price-${tier.id}`;
  const activeId = `tier-active-${tier.id}`;

  return (
    <div className="space-y-4 rounded-lg border p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-subheading">
          {formatMembershipTypeName(tier.name)}
        </h3>
        <div className="flex items-center gap-2">
          <Label htmlFor={activeId} className="text-small font-normal">
            {draft.active ? "On sale" : "Retired"}
          </Label>
          <Switch
            id={activeId}
            checked={draft.active}
            onCheckedChange={(active) => update({ active })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={descriptionId}>Description</Label>
        <Textarea
          id={descriptionId}
          rows={3}
          value={draft.description}
          onChange={(event) => update({ description: event.target.value })}
        />
        <p className="text-small text-muted-foreground">
          Shown when choosing a membership, on the checkout summary, and on the
          member&rsquo;s card.
        </p>
      </div>

      <div className="max-w-40 space-y-2">
        <Label htmlFor={priceId}>Price (CAD)</Label>
        <Input
          id={priceId}
          inputMode="decimal"
          value={draft.price}
          onChange={(event) => update({ price: event.target.value })}
          aria-invalid={draft.price.trim() !== "" && parsedPrice === null}
        />
      </div>

      {error && <p className="text-small text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button disabled={!dirty || pending} onClick={save}>
          Save changes
        </Button>
        <Button
          variant="outline"
          disabled={!dirty || pending}
          onClick={() => {
            setDraft(saved);
            setError(null);
          }}
        >
          Reset
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(next) => {
          if (next) return;
          setConfirming(false);
          setError(null);
        }}
        icon={<TriangleAlert className="size-4" />}
        title={`Change the ${formatMembershipTypeName(tier.name)} price?`}
        description={
          parsedPrice === null
            ? "Enter a valid price before confirming."
            : `New purchases will be charged ${currency.format(parsedPrice)} instead of ${currency.format(Number(saved.price))}. The amount is read when the payment is taken, so anyone part-way through checkout right now is charged the new price even though their summary shows the old one.`
        }
        confirmation={{
          label: "Confirm the price",
          hint: (
            <>
              Type{" "}
              <span className="font-medium text-foreground">{draft.price}</span>{" "}
              to confirm.
            </>
          ),
          placeholder: "0.00",
          matches: (value) => value.trim() === draft.price.trim(),
          mismatchMessage: "The price does not match.",
        }}
        confirmLabel="Confirm"
        pendingLabel="Saving…"
        confirmVariant="destructive"
        error={error}
        pending={pending}
        onConfirm={() => void commit()}
      />
    </div>
  );
}

export function MembershipTypeSettings({
  membershipTypes,
}: {
  membershipTypes: MembershipTypeRow[];
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-subheading">Membership tiers</h2>
        <p className="max-w-prose text-small text-muted-foreground">
          Edit what each tier says and costs. Turning a tier off leaves existing
          members alone — it only stops new purchases. Tier names and who is
          eligible for them are not editable here.
        </p>
      </div>

      {membershipTypes.length === 0 ? (
        <p className="text-small text-muted-foreground">
          No membership tiers exist yet.
        </p>
      ) : (
        <div className="grid gap-4">
          {membershipTypes.map((tier) => (
            <TierEditor key={tier.id} tier={tier} />
          ))}
        </div>
      )}
    </section>
  );
}
