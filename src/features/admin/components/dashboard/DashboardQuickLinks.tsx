import Image from "next/image";
import { QuickLink } from "@/components/shared/QuickLink";
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

export function DashboardQuickLinks() {
  return <section aria-labelledby="quick-links-heading" className="space-y-5">
    <h2 id="quick-links-heading" className="text-h2">Quick Links</h2>
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      {links.map(({ name, description, icon: Icon, href }) => <QuickLink key={name} title={name} description={description} icon={<Icon />} href={href} unavailable="Google Drive link coming soon" />)}
    </div>
  </section>;
}
