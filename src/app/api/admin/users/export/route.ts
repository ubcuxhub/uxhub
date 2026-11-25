import { loadCurrentUser } from "@/lib/auth/current-user";
import { hasAdminAccess } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { fetchUserExport } from "@/lib/supabase-helpers/user-export";
import { serializeUserExport } from "@/features/admin/lib/user-export-csv";
import { errorFields, log } from "@/lib/log";

const privateHeaders = { "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  try {
    // Route handlers answer with HTTP errors rather than the guards' redirects.
    const current = await loadCurrentUser();
    if (current.status !== "authenticated") {
      return Response.json({ error: "Sign in again to export user data." }, { status: current.status === "error" ? 503 : 401, headers: privateHeaders });
    }
    if (!hasAdminAccess(current.user.role_access)) {
      return Response.json({ error: "Staff access required." }, { status: 403, headers: privateHeaders });
    }
    const rows = await fetchUserExport(await createClient());
    return new Response(serializeUserExport(rows), { headers: {
      ...privateHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="uxhub-users.csv"',
    } });
  } catch (error) {
    log.error("admin.user_export_failed", errorFields(error));
    return Response.json({ error: "Couldn’t export user data. Try again." }, { status: 500, headers: privateHeaders });
  }
}
