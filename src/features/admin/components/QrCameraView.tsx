"use client";

import { useEffect, useRef, useState } from "react";
import type QrScanner from "qr-scanner";
import { CameraOff } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";

export type CameraProblem = "blocked" | "missing" | "insecure" | "failed";

const PROBLEMS: Record<CameraProblem, { title: string; description: string }> = {
  blocked: {
    title: "Camera access is off",
    description:
      "Allow camera access for this site in your browser settings, then reload the page.",
  },
  missing: {
    title: "No camera found",
    description: "Use a phone with a camera, or look people up by name.",
  },
  insecure: {
    title: "The camera needs a secure connection",
    description: "Open this page over https.",
  },
  failed: {
    title: "The camera didn't start",
    description: "Close other apps using the camera, then reload the page.",
  },
};

/** Sorts a failed camera start into something the admin can act on. */
export function cameraProblem(error: unknown, secure: boolean): CameraProblem {
  if (!secure) return "insecure";

  const name =
    error && typeof error === "object" && "name" in error ? error.name : null;
  if (name === "NotAllowedError" || name === "SecurityError") return "blocked";
  if (
    name === "NotFoundError" ||
    name === "OverconstrainedError" ||
    error === "Camera not found."
  ) {
    return "missing";
  }
  return "failed";
}

interface QrCameraViewProps {
  /** Stops reading codes, and turns the camera off until resumed. */
  paused: boolean;
  /** Called with each code the camera reads while not paused. */
  onScan: (code: string) => void;
}

/** The rear camera, reading QR codes. */
export function QrCameraView({ paused, onScan }: QrCameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  const [state, setState] = useState<"starting" | "ready" | CameraProblem>(
    "starting"
  );

  useEffect(() => {
    onScanRef.current = onScan;
    pausedRef.current = paused;
  });

  useEffect(() => {
    let cancelled = false;
    let scanner: QrScanner | null = null;

    (async () => {
      try {
        // Loaded here so the decoder never runs during the server render.
        const { default: QrScannerClass } = await import("qr-scanner");
        const video = videoRef.current;
        if (cancelled || !video) return;

        scanner = new QrScannerClass(
          video,
          // The library restarts itself when the tab becomes visible again,
          // so a pause is enforced here as well.
          (result) => {
            if (!pausedRef.current) onScanRef.current(result.data);
          },
          {
            returnDetailedScanResult: true,
            preferredCamera: "environment",
            maxScansPerSecond: 10,
            // Most frames hold no code; that is not an error.
            onDecodeError: () => {},
          }
        );
        scannerRef.current = scanner;
        if (!pausedRef.current) await scanner.start();
        if (!cancelled) setState("ready");
      } catch (error) {
        if (!cancelled) setState(cameraProblem(error, window.isSecureContext));
      }
    })();

    return () => {
      cancelled = true;
      scanner?.destroy();
      scannerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner || state !== "ready") return;

    if (paused) {
      void scanner.pause();
      return;
    }
    scanner
      .start()
      .catch((error: unknown) =>
        setState(cameraProblem(error, window.isSecureContext))
      );
  }, [paused, state]);

  const problem = state === "starting" || state === "ready" ? null : PROBLEMS[state];

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
      <video
        ref={videoRef}
        muted
        playsInline
        aria-label="Camera preview"
        className="size-full object-cover"
        hidden={problem !== null}
      />
      {state === "starting" ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size="lg" label="Starting the camera" />
        </div>
      ) : null}
      {problem ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <EmptyState
            icon={<CameraOff />}
            title={problem.title}
            description={problem.description}
          />
        </div>
      ) : null}
    </div>
  );
}
