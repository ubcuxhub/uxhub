import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { EventRow } from "@/types/models";

export interface EventCardProps {
  event?: EventRow;
  title?: string;
  date?: string;
  description?: string;
  imageUrl?: string;
  buttonText?: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "admin";
  adminLinks?: {
    editHref: string;
    checkInHref: string;
    applicationsHref: string;
  };
  showDetails?: boolean;
}

export function EventCard({
  event,
  title,
  date,
  description,
  imageUrl,
  buttonText = "Sign up",
  href,
  onClick,
  variant = "default",
  adminLinks,
  showDetails = false,
}: EventCardProps) {
  const displayTitle = title || event?.name || "Event Name";

  let displayDate = date;
  if (!displayDate && event?.start_date) {
    try {
      displayDate = new Date(event.start_date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      displayDate = event.start_date;
    }
  }

  const displayDescription =
    description ||
    event?.description ||
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation";
  
  const displayImage = imageUrl || event?.image_url;

  const innerContent = (
    <>
      <div className="w-full aspect-square bg-[#8F8F8F] rounded-[8px] overflow-hidden mb-4 flex-shrink-0">
        {displayImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImage}
            alt={displayTitle}
            className="w-full h-full object-cover"
          />
        ) : null}
      </div>

      <div className="flex flex-col flex-1 text-left">
        <h3 className="text-xl font-bold text-black leading-tight mb-1">
          {displayTitle}
        </h3>
        <p className="text-sm text-gray-800 mb-4 font-medium">
          {displayDate || "Date TBD"}
        </p>

        <p className="text-sm text-gray-600 line-clamp-4 flex-1 mb-6 leading-relaxed">
          {displayDescription}
        </p>

        {showDetails && event && (
          <div className="text-xs text-gray-500 flex flex-col gap-1 mb-4 border-t border-gray-100 pt-3 mt-auto">
            {event.location_building && (
              <p>
                Location: {event.location_building} {event.location_room}
              </p>
            )}
            {event.max_capacity && <p>Capacity: {event.max_capacity}</p>}
            <p>Price: ${Number(event.regular_price ?? 0).toFixed(2)}</p>
          </div>
        )}

        {variant === "admin" && adminLinks ? (
          <div className="flex flex-col gap-2 mt-auto pt-2 w-full">
            <div className="text-sm font-medium mb-2">
              ${Number(event?.regular_price ?? 0).toFixed(2)}
              {event?.member_price !== event?.regular_price && (
                <span className="text-muted-foreground ml-1">
                  / ${Number(event?.member_price ?? 0).toFixed(2)} member
                </span>
              )}
            </div>
            <div className="flex gap-2 w-full">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={adminLinks.editHref}>Edit</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={adminLinks.checkInHref}>Check-In</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={adminLinks.applicationsHref}>Apps</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-auto pt-2 w-full">
            {href ? (
              <Button
                asChild
                className="w-full bg-[#111827] hover:bg-[#1f2937] h-10 text-white font-medium rounded-md"
                onClick={onClick}
              >
                <Link href={href}>{buttonText}</Link>
              </Button>
            ) : (
              <Button
                className="w-full bg-[#111827] hover:bg-[#1f2937] h-10 text-white font-medium rounded-md"
                onClick={onClick}
              >
                {buttonText}
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex flex-col bg-[#FAFAFA] p-4 md:p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow h-full">
      {innerContent}
    </div>
  );
}
