"use client";
import React, { useRef, useEffect } from "react";
import Image from "next/image";
import { SPONSOR_LOGOS } from "@/lib/sponsors";

const LogoCarousel: React.FC = () => {
  const logos = SPONSOR_LOGOS;

  const scrollRef = useRef<HTMLDivElement>(null);
  const duplicatedLogos = [...logos, ...logos];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let animationId: number;
    let position = 0;
    let speed = 0.9;

    const getResetPoint = () => {
      const totalWidth = el.scrollWidth;
      return totalWidth / 2;
    };

    let resetPoint = getResetPoint();

    const animate = () => {
      position += speed;
      const currentPosition = position % resetPoint;

      el.style.transform = `translateX(-${currentPosition}px)`;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    const slowDown = () => (speed = 0.25);
    const speedUp = () => (speed = 0.5);

    el.addEventListener("mouseenter", slowDown);
    el.addEventListener("mouseleave", speedUp);

    const handleResize = () => {
      resetPoint = getResetPoint();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      el.removeEventListener("mouseenter", slowDown);
      el.removeEventListener("mouseleave", speedUp);
      window.removeEventListener("resize", handleResize);
    };
  }, [logos.length]);

  return (
    <div className="w-full overflow-hidden">
      <p className="pb-12 px-[5%] text-center text-[16px] font-medium">
        Proudly partnered with startups, clubs, and companies across UBC and
        beyond
      </p>

      {/* Container with background and relative positioning */}
      <div className="relative">
        {/* Fade edges (uses --bg var or falls back to white) */}
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16 sm:w-20 md:w-24 lg:w-28 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 sm:w-20 md:w-24 lg:w-28 bg-gradient-to-l from-white to-transparent" />

        {/* Animated track */}
        <div className="overflow-hidden">
          <div
            ref={scrollRef}
            className="flex w-max items-center md:gap-20 md:px-10 gap-6 px-3 will-change-transform"
          >
            {duplicatedLogos.map((logo, index) => (
              <div
                key={`${logo.name}-${index}`}
                className="flex-shrink-0 opacity-90 transition-all duration-300 flex items-center justify-center"
              >
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  width={0}
                  height={0}
                  sizes="100vw"
                  className={`${logo.padding_y ?? ""} w-auto object-contain h-16`}
                  priority={index < 8}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogoCarousel;
