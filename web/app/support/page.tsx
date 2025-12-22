import { Metadata } from "next";
import SupportClient from "./SupportClient";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with StakePoint - Contact our support team via email or Twitter for assistance with staking, pools, and more.",
};

export default function SupportPage() {
  return <SupportClient />;
}

