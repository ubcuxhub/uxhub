import React from "react";
import Image from "next/image";

interface EventCardProps {
    imageSrc: string;
    imageAlt: string;
    buttonText: string;
    buttonIcon: React.ReactNode;
}

const EventCard: React.FC<EventCardProps> = ({
    imageSrc,
    imageAlt,
    // buttonText,
    // buttonIcon,
}) => {
    return (
        <div className="flex-1 rounded-2xl border border-[#C1C7CD] p-3">
            <div className="overflow-hidden rounded-lg">
                <Image
                    src={imageSrc}
                    alt={imageAlt}
                    width={0}
                    height={0}
                    sizes="100vw"
                    className="w-full object-contain"
                />
            </div>

            {/* <button className="flex items-center justify-center gap-2 w-[152px] px-[10px] py-2 rounded-[67.066px] border-[0.5px] border-white text-[16px] font-medium transition-colors hover:bg-gray-50 bg-[linear-gradient(166deg,rgba(251,248,255,0.80)_80.65%,rgba(151,149,153,0.10)_80.65%)] backdrop-blur-[0.5px]">
                {buttonIcon}
                {buttonText}
            </button> */}
        </div>
    );
};

export default EventCard;