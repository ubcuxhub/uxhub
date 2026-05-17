"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { TEAM_MEMBERS } from "@/features/marketing/lib/team";
import type { TeamMember } from "@/features/marketing/types";

export default function TeamSection() {
  const [hoveredMember, setHoveredMember] = useState<TeamMember | null>(null);
  const [cardSize, setCardSize] = useState(120); // default for mobile
  const scrollRef = useRef<HTMLDivElement>(null);

  const GAP = 32; // matches gap-8
  const duplicatedMembers = [...TEAM_MEMBERS, ...TEAM_MEMBERS];

  useEffect(() => {
    // adjust card size when screen resizes
    const updateSize = () => {
      setCardSize(window.innerWidth >= 768 ? 150 : 120); // md breakpoint = 768px
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let animationId: number;
    let position = 0;
    let speed = 0.9;

    const cardTotal = cardSize + GAP;
    const resetPoint = cardTotal * TEAM_MEMBERS.length;

    const animate = () => {
      position += speed;
      const currentPosition = position % resetPoint;
      el.style.transform = `translateX(-${currentPosition}px)`;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    const slowDown = () => (speed = 0.25);
    const speedUp = () => (speed = 0.9);

    el.addEventListener("mouseenter", slowDown);
    el.addEventListener("mouseleave", speedUp);

    return () => {
      cancelAnimationFrame(animationId);
      el.removeEventListener("mouseenter", slowDown);
      el.removeEventListener("mouseleave", speedUp);
    };
  }, [cardSize]);

  return (
    <div id="team" className="w-full">
      {/* header */}
      <div className="mb-12 md:px-[20%] px-[5%]">
        <p className="mb-0 text-gray-500 italic font-serif text-[31.871px] font-semibold">
          the team
        </p>
        <h2 className="text-[38px] font-bold text-[#383838] font-sans">
          The people behind the process
        </h2>
      </div>

      <div className="relative flex flex-col items-center">
        <div className="absolute left-0 top-0 md:w-20 w-10 h-full z-10 pointer-events-none bg-gradient-to-r from-gray-100 to-transparent" />
        <div className="absolute right-0 top-0 md:w-20 w-10 h-full z-10 pointer-events-none bg-gradient-to-l from-gray-100 to-transparent" />

        <div className="justify-self-center font-bold h-4 mb-8">
          {hoveredMember
            ? `${hoveredMember.name} ${hoveredMember.roleEmoji} ${hoveredMember.role}`
            : ""}
        </div>

        <div className="overflow-hidden">
          <div
            ref={scrollRef}
            className="flex w-max items-center gap-8 will-change-transform"
          >
            {duplicatedMembers.map((member, index) => (
              <div
                key={`${member.name}-${index}`}
                className="relative flex-shrink-0 overflow-hidden rounded-2xl"
                style={{
                  height: `${cardSize}px`,
                  width: `${cardSize}px`,
                }}
                onMouseEnter={() => setHoveredMember(member)}
                onMouseLeave={() => setHoveredMember(null)}
              >
                <Image
                  src={member.image}
                  alt={member.name}
                  fill
                  sizes="150px"
                  className="object-cover object-top"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
