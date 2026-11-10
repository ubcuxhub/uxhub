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
  CROP_OUTPUT_SIZE,
  CROP_ZOOM_MAX,
  CROP_ZOOM_MIN,
  CROP_ZOOM_STEP,
  cropSourceRect,
  displayedSize,
  zoomAboutCentre,
  type Offset,
  type Size,
} from "../lib/crop";
import { PhotoUploadError } from "./setup-client";

/** The crop square is this share of the stage; the rest shows what's cut off. */
const CROP_SHARE = 0.8;
/** Arrow keys move the photo this far, in crop widths; Shift moves 5x. */
const NUDGE = 0.02;

/** A chosen file and an object URL for it, made and revoked by the caller. */
export interface PhotoPick {
  url: string;
  name: string;
}

interface PhotoCropDialogProps {
  /** Open while there's a photo to crop. */
  photo: PhotoPick | null;
  onCancel: () => void;
  /** Uploads the square JPEG. Throw to keep the dialog open with an error. */
  onConfirm: (cropped: Blob) => Promise<void>;
}

/**
 * "Crop your photo" (Figma 4287:2, mobile 4320:2): drag, pinch, scroll or use
 * the arrow keys to move the photo under a circle; zoom with the slider,
 * pinch, the wheel or + and -. "Use photo" re-encodes the square through a
 * canvas, which also drops EXIF and GPS data.
 */
export function PhotoCropDialog({ photo, onCancel, onConfirm }: PhotoCropDialogProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={photo !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <DialogContent closeDisabled={busy} className="sm:max-w-[400px]">
        {photo ? (
          <CropEditor
            key={photo.url}
            photo={photo}
            busy={busy}
            setBusy={setBusy}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CropEditor({
  photo,
  busy,
  setBusy,
  onCancel,
  onConfirm,
}: {
  photo: PhotoPick;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCancel: () => void;
  onConfirm: (cropped: Blob) => Promise<void>;
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

  // Mirrors for the native wheel listener, which outlives a render.
  const view = useRef({ natural, zoom, offset });
  useEffect(() => {
    view.current = { natural, zoom, offset };
  });

  const applyZoom = (next: number) => {
    const current = view.current;
    if (!current.natural) return;
    const to = clampZoom(next);
    setOffset(zoomAboutCentre(current.offset, current.natural, current.zoom, to));
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

  const cropPixels = () => (stageRef.current?.clientWidth ?? 0) * CROP_SHARE || 1;

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
      const size = cropPixels();
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
      const blob = await renderCrop(image, natural, zoom, offset);
      await onConfirm(blob);
    } catch (caught) {
      setError(
        caught instanceof PhotoUploadError
          ? caught.message
          : "Couldn't use that photo. Try again, or choose another.",
      );
    } finally {
      setBusy(false);
    }
  };

  const shown = natural ? displayedSize(natural, zoom) : { width: 1, height: 1 };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Crop your photo</DialogTitle>
        <DialogDescription id={descriptionId}>
          Drag or use the arrow keys to move your photo. Use the slider to zoom.
        </DialogDescription>
      </DialogHeader>

      <div
        ref={stageRef}
        role="group"
        aria-label="Photo position"
        aria-describedby={descriptionId}
        tabIndex={unreadable ? -1 : 0}
        data-slot="crop-stage"
        className="relative aspect-square w-full cursor-grab touch-none overflow-hidden rounded-xl bg-muted select-none focus-visible:focus-ring active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset */}
        <img
          ref={imageRef}
          src={photo.url}
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
            height: `${shown.height * CROP_SHARE * 100}%`,
            left: `${50 + offset.x * CROP_SHARE * 100}%`,
            top: `${50 + offset.y * CROP_SHARE * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
        {/* The circle: everything outside it is dimmed. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[10%] rounded-full shadow-[0_0_0_100vmax_var(--color-scrim)] ring-2 ring-white/80"
        />
        {unreadable ? (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-small text-muted-foreground">
            We couldn&apos;t open that photo.
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
          max={CROP_ZOOM_MAX * 100}
          step={CROP_ZOOM_STEP * 100}
          value={Math.round(zoom * 100)}
          disabled={busy || !natural}
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
          Use photo
        </Button>
      </DialogFooter>
    </>
  );
}

/** Draws the kept square onto a canvas and encodes it as a JPEG. */
function renderCrop(image: HTMLImageElement, natural: Size, zoom: number, offset: Offset) {
  return new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = CROP_OUTPUT_SIZE;
    canvas.height = CROP_OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("No canvas"));
      return;
    }
    const source = cropSourceRect(natural, zoom, offset);
    // JPEG has no transparency: a transparent PNG would turn black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      source.x,
      source.y,
      source.size,
      source.size,
      0,
      0,
      CROP_OUTPUT_SIZE,
      CROP_OUTPUT_SIZE,
    );
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))),
      "image/jpeg",
      0.9,
    );
  });
}
