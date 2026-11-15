import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({guard:vi.fn(),fetch:vi.fn()}));
vi.mock("next/navigation",()=>({notFound:()=>{throw new Error("404")},redirect:(url:string)=>{throw new Error(`redirect:${url}`)}}));
vi.mock("@/lib/auth/guards",()=>({requireAdmin:mocks.guard}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>"staff-client"}));
vi.mock("@/lib/supabase-helpers/events",()=>({fetchEventByLegacyDraftId:mocks.fetch}));
import Page from "./page";
const id="10000000-0000-4000-8000-000000000001";
beforeEach(()=>{vi.clearAllMocks();mocks.guard.mockResolvedValue({});mocks.fetch.mockResolvedValue({id:"permanent-event-id"})});
it("redirects a recorded legacy identity to the permanent event editor",async()=>{
 await expect(Page({params:Promise.resolve({draft:id})})).rejects.toThrow("redirect:/admin/events/permanent-event-id/edit");
 expect(mocks.fetch).toHaveBeenCalledWith("staff-client",id);
});
it("guards before looking up aliases and returns 404 for absent identities",async()=>{
 mocks.guard.mockRejectedValueOnce(new Error("unauthorized"));
 await expect(Page({params:Promise.resolve({draft:id})})).rejects.toThrow("unauthorized");expect(mocks.fetch).not.toHaveBeenCalled();
 mocks.fetch.mockResolvedValue(null);
 await expect(Page({params:Promise.resolve({draft:id})})).rejects.toThrow("404");
});
