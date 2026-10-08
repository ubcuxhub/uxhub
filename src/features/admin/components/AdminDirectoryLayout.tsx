import type { ReactNode } from "react";

export function AdminDirectoryLayout({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}
