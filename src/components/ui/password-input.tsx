"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PasswordInputProps
  extends Omit<React.ComponentProps<typeof Input>, "type" | "leadingIcon"> {
  /**
   * Names the show/hide button: its `aria-label` and tooltip. It stays the
   * same in both states; `aria-pressed` says whether the password is showing.
   * Default "Show password".
   */
  toggleLabel?: string;
  /** Start with the password visible. Uncontrolled; the button toggles it. */
  defaultVisible?: boolean;
  /** Called after the button shows or hides the password. */
  onVisibleChange?: (visible: boolean) => void;
}

/**
 * A password field with a show/hide toggle (§3.2). Renders `Input`, so it
 * picks up a surrounding `Field`'s description, error and invalid state, and
 * passes `autoComplete` through so password managers still fill it.
 *
 * - The toggle keeps the caret: a mouse press doesn't take focus from the
 *   field, and the selection is restored after the type changes.
 * - Showing the password turns off autocorrect, autocapitalise and spellcheck,
 *   so a mobile keyboard doesn't rewrite it and a spellcheck service never
 *   sees it.
 * - Submitting the form hides it again, so the browser saves it as a password.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      toggleLabel = "Show password",
      defaultVisible = false,
      onVisibleChange,
      className,
      wrapperClassName,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [visible, setVisible] = React.useState(defaultVisible);
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const selection = React.useRef<[number, number] | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    // Changing `type` can drop the selection (Safari moves the caret to the
    // end), so put back the one saved when the button was pressed.
    React.useLayoutEffect(() => {
      const input = inputRef.current;
      const saved = selection.current;
      selection.current = null;
      if (!input || !saved || document.activeElement !== input) return;
      input.setSelectionRange(saved[0], saved[1]);
    }, [visible]);

    // Hide on submit: a password manager only offers to save a field that is
    // `type=password` when the form goes. The DOM write runs before the
    // browser reads the form; the state update keeps React in step.
    React.useEffect(() => {
      const form = inputRef.current?.form;
      if (!form) return;
      const hide = () => {
        if (inputRef.current) inputRef.current.type = "password";
        setVisible(false);
      };
      form.addEventListener("submit", hide, true);
      return () => form.removeEventListener("submit", hide, true);
    }, []);

    const toggle = () => {
      const input = inputRef.current;
      if (input && document.activeElement === input) {
        selection.current = [
          input.selectionStart ?? input.value.length,
          input.selectionEnd ?? input.value.length,
        ];
      }
      const next = !visible;
      setVisible(next);
      onVisibleChange?.(next);
    };

    return (
      <div
        data-slot="password-input"
        className={cn("relative w-full", wrapperClassName)}
      >
        <Input
          {...props}
          ref={setRefs}
          type={visible ? "text" : "password"}
          disabled={disabled}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cn("pr-11", className)}
        />
        <IconButton
          variant="ghost"
          size="icon-sm"
          label={toggleLabel}
          aria-pressed={visible}
          aria-controls={props.id}
          disabled={disabled}
          // Keep focus (and the caret) in the field on a mouse or touch press.
          // Keyboard users reach the button with Tab and stay on it.
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggle}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground aria-pressed:bg-transparent aria-pressed:hover:bg-muted"
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </IconButton>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
