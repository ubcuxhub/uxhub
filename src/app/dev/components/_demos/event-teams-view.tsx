"use client";

import { Suspense } from "react";

import { Composition } from "@/app/dev/_shell/Specimen";
import { EventTeamsView } from "@/features/admin/components/teams/EventTeamsView";
import {
  buildEventTeamsOverview,
  type EventTeamsSource,
} from "@/lib/supabase-helpers/event-teams";

/** UXathon 2027 after its team deadline: 12 teams of up to 4, 48 going. */
const TEAMS: [name: string | null, members: string[]][] = [
  ["Figma Fanatics", ["Mina Park", "Priya Shah", "Sam Okafor"]],
  ["Flow Finders", ["Kai Wong", "Chloe Wilson", "Lucas Martin", "Olivia Brown"]],
  ["Grid Gang", ["Ethan Clark", "Jane Smith"]],
  ["Pixel Pushers", ["Liam Patel", "Emma Williams", "Ava Nguyen", "Jordan Lee"]],
  ["Proto Pals", ["Owen Patel", "Isla Moore", "Ruby Tan"]],
  ["Research Rangers", ["Noah Brown", "Maya Singh", "Leo Chen", "Zara Ahmed"]],
  ["Wireframe Wizards", ["Hana Kim", "Diego Ramirez", "Nora Fischer", "Arjun Mehta"]],
  ["Kerning Krew", ["Sofia Rossi", "Ben Carter", "Yuki Tanaka", "Amara Obi"]],
  [null, ["Aubrey Ventura", "Felix Wagner", "Iris Chan", "Mateo Silva"]],
  ["Sticky Notes", ["Grace Liu", "Omar Haddad", "Elena Petrova"]],
  ["Affinity Mappers", ["Theo Laurent", "Nia Johnson", "Ravi Kumar"]],
  ["Persona Non Grata", ["Lena Novak", "Sami Virtanen", "Chen Wei"]],
];

/** Who is not in yet: one member on some teams, so the check-in filter splits them. */
const NOT_CHECKED_IN = new Set(["Sam Okafor", "Jane Smith", "Ruby Tan", "Ben Carter", "Ravi Kumar"]);
const UNPLACED = 7;

function source(teams: typeof TEAMS, deadline: string | null, maxTeamSize: number | null): EventTeamsSource {
  const tickets: EventTeamsSource["tickets"] = [];
  const rows = teams.map(([name, members], teamIndex) => {
    const teamMembers = members.map((fullName, memberIndex) => {
      const userId = `user-${teamIndex}-${memberIndex}`;
      const [first_name, ...last] = fullName.split(" ");
      tickets.push({
        user_id: userId,
        check_ins: NOT_CHECKED_IN.has(fullName) ? [] : [{ checked_in_at: "2027-01-16T17:05:00Z" }],
      });
      return {
        user_id: userId,
        joined_at: `2027-01-0${(memberIndex % 9) + 1}T12:00:00Z`,
        user_info: { first_name, last_name: last.join(" ") },
      };
    });
    return { id: `team-${teamIndex}`, name, owner_id: teamMembers[0].user_id, team_members: teamMembers };
  });
  for (let i = 0; i < UNPLACED; i += 1) tickets.push({ user_id: `unplaced-${i}`, check_ins: [] });
  return {
    event: { teams_enabled: true, max_team_size: maxTeamSize, team_deadline: deadline },
    teams: rows,
    tickets,
  };
}

const NOW = new Date("2027-01-16T18:00:00Z");
const LOCKED = buildEventTeamsOverview(source(TEAMS, "2027-01-11T06:59:00Z", 4), NOW);
const OPEN = buildEventTeamsOverview(source(TEAMS.slice(0, 3), "2027-01-19T06:59:00Z", null), NOW);
const EMPTY = buildEventTeamsOverview(source([], "2027-01-19T06:59:00Z", 4), NOW);

function EventTeamsViewDemo() {
  return (
    <Suspense>
      <div className="flex flex-col gap-10">
        <Composition
          title="After the team deadline"
          description="UXathon 2027: 12 teams of up to 4, 48 going, 7 to place. Six teams a page here, to show paging. Search, sort and filters write to the URL."
        >
          <EventTeamsView overview={LOCKED} pageSize={6} />
        </Composition>
        <Composition
          title="Before the deadline, no size limit"
          description="Sizes show without a limit and no team is full."
        >
          <EventTeamsView overview={OPEN} />
        </Composition>
        <Composition title="No teams yet">
          <EventTeamsView overview={EMPTY} />
        </Composition>
      </div>
    </Suspense>
  );
}

export default EventTeamsViewDemo;
