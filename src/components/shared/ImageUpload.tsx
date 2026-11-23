"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import Image from "next/image";
import { Image as ImageIcon, Trash2, Upload } from "lucide-react";

import {
  ImageCropDialog,
  type CropResult,
  type CropSource,
} from "@/components/shared/ImageCropDialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import {
  describeImageRequirements,
  describeMinSize,
  describeWrongFileType,
  EVENT_IMAGE_ERRORS,
  EVENT_IMAGE_SOURCE_MAX_BYTES,
  isAllowedEventImageType,
  needsEventImageOptimization,
  resolveImagePreviewSrc,
  type EventImageRequirements,
  type ImageDimensions,
} from "@/lib/event-image";
import { optimizeEventImage } from "@/lib/event-image-optimize";
import { coverSize } from "@/lib/image-crop";
import { cn } from "@/lib/utils";

const getImageDimensions = (file: File) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = document.createElement("img");

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Unable to read image dimensions"));
    };

    image.src = imageUrl;
  });

/** The file name at the end of a stored URL or path, for the Uploaded footer. */
function fileNameFromValue(value: string): string | null {
  if (value.startsWith("data:")) return null;
  const last = value.split(/[?#]/)[0].split("/").pop();
  if (!last) return null;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

const DEFAULT_REQUIREMENTS: EventImageRequirements = { square: true };

/**
 * A non-square aspect within this share of the target is close enough to
 * skip the crop dialog. Square stays exact: the upload route requires it.
 */
const ASPECT_TOLERANCE = 0.01;

/** Thrown from the crop dialog's confirm when the crop can't fit the upload limit. */
class ImageTooLargeError extends Error {}

/** A pick waiting in the crop dialog. */
interface PendingCrop {
  source: CropSource;
  file: File;
  dimensions: ImageDimensions;
  request: number;
}

interface ImageUploadProps {
  value?: string;
  onChange: (path: string) => void;
  onFileChange?: (file: File | null) => void;
  disabled?: boolean;
  /** Shows the uploading state; the component is not uploading on its own yet. */
  uploading?: boolean;
  /** Id of the file input, which the label points at. Defaults to `useId()`. */
  id?: string;
  /** Defaults to "Image cover for the event". */
  label?: string;
  /** Replaces the requirements line under "Upload image". */
  hint?: string;
  /**
   * What the picker enforces: `square`, and a minimum size in px. Also builds
   * the default requirements line. Defaults to `{ square: true }`.
   */
  requirements?: EventImageRequirements;
  /** 0 to 100. Without it the uploading bar is indeterminate. */
  progress?: number;
  /** Shows "Cancel upload" while uploading. */
  onCancelUpload?: () => void;
  /** Names the file in the uploading and uploaded states. */
  fileName?: string;
  /** A server error, shown in place of any local validation message. */
  error?: string | null;
  /** Builder icon tile or shallow header picker; default retains existing sizing. */
  presentation?: "default" | "icon" | "header";
}

/**
 * One image (an event cover or header) in five states: Empty, Dragging,
 * Uploading, Uploaded and Error (§3.12). Picking a file validates it and hands
 * it to `onFileChange`; nothing is saved until the page's own Save.
 *
 * The visible, keyboard-reachable control is the "Upload image" / "Replace"
 * button. The file input behind it is visually hidden and out of the tab order,
 * but it is what the label names, so clicking the label opens the picker too.
 * Progress and completion are announced through a polite live region, and
 * errors through the `FieldError` alert.
 */
export const ImageUpload = ({
  value,
  onChange,
  onFileChange,
  disabled = false,
  uploading = false,
  id,
  label = "Image cover for the event",
  hint,
  requirements = DEFAULT_REQUIREMENTS,
  progress,
  onCancelUpload,
  fileName,
  error: externalError,
  presentation = "default",
}: ImageUploadProps) => {
  const generatedId = useId();
  const inputId = id ?? `${generatedId}-image-upload`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const labelId = `${inputId}-label`;

  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(() =>
    value ? resolveImagePreviewSrc(value) : null
  );
  const [previewedValue, setPreviewedValue] = useState(value);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [wasUploading, setWasUploading] = useState(uploading);
  const [cancelled, setCancelled] = useState(false);
  // Shrinking a large pick to fit the upload limit; see `event-image-optimize`.
  const [optimizing, setOptimizing] = useState(false);
  const [cropping, setCropping] = useState<PendingCrop | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // dragenter and dragleave also fire for every child crossed; counting them
  // keeps the dragging state from flickering off mid-drag.
  const dragDepth = useRef(0);
  // Picking, removing, and a new stored value each bump this. `handleFile`
  // awaits (image decode, FileReader), and only the latest request may write.
  const latestRequest = useRef(0);
  const reader = useRef<FileReader | null>(null);

  useEffect(
    () => () => {
      latestRequest.current += 1;
      reader.current?.abort();
    },
    [],
  );

  // A new stored value supersedes any pick still being decoded.
  useEffect(() => {
    latestRequest.current += 1;
  }, [value]);

  const error = externalError || localError;

  // A new stored image (after a save, or a form reset) replaces whatever
  // preview is showing, including one read from a picked file.
  if (value !== previewedValue) {
    setPreviewedValue(value);
    setPreview(value ? resolveImagePreviewSrc(value) : null);
    setPickedName(null);
    setOptimizing(false);
  }

  // The parent drives uploading; announce when it ends.
  if (wasUploading !== uploading) {
    setWasUploading(uploading);
    if (uploading) {
      setCancelled(false);
      setStatus("");
    } else if (cancelled) {
      setStatus("Upload cancelled");
    } else if (!externalError) {
      setStatus("Upload complete");
    }
  }

  const progressStep =
    progress === undefined
      ? undefined
      : Math.floor(Math.min(100, Math.max(0, progress)) / 25) * 25;
  const liveMessage = optimizing
    ? "Optimizing image"
    : uploading
    ? progressStep === undefined
      ? "Uploading"
      : `Uploading ${progressStep}%`
    : status;

  const showFileName =
    fileName ?? pickedName ?? (value ? fileNameFromValue(value) : null);

  const openPicker = () => fileInputRef.current?.click();

  const resetDrag = () => {
    dragDepth.current = 0;
    setIsDragging(false);
  };

  const canDrop = !disabled && !uploading;

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!canDrop) return;
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!canDrop) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    resetDrag();
    if (!canDrop) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFile(file);
    }
  };

  const handleFileInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (file) {
      await handleFile(file);
    }
    // Picking the same file again after an error must fire `change` again.
    input.value = "";
  };

  const handleFile = async (picked: File) => {
    const request = ++latestRequest.current;
    const isStale = () => request !== latestRequest.current;
    reader.current?.abort();
    reader.current = null;
    setOptimizing(false);
    let file = picked;

    if (!isAllowedEventImageType(file.type)) {
      setLocalError(describeWrongFileType(file.type));
      return;
    }

    // A file over the upload limit is shrunk below, up to this cap.
    if (file.size > EVENT_IMAGE_SOURCE_MAX_BYTES) {
      setLocalError(EVENT_IMAGE_ERRORS.sourceSize);
      return;
    }

    const dimensions = await getImageDimensions(file).catch(() => null);
    // A later pick, a removal or a new stored value happened while decoding.
    if (isStale()) return;
    if (!dimensions) {
      setLocalError(EVENT_IMAGE_ERRORS.dimensions);
      return;
    }

    const { minWidth, minHeight } = requirements;
    const aspect = requirements.square ? 1 : requirements.aspect;
    // What survives the crop at its widest: it must still meet the minimum.
    const kept = aspect ? coverSize(dimensions, aspect) : dimensions;
    if (kept.width < (minWidth ?? 0) || kept.height < (minHeight ?? 0)) {
      setLocalError(describeMinSize(minWidth ?? 1, minHeight ?? 1));
      return;
    }

    if (aspect && !hasAspect(dimensions, aspect, !!requirements.square)) {
      setLocalError(null);
      setCropping({
        source: { url: URL.createObjectURL(file), name: file.name },
        file,
        dimensions,
        request,
      });
      return;
    }

    if (needsEventImageOptimization(file.size, dimensions)) {
      setLocalError(null);
      setPickedName(file.name);
      setOptimizing(true);
      const optimized = await optimizeEventImage(file, dimensions, {
        minWidth,
        minHeight,
      }).catch(() => null);
      if (isStale()) return;
      setOptimizing(false);
      if (!optimized) {
        setPickedName(null);
        setLocalError(EVENT_IMAGE_ERRORS.optimize);
        return;
      }
      file = optimized;
    }

    accept(file, request);
  };

  /** Previews a ready file and hands it to the parent. */
  const accept = (file: File, request: number) => {
    setLocalError(null);
    setPickedName(file.name);
    setStatus("Image selected");

    const fileReader = new FileReader();
    reader.current = fileReader;
    fileReader.onload = () => {
      if (request !== latestRequest.current) return;
      setPreview(fileReader.result as string);
    };
    fileReader.readAsDataURL(file);
    onFileChange?.(file);
  };

  const closeCrop = () => {
    if (cropping) URL.revokeObjectURL(cropping.source.url);
    setCropping(null);
  };

  const confirmCrop = async ({ rect }: CropResult) => {
    if (!cropping) return;
    const { file, dimensions, request } = cropping;
    const cropped = await optimizeEventImage(file, dimensions, {
      minWidth: requirements.minWidth,
      minHeight: requirements.minHeight,
      crop: rect,
    });
    if (!cropped) throw new ImageTooLargeError(EVENT_IMAGE_ERRORS.optimize);
    closeCrop();
    if (request !== latestRequest.current) return;
    accept(cropped, request);
  };

  const handleRemove = () => {
    latestRequest.current += 1;
    reader.current?.abort();
    reader.current = null;
    setOptimizing(false);
    setPreview(null);
    setPickedName(null);
    setLocalError(null);
    setStatus("Image removed");
    onFileChange?.(null);
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCancel = () => {
    setCancelled(true);
    onCancelUpload?.();
  };

  const view = uploading || optimizing
    ? "uploading"
    : isDragging
      ? "dragging"
      : preview
        ? "uploaded"
        : "empty";

  const requirementsLine = hint ?? `${presentation === "default" ? "Or drag one here. " : ""}${describeImageRequirements(requirements)}.`;
  const hasError = !!error;
  const showHint = view === "empty" && !hasError;
  // The hint gives way to the error, so the controls point at whichever shows.
  const describedBy = showHint ? hintId : hasError ? errorId : undefined;

  return (
    <Field
      data-invalid={hasError}
      data-disabled={disabled}
      aria-labelledby={labelId}
      className={presentation === "icon" ? "w-55 max-w-full" : undefined}
    >
      <FieldLabel id={labelId} htmlFor={inputId} className={presentation === "header" ? "sr-only" : presentation === "icon" ? "text-small font-medium" : undefined}>
        {label}
      </FieldLabel>

      <div
        data-slot="image-upload"
        data-state={view}
        data-presentation={presentation}
        className={cn(
          "relative flex min-h-[200px] w-full flex-col rounded-xl transition-colors",
          view === "empty" &&
            "items-center justify-center gap-3 border-[1.5px] border-dashed p-4",
          view === "empty" &&
            !disabled &&
            "border-muted-foreground/70 hover:bg-accent",
          view === "empty" && !disabled && hasError &&
            "min-h-[172px] border-destructive",
          view === "empty" &&
            disabled &&
            "cursor-not-allowed border-border bg-disabled text-disabled-foreground",
          view === "dragging" &&
            "items-center justify-center gap-3 border-[1.5px] border-dashed border-primary bg-info p-4",
          view === "uploading" &&
            "justify-center gap-3 border border-border p-6",
          view === "uploaded" &&
            cn(
              "overflow-hidden border",
              hasError ? "border-destructive" : "border-border",
            ),
          presentation === "icon" && "min-h-55 w-55 max-w-full",
          presentation === "header" && view !== "uploaded" && "min-h-30",
          presentation !== "default" && view === "empty" && !disabled && "bg-section",
        )}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          onChange={handleFileInput}
          className="sr-only"
          tabIndex={-1}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={hasError || undefined}
        />

        {view === "dragging" && (
          <>
            <Upload className="size-5 text-info-foreground" aria-hidden />
            <p className="text-body-medium text-info-foreground">
              Drop to upload
            </p>
          </>
        )}

        {view === "uploading" && (
          <>
            <div className="flex w-full items-center gap-3">
              <ImageIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <p className="min-w-0 flex-1 truncate text-small font-medium text-foreground">
                {showFileName ?? "Uploading image"}
              </p>
              {optimizing ? (
                <p className="shrink-0 text-xs text-muted-foreground">
                  Optimizing…
                </p>
              ) : progress !== undefined && (
                <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {Math.round(Math.min(100, Math.max(0, progress)))}%
                </p>
              )}
            </div>
            <div
              role="progressbar"
              aria-label={optimizing ? "Optimizing image" : "Upload progress"}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={
                optimizing || progress === undefined
                  ? undefined
                  : Math.round(Math.min(100, Math.max(0, progress)))
              }
              className="h-1.5 w-full overflow-hidden rounded-full bg-border-subtle"
            >
              <div
                className={cn(
                  "h-full rounded-full bg-primary",
                  optimizing || progress === undefined
                    ? "w-2/5 motion-safe:animate-pulse"
                    : "transition-[width] duration-200",
                )}
                style={
                  optimizing || progress === undefined
                    ? undefined
                    : {
                        width: `${Math.min(100, Math.max(0, progress))}%`,
                      }
                }
              />
            </div>
            {onCancelUpload && !optimizing && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={handleCancel}
              >
                Cancel upload
              </Button>
            )}
          </>
        )}

        {view === "uploaded" && preview && (
          <>
            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-muted">
              <Image
                src={preview}
                alt="Event preview"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <div className="flex items-center gap-2 border-t border-border-subtle px-4 py-3">
              <p
                className={cn(
                  "min-w-0 flex-1 truncate text-small",
                  disabled ? "text-disabled-foreground" : "text-foreground",
                )}
              >
                {showFileName ?? "Image uploaded"}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                aria-describedby={describedBy}
                aria-invalid={hasError || undefined}
                onClick={openPicker}
              >
                Replace
              </Button>
              <IconButton
                label="Remove image"
                disabled={disabled}
                onClick={handleRemove}
              >
                <Trash2 aria-hidden />
              </IconButton>
            </div>
          </>
        )}

        {view === "empty" && (
          <>
            {presentation !== "header" && <ImageIcon
              className={cn(
                "size-5",
                disabled ? "text-disabled-foreground" : "text-muted-foreground",
              )}
              aria-hidden
            />}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              aria-describedby={describedBy}
              aria-invalid={hasError || undefined}
              onClick={openPicker}
            >
              {presentation === "header" ? "Upload header image" : "Upload image"}
            </Button>
            {showHint && (
              <p
                id={hintId}
                className={cn(
                  "max-w-64 text-center text-xs text-pretty",
                  presentation !== "default" && "max-w-none text-small",
                  disabled ? "text-disabled-foreground" : "text-muted-foreground",
                )}
              >
                {requirementsLine}
              </p>
            )}
          </>
        )}
      </div>

      <FieldError id={errorId}>{error}</FieldError>
      <ImageCropDialog
        source={cropping?.source ?? null}
        onCancel={closeCrop}
        onConfirm={confirmCrop}
        aspect={requirements.square ? 1 : requirements.aspect}
        minSize={{ width: requirements.minWidth, height: requirements.minHeight }}
        title="Crop image"
        description="Drag or use the arrow keys to choose what shows. Use the slider to zoom."
        confirmLabel="Use image"
        describeError={(caught) =>
          caught instanceof ImageTooLargeError ? caught.message : null
        }
        className={
          (requirements.aspect ?? 1) > 1 ? "sm:max-w-[640px]" : undefined
        }
      />
      <div role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
    </Field>
  );
};

/** Whether `size` already has the crop's shape, so the dialog can be skipped. */
function hasAspect(size: ImageDimensions, aspect: number, exact: boolean) {
  if (exact) return size.width === Math.round(size.height * aspect);
  return Math.abs(size.width / size.height / aspect - 1) <= ASPECT_TOLERANCE;
}
