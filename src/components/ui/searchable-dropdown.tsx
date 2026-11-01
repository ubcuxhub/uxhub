"use client"

import * as React from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"

import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { useActiveDescendant } from "@/hooks/use-active-descendant"
import { cn } from "@/lib/utils"

export interface SearchableOption {
  value: string
  label: string
  description?: string
  lead?: React.ReactNode
  keywords?: readonly string[]
}

interface CommonProps {
  id?: string
  options: readonly SearchableOption[]
  placeholder: string
  noResults?: (query: string) => React.ReactNode
  noResultsHint?: string
  onQueryChange?: (query: string) => void
  loading?: boolean
  filter?: (option: SearchableOption, query: string) => boolean
  name?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
  /** Names the field from another element. Beats `aria-label`; a `<label for>` also works. */
  "aria-labelledby"?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

export type SearchableDropdownProps = CommonProps & (
  | { multiple?: false; value: string | null; onValueChange: (value: string | null) => void }
  | { multiple: true; value: readonly string[]; onValueChange: (value: string[]) => void; addPlaceholder?: string }
)

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase()

/** Bold every matching span while keeping the original accents and casing. */
export function highlightMatch(text: string, query: string): React.ReactNode {
  const needle = normalize(query.trim())
  if (!needle) return text
  const chars = Array.from(text)
  const offsets: number[] = []
  let folded = ""
  chars.forEach((char, index) => {
    const part = normalize(char)
    for (let i = 0; i < part.length; i++) offsets.push(index)
    folded += part
  })
  const hits = new Set<number>()
  let start = 0
  while ((start = folded.indexOf(needle, start)) !== -1) {
    for (let i = start; i < start + needle.length; i++) hits.add(offsets[i])
    start += needle.length
  }
  if (!hits.size) return text
  const pieces: React.ReactNode[] = []
  for (let i = 0; i < chars.length;) {
    const marked = hits.has(i)
    let end = i + 1
    while (end < chars.length && hits.has(end) === marked) end++
    const chunk = chars.slice(i, end).join("")
    pieces.push(marked ? <mark key={i} className="bg-transparent font-semibold text-foreground">{chunk}</mark> : chunk)
    i = end
  }
  return <>{pieces}</>
}

function defaultFilter(option: SearchableOption, query: string) {
  const needle = normalize(query.trim())
  return !needle || [option.label, ...(option.keywords ?? [])].some((part) => normalize(part).includes(needle))
}

export function SearchableDropdown(props: SearchableDropdownProps) {
  const { options, placeholder, noResults, noResultsHint, onQueryChange, loading = false,
    filter = defaultFilter, name, disabled, className, id, "aria-label": ariaLabel,
    "aria-labelledby": labelledBy, "aria-invalid": invalid, "aria-describedby": describedBy } = props
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const listId = `${inputId}-listbox`
  const statusId = `${inputId}-status`
  const selectedId = `${inputId}-selected`
  const inputRef = React.useRef<HTMLInputElement>(null)
  const fieldRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [announcement, setAnnouncement] = React.useState("")
  const [labelText, setLabelText] = React.useState("")
  const announceTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const multiple = props.multiple === true
  const values: readonly string[] = props.multiple ? props.value : props.value ? [props.value] : []
  const [cacheState, setCacheState] = React.useState(() => ({ source: options, map: new Map(options.map((option) => [option.value, option])) }))
  let optionCache = cacheState.map
  if (cacheState.source !== options) {
    optionCache = new Map(optionCache)
    for (const option of options) optionCache.set(option.value, option)
    setCacheState({ source: options, map: optionCache })
  }
  const resolveOption = (value: string): SearchableOption =>
    options.find((option) => option.value === value) ?? optionCache.get(value) ?? { value, label: value }
  const selected = !multiple && values[0] ? resolveOption(values[0]) : undefined
  const visible = onQueryChange ? options : options.filter((option) => filter(option, query))
  // Home and End belong to the caret in an editable combobox.
  const { activeIndex, setActiveIndex, onKeyDown: move, getOptionId } = useActiveDescendant(visible.length, { homeEnd: false })
  const current = activeIndex >= 0 ? visible[activeIndex] : undefined

  React.useEffect(() => {
    if (!open || activeIndex < 0) return
    const list = listRef.current
    const row = list?.children[activeIndex] as HTMLElement | undefined
    if (!list || !row) return

    // Keep the active option visible without moving the page behind the menu.
    const rowTop = row.offsetTop
    const rowBottom = rowTop + row.offsetHeight
    if (rowTop < list.scrollTop) {
      list.scrollTop = rowTop
    } else if (rowBottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = rowBottom - list.clientHeight
    }
  }, [activeIndex, open])

  React.useEffect(() => () => clearTimeout(announceTimer.current), [])

  const updateQuery = (next: string) => {
    setQuery(next)
    setActiveIndex(-1)
    onQueryChange?.(next)
  }
  // Closing drops the typed query, so the closed field always shows the committed value.
  const changeOpen = (next: boolean) => {
    if (disabled) return
    if (next && !open) setLabelText(inputRef.current?.labels?.[0]?.textContent?.trim() ?? "")
    setOpen(next)
    if (!next) {
      setActiveIndex(-1)
      if (query) updateQuery("")
    }
  }
  // Escape closes the list but keeps the query; a second Escape clears it.
  const closeKeepingQuery = () => {
    setOpen(false)
    setActiveIndex(-1)
  }
  const choose = (option: SearchableOption) => {
    if (props.multiple) {
      props.onValueChange(props.value.includes(option.value)
        ? props.value.filter((value) => value !== option.value)
        : [...props.value, option.value])
      updateQuery("")
      inputRef.current?.focus()
    } else {
      props.onValueChange(option.value)
      updateQuery("")
      changeOpen(false)
    }
  }
  const remove = (value: string) => {
    const label = resolveOption(value).label
    if (props.multiple) props.onValueChange(props.value.filter((item) => item !== value))
    else props.onValueChange(null)
    setAnnouncement(`${label} removed`)
    // Clear it once spoken, so removing another chip with the same label is announced again.
    clearTimeout(announceTimer.current)
    announceTimer.current = setTimeout(() => setAnnouncement(""), 1500)
    inputRef.current?.focus()
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      // An open list is closed by the popover's own Escape handler, which marks the event handled.
      if (event.defaultPrevented) return
      if (open) { event.preventDefault(); closeKeepingQuery() }
      else if (query) { event.preventDefault(); updateQuery("") }
      return
    }
    if (event.key === "Tab") { changeOpen(false); return }
    if (event.key === "Backspace" && !query && props.multiple && props.value.length) {
      event.preventDefault()
      remove(props.value[props.value.length - 1])
      return
    }
    if (event.key === "Enter") {
      if (event.nativeEvent.isComposing) return
      if (open && current) {
        event.preventDefault()
        choose(current)
      } else if (open || query) {
        // Nothing highlighted: never submit the enclosing form half-filled.
        event.preventDefault()
        const only = visible.length === 1 ? visible[0] : undefined
        if (query && only && !loading && !values.includes(only.value)) choose(only)
      }
      return
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!open) changeOpen(true)
      move(event)
    }
  }

  return <div data-slot="searchable-dropdown" className={cn("w-full min-w-0", className)}>
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverAnchor asChild>
        <div
          ref={fieldRef}
          data-slot="searchable-dropdown-field"
          data-invalid={invalid || undefined}
          onClick={() => { if (!disabled) { changeOpen(true); inputRef.current?.focus() } }}
          className={cn("flex min-h-10 w-full min-w-0 items-center gap-2 rounded-full border border-border bg-background px-5 text-body text-foreground transition-colors duration-150 has-[input:focus-visible]:focus-ring data-[invalid]:border-destructive", multiple ? "min-h-11 flex-wrap gap-1.5 py-1 pl-1.5 sm:min-h-(--size-control)" : "h-11 sm:h-(--size-control)", disabled && "cursor-not-allowed border-disabled-border bg-disabled text-disabled-foreground")}
        >
          {!multiple && !selected ? <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
          {multiple ? values.map((value) => {
            const option = resolveOption(value)
            return <span key={value} className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-muted pl-1 pr-1.5 text-label text-foreground">
              {option.lead ? <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full [&_[data-slot=avatar]]:size-5">{option.lead}</span> : null}
              <span className="truncate">{option.label}</span>
              <button type="button" aria-label={`Remove ${option.label}`} disabled={disabled} onClick={(event) => { event.stopPropagation(); remove(value) }} className="flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-accent focus-visible:focus-ring"><X aria-hidden className="size-3.5" /></button>
            </span>
          }) : selected && !open && !query ? <span className="flex min-w-0 flex-1 items-center gap-2">{selected.lead}<span className="truncate">{selected.label}</span></span> : null}
          <input
            ref={inputRef} id={inputId} role="combobox" type="text" autoComplete="off"
            aria-label={ariaLabel} aria-labelledby={labelledBy} aria-autocomplete="list" aria-expanded={open}
            aria-controls={open ? listId : undefined} aria-activedescendant={open && current ? getOptionId(activeIndex) : undefined}
            aria-invalid={invalid || undefined} aria-describedby={[describedBy, selected ? selectedId : undefined, statusId].filter(Boolean).join(" ")}
            disabled={disabled} value={query}
            placeholder={multiple ? (props.multiple ? props.addPlaceholder ?? placeholder : placeholder) : selected && !open ? "" : placeholder}
            onBlur={(event) => { if (!fieldRef.current?.contains(event.relatedTarget as Node | null)) changeOpen(false) }}
            onChange={(event) => { updateQuery(event.target.value); changeOpen(true) }}
            onKeyDown={onKeyDown} data-escape-clears=""
            className={cn("min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:placeholder:text-disabled-foreground", multiple && "min-w-24", selected && !open && !query && "w-0 flex-none")}
          />
          {multiple ? null : selected && !open ? <button type="button" aria-label={`Clear ${selected.label}`} disabled={disabled} onClick={(event) => { event.stopPropagation(); remove(selected.value) }} className="flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-accent focus-visible:focus-ring"><X aria-hidden className="size-4" /></button> : <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" sideOffset={8} onEscapeKeyDown={(event) => { event.preventDefault(); closeKeepingQuery() }} onOpenAutoFocus={(event) => event.preventDefault()} onCloseAutoFocus={(event) => event.preventDefault()} onInteractOutside={(event) => { if (fieldRef.current?.contains(event.target as Node)) event.preventDefault() }} className="w-(--radix-popover-trigger-width) min-w-64 p-1.5">
        <div ref={listRef} id={listId} role="listbox" aria-label={labelledBy ? undefined : ariaLabel ?? (labelText || placeholder)} aria-labelledby={labelledBy} aria-multiselectable={multiple || undefined} onMouseDown={(event) => event.preventDefault()} className="max-h-64 overflow-y-auto">
          {loading ? <p className="px-3 py-6 text-center text-small text-muted-foreground">Searching…</p> : visible.length ? visible.map((option, index) => <div
            key={option.value} id={getOptionId(index)} role="option" aria-selected={values.includes(option.value)}
            data-active={activeIndex === index || undefined}
            onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option)}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-small text-foreground hover:bg-muted data-[active]:bg-muted"
          >
            {option.lead ? <span className="shrink-0">{option.lead}</span> : null}
            <span className="min-w-0 flex-1"><span className="block truncate">{highlightMatch(option.label, query)}</span>{option.description ? <span className="block truncate text-badge text-muted-foreground">{highlightMatch(option.description, query)}</span> : null}</span>
            {multiple && values.includes(option.value) ? <Check aria-hidden className="size-4 shrink-0 text-primary" /> : null}
          </div>) : <div className="px-4 py-6 text-center"><p className="text-small font-medium text-foreground">{noResults?.(query) ?? `No matches for “${query}”`}</p>{noResultsHint ? <p className="mt-1 text-badge text-muted-foreground">{noResultsHint}</p> : null}</div>}
        </div>
        {!loading && visible.length > 0 ? <p className="border-t border-border-subtle px-2 pt-2 pb-1 text-label text-muted-foreground">{visible.length} {visible.length === 1 ? "match" : "matches"} · ↑↓ to move, Enter to choose</p> : null}
      </PopoverContent>
    </Popover>
    <span id={statusId} role="status" aria-live="polite" className="sr-only">{announcement ? `${announcement}. ` : ""}{loading ? "Searching" : `${visible.length} ${visible.length === 1 ? "match" : "matches"}`}</span>
    {selected ? <span id={selectedId} className="sr-only">Selected: {selected.label}</span> : null}
    {name ? values.map((value) => <input key={value} type="hidden" name={name} value={value} disabled={disabled} />) : null}
  </div>
}
