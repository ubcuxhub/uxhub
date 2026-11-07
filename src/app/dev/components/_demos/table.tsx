"use client";

import { Download, Ellipsis, ListFilter } from "lucide-react";
import { useState } from "react";

import { TableRowCount, TableToolbar } from "@/components/shared/TableToolbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import { SearchField } from "@/components/ui/search-field";
import { StatusBadge } from "@/components/ui/status-badge";
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
  TableRowLink,
  TableSkeleton,
} from "@/components/ui/table";
import { useRowSelection } from "@/hooks/use-row-selection";

import { Composition, Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

import { USERS } from "./_fixtures/users";

const PAGE_SIZE = 5;
const USER_NOUN = { one: "user", other: "users" };

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
          summary={
            <TableRowCount
              count={{
                shown: results.length,
                total: USERS.length,
                noun: USER_NOUN,
                filtered: q !== "",
                range: {
                  from: results.length === 0 ? 0 : (current - 1) * PAGE_SIZE + 1,
                  to: Math.min(current * PAGE_SIZE, results.length),
                },
              }}
              onClearFilters={() => {
                setQuery("");
                setPage(1);
              }}
            />
          }
        />
      </TableCard>
      <p role="status" className="min-h-5 text-small text-muted-foreground">
        {opened ? `Opened ${opened}` : "Click a row to open it, or tick a checkbox to select."}
      </p>
    </div>
  );
}

/**
 * Rows that open a URL. In the app each href is a record route and
 * `useRecordRows` sets `aria-current` and `replace`; here the hrefs are
 * hashes, so the page stays put.
 */
function LinkRows() {
  const [current, setCurrent] = useState<string | null>(null);
  const rows = USERS.slice(0, 4);
  return (
    <TableCard>
      <Table stickyFirstColumn className="min-w-[40rem]">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Membership</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="whitespace-nowrap">
                <TableRowLink
                  href={`#record-${user.id}`}
                  scroll={false}
                  // While a record is open, another row replaces it in history.
                  replace={current !== null}
                  aria-current={current === user.id ? "page" : undefined}
                  onClick={(event) => {
                    // Cmd- or Ctrl-click opens a new tab; this one stays as it was.
                    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                    setCurrent(user.id);
                  }}
                >
                  {user.name}
                </TableRowLink>
              </TableCell>
              <TableCell className="max-w-64 truncate text-muted-foreground">{user.email}</TableCell>
              <TableCell className="text-muted-foreground">{user.membership ?? <TableNone />}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
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

function TableDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Composition
        title="Manage Users"
        description="Search, tick rows, page, and open a row. The header checkbox selects every row in the current results, across pages; Export follows the selection. The footer counts the page's rows and, while a search hides some, the full list, with Show all."
      >
        <ManageUsers />
      </Composition>

      <Composition
        title="Rows that open a URL (TableRowLink)"
        description="The link twin of TableRowButton: a next/link stretched over the row, so Cmd-click opens a new tab and the cells keep their semantics. aria-current marks the open record's row and fills it; pass replace while a record is open so Back returns to the list. In the admin lists useRecordRows wires both, and returns focus to the row when its record closes."
      >
        <LinkRows />
      </Composition>

      <Composition
        title="Event drafts in the events table"
        description="Manage Events includes saved working drafts in the same table, search, Draft filter and date sort as events. Working-draft links open /admin/events/drafts/<draft> or /admin/events/<event>/edit; saved-event links retain their overview drawer. A working draft replaces its source event's row, and missing dates or registration counts show a dash."
      >
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Registration</TableHead><TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Untitled event</TableCell><TableCell><TableNone /></TableCell><TableCell><Badge variant="neutral">Draft</Badge></TableCell><TableCell><Badge variant="neutral">N/A</Badge></TableCell><TableCell><TableNone /></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableCard>
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
        surface="page"
        title="Loading and empty"
        spec="§3.6"
        description="Skeleton rows the shape of the data, never a spinner. An empty result says what's missing in plain words."
      >
        <Specimen label="Loading (aria-busy)" wide>
          <div className="w-full">
            <LoadingTable />
          </div>
        </Specimen>
        <Specimen label="No results" wide>
          <div className="w-full">
            <EmptyTable />
          </div>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default TableDemo;
