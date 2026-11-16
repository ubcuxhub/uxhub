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

/** Viewer-scoped projection; restricted locations contain only a public summary. */
export interface ParticipantLocation {
  type: LocationDraft["type"];
  restricted: boolean;
  public_summary?: string;
  building?: string;
  room?: string;
  address?: string;
  map_url?: string;
  meeting_url?: string;
  meeting_id?: string;
  meeting_passcode?: string;
}
