"use client";

import { useState } from "react";

import {
  SortFilterPanel,
  SortFilterSection,
} from "@/components/shared/SortFilterPanel";
import { TableToolbar } from "@/components/shared/TableToolbar";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";
import { SearchField } from "@/components/ui/search-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection, SectionProps } from "../_gallery/types";

const MEMBERSHIPS = ["Innovator", "Explorer", "None"] as const;
const USER_TYPES = ["Member", "Executive", "Alumni", "Free"] as const;

function ToggleSet({
  values,
  selected,
  onChange,
  label,
}: {
  values: readonly string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  label: string;
}) {
  return (
    <FilterChipGroup aria-label={label}>
      {values.map((value) => (
        <FilterChip
          key={value}
          pressed={selected.has(value)}
          onPressedChange={(pressed) => {
            const next = new Set(selected);
            if (pressed) next.add(value);
            else next.delete(value);
            onChange(next);
          }}
        >
          {value}
        </FilterChip>
      ))}
    </FilterChipGroup>
  );
}

function Filters({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [memberships, setMemberships] = useState(
    () => new Set<string>(["Innovator"]),
  );
  const [userTypes, setUserTypes] = useState(
    () => new Set<string>(["Executive"]),
  );
  const activeCount = memberships.size + userTypes.size;

  return (
    <SortFilterPanel
      defaultOpen={defaultOpen}
      activeCount={activeCount}
      summary="12 users"
      onClearAll={() => {
        setMemberships(new Set());
        setUserTypes(new Set());
      }}
    >
      <SortFilterSection title="Sort by">
        <Select defaultValue="last-name">
          <SelectTrigger aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last-name">Last name, A to Z</SelectItem>
            <SelectItem value="last-name-desc">Last name, Z to A</SelectItem>
            <SelectItem value="newest">Newest first</SelectItem>
          </SelectContent>
        </Select>
      </SortFilterSection>
      <SortFilterSection title="Membership">
        <ToggleSet
          values={MEMBERSHIPS}
          selected={memberships}
          onChange={setMemberships}
          label="Membership"
        />
      </SortFilterSection>
      <SortFilterSection title="User type">
        <ToggleSet
          values={USER_TYPES}
          selected={userTypes}
          onChange={setUserTypes}
          label="User type"
        />
      </SortFilterSection>
    </SortFilterPanel>
  );
}

function AdminDataSection({ open }: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="StatCard"
        spec="§3.5"
        description="A dashboard number, its neutral context, and honest empty and loading states."
        min="9rem"
        className="grid-cols-2 lg:grid-cols-4"
      >
        <Specimen label="Value" bare className="h-full">
          <StatCard
            className="h-full w-full"
            label="Active members"
            kind="value"
            value={312}
            change={{ delta: 24, period: "since last term" }}
          />
        </Specimen>
        <Specimen label="Rate" bare className="h-full">
          <StatCard
            className="h-full w-full"
            label="Active members"
            kind="rate"
            count={412}
            total={528}
            noun="registrants"
          />
        </Specimen>
        <Specimen label="Not enough data" bare className="h-full">
          <StatCard
            className="h-full w-full"
            label="Active members"
            kind="insufficient"
            reason="Fewer than 3 sponsors this term."
          />
        </Specimen>
        <Specimen label="Loading" bare className="h-full">
          <StatCard
            className="h-full w-full"
            label="Active members"
            kind="loading"
          />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="SortFilterPanel"
        spec="§3.16"
        description="Filters apply immediately; the trigger and footer report the current result."
        min="20rem"
      >
        <Specimen label="Sort and filter (?open=sort-filter)" bare>
          <div className="flex min-h-16 items-start">
            <Filters defaultOpen={open === "sort-filter"} />
          </div>
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Directory toolbar"
        description="The filter panel composes in TableToolbar's actions slot without changing search or selection behaviour."
      >
        <TableToolbar
          search={<SearchField label="Search users" placeholder="Search users" />}
          actions={<Filters />}
        />
      </Composition>
    </div>
  );
}

const section: GallerySection = {
  id: "admin-data",
  title: "Stats and filters",
  group: "Data display",
  description: "StatCards for headline numbers, and the search, sort and filter toolbar above admin lists.",
  spec: "§3.5, §3.16",
  layout: "page",
  openStates: ["sort-filter"],
  Component: AdminDataSection,
};

export default section;
