import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "StakePoint Support",
  description: "StakePoint Helpdesk Admin Dashboard",
  manifest: "/helpdesk-manifest.json",
  themeColor: "#fb57ff",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SP Support",
  },
};

export default function HelpdeskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}