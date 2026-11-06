"use client";

import * as React from "react";
import { ViewTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { History, Minimize2, SearchX } from "lucide-react";

import { DetailList, DetailRow } from "@/components/shared/DetailRow";
import { Button, buttonVariants } from "@/components/ui/button";
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
  SidePeekDrawerTopBar,
  useSidePeekDrawerControls,
} from "@/components/ui/side-peek-drawer";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/*
 * A record (a user, an event) shown in a SidePeekDrawer over its list.
 *
 * The list is a route layout (`admin/users/layout.tsx`) and each record is a
 * child route (`admin/users/[userId]/page.tsx`). The list layout renders
 * `RecordFrame` around its `children`, so the drawer opens whenever the URL is
 * one of the list's records, on a row click and on a refresh alike, and the
 * list stays mounted behind it while records are swapped. Users have no other
 * view of a record; an event's "Edit event" opens its builder, a page of its
 * own that wears the drawer's top bar (`RecordPage`).
 *
 * The content (`RecordView` and its sections and fields) fills the drawer and
 * never needs to know how it was opened.
 *
 * Expanding the drawer into its record's page, and collapsing the page back,
 * morph one panel into the other: the drawer's panel (in `RecordFrame`) and
 * the page (`RecordPage`) are a named `<ViewTransition>` pair, and the list
 * (`RecordList`) fades out or in behind them. Only navigations from the
 * expand, "Edit event" and collapse links carry the transition types that
 * switch the pair on (`useRecordMorphTypes`); every other way in or out
 * (opening from a row, closing, swapping rows, Back) keeps the drawer's own
 * slide, or none.
 */

// --- Expand and collapse ----------------------------------------------------

/** The shared name of the drawer's panel and its record's full page. */
const RECORD_PANEL = "record-panel";
/** Transition types on the links between a drawer and its record's page. */
const RECORD_EXPAND = "record-expand";
const RECORD_COLLAPSE = "record-collapse";
/** The CSS classes the morph and the list's fade animate (`globals.css`). */
const MORPH = { [RECORD_EXPAND]: "record-morph", [RECORD_COLLAPSE]: "record-morph", default: "none" };
const LIST_ENTER = { [RECORD_COLLAPSE]: "record-fade", default: "none" };
const LIST_EXIT = { [RECORD_EXPAND]: "record-fade", default: "none" };

/**
 * Where the morph plays: `sm`+ (below it the drawer already fills the
 * screen, and expand and collapse are hidden), without reduced motion.
 */
const MORPH_QUERY = "(min-width: 640px) and (prefers-reduced-motion: no-preference)";

function subscribeMorph(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(MORPH_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getMorphSnapshot() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia(MORPH_QUERY).matches &&
    "startViewTransition" in document
  );
}

/**
 * The `transitionTypes` for a link from a record's drawer to its full page
 * (`expand`) or back (`collapse`), so the panel morphs between them. None on
 * phones, with reduced motion, or without view transitions: the page then
 * swaps instantly, as any other navigation does.
 */
export function useRecordMorphTypes(direction: "expand" | "collapse"): string[] | undefined {
  const morph = React.useSyncExternalStore(subscribeMorph, getMorphSnapshot, () => false);
  if (!morph) return undefined;
  return [direction === "expand" ? RECORD_EXPAND : RECORD_COLLAPSE];
}

/** Whether the panel is mounting as the end of a collapse's morph. */
function isCollapsing() {
  try {
    return document.documentElement.matches(`:active-view-transition-type(${RECORD_COLLAPSE})`);
  } catch {
    // No view transition types in this browser, so no morph either.
    return false;
  }
}

/**
 * A list whose records have a full page (`RecordPage`): it fades out while a
 * record expands into its page, and back in while the page collapses into
 * the drawer. Wrap the one element holding the list and its `RecordFrame`:
 *
 * ```tsx
 * <RecordList>
 *   <PageContainer>…list… <RecordFrame listHref="/admin/events">{children}</RecordFrame></PageContainer>
 * </RecordList>
 * ```
 */
export function RecordList({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={LIST_ENTER} exit={LIST_EXIT} default="none">
      {children}
    </ViewTransition>
  );
}

interface RecordFrameContextValue {
  /** Reports unsaved changes. `RecordView` does this from its `dirty` prop. */
  setDirty: (dirty: boolean) => void;
  /** Closes the record, back to its list, asking first when there are unsaved changes. */
  close: () => void;
  /**
   * Leaves for `href`, asking first when there are unsaved changes. Another
   * record of the list replaces this one (so Back still returns to the list);
   * anything else is pushed.
   */
  navigate: (href: string) => void;
}

const RecordFrameContext = React.createContext<RecordFrameContextValue | null>(null);

/** The surrounding `RecordFrame`: how to close, navigate and report unsaved changes. */
export function useRecordFrame() {
  const context = React.useContext(RecordFrameContext);
  if (!context) throw new Error("Record parts must be inside RecordFrame");
  return context;
}

/** The path part of an href, without a trailing slash. */
function pathOf(href: string) {
  return href.split(/[?#]/, 1)[0].replace(/(.)\/$/, "$1");
}

/** Whether `pathname` is one of the list's records: a direct child of `list`. */
function isRecordPath(pathname: string, list: string) {
  if (!pathname.startsWith(`${list}/`)) return false;
  const rest = pathname.slice(list.length + 1).replace(/\/$/, "");
  return rest !== "" && !rest.includes("/");
}

/** How long the drawer takes to slide out (`duration-200`); close navigates after it. */
const EXIT_MS = 200;

export interface RecordFrameProps {
  /** The list the records belong to, e.g. `/admin/users`. Records are its direct children. */
  listHref: string;
  /**
   * Whether a record is open. Defaults to the URL: open while it is one of
   * the list's records. For demos; routes leave it unset.
   */
  open?: boolean;
  /**
   * Replaces the default close (back to the list). For demos and tests;
   * routes leave it unset.
   */
  onClose?: () => void;
  /** The record route: a `RecordView`, or its loading or not-found state. */
  children: React.ReactNode;
}

/**
 * The drawer a list layout renders its record routes into:
 *
 * ```tsx
 * // admin/users/layout.tsx
 * <AdminUsersManager users={users} />
 * <RecordFrame listHref="/admin/users">{children}</RecordFrame>
 * ```
 *
 * Close (the chevron, Esc) returns to the list: `router.back()` when the
 * record was opened from the list (so Back and Forward still make sense),
 * otherwise `router.replace` to the list (a refresh, a shared link, the
 * builder's collapse). Browser Back closes it too. A row click while a record
 * is open replaces it, so Back skips the records looked at.
 *
 * While the content reports unsaved changes, leaving any way the app can see
 * (close, a link anywhere on the page, reload) asks "Discard changes?" first.
 * Browser Back can't be held back.
 */
export function RecordFrame({ listHref, open: openProp, onClose, children }: RecordFrameProps) {
  const router = useRouter();
  const pathname = usePathname();
  const list = pathOf(listHref);
  const atRecord = isRecordPath(pathname, list);
  const [dirty, setDirty] = React.useState(false);
  // Sliding out after a close, before the URL catches up.
  const [closing, setClosing] = React.useState(false);
  const closeTimer = React.useRef<number | undefined>(undefined);

  // Whether the history entry before this one is the list, so close can go
  // back to it. Only a soft navigation from the list to a record says so; a
  // row click while a record is open replaces the entry, keeping the answer.
  const fromList = React.useRef(false);
  const lastPath = React.useRef<string | null>(null);
  const [seenPath, setSeenPath] = React.useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    // Keep `closing` until a record opens again: clearing it as the URL
    // reaches the list would mark the panel instant mid-slide-out, and the
    // dialog would never finish unmounting (an empty panel stays on screen).
    if (atRecord) setClosing(false);
  }
  React.useEffect(() => {
    const last = lastPath.current;
    if (!isRecordPath(pathname, list)) fromList.current = false;
    else if (last === list) fromList.current = true;
    else if (last === null || !isRecordPath(last, list)) fromList.current = false;
    lastPath.current = pathname;
    // Another URL already: a pending close has nothing left to do.
    window.clearTimeout(closeTimer.current);
  }, [pathname, list]);
  React.useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const open = (openProp ?? atRecord) && !closing;

  const leave = React.useCallback(
    (href: string) => {
      const url = new URL(href, window.location.href);
      const path = url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.href;
      if (url.origin === window.location.origin && isRecordPath(url.pathname, list)) router.replace(path);
      else router.push(path);
    },
    [list, router],
  );

  // The panel, while it is mounted.
  const panel = React.useRef<HTMLDivElement | null>(null);
  const setPanel = React.useCallback((node: HTMLDivElement | null) => {
    panel.current = node;
    // Mounting as a page collapses into it: the morph brings the panel in,
    // so skip the slide-in (it would also move the morph's target off
    // screen). Set on the element, not in state, to be in place before the
    // morph snapshots it.
    if (node && isCollapsing()) node.setAttribute("data-morphed", "");
  }, []);

  const close = () => {
    if (onClose) return onClose();
    // Let a panel that reopens mid-slide-out slide in again.
    panel.current?.removeAttribute("data-morphed");
    setClosing(true);
    // Slide out first, while the record is still the route's content.
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      if (fromList.current) router.back();
      else router.replace(listHref);
    }, EXIT_MS);
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
      {/* The panel's half of the expand/collapse morph. Opening, closing and
          swapping records don't animate it: they keep the drawer's own slide. */}
      <ViewTransition name={RECORD_PANEL} share={MORPH} default="none">
        <SidePeekDrawerContent
          ref={setPanel}
          aria-describedby={undefined}
          // Closed by the URL (Back, a link), the record is already gone: don't
          // slide out an empty panel.
          data-instant={!open && !closing && openProp === undefined ? "" : undefined}
          className="data-[instant]:animate-none! data-[morphed]:data-[state=open]:animate-none!"
        >
          <FrameContext setDirty={setDirty} leave={leave}>
            {children}
          </FrameContext>
        </SidePeekDrawerContent>
      </ViewTransition>
    </SidePeekDrawer>
  );
}

/** Inside the drawer, where its close and discard confirmation are reachable. */
function FrameContext({
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
    setDirty,
    close: requestClose,
    navigate: (href) => (dirty ? requestNavigate(href) : leave(href)),
  };
  return <RecordFrameContext.Provider value={value}>{children}</RecordFrameContext.Provider>;
}

export interface RecordPageTopBarProps {
  /** The list, where close goes: `/admin/events`. */
  listHref: string;
  /** Close's tooltip, naming the list: "Back to Manage Events". */
  listLabel: string;
  /** The record, where collapse goes: the list with this record's drawer open. */
  recordHref: string;
  actions?: React.ReactNode;
}

/**
 * The drawer's top bar for a record's full page (an event's builder): close
 * returns to the list, collapse to the list with this record's drawer open.
 * Both are plain links, so the page's own unsaved-changes guard sees them.
 * Collapse is hidden below `sm`, as expand is in the drawer. The shell's
 * phone header hides while this bar is on the page, so the page opens like
 * the drawer: close is the way out. `RecordPage` renders it; use it alone
 * only where the page shouldn't morph.
 */
export function RecordPageTopBar({ listHref, listLabel, recordHref, actions }: RecordPageTopBarProps) {
  const collapseTypes = useRecordMorphTypes("collapse");
  return (
    <SidePeekDrawerTopBar
      closeHref={listHref}
      closeLabel="Close"
      closeTooltip={listLabel}
      actions={actions}
      data-hides-app-header=""
      resize={
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={recordHref}
              transitionTypes={collapseTypes}
              aria-label="Collapse to drawer"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-lg text-muted-foreground")}
            >
              <Minimize2 className="size-[18px]" aria-hidden />
            </Link>
          </TooltipTrigger>
          <TooltipContent>Collapse to drawer</TooltipContent>
        </Tooltip>
      }
    />
  );
}

export interface RecordPageProps extends RecordPageTopBarProps {
  className?: string;
  /** The page's content, under the top bar: a `PageContainer`. */
  children: React.ReactNode;
}

/**
 * A record's full page (an event's builder): `RecordPageTopBar` over the
 * content, as one panel that the record's drawer grows into on expand and
 * shrinks back into on collapse.
 */
export function RecordPage({ className, children, ...topBar }: RecordPageProps) {
  return (
    <ViewTransition name={RECORD_PANEL} share={MORPH} default="none">
      {/* One element, so the morph has one panel to move. Opaque, so the
          drawer and the page cross-fade cleanly over the list. */}
      <div data-slot="record-page" className={cn("flex flex-1 flex-col bg-background", className)}>
        <RecordPageTopBar {...topBar} />
        {children}
      </div>
    </ViewTransition>
  );
}

// --- View -------------------------------------------------------------------

const RecordViewContext = React.createContext<{ editing: boolean }>({ editing: false });

export interface RecordViewProps {
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
  /** Top bar buttons ("Edit user", "Edit event"). Hidden while editing, when the footer takes over. */
  actions?: React.ReactNode;
  /**
   * The record's full page (an event's builder). Shows an expand button
   * beside close, the twin of the page's collapse; hidden below `sm`. Another
   * link to the page (an "Edit event" action) morphs into it too when it
   * passes `useRecordMorphTypes("expand")` as its `transitionTypes`.
   */
  fullPageHref?: string;
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
 * One record's content in the surrounding `RecordFrame`'s drawer: top bar,
 * identity, Details | History tabs and, while editing, a pinned Cancel / Save
 * changes footer.
 *
 * The Details tab sits inside a `<form>` (Enter saves), so don't nest
 * another form in it; a control that needs one can point at it with the
 * `form` attribute.
 */
export function RecordView({
  title,
  titleAdornment,
  subtitle,
  media,
  cover,
  status,
  actions,
  fullPageHref,
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
  const { setDirty } = useRecordFrame();
  const expandTypes = useRecordMorphTypes("expand");
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
    const active = document.activeElement;
    if (!active || active === document.body) titleRef.current?.focus({ preventScroll: true });
  }, []);

  const showActions = !editing && actions;

  const identity = (
    <div className="flex flex-col gap-6">
      {cover ? <div className="overflow-hidden rounded-xl">{cover}</div> : null}
      <div className="flex min-w-0 items-start gap-4 sm:gap-5">
        {media ? <div className="shrink-0">{media}</div> : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <SidePeekDrawerTitle ref={titleRef} className="min-w-0 break-words">
              {title}
            </SidePeekDrawerTitle>
            {titleAdornment}
          </div>
          {subtitle ? <p className="text-small text-muted-foreground">{subtitle}</p> : null}
          {status ? <div className="flex flex-wrap items-center gap-2 pt-1">{status}</div> : null}
        </div>
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

  return (
    <RecordViewContext.Provider value={{ editing }}>
      <SidePeekDrawerHeader
        fullPageHref={fullPageHref}
        fullPageTransitionTypes={expandTypes}
        actions={showActions ? actions : undefined}
      />
      <SidePeekDrawerBody className="flex flex-col gap-8">
        {identity}
        {tabs}
      </SidePeekDrawerBody>
      {editing ? (
        <SidePeekDrawerFooter className="flex-wrap items-center">
          <RecordFooter formId={formId} saving={saving} error={error} onCancel={onCancel} saveLabel={saveLabel} />
        </SidePeekDrawerFooter>
      ) : null}
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
  const headingId = React.useId();
  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-2", className)}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        {/* Under the drawer's h2 title. */}
        <h3 id={headingId} className="text-subheading text-foreground">
          {title}
        </h3>
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
 * The record's loading state, for its `loading.tsx`: a spinner inside the
 * drawer's chrome, so it can still be closed.
 */
export function RecordDrawerSkeleton({ label = "Loading record" }: { label?: string }) {
  return (
    <>
      <SidePeekDrawerHeader />
      <SidePeekDrawerBody className="flex flex-col">
        <SidePeekDrawerTitle className="sr-only">{label}</SidePeekDrawerTitle>
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner size="lg" label={label} />
        </div>
      </SidePeekDrawerBody>
    </>
  );
}

/**
 * A record that doesn't exist (deleted, or a bad link), in the drawer over
 * its list. `noun` is lowercase: "user".
 */
export function RecordNotFound({ noun }: { noun: string }) {
  const title = `${noun.charAt(0).toUpperCase()}${noun.slice(1)} not found`;
  return (
    <>
      <SidePeekDrawerHeader />
      <SidePeekDrawerBody>
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
            <SearchX aria-hidden />
          </div>
          <SidePeekDrawerTitle className="text-subheading">{title}</SidePeekDrawerTitle>
          <p className="mt-1.5 max-w-sm text-small text-muted-foreground">
            This {noun} may have been deleted, or the link may be wrong.
          </p>
        </div>
      </SidePeekDrawerBody>
    </>
  );
}
