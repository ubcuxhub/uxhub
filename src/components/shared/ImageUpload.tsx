"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import {
  EVENT_IMAGE_ERRORS,
  EVENT_IMAGE_MAX_BYTES,
  EVENT_IMAGE_MAX_MB,
  isAllowedEventImageType,
  resolveImagePreviewSrc,
} from "@/lib/event-image";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
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

interface ImageUploadProps {
  value?: string;
  onChange: (path: string) => void;
  onFileChange?: (file: File | null) => void;
  disabled?: boolean;
  /** Shows the uploading state; the component is not uploading on its own yet. */
  uploading?: boolean;
}

export const ImageUpload = ({
  value,
  onChange,
  onFileChange,
  disabled = false,
  uploading = false,
}: ImageUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingInternal, setIsUploading] = useState(false);
  const isUploading = uploading || isUploadingInternal;
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(() =>
    value ? resolveImagePreviewSrc(value) : null
  );
  const [previewedValue, setPreviewedValue] = useState(value);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A new stored image (after a save, or a form reset) replaces whatever
  // preview is showing, including one read from a picked file.
  if (value !== previewedValue) {
    setPreviewedValue(value);
    setPreview(value ? resolveImagePreviewSrc(value) : null);
  }

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFile(file);
    }
  };

  const handleFileInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };

  const handleFile = async (file: File) => {
    // Validate file type
    if (!isAllowedEventImageType(file.type)) {
      setError(EVENT_IMAGE_ERRORS.type);
      return;
    }

    // Mirrors the server-side limit in @/lib/event-image.
    if (file.size > EVENT_IMAGE_MAX_BYTES) {
      setError(EVENT_IMAGE_ERRORS.size);
      return;
    }

    const dimensions = await getImageDimensions(file).catch(() => null);
    if (!dimensions) {
      setError(EVENT_IMAGE_ERRORS.dimensions);
      return;
    }

    if (dimensions.width !== dimensions.height) {
      setError(EVENT_IMAGE_ERRORS.square);
      return;
    }

    setError(null);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      onFileChange?.(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read image");
      setPreview(null);
      onFileChange?.(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onFileChange?.(null);
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor="image_upload">Image cover for the event</FieldLabel>
      <div
        className={cn(
          "relative rounded-2xl border-[1.5px] border-dashed p-6 transition-colors",
          disabled
            ? "cursor-not-allowed border-action-disabled-border bg-action-disabled-bg"
            : isDragging
              ? "cursor-pointer border-action bg-surface-secondary"
              : "cursor-pointer border-border hover:border-fg-secondary hover:bg-surface-hover",
          error && !isDragging && "border-error",
        )}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />

        {isUploading ? (
          <div className="flex min-h-36 flex-col items-center justify-center gap-3">
            <Spinner size="lg" />
            <p className="text-small text-fg-secondary">Uploading…</p>
          </div>
        ) : preview ? (
          <div className="relative">
            <div className="relative h-48 w-full">
              <Image
                src={preview}
                alt="Event preview"
                fill
                className="rounded-lg object-contain"
                unoptimized
              />
            </div>

            {!disabled && (
              <IconButton
                label="Remove image"
                className="absolute top-2 right-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
              >
                <X aria-hidden />
              </IconButton>
            )}
          </div>
        ) : (
          <div className="flex min-h-36 flex-col items-center justify-center gap-4 text-center">
            <span
              className={cn(
                "flex size-12 items-center justify-center rounded-full",
                disabled
                  ? "bg-action-disabled-bg text-fg-disabled"
                  : "bg-surface-subtle text-fg-secondary",
              )}
            >
              <ImagePlus className="size-6" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <p
                className={cn(
                  "text-body-medium",
                  disabled ? "text-fg-disabled" : "text-fg",
                )}
              >
                Upload image
              </p>
              <p
                className={cn(
                  "text-small",
                  disabled ? "text-fg-disabled" : "text-fg-secondary",
                )}
              >
                Or drag one here. Square JPG or PNG, up to {EVENT_IMAGE_MAX_MB} MB.
              </p>
            </div>
          </div>
        )}
      </div>
      <FieldError>{error}</FieldError>
    </Field>
  );
};
