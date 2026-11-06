"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { History, SearchX } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DetailList, DetailRow } from "@/components/shared/DetailRow";
import { PageContainer } from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  SidePeekDrawer,
  SidePeekDrawerBody,
  SidePeekDrawerContent,
  SidePeekDrawerFooter,
  SidePeekDrawerHeader,
  SidePeekDrawerTitle,
  useSidePeekDrawerControls,
} from "@/components/ui/side-peek-drawer";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { loadDocument } from "@/lib/load-document";
import { cn } from "@/lib/utils";

/*
 * A record (a user, an event) that opens two ways from one URL:
 *
 * - `intercepted`: a soft navigation from inside the app, caught by
 *   `src/app/@flow/(.)admin/...`. The record opens in a SidePeekDrawer beside
 *   the list, which stays mounted behind it. Closing is `router.back()`.
 * - `canonical`: a direct load or refresh of the same URL, served by
 *   `src/app/(app)/(shell)/admin/...`. The record is a page with a back pill.
 *
 * The route picks the mode by wrapping its content in `RecordFrame`; the
 * content (`RecordView` and its sections and fields) is the same in both and
 * never branches on mode.
 */

type RecordFrameMode = "intercepted" | "canonical";

interface RecordFrameContextValue {
  mode: RecordFrameMode;
  /** Reports unsaved changes. `RecordView` does this from its `dirty` prop. */
  setDirty: (dirty: boolean) => void;
  /**
   * Leaves the record, asking first when there are unsaved changes: back to
   * wherever the drawer opened from, or to the list from the full page.
   */
  close: () => void;
  /**
   * Leaves for `href`, asking first when there are unsaved changes. The
   * record's own URL reloads as a full page; another record under the list
   * replaces this one (so Back still returns to the list); anything else is
   * pushed.
   */
  navigate: (href: string) => void;
}

const RecordFrameContext = React.createContext<RecordFrameContextValue | null>(null);

/** The surrounding `RecordFrame`: its mode, and how to close, navigate and report unsaved changes. */
export function useRecordFrame() {
  const context = React.useContext(RecordFrameContext);
  if (!context) throw new Error("Record parts must be inside RecordFrame");
  return context;
}

const DISCARD_COPY = {
  title: "Discard changes?",
  description: "Your unsaved changes will be lost.",
  cancelLabel: "Keep editing",
  confirmLabel: "Discard changes",
} as const;

/** Escapes a path for use inside a RegExp. */
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Leaves for `href` without asking (the caller already has): the navigation
 * rules `navigate` documents.
 */
function useLeave(mode: RecordFrameMode, listHref: string) {
  const router = useRouter();
  const pathname = usePathname();
  return React.useCallback(
    (href: string) => {
      const url = new URL(href, window.location.href);
      const path = `${url.pathname}${url.search}${url.hash}`;
      // Another site, or this record's own URL: a soft navigation would be
      // intercepted straight back into the drawer, so load the document.
      if (url.origin !== window.location.origin) return loadDocument(url.href);
      if (url.pathname === pathname) return loadDocument(path);
      const record = new RegExp(`^${escapeRegExp(listHref.replace(/\/$/, ""))}/[^/]+$`).test(url.pathname);
      if (!record) return router.push(path);
      // From the full page a soft navigation to another record would open a
      // drawer over this page, so load that record's page instead.
      if (mode === "canonical") return loadDocument(path);
      router.replace(path);
    },
    [listHref, mode, pathname, router],
  );
}

export interface RecordFrameProps {
  mode: RecordFrameMode;
  /** The list the record belongs to, e.g. `/admin/users`. Records are its direct children. */
  listHref: string;
  /** The list's name for the back pill: "Back to Manage Users". */
  listLabel: string;
  /**
   * Replaces the default close: `router.back()` in a drawer, the list in a
   * page. For demos and tests; routes leave it unset.
   */
  onClose?: () => void;
  children: React.ReactNode;
}

/**
 * The shell a record route renders into. Put it in the intercepted route's
 * `layout.tsx` (so swapping records keeps the drawer open instead of
 * replaying its slide-in) and around the canonical page's content.
 *
 * While the content reports unsaved changes, leaving any way the app can see
 * (closing, a link anywhere on the page, the back pill, reload) asks
 * "Discard changes?" first. Browser Back can't be held back.
 */
export function RecordFrame({ mode, ...props }: RecordFrameProps) {
  return mode === "intercepted" ? <InterceptedFrame {...props} /> : <CanonicalFrame {...props} />;
}

type FrameProps = Omit<RecordFrameProps, "mode">;

function InterceptedFrame({ listHref, onClose, children }: FrameProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(true);
  const [dirty, setDirty] = React.useState(false);
  const leave = useLeave("intercepted", listHref);

  const close = () => {
    setOpen(false);
    if (onClose) onClose();
    else router.back();
  };

  return (
    <SidePeekDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      dirty={dirty}
      onNavigate={leave}
      guardNavigation
    >
      <SidePeekDrawerContent aria-describedby={undefined}>
        <InterceptedFrameContext setDirty={setDirty} leave={leave}>
          {children}
        </InterceptedFrameContext>
      </SidePeekDrawerContent>
    </SidePeekDrawer>
  );
}

/** Inside the drawer, where its close and discard confirmation are reachable. */
function InterceptedFrameContext({
  setDirty,
  leave,
  children,
}: {
  setDirty: (dirty: boolean) => void;
  leave: (href: string) => void;
  children: React.ReactNode;
}) {
  const { requestClose, requestNavigate, dirty } = useSidePeekDrawerControls();
  const value: RecordFrameContextValue = {
    mode: "intercepted",
    setDirty,
    close: requestClose,
    navigate: (href) => (dirty ? requestNavigate(href) : leave(href)),
  };
  return <RecordFrameContext.Provider value={value}>{children}</RecordFrameContext.Provider>;
}

type PendingLeave = { kind: "close" } | { kind: "navigate"; href: string };

function CanonicalFrame({ listHref, listLabel, onClose, children }: FrameProps) {
  const [dirty, setDirty] = React.useState(false);
  const [pending, setPending] = React.useState<PendingLeave | null>(null);
  const leave = useLeave("canonical", listHref);
  const guard = useNavigationGuard({
    when: dirty,
    onBlocked: (href) => setPending({ kind: "navigate", href }),
  });

  const closeNow = () => {
    if (onClose) onClose();
    else leave(listHref);
  };

  const value: RecordFrameContextValue = {
    mode: "canonical",
    setDirty,
    close: () => (dirty ? setPending({ kind: "close" }) : closeNow()),
    navigate: (href) => (dirty ? setPending({ kind: "navigate", href }) : leave(href)),
  };

  return (
    <RecordFrameContext.Provider value={value}>
      <PageContainer backHref={listHref} backLabel={listLabel}>
        {children}
      </PageContainer>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(next) => {
          if (!next) setPending(null);
        }}
        {...DISCARD_COPY}
        onConfirm={() => {
          const leaving = pending;
          setPending(null);
          guard.release();
          if (leaving?.kind === "navigate") leave(leaving.href);
          else if (leaving) closeNow();
        }}
      />
    </RecordFrameContext.Provider>
  );
}

// --- View -------------------------------------------------------------------

const RecordViewContext = React.createContext<{ editing: boolean }>({ editing: false });

export interface RecordViewProps {
  /** The record's own URL: "Open as full page" in the drawer. */
  recordHref: string;
  /** The record's name. The drawer focuses it on open. */
  title: React.ReactNode;
  /** Beside the title: a verified icon, pronouns. */
  titleAdornment?: React.ReactNode;
  /** Under the title: "User since July 21, 2026". */
  subtitle?: React.ReactNode;
  /** Beside the identity, before the title: an Avatar. */
  media?: React.ReactNode;
  /** Full width above the identity: an event's 16:9 cover. */
  cover?: React.ReactNode;
  /** Under the subtitle: status Badges. */
  status?: React.ReactNode;
  /** Header buttons ("Edit user"). Hidden while editing, when the footer takes over. */
  actions?: React.ReactNode;
  /** The Details tab: `RecordSection`s. */
  details: React.ReactNode;
  /** The History tab. Defaults to an empty state. */
  history?: React.ReactNode;
  /** Shows the controls in `RecordField`s and the Cancel / Save changes footer. */
  editing?: boolean;
  /** Unsaved changes: leaving asks first. */
  dirty?: boolean;
  /** Save in flight: Save shows a spinner, Cancel is disabled. */
  saving?: boolean;
  /** Why the last save failed, announced and shown beside the footer buttons. */
  error?: React.ReactNode;
  onCancel?: () => void;
  /** Save changes, or Enter in a field. */
  onSave?: () => void;
  /** Defaults to "Save changes". */
  saveLabel?: string;
}

/**
 * One record's content: header, identity, Details | History tabs and, while
 * editing, a pinned Cancel / Save changes footer. Renders as a drawer or a
 * page from the surrounding `RecordFrame`.
 *
 * The Details tab sits inside a `<form>` (Enter saves), so don't nest
 * another form in it; a control that needs one can point at it with the
 * `form` attribute.
 */
export function RecordView({
  recordHref,
  title,
  titleAdornment,
  subtitle,
  media,
  cover,
  status,
  actions,
  details,
  history,
  editing = false,
  dirty = false,
  saving = false,
  error,
  onCancel,
  onSave,
  saveLabel = "Save changes",
}: RecordViewProps) {
  const { mode, setDirty } = useRecordFrame();
  const formId = React.useId();
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const [tab, setTab] = React.useState("details");
  const [wasEditing, setWasEditing] = React.useState(editing);
  if (editing !== wasEditing) {
    setWasEditing(editing);
    // Starting to edit shows the fields being edited.
    if (editing) setTab("details");
  }

  React.useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);
  React.useEffect(() => () => setDirty(false), [setDirty]);

  // A drawer that first showed a loading state focused that state's title,
  // which is gone now. Take focus over unless the person has moved it (to the
  // list, say, by clicking another row).
  React.useEffect(() => {
    if (mode !== "intercepted") return;
    const active = document.activeElement;
    if (!active || active === document.body) titleRef.current?.focus({ preventScroll: true });
  }, [mode]);

  const intercepted = mode === "intercepted";
  const showActions = !editing && actions;

  const identity = (
    <div className="flex flex-col gap-6">
      {cover ? <div className="overflow-hidden rounded-xl">{cover}</div> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4 sm:gap-5">
          {media ? <div className="shrink-0">{media}</div> : null}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {intercepted ? (
                <SidePeekDrawerTitle ref={titleRef} className="min-w-0 break-words">
                  {title}
                </SidePeekDrawerTitle>
              ) : (
                <h1 ref={titleRef} tabIndex={-1} className="min-w-0 break-words text-h1 tracking-tight text-foreground outline-none">
                  {title}
                </h1>
              )}
              {titleAdornment}
            </div>
            {subtitle ? <p className="text-small text-muted-foreground">{subtitle}</p> : null}
            {status ? <div className="flex flex-wrap items-center gap-2 pt-1">{status}</div> : null}
          </div>
        </div>
        {/* In a drawer the actions sit in its top bar instead. */}
        {!intercepted && showActions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );

  const tabs = (
    <form
      id={formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (editing && !saving) onSave?.();
      }}
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Record sections">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        {/* Kept mounted while History shows, so nothing typed is lost. */}
        <TabsContent value="details" forceMount className="flex flex-col gap-10 data-[state=inactive]:hidden">
          {details}
        </TabsContent>
        <TabsContent value="history">
          {history ?? (
            <EmptyState
              icon={<History aria-hidden />}
              title="No history yet"
              description="Changes to this record will be listed here."
            />
          )}
        </TabsContent>
      </Tabs>
    </form>
  );

  const footer = editing ? (
    <RecordFooter formId={formId} saving={saving} error={error} onCancel={onCancel} saveLabel={saveLabel} />
  ) : null;

  return (
    <RecordViewContext.Provider value={{ editing }}>
      {intercepted ? (
        <>
          <SidePeekDrawerHeader
            fullPageHref={recordHref}
            // A soft link to this URL would be intercepted back into the drawer.
            fullPageNavigation="document"
            actions={showActions ? actions : undefined}
          />
          <SidePeekDrawerBody className="flex flex-col gap-8">
            {identity}
            {tabs}
          </SidePeekDrawerBody>
          {footer ? (
            <SidePeekDrawerFooter className="flex-wrap items-center">{footer}</SidePeekDrawerFooter>
          ) : null}
        </>
      ) : (
        <div className="flex max-w-3xl flex-col gap-8">
          {identity}
          {tabs}
          {footer ? (
            <div
              data-slot="record-page-footer"
              className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle bg-background py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              {footer}
            </div>
          ) : null}
        </div>
      )}
    </RecordViewContext.Provider>
  );
}

function RecordFooter({
  formId,
  saving,
  error,
  onCancel,
  saveLabel,
}: {
  formId: string;
  saving: boolean;
  error: React.ReactNode;
  onCancel?: () => void;
  saveLabel: string;
}) {
  return (
    <>
      {error ? (
        <p role="alert" className="basis-full text-small text-destructive sm:mr-auto sm:basis-0 sm:flex-1">
          {error}
        </p>
      ) : null}
      <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" form={formId} loading={saving}>
        {saveLabel}
      </Button>
    </>
  );
}

// --- Sections and fields ----------------------------------------------------

export interface RecordSectionProps {
  title: string;
  /** At the end of the heading row: a "Change" button, a "View all" link. */
  action?: React.ReactNode;
  /**
   * `fields` (default) wraps the children in a definition list for
   * `RecordField`s. `content` leaves them as they are (TransactionRows, a
   * link row, StatCards).
   */
  kind?: "fields" | "content";
  className?: string;
  children: React.ReactNode;
}

/** A titled group in the Details tab. */
export function RecordSection({ title, action, kind = "fields", className, children }: RecordSectionProps) {
  const { mode } = useRecordFrame();
  const headingId = React.useId();
  // Under the drawer's h2, or the page's h1.
  const Heading = mode === "intercepted" ? "h3" : "h2";
  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-2", className)}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <Heading id={headingId} className="text-subheading text-foreground">
          {title}
        </Heading>
        {action}
      </div>
      {kind === "fields" ? <DetailList>{children}</DetailList> : children}
    </section>
  );
}

export interface RecordFieldProps {
  label: string;
  /** Shown while viewing, or while editing a field with no control. Empty shows a dash. */
  value?: React.ReactNode;
  /**
   * Defaults to the `RecordView`'s `editing`. Pass `false` to keep a
   * read-only row (a creation date) while the rest of the record is edited.
   */
  editing?: boolean;
  /** The control's `id`. Without one, the label names the control group instead. */
  htmlFor?: string;
  /** Help under the value or control. */
  description?: React.ReactNode;
  /** A validation message under the control while editing. */
  error?: React.ReactNode;
  /** The control, shown while editing. */
  children?: React.ReactNode;
}

const FIELD_ROW =
  "grid grid-cols-1 gap-2 border-b border-border-subtle py-3 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-4";

function isEmpty(value: React.ReactNode) {
  return value === null || value === undefined || value === "" || value === false;
}

/**
 * One label and value. A DetailRow while viewing; while editing, the label
 * and the control (`children`) with its description and error linked to it.
 * Put it inside a `RecordSection`.
 */
export function RecordField({ label, value, editing, htmlFor, description, error, children }: RecordFieldProps) {
  const view = React.useContext(RecordViewContext);
  const labelId = React.useId();
  const showControl = (editing ?? view.editing) && children !== undefined && children !== null;

  if (!showControl) {
    return (
      <DetailRow label={label}>
        {description ? (
          <>
            {isEmpty(value) ? (
              <>
                <span aria-hidden>—</span>
                <span className="sr-only">None</span>
              </>
            ) : (
              value
            )}
            <span className="mt-1 block text-small text-muted-foreground">{description}</span>
          </>
        ) : isEmpty(value) ? null : (
          value
        )}
      </DetailRow>
    );
  }

  return (
    <div data-slot="record-field" className={FIELD_ROW}>
      <dt className="sm:pt-2.5">
        {htmlFor ? (
          <Label htmlFor={htmlFor}>{label}</Label>
        ) : (
          <span id={labelId} className="text-body-medium">
            {label}
          </span>
        )}
      </dt>
      <dd className="min-w-0">
        <Field aria-labelledby={htmlFor ? undefined : labelId} data-invalid={error ? true : undefined}>
          {children}
          {description ? <FieldDescription>{description}</FieldDescription> : null}
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
      </dd>
    </div>
  );
}

// --- Loading and not found --------------------------------------------------

/**
 * The record's loading state, for its `loading.tsx`: a spinner, inside the
 * drawer's chrome when intercepted so it can still be closed.
 */
export function RecordDrawerSkeleton({ label = "Loading record" }: { label?: string }) {
  const { mode } = useRecordFrame();
  const spinner = (
    <div className="flex flex-1 items-center justify-center py-16">
      <Spinner size="lg" label={label} />
    </div>
  );
  if (mode === "canonical") return spinner;
  return (
    <>
      <SidePeekDrawerHeader />
      <SidePeekDrawerBody className="flex flex-col">
        <SidePeekDrawerTitle className="sr-only">{label}</SidePeekDrawerTitle>
        {spinner}
      </SidePeekDrawerBody>
    </>
  );
}

/**
 * A record that doesn't exist (deleted, or a bad link), for the intercepted
 * route; the canonical page calls `notFound()`. `noun` is lowercase: "user".
 */
export function RecordNotFound({ noun }: { noun: string }) {
  const { mode } = useRecordFrame();
  const title = `${noun.charAt(0).toUpperCase()}${noun.slice(1)} not found`;
  const intercepted = mode === "intercepted";
  const content = (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
        <SearchX aria-hidden />
      </div>
      {intercepted ? (
        <SidePeekDrawerTitle className="text-subheading">{title}</SidePeekDrawerTitle>
      ) : (
        <h1 className="text-subheading text-foreground">{title}</h1>
      )}
      <p className="mt-1.5 max-w-sm text-small text-muted-foreground">
        This {noun} may have been deleted, or the link may be wrong.
      </p>
    </div>
  );
  if (!intercepted) return content;
  return (
    <>
      <SidePeekDrawerHeader />
      <SidePeekDrawerBody>{content}</SidePeekDrawerBody>
    </>
  );
}
