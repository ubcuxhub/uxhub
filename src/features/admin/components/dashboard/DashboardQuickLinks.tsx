import Image from "next/image";
import { SiGoogledrive, SiNotion } from "react-icons/si";
import { FaSlack } from "react-icons/fa6";

function WebsiteIcon({ className }: { className?: string }) {
  return <Image src="/icons/icon-dark.svg" alt="" width={28} height={28} className={`${className} dark:invert`} />;
}

const links = [
  { name: "Website", description: "Main Page", icon: WebsiteIcon, href: "https://www.ubcuxhub.ca/" },
  { name: "Notion", description: "Planning", icon: SiNotion, href: "https://app.notion.com/p/3342f9f09f1880038056d20a8cb5f772?v=3342f9f09f1881b68878000c67901a56&source=copy_link" },
  { name: "Slack", description: "Messages", icon: FaSlack, href: "https://uxhub2627.slack.com/archives/C0ARSMVRV1D" },
  { name: "Drive", description: "Files", icon: SiGoogledrive, href: null },
];

const tileClassName = "flex min-w-0 items-center gap-3 rounded-md border bg-secondary px-4 py-3 text-left";

export function DashboardQuickLinks() {
  return (
    <section aria-labelledby="quick-links-heading" className="space-y-5">
      <h2 id="quick-links-heading" className="text-h2">Quick Links</h2>
      <div className="grid grid-cols-2 gap-4">
        {links.map(({ name, description, icon: Icon, href }) => {
          const content = <>
            <Icon aria-hidden="true" className="size-7 shrink-0" />
            <span className="min-w-0"><span className="block font-medium">{name}</span><span className="block text-label text-fg-secondary">{description}</span></span>
          </>;

          return href ? (
            <a key={name} href={href} target="_blank" rel="noopener noreferrer"
              aria-label={`${name} (opens in a new tab)`}
              className={`${tileClassName} transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
              {content}
            </a>
          ) : (
            <button key={name} disabled title="Link coming soon" aria-label={`${name}: link coming soon`}
              className={`${tileClassName} disabled:cursor-not-allowed`}>
              {content}
            </button>
          );
        })}
      </div>
      <p className="text-label text-fg-muted">Google Drive link coming soon.</p>
    </section>
  );
}
