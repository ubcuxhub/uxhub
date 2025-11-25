import React from "react";
import Image from "next/image";
import Button from "./Button";

export default function FooterCallout() {
  const handleContactClick = () => {
    window.location.href = "mailto:ubcuxhub@gmail.com";
  };

  return (
    <section className="w-full md:px-[20%]">
      <div className="relative mx-auto max-h-[820px] md:rounded-[20px] rounded-none bg-gradient-to-br from-[#102A68] via-[#9578B1] to-[#EE9489] md:px-15 px-5 py-28 sm:py-16 md:py-35 lg:py-30">
        {/* cursor - top left */}
        <div className="absolute z-10 hidden md:block md:top-[40px] md:left-[40px] lg:top-[50px] lg:left-[60px] transition-transform duration-300 ease-in-out hover:scale-[1.15]">
          <Image
            src="/footer-cursor-top.png"
            alt=""
            width={120}
            height={120}
            className="h-auto w-auto max-w-[50px] md:max-w-[65px] lg:max-w-[80px]"
            priority
          />
        </div>

        {/* cursor - bottom right */}
        <div className="absolute z-10 hidden md:block md:bottom-[40px] md:right-[40px] lg:bottom-[50px] lg:right-[60px] transition-transform duration-300 ease-in-out hover:scale-[1.15]">
          <Image
            src="/footer-cursor-bottom.png"
            alt=""
            width={120}
            height={120}
            className="h-auto w-auto max-w-[50px] md:max-w-[65px] lg:max-w-[80px]"
            priority
          />
        </div>

        <div className="mx-auto flex flex-col items-center justify-center gap-5 text-center">
          <h2 className="text-[40px] font-bold leading-tight text-white">
            Ready to kickstart your design journey?
          </h2>

          <p className="font-dm-sans mx-auto max-w-2xl text-base font-normal leading-normal text-white">
            Join hundreds of student designers at UX Hub learning, building, and
            supporting each other on their journey to better UI and better design.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row pt-4">
            <Button variant="primary" onClick={() => {window.location.href = "https://linktr.ee/ubcuxhub?fbclid=PAZXh0bgNhZW0CMTEAAaf0yjegrtGiSXfSFyHbl76u5TnYyGoUSImwqeW6vbKvy74Cz_NmVY6_HVuUdw_aem_gG2KbQMNO5Yidm2tSQOltA"}}>
              BECOME A MEMBER
            </Button>

            <Button
              variant="secondary"
              onClick={handleContactClick}
              className="w-[243px] md:w-auto"
            >
              CONTACT US
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
