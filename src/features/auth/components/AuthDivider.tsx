/** A hairline rule with a centred label, e.g. "or sign in with email". */
export function AuthDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 text-small text-muted-foreground">
      <span aria-hidden className="h-px flex-1 bg-border" />
      <span>{children}</span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}
