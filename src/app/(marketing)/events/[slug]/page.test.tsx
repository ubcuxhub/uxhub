import type { ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({current:vi.fn(),fetch:vi.fn(),noStore:vi.fn(),participant:vi.fn(),flags:{studentEvents:false}}));
vi.mock("next/cache",()=>({unstable_noStore:mocks.noStore}));
vi.mock("next/navigation",()=>({notFound:()=>{throw new Error("404")},redirect:(url:string)=>{throw new Error(`redirect:${url}`)}}));
vi.mock("@/lib/flags",()=>({FLAGS:mocks.flags}));
vi.mock("@/lib/auth/current-user",()=>({loadCurrentUser:mocks.current}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>"staff-client"}));
vi.mock("@/lib/supabase-helpers/event-agenda",()=>({fetchEventParticipantContent:mocks.participant}));
vi.mock("@/features/marketing/homepage-sections/Navbar",()=>({default:()=>null}));
vi.mock("@/features/marketing/homepage-sections/Footer",()=>({default:()=>null}));
vi.mock("@/lib/supabase-helpers/events",()=>({fetchEventBySlug:mocks.fetch,fetchEvents:vi.fn()}));
vi.mock("@/lib/supabase-helpers/event-tickets",()=>({fetchEventSeatCounts:async()=>new Map()}));
vi.mock("@/lib/supabase-helpers/event-people",()=>({fetchEventMentors:async()=>[],fetchEventSponsors:async()=>[]}));
import Page from "./page";
import { EventRegistrationAction } from "@/features/events/components/EventRegistrationAction";
const props={params:Promise.resolve({slug:"saved-draft"}),searchParams:Promise.resolve({preview:"draft"})};
const row={id:"event-1",slug:"saved-draft",name:"Saved draft",status:"draft",publish_at:null,configured_marketing_mode:"hosted",working_document:null,description:"Saved description",max_capacity:null,regular_price:null};
beforeEach(()=>{vi.clearAllMocks();mocks.flags.studentEvents=false;mocks.fetch.mockResolvedValue(row);mocks.participant.mockResolvedValue({location:null,agenda:[]})});
it.each(["basic",null])("returns 404 before reading draft content for %s",async role=>{
 mocks.current.mockResolvedValue(role?{status:"authenticated",user:{role_access:role}}:{status:"unauthenticated"});
 await expect(Page(props)).rejects.toThrow("404");expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.noStore).toHaveBeenCalled();
});
function components(node:unknown): unknown[] {
 if(Array.isArray(node))return node.flatMap(components);
 if(!node||typeof node!=="object"||!("props" in node))return [];
 const element=node as ReactElement<{children?:unknown}>;
 return [element.type,...components(element.props.children)];
}
it.each(["admin","manager"])("opens an uncached disabled marketing preview for %s while browsing is gated",async role=>{
 mocks.current.mockResolvedValue({status:"authenticated",user:{role_access:role}});
 const tree=await Page(props);
 expect(mocks.fetch).toHaveBeenCalledWith("staff-client","saved-draft",{status:"draft"});expect(mocks.noStore).toHaveBeenCalled();
 expect(components(tree)).not.toContain(EventRegistrationAction);
});
it("preserves the feature gate for public browsing",async()=>{
 await expect(Page({...props,searchParams:Promise.resolve({})})).rejects.toThrow("redirect:/#events");
 expect(mocks.current).not.toHaveBeenCalled();expect(mocks.fetch).not.toHaveBeenCalled();
});
it.each(["disabled","external"])("returns 404 for an unavailable %s hosted preview",async mode=>{
 mocks.current.mockResolvedValue({status:"authenticated",user:{role_access:"admin"}});mocks.fetch.mockResolvedValue({...row,configured_marketing_mode:mode});
 await expect(Page(props)).rejects.toThrow("404");
});
it("previews a scheduled draft with registration disabled",async()=>{
 mocks.current.mockResolvedValue({status:"authenticated",user:{role_access:"manager"}});mocks.fetch.mockResolvedValue({...row,publish_at:"2099-08-01T18:00:00Z"});
 expect(components(await Page(props))).not.toContain(EventRegistrationAction);expect(mocks.noStore).toHaveBeenCalled();
});
it("uses an uncached viewer client for ordinary marketing reads",async()=>{
 mocks.flags.studentEvents=true;mocks.fetch.mockResolvedValue({...row,status:"active"});
 expect(components(await Page({...props,searchParams:Promise.resolve({})}))).toContain(EventRegistrationAction);
 expect(mocks.fetch).toHaveBeenCalledWith("staff-client","saved-draft",{status:"active"});expect(mocks.noStore).toHaveBeenCalled();expect(mocks.current).not.toHaveBeenCalled();
});

it("renders the normalized participant agenda through the viewer client instead of legacy JSON", async () => {
 mocks.flags.studentEvents=true;
 mocks.fetch.mockResolvedValue({...row,status:"active",starts_at:"2026-11-21T06:00:00Z",ends_at:"2026-11-21T09:00:00Z",agenda:[{time:"9 AM",title:"LEGACY-ITEM",room:"LEGACY-ROOM"}]});
 mocks.participant.mockResolvedValue({location:null,agenda:[{id:"day",date:"2027-01-09",title:"Normalized day",location:null,items:[]}]});
 const tree=await Page({...props,searchParams:Promise.resolve({})});
 expect(mocks.participant).toHaveBeenCalledWith("staff-client","event-1");
 expect(JSON.stringify(tree)).toContain("Normalized day");
 expect(JSON.stringify(tree)).toContain("Saturday, November 21, 2026");
 expect(JSON.stringify(tree)).not.toContain("LEGACY-");
 expect(mocks.noStore).toHaveBeenCalled();
});
