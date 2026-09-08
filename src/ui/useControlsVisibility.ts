import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export const CONTROLS_IDLE_MS = 2800;

/** Only visibility transitions notify React; continuous activity just renews the timer. */
export function controlsIdleTimer(onHidden: (hidden: boolean) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hidden = false;
  let pinned = false;
  function changeHidden(next: boolean) {
    if (next === hidden) return;
    hidden = next;
    onHidden(next);
  }
  function activity() {
    clearTimeout(timer);
    changeHidden(false);
    if (!pinned) timer = setTimeout(() => changeHidden(true), CONTROLS_IDLE_MS);
  }
  return {
    activity,
    get hidden() {
      return hidden;
    },
    pin(value: boolean) {
      if (value === pinned) return;
      pinned = value;
      activity();
    },
    dispose() {
      clearTimeout(timer);
    },
  };
}

export function useControlsVisibility(isPlaying: boolean, inspectorOpen: boolean) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const [hidden, setHidden] = useState(false);
  const keepVisible = !isPlaying || inspectorOpen;

  useEffect(() => {
    const surface = surfaceRef.current!;
    const controls = controlsRef.current!;
    let dragging = false;
    let keyboardInput = false;
    let consumeTouchClick = false;
    const idle = controlsIdleTimer((nextHidden) => {
      // Pointer-clicked Play can retain focus. Release it before making the subtree inert.
      if (nextHidden && controls.contains(document.activeElement))
        (document.activeElement as HTMLElement).blur();
      setHidden(nextHidden);
    });
    function activity() {
      const focused = document.activeElement;
      const keyboardFocus =
        focused instanceof HTMLElement &&
        controls.contains(focused) &&
        (keyboardInput || focused.matches(':focus-visible'));
      idle.pin(
        keepVisible ||
          hovering.current ||
          dragging ||
          keyboardFocus ||
          Boolean(controls.querySelector('details[open]')),
      );
      idle.activity();
    }
    function pointerDown(event: PointerEvent) {
      keyboardInput = false;
      consumeTouchClick = event.pointerType === 'touch' && idle.hidden;
      dragging = controls.contains(event.target as Node);
      activity();
      // The first tap reveals controls, even if they appear underneath the finger.
      if (consumeTouchClick) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    function pointerUp() {
      dragging = false;
      activity();
    }
    function pointerCancel() {
      consumeTouchClick = false;
      pointerUp();
    }
    function click(event: MouseEvent) {
      if (!consumeTouchClick) return;
      consumeTouchClick = false;
      event.preventDefault();
      event.stopPropagation();
    }
    function enter(event: PointerEvent) {
      hovering.current = event.pointerType !== 'touch';
      activity();
    }
    function leave() {
      hovering.current = false;
      activity();
    }
    function keyDown() {
      consumeTouchClick = false;
      keyboardInput = true;
      // Remove inert before the browser's default Tab navigation chooses its next target.
      if (idle.hidden) flushSync(activity);
      else activity();
    }
    function focusOut() {
      if (!idle.hidden) activity();
    }
    setHidden(false);
    activity();
    surface.addEventListener('pointermove', activity);
    surface.addEventListener('pointerdown', pointerDown, true);
    surface.addEventListener('click', click, true);
    controls.addEventListener('pointerenter', enter);
    controls.addEventListener('pointerleave', leave);
    controls.addEventListener('focusin', activity);
    controls.addEventListener('focusout', focusOut);
    controls.addEventListener('toggle', activity, true);
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerCancel);
    window.addEventListener('keydown', keyDown, true);
    return () => {
      idle.dispose();
      surface.removeEventListener('pointermove', activity);
      surface.removeEventListener('pointerdown', pointerDown, true);
      surface.removeEventListener('click', click, true);
      controls.removeEventListener('pointerenter', enter);
      controls.removeEventListener('pointerleave', leave);
      controls.removeEventListener('focusin', activity);
      controls.removeEventListener('focusout', focusOut);
      controls.removeEventListener('toggle', activity, true);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', pointerCancel);
      window.removeEventListener('keydown', keyDown, true);
    };
  }, [keepVisible]);

  return { surfaceRef, controlsRef, hidden: hidden && !keepVisible };
}
