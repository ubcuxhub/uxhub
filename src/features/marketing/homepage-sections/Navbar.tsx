"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import Button from "@/features/marketing/components/Button";
import { useUser } from "@/context/UserContext";
import { FLAGS } from "@/lib/flags";
import { hasActiveMembership } from "@/lib/membership";

const navLink =
  "text-black no-underline font-sans font-medium leading-normal whitespace-nowrap decoration-transparent transition-all duration-200 hover:text-gray-600";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, membershipTermEndsAt, loading } = useUser();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => setOpen(false);

  const isMember = hasActiveMembership(user, membershipTermEndsAt);

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-white py-1">
      <nav className="flex h-20 items-center md:px-[5%] px-[5%]">
        {/* Logo */}
        <Link href="/" className="block" onClick={close}>
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

        {/* Mobile menu button */}
        <button
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex items-center justify-center rounded-md p-2 hover:bg-gray-100 md:hidden"
        >
          <Menu />
        </button>

        {/* Background blur overlay */}
        {open && (
          <div
            className="fixed inset-0 bg-black/10 backdrop-blur-sm md:hidden"
            onClick={close}
          />
        )}

        {/* Mobile dropdown */}
        {open && (
          <div
            className="absolute right-[5%] top-full w-[70%] rounded-xl bg-white shadow-lg backdrop-blur-md md:hidden"
            role="menu"
          >
            <div className="flex flex-col p-3 gap-2">
              <Link href="/" className={`${navLink} px-3 py-2`} onClick={close}>
                Home
              </Link>
              {FLAGS.studentEvents && (
                <Link href="/events" className={`${navLink} px-3 py-2`} onClick={close}>
                  Events
                </Link>
              )}
              <Link
                href="mailto:ubcuxhub@gmail.com"
                className={`${navLink} px-3 py-2`}
                onClick={close}
              >
                Contact Us
              </Link>
              <div className="mt-2 flex flex-col gap-2 px-3">
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
        )}
      </nav>
    </div>
  );
}
