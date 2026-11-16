export interface LocationDraft {
  type: "in_person" | "online" | "hybrid";
  building: string;
  room: string;
  address: string;
  map_url: string;
  meeting_url: string;
  meeting_id: string;
  meeting_passcode: string;
  public_summary: string;
}
