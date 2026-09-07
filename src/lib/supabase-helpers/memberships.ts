import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { MembershipTypeRow } from "@/types/models";

export type MembershipOrderBy = "price" | "name";

interface FetchMembershipTypesOptions {
  orderBy?: MembershipOrderBy;
  ascending?: boolean;
  includeInactive?: boolean;
}

/** Lists active membership tiers, ordered by price ascending by default. */
export async function fetchMembershipTypes(
  supabase: DbClient,
  options: FetchMembershipTypesOptions = {}
): Promise<MembershipTypeRow[]> {
  const {
    orderBy = "price",
    ascending = true,
    includeInactive = false,
  } = options;

  let query = supabase.from(TABLES.membershipTypes).select("*");

  if (!includeInactive) {
    query = query.eq("active", true);
  }

  const { data, error } = await query.order(orderBy, { ascending });

  if (error) throw error;
  return data ?? [];
}

export async function fetchMembershipTypeById(
  supabase: DbClient,
  id: string
): Promise<MembershipTypeRow | null> {
  const { data, error } = await supabase
    .from(TABLES.membershipTypes)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchMembershipTypeBySlug(
  supabase: DbClient,
  slug: string
): Promise<MembershipTypeRow | null> {
  const { data, error } = await supabase
    .from(TABLES.membershipTypes)
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface MembershipTypeOptionRow {
  id: string;
  name: string;
}

/** Lightweight membership options (id + name) for select inputs. */
export async function fetchMembershipTypeOptions(
  supabase: DbClient
): Promise<MembershipTypeOptionRow[]> {
  const { data, error } = await supabase
    .from(TABLES.membershipTypes)
    .select("id, name")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MembershipTypeOptionRow[];
}
