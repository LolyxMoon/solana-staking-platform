"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  Shield,
  Coins,
  Lock,
  ArrowDownUp,
  Users,
  TrendingUp,
  Zap,
  BarChart3,
  Award,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Send,
  Twitter,
  Sparkles,
  Crown,
  Globe,
  FileText,
  Target,
  Layers,
  RefreshCw,
  PieChart,
  ExternalLink,
} from "lucide-react";

interface Section {
  id: string;
  title: string;
  icon: any;
}

export default function WhitepaperPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("introduction");

  const socialLinks = {
    telegram: "https://t.me/StakePointPortal",
    twitter: "https://x.com/StakePointApp",
  };

  const sections: Section[] = [
    { id: "introduction", title: "Introduction", icon: FileText },
    { id: "problem", title: "The Problem", icon: Target },
    { id: "solution", title: "Our Solution", icon: Zap },
    { id: "features", title: "Core Features", icon: Layers },
    { id: "architecture", title: "Architecture", icon: Shield },
    { id: "tokenomics", title: "Tokenomics", icon: PieChart },
    { id: "roadmap", title: "Roadmap", icon: Rocket },
    { id: "team", title: "Team & Community", icon: Users },
  ];

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-[#060609] relative">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#060609] border-b border-white/[0.05]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full blur-3xl"
            style={{ background: "rgba(251, 87, 255, 0.05)" }}
          />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 py-16 lg:py-20">
          <div className="text-center space-y-6">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm"
              style={{ background: "rgba(251, 87, 255, 0.1)", color: "#fb57ff" }}
            >
              <FileText className="w-4 h-4" />
              Whitepaper v1.0
            </div>

            <h1 className="text-4xl lg:text-6xl font-bold leading-tight text-white">
              StakePoint
            </h1>

            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              The All-in-One DeFi Platform on Solana
            </p>

            <p className="text-sm text-gray-500 max-w-2xl mx-auto">
              A comprehensive decentralized finance ecosystem combining token staking, 
              liquidity farming, optimized swaps, and secure token lockers.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="relative max-w-6xl mx-auto px-6 py-12 lg:py-16">
        <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
          {/* Sidebar Navigation */}
          <aside className="hidden lg:block relative">
            <div className="fixed top-24 w-[220px] space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 px-3">
                Contents
              </p>
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all text-left"
                  style={{
                    background:
                      activeSection === section.id
                        ? "rgba(251, 87, 255, 0.1)"
                        : "transparent",
                    color:
                      activeSection === section.id ? "#fb57ff" : "#9ca3af",
                  }}
                  onMouseEnter={(e) => {
                    if (activeSection !== section.id) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeSection !== section.id) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <section.icon className="w-4 h-4" />
                  {section.title}
                </button>
              ))}
            </div>
          </aside>

          {/* Content */}
          <main className="space-y-16">
            {/* Introduction */}
            <section id="introduction" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(251, 87, 255, 0.1)" }}
                >
                  <FileText className="w-5 h-5" style={{ color: "#fb57ff" }} />
                </div>
                <h2 className="text-2xl font-bold text-white">Introduction</h2>
              </div>

              <div className="space-y-4 text-gray-400 leading-relaxed">
                <p>
                  StakePoint is a comprehensive decentralized finance (DeFi) platform built on 
                  Solana, designed to provide users with a unified ecosystem for earning passive 
                  income through multiple mechanisms. By combining token staking, liquidity farming, 
                  optimized token swaps, and secure locking mechanisms, StakePoint eliminates the 
                  need for users to navigate multiple protocols.
                </p>
                <p>
                  Our mission is to democratize access to DeFi yields while maintaining the highest 
                  standards of security and user experience. Whether you're a first-time DeFi user 
                  or an experienced yield farmer, StakePoint provides the tools you need to maximize 
                  your returns on Solana.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                  {[
                     { label: "Built On", value: "Solana", icon: Globe },
                    { label: "Launch", value: "Dec 2025", icon: Rocket },
                    { label: "Products", value: "6+", icon: Layers },
                    { label: "Focus", value: "DeFi", icon: TrendingUp },
                    ].map((stat, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-lg text-center"
                    >
                      <stat.icon
                        className="w-5 h-5 mx-auto mb-2"
                        style={{ color: "#fb57ff" }}
                      />
                      <p className="text-lg font-bold text-white">{stat.value}</p>
                      <p className="text-xs text-gray-500">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* The Problem */}
            <section id="problem" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(251, 87, 255, 0.1)" }}
                >
                  <Target className="w-5 h-5" style={{ color: "#fb57ff" }} />
                </div>
                <h2 className="text-2xl font-bold text-white">The Problem</h2>
              </div>

              <div className="space-y-4 text-gray-400 leading-relaxed">
                <p>
                  The current DeFi landscape presents several challenges for users seeking to 
                  maximize their yields:
                </p>

                <div className="space-y-3 mt-6">
                  {[
                    {
                      title: "Fragmented Ecosystem",
                      description:
                        "Users must navigate multiple protocols for staking, swapping, and farming, leading to a confusing and inefficient experience.",
                    },
                    {
                      title: "High Barriers to Entry",
                      description:
                        "Many platforms require minimum deposits, complex setup processes, or technical knowledge that excludes casual users.",
                    },
                    {
                      title: "Limited Flexibility",
                      description:
                        "Most staking platforms lock funds for extended periods without options for early withdrawal or flexible terms.",
                    },
                    {
                      title: "Lack of Transparency",
                      description:
                        "Opaque reward calculations and hidden fees make it difficult for users to understand their true returns.",
                    },
                    {
                      title: "Security Concerns",
                      description:
                        "The proliferation of unaudited protocols and rug pulls has eroded trust in DeFi platforms.",
                    },
                  ].map((problem, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-lg"
                    >
                      <h4 className="text-sm font-semibold text-white mb-1">
                        {problem.title}
                      </h4>
                      <p className="text-xs text-gray-500">{problem.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Our Solution */}
            <section id="solution" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(251, 87, 255, 0.1)" }}
                >
                  <Zap className="w-5 h-5" style={{ color: "#fb57ff" }} />
                </div>
                <h2 className="text-2xl font-bold text-white">Our Solution</h2>
              </div>

              <div className="space-y-4 text-gray-400 leading-relaxed">
                <p>
                  StakePoint addresses these challenges by providing an all-in-one DeFi platform 
                  that combines the most essential yield-generating tools in a single, user-friendly 
                  interface:
                </p>

                <div className="grid md:grid-cols-2 gap-4 mt-6">
                  {[
                    {
                      icon: Coins,
                      title: "Unified Platform",
                      description:
                        "Access staking, farming, swaps, and lockers from one dashboard without switching between protocols.",
                    },
                    {
                      icon: Zap,
                      title: "No Minimums",
                      description:
                        "Start earning with any amount. No minimum deposit requirements for any of our products.",
                    },
                    {
                      icon: RefreshCw,
                      title: "Flexible Options",
                      description:
                        "Choose between locked pools for higher yields or unlocked pools for maximum flexibility.",
                    },
                    {
                      icon: BarChart3,
                      title: "Full Transparency",
                      description:
                        "Real-time reward tracking, clear fee structures, and on-chain verification of all transactions.",
                    },
                  ].map((solution, idx) => (
                    <div
                      key={idx}
                      className="p-5 bg-white/[0.02] border border-white/[0.05] rounded-lg hover:bg-white/[0.04] transition-all"
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor =
                          "rgba(251, 87, 255, 0.2)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor = "")
                      }
                    >
                      <solution.icon
                        className="w-6 h-6 mb-3"
                        style={{ color: "#fb57ff" }}
                      />
                      <h4 className="text-base font-semibold text-white mb-2">
                        {solution.title}
                      </h4>
                      <p className="text-sm text-gray-500">{solution.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Core Features */}
            <section id="features" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(251, 87, 255, 0.1)" }}
                >
                  <Layers className="w-5 h-5" style={{ color: "#fb57ff" }} />
                </div>
                <h2 className="text-2xl font-bold text-white">Core Features</h2>
              </div>

              <div className="space-y-6">
                {/* Token Staking */}
                <div className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(251, 87, 255, 0.2)" }}
                    >
                      <Coins className="w-5 h-5" style={{ color: "#fb57ff" }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Token Staking</h3>
                      <p className="text-xs text-gray-500">
                        Earn passive income on your SPL tokens
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm text-gray-400">
                    <p>
                      Our multi-pool staking system allows users to stake any supported SPL token 
                      and earn rewards. Key features include:
                    </p>
                    <ul className="space-y-2 ml-4">
                      <li className="flex items-start gap-2">
                        <span style={{ color: "#fb57ff" }}>•</span>
                        <span><strong className="text-white">Reflection Rewards:</strong> Earn additional tokens through our reflection distribution system</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: "#fb57ff" }}>•</span>
                        <span><strong className="text-white">Flexible & Locked Pools:</strong> Choose your preferred lock period for optimized yields</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: "#fb57ff" }}>•</span>
                        <span><strong className="text-white">Real-Time Tracking:</strong> Monitor your rewards accumulate in real-time</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: "#fb57ff" }}>•</span>
                        <span><strong className="text-white">Instant Claims:</strong> Withdraw your rewards at any time without waiting periods</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Token Swaps */}
                <div className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(251, 87, 255, 0.2)" }}
                    >
                      <ArrowDownUp className="w-5 h-5" style={{ color: "#fb57ff" }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Jupiter-Powered Swaps</h3>
                      <p className="text-xs text-gray-500">
                        Optimal routing across Solana DEXs
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm text-gray-400">
                    <p>
                      Integrated with Jupiter aggregator to provide the best swap rates across 
                      all major Solana DEXs:
                    </p>
                    <ul className="space-y-2 ml-4">
                      <li className="flex items-start gap-2">
                        <span style={{ color: "#fb57ff" }}>•</span>
                        <span><strong className="text-white">Best Rates:</strong> Automatic route optimization for minimal slippage</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: "#fb57ff" }}>•</span>
                        <span><strong className="text-white">Trader Leaderboard:</strong> Gamified trading with rankings and performance tracking</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: "#fb57ff" }}>•</span>
                        <span><strong className="text-white">Low-Liquidity Support:</strong> Raydium fallback for tokens not on Jupiter</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Liquidity Farming */}
                <div className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(251, 87, 255, 0.2)" }}
                    >
                      <TrendingUp className="w-5 h-5" style={{ color: "#fb57ff" }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Liquidity Farming</h3>
                      <p className="text-xs text-gray-500">
                        Earn yields on LP positions
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm text-gray-400">
                    <p>
                      Stake your LP tokens from supported DEXs to earn additional rewards:
                    </p>
                    <ul className="space-y-2 ml-4">
                      <li className="flex items-start gap-2">
                        <span style={{ color: "#fb57ff" }}>•</span>
                        <span><strong className="text-white">Dual Rewards:</strong> Earn farming rewards on top of DEX trading fees</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: "#fb57ff" }}>•</span>
                        <span><strong className="text-white">Competitive APYs:</strong> Higher yields for liquidity providers</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Token Lockers */}
                <div className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(251, 87, 255, 0.2)" }}
                    >
                      <Lock className="w-5 h-5" style={{ color: "#fb57ff" }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Token & LP Lockers</h3>
                      <p className="text-xs text-gray-500">
                        Secure vesting and liquidity locks
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm text-gray-400">
                    <p>
                      Enterprise-grade locking solutions for projects and teams:
                    </p>
                    <ul className="space-y-2 ml-4">
                      <li className="flex items-start gap-2">
                        <span style={{ color: "#fb57ff" }}>•</span>
                        <span><strong className="text-white">Team Token Locks:</strong> Vesting schedules for team allocations</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: "#fb57ff" }}>•</span>
                        <span><strong className="text-white">Liquidity Locks:</strong> Build investor trust with locked LP tokens</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: "#fb57ff" }}>•</span>
                        <span><strong className="text-white">Custom Schedules:</strong> Flexible unlock periods and cliff options</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Whale Club */}
                <div className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(251, 87, 255, 0.2)" }}
                    >
                      <Crown className="w-5 h-5" style={{ color: "#fb57ff" }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Whale Club</h3>
                      <p className="text-xs text-gray-500">
                        Exclusive tier for high-value holders
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm text-gray-400">
                    <p>
                      Premium membership tier for dedicated community members:
                    </p>
                    <ul className="space-y-2 ml-4">
                      <li className="flex items-start gap-2">
                        <span style={{ color: "#fb57ff" }}>•</span>
                        <span><strong className="text-white">Protocol Input:</strong> Direct influence on platform development and features</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: "#fb57ff" }}>•</span>
                        <span><strong className="text-white">Exclusive Access:</strong> Early access to new features and pools</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: "#fb57ff" }}>•</span>
                        <span><strong className="text-white">Community Recognition:</strong> Leaderboard visibility and special badges</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* Architecture */}
            <section id="architecture" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(251, 87, 255, 0.1)" }}
                >
                  <Shield className="w-5 h-5" style={{ color: "#fb57ff" }} />
                </div>
                <h2 className="text-2xl font-bold text-white">Architecture & Security</h2>
              </div>

              <div className="space-y-4 text-gray-400 leading-relaxed">
                <p>
                  StakePoint is built on a robust technical foundation prioritizing security, 
                  scalability, and user experience:
                </p>

                <div className="grid md:grid-cols-2 gap-4 mt-6">
                  <div className="p-5 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                    <h4 className="text-base font-semibold text-white mb-3">
                      Smart Contracts
                    </h4>
                    <ul className="space-y-2 text-sm text-gray-500">
                      <li>• Built with Anchor framework on Solana</li>
                      <li>• Program ID verified on-chain</li>
                      <li>• Upgradeable with multi-sig controls</li>
                      <li>• Comprehensive error handling</li>
                    </ul>
                  </div>

                  <div className="p-5 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                    <h4 className="text-base font-semibold text-white mb-3">
                      Frontend
                    </h4>
                    <ul className="space-y-2 text-sm text-gray-500">
                      <li>• Next.js with TypeScript</li>
                      <li>• Solana Web3.js integration</li>
                      <li>• Real-time blockchain data</li>
                      <li>• Mobile-responsive design</li>
                    </ul>
                  </div>

                  <div className="p-5 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                    <h4 className="text-base font-semibold text-white mb-3">
                      Security Measures
                    </h4>
                    <ul className="space-y-2 text-sm text-gray-500">
                      <li>• Non-custodial architecture</li>
                      <li>• Admin controls with timelock</li>
                      <li>• Emergency pause functionality</li>
                      <li>• Rate limiting and validation</li>
                    </ul>
                  </div>

                  <div className="p-5 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                    <h4 className="text-base font-semibold text-white mb-3">
                      Infrastructure
                    </h4>
                    <ul className="space-y-2 text-sm text-gray-500">
                      <li>• Deployed on Vercel Edge Network</li>
                      <li>• Supabase for off-chain data</li>
                      <li>• Multiple RPC providers</li>
                      <li>• 99.9% uptime target</li>
                    </ul>
                  </div>
                </div>

                <div
                  className="p-4 rounded-lg mt-6"
                  style={{ background: "rgba(251, 87, 255, 0.05)", border: "1px solid rgba(251, 87, 255, 0.1)" }}
                >
                  <p className="text-sm" style={{ color: "#fb57ff" }}>
                    <strong>Program ID:</strong>{" "}
                    <code className="text-xs bg-black/30 px-2 py-1 rounded">
                      gLHaGJsZ6G7AXZxoDL9EsSWkRbKAWhFHi73gVfNXuzK
                    </code>
                  </p>
                </div>
              </div>
            </section>

            {/* Tokenomics */}
            <section id="tokenomics" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(251, 87, 255, 0.1)" }}
                >
                  <PieChart className="w-5 h-5" style={{ color: "#fb57ff" }} />
                </div>
                <h2 className="text-2xl font-bold text-white">Tokenomics</h2>
              </div>

              <div className="space-y-4 text-gray-400 leading-relaxed">
                <p>
                  The StakePoint platform token serves as the utility and governance token 
                  for the ecosystem:
                </p>

                <div
                  className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-xl mt-6"
                >

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Token Name", value: "StakePoint" },
                        { label: "Total Supply", value: "1.33B" },
                        { label: "Network", value: "Solana" },
                        { label: "Type", value: "Token2022" },
                    ].map((item, idx) => (
                      <div key={idx} className="text-center">
                        <p className="text-lg font-bold text-white">{item.value}</p>
                        <p className="text-xs text-gray-500">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <h4 className="text-lg font-semibold text-white mt-8 mb-4">
                  Platform Revenue
                </h4>

                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    {
                      source: "Staking Fees",
                      description: "Small fee on staking deposits and reward claims",
                    },
                    {
                      source: "Swap Fees",
                      description: "Percentage of swap volume through our interface",
                    },
                    {
                      source: "Locker Fees",
                      description: "One-time fee for creating token and LP locks",
                    },
                  ].map((revenue, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-lg"
                    >
                      <h5 className="text-sm font-semibold text-white mb-1">
                        {revenue.source}
                      </h5>
                      <p className="text-xs text-gray-500">{revenue.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Roadmap */}
            <section id="roadmap" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(251, 87, 255, 0.1)" }}
                >
                  <Rocket className="w-5 h-5" style={{ color: "#fb57ff" }} />
                </div>
                <h2 className="text-2xl font-bold text-white">Roadmap</h2>
              </div>

              <div className="space-y-4 text-gray-400 leading-relaxed">
                <p>
                  Our development roadmap outlines the key milestones for StakePoint's growth:
                </p>

                <div className="space-y-4 mt-6">
                  {[
                    {
                      phase: "Phase 1",
                      title: "Foundation",
                      status: "Completed",
                      items: [
                        "Multi-pool token staking",
                        "Jupiter-powered swaps",
                        "Token & LP lockers",
                        "Whale Club",
                        "Liquidity farming",
                      ],
                    },
                    {
                      phase: "Phase 2",
                      title: "Growth",
                      status: "In Progress",
                      items: [
                        "Community building",
                        "Project onboarding",
                        "Marketing & visibility",
                        "Exchange listings",
                      ],
                    },
                    {
                      phase: "Phase 3",
                      title: "Expansion",
                      status: "Upcoming",
                      items: [
                        "Airdrop tools",
                        "Wallet cleaner",
                        "Advanced analytics",
                        "Developer API",
                      ],
                    },
                    {
                      phase: "Phase 4",
                      title: "Scale",
                      status: "Upcoming",
                      items: [
                        "Mobile application",
                        "EVM chain expansion",
                        "Cross-chain staking",
                      ],
                    },
                  ].map((phase, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{
                              background:
                                phase.status === "Completed"
                                  ? "rgba(34, 197, 94, 0.1)"
                                  : phase.status === "In Progress"
                                  ? "rgba(251, 87, 255, 0.1)"
                                  : "rgba(102, 102, 102, 0.1)",
                              color:
                                phase.status === "Completed"
                                  ? "#22c55e"
                                  : phase.status === "In Progress"
                                  ? "#fb57ff"
                                  : "#666666",
                            }}
                          >
                            {phase.phase}
                          </span>
                          <span className="text-sm font-semibold text-white">
                            {phase.title}
                          </span>
                        </div>
                        <span
                          className="text-xs"
                          style={{
                            color:
                              phase.status === "Completed"
                                ? "#22c55e"
                                : phase.status === "In Progress"
                                ? "#fb57ff"
                                : "#666666",
                          }}
                        >
                          {phase.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {phase.items.map((item, itemIdx) => (
                          <span
                            key={itemIdx}
                            className="text-xs px-2 py-1 bg-white/[0.03] rounded text-gray-500"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => router.push("/roadmap")}
                  className="inline-flex items-center gap-2 mt-4 text-sm font-medium transition-all"
                  style={{ color: "#fb57ff" }}
                >
                  View Full Roadmap
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </section>

            {/* Team & Community */}
            <section id="team" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(251, 87, 255, 0.1)" }}
                >
                  <Users className="w-5 h-5" style={{ color: "#fb57ff" }} />
                </div>
                <h2 className="text-2xl font-bold text-white">Team & Community</h2>
              </div>

              <div className="space-y-4 text-gray-400 leading-relaxed">
                <p>
                  StakePoint is built by a dedicated team of blockchain developers and DeFi 
                  enthusiasts committed to creating the best staking experience on Solana.
                </p>

                <div
                  className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-xl mt-6"
                >
                  <h4 className="text-lg font-semibold text-white mb-4">
                    Join Our Community
                  </h4>
                  <p className="text-sm text-gray-500 mb-6">
                    Stay updated with the latest developments, participate in discussions, 
                    and connect with other community members.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <a
                      href={socialLinks.telegram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/[0.05] border border-white/[0.05] rounded-lg hover:bg-white/[0.08] transition-all text-sm font-medium"
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor =
                          "rgba(251, 87, 255, 0.3)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor = "")
                      }
                    >
                      <Send className="w-4 h-4" />
                      Telegram
                      <ExternalLink className="w-3 h-3 text-gray-500" />
                    </a>
                    <a
                      href={socialLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/[0.05] border border-white/[0.05] rounded-lg hover:bg-white/[0.08] transition-all text-sm font-medium"
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor =
                          "rgba(251, 87, 255, 0.3)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor = "")
                      }
                    >
                      <Twitter className="w-4 h-4" />
                      Twitter / X
                      <ExternalLink className="w-3 h-3 text-gray-500" />
                    </a>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* CTA Section */}
      <section className="relative py-16 bg-[#060609] border-t border-white/[0.05]">
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h2
            className="text-3xl lg:text-4xl font-bold mb-3"
            style={{
              background: "linear-gradient(45deg, white, #fb57ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Ready to Start Earning?
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Join thousands of users already earning passive income on StakePoint
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => router.push("/pools")}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all font-semibold text-sm"
              style={{ background: "linear-gradient(45deg, black, #fb57ff)" }}
            >
              <Sparkles className="w-4 h-4" />
              Explore Pools
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push("/roadmap")}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/[0.05] border border-white/[0.05] rounded-lg hover:bg-white/[0.08] transition-all font-semibold text-sm"
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "rgba(251, 87, 255, 0.3)")
              }
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
            >
              <Rocket className="w-4 h-4" />
              View Roadmap
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/[0.05] bg-[#060609] py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <p className="text-gray-400">
                © 2025 StakePoint. Built on Solana with ❤️
              </p>
            </div>

            <div className="flex items-center gap-4">
              <a
                href={socialLinks.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 bg-white/[0.02] border border-white/[0.05] rounded-full hover:bg-white/[0.05] transition-all"
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(251, 87, 255, 0.3)")
                }
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
                aria-label="Telegram"
              >
                <Send className="w-5 h-5 text-gray-400" />
              </a>
              <a
                href={socialLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 bg-white/[0.02] border border-white/[0.05] rounded-full hover:bg-white/[0.05] transition-all"
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(251, 87, 255, 0.3)")
                }
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5 text-gray-400" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}