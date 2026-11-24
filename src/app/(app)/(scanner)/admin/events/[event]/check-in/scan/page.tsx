import { notFound } from "next/navigation";
import { CheckInScanner } from "@/features/admin/components/CheckInScanner";
import { resolveAdminEventId } from "@/features/admin/lib/resolve-event-param";
import { checkInReturnTo, selectedCheckInItem } from "@/features/admin/lib/item-check-in";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchItemCheckInSnapshot } from "@/lib/supabase-helpers/item-check-in";
import { fetchEventById } from "@/lib/supabase-helpers/events";

export default async function CheckInScanPage({params,searchParams}:{params:Promise<{event:string}>;searchParams:Promise<{item?:string;returnTo?:string}>}) {
  await requireAdmin();
  const [{event:eventParam},query]=await Promise.all([params,searchParams]);
  const client=await createClient();
  const returnTo=checkInReturnTo(query.returnTo);
  const queryParams=new URLSearchParams();
  if(query.item!==undefined)queryParams.set("item",query.item);
  if(query.returnTo!==undefined)queryParams.set("returnTo",returnTo);
  const suffix=queryParams.size?`?${queryParams}`:"";
  const eventId=await resolveAdminEventId(client,eventParam,`/check-in/scan${suffix}`);
  // One read: the snapshot picks the item by the same clock the page uses.
  const now=new Date();
  const [event,snapshot]=await Promise.all([fetchEventById(client,eventId),fetchItemCheckInSnapshot(client,eventId,items=>selectedCheckInItem(items,query.item,now))]);
  if(!event)notFound();
  const selected=selectedCheckInItem(snapshot.items,query.item,now);
  return <CheckInScanner key={`${eventId}:${selected ?? query.item ?? ""}`} eventId={eventId} eventName={event.name} initialItemId={selected} initialSnapshot={snapshot} returnTo={query.returnTo === undefined ? undefined : returnTo}/>;
}
