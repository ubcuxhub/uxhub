import type { UserExportRecord } from "@/lib/supabase-helpers/user-export";

const columns = [
  ["Name", "name"], ["Email", "email"], ["Role", "role"],
  ["Membership type", "membershipType"], ["Membership expiry", "membershipExpiry"],
  ["Faculty", "faculty"], ["Major", "major"], ["School", "school"],
  ["Study year", "studyYear"], ["Account creation date", "createdAt"],
] as const satisfies readonly (readonly [string, keyof UserExportRecord])[];

function cell(value: string | null) {
  let text = value ?? "";
  // Quoting alone does not stop spreadsheet formulas. Cover leading whitespace
  // and control characters too, while preserving ordinary values byte for byte.
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function serializeUserExport(rows: readonly UserExportRecord[]): string {
  // UTF-8 BOM makes Unicode names readable in spreadsheet default imports.
  return "\ufeff" + [columns.map(([label]) => cell(label)).join(","),
    ...rows.map((row) => columns.map(([, key]) => cell(row[key])).join(",")),
  ].join("\r\n") + "\r\n";
}
