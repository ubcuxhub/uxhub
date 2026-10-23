"use client";

import { Separator } from "@/components/ui/separator";
import { isAgendaDayToday, isAgendaItemHappening } from "@/features/events/lib/event-agenda";
import { usePacificNow } from "@/hooks/use-pacific-now";
import { formatEventDate, formatEventTime } from "@/lib/date";
import type { EventAgendaDay } from "@/lib/supabase-helpers/event-agenda";
import { cn } from "@/lib/utils";

interface EventAgendaTableProps {
  eventName: string;
  agenda: EventAgendaDay[];
}

/**
 * The agenda card on the portal event page: one table per day. Today's day dot
 * turns blue and the running item gets a green dot, both in Vancouver time.
 * Renders nothing for an event without an agenda.
 */
export function EventAgendaTable({ eventName, agenda }: EventAgendaTableProps) {
  const now = usePacificNow();

  if (agenda.length === 0) return null;

  return (
    <section className="flex flex-col gap-6 rounded-md border border-border-subtle p-6">
      <h3 className="text-h3">{eventName} Agenda</h3>
      <Separator />

      {agenda.map((day) => {
        const date = formatEventDate(day.date, { weekday: "short", month: "short", year: undefined });
        const isToday = isAgendaDayToday(day.date, now);

        return (
          <div key={day.id} className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-max">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th colSpan={4} className="px-4 py-3 text-left font-normal">
                    <div className="flex items-center gap-4">
                      <span
                        className={cn("size-2 shrink-0 rounded-full", isToday ? "bg-action" : "bg-border")}
                        aria-hidden
                      />
                      <span>
                        {date && <span className="font-medium">{date}: </span>}
                        {day.title}
                        {isToday && <span className="sr-only"> (today)</span>}
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {day.items.map((item) => {
                  const isHappening = isAgendaItemHappening(day.date, item, now);

                  return (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="w-px p-4">
                        <div className="flex items-center gap-4 whitespace-nowrap">
                          {/* `invisible` keeps the dot's space, so rows stay aligned when it appears. */}
                          <span
                            className={cn(
                              "size-2 shrink-0 rounded-full bg-success-active",
                              !isHappening && "invisible"
                            )}
                            aria-hidden
                          />
                          <div className="flex w-52 items-center gap-2">
                            <AgendaClock time={item.start_time} />
                            {formatEventTime(item.start_time)} - {formatEventTime(item.end_time)}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        {item.title}
                        {isHappening && <span className="sr-only"> (happening now)</span>}
                      </td>
                      <td className="w-px py-4 pr-4 whitespace-nowrap text-right text-small">
                        {item.building}
                      </td>
                      <td className="w-32 py-4 pr-4 whitespace-nowrap text-right text-small">
                        {item.room}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </section>
  );
}

/** A clock icon whose hands show `time`, a Postgres `time` string like "09:30:00". */
function AgendaClock({ time }: { time: string }) {
  const [hours, minutes] = time.split(":").map(Number);
  const minuteAngle = minutes * 6;
  const hourAngle = ((hours % 12) + minutes / 60) * 30;

  // Hand tip for an angle measured clockwise from 12 o'clock, in Lucide's 24x24 grid.
  const handEnd = (angle: number, length: number) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x2: Number((12 + length * Math.sin(radians)).toFixed(2)),
      y2: Number((12 - length * Math.cos(radians)).toFixed(2)),
    };
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className="size-5 shrink-0 text-muted-foreground"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="12" {...handEnd(hourAngle, 4)} />
      <line x1="12" y1="12" {...handEnd(minuteAngle, 6)} />
    </svg>
  );
}
