export const metadata = {
  title: "StakePoint Pool Embed",
  description: "Embedded staking pool powered by StakePoint",
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Just pass through children - the root layout handles html/body
  // We're relying on LayoutContent to skip navbar/sidebar for /embed routes
  return <>{children}</>;
}

