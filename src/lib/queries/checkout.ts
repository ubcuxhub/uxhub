import { createClient } from "@/lib/supabase/server";

export async function getEventBySlug(slug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getMembershipTypeBySlug(slug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("membership_types")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
