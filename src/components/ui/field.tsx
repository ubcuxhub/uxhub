"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

/**
 * What a `Field` knows about the control inside it: the ids its description and
 * error carry, and whether the error is showing. `FieldDescription` and
 * `FieldError` register themselves while mounted; a control calls
 * `useFieldControl()` to link to them.
 */
type FieldContextValue = {
  descriptionId: string
  errorId: string
  /** The ids of the description and error that are mounted right now. */
  registered: { description?: string; error?: string }
  register: (kind: "description" | "error", id: string | null) => void
  invalid: boolean
}

const FieldContext = createContext<FieldContextValue | null>(null)

/**
 * Joins `aria-describedby` id lists, dropping blanks and repeats. Returns
 * `undefined` when nothing is left, so the attribute is omitted.
 */
function joinIds(...lists: Array<string | undefined | null | false>) {
  const ids = lists.flatMap((list) => (list ? list.split(/\s+/) : []))
  const unique = [...new Set(ids.filter(Boolean))]
  return unique.length ? unique.join(" ") : undefined
}

/**
 * For a form control inside a `Field`: the `aria-describedby` that points at the
 * field's mounted description and error, and `aria-invalid` while the field is
 * invalid (an error is showing, or the `Field` has `data-invalid`). Outside a
 * `Field` both are `undefined`, so a control can spread them unconditionally.
 * Merge with the control's own props: `joinIds(own, describedBy)` and
 * `own ?? invalid`.
 */
function useFieldControl(): {
  describedBy: string | undefined
  invalid: true | undefined
} {
  const field = useContext(FieldContext)
  if (!field) return { describedBy: undefined, invalid: undefined }
  return {
    describedBy: joinIds(field.registered.description, field.registered.error),
    invalid: field.invalid || undefined,
  }
}

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-6",
        "has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
        className
      )}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "mb-3",
        "data-[variant=legend]:text-subheading",
        "data-[variant=label]:text-body-medium",
        className
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-6 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4",
        className
      )}
      {...props}
    />
  )
}

const fieldVariants = cva(
  "group/field flex w-full gap-3",
  {
    variants: {
      orientation: {
        vertical: ["flex-col gap-2 [&>*]:w-full [&>.sr-only]:w-auto"],
        horizontal: [
          "flex-row items-center",
          "[&>[data-slot=field-label]]:flex-auto",
          "has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px has-[>[data-slot=field-content]]:[&>input[type=checkbox]]:mt-0.5",
        ],
        responsive: [
          "flex-col @md/field-group:flex-row @md/field-group:items-center [&>*]:w-full @md/field-group:[&>*]:w-auto [&>.sr-only]:w-auto",
          "@md/field-group:[&>[data-slot=field-label]]:flex-auto",
          "@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px @md/field-group:has-[>[data-slot=field-content]]:[&>input[type=checkbox]]:mt-0.5",
        ],
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
)

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  const baseId = useId()
  const [registered, setRegistered] = useState<FieldContextValue["registered"]>(
    {}
  )
  const register = useCallback<FieldContextValue["register"]>((kind, id) => {
    setRegistered((current) => {
      const next = id ?? undefined
      return current[kind] === next ? current : { ...current, [kind]: next }
    })
  }, [])

  const dataInvalid = (props as Record<string, unknown>)["data-invalid"]
  const invalid =
    Boolean(registered.error) ||
    dataInvalid === true ||
    dataInvalid === "true"

  const context = useMemo<FieldContextValue>(
    () => ({
      descriptionId: `${baseId}-description`,
      errorId: `${baseId}-error`,
      registered,
      register,
      invalid,
    }),
    [baseId, registered, register, invalid]
  )

  return (
    <FieldContext.Provider value={context}>
      <div
        role="group"
        data-slot="field"
        data-orientation={orientation}
        className={cn(fieldVariants({ orientation }), className)}
        {...props}
      />
    </FieldContext.Provider>
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        "group/field-content flex flex-1 flex-col gap-1.5 leading-snug",
        className
      )}
      {...props}
    />
  )
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "group/field-label peer/field-label flex w-fit gap-2 group-data-[disabled=true]/field:text-disabled-foreground",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-xl has-[>[data-slot=field]]:border [&>*]:data-[slot=field]:p-4",
        // Only a radio card (a label that wraps a whole Field) is outlined when
        // checked. A plain `<FieldLabel><Checkbox /> Text</FieldLabel>` is not.
        "has-[>[data-slot=field]]:has-data-[state=checked]:border-primary has-[>[data-slot=field]]:has-data-[state=checked]:ring-1 has-[>[data-slot=field]]:has-data-[state=checked]:ring-primary has-[>[data-slot=field]]:has-[:checked]:border-primary has-[>[data-slot=field]]:has-[:checked]:ring-1 has-[>[data-slot=field]]:has-[:checked]:ring-primary",
        className
      )}
      {...props}
    />
  )
}

/**
 * A label with an action at the far end of the row ("Forgot password?"). The
 * label stays first in the DOM, so Tab goes label action, then the input.
 * Never nest the action inside the `<label>`.
 */
function FieldLabelRow({
  className,
  action,
  children,
  ...props
}: React.ComponentProps<"div"> & { action?: React.ReactNode }) {
  return (
    <div
      data-slot="field-label-row"
      className={cn("flex items-baseline justify-between gap-3", className)}
      {...props}
    >
      {children}
      {action}
    </div>
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "flex w-fit items-center gap-2 text-body-medium group-data-[disabled=true]/field:text-disabled-foreground",
        className
      )}
      {...props}
    />
  )
}

function FieldDescription({
  className,
  id: idProp,
  ...props
}: React.ComponentProps<"p">) {
  const field = useContext(FieldContext)
  const register = field?.register
  const id = idProp ?? field?.descriptionId

  useEffect(() => {
    if (!register || !id) return
    register("description", id)
    return () => register("description", null)
  }, [register, id])

  return (
    <p
      id={id}
      data-slot="field-description"
      className={cn(
        "text-small text-muted-foreground group-has-[[data-orientation=horizontal]]/field:text-balance",
        "last:mt-0 nth-last-2:-mt-1 [[data-variant=legend]+&]:-mt-1.5",
        "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        "relative -my-2 h-5 text-small group-data-[variant=outline]/field-group:-mb-2",
        className
      )}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2 bg-border-subtle" />
      {children && (
        <span
          className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  )
}

function FieldError({
  className,
  children,
  errors,
  id: idProp,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>
}) {
  const field = useContext(FieldContext)
  const register = field?.register
  const id = idProp ?? field?.errorId
  const content = useMemo(() => {
    if (children) {
      return children
    }

    if (!errors?.length) {
      return null
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ]

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>
        )}
      </ul>
    )
  }, [children, errors])

  const showing = Boolean(content)
  useEffect(() => {
    if (!register || !id || !showing) return
    register("error", id)
    return () => register("error", null)
  }, [register, id, showing])

  if (!content) {
    return null
  }

  return (
    <div
      id={id}
      role="alert"
      data-slot="field-error"
      className={cn("text-small text-destructive", className)}
      {...props}
    >
      {content}
    </div>
  )
}

export {
  Field,
  FieldLabel,
  FieldLabelRow,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
  joinIds,
  useFieldControl,
}
