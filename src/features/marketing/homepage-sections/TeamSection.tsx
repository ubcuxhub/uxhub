"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { TEAM_MEMBERS } from "@/features/marketing/lib/team";
import type { TeamMember } from "@/features/marketing/types";

const SCROLL_SPEED = 0.9;
const HOVER_SCROLL_SPEED = 0.25;

export default function TeamSection() {
  const [hoveredMember, setHoveredMember] = useState<TeamMember | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(0);

  const duplicatedMembers = [...TEAM_MEMBERS, ...TEAM_MEMBERS];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Width of one full copy of the list, measured from layout so the animation
    // stays in step with whatever card size and gap the stylesheet applies.
    let resetPoint = 0;
    const measure = () => {
      const first = el.children[0] as HTMLElement | undefined;
      const copyStart = el.children[TEAM_MEMBERS.length] as
        | HTMLElement
        | undefined;
      resetPoint =
        first && copyStart ? copyStart.offsetLeft - first.offsetLeft : 0;
    };
    measure();

    let speed = SCROLL_SPEED;
    let animationId = 0;

    const animate = () => {
      if (resetPoint > 0) {
        positionRef.current = (positionRef.current + speed) % resetPoint;
        el.style.transform = `translateX(-${positionRef.current}px)`;
      }
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);

    // Re-measure when the cards resize at a breakpoint; the modulo above keeps
    // the current position in range, so the row never jumps back to the start.
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(el);

    const slowDown = () => (speed = HOVER_SCROLL_SPEED);
    const speedUp = () => (speed = SCROLL_SPEED);

    el.addEventListener("mouseenter", slowDown);
    el.addEventListener("mouseleave", speedUp);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      el.removeEventListener("mouseenter", slowDown);
      el.removeEventListener("mouseleave", speedUp);
    };
  }, []);

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

        <div className="w-full overflow-hidden">
          <div
            ref={scrollRef}
            className="flex w-max items-center gap-8 will-change-transform"
          >
            {duplicatedMembers.map((member, index) => (
              <div
                key={`${member.name}-${index}`}
                className="relative flex-shrink-0 overflow-hidden rounded-2xl size-[120px] md:size-[150px]"
                onMouseEnter={() => setHoveredMember(member)}
                onMouseLeave={() => setHoveredMember(null)}
              >
                <Image
                  src={member.image}
                  alt={member.name}
                  fill
                  sizes="(min-width: 768px) 150px, 120px"
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
