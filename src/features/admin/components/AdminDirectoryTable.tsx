"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface AdminDirectoryColumn<T> {
  id: string;
  header: ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: T) => ReactNode;
}

interface AdminDirectoryTableProps<T> {
  columns: AdminDirectoryColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  getRowLabel: (row: T) => string;
  onActivate: (row: T, element: HTMLTableRowElement) => void;
  emptyMessage: string;
}

export function AdminDirectoryTable<T>({
  columns,
  rows,
  getRowKey,
  getRowLabel,
  onActivate,
  emptyMessage,
}: AdminDirectoryTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {columns.map((column) => (
              <th
                key={column.id}
                className={cn(
                  "px-4 py-3 text-left font-medium",
                  column.headerClassName
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              role="button"
              tabIndex={0}
              aria-label={getRowLabel(row)}
              className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"
              onClick={(event) => onActivate(row, event.currentTarget)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onActivate(row, event.currentTarget);
                }
              }}
            >
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={cn("px-4 py-3", column.cellClassName)}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
