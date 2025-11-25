"use-client";
import React, { useState, useRef, useEffect } from "react";
import { TeamMember } from "../components/TeamMemberCard";
import Image from "next/image";

const TEAM_MEMBERS: TeamMember[] = [
  {
    name: "Zelalem Araya",
    role: "Advisor",
    image: "/people/zela.png",
    roleEmoji: "💭",
  },
  {
    name: "Brian Yang",
    role: "Co-President",
    image: "/people/brian.png",
    roleEmoji: "⭐",
  },
  {
    name: "Jackie Crowley",
    role: "Co-President",
    image: "/people/jackie.png",
    roleEmoji: "⭐",
  },
  {
    name: "Elisabeth Lau",
    role: "VP Logistics",
    image: "/people/Elisabeth.png",
    roleEmoji: "⭐",
  },
  {
    name: "Elaine Li",
    role: "VP Partnerships",
    image: "/people/elaine.jpeg",
    roleEmoji: "⭐",
  },
  {
    name: "Aurora Cheng",
    role: "VP Marketing Design",
    image: "/people/aurora.png",
    roleEmoji: "⭐",
  },
  {
    name: "Erin Chiu",
    role: "Co-Treasurer",
    image: "/people/erin.png",
    roleEmoji: "💵",
  },
  {
    name: "Owen Li",
    role: "Co-Treasurer",
    image: "/people/owen.png",
    roleEmoji: "💵",
  },
  {
    name: "Taro Ren",
    role: "VP Internal",
    image: "/people/taro.jpeg",
    roleEmoji: "🎉",
  },
  {
    name: "Aubrey Ventura",
    role: "Design Director",
    image: "/people/aubrey.png",
    roleEmoji: "🎨",
  },
  {
    name: "Martin Uy",
    role: "Design Director",
    image: "/people/martin.png",
    roleEmoji: "🎨",
  },
  {
    name: "David Theopine",
    role: "Design Director",
    image: "/people/david.png",
    roleEmoji: "🎨",
  },
  {
    name: "Chhavi",
    role: "Design Director",
    image: "/people/chhavi.jpeg",
    roleEmoji: "🎨",
  },
  {
    name: "Iris Liu",
    role: "Media Director",
    image: "/people/iris.png",
    roleEmoji: "🎬",
  },
  {
    name: "Mason Suen",
    role: "Media Director",
    image: "/people/mason.png",
    roleEmoji: "🎬",
  },
  {
    name: "Cherry Wang",
    role: "Media Director",
    image: "/people/cherry.png",
    roleEmoji: "🎬",
  },
  {
    name: "Marina Yu",
    role: "Media Director",
    image: "/people/marina.png",
    roleEmoji: "🎬",
  },
  {
    name: "Eric Yan",
    role: "Logistics Director",
    image: "/people/eric.png",
    roleEmoji: "💡",
  },
  {
    name: "Kazuma Uji",
    role: "Logistics Director",
    image: "/people/kazuma.png",
    roleEmoji: "💡",
  },
  {
    name: "Jessie Megan",
    role: "Logistics Director",
    image: "/people/jessie.png",
    roleEmoji: "💡",
  },
  {
    name: "Mia Makino",
    role: "Logistics Director",
    image: "/people/Mia.png",
    roleEmoji: "💡",
  },
  {
    name: "Carys Fong",
    role: "Logistics Director",
    image: "/people/carys.png",
    roleEmoji: "💡",
  },
  {
    name: "Raksha Zunnuru",
    role: "Logistics Director",
    image: "/people/raksha.png",
    roleEmoji: "💡",
  },
  {
    name: "Katrina Wei",
    role: "Partnerships Director",
    image: "/people/Kat.png",
    roleEmoji: "🤝",
  },
  {
    name: "Quang Mai",
    role: "Partnerships Director",
    image: "/people/quang.jpeg",
    roleEmoji: "🤝",
  },
  {
    name: "Johnny Dong",
    role: "Developer",
    image: "/people/johnny.png",
    roleEmoji: "💻",
  },
];

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
        <p className="mb-0 text-gray-500 italic font-[Lora] text-[31.871px] font-semibold">
          the team
        </p>
        <h2 className="text-[38px] font-bold text-[#383838] font-[DM Sans]">
          The people behind the process
        </h2>
      </div>

      <div className="flex flex-col items-center">
        <div
          className="absolute left-0 top-0 md:w-20 w-10 h-full z-10 pointer-events-none"
          style={{
            background: "linear-gradient(to right, #f3f4f6, transparent)",
          }}
        />
        <div
          className="absolute right-0 top-0 md:w-20 w-10 h-full z-10 pointer-events-none"
          style={{
            background: "linear-gradient(to left, #f3f4f6, transparent)",
          }}
        />

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
