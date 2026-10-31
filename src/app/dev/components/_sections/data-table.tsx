"use client";

import { Download, Ellipsis, ListFilter } from "lucide-react";
import { useId, useState } from "react";

import { TableToolbar } from "@/components/shared/TableToolbar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import { SearchField } from "@/components/ui/search-field";
import { StatusBadge, type Status } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableCheckboxCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableNone,
  TableRow,
  TableRowButton,
  TableSkeleton,
} from "@/components/ui/table";
import { useRowSelection } from "@/hooks/use-row-selection";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection } from "../_gallery/types";

interface User {
  id: string;
  name: string;
  email: string;
  membership: string | null;
  major: string | null;
  status: Status;
}

const USERS: User[] = [
  { id: "u1", name: "Alex Chen", email: "alex.chen@student.ubc.ca", membership: "Innovator", major: "Cognitive Systems", status: "going" },
  { id: "u2", name: "Priya Raman", email: "priya.raman@student.ubc.ca", membership: "Innovator", major: "Psychology", status: "checked_in" },
  { id: "u3", name: "Jordan Lee", email: "jordan.lee@gmail.com", membership: null, major: "Business", status: "waitlisted" },
  { id: "u4", name: "Sam Okafor", email: "sam.okafor@student.ubc.ca", membership: "Explorer", major: null, status: "pending" },
  { id: "u5", name: "Mei Tanaka", email: "mei.tanaka@student.ubc.ca", membership: "Explorer", major: "Computer Science", status: "accepted" },
  { id: "u6", name: "Noah Williams", email: "noah.w@student.ubc.ca", membership: null, major: "Design", status: "not_selected" },
  { id: "u7", name: "Fatima Hassan", email: "fatima.hassan@student.ubc.ca", membership: "Innovator", major: "Information Design", status: "going" },
  { id: "u8", name: "Lucas Moreau", email: "lucas.moreau@student.ubc.ca", membership: "Explorer", major: "Cognitive Systems", status: "full" },
  { id: "u9", name: "Hana Kim", email: "hana.kim@student.ubc.ca", membership: null, major: null, status: "past" },
  { id: "u10", name: "Omar Aziz", email: "omar.aziz@student.ubc.ca", membership: "Innovator", major: "Psychology", status: "going" },
  { id: "u11", name: "Ivy Zhang", email: "ivy.zhang@student.ubc.ca", membership: "Explorer", major: "Business", status: "registration_open" },
  { id: "u12", name: "Diego Alvarez", email: "diego.alvarez@student.ubc.ca", membership: null, major: "Computer Science", status: "waitlisted" },
];

const PAGE_SIZE = 5;

/** Placeholder: the wrap-up swaps this IconButton for a DropdownMenu trigger. */
function RowActions({ name }: { name: string }) {
  return (
    <IconButton
      variant="ghost"
      size="icon-sm"
      label={`Actions for ${name}`}
      className="relative z-10"
    >
      <Ellipsis aria-hidden />
    </IconButton>
  );
}

/** "Manage Users": search, selection, paging, and a row that opens. */
function ManageUsers({
  density,
  stickyFirstColumn = false,
  minWidth = "min-w-[56rem]",
}: {
  density?: "compact";
  stickyFirstColumn?: boolean;
  minWidth?: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [opened, setOpened] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const results = USERS.filter(
    (u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q),
  );
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = results.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // "Current results" are every row the search leaves, not just the visible page.
  const selection = useRowSelection(results.map((u) => u.id));
  return (
    <div
      data-density={density}
      className="flex flex-col gap-4"
      data-composition-root={density ?? "comfortable"}
    >
      <TableToolbar
        search={
          <SearchField
            label="Search users"
            placeholder="Search users"
            value={query}
            onValueChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            resultCount={results.length}
          />
        }
        actions={
          <Button variant="secondary" size="sm">
            <ListFilter aria-hidden />
            Sort and filter
          </Button>
        }
        selectedCount={selection.selected.size}
        bulkActions={
          <Button variant="secondary" size="sm">
            <Download aria-hidden />
            Export to CSV
          </Button>
        }
        onClearSelection={selection.clear}
      />
      <TableCard>
        <Table stickyFirstColumn={stickyFirstColumn} className={minWidth}>
          <TableHeader>
            <TableRow>
              <TableCheckboxCell
                header
                checked={selection.allState}
                onCheckedChange={selection.toggleAll}
                aria-label="Select all results"
              />
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Membership</TableHead>
              <TableHead>Area of study</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-14">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={7}>No users match “{query}”.</TableEmpty>
            ) : (
              rows.map((user) => (
                <TableRow
                  key={user.id}
                  data-state={selection.isSelected(user.id) ? "selected" : undefined}
                >
                  <TableCheckboxCell
                    checked={selection.isSelected(user.id)}
                    onCheckedChange={() => selection.toggle(user.id)}
                    aria-label={`Select ${user.name}`}
                  />
                  <TableCell className="whitespace-nowrap">
                    <TableRowButton onClick={() => setOpened(user.name)}>
                      {user.name}
                    </TableRowButton>
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.membership ?? <TableNone />}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.major ?? <TableNone />}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={user.status} />
                  </TableCell>
                  <TableCell className="w-14 pl-0 text-right">
                    <RowActions name={user.name} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Pagination
          page={current}
          pageSize={PAGE_SIZE}
          total={results.length}
          onPageChange={setPage}
        />
      </TableCard>
      <p role="status" className="min-h-5 text-small text-muted-foreground">
        {opened ? `Opened ${opened}` : "Click a row to open it, or tick a checkbox to select."}
      </p>
    </div>
  );
}

function LoadingTable() {
  return (
    <TableCard>
      <Table busy>
        <TableHeader>
          <TableRow>
            <TableCheckboxCell
              header
              checked={false}
              onCheckedChange={() => {}}
              disabled
              aria-label="Select all results"
            />
            <TableHead>Name</TableHead>
            <TableHead>Membership</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableSkeleton rows={4} columns={3} selectable />
        </TableBody>
      </Table>
    </TableCard>
  );
}

function EmptyTable() {
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Membership</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty colSpan={3}>No users match “portfolo”.</TableEmpty>
        </TableBody>
      </Table>
    </TableCard>
  );
}

function SearchFieldSpecimens() {
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

function DataTable() {
  return (
    <div className="flex flex-col gap-10">
      <SearchFieldSpecimens />

      <SpecimenGroup
        title="TableToolbar"
        spec="§3.16"
        description="Search fills the row; Sort and filter sits on the right until rows are selected."
        min="100%"
      >
        <Specimen label="Default" wide bare>
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
        <Specimen label="Searching" wide bare>
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
        <Specimen label="Rows selected" wide bare>
          <div className="w-full">
            <SelectedToolbar />
          </div>
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Manage Users"
        description="Search, tick rows, page, and open a row. The header checkbox selects every row in the current results, across pages; Export follows the selection."
      >
        <ManageUsers />
      </Composition>

      <Composition
        title="Compact density"
        description="Admin tables run at 40px rows (data-density=compact)."
      >
        <ManageUsers density="compact" />
      </Composition>

      <Composition
        title="Wide table, sticky columns"
        description="Scrolls sideways inside the card with a fade on the cut-off edge. The checkbox and name columns stay put; long values ellipsize."
      >
        <div className="max-w-2xl">
          <ManageUsers stickyFirstColumn minWidth="min-w-[64rem]" />
        </div>
      </Composition>

      <SpecimenGroup
        title="Loading and empty"
        spec="§3.6"
        description="Skeleton rows the shape of the data, never a spinner. An empty result says what's missing in plain words."
        min="min(22rem, 100%)"
      >
        <Specimen label="Loading (aria-busy)" bare>
          <div className="w-full">
            <LoadingTable />
          </div>
        </Specimen>
        <Specimen label="No results" bare>
          <div className="w-full">
            <EmptyTable />
          </div>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

const section: GallerySection = {
  id: "data-table",
  title: "Table",
  spec: "§3.6, §3.16",
  layout: "page",
  Component: DataTable,
};

export default section;
