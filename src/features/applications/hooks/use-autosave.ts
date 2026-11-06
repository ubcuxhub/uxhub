"use client";

import { useEffect, useLayoutEffect, useState } from "react";

import {
  createAutosave,
  type Autosave,
  type AutosaveHandlers,
  type AutosaveState,
} from "../lib/autosave";

/**
 * An autosave controller for the component's lifetime, and its state to
 * render. `read` and `write` may close over fresh props each render; the
 * controller always calls the latest. Anything waiting is saved when the tab
 * is hidden and when the component unmounts (an in-app navigation away).
 */
export function useAutosave<Payload>({
  read,
  write,
}: AutosaveHandlers<Payload>): [AutosaveState, Autosave<Payload>] {
  const [state, setState] = useState<AutosaveState>({ kind: "idle" });
  const [autosave] = useState(() => createAutosave<Payload>({ onState: setState }));
  useLayoutEffect(() => {
    autosave.configure({ read, write });
  });

  useEffect(() => {
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") void autosave.flush();
    };
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", saveWhenHidden);
      void autosave.flush();
    };
  }, [autosave]);

  return [state, autosave];
}
