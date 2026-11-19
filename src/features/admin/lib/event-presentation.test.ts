import { expect, it } from "vitest";
import { eventMarketingHref, eventPresentation, eventWorkingDocument } from "./event-presentation";
import { defaultFormState } from "../components/event-form/event-form-schema";
import type { Json } from "@/lib/supabase/database.types";
import type { EventRow } from "@/lib/supabase/models";

function row(overrides: Partial<EventRow> = {}): EventRow {
  return { id:"event-1",name:"Original",slug:"saved-url",status:"draft",publish_at:null,configured_marketing_mode:"hosted",configured_pricing_mode:"free",configured_price:0,regular_price:0,member_price:0,working_document:null,working_revision:1,revision:2,...overrides } as EventRow;
}
const document = (state: Partial<typeof defaultFormState>): Json => ({version:1,formState:{...defaultFormState,...state},checkInEvents:[],mentors:[],sponsors:[],applicationTemplate:[]}) as unknown as Json;
it("recovers older documents' uncaptured URL, featured, pricing, team and schedule choices from their source event",()=>{
 const source=row({configured_marketing_mode:"external",configured_marketing_url:"https://example.test/saved",is_featured:true,configured_pricing_mode:"paid",configured_price:12.5,teams_enabled:true,min_team_size:2,max_team_size:4,agenda_enabled:true,
  working_document:{version:1,formState:{name:"Saved name",regular_price:"20",member_price:"5"},checkInEvents:[],mentors:[],sponsors:[],applicationTemplate:[]}});
 const saved=eventWorkingDocument(source)!;
 expect(saved.formState).toMatchObject({name:"Saved name",marketing_mode:"external",marketing_url:"https://example.test/saved",page_slug:"saved-url",is_featured:true,pricing_mode:"paid",pricing_amount:"12.5",teams_enabled:true,min_team_size:"2",max_team_size:"4",agenda_enabled:true});
 expect(eventWorkingDocument(eventPresentation(source))).toEqual(saved);
 expect(eventMarketingHref(source)).toBe("https://example.test/saved");
});
it("shows a genuinely missing paid amount and the active audience-approved location from the saved document",()=>{
 const source=row({working_document:document({pricing_mode:"paid",pricing_amount:"",date_location:{automatic:true,audience:"going",location:{type:"online",public_summary:"Online for ticket holders",building:"Inactive building",room:"Inactive room",address:"Private address",map_url:"",meeting_url:"https://example.test/meeting",meeting_id:"",meeting_passcode:"secret"},dates:[]}})});
 expect(eventPresentation(source)).toMatchObject({regular_price:null,member_price:0,location_building:"Online for ticket holders",location_room:null,location_address:null,location_address_url:null});
});
it("uses only available saved marketing destinations, including scheduled draft previews",()=>{
 expect(eventMarketingHref(row({publish_at:"2099-01-01T18:00:00Z"}),false)).toBe("/events/saved-url?preview=draft");
 expect(eventMarketingHref(row({status:"active"}),false)).toBeNull();
 expect(eventMarketingHref(row({configured_marketing_mode:"disabled"}))).toBeNull();
 expect(eventMarketingHref(row({configured_marketing_mode:"external",configured_marketing_url:"javascript:alert(1)"}))).toBeNull();
});
