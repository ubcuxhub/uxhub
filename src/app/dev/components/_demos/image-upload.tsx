"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ImageUpload } from "@/components/shared/ImageUpload";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

const noop = () => {};

const gradient = (width: number, height: number) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3A5FC4"/><stop offset="1" stop-color="#B67FC6"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/></svg>`,
  );

const SQUARE_IMAGE = gradient(600, 600);
const HEADER_IMAGE = gradient(1600, 400);

const THUMBNAIL = { square: true, minWidth: 600, minHeight: 600 };
const HEADER = { minWidth: 1600, minHeight: 400 };

const GIF_ERROR = "That file is a GIF. Upload a JPG or PNG.";

/** Fires a real `dragenter` so the dropzone shows its dragging state without a file. */
function Dragging({ requirements }: { requirements: typeof THUMBNAIL }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>("[data-slot=image-upload]")
      ?.dispatchEvent(
        new DragEvent("dragenter", { bubbles: true, cancelable: true }),
      );
  }, []);
  return (
    <div ref={ref} className="w-full">
      <ImageUpload
        label="Header image"
        requirements={requirements}
        onChange={noop}
      />
    </div>
  );
}

/**
 * Picks a real file, then pretends to upload it with a timer so the progress,
 * Cancel upload and completion announcements can be tried. "Fail" ends the
 * upload with an error and a toast.
 */
function LiveUpload() {
  const [value, setValue] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const failAt = useRef<number | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const start = (url: string, name: string, failAtPercent: number | null) => {
    stop();
    failAt.current = failAtPercent;
    setError(null);
    setFileName(name);
    setProgress(0);
    setUploading(true);
    let current = 0;
    timer.current = setInterval(() => {
      current += 4;
      if (failAt.current !== null && current >= failAt.current) {
        stop();
        setUploading(false);
        setError("Couldn’t upload the image. Check your connection and try again.");
        toast.error("Couldn’t upload the image", {
          description: "Check your connection and try again.",
        });
        return;
      }
      if (current >= 100) {
        stop();
        setProgress(100);
        setUploading(false);
        setValue(url);
        return;
      }
      setProgress(current);
    }, 120);
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <ImageUpload
        label="Header image"
        requirements={HEADER}
        value={value}
        fileName={fileName}
        uploading={uploading}
        progress={progress}
        error={error}
        onChange={(path) => {
          setValue(path || undefined);
          setFileName(undefined);
        }}
        onFileChange={(file) => {
          if (file) start(URL.createObjectURL(file), file.name, null);
        }}
        onCancelUpload={() => {
          stop();
          setUploading(false);
          setProgress(0);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => start(HEADER_IMAGE, "design-sprint-header.jpg", null)}
        >
          Simulate upload
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => start(HEADER_IMAGE, "design-sprint-header.jpg", 60)}
        >
          Simulate failed upload
        </Button>
      </div>
    </div>
  );
}

function ImageUploadDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="ImageUpload · thumbnail"
        spec="§3.12"
        min="min(16rem, 100%)"
        description="Square JPG or PNG, 600 × 600 px or larger. The states in Figma order: Empty, Dragging, Uploading, Uploaded, Error, then Disabled."
      >
        <Specimen label="Empty" bare>
          <div className="w-full">
            <ImageUpload label="Event thumbnail" requirements={THUMBNAIL} onChange={noop} />
          </div>
        </Specimen>
        <Specimen label="Dragging (dragenter fired on mount)" bare>
          <Dragging requirements={THUMBNAIL} />
        </Specimen>
        <Specimen label="Uploading, 64% with Cancel upload" bare>
          <div className="w-full">
            <ImageUpload
              label="Event thumbnail"
              requirements={THUMBNAIL}
              uploading
              progress={64}
              fileName="design-sprint-thumbnail.jpg"
              onCancelUpload={noop}
              onChange={noop}
            />
          </div>
        </Specimen>
        <Specimen label="Uploading, no progress" bare>
          <div className="w-full">
            <ImageUpload
              label="Event thumbnail"
              requirements={THUMBNAIL}
              uploading
              fileName="design-sprint-thumbnail.jpg"
              onCancelUpload={noop}
              onChange={noop}
            />
          </div>
        </Specimen>
        <Specimen label="Uploaded, with Replace" bare>
          <div className="w-full">
            <ImageUpload
              label="Event thumbnail"
              requirements={THUMBNAIL}
              value={SQUARE_IMAGE}
              fileName="design-sprint-thumbnail.jpg"
              onChange={noop}
            />
          </div>
        </Specimen>
        <Specimen label="Error, wrong type" bare>
          <div className="w-full">
            <ImageUpload
              label="Event thumbnail"
              requirements={THUMBNAIL}
              error={GIF_ERROR}
              onChange={noop}
            />
          </div>
        </Specimen>
        <Specimen label="Error, with an image already uploaded" bare>
          <div className="w-full">
            <ImageUpload
              label="Event thumbnail"
              requirements={THUMBNAIL}
              value={SQUARE_IMAGE}
              fileName="design-sprint-thumbnail.jpg"
              error="Image must be at least 600 × 600 px."
              onChange={noop}
            />
          </div>
        </Specimen>
        <Specimen label="Disabled" bare>
          <div className="w-full">
            <ImageUpload label="Event thumbnail" requirements={THUMBNAIL} disabled onChange={noop} />
          </div>
        </Specimen>
        <Specimen label="Disabled, uploaded" bare>
          <div className="w-full">
            <ImageUpload
              label="Event thumbnail"
              requirements={THUMBNAIL}
              value={SQUARE_IMAGE}
              fileName="design-sprint-thumbnail.jpg"
              disabled
              onChange={noop}
            />
          </div>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="ImageUpload · header"
        spec="§3.12"
        min="min(22rem, 100%)"
        description="JPG or PNG, 1600 × 400 px or larger, not square. A square image is fine; a smaller one is rejected."
      >
        <Specimen label="Empty" bare>
          <div className="w-full">
            <ImageUpload label="Header image" requirements={HEADER} onChange={noop} />
          </div>
        </Specimen>
        <Specimen label="Uploaded, wide image" bare>
          <div className="w-full">
            <ImageUpload
              label="Header image"
              requirements={HEADER}
              value={HEADER_IMAGE}
              fileName="design-sprint-header.jpg"
              onChange={noop}
            />
          </div>
        </Specimen>
        <Specimen label="Error, too small" bare>
          <div className="w-full">
            <ImageUpload
              label="Header image"
              requirements={HEADER}
              error="Image must be at least 1600 × 400 px."
              onChange={noop}
            />
          </div>
        </Specimen>
        <Specimen label="Custom hint" bare>
          <div className="w-full">
            <ImageUpload
              label="Header image"
              requirements={HEADER}
              hint="Drop a banner here. It shows at the top of the event page."
              onChange={noop}
            />
          </div>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="ImageUpload · live"
        spec="§3.12"
        min="min(28rem, 100%)"
        description="Pick a real file (JPG or PNG, 1600 × 400 or larger) or use the buttons. Uploading is simulated with a timer. Progress is announced in 25% steps; a failed upload fires a toast. Try a GIF or a small image to see the validation errors."
      >
        <Specimen label="Pick a file, then watch it upload" bare>
          <LiveUpload />
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default ImageUploadDemo;
