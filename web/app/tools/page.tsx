"use client";

import Link from "next/link";
import { Sparkles, BarChart3, Wrench, Send, Camera, Shield, ShieldCheck } from "lucide-react";

const tools = [
  {
    title: "Wallet Cleanup",
    description: "Burn dust tokens and close empty accounts to reclaim SOL rent",
    href: "/tools/wallet-cleanup",
    icon: Sparkles,
    tags: ["Burn dust", "Close accounts", "Reclaim SOL"],
    available: true,
    color: "from-orange-500 to-red-500",
  },
  {
    title: "Wallet Analyzer",
    description: "Portfolio breakdown, PnL tracking, and wallet insights",
    href: "/tools/wallet-analyzer",
    icon: BarChart3,
    tags: ["Portfolio", "PnL tracking", "Analytics"],
    available: true,
    color: "from-blue-500 to-cyan-500",
  },
  {
    title: "Airdrop Tool",
    description: "Send tokens to multiple wallets in batches",
    href: "/tools/airdrop",
    icon: Send,
    tags: ["Batch transfers", "CSV upload", "Multi-send"],
    available: true,
    color: "from-green-500 to-emerald-500",
  },
  {
    title: "Holder Snapshot",
    description: "Get a list of all token holders with balances",
    href: "/tools/snapshot",
    icon: Camera,
    tags: ["Holder list", "Export CSV", "Analytics"],
    available: true,
    color: "from-purple-500 to-pink-500",
  },
  {
    title: "Token Safety",
    description: "Free security scan for any SPL token",
    href: "/tools/token-safety",
    icon: ShieldCheck,
    tags: ["Free", "Mint check", "Holder analysis"],
    available: true,
    color: "from-green-500 to-teal-500",
  },
  {
    title: "Sniper Bot",
    description: "Telegram bot for sniping new token launches",
    href: "https://t.me/SPTSniperBot",
    icon: Shield,
    tags: ["Telegram", "Auto-buy", "New launches"],
    available: true,
    color: "from-[#fb57ff] to-purple-600",
    external: true,
},
];

export default function ToolsPage() {
  return (
    <div className="max-w-6xl mx-auto pt-6 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#fb57ff] to-purple-600 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Tools</h1>
            <p className="text-gray-400 text-sm">Useful utilities for managing your Solana wallet</p>
          </div>
        </div>
      </div>

      {/* Tools Grid - 3x2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          tool.available ? (
            tool.external ? (
              
                key={tool.title}
                href={tool.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 transition-all group"
              >
                <div className="flex flex-col h-full">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                    <tool.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-semibold text-white group-hover:text-[#fb57ff] transition-colors">
                        {tool.title}
                      </h2>
                    </div>
                    <p className="text-gray-400 text-sm mb-3">{tool.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tool.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.05] text-xs text-gray-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </a>
            ) : (
              <Link
                key={tool.title}
                href={tool.href}
                className="block p-5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 transition-all group"
              >
              <div className="flex flex-col h-full">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                  <tool.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-semibold text-white group-hover:text-[#fb57ff] transition-colors">
                      {tool.title}
                    </h2>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">{tool.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tool.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.05] text-xs text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ) : (
            <div
              key={tool.title}
              className="block p-5 rounded-xl bg-white/[0.01] border border-white/[0.03] border-dashed opacity-60"
            >
              <div className="flex flex-col h-full">
                <div className="w-12 h-12 rounded-xl bg-white/[0.02] flex items-center justify-center mb-4">
                  <tool.icon className="w-6 h-6 text-gray-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-semibold text-gray-500">{tool.title}</h2>
                    <span className="px-2 py-0.5 rounded text-xs bg-white/[0.05] text-gray-500">Coming Soon</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{tool.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tool.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-md bg-white/[0.02] border border-white/[0.03] text-xs text-gray-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}