"use client";

import DotGrid from "@/components/DotGrid";
import HeroSection from "@/home-page-sections/HeroSection";
import MailingList from "@/home-page-sections/MailingListSection";
import Navbar from "@/home-page-sections/Navbar";
import AboutUsSection from "@/home-page-sections/AboutUsSection";
import LogoCarousel from "@/home-page-sections/LogoCarousel";
import EventsSection from "@/home-page-sections/EventsSection";
import TeamSection from "@/home-page-sections/TeamSection";
import Footer from "@/home-page-sections/Footer";

export default function Home() {
  return (
    <main className="bg-white">
      <Navbar />

      <div className="fixed inset-0 w-full h-full z-0 pointer-events-none">
        <DotGrid
          dotSize={6}
          gap={48}
          baseColor="#E5E5E5"
          activeColor="#000000"
          proximity={120}
          className="w-full h-full"
        />
      </div>

      <div className="relative z-10 flex flex-col gap-40">
        <HeroSection />
        <MailingList />
        <AboutUsSection />
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
