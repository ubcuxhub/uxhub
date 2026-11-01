"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { SearchableDropdown, type SearchableOption } from "@/components/ui/searchable-dropdown";
import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection, SectionProps } from "../_gallery/types";

const people: readonly SearchableOption[] = [
  { value: "priya", label: "Priya Shah", description: "UX Researcher · Fernleaf Health", lead: <Avatar name="Priya Shah" size={28} decorative /> },
  { value: "prisha", label: "Prisha Rao", description: "Explorer member", lead: <Avatar name="Prisha Rao" size={28} decorative /> },
  { value: "jordan", label: "Jordan Price", description: "Innovator member", lead: <Avatar name="Jordan Price" size={28} decorative /> },
  { value: "alex", label: "Alex Chen", description: "Product designer", lead: <Avatar name="Alex Chen" size={28} decorative /> },
];

function Single({ initial = null, forcedQuery }: { initial?: string | null; forcedQuery?: string }) {
  const [value, setValue] = useState<string | null>(initial);
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!forcedQuery) return;
    const input = wrapper.current?.querySelector<HTMLInputElement>('input[role="combobox"]');
    if (!input) return;
    input.focus({ preventScroll: true });
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, forcedQuery);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, [forcedQuery]);
  return <div ref={wrapper} className="w-full"><SearchableDropdown options={people} placeholder="Search members" aria-label="Judge" value={value} onValueChange={setValue} noResults={(query) => `No members match “${query}”`} noResultsHint="Check the spelling or search by email." /></div>;
}

function Multiple() {
  const [value, setValue] = useState<string[]>(["alex", "priya"]);
  return <div className="w-full"><SearchableDropdown options={people} multiple value={value} onValueChange={setValue} placeholder="Search members" addPlaceholder="Add a judge" aria-label="Judges" name="judges" /><p className="mt-2 text-label text-muted-foreground">Backspace removes the last person.</p></div>;
}

function AsyncExample() {
  const [query, setQuery] = useState("");
  const [settled, setSettled] = useState("");
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => { const timer = setTimeout(() => setSettled(query), 300); return () => clearTimeout(timer); }, [query]);
  return <SearchableDropdown options={settled ? people.filter((person) => person.label.toLowerCase().includes(settled.toLowerCase())) : people} placeholder="Search members" aria-label="Async judge" value={value} onValueChange={setValue} onQueryChange={setQuery} loading={query !== settled} />;
}

function SearchableDropdownSection({ open }: SectionProps) {
  return <div className="flex flex-col gap-10">
    <SpecimenGroup title="SearchableDropdown" spec="§3.13" description="A 40px pill field for long lists. Arrow keys keep focus in the input; Enter chooses; Escape closes, then clears the query. The menu announces its result count." min="18rem">
      <Specimen label="Closed"><Single /></Specimen>
      <Specimen label="Typing (?open=typing)"><Single forcedQuery={open === "typing" ? "pri" : undefined} /></Specimen>
      <Specimen label="No results (?open=no-results)"><Single forcedQuery={open === "no-results" ? "xyz" : undefined} /></Specimen>
      <Specimen label="Chosen"><Single initial="priya" /></Specimen>
      <Specimen label="Multiple"><Multiple /></Specimen>
      <Specimen label="Async search"><AsyncExample /></Specimen>
      <Specimen label="Invalid"><SearchableDropdown options={people} placeholder="Search members" aria-label="Invalid judge" aria-invalid value={null} onValueChange={() => {}} /></Specimen>
      <Specimen label="Disabled"><SearchableDropdown options={people} placeholder="Search members" aria-label="Disabled judge" disabled value={null} onValueChange={() => {}} /></Specimen>
    </SpecimenGroup>
    <Composition title="Judges field" description="Multiple selection keeps chosen judges visible while searching for more."><label className="mb-2 block text-body-medium text-foreground">Judges</label><Multiple /></Composition>
  </div>;
}

const section: GallerySection = { id: "searchable-dropdown", title: "Searchable dropdown", group: "Forms", description: "Choose one or many from a long list by typing, such as members or judges.", importPath: "@/components/ui/searchable-dropdown", importNames: ["SearchableDropdown"], spec: "§3.13", layout: "split", openStates: ["typing", "no-results"], Component: SearchableDropdownSection };
export default section;
