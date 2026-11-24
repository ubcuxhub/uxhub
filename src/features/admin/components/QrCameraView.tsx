"use client";

import { useEffect, useRef, useState } from "react";
import type QrScanner from "qr-scanner";
import { CameraOff, Search } from "lucide-react";

import { ScannerViewfinder } from "@/components/shared/ScannerFrame";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CheckInPanel } from "./CheckInPanel";

export type CameraProblem = "blocked" | "missing" | "insecure" | "failed";

const PROBLEMS: Record<CameraProblem, { title: string; description: string; }> = {
  blocked: {
    title: "Camera access is off",
    description:
      "The portal needs your camera to read tickets. Allow camera access for this site in your browser settings, then try again. You can still check people in by searching their name.",
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
  if (!secure)
    return "insecure";

  const name =
    error && typeof error === "object" && "name" in error ? error.name : null;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "blocked";
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
  onSearch?: () => void;
  /** Told when a camera problem replaces the preview, and when it clears. */
  onProblemChange?: (problem: CameraProblem | null) => void;
}

/** A camera that can't start: what went wrong, and the ways forward. */
export function CameraProblemPanel({ problem, onRetry, onSearch }: { problem: CameraProblem; onRetry: () => void; onSearch?: () => void; }) {
  const { title, description } = PROBLEMS[problem];
  return <CheckInPanel tone="neutral" icon={<CameraOff />} title={title} actions={<>
    {onSearch ? <Button variant="secondary" onClick={onSearch}><Search aria-hidden />Search attendees</Button> : null}
    <Button onClick={onRetry}>Try again</Button>
  </>}>
    <p className="max-w-sm text-small text-muted-foreground">{description}</p>
  </CheckInPanel>;
}

/** The rear camera, reading QR codes. */
export function QrCameraView({ paused, onScan, onSearch, onProblemChange }: QrCameraViewProps) {
  const [attempt, setAttempt] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const onScanRef = useRef(onScan);
  const onProblemChangeRef = useRef(onProblemChange);
  const pausedRef = useRef(paused);
  const [state, setState] = useState<"starting" | "ready" | CameraProblem>(
    "starting"
  );

  useEffect(() => {
    onScanRef.current = onScan;
    onProblemChangeRef.current = onProblemChange;
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
        if (cancelled || !video)
          return;

        scanner = new QrScannerClass(
          video,
          // The library restarts itself when the tab becomes visible again,
          // so a pause is enforced here as well.
          (result) => {
            if (!cancelled && !pausedRef.current)
              onScanRef.current(result.data);
          },
          {
            returnDetailedScanResult: true,
            preferredCamera: "environment",
            maxScansPerSecond: 10,
            // Most frames hold no code; that is not an error.
            onDecodeError: () => { },
          }
        );
        scannerRef.current = scanner;
        if (!pausedRef.current)
          await scanner.start();
        if (cancelled || pausedRef.current)
          scanner.stop();
        if (!cancelled)
          setState("ready");
      } catch (error) {
        if (!cancelled)
          setState(cameraProblem(error, window.isSecureContext));
      }
    })();

    return () => {
      cancelled = true;
      scanner?.destroy();
      scannerRef.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner || state !== "ready")
      return;

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

  const problem = state === "starting" || state === "ready" ? null : state;

  useEffect(() => {
    onProblemChangeRef.current?.(problem);
  }, [problem]);
  useEffect(() => () => onProblemChangeRef.current?.(null), []);

  if (problem)
    return <CameraProblemPanel problem={problem} onSearch={onSearch} onRetry={() => {
      setState("starting");

      setAttempt(value => value + 1);
    }} />;
  return <ScannerViewfinder>
    <div className="relative size-full bg-muted">
      <video ref={videoRef} muted playsInline aria-label="Camera preview" className="size-full object-cover" />
      {state === "starting" ? <div className="absolute inset-0 flex items-center justify-center">
        <Spinner size="lg" label="Starting the camera" />
      </div> : null}
    </div>
  </ScannerViewfinder>;
}
