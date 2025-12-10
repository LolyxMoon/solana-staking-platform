"use client";

import Link from "next/link";
import { Sparkles, BarChart3, Wrench, Send } from "lucide-react";

const tools = [
  {
    title: "Wallet Cleanup",
    description: "Burn dust tokens and close empty accounts to reclaim SOL rent",
    href: "/tools/wallet-cleanup",
    icon: Sparkles,
    tags: ["Burn tokens under $1", "Close empty accounts", "Reclaim ~0.002 SOL per account"],
    available: true,
  },
  {
    title: "Wallet Analyzer",
    description: "Portfolio breakdown, PnL tracking, and wallet insights",
    href: "/tools/wallet-analyzer",
    icon: BarChart3,
    tags: ["Portfolio value", "PnL tracking", "24h changes"],
    available: true,
  },
  {
    title: "Airdrop Tool",
    description: "Send tokens to multiple wallets in batches",
    href: "/tools/airdrop",
    icon: Send,
    tags: ["Batch transfers", "CSV upload", "Multi-recipient"],
    available: false,
  },
];

export default function ToolsPage() {
  return (
    <div className="max-w-4xl mx-auto pt-6">
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

      {/* Tools Grid */}
      <div className="space-y-4">
        {tools.map((tool) => (
          tool.available ? (
            <Link
              key={tool.title}
              href={tool.href}
              className="block p-6 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#fb57ff]/20 to-purple-600/20 flex items-center justify-center group-hover:from-[#fb57ff]/30 group-hover:to-purple-600/30 transition-all">
                  <tool.icon className="w-6 h-6" style={{ color: '#fb57ff' }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-white group-hover:text-[#fb57ff] transition-colors">
                      {tool.title}
                    </h2>
                    <span className="text-gray-500 group-hover:text-[#fb57ff] transition-colors">→</span>
                  </div>
                  <p className="text-gray-400 text-sm mt-1">{tool.description}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
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
              </div>
            </Link>
          ) : (
            <div
              key={tool.title}
              className="block p-6 rounded-xl bg-white/[0.01] border border-white/[0.03] border-dashed opacity-60"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/[0.02] flex items-center justify-center">
                  <tool.icon className="w-6 h-6 text-gray-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-500">{tool.title}</h2>
                    <span className="px-2 py-0.5 rounded text-xs bg-white/[0.05] text-gray-500">Coming Soon</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">{tool.description}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
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
            </div>
          )
        ))}
      </div>
    </div>
  );
}