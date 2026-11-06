"use client";

import { useState } from "react";
import { Download, ListFilter } from "lucide-react";

import { TableRowCount, TableToolbar } from "@/components/shared/TableToolbar";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
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

/** A paged list's footer: the count moves into Pagination's summary, with the page's range. */
function PagedFooter({ filtered }: { filtered: boolean }) {
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(!filtered);
  const shown = showAll ? 142 : 38;
  const from = (page - 1) * 25 + 1;
  return (
    <Pagination
      className="w-full rounded-xl border"
      page={page}
      pageSize={25}
      total={shown}
      onPageChange={setPage}
      summary={
        <TableRowCount
          count={{ shown, total: 142, noun: USERS, range: { from, to: Math.min(page * 25, shown) } }}
          onClearFilters={() => {
            setShowAll(true);
            setPage(1);
          }}
        />
      }
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
        description="Pass count (and onClearFilters) to say how many rows are listed: “142 users”, or “38 of 142 users” plus Show all while a search or filter hides some. The line is a polite live region, announced on change. A paged list puts TableRowCount in Pagination’s summary with the page’s range instead: “Showing 1–25 of 142 users”, and while filtered “Showing 1–25 of 38 users · filtered from 142”, so the full list’s size stays in view."
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
        <Specimen label="Paged footer" wide>
          <div className="w-full">
            <PagedFooter filtered={false} />
          </div>
        </Specimen>
        <Specimen label="Paged footer, filtered (Show all)" wide>
          <div className="w-full">
            <PagedFooter filtered />
          </div>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default TableToolbarDemo;
