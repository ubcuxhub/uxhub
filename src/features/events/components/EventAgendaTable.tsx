import { Clock } from "lucide-react";

import type { AgendaItem } from "@/features/events/types";
import { formatEventDate } from "@/lib/date";

interface EventAgendaTableProps {
  /** YYYY-MM-DD day shown in the header. For multi-day events, the day this table covers. */
  date?: string | null;
  title: string;
  items: AgendaItem[];
  /** End time of the last item, which has no next item to end at, e.g. "6:30 PM". */
  endTime?: string | null;
}

export function EventAgendaTable({ date, title, items, endTime }: EventAgendaTableProps) {
  const formattedDate = formatEventDate(date, { weekday: "short", month: "short", year: undefined });

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-max">
        <thead>
          <tr className="border-b bg-muted/50">
            <th colSpan={4} className="px-4 py-3 text-left font-normal">
              <div className="flex items-center gap-4">
                <span className="size-2 shrink-0 rounded-full bg-border" aria-hidden />
                <span>
                  {formattedDate && <span className="font-medium bold">{formattedDate}: </span>}
                  {title}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const itemEndTime = items[i + 1]?.time ?? endTime;
            const timeRange = [item.time, itemEndTime].filter(Boolean).join(" - ");

            return (
              <tr key={`${item.time}-${item.title}`} className="border-b last:border-b-0 ">
                <td className="w-px p-4">
                  <div className="flex items-center gap-4 whitespace-nowrap">
                    {/* TODO: make the dot on each row hidden, and only show it when the 
                    current time is within the item's time range. (this requires a migration) */}
                    <span className="size-2 shrink-0 rounded-full bg-border" aria-hidden />
                    <div className="flex items-center gap-2">
                      <AgendaClock time={item.time} />
                      {timeRange}
                    </div>
                  </div>
                </td>
                <td className="py-4 pr-4">{item.title}</td>
                <td className="w-px py-4 pr-4 whitespace-nowrap text-center text-small">
                  {item.location}
                </td>
                <td className="w-px py-4 pr-4 whitespace-nowrap text-center text-small">
                  {item.room}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Reads "8:00 AM", "8:00 a.m." or "20:00" as 24-hour hours and minutes. */
function parseClockTime(time: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})\s*([ap])?/i.exec(time.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (hour > 23 || minutes > 59 || (meridiem && hour > 12)) return null;

  const hours = meridiem ? (hour % 12) + (meridiem === "p" ? 12 : 0) : hour;
  return { hours, minutes };
}

/** A clock icon whose hands show `time`; falls back to the plain icon when it can't be read. */
function AgendaClock({ time }: { time: string }) {
  const parsed = parseClockTime(time);
  if (!parsed) return <Clock className="size-5 shrink-0 text-muted-foreground" aria-hidden />;

  const minuteAngle = parsed.minutes * 6;
  const hourAngle = ((parsed.hours % 12) + parsed.minutes / 60) * 30;

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
