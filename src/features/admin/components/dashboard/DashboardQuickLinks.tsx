import Image from "next/image";
import { SiGoogledrive, SiNotion } from "react-icons/si";
import { FaSlack } from "react-icons/fa6";

function WebsiteIcon({ className }: { className?: string }) {
  return <Image src="/icons/icon-dark.svg" alt="" width={28} height={28} className={`${className} dark:invert`} />;
}

const links = [
  { name: "Website", description: "Main Page", icon: WebsiteIcon },
  { name: "Notion", description: "Planning", icon: SiNotion },
  { name: "Slack", description: "Messages", icon: FaSlack },
  { name: "Drive", description: "Files", icon: SiGoogledrive },
];

export function DashboardQuickLinks() {
  return (
    <section aria-labelledby="quick-links-heading" className="space-y-5">
      <h2 id="quick-links-heading" className="text-h2">Quick Links</h2>
      <div className="grid grid-cols-2 gap-4">
        {links.map(({ name, description, icon: Icon }) => (
          <button key={name} disabled title="Link coming soon" aria-label={`${name}: link coming soon`}
            className="flex min-w-0 items-center gap-3 rounded-md border bg-secondary px-4 py-3 text-left disabled:cursor-not-allowed">
            <Icon aria-hidden="true" className="size-7 shrink-0" />
            <span className="min-w-0"><span className="block font-medium">{name}</span><span className="block text-label text-fg-secondary">{description}</span></span>
          </button>
        ))}
      </div>
      <p className="text-label text-fg-muted">Links coming soon.</p>
    </section>
  );
}
