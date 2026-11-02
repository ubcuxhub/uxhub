"use client";

import { useId, useState } from "react";

import { SearchField } from "@/components/ui/search-field";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

import { USERS } from "./_fixtures/users";

function SearchFieldDemo() {
  const typedId = useId();
  const [counted, setCounted] = useState("des");
  const count = counted
    ? USERS.filter((u) => u.name.toLowerCase().includes(counted.toLowerCase()) || u.major?.toLowerCase().includes(counted.toLowerCase())).length
    : USERS.length;

  return (
    <SpecimenGroup
      title="SearchField"
      spec="§3.16"
      description="Fills its container. The clear button appears once there's text; Esc clears too, and only then."
      min="min(18rem, 100%)"
    >
      <Specimen label="Empty">
        <SearchField label="Search users" placeholder="Search users" />
      </Specimen>
      <Specimen label="Typed, with clear button">
        <SearchField
          id={typedId}
          label="Search events"
          placeholder="Search events"
          defaultValue="portfolio"
        />
      </Specimen>
      <Specimen label="Disabled">
        <SearchField label="Search users" placeholder="Search users" disabled />
      </Specimen>
      <Specimen label="Announces the result count (screen readers hear “n results”)">
        <SearchField
          label="Search people"
          placeholder="Search people"
          value={counted}
          onValueChange={setCounted}
          resultCount={count}
        />
        <p className="text-small text-muted-foreground tabular-nums">{count} results</p>
      </Specimen>
    </SpecimenGroup>
  );
}

export default SearchFieldDemo;
