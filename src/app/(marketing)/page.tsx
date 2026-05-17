"use client";

import DotGrid from "@/features/marketing/components/DotGrid";
import EventsSection from "@/features/marketing/sections/EventsSection";
import Footer from "@/features/marketing/sections/Footer";
import HeroSection from "@/features/marketing/sections/HeroSection";
import LogoCarousel from "@/features/marketing/sections/LogoCarousel";
import MailingList from "@/features/marketing/sections/MailingListSection";
import Navbar from "@/features/marketing/sections/Navbar";
import TeamSection from "@/features/marketing/sections/TeamSection";
import WhoWeAreSection from "@/features/marketing/sections/WhoWeAreSection";

export default function Home() {
  return (
    <main className="bg-white">
      <Navbar />

      <div className="fixed inset-0 z-0 h-full w-full pointer-events-none">
        <DotGrid
          dotSize={6}
          gap={48}
          baseColor="#E5E5E5"
          activeColor="#000000"
          proximity={120}
          className="h-full w-full"
        />
      </div>

      <div className="relative z-10 flex flex-col gap-40">
        <HeroSection />
        <MailingList />
        <WhoWeAreSection />
        <LogoCarousel />
        <EventsSection />
        <TeamSection />
      </div>

      <div className="relative z-10 pt-24">
        <Footer />
      </div>
    </main>
  );
}
