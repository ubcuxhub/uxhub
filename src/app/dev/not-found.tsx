import { DocsLink } from "./_shell/context";
import { INDEX_PATH } from "./_shell/nav";

/** An unknown component slug or old `?section=` id, inside the docs shell. */
export default function DevNotFound() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-h1">Not found</h1>
      <p className="text-body text-muted-foreground">
        No component page at this address.{" "}
        <DocsLink
          href={INDEX_PATH}
          className="text-primary underline underline-offset-4"
        >
          See every component
        </DocsLink>
        .
      </p>
    </div>
  );
}
