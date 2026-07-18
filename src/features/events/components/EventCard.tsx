"use client";

import Link from "next/link";
import type { EventRow } from "../types/eventTypes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface EventCardProps {
  event: EventRow;
  variant?: "default" | "admin";
  onClick?: () => void;
  adminLinks?: {
    editHref: string;
    checkInHref: string;
    applicationsHref: string;
  };
}

export function EventCard({
  event,
  variant = "default",
  onClick,
  adminLinks,
}: EventCardProps) {
  // Format date and time for display
  const formatDate = (date: string | null | undefined) => {
    if (!date) return null;
    try {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return date;
    }
  };

  const formatTime = (time: string | null | undefined) => {
    if (!time) return null;
    try {
      // If it's a full timestamp, extract time
      if (time.includes("T")) {
        return new Date(time).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
      }
      // If it's just time, format it
      return time;
    } catch {
      return time;
    }
  };

  const startDate = formatDate(event.start_date);
  const startTime = formatTime(event.start_time);
  const locationDisplay = [event.location_building, event.location_room]
    .filter(Boolean)
    .join(" ");

  const cardContent = (
    <>
      {event.image_url ? (
        <div className="h-40 w-full overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.image_url}
            alt={event.name}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-muted text-small text-muted-foreground">
          No image available
        </div>
      )}
      <CardHeader>
        <CardTitle className="line-clamp-1">{event.name}</CardTitle>
        <CardDescription className="flex flex-col gap-1 text-small">
          {(startDate || startTime) && (
            <span>
              {startDate && startTime
                ? `${startDate} ・ ${startTime}`
                : startDate || startTime}
            </span>
          )}
          {locationDisplay && (
            <span className="line-clamp-1">{locationDisplay}</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="line-clamp-3 text-small text-muted-foreground">
          {event.description}
        </p>
      </CardContent>
      {variant === "admin" ? (
        <CardFooter className="flex flex-col gap-2">
          <div className="flex items-center justify-between w-full">
            <div className="text-table">
              ${Number(event.regular_price ?? 0).toFixed(2)}
              {event.member_price !== event.regular_price && (
                <span className="text-muted-foreground ml-1">
                  / ${Number(event.member_price ?? 0).toFixed(2)} member
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 w-full">
            <Button asChild variant="outline">
              <Link href={adminLinks?.editHref || `/admin/events/${event.id}`}>Modify</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href={adminLinks?.checkInHref || `/admin/events/${event.id}/check-in`}>
                Check-In
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link
                href={
                  adminLinks?.applicationsHref ||
                  `/admin/events/${event.id}/review-applications`
                }
              >
                Applications
              </Link>
            </Button>
          </div>
        </CardFooter>
      ) : (
        <CardFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-table">
              ${Number(event.regular_price ?? 0).toFixed(2)}
              {event.member_price !== event.regular_price && (
                <span className="text-muted-foreground ml-1">
                  / ${Number(event.member_price ?? 0).toFixed(2)} member
                </span>
              )}
            </div>
          </div>
        </CardFooter>
      )}
    </>
  );

  if (variant === "default" && onClick) {
    return (
      <Card
        className="overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onClick}
      >
        {cardContent}
      </Card>
    );
  }

  return <Card className="overflow-hidden">{cardContent}</Card>;
}
