import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
  link: string;
  label?: string;
  className?: string;
}

export function BackButton({ link, label = "Back", className }: BackButtonProps) {
  return (
    <Button asChild variant="outline" className={className}>
      <Link href={link}>
        <ArrowLeft className="mr-2" />
        {label}
      </Link>
    </Button>
  );
}

