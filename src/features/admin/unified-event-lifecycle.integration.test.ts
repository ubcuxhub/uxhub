import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { clientAs, withFixtures } from "@/test/integration";
import { defaultFormState } from "./components/event-form/event-form-schema";
import { fetchEventDraft, recoverEventDraftReceipt, saveEventDraft } from "@/lib/supabase-helpers/event-drafts";
import { fetchEventById, fetchEventByLegacyDraftId, fetchEventBySlug, updateEventSchedule } from "@/lib/supabase-helpers/events";
import type { EventWorkingDocument } from "./lib/event-working-document";
import { eventMarketingHref } from "./lib/event-presentation";
import { fetchEventMutationResult } from "@/lib/supabase-helpers/event-mutations";

const document = (name: string): EventWorkingDocument => ({ version: 1 as const, formState: { ...defaultFormState, name, pricing_mode: "legacy" as const }, checkInEvents: [], mentors: [], sponsors: [], applicationTemplate: [] });

describe("unified event lifecycle", () => {
  it("creates one permanent identity, previews saved values, renames/relinquishes URLs, publishes and deletes it", () => withFixtures(async fixtures => {
    const db = fixtures.supabase;
    const id = fixtures.track("events", randomUUID());
    const op = randomUUID();
    const input = document(`Permanent identity ${fixtures.tag}`);
    input.formState.description = "Saved unfinished description";
    const saved = await saveEventDraft(db,id,null,0,input,0,op);
    expect(saved.eventId).toBe(id);
    const row = (await fetchEventById(db,id))!;
    expect(row).toMatchObject({ id, max_capacity: null, regular_price: null, member_price: null, starts_at: null, ends_at: null });
    expect(row.description).toBe(input.formState.description);
    expect(eventMarketingHref(row,false)).toBe(`/events/${row.slug}?preview=draft`);
    for (const role of ["admin","manager"] as const) {
      const staff = clientAs(await fixtures.createUser({ role_access: role }));
      expect((await fetchEventBySlug(staff,row.slug))?.id).toBe(id);
      expect((await fetchEventDraft(staff,id))?.document.formState.description).toBe(input.formState.description);
      expect((await staff.from("events").update({working_document:{}}).eq("id",id)).error?.code).toBe("42501");
    }
    const member = clientAs(await fixtures.createUser());
    for (const viewer of [member,clientAs(null)]) expect(await fetchEventBySlug(viewer,row.slug)).toBeNull();
    expect(await saveEventDraft(db,id,null,0,input,0,op)).toEqual(saved);
    expect(await recoverEventDraftReceipt(db,op)).toMatchObject({ revision: saved.revision, eventRevision: saved.eventRevision });
    const renamed = { ...saved.document, formState: { ...saved.document.formState, page_slug: `renamed-${fixtures.tag}`, slug_edited: true } };
    const second = await saveEventDraft(db,id,id,saved.revision,renamed,saved.eventRevision,randomUUID());
    expect(second.eventId).toBe(id);
    expect((await fetchEventBySlug(db,renamed.formState.page_slug))?.id).toBe(id);
    expect(await fetchEventBySlug(db,row.slug)).toBeNull();
    expect((await db.from("event_url_claims").select().eq("slug",row.slug)).data).toEqual([]);
    expect((await fetchEventByLegacyDraftId(db,id))?.id).toBe(id);
    const refused = await db.from("events").update({status:"active"}).eq("id",id);
    expect(refused.error?.hint).toBe("EVENT_PUBLICATION_INVALID");
    expect((await fetchEventDraft(db,id))?.revision).toBe(second.revision);
    const operationId = randomUUID();
    const publish = { p_event_id:id,p_draft_id:id,p_draft_revision:second.revision,p_slug:null!,p_expected_image_url:null!,p_expected_header_image_url:null!,
      p_event:{ _operation_id:operationId,_expected_revision:second.eventRevision,name:input.formState.name,short_description:"Saved description",description:input.formState.description,status:"active",configured_marketing_mode:"hosted",configured_slug:renamed.formState.page_slug,configured_pricing_mode:"free",configured_price:0,max_capacity:20,regular_price:0,member_price:0,starts_at:"2099-08-01T18:00:00Z",ends_at:"2099-08-01T20:00:00Z" },p_check_in_sessions:[],p_application_questions:[],p_mentors:[],p_sponsors:[] };
    const result = await db.rpc("save_admin_event_builder",publish);
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({id});
    expect((await db.rpc("save_admin_event_builder",publish)).data).toEqual(result.data);
    const active = (await fetchEventById(db,id))!;
    expect(active.working_document).toBeNull();
    expect((await fetchEventBySlug(clientAs(null),renamed.formState.page_slug))?.id).toBe(id);
    expect((await db.from("events").update({slug:`forged-${fixtures.tag}`}).eq("id",id)).error?.message).toContain("locked");
    const deletion = await db.rpc("delete_admin_event_safely",{p_event_id:id,p_operation_id:randomUUID()});
    expect(deletion.error).toBeNull();
    expect(await fetchEventById(db,id)).toBeNull();
    expect((await db.from("event_url_claims").select().eq("event_id",id)).data).toEqual([]);
  }));

  it("preserves empty nested sections and exact numeric strings, refuses stale saves after quick edits, and retains cleanup targets", () => withFixtures(async fixtures => {
    const db=fixtures.supabase; const id=fixtures.track("events",randomUUID());
    const input=document(`Incomplete ${fixtures.tag}`);
    input.formState.pricing_mode="paid"; input.formState.pricing_amount="12.345";
    input.formState.max_capacity="";
    input.formState.content={revision:0,sections:[{key:randomUUID(),kind:"Judges",title:"Judges",items:[]}],links:[]};
    const image="https://example.test/unfinished-image.png";
    input.mentors=[{full_name:"",position:"",description:"",linkedin_url:"",profile_image_path:image}];
    const saved=await saveEventDraft(db,id,null,0,input);
    expect((await fetchEventDraft(db,id))?.document).toEqual(saved.document);
    expect((await fetchEventById(db,id))?.regular_price).toBeNull();
    const omitted=await db.rpc("save_admin_event_builder",{p_event_id:id,p_draft_id:id,p_draft_revision:saved.revision,p_slug:null!,p_expected_image_url:null!,p_expected_header_image_url:null!,p_event:{name:input.formState.name,description:"Complete description",short_description:"Complete overview",status:"active",max_capacity:10,regular_price:0,member_price:0,configured_pricing_mode:"free",configured_price:0,starts_at:"2099-08-01T18:00:00Z",ends_at:"2099-08-01T20:00:00Z"},p_check_in_sessions:[],p_application_questions:[],p_mentors:[],p_sponsors:[]});
    expect(omitted.error?.hint).toBe("EVENT_CONTENT_INVALID");
    expect((await fetchEventDraft(db,id))?.document.formState.content).toEqual(input.formState.content);
    await updateEventSchedule(db,id,{status:"draft",publish_at:null,starts_at:"2099-08-01T18:00:00Z",ends_at:"2099-08-01T20:00:00Z",registration_opens_at:null,registration_closes_at:null},saved.eventRevision);
    await expect(saveEventDraft(db,id,id,saved.revision,{...saved.document,formState:{...saved.document.formState,name:"stale"}},saved.eventRevision)).rejects.toThrow(/another tab/);
    const deleted=await db.rpc("delete_admin_event_safely",{p_event_id:id,p_operation_id:randomUUID()});
    expect(deleted.error).toBeNull();
    expect(deleted.data).toMatchObject({images:expect.arrayContaining([image])});
  }));

  it("returns the original quick-edit receipt after response loss without repeating the update", () => withFixtures(async fixtures => {
    const db=fixtures.supabase; const id=fixtures.track("events",randomUUID());
    const saved=await saveEventDraft(db,id,null,0,document(`Quick edit ${fixtures.tag}`));
    const patch={status:"draft" as const,publish_at:null,starts_at:"2099-08-01T18:00:00Z",ends_at:"2099-08-01T20:00:00Z",registration_opens_at:null,registration_closes_at:null};
    const operationId=randomUUID();
    const first=await updateEventSchedule(db,id,patch,saved.eventRevision,operationId);
    expect(first?.starts_at).toBe("2099-08-01T18:00:00.000Z");
    expect((await fetchEventDraft(db,id))?.document.formState.starts_at).toBe("2099-08-01T11:00");
    expect((await db.from("events").update({name:"Later saved write"}).eq("id",id)).error).toBeNull();
    expect(await updateEventSchedule(db,id,patch,saved.eventRevision,operationId)).toEqual(first);
    expect((await db.from("events").select("name").eq("id",id).single()).data?.name).toBe("Later saved write");
    await expect(updateEventSchedule(db,id,{...patch,ends_at:"2099-08-01T21:00:00Z"},saved.eventRevision,operationId)).rejects.toMatchObject({hint:"EVENT_REVISION_CONFLICT"});
  }));

  it("numbers concurrent complete-save URLs under the transaction lock and receipts the actual URL", () => withFixtures(async fixtures => {
    const db=fixtures.supabase;
    const events=await Promise.all([fixtures.createEvent(),fixtures.createEvent({slug:`second-${fixtures.tag}`})]);
    const base=`concurrent-publication-${fixtures.tag}`;
    const inputs=events.map(event=>({p_event_id:event.id,p_draft_id:null!,p_draft_revision:0,p_slug:null!,p_expected_image_url:null!,p_expected_header_image_url:null!,
      p_event:{_operation_id:randomUUID(),_expected_revision:event.revision,name:`Concurrent publication ${fixtures.tag}`,short_description:"Complete event",description:"Saved description",status:"active",configured_slug_edited:false,configured_slug:base,max_capacity:20,regular_price:0,member_price:0,starts_at:"2099-08-01T18:00:00Z",ends_at:"2099-08-01T20:00:00Z"},p_check_in_sessions:[],p_application_questions:[],p_mentors:[],p_sponsors:[]}));
    const results=await Promise.all(inputs.map(input=>db.rpc("save_admin_event_builder",input)));
    results.forEach(result=>expect(result.error).toBeNull());
    const slugs=await Promise.all(events.map(async event=>(await fetchEventById(db,event.id))!.slug));
    expect(slugs.sort()).toEqual([base,`${base}-1`].sort());
    for(const [index,input] of inputs.entries()) {
      const canonical=(await fetchEventById(db,input.p_event_id))!.slug;
      expect(results[index].data).toMatchObject({page_slug:canonical});
      expect(await fetchEventMutationResult(db,input.p_event._operation_id)).toMatchObject({pageSlug:canonical});
      expect((await db.rpc("save_admin_event_builder",input)).data).toEqual(results[index].data);
    }
  }));
});
