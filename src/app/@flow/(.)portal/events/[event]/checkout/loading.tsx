import { Spinner } from "@/components/ui/spinner";

/** Inside the checkout dialog, which the layout keeps open. */
export default function Loading() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center py-16">
      <Spinner size="lg" label="Loading checkout" />
    </div>
  );
}
