/**
 * The membership card's interactions: hover tilt, press, drag to spin with
 * inertia and a snap to the nearest face, and the flip home from the back.
 *
 * Every tunable value is in `CARD`. The snap and the flip home take their
 * durations and easings from the motion tokens in `membership-card.css`
 * (`--duration-expressive` with `--ease-expressive` for the snap,
 * `--ease-in-out` for the flip home), not from here.
 */
export const CARD = {
  /** How far the card leans toward a hovering pointer at a corner (motion handoff, Home). */
  HOVER_TILT_DEG: 4,
  /** How far a press pushes the point under the pointer away, on top of the hover tilt. */
  PRESS_TILT_DEG: 3,
  /** Pointer movement before a press becomes a drag. */
  DRAG_THRESHOLD_PX: 6,
  /** Spin sensitivity: degrees of turn per pixel dragged. */
  DRAG_DEG_PER_PX: 0.5,
  /** How much spin speed survives each 60fps frame after a release ("slight" inertia). */
  INERTIA_FRICTION: 0.92,
  /** Below this speed (degrees per 60fps frame), inertia ends and the card snaps to a face. */
  INERTIA_STOP_DEG_PER_FRAME: 0.3,
  /** A release this long after the last movement counts as held still: no inertia. */
  RELEASE_STILL_MS: 80,
  /** Time resting on the back, with the pointer off the card, before it flips to the front. */
  BACK_IDLE_MS: 2000,
  /** How far the light travels across a face per unit of sin(rotation), in face widths. */
  SHINE_TRAVEL: 4,
  /** Peak opacity of the soft sheen over the back. */
  SHEEN_OPACITY: 0.35,
  /**
   * Peak opacity of the sheen over the front. Higher than the back's, since
   * soft-light shows less on the front's lighter orchid than on the back's blue.
   */
  FRONT_SHEEN_OPACITY: 0.55,
  /** Peak opacity of the glint on the dither cells. */
  GLINT_OPACITY: 0.5,
} as const;

/** The frame length `INERTIA_FRICTION` and `INERTIA_STOP_DEG_PER_FRAME` are written for. */
const FRAME_MS = 1000 / 60;

type Rect = Pick<DOMRect, "left" | "top" | "width" | "height">;

/** Where a point sits on the card, from -0.5 (left, top) to 0.5 (right, bottom), clamped. */
export function pointerOffset(rect: Rect, clientX: number, clientY: number) {
  const clamp = (value: number) => Math.min(0.5, Math.max(-0.5, value));
  return {
    x: clamp((clientX - rect.left) / rect.width - 0.5),
    y: clamp((clientY - rect.top) / rect.height - 0.5),
  };
}

/** The tilt that dips the point at `offset` away from the viewer, `deg` at a corner. */
export function leanAway(offset: { x: number; y: number }, deg: number) {
  return { x: -offset.y * 2 * deg, y: offset.x * 2 * deg };
}

/** The rest angle nearest `spin`: a multiple of 180°, front or back. */
export function nearestFace(spin: number) {
  return Math.round(spin / 180) * 180 || 0;
}

/** Whether the card at `spin` (a multiple of 180°) shows its back. */
export function showsBack(spin: number) {
  return Math.abs(Math.round(spin / 180)) % 2 === 1;
}

const deg = (value: number) => `${value.toFixed(2)}deg`;

/**
 * Wires the interactions onto the card. `frame` is the untransformed element
 * around the card that measures the pointer; `card` is the element that turns.
 * Mouse and trackpad only. Returns a cleanup that leaves the card flat on its
 * front.
 *
 * The card's turn lives in registered CSS properties on `card` (`--tilt-*`,
 * `--press-*`, `--spin`), so the CSS can derive the shine from the same
 * rotation. Tilts and press ease by CSS transition; the drag and inertia set
 * `--spin` per frame, and the snap and the flip home hand it to a CSS
 * transition (`data-spin`). No frame runs while the card is still.
 */
export function attachCardMotion(frame: HTMLElement, card: HTMLElement): () => void {
  let hovering = false;
  let press: { id: number; x: number; y: number } | null = null;
  let dragging = false;
  let spin = 0;
  /** The direction of the last spin, so the flip home keeps turning the same way. */
  let direction = 1;
  /** Degrees per millisecond. */
  let velocity = 0;
  let lastX = 0;
  let lastTime = 0;
  let hoverOffset = { x: 0, y: 0 };
  let hoverFrame = 0;
  let inertiaFrame = 0;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const style = card.style;
  const setSpin = (value: number) => {
    spin = value;
    style.setProperty("--spin", `${value.toFixed(3)}deg`);
  };
  const clearTilt = () => {
    cancelAnimationFrame(hoverFrame);
    hoverFrame = 0;
    style.removeProperty("--tilt-x");
    style.removeProperty("--tilt-y");
  };
  const clearPress = () => {
    style.removeProperty("--press-x");
    style.removeProperty("--press-y");
  };
  const clearIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = undefined;
  };

  /** Starts the flip home if the card rests on its back with nobody touching it. */
  const scheduleIdle = () => {
    clearIdle();
    if (!showsBack(spin) || hovering || press || inertiaFrame || card.dataset.spin) return;
    idleTimer = setTimeout(() => {
      idleTimer = undefined;
      spinTo(spin + 180 * direction, "return");
    }, CARD.BACK_IDLE_MS);
  };

  /** Rests on the face the card reached: 0 or 180, so the angle never grows. */
  const settle = () => {
    delete card.dataset.spin;
    setSpin(((nearestFace(spin) % 360) + 360) % 360);
    style.removeProperty("will-change");
    scheduleIdle();
  };

  const spinTo = (target: number, mode: "snap" | "return") => {
    if (Math.abs(target - spin) < 0.01) {
      setSpin(target);
      settle();
      return;
    }
    style.willChange = "transform";
    card.dataset.spin = mode;
    setSpin(target);
  };

  /** Stops any inertia, snap or flip home where it is, so a press takes over. */
  const halt = () => {
    clearIdle();
    cancelAnimationFrame(inertiaFrame);
    inertiaFrame = 0;
    if (card.dataset.spin) {
      const current = parseFloat(getComputedStyle(card).getPropertyValue("--spin"));
      delete card.dataset.spin;
      setSpin(Number.isFinite(current) ? current : spin);
    }
  };

  const fling = () => {
    const tooSlow = () => Math.abs(velocity) * FRAME_MS < CARD.INERTIA_STOP_DEG_PER_FRAME;
    if (tooSlow()) {
      spinTo(nearestFace(spin), "snap");
      return;
    }
    let previous = performance.now();
    const step = (now: number) => {
      const elapsed = Math.min(Math.max(now - previous, 0), 4 * FRAME_MS);
      previous = now;
      setSpin(spin + velocity * elapsed);
      velocity *= CARD.INERTIA_FRICTION ** (elapsed / FRAME_MS);
      if (tooSlow()) {
        inertiaFrame = 0;
        spinTo(nearestFace(spin), "snap");
      } else {
        inertiaFrame = requestAnimationFrame(step);
      }
    };
    style.willChange = "transform";
    inertiaFrame = requestAnimationFrame(step);
  };

  const applyHover = () => {
    hoverFrame = 0;
    const lean = leanAway(hoverOffset, CARD.HOVER_TILT_DEG);
    style.setProperty("--tilt-x", deg(lean.x));
    style.setProperty("--tilt-y", deg(lean.y));
  };

  const startDrag = (event: PointerEvent) => {
    dragging = true;
    card.dataset.dragging = "";
    frame.setPointerCapture?.(event.pointerId);
    window.getSelection()?.removeAllRanges();
    // A drag only spins: the tilt and press let go, so vertical movement does nothing.
    clearTilt();
    clearPress();
    style.willChange = "transform";
    lastX = event.clientX;
    lastTime = event.timeStamp;
    velocity = 0;
  };

  const drag = (event: PointerEvent) => {
    const dx = event.clientX - lastX;
    const elapsed = event.timeStamp - lastTime;
    if (dx !== 0) direction = Math.sign(dx);
    const turn = dx * CARD.DRAG_DEG_PER_PX;
    if (elapsed > 0) velocity = 0.8 * (turn / elapsed) + 0.2 * velocity;
    lastX = event.clientX;
    lastTime = event.timeStamp;
    setSpin(spin + turn);
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) selection.removeAllRanges();
  };

  const endPress = (event: PointerEvent, cancelled: boolean) => {
    if (!press || event.pointerId !== press.id) return;
    press = null;
    clearPress();
    if (!dragging) {
      // A press without a drag: finish any snap it interrupted. Never a click.
      spinTo(nearestFace(spin), "snap");
      return;
    }
    dragging = false;
    delete card.dataset.dragging;
    if (frame.hasPointerCapture?.(event.pointerId)) frame.releasePointerCapture(event.pointerId);
    const rect = frame.getBoundingClientRect();
    hovering =
      event.clientX >= rect.left &&
      event.clientX <= rect.left + rect.width &&
      event.clientY >= rect.top &&
      event.clientY <= rect.top + rect.height;
    if (cancelled || event.timeStamp - lastTime > CARD.RELEASE_STILL_MS) velocity = 0;
    fling();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    if (press && event.pointerId === press.id && !dragging) {
      const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      if (moved > CARD.DRAG_THRESHOLD_PX) startDrag(event);
    }
    if (dragging) {
      drag(event);
      return;
    }
    // Resting the pointer on the card counts as activity: the back stays up.
    hovering = true;
    clearIdle();
    hoverOffset = pointerOffset(frame.getBoundingClientRect(), event.clientX, event.clientY);
    if (!hoverFrame) hoverFrame = requestAnimationFrame(applyHover);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    halt();
    hovering = true;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY };
    const lean = leanAway(
      pointerOffset(frame.getBoundingClientRect(), event.clientX, event.clientY),
      CARD.PRESS_TILT_DEG,
    );
    style.setProperty("--press-x", deg(lean.x));
    style.setProperty("--press-y", deg(lean.y));
  };

  const onPointerUp = (event: PointerEvent) => endPress(event, false);
  const onPointerCancel = (event: PointerEvent) => endPress(event, true);

  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || dragging) return;
    hovering = false;
    clearTilt();
    if (press) {
      press = null;
      clearPress();
      spinTo(nearestFace(spin), "snap");
    }
    scheduleIdle();
  };

  const onTransitionEnd = (event: TransitionEvent) => {
    if (event.target === card && event.propertyName === "--spin" && card.dataset.spin) settle();
  };

  // The logo is an image; a native image drag would steal the pointer.
  const onDragStart = (event: DragEvent) => event.preventDefault();

  frame.addEventListener("pointermove", onPointerMove);
  frame.addEventListener("pointerdown", onPointerDown);
  frame.addEventListener("pointerup", onPointerUp);
  frame.addEventListener("pointercancel", onPointerCancel);
  frame.addEventListener("pointerleave", onPointerLeave);
  frame.addEventListener("dragstart", onDragStart);
  card.addEventListener("transitionend", onTransitionEnd);

  return () => {
    frame.removeEventListener("pointermove", onPointerMove);
    frame.removeEventListener("pointerdown", onPointerDown);
    frame.removeEventListener("pointerup", onPointerUp);
    frame.removeEventListener("pointercancel", onPointerCancel);
    frame.removeEventListener("pointerleave", onPointerLeave);
    frame.removeEventListener("dragstart", onDragStart);
    card.removeEventListener("transitionend", onTransitionEnd);
    clearIdle();
    cancelAnimationFrame(inertiaFrame);
    clearTilt();
    clearPress();
    delete card.dataset.spin;
    delete card.dataset.dragging;
    style.removeProperty("--spin");
    style.removeProperty("will-change");
  };
}
