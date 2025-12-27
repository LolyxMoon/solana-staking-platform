"use client";

import { 
  Zap, 
  Clock, 
  Target, 
  Wallet, 
  TrendingUp, 
  Settings,
  ExternalLink,
  ArrowRight,
  BarChart3
} from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Lightning Fast Execution",
    description: "Execute trades in milliseconds when new liquidity pools are detected on Raydium and Meteora"
  },
  {
    icon: Target,
    title: "Precision Sniping",
    description: "Set your exact buy amount and let the bot execute the moment LP is added"
  },
  {
    icon: Clock,
    title: "24/7 Monitoring",
    description: "Never miss a launch - the bot monitors new pools around the clock"
  },
  {
    icon: Wallet,
    title: "Secure Wallet Management",
    description: "Generate or import wallets directly in Telegram with encrypted private key storage"
  },
  {
    icon: TrendingUp,
    title: "Limit Orders",
    description: "Set buy and sell orders at your target price - execute when the market hits your level"
  },
  {
    icon: BarChart3,
    title: "Position Tracking",
    description: "Track all your holdings, view PnL, and manage your portfolio directly in Telegram"
  },
];

const commands = [
  { command: "/start", description: "Initialize the bot and create your wallet" },
  { command: "/wallet", description: "View balance, deposit, or withdraw funds" },
  { command: "/positions", description: "See all your current token holdings" },
  { command: "/snipe", description: "Set up a snipe order for a token" },
  { command: "/orders", description: "View and manage pending orders" },
  { command: "/settings", description: "Configure slippage, gas, and preferences" },
  { command: "/pnl", description: "View your profit and loss stats" },
  { command: "/leaderboard", description: "See top traders on the platform" },
];

export default function SniperBotPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-16 sm:py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#fb57ff]/10 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#fb57ff]/10 border border-[#fb57ff]/20 mb-6">
              <Zap className="w-4 h-4 text-[#fb57ff]" />
              <span className="text-sm text-[#fb57ff] font-medium">Telegram Trading Bot</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              Solana Sniper Bot
            </h1>
            
            <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              Be first to buy new token launches on Solana. Our Telegram bot monitors Raydium and Meteora 
              for new liquidity pools and executes trades in milliseconds.
            </p>
            
            <a
              href="https://t.me/SPTSniperBot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(45deg, #fb57ff, #9333ea)' }}
            >
              Open in Telegram
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-12">
            {[
              { label: "Avg Response Time", value: "<100ms" },
              { label: "DEXs Supported", value: "Raydium & Meteora" },
              { label: "Platform", value: "Telegram" },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Why Use SPT Sniper?</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Professional-grade tools for catching new token launches
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div 
                key={feature.title}
                className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#fb57ff] to-purple-600 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Get started in under 2 minutes
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Start the Bot",
                description: "Open @SPTSniperBot in Telegram and tap /start to create your trading wallet"
              },
              {
                step: "2",
                title: "Fund Your Wallet",
                description: "Deposit SOL to your bot wallet using the address provided"
              },
              {
                step: "3",
                title: "Set Up Snipes",
                description: "Paste a token contract and set your buy amount - the bot handles the rest"
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#fb57ff] to-purple-600 flex items-center justify-center text-white font-bold text-xl mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commands */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Bot Commands</h2>
            <p className="text-gray-400">Quick reference for all available commands</p>
          </div>
          
          <div className="space-y-3">
            {commands.map((cmd) => (
              <div 
                key={cmd.command}
                className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]"
              >
                <code className="text-[#fb57ff] font-mono">{cmd.command}</code>
                <span className="text-gray-400 text-sm">{cmd.description}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="p-8 sm:p-12 rounded-2xl bg-gradient-to-br from-[#fb57ff]/20 to-purple-600/20 border border-[#fb57ff]/30 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Ready to Catch New Launches?
            </h2>
            <p className="text-gray-300 mb-8">
              Start sniping new token launches on Solana today.
            </p>
            <a
              href="https://t.me/SPTSniperBot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(45deg, #fb57ff, #9333ea)' }}
            >
              Launch Sniper Bot
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}