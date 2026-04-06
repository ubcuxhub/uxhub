// app/components/Footer.tsx (or wherever you keep it)
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { FaInstagram, FaLinkedin } from "react-icons/fa6";
import { SiLinktree } from "react-icons/si";
import FooterCallout from "@/components/FooterCallout";

export default function Footer() {
  return (
    <div className="w-full bg-white flex flex-col pt-8 pb-16">
      <FooterCallout />

      <div className="flex flex-col items-center gap-8 pt-8 px-[5%] md:px-[20%]">
        {/* Logo */}
        <div className="h-[96px] w-[96px] mt-4">
          <Image
            src="/logo.png"
            alt="UBC UX HUB"
            width={96}
            height={96}
            className="h-full w-full"
            priority
          />
        </div>

        {/* Navigation */}
        <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm">
          <Link className="transition-colors hover:text-gray-600" href="#home">
            Home
          </Link>
          <Link
            className="transition-colors hover:text-gray-600"
            href="#about-us"
          >
            About Us
          </Link>
          <Link
            className="transition-colors hover:text-gray-600"
            href="#events"
          >
            Events
          </Link>
          <Link className="transition-colors hover:text-gray-600" href="#team">
            Meet the Team
          </Link>
          <a
            className="transition-colors hover:text-gray-600"
            href="mailto:ubcuxhub@gmail.com"
          >
            Contact Us
          </a>
        </nav>

        {/* Social Icons */}
        <div className="flex items-center justify-center gap-10">
          <a
            href="https://www.linkedin.com/company/ubcuxhub/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="UBC UX Hub on LinkedIn"
          >
            <FaLinkedin size={35} />
          </a>

          <a
            href="https://instagram.com/ubcuxhub"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="UBC UX Hub on Instagram"
          >
            <FaInstagram size={35} />
          </a>

          <a
            href="https://linktr.ee/ubcuxhub?fbclid=PAZXh0bgNhZW0CMTEAAaf0yjegrtGiSXfSFyHbl76u5TnYyGoUSImwqeW6vbKvy74Cz_NmVY6_HVuUdw_aem_gG2KbQMNO5Yidm2tSQOltA"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="UBC UX Hub on Facebook"
          >
            <SiLinktree size={35} />
          </a>
        </div>

        {/* Land Acknowledgement */}
        <div className="mx-auto max-w-4xl">
          <p className="text-center text-xs leading-5 text-[#2F2E41]">
            UX Hub recognizes that we live, learn, and host our events on the
            traditional, ancestral, and unceded territory of the xʷməθkʷəy̓əm
            (Musqueam) and səlilwətaɬ (Tsleil-Waututh) Nations. We acknowledge
            the privilege this carries and are committed to ongoing learning,
            reflection, and action as part of our role in reconciliation. To
            further your understanding, we encourage you to explore{" "}
            <a
              href="#"
              className="underline transition-colors hover:text-blue-800 text-blue-600"
            >
              xʷi7xʷa Library&apos;s Indigenous Research Guide
            </a>{" "}
            and{" "}
            <a
              href="https://native-land.ca"
              className="underline transition-colors hover:text-blue-800 text-blue-600"
            >
              native-land.ca
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
