import type { EventApplicationRow } from "@/types/models";

export interface ApplicationWithUserContact {
  application: EventApplicationRow;
  user: {
    id: string;
    name: string;
    email: string;
  };
}
