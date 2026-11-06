"use client";

import { useState } from "react";
import { Download, ListFilter } from "lucide-react";

import { TableToolbar } from "@/components/shared/TableToolbar";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function SelectedToolbar() {
  return (
    <TableToolbar
      search={<SearchField label="Search users" placeholder="Search users" />}
      selectedCount={2}
      bulkActions={
        <Button variant="secondary" size="sm">
          <Download aria-hidden />
          Export to CSV
        </Button>
      }
      onClearSelection={() => {}}
    />
  );
}

const USERS = { one: "user", other: "users" };
const NAMES = ["Alex Chen", "Jordan Lee", "Priya Raman", "Sam Patel", "Taylor Kim", "Morgan Wu"];

/** Type to filter: the count follows, and Show all resets the search. */
function CountedToolbar() {
  const [query, setQuery] = useState("a");
  const shown = NAMES.filter((name) => name.toLowerCase().includes(query.trim().toLowerCase())).length;
  return (
    <TableToolbar
      search={<SearchField label="Search users" placeholder="Search users" value={query} onValueChange={setQuery} />}
      actions={
        <Button variant="secondary" size="sm">
          <ListFilter aria-hidden />
          Sort and filter
        </Button>
      }
      count={{ shown, total: NAMES.length, noun: USERS, filtered: query.trim() !== "" }}
      onClearFilters={() => setQuery("")}
    />
  );
}

function TableToolbarDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="TableToolbar"
        spec="§3.16"
        description="Search fills the row; Sort and filter sits on the right until rows are selected."
      >
        <Specimen label="Default" wide>
          <TableToolbar
            className="w-full"
            search={<SearchField label="Search users" placeholder="Search users" />}
            actions={
              <Button variant="secondary" size="sm">
                <ListFilter aria-hidden />
                Sort and filter
              </Button>
            }
          />
        </Specimen>
        <Specimen label="Searching" wide>
          <TableToolbar
            className="w-full"
            search={
              <SearchField
                label="Search users"
                placeholder="Search users"
                defaultValue="alex"
              />
            }
            actions={
              <Button variant="secondary" size="sm">
                <ListFilter aria-hidden />
                Sort and filter
              </Button>
            }
          />
        </Specimen>
        <Specimen label="Rows selected" wide>
          <div className="w-full">
            <SelectedToolbar />
          </div>
        </Specimen>
      </SpecimenGroup>
      <SpecimenGroup
        title="Row count"
        description="Pass count (and onClearFilters) to say how many rows are listed: “142 users”, or “38 of 142 users” plus Show all while a search or filter hides some. The line is a polite live region, announced on change. Lists with their own toolbar use TableRowCount."
      >
        <Specimen label="All rows" wide>
          <div className="w-full">
            <TableToolbar
              search={<SearchField label="Search users" placeholder="Search users" />}
              actions={
                <Button variant="secondary" size="sm">
                  <ListFilter aria-hidden />
                  Sort and filter
                </Button>
              }
              count={{ shown: 142, total: 142, noun: USERS }}
            />
          </div>
        </Specimen>
        <Specimen label="Filtered (type to try it)" wide>
          <div className="w-full">
            <CountedToolbar />
          </div>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default TableToolbarDemo;
