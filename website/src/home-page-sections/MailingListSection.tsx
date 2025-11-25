// src/components/MailingListSection.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";

export default function MailingListSection() {
  const [isVisible, setIsVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.5 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={rootRef}
      className={[
        "transition-all duration-700 ease-in-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10",
        "bg-[linear-gradient(156deg,#102A68_-1.32%,#9578B1_77.58%,#EE9489_97.31%)]",
      ].join(" ")}
    >
      <div className="px-[5%] md:px-[10%] xl:px-[20%] py-20">
        <div className="flex flex-col lg:flex-row items-center justify-center">
          {/* Text */}
          <div className="flex-shrink-0 text-center lg:pr-12 lg:text-left lg:max-w-[400px]">
            <h2 className="font-dm-sans text-[40px] font-bold leading-tight text-white drop-shadow-md pb-4">
              Never miss out
            </h2>
            <p className="font-dm-sans mx-auto max-w-[400px] text-white pb-4">
              Subscribe to our newsletter to stay updated on all things UX
              Hub—events, design tips, community spotlights, and exclusive
              opportunities.
            </p>
          </div>

          {/* Form */}
          <div className="flex w-full flex-1 justify-center lg:justify-start py-4">
            <form
              action="https://facebook.us16.list-manage.com/subscribe/post?u=9a26bb1b23b273a2a9f766b4f&amp;id=8faf775ff6"
              method="post"
              target="_blank"
              noValidate
              className="relative w-full"
            >
              <label htmlFor="mce-EMAIL" className="sr-only">
                Email address
              </label>
              <input
                id="mce-EMAIL"
                type="email"
                name="EMAIL"
                placeholder="ex: myname@example.com"
                required
                className={[
                  "w-full",
                  "h-17",
                  "rounded-full px-6 sm:px-8 py-3 sm:py-4",
                  "bg-white/40 text-white placeholder-white/70",
                  "backdrop-blur-md shadow-md outline-none ring-0 border-none",
                  "text-sm sm:text-base",
                  "transition-transform transition-colors duration-300 ease-in-out",
                  "hover:bg-white/45 focus:bg-white/45",
                  "hover:scale-[1.02] focus:scale-[1.02]",
                  "pr-20", // room for submit button
                ].join(" ")}
              />

              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Button variant="noBorder" withArrow={false}>
                  SUBMIT
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
