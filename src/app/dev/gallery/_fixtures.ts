import type { SearchableOption } from "@/components/ui/searchable-dropdown";
import type { NavigatorSection } from "@/components/shared/SectionNavigator";

export { DATE, TODAY } from "@/app/dev/components/_demos/_fixtures/date-time";
export { USERS, type User } from "@/app/dev/components/_demos/_fixtures/users";

/** Where the gallery's links go: nowhere, the gallery itself. */
export const HERE = "/dev/gallery";

/** A soft two-stop gradient as an inline SVG, so thumbnails need no network. */
export const art = (from: string, to: string) =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23${from}'/%3E%3Cstop offset='1' stop-color='%23${to}'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='160' height='160' fill='url%28%23g%29'/%3E%3Ccircle cx='118' cy='46' r='26' fill='white' fill-opacity='.25'/%3E%3C/svg%3E`;

export const ART_BLUE = art("3A5FC4", "B67FC6");
export const ART_SKY = art("325DC4", "7C9CE3");
export const ART_DUSK = art("1F2A44", "6B7FD7");

/** A check-in token's stand-in: any string draws a real, scannable QR code. */
export const QR_TOKEN = "uxhub-gallery-ticket-UXATHON-2027-0042";

export const PEOPLE = [
  { name: "Alex Chen", src: "/people/david.jpg" },
  { name: "Priya Patel" },
  { name: "Jordan Lee", src: "/people/elaine.jpg" },
  { name: "Sam Rivera" },
  { name: "Mia Tanaka", src: "/people/Mia.png" },
  { name: "Ravi Singh" },
  { name: "Noah Williams" },
] as const;

export const SPONSORS = [
  { name: "Google Cloud", href: "https://cloud.google.com", logoSrc: "/sponsor-logos/googlecloud.png" },
  { name: "Microsoft", href: "https://microsoft.com", logoSrc: "/sponsor-logos/microsoft.png" },
  { name: "Notion", href: "https://notion.so", logoSrc: "/sponsor-logos/notion.png" },
  { name: "Red Bull", href: "https://redbull.com", logoSrc: "/sponsor-logos/redbull.png" },
  { name: "TD", href: "https://td.com", logoSrc: "/sponsor-logos/td.png" },
  { name: "WillowTree", href: "https://willowtreeapps.com", logoSrc: "/sponsor-logos/willowtree.png" },
] as const;

export const VENUES: readonly SearchableOption[] = [
  { value: "angu", label: "UBC Henry Angus (ANGU)", description: "2053 Main Mall" },
  { value: "nest", label: "UBC Nest Great Hall", description: "6133 University Blvd" },
  { value: "hennings", label: "UBC Hennings 200", description: "6224 Agricultural Rd" },
  { value: "robson", label: "UBC Robson Square", description: "800 Robson St" },
];

export const JUDGES: readonly SearchableOption[] = [
  { value: "alex", label: "Alex Chen", description: "Senior product designer · Acme" },
  { value: "priya", label: "Priya Patel", description: "Design director · Northwind" },
  { value: "jordan", label: "Jordan Lee", description: "Research lead · Contoso" },
  { value: "sam", label: "Sam Rivera", description: "Design engineer · Fernleaf" },
  { value: "mia", label: "Mia Tanaka", description: "UX researcher · Bluebird" },
];

export const BUILDER_SECTIONS: readonly NavigatorSection[] = [
  { id: "basics", title: "Basics", state: "complete", required: true },
  { id: "description", title: "Description", state: "complete", required: true },
  { id: "schedule", title: "Date and location", state: "attention", issues: 1, required: true },
  { id: "tickets", title: "Tickets and pricing", state: "not-started", required: true },
  { id: "application", title: "Application form", state: "optional", required: false },
  { id: "people", title: "Judges and sponsors", state: "optional", required: false },
];
