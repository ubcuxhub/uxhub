import React from "react";
import Link from "next/link";

interface EventCardProps {
    imageSrc: string;
    imageAlt: string;
    href?: string;
}

const EventCard: React.FC<EventCardProps> = ({
    imageSrc,
    imageAlt,
    href,
}) => {
    const inner = (
        <div className="overflow-hidden rounded-lg">
            <img
                src={imageSrc}
                alt={imageAlt}
                className="w-full object-contain"
            />
        </div>
    );

    if (href) {
        return (
            <Link href={href} className="flex-1 rounded-2xl border border-[#C1C7CD] p-3 block hover:opacity-90 transition-opacity">
                {inner}
            </Link>
        );
    }

    return (
        <div className="flex-1 rounded-2xl border border-[#C1C7CD] p-3">
            {inner}
        </div>
    );
};

export default EventCard;
