"use client";

import Link from "next/link";
import Image from "next/image";
import Button from "@/features/marketing/components/Button";
import { useUser } from "@/context/UserContext";
import { FLAGS } from "@/lib/flags";
import { hasActiveMembership } from "@/lib/membership";

const navLink =
  "text-black no-underline font-sans font-medium leading-normal whitespace-nowrap decoration-transparent transition-all duration-200 hover:text-gray-600";

export default function Navbar() {
  const { user, membershipTermEndsAt, loading } = useUser();

  const isMember = hasActiveMembership(user, membershipTermEndsAt);

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-white py-1">
      <nav className="flex h-20 items-center md:px-[5%] px-[5%]">
        {/* Logo */}
        <Link href="/" className="block">
          <div className="w-[48px] h-[48px]">
            <Image
              src="/logo.png"
              alt="UBC UX HUB"
              width={80}
              height={80}
              className="h-full w-full"
              priority
            />
          </div>
        </Link>

        <div className="ml-auto hidden md:flex items-center">
          <div className="flex items-center gap-8">
            <Link href="/" className={navLink}>
              Home
            </Link>
            {FLAGS.studentEvents && (
              <Link href="/events" className={navLink}>
                Events
              </Link>
            )}
            <Link href="mailto:ubcuxhub@gmail.com" className={navLink}>
              Contact Us
            </Link>

            <div className="flex items-center gap-4">
              {!loading ? (
                <>
                  {user && (
                    <Button variant={isMember ? "primary" : "secondary"} withArrow={false} shorterHeight={true} href="/portal">
                      GO TO PORTAL
                    </Button>
                  )}
                  {!user ? (
                    <Button variant="primary" withArrow={false} shorterHeight={true} href="/auth/login">
                      LOGIN TO PORTAL
                    </Button>
                  ) : (
                    !isMember && (
                      <Button variant="primary" withArrow={false} shorterHeight={true} href="/portal/membership/join">
                        BECOME A MEMBER
                      </Button>
                    )
                  )}
                </>
              ) : (
                <Button variant="primary" withArrow={false} shorterHeight={true} href="/auth/login">
                  LOGIN TO PORTAL
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="ml-auto md:hidden">
          {!loading && user ? (
            <Button
              variant={isMember ? "primary" : "secondary"}
              withArrow={false}
              shorterHeight={true}
              href="/portal"
            >
              GO TO PORTAL
            </Button>
          ) : (
            <Button
              variant="primary"
              withArrow={false}
              shorterHeight={true}
              href="/auth/login"
            >
              LOGIN TO PORTAL
            </Button>
          )}
        </div>
      </nav>
    </div>
  );
}
