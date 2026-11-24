import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({current:vi.fn(),fetch:vi.fn(),noStore:vi.fn(),participant:vi.fn(),seats:vi.fn(),states:vi.fn(),people:vi.fn(),flags:{studentEvents:false}}));
vi.mock("next/cache",()=>({unstable_noStore:mocks.noStore}));
vi.mock("next/navigation",()=>({notFound:()=>{throw new Error("404")},redirect:(url:string)=>{throw new Error(`redirect:${url}`)}}));
vi.mock("@/lib/flags",()=>({FLAGS:mocks.flags}));
vi.mock("@/lib/auth/current-user",()=>({loadCurrentUser:mocks.current}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>"staff-client"}));
vi.mock("@/lib/supabase-helpers/event-agenda",()=>({fetchEventParticipantContent:mocks.participant}));
vi.mock("@/features/marketing/homepage-sections/Navbar",()=>({default:()=>null}));
vi.mock("@/features/marketing/homepage-sections/Footer",()=>({default:()=>null}));
vi.mock("@/lib/supabase-helpers/events",()=>({fetchEventBySlug:mocks.fetch,fetchEvents:vi.fn()}));
vi.mock("@/lib/supabase-helpers/event-tickets",()=>({fetchEventSeatCounts:mocks.seats}));
vi.mock("@/lib/supabase-helpers/event-people",()=>({fetchEventPeopleSections:mocks.people,fetchEventSponsors:async()=>[]}));
vi.mock("@/features/events/lib/event-states",async(importOriginal)=>({...await importOriginal<object>(),loadEventStates:mocks.states}));
import Page, { dynamic } from "./page";
import { EventRegistrationAction } from "@/features/events/components/EventRegistrationAction";
const props={params:Promise.resolve({slug:"saved-draft"}),searchParams:Promise.resolve({preview:"draft"})};
const row={id:"event-1",slug:"saved-draft",name:"Saved draft",status:"draft",publish_at:null,configured_marketing_mode:"hosted",working_document:null,description:"Saved description",max_capacity:null,regular_price:null};
beforeEach(()=>{vi.clearAllMocks();mocks.flags.studentEvents=false;mocks.fetch.mockResolvedValue(row);mocks.participant.mockResolvedValue({location:null,agenda:[]});mocks.seats.mockResolvedValue(new Map());mocks.people.mockResolvedValue([]);mocks.current.mockResolvedValue({status:"unauthenticated"})});
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
describe("public marketing destination", () => {
 const publicProps={...props,searchParams:Promise.resolve({})};
 beforeEach(()=>{mocks.flags.studentEvents=true});
 it("returns 404 for a published event whose marketing page is off",async()=>{
  mocks.fetch.mockResolvedValue({...row,status:"active",configured_marketing_mode:"disabled"});
  await expect(Page(publicProps)).rejects.toThrow("404");
 });
 it("redirects a published external event to its saved URL",async()=>{
  mocks.fetch.mockResolvedValue({...row,status:"active",configured_marketing_mode:"external",configured_marketing_url:"https://example.com/e"});
  await expect(Page(publicProps)).rejects.toThrow("redirect:https://example.com/e");
 });
 it("redirects a legacy row that only has marketing_url",async()=>{
  mocks.fetch.mockResolvedValue({...row,status:"active",configured_marketing_mode:null,marketing_url:"https://example.com/old"});
  await expect(Page(publicProps)).rejects.toThrow("redirect:https://example.com/old");
 });

});
it("previews a scheduled draft with registration disabled",async()=>{
 mocks.current.mockResolvedValue({status:"authenticated",user:{role_access:"manager"}});mocks.fetch.mockResolvedValue({...row,publish_at:"2099-08-01T18:00:00Z"});
 expect(components(await Page(props))).not.toContain(EventRegistrationAction);expect(mocks.noStore).toHaveBeenCalled();
});
it("uses an uncached viewer client for ordinary marketing reads",async()=>{
 mocks.flags.studentEvents=true;mocks.fetch.mockResolvedValue({...row,status:"active"});
 expect(components(await Page({...props,searchParams:Promise.resolve({})}))).toContain(EventRegistrationAction);
 expect(mocks.fetch).toHaveBeenCalledWith("staff-client","saved-draft",{status:"active"});expect(mocks.noStore).toHaveBeenCalled();
 // A signed-out visitor's button comes from the event alone.
 expect(mocks.current).toHaveBeenCalled();expect(mocks.states).not.toHaveBeenCalled();
});

it("renders the normalized participant agenda through the viewer client instead of legacy JSON", async () => {
 mocks.flags.studentEvents=true;
 mocks.fetch.mockResolvedValue({...row,status:"active",starts_at:"2026-11-21T06:00:00Z",ends_at:"2026-11-21T09:00:00Z",agenda:[{time:"9 AM",title:"LEGACY-ITEM",room:"LEGACY-ROOM"}]});
 mocks.participant.mockResolvedValue({location:null,agenda:[{id:"day",date:"2027-01-09",title:"Normalized day",location:null,items:[]}]});
 const tree=await Page({...props,searchParams:Promise.resolve({})});
 expect(mocks.participant).toHaveBeenCalledWith("staff-client","event-1");
 expect(JSON.stringify(tree)).toContain("Normalized day");
 // 11 PM to 2 AM Pacific: one evening, dated by its start.
 expect(JSON.stringify(tree)).toContain("Friday, November 20, 2026");
 expect(JSON.stringify(tree)).not.toContain("November 21");
 expect(JSON.stringify(tree)).not.toContain("LEGACY-");
 expect(mocks.noStore).toHaveBeenCalled();
});

it("keeps viewer-specific participant content out of the shared page cache", () => {
 expect(dynamic).toBe("force-dynamic");
});

describe("layout", () => {
 const publicProps={...props,searchParams:Promise.resolve({})};
 const live={...row,status:"active",image_url:"https://example.com/icon.png",regular_price:10,member_price:0,max_capacity:25,starts_at:"2099-12-11T21:00:00Z",ends_at:"2099-12-12T00:00:00Z",registration_closes_at:"2099-12-06T20:00:00Z"};
 beforeEach(()=>{mocks.flags.studentEvents=true});
 /** Every element's props in the tree that `match` accepts. */
 function find(node:unknown, match:(props:Record<string,unknown>)=>boolean): Record<string,unknown>[] {
  if(Array.isArray(node))return node.flatMap(child=>find(child,match));
  if(!node||typeof node!=="object"||!("props" in node))return [];
  const elementProps=(node as ReactElement<Record<string,unknown>>).props;
  return [...(match(elementProps)?[elementProps]:[]),...find(elementProps.children,match)];
 }
 const action=(tree:unknown)=>find(tree,p=>!!p.action&&typeof p.action==="object")[0].action;
 const facts=(tree:unknown)=>find(tree,p=>Array.isArray(p.facts))[0].facts as {key:string;value:unknown;detail?:unknown}[];

 it("draws the event image square", async () => {
  mocks.fetch.mockResolvedValue(live);
  const tree=await Page(publicProps);
  const frame=find(tree,p=>typeof p.className==="string"&&p.className.includes("aspect-square"));
  expect(frame).toHaveLength(1);
  expect(JSON.stringify(frame[0].children)).toContain("https://example.com/icon.png");
 });
 it("lists each key fact once, with the member price and the registration deadline", async () => {
  mocks.fetch.mockResolvedValue(live);
  const list=facts(await Page(publicProps));
  expect(list.map(f=>f.key)).toEqual(["date","location","price","registration"]);
  expect(list[2]).toMatchObject({value:"$10.00",detail:"Free for UX Hub members"});
  expect(list[3]).toMatchObject({value:"Register by Sun, Dec 6",detail:"25 of 25 spots left"});
 });
 it("dates an overnight event on its start day alone", async () => {
  // An evening to 2:00 AM Pacific, six hours.
  mocks.fetch.mockResolvedValue({...live,starts_at:"2099-12-05T03:00:00Z",ends_at:"2099-12-05T09:00:00Z"});
  const date=facts(await Page(publicProps))[0];
  expect(date.value).toBe("Friday, December 4, 2099");
  expect(date.detail).toMatch(/PM – 2:00 AM$/);
 });
 it("marks a past event and drops the registration row", async () => {
  mocks.fetch.mockResolvedValue({...live,starts_at:"2020-01-26T18:00:00Z",ends_at:"2020-01-27T01:00:00Z",registration_closes_at:"2020-01-21T20:00:00Z"});
  const tree=await Page(publicProps);
  expect(find(tree,p=>p.status==="past")).toHaveLength(1);
  expect(facts(tree).map(f=>f.key)).not.toContain("registration");
  expect(action(tree)).toEqual({kind:"disabled",label:"Event Ended"});
 });
 it("shows a canceled event's note and a disabled button instead of registration", async () => {
  mocks.fetch.mockResolvedValue({...live,canceled_at:"2099-11-01T00:00:00Z",cancellation_note:"Moved to spring."});
  const tree=await Page(publicProps);
  expect(find(tree,p=>p.status==="canceled")).toHaveLength(1);
  expect(find(tree,p=>p.status==="past")).toHaveLength(0);
  expect(JSON.stringify(tree)).toContain("Moved to spring.");
  expect(action(tree)).toEqual({kind:"disabled",label:"Event Canceled"});
 });

 it("ends registration once the event is past, even without a close date", async () => {
  mocks.fetch.mockResolvedValue({...live,starts_at:"2020-01-26T18:00:00Z",ends_at:"2020-01-27T01:00:00Z",registration_opens_at:null,registration_closes_at:null});
  const tree=await Page(publicProps);
  expect(find(tree,p=>p.status==="past")).toHaveLength(1);
  expect(action(tree)).toEqual({kind:"disabled",label:"Event Ended"});
 });
 it("ends registration at the start of a past event without an end", async () => {
  mocks.fetch.mockResolvedValue({...live,starts_at:"2020-01-26T18:00:00Z",ends_at:null,registration_closes_at:null});
  const tree=await Page(publicProps);
  expect(find(tree,p=>p.status==="past")).toHaveLength(1);
  expect(action(tree)).toEqual({kind:"disabled",label:"Event Ended"});
 });
 it.each([
  ["no seat count",new Map()],
  ["the uncapped seat count",new Map([["event-1",{tickets:3,heldOffers:0,seatsLeft:null}]])],
 ])("treats an event without a capacity as unlimited, with %s", async (_,seats) => {
  mocks.fetch.mockResolvedValue({...live,max_capacity:null});mocks.seats.mockResolvedValue(seats);
  const tree=await Page(publicProps);
  expect(action(tree)).toMatchObject({kind:"checkout",label:"Register Now"});
  expect(facts(tree)[3]).toEqual(expect.objectContaining({key:"registration",value:"Register by Sun, Dec 6",detail:undefined}));
 });
 it("still fills up an event with a capacity", async () => {
  mocks.fetch.mockResolvedValue(live);mocks.seats.mockResolvedValue(new Map([["event-1",{tickets:25,heldOffers:0,seatsLeft:0}]]));
  const tree=await Page(publicProps);
  expect(action(tree)).toEqual({kind:"disabled",label:"Event Full"});
  expect(facts(tree).map(f=>f.key)).not.toContain("registration");
 });
 it("asks for an application on an application event, full or not", async () => {
  mocks.fetch.mockResolvedValue({...live,requires_application:true});mocks.seats.mockResolvedValue(new Map([["event-1",{tickets:25,heldOffers:0,seatsLeft:0}]]));
  const tree=await Page(publicProps);
  expect(action(tree)).toMatchObject({kind:"link",label:"Apply"});
  expect(facts(tree)[3]).toEqual(expect.objectContaining({key:"registration",value:"Apply by Sun, Dec 6",detail:"Application required"}));
 });
 it("speaks of applications when an application event's window is shut", async () => {
  mocks.fetch.mockResolvedValue({...live,requires_application:true,registration_closes_at:"2020-01-21T20:00:00Z"});
  expect(action(await Page(publicProps))).toEqual({kind:"disabled",label:"Applications Closed"});
 });
 it("closes registration once an event without a close date starts, as the portal does", async () => {
  const hour=3600_000;
  mocks.fetch.mockResolvedValue({...live,starts_at:new Date(Date.now()-hour).toISOString(),ends_at:new Date(Date.now()+hour).toISOString(),registration_opens_at:null,registration_closes_at:null});
  const tree=await Page(publicProps);
  expect(action(tree)).toEqual({kind:"disabled",label:"Registration Closed"});
  expect(facts(tree).map(f=>f.key)).not.toContain("registration");
  expect(find(tree,p=>p.status==="past")).toHaveLength(0);
 });
 it("dates registration by the start when there's no close date", async () => {
  mocks.fetch.mockResolvedValue({...live,registration_closes_at:null});
  expect(facts(await Page(publicProps))[3]).toMatchObject({value:"Register by Fri, Dec 11"});
 });
 it("sends a signed-in ticket holder to their ticket instead of offering Register", async () => {
  mocks.fetch.mockResolvedValue(live);
  mocks.current.mockResolvedValue({status:"authenticated",user:{id:"user-1",role_access:"basic"}});
  mocks.states.mockResolvedValue({"event-1":{kind:"reg-going",ticketId:"ticket-1"}});
  const tree=await Page(publicProps);
  expect(mocks.states).toHaveBeenCalledWith("staff-client","user-1",[live],expect.any(Date));
  expect(action(tree)).toEqual({kind:"link",label:"View Your Ticket",href:"/portal/events/saved-draft"});
  // The facts still describe the event, not the viewer.
  expect(facts(tree).map(f=>f.key)).toContain("registration");
 });
 it("shows every people section the builder made, not only Mentors", async () => {
  mocks.fetch.mockResolvedValue({...live,mentors_enabled:true});
  mocks.people.mockResolvedValue([
   {id:"judges",title:"Judges",people:[{id:"p1",full_name:"Grace Hopper",position:"Admiral",profile_image_path:null,linkedin_url:null}]},
   {id:"speakers",title:"Speakers",people:[{id:"p2",full_name:"Alan Kay",position:null,profile_image_path:null,linkedin_url:null}]},
  ]);
  const tree=await Page(publicProps);
  expect(find(tree,p=>p.type==="people").map(p=>p.title)).toEqual(["Judges","Speakers"]);
 });
 it("leaves people out when the admin switched the section off", async () => {
  mocks.fetch.mockResolvedValue({...live,mentors_enabled:false});
  await Page(publicProps);
  expect(mocks.people).not.toHaveBeenCalled();
 });
 it("keeps the draft preview's alert and disabled button", async () => {
  mocks.current.mockResolvedValue({status:"authenticated",user:{role_access:"admin"}});
  const tree=JSON.stringify(await Page(props));
  expect(tree).toContain("Draft preview: only admins and managers can see this.");
  expect(tree).toContain("Registration unavailable in draft preview");
 });
});
