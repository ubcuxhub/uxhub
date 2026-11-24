"use client";

import { ImageCropDialog, type CropResult } from "@/components/shared/ImageCropDialog";
import { CROP_OUTPUT_SIZE } from "@/lib/image-crop";

import { PhotoUploadError } from "./setup-client";

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
 * "Crop your photo" (Figma 4287:2, mobile 4320:2): the shared cropper with a
 * circle over a square frame. "Use photo" re-encodes the square through a
 * canvas, which also drops EXIF and GPS data.
 */
export function PhotoCropDialog({ photo, onCancel, onConfirm }: PhotoCropDialogProps) {
  return (
    <ImageCropDialog
      source={photo}
      onCancel={onCancel}
      onConfirm={async (crop) => onConfirm(await renderCrop(crop))}
      shape="circle"
      noun="photo"
      title="Crop your photo"
      description="Drag or use the arrow keys to move your photo. Use the slider to zoom."
      confirmLabel="Use photo"
      describeError={(caught) => (caught instanceof PhotoUploadError ? caught.message : null)}
    />
  );
}

/** Draws the kept square onto a canvas and encodes it as a JPEG. */
function renderCrop({ image, rect }: CropResult) {
  return new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = CROP_OUTPUT_SIZE;
    canvas.height = CROP_OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("No canvas"));
      return;
    }
    // JPEG has no transparency: a transparent PNG would turn black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
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
