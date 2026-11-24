import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CheckInManager } from "@/features/admin/components/CheckInManager";
import { resolveAdminEventId } from "@/features/admin/lib/resolve-event-param";
import { checkInReturnTo, selectedCheckInItem, checkInPath } from "@/features/admin/lib/item-check-in";
import { QrCode } from "@/features/events/components/QrCode";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchItemCheckInSnapshot } from "@/lib/supabase-helpers/item-check-in";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { getHeadersOrigin } from "@/lib/http/request-origin";

export default async function CheckInPage({ params,searchParams }: {params:Promise<{event:string}>;searchParams:Promise<{item?:string;returnTo?:string}>}) {
  await requireAdmin();
  const [{event:eventParam},query]=await Promise.all([params,searchParams]);
  const client=await createClient();
  const returnTo=checkInReturnTo(query.returnTo);
  const queryParams=new URLSearchParams();
  if(query.item!==undefined)queryParams.set("item",query.item);
  if(query.returnTo!==undefined)queryParams.set("returnTo",returnTo);
  const suffix=queryParams.size?`?${queryParams}`:"";
  const eventId=await resolveAdminEventId(client,eventParam,`/check-in${suffix}`);
  // One read: the snapshot picks the item by the same clock the page uses.
  const now=new Date();
  const [event,snapshot,requestHeaders]=await Promise.all([fetchEventById(client,eventId),fetchItemCheckInSnapshot(client,eventId,items=>selectedCheckInItem(items,query.item,now)),headers()]);
  if(!event)notFound();
  const selected=selectedCheckInItem(snapshot.items,query.item,now);
  const origin=getHeadersOrigin(requestHeaders);
  const phoneLinks=Object.fromEntries(snapshot.items.map(item=>[item.id,origin?<QrCode token={`${origin}${checkInPath(eventId,item.id,true,query.returnTo === undefined ? undefined : returnTo)}`} label={`Scanner link for ${item.label}`} className="mx-auto size-48 rounded-lg bg-white"/>:null]));
  return <CheckInManager key={`${eventId}:${selected ?? query.item ?? ""}`} eventId={eventId} event={event} initialItemId={selected} initialSnapshot={snapshot} returnTo={query.returnTo === undefined ? undefined : returnTo} phoneLinks={phoneLinks}/>;
}
