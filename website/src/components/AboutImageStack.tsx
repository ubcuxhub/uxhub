"use client";

import React from "react";
import Image from "next/image";

const AboutImageStack = () => {
  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">

      {/* Image stack container */}
      <div className="relative w-[450px] h-[300px] group mt-10 md:mt-0">
        {/* Invisible container for positioning reference */}
        <div className="absolute inset-0">
          {/* Image 1 - Bottom left angle of triangle */}
          <div className="absolute transition-all duration-700 ease-out transform
                          left-8 bottom-0] z-30
                          group-hover:translate-x-[-30px] group-hover:translate-y-[-30px] group-hover:rotate-[-3deg]">
            <Image
              src="/about-us-1.png"
              alt="About us 1"
              width={300}
              height={375}
              className="h-auto w-auto max-w-[250px] max-h-[300px]"
              priority
            />
          </div>

          {/* Image 2 - Bottom right angle of triangle */}
          <div className="absolute transition-all duration-700 ease-out transform
                          right-15 top-30 z-20
                          group-hover:translate-x-[50px] group-hover:translate-y-[20px]">
            <Image
              src="/about-us-2.png"
              alt="About us 2"
              width={300}
              height={375}
              className="h-auto w-auto max-w-[250px] max-h-[300px]"
              priority
            />
          </div>

          {/* Image 3 - Top center (overlapped by others) */}
          <div className="absolute transition-all duration-700 ease-out transform
                          left-1/2 top-[-50] -translate-x-1/2 z-10
                          group-hover:translate-x-[10px] md:group-hover:translate-x-[5px] group-hover:translate-y-[-10px]">
            <Image
              src="/about-us-3.png"
              alt="About us 3"
              width={400}
              height={475}
              className="h-auto w-auto max-w-[350px] max-h-[400px]"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutImageStack;
