"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  clampOffset,
  clampZoom,
  CROP_ZOOM_MIN,
  CROP_ZOOM_STEP,
  cropSourceRect,
  displayedSize,
  maxZoomFor,
  zoomAboutCentre,
  type Offset,
  type Rect,
  type Size,
} from "@/lib/image-crop";
import { cn } from "@/lib/utils";

/** The crop frame is this share of the stage's width; the rest shows what's cut off. */
const CROP_SHARE = 0.8;
/** Arrow keys move the image this far, in frame widths; Shift moves 5x. */
const NUDGE = 0.02;

/** A chosen file and an object URL for it, made and revoked by the caller. */
export interface CropSource {
  url: string;
  name: string;
}

/** What "Use" hands back: the decoded image and the region of it to keep. */
export interface CropResult {
  image: HTMLImageElement;
  natural: Size;
  rect: Rect;
}

export interface ImageCropDialogProps {
  /** Open while there's an image to crop. */
  source: CropSource | null;
  onCancel: () => void;
  /** Exports the crop. Throw to keep the dialog open with an error. */
  onConfirm: (crop: CropResult) => Promise<void>;
  /** Width over height of the kept region. Defaults to 1. */
  aspect?: number;
  /** A circle over the frame (an avatar), or the plain rectangle. */
  shape?: "circle" | "rect";
  /** Stops zooming in once the kept region would be smaller than this, in source px. */
  minSize?: Partial<Size>;
  title: string;
  description: string;
  confirmLabel: string;
  /** "photo" or "image", in the position label and the error copy. */
  noun?: string;
  /** Maps a thrown error to copy, or null for the generic message. */
  describeError?: (caught: unknown) => string | null;
  /** Widens the dialog for a wide frame. */
  className?: string;
}

/**
 * Crops an image to a fixed aspect: drag, pinch, scroll or use the arrow keys
 * to move the image under the frame; zoom with the slider, pinch, the wheel or
 * + and -. The caller exports the kept region (`CropResult.rect`).
 */
export function ImageCropDialog({ source, onCancel, className, ...editor }: ImageCropDialogProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={source !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <DialogContent closeDisabled={busy} className={cn("sm:max-w-[400px]", className)}>
        {source ? (
          <CropEditor
            key={source.url}
            source={source}
            busy={busy}
            setBusy={setBusy}
            onCancel={onCancel}
            {...editor}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CropEditor({
  source,
  busy,
  setBusy,
  onCancel,
  onConfirm,
  aspect = 1,
  shape = "rect",
  minSize,
  title,
  description,
  confirmLabel,
  noun = "image",
  describeError,
}: Omit<ImageCropDialogProps, "source" | "className"> & {
  source: CropSource;
  busy: boolean;
  setBusy: (busy: boolean) => void;
}) {
  const descriptionId = useId();
  const zoomLabelId = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [natural, setNatural] = useState<Size | null>(null);
  const [zoom, setZoom] = useState(CROP_ZOOM_MIN);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [unreadable, setUnreadable] = useState(false);

  const maxZoom = natural ? maxZoomFor(natural, aspect, minSize) : CROP_ZOOM_MIN;
  // The stage's height over its width: the frame plus the same margin as at the sides.
  const stageRatio = CROP_SHARE / aspect + (1 - CROP_SHARE);

  // Mirrors for the native wheel listener, which outlives a render.
  const view = useRef({ natural, zoom, offset, maxZoom, aspect });
  useEffect(() => {
    view.current = { natural, zoom, offset, maxZoom, aspect };
  });

  const applyZoom = (next: number) => {
    const current = view.current;
    if (!current.natural) return;
    const to = clampZoom(next, current.maxZoom);
    setOffset(zoomAboutCentre(current.offset, current.natural, current.zoom, to, current.aspect));
    setZoom(to);
    view.current = { ...current, zoom: to };
  };

  const moveBy = (dx: number, dy: number) => {
    const current = view.current;
    if (!current.natural) return;
    const next = clampOffset(
      { x: current.offset.x + dx, y: current.offset.y + dy },
      current.natural,
      current.zoom,
      current.aspect,
    );
    setOffset(next);
    view.current = { ...current, offset: next };
  };

  // React's wheel listener is passive, so it can't stop the dialog scrolling.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      applyZoom(view.current.zoom * Math.exp(-event.deltaY * 0.002));
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  const framePixels = () => (stageRef.current?.clientWidth ?? 0) * CROP_SHARE || 1;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (busy || !natural) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const points = [...pointers.current.entries()];
    if (points.length === 1) {
      const size = framePixels();
      moveBy((event.clientX - previous.x) / size, (event.clientY - previous.y) / size);
    } else if (points.length === 2) {
      const other = points.find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(previous.x - other.x, previous.y - other.y);
        const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
        if (before > 0) applyZoom(view.current.zoom * (after / before));
      }
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? NUDGE * 5 : NUDGE;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[event.key]) {
      event.preventDefault();
      moveBy(...moves[event.key]);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      applyZoom(zoom + CROP_ZOOM_STEP * 2);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      applyZoom(zoom - CROP_ZOOM_STEP * 2);
    }
  };

  const confirm = async () => {
    const image = imageRef.current;
    if (!image || !natural) return;
    setError(null);
    setBusy(true);
    try {
      await onConfirm({
        image,
        natural,
        rect: cropSourceRect(natural, zoom, offset, aspect, maxZoom),
      });
    } catch (caught) {
      setError(
        describeError?.(caught) ??
          `Couldn't use that ${noun}. Try again, or choose another.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const shown = natural ? displayedSize(natural, zoom, aspect) : { width: 1, height: 1 };
  const nounTitle = noun.charAt(0).toUpperCase() + noun.slice(1);
  // Insets of the frame, as a share of the stage's width and height.
  const insetX = ((1 - CROP_SHARE) / 2) * 100;
  const insetY = insetX / stageRatio;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription id={descriptionId}>{description}</DialogDescription>
      </DialogHeader>

      <div
        ref={stageRef}
        role="group"
        aria-label={`${nounTitle} position`}
        aria-describedby={descriptionId}
        tabIndex={unreadable ? -1 : 0}
        data-slot="crop-stage"
        className="relative w-full cursor-grab touch-none overflow-hidden rounded-xl bg-muted select-none focus-visible:focus-ring active:cursor-grabbing"
        style={{ aspectRatio: 1 / stageRatio }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset */}
        <img
          ref={imageRef}
          src={source.url}
          alt=""
          draggable={false}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (naturalWidth > 0 && naturalHeight > 0) {
              setNatural({ width: naturalWidth, height: naturalHeight });
            } else {
              setUnreadable(true);
            }
          }}
          onError={() => setUnreadable(true)}
          className="pointer-events-none absolute max-w-none"
          style={{
            visibility: natural ? "visible" : "hidden",
            width: `${shown.width * CROP_SHARE * 100}%`,
            height: `${(shown.height * CROP_SHARE * 100) / stageRatio}%`,
            left: `${50 + offset.x * CROP_SHARE * 100}%`,
            top: `${50 + (offset.y * CROP_SHARE * 100) / stageRatio}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
        {/* The frame: everything outside it is dimmed. */}
        <div
          aria-hidden
          data-slot="crop-frame"
          className={cn(
            "pointer-events-none absolute shadow-[0_0_0_100vmax_var(--color-scrim)] ring-2 ring-white/80",
            shape === "circle" ? "rounded-full" : "rounded-md",
          )}
          style={{ inset: `${insetY}% ${insetX}%` }}
        />
        {unreadable ? (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-small text-muted-foreground">
            We couldn&apos;t open that {noun}.
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <span id={zoomLabelId} className="text-small font-medium">
          Zoom
        </span>
        <Slider
          aria-labelledby={zoomLabelId}
          min={CROP_ZOOM_MIN * 100}
          max={Math.max(CROP_ZOOM_MIN * 100 + 1, Math.floor(maxZoom * 100))}
          step={CROP_ZOOM_STEP * 100}
          value={Math.round(zoom * 100)}
          disabled={busy || !natural || maxZoom <= CROP_ZOOM_MIN}
          formatValue={(value) => `${value}%`}
          onValueChange={(value) => applyZoom(value / 100)}
        />
      </div>

      {error || unreadable ? (
        <p role="alert" className="text-small text-destructive">
          {error ?? "That file couldn't be read. Choose another JPG or PNG."}
        </p>
      ) : null}

      <DialogFooter className="flex-col border-t border-border-subtle pt-4 sm:flex-row">
        <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" loading={busy} disabled={!natural} onClick={confirm}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
