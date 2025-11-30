"use client";

import { useState } from "react";
import { 
  BookOpen, 
  Rocket, 
  Coins, 
  Shield, 
  TrendingUp, 
  Lock, 
  Zap,
  DollarSign,
  Users,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  ExternalLink,
  Wallet,
  Plus,
  RefreshCw,
  Gift,
  Clock,
  Info,
  Send
} from "lucide-react";

export default function DocsClient() {
  const [activeSection, setActiveSection] = useState("intro");

  const sections = [
    { id: "intro", title: "Introduction", icon: BookOpen },
    { id: "getting-started", title: "Getting Started", icon: Rocket },
    { id: "how-to-stake", title: "How to Stake", icon: Coins },
    { id: "creating-pools", title: "Creating Pools", icon: Plus },
    { id: "reflections", title: "Reflections", icon: Gift },
    { id: "apy-apr", title: "APY & APR", icon: TrendingUp },
    { id: "lock-periods", title: "Lock Periods", icon: Lock },
    { id: "fees", title: "Fees & Costs", icon: DollarSign },
    { id: "pool-management", title: "Pool Management", icon: Users },
    { id: "security", title: "Security", icon: Shield },
    { id: "faq", title: "FAQ", icon: AlertCircle },
  ];

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-[#060609] text-white">
      {/* Hero Section */}
      <div className="relative border-b border-white/[0.05] bg-gradient-to-b from-black/50 to-[#060609]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-[600px] h-[600px] rounded-full blur-3xl" style={{ background: 'rgba(251, 87, 255, 0.08)' }} />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.05] border border-white/[0.05] rounded-full mb-4">
              <BookOpen className="w-4 h-4 text-[#fb57ff]" />
              <span className="text-sm text-gray-300">Documentation</span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold bg-gradient-to-r from-white via-white to-[#fb57ff] bg-clip-text text-transparent">
              StakePoint Docs
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Everything you need to know about staking on Solana's most advanced staking platform
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Contents
              </h3>
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-left ${
                      activeSection === section.id
                        ? "bg-gradient-to-r from-[#fb57ff]/20 to-transparent border-l-2 border-[#fb57ff] text-white"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium">{section.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-16">
            
            {/* Introduction */}
            <section id="intro" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-[#fb57ff]/20 to-transparent border border-[#fb57ff]/30 rounded-xl">
                  <BookOpen className="w-6 h-6 text-[#fb57ff]" />
                </div>
                <h2 className="text-3xl font-bold">Introduction</h2>
              </div>
              
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>
                  Welcome to <span className="text-white font-semibold">StakePoint</span>, the most advanced staking platform on Solana. 
                  Our protocol enables users to stake SPL tokens and Token-2022 assets to earn passive rewards with industry-leading APYs.
                </p>
                
                <div className="grid md:grid-cols-3 gap-4 my-8">
                  <div className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:border-[#fb57ff]/30 transition-all">
                    <Shield className="w-8 h-8 text-[#fb57ff] mb-3" />
                    <h3 className="text-white font-semibold mb-2">Secure & Audited</h3>
                    <p className="text-sm text-gray-400">Built with Anchor framework on Solana for maximum security</p>
                  </div>
                  
                  <div className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:border-[#fb57ff]/30 transition-all">
                    <TrendingUp className="w-8 h-8 text-[#fb57ff] mb-3" />
                    <h3 className="text-white font-semibold mb-2">High APY</h3>
                    <p className="text-sm text-gray-400">Earn competitive yields with dynamic APR calculations</p>
                  </div>
                  
                  <div className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:border-[#fb57ff]/30 transition-all">
                    <Zap className="w-8 h-8 text-[#fb57ff] mb-3" />
                    <h3 className="text-white font-semibold mb-2">Flexible Options</h3>
                    <p className="text-sm text-gray-400">Choose your lock period and manage your stakes easily</p>
                  </div>
                </div>

                <p>
                  StakePoint supports both standard staking pools and advanced features like reflection rewards, 
                  allowing you to earn additional tokens passively while your assets are staked.
                </p>
              </div>
            </section>

            {/* Getting Started */}
            <section id="getting-started" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-[#fb57ff]/20 to-transparent border border-[#fb57ff]/30 rounded-xl">
                  <Rocket className="w-6 h-6 text-[#fb57ff]" />
                </div>
                <h2 className="text-3xl font-bold">Getting Started</h2>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-gradient-to-br from-[#fb57ff]/5 to-transparent border border-[#fb57ff]/20 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-[#fb57ff]/20 rounded-lg">
                      <Info className="w-5 h-5 text-[#fb57ff]" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-2">Prerequisites</h3>
                      <ul className="space-y-2 text-gray-300">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span>A Solana wallet (Phantom, Solflare, or any compatible wallet)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span>SOL tokens for transaction fees (usually ~0.001-0.01 SOL)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span>SPL tokens you want to stake</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 bg-[#fb57ff] text-black rounded-full text-sm font-bold">1</span>
                    Connect Your Wallet
                  </h3>
                  <p className="text-gray-300 ml-9">
                    Click the "Connect Wallet" button in the top-right corner. Select your preferred Solana wallet 
                    from the list and approve the connection request. Your wallet address will be displayed once connected.
                  </p>

                  <h3 className="text-xl font-semibold text-white flex items-center gap-2 mt-6">
                    <span className="flex items-center justify-center w-7 h-7 bg-[#fb57ff] text-black rounded-full text-sm font-bold">2</span>
                    Browse Available Pools
                  </h3>
                  <p className="text-gray-300 ml-9">
                    Navigate to the "Pools" page to see all available staking pools. Each pool displays:
                  </p>
                  <ul className="ml-9 space-y-2 text-gray-300">
                    <li className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-[#fb57ff]" />
                      Token name and symbol
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-[#fb57ff]" />
                      Current APY (Annual Percentage Yield)
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-[#fb57ff]" />
                      Lock period (Flex or Fixed duration)
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-[#fb57ff]" />
                      Total amount staked
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-[#fb57ff]" />
                      Expected reward pool
                    </li>
                  </ul>

                  <h3 className="text-xl font-semibold text-white flex items-center gap-2 mt-6">
                    <span className="flex items-center justify-center w-7 h-7 bg-[#fb57ff] text-black rounded-full text-sm font-bold">3</span>
                    Start Staking
                  </h3>
                  <p className="text-gray-300 ml-9">
                    Once you've found a pool you like, click the "Stake" button and enter the amount you want to stake. 
                    Confirm the transaction in your wallet and you're done! Your rewards will start accumulating immediately.
                  </p>
                </div>
              </div>
            </section>

            {/* How to Stake */}
            <section id="how-to-stake" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-[#fb57ff]/20 to-transparent border border-[#fb57ff]/30 rounded-xl">
                  <Coins className="w-6 h-6 text-[#fb57ff]" />
                </div>
                <h2 className="text-3xl font-bold">How to Stake</h2>
              </div>

              <div className="space-y-6">
                <p className="text-gray-300 leading-relaxed">
                  Staking on StakePoint is simple and secure. Follow this step-by-step guide to start earning rewards.
                </p>

                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden">
                  <div className="p-6 space-y-6">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-[#fb57ff] to-[#fb57ff]/70 rounded-full text-black font-bold">
                          1
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                          <Wallet className="w-5 h-5 text-[#fb57ff]" />
                          Select a Pool
                        </h4>
                        <p className="text-gray-300">
                          Browse the available pools and select one that matches your investment strategy. 
                          Consider the APY, lock period, and total staked amount.
                        </p>
                      </div>
                    </div>

                    <div className="h-px bg-white/[0.05]" />

                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-[#fb57ff] to-[#fb57ff]/70 rounded-full text-black font-bold">
                          2
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                          <Coins className="w-5 h-5 text-[#fb57ff]" />
                          Enter Amount
                        </h4>
                        <p className="text-gray-300">
                          Click "Stake" and enter the amount of tokens you want to stake. The interface will show 
                          your available balance and calculate your estimated rewards based on the current APY.
                        </p>
                      </div>
                    </div>

                    <div className="h-px bg-white/[0.05]" />

                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-[#fb57ff] to-[#fb57ff]/70 rounded-full text-black font-bold">
                          3
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-[#fb57ff]" />
                          Confirm Transaction
                        </h4>
                        <p className="text-gray-300">
                          Review the transaction details and confirm in your wallet. You'll pay a small SOL fee 
                          for the transaction (typically 0.001-0.01 SOL). Once confirmed, your stake is active!
                        </p>
                      </div>
                    </div>

                    <div className="h-px bg-white/[0.05]" />

                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-[#fb57ff] to-[#fb57ff]/70 rounded-full text-black font-bold">
                          4
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-[#fb57ff]" />
                          Earn Rewards
                        </h4>
                        <p className="text-gray-300">
                          Your rewards start accumulating immediately! View your pending rewards in the pool card. 
                          You can claim rewards at any time, or wait until your lock period ends to unstake.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-gradient-to-br from-yellow-500/5 to-transparent border border-yellow-500/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-white font-semibold mb-2">Important Notes</h4>
                      <ul className="space-y-2 text-gray-300 text-sm">
                        <li>• Ensure you have enough SOL in your wallet for transaction fees</li>
                        <li>• Locked pools cannot be unstaked until the lock period expires</li>
                        <li>• Rewards can be claimed at any time without unstaking</li>
                        <li>• Check the pool details carefully before staking</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Creating Pools */}
            <section id="creating-pools" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-[#fb57ff]/20 to-transparent border border-[#fb57ff]/30 rounded-xl">
                  <Plus className="w-6 h-6 text-[#fb57ff]" />
                </div>
                <h2 className="text-3xl font-bold">Creating Staking Pools</h2>
              </div>

              <div className="space-y-6">
                <p className="text-gray-300 leading-relaxed">
                  StakePoint allows anyone to create staking pools for their tokens. This is perfect for project owners 
                  who want to incentivize long-term holders and build community engagement.
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-[#fb57ff]" />
                      Requirements
                    </h4>
                    <ul className="space-y-2 text-gray-300 text-sm">
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-4 h-4 text-[#fb57ff] flex-shrink-0 mt-0.5" />
                        <span>Connected Solana wallet</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-4 h-4 text-[#fb57ff] flex-shrink-0 mt-0.5" />
                        <span>1 SOL creation fee (covers blockchain costs)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-4 h-4 text-[#fb57ff] flex-shrink-0 mt-0.5" />
                        <span>Tokens for the reward pool</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-4 h-4 text-[#fb57ff] flex-shrink-0 mt-0.5" />
                        <span>SPL Token or Token-2022</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Gift className="w-5 h-5 text-[#fb57ff]" />
                      Benefits
                    </h4>
                    <ul className="space-y-2 text-gray-300 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span>Shareable pool URL for your community</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span>Automatic APY calculation</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span>Built-in reflection support</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span>Professional staking interface</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-white">Pool Creation Steps</h3>
                  
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-6 h-6 bg-[#fb57ff] text-black rounded-full text-xs font-bold flex-shrink-0 mt-0.5">
                          1
                        </div>
                        <div>
                          <h4 className="text-white font-semibold mb-1">Select Token</h4>
                          <p className="text-gray-300 text-sm">
                            The platform automatically detects all SPL and Token-2022 tokens in your wallet. 
                            Token metadata (name, symbol, logo) is fetched from Birdeye API.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-6 h-6 bg-[#fb57ff] text-black rounded-full text-xs font-bold flex-shrink-0 mt-0.5">
                          2
                        </div>
                        <div>
                          <h4 className="text-white font-semibold mb-1">Configure Pool</h4>
                          <p className="text-gray-300 text-sm mb-2">Set your pool parameters:</p>
                          <ul className="space-y-1 text-gray-300 text-sm ml-4">
                            <li>• Lock duration (30, 60, 90, 180, or 365 days)</li>
                            <li>• Reward amount (tokens you'll deposit)</li>
                            <li>• Reflection settings (optional)</li>
                          </ul>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-6 h-6 bg-[#fb57ff] text-black rounded-full text-xs font-bold flex-shrink-0 mt-0.5">
                          3
                        </div>
                        <div>
                          <h4 className="text-white font-semibold mb-1">Configure Reflections (Optional)</h4>
                          <p className="text-gray-300 text-sm">
                            Enable reflections to distribute additional tokens to stakers. Choose between 
                            self-reflection (same token) or external token distribution.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-6 h-6 bg-[#fb57ff] text-black rounded-full text-xs font-bold flex-shrink-0 mt-0.5">
                          4
                        </div>
                        <div>
                          <h4 className="text-white font-semibold mb-1">Review & Confirm</h4>
                          <p className="text-gray-300 text-sm">
                            Review all details and sign the transactions. The process involves 4 transactions: 
                            payment, project creation, pool initialization, and reward deposit.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-6 h-6 bg-[#fb57ff] text-black rounded-full text-xs font-bold flex-shrink-0 mt-0.5">
                          5
                        </div>
                        <div>
                          <h4 className="text-white font-semibold mb-1">Share Your Pool</h4>
                          <p className="text-gray-300 text-sm">
                            After creation, you'll receive a shareable URL (e.g., stakepoint.io/pool/your-pool-id) 
                            that you can share with your community. The pool appears on the main pools page automatically.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-gradient-to-br from-[#fb57ff]/5 to-transparent border border-[#fb57ff]/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-[#fb57ff] flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-white font-semibold mb-2">Pool Finalization</h4>
                      <p className="text-gray-300 text-sm">
                        After creation, the pool is finalized and admin ownership is transferred to the platform. 
                        This ensures security and prevents manipulation. You retain the ability to claim staking rewards 
                        as users stake in your pool.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Reflections */}
            <section id="reflections" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-[#fb57ff]/20 to-transparent border border-[#fb57ff]/30 rounded-xl">
                  <Gift className="w-6 h-6 text-[#fb57ff]" />
                </div>
                <h2 className="text-3xl font-bold">Reflection Rewards</h2>
              </div>

              <div className="space-y-6">
                <p className="text-gray-300 leading-relaxed">
                  Reflections are an advanced feature that allows stakers to earn additional rewards beyond the base APY. 
                  The reflection vault is owned by the staking vault and distributes rewards proportionally to all stakers.
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-[#fb57ff]/10 to-transparent border border-[#fb57ff]/30 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-[#fb57ff]/20 rounded-lg">
                        <RefreshCw className="w-5 h-5 text-[#fb57ff]" />
                      </div>
                      <h3 className="text-white font-semibold">Self Reflection</h3>
                    </div>
                    <p className="text-gray-300 text-sm mb-4">
                      Stakers earn more of the same token they're staking.
                    </p>
                    <div className="bg-black/30 rounded-lg p-4 border border-white/[0.05]">
                      <p className="text-xs text-gray-400 mb-1">Example:</p>
                      <p className="text-sm text-white">
                        Stake <span className="text-[#fb57ff] font-semibold">SOL</span> → 
                        Earn <span className="text-[#fb57ff] font-semibold">SOL</span> reflections
                      </p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/30 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Coins className="w-5 h-5 text-blue-400" />
                      </div>
                      <h3 className="text-white font-semibold">External Token</h3>
                    </div>
                    <p className="text-gray-300 text-sm mb-4">
                      Stakers earn a different token as reflection rewards.
                    </p>
                    <div className="bg-black/30 rounded-lg p-4 border border-white/[0.05]">
                      <p className="text-xs text-gray-400 mb-1">Example:</p>
                      <p className="text-sm text-white">
                        Stake <span className="text-[#fb57ff] font-semibold">SOL</span> → 
                        Earn <span className="text-blue-400 font-semibold">USDC</span> reflections
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-white">How Reflections Work</h3>
                  
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-[#fb57ff]/20 rounded-lg flex-shrink-0">
                        <span className="text-[#fb57ff] font-bold">1</span>
                      </div>
                      <div>
                        <h4 className="text-white font-semibold mb-1">Initialization</h4>
                        <p className="text-gray-300 text-sm">
                          When a pool creator enables reflections, a dedicated reflection vault is initialized. 
                          This vault is owned by the staking vault for security.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-[#fb57ff]/20 rounded-lg flex-shrink-0">
                        <span className="text-[#fb57ff] font-bold">2</span>
                      </div>
                      <div>
                        <h4 className="text-white font-semibold mb-1">Mint Address Specification</h4>
                        <p className="text-gray-300 text-sm">
                          For external reflections, the pool creator must specify the mint address of the reflection token. 
                          This prevents spam tokens from being counted towards APY calculations.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-[#fb57ff]/20 rounded-lg flex-shrink-0">
                        <span className="text-[#fb57ff] font-bold">3</span>
                      </div>
                      <div>
                        <h4 className="text-white font-semibold mb-1">Distribution</h4>
                        <p className="text-gray-300 text-sm">
                          Reflection rewards are distributed proportionally based on each user's stake size and duration. 
                          The more you stake and the longer you stake, the more reflections you earn.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-[#fb57ff]/20 rounded-lg flex-shrink-0">
                        <span className="text-[#fb57ff] font-bold">4</span>
                      </div>
                      <div>
                        <h4 className="text-white font-semibold mb-1">Claiming</h4>
                        <p className="text-gray-300 text-sm">
                          Reflection rewards can be claimed separately from regular staking rewards. 
                          Use the "Claim Reflections" button to collect your accumulated reflection tokens.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-white font-semibold mb-2">Why Use Reflections?</h4>
                      <p className="text-gray-300 text-sm mb-3">
                        Reflections provide an additional incentive layer for stakers and help project owners:
                      </p>
                      <ul className="space-y-1 text-gray-300 text-sm">
                        <li>• Reward loyal long-term holders</li>
                        <li>• Distribute ecosystem tokens to community members</li>
                        <li>• Create additional value without inflating reward pools</li>
                        <li>• Build stronger community engagement</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* APY & APR */}
            <section id="apy-apr" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-[#fb57ff]/20 to-transparent border border-[#fb57ff]/30 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-[#fb57ff]" />
                </div>
                <h2 className="text-3xl font-bold">APY & APR Explained</h2>
              </div>

              <div className="space-y-6">
                <p className="text-gray-300 leading-relaxed">
                  Understanding how your rewards are calculated is essential. StakePoint uses dynamic APR 
                  (Annual Percentage Rate) that adjusts based on actual staking activity.
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-[#fb57ff]" />
                      APY (Annual Percentage Yield)
                    </h3>
                    <p className="text-gray-300 text-sm mb-4">
                      The estimated yearly return including compound interest. This is displayed on pool cards 
                      and updates dynamically based on the reward pool and total staked amount.
                    </p>
                    <div className="bg-black/30 rounded-lg p-4 border border-white/[0.05]">
                      <p className="text-xs text-gray-400 mb-2">Formula:</p>
                      <code className="text-xs text-[#fb57ff] break-all">
                        APY = (Reward Rate / Total Staked) × 365 days × 100
                      </code>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-400" />
                      APR (Annual Percentage Rate)
                    </h3>
                    <p className="text-gray-300 text-sm mb-4">
                      The simple yearly return without compounding. StakePoint uses dynamic APR calculations 
                      for user-created pools to ensure accurate reward distributions.
                    </p>
                    <div className="bg-black/30 rounded-lg p-4 border border-white/[0.05]">
                      <p className="text-xs text-gray-400 mb-2">Formula:</p>
                      <code className="text-xs text-blue-400 break-all">
                        APR = (Rewards Per Second × Seconds Per Year) / Total Staked
                      </code>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-white">How Rewards Are Calculated</h3>
                  
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-white font-semibold mb-2">Real-Time Calculations</h4>
                        <p className="text-gray-300 text-sm">
                          Your pending rewards are calculated in real-time based on:
                        </p>
                        <ul className="mt-2 space-y-2 text-gray-300 text-sm ml-4">
                          <li className="flex items-start gap-2">
                            <span className="text-[#fb57ff]">•</span>
                            <span><strong className="text-white">Staked Amount:</strong> How many tokens you've staked</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#fb57ff]">•</span>
                            <span><strong className="text-white">Time Duration:</strong> How long your tokens have been staked</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#fb57ff]">•</span>
                            <span><strong className="text-white">Reward Rate:</strong> The pool's reward distribution rate per second</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#fb57ff]">•</span>
                            <span><strong className="text-white">Your Share:</strong> Your proportion of the total staked amount</span>
                          </li>
                        </ul>
                      </div>

                      <div className="h-px bg-white/[0.05]" />

                      <div>
                        <h4 className="text-white font-semibold mb-2">Dynamic APY</h4>
                        <p className="text-gray-300 text-sm">
                          The displayed APY updates automatically as more users stake or unstake. When total staked 
                          amount increases, the APY may decrease (rewards are split among more users). When users 
                          unstake, APY may increase for remaining stakers.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-gradient-to-br from-[#fb57ff]/5 to-transparent border border-[#fb57ff]/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-[#fb57ff] flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-white font-semibold mb-2">Important to Know</h4>
                      <p className="text-gray-300 text-sm">
                        APY is an estimate based on current conditions. Actual returns may vary based on:
                      </p>
                      <ul className="mt-2 space-y-1 text-gray-300 text-sm ml-4">
                        <li>• Changes in total staked amount</li>
                        <li>• Reward pool depletion (if rewards run out)</li>
                        <li>• Early unstaking (for locked pools with penalties)</li>
                        <li>• Network conditions and transaction fees</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Lock Periods */}
            <section id="lock-periods" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-[#fb57ff]/20 to-transparent border border-[#fb57ff]/30 rounded-xl">
                  <Lock className="w-6 h-6 text-[#fb57ff]" />
                </div>
                <h2 className="text-3xl font-bold">Lock Periods</h2>
              </div>

              <div className="space-y-6">
                <p className="text-gray-300 leading-relaxed">
                  Lock periods determine how long your tokens must remain staked. All user-created pools on 
                  StakePoint use locked staking for the full duration to ensure stability and fair reward distribution.
                </p>

                <div className="grid gap-4">
                  <div className="bg-gradient-to-br from-[#fb57ff]/10 to-transparent border border-[#fb57ff]/30 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-[#fb57ff]/20 rounded-xl">
                        <Lock className="w-6 h-6 text-[#fb57ff]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold mb-2">Locked Pools</h3>
                        <p className="text-gray-300 text-sm mb-4">
                          Tokens are locked for the entire pool duration. You cannot unstake until the lock period expires. 
                          This ensures stable TVL and predictable APY for all participants.
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                          <div className="bg-black/30 rounded-lg p-3 border border-white/[0.05] text-center">
                            <Clock className="w-4 h-4 text-[#fb57ff] mx-auto mb-1" />
                            <p className="text-white font-semibold text-sm">30 Days</p>
                          </div>
                          <div className="bg-black/30 rounded-lg p-3 border border-white/[0.05] text-center">
                            <Clock className="w-4 h-4 text-[#fb57ff] mx-auto mb-1" />
                            <p className="text-white font-semibold text-sm">60 Days</p>
                          </div>
                          <div className="bg-black/30 rounded-lg p-3 border border-white/[0.05] text-center">
                            <Clock className="w-4 h-4 text-[#fb57ff] mx-auto mb-1" />
                            <p className="text-white font-semibold text-sm">90 Days</p>
                          </div>
                          <div className="bg-black/30 rounded-lg p-3 border border-white/[0.05] text-center">
                            <Clock className="w-4 h-4 text-[#fb57ff] mx-auto mb-1" />
                            <p className="text-white font-semibold text-sm">180 Days</p>
                          </div>
                          <div className="bg-black/30 rounded-lg p-3 border border-white/[0.05] text-center">
                            <Clock className="w-4 h-4 text-[#fb57ff] mx-auto mb-1" />
                            <p className="text-white font-semibold text-sm">365 Days</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-white">What You Can Do During Lock Period</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <h4 className="text-white font-semibold">Allowed Actions</h4>
                      </div>
                      <ul className="space-y-2 text-gray-300 text-sm">
                        <li className="flex items-start gap-2">
                          <span className="text-green-400">✓</span>
                          <span>View your pending rewards in real-time</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-400">✓</span>
                          <span>Claim accumulated rewards without unstaking</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-400">✓</span>
                          <span>Claim reflection rewards (if enabled)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-400">✓</span>
                          <span>Add more tokens to your existing stake</span>
                        </li>
                      </ul>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <h4 className="text-white font-semibold">Restricted Actions</h4>
                      </div>
                      <ul className="space-y-2 text-gray-300 text-sm">
                        <li className="flex items-start gap-2">
                          <span className="text-red-400">✗</span>
                          <span>Unstake tokens before lock period ends</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-red-400">✗</span>
                          <span>Withdraw principal amount early</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-red-400">✗</span>
                          <span>Transfer staked position to another wallet</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-red-400">✗</span>
                          <span>Modify lock period after staking</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-white font-semibold mb-2">After Lock Period Expires</h4>
                      <p className="text-gray-300 text-sm">
                        Once your lock period expires, you can freely unstake your tokens plus all accumulated rewards. 
                        The unstake button will automatically become enabled when the lock period ends. You'll receive 
                        both your principal amount and all unclaimed rewards in a single transaction.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Fees */}
            <section id="fees" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-[#fb57ff]/20 to-transparent border border-[#fb57ff]/30 rounded-xl">
                  <DollarSign className="w-6 h-6 text-[#fb57ff]" />
                </div>
                <h2 className="text-3xl font-bold">Fees & Costs</h2>
              </div>

              <div className="space-y-6">
                <p className="text-gray-300 leading-relaxed">
                  StakePoint operates with transparent fees. All costs are clearly displayed before you confirm transactions.
                </p>

                <div className="grid gap-4">
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-green-500/20 rounded-xl">
                        <Coins className="w-6 h-6 text-green-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold mb-2">Staking Fees</h3>
                        <p className="text-gray-300 text-sm mb-3">
                          When you stake tokens, you pay standard Solana transaction fees plus a small platform fee:
                        </p>
                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="bg-black/30 rounded-lg p-4 border border-white/[0.05]">
                            <p className="text-xs text-gray-400 mb-1">Network Fee</p>
                            <p className="text-white font-semibold">~0.001-0.01 SOL</p>
                            <p className="text-xs text-gray-400 mt-1">Paid to Solana validators</p>
                          </div>
                          <div className="bg-black/30 rounded-lg p-4 border border-white/[0.05]">
                            <p className="text-xs text-gray-400 mb-1">Platform Fee</p>
                            <p className="text-white font-semibold">Variable</p>
                            <p className="text-xs text-gray-400 mt-1">Collected from staking transactions.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-[#fb57ff]/20 rounded-xl">
                        <Plus className="w-6 h-6 text-[#fb57ff]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold mb-2">Pool Creation Fee</h3>
                        <p className="text-gray-300 text-sm mb-3">
                          Creating a staking pool requires a one-time fee to cover blockchain account initialization:
                        </p>
                        <div className="bg-black/30 rounded-lg p-4 border border-white/[0.05] inline-block">
                          <p className="text-xs text-gray-400 mb-1">Creation Fee</p>
                          <p className="text-white font-semibold text-lg">1 SOL</p>
                          <p className="text-xs text-gray-400 mt-1">One-time payment for on-chain accounts</p>
                        </div>
                        <p className="text-gray-300 text-sm mt-3">
                          This fee covers the cost of creating multiple on-chain accounts required for your pool: 
                          project account, staking vault, reward vault, and optionally a reflection vault.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-blue-500/20 rounded-xl">
                        <TrendingUp className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold mb-2">Claiming Rewards</h3>
                        <p className="text-gray-300 text-sm mb-3">
                          Claiming your earned rewards incurs only standard Solana transaction fees:
                        </p>
                        <div className="bg-black/30 rounded-lg p-4 border border-white/[0.05] inline-block">
                          <p className="text-xs text-gray-400 mb-1">Claim Fee</p>
                          <p className="text-white font-semibold">~0.001 SOL</p>
                          <p className="text-xs text-gray-400 mt-1">Network transaction fee only</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-yellow-500/20 rounded-xl">
                        <ArrowRight className="w-6 h-6 text-yellow-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold mb-2">Unstaking</h3>
                        <p className="text-gray-300 text-sm mb-3">
                          Unstaking after the lock period is complete:
                        </p>
                        <div className="bg-black/30 rounded-lg p-4 border border-white/[0.05] inline-block">
                          <p className="text-xs text-gray-400 mb-1">Unstake Fee</p>
                          <p className="text-white font-semibold">~0.001 SOL</p>
                          <p className="text-xs text-gray-400 mt-1">Network transaction fee only</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-white font-semibold mb-2">No Hidden Fees</h4>
                      <p className="text-gray-300 text-sm">
                        All fees are displayed upfront before you confirm any transaction. There are no withdrawal fees, 
                        hidden charges, or surprise costs. The only fees you pay are standard Solana network fees and 
                        the transparent platform fees mentioned above.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Pool Management */}
            <section id="pool-management" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-[#fb57ff]/20 to-transparent border border-[#fb57ff]/30 rounded-xl">
                  <Users className="w-6 h-6 text-[#fb57ff]" />
                </div>
                <h2 className="text-3xl font-bold">Pool Management</h2>
              </div>

              <div className="space-y-6">
                <p className="text-gray-300 leading-relaxed">
                  If you've created a staking pool, you can monitor its performance and manage certain aspects through the platform.
                </p>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-white">After Pool Creation</h3>
                  
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-[#fb57ff]/20 rounded-lg flex-shrink-0">
                        <CheckCircle className="w-5 h-5 text-[#fb57ff]" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold mb-1">Automatic Listing</h4>
                        <p className="text-gray-300 text-sm">
                          Your pool is automatically listed on the main pools page and becomes immediately available 
                          for users to stake. No additional approval required.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-[#fb57ff]/20 rounded-lg flex-shrink-0">
                        <ExternalLink className="w-5 h-5 text-[#fb57ff]" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold mb-1">Shareable URL</h4>
                        <p className="text-gray-300 text-sm">
                          Each pool gets a unique URL (e.g., stakepoint.io/pool/your-pool-id) that you can share 
                          with your community. This page shows detailed pool stats and allows direct staking.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-[#fb57ff]/20 rounded-lg flex-shrink-0">
                        <Shield className="w-5 h-5 text-[#fb57ff]" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold mb-1">Admin Transfer</h4>
                        <p className="text-gray-300 text-sm">
                          Pool admin ownership is automatically transferred to the platform after creation. This 
                          ensures security and prevents manipulation. You still earn staking rewards as users participate.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-[#fb57ff]/20 rounded-lg flex-shrink-0">
                        <TrendingUp className="w-5 h-5 text-[#fb57ff]" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold mb-1">Dynamic APY Updates</h4>
                        <p className="text-gray-300 text-sm">
                          The pool's APY is calculated dynamically based on actual staking activity. As more users 
                          stake, the total staked amount increases and APY adjusts automatically.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-white">Monitoring Your Pool</h3>
                  
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                      <Users className="w-6 h-6 text-[#fb57ff] mb-3" />
                      <h4 className="text-white font-semibold mb-2">Total Stakers</h4>
                      <p className="text-gray-300 text-sm">
                        View how many unique wallets have staked in your pool
                      </p>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                      <Coins className="w-6 h-6 text-[#fb57ff] mb-3" />
                      <h4 className="text-white font-semibold mb-2">Total Value Locked</h4>
                      <p className="text-gray-300 text-sm">
                        Monitor the total amount of tokens staked in your pool
                      </p>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                      <TrendingUp className="w-6 h-6 text-[#fb57ff] mb-3" />
                      <h4 className="text-white font-semibold mb-2">Current APY</h4>
                      <p className="text-gray-300 text-sm">
                        Track the current yield rate based on staking activity
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-gradient-to-br from-[#fb57ff]/5 to-transparent border border-[#fb57ff]/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-[#fb57ff] flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-white font-semibold mb-2">Reward Pool Management</h4>
                      <p className="text-gray-300 text-sm">
                        The reward pool is locked at creation. Ensure you deposit sufficient rewards to last the entire 
                        pool duration. If rewards run out early, stakers may not receive the full advertised APY. 
                        Calculate carefully based on expected staking volume.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Security */}
            <section id="security" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-[#fb57ff]/20 to-transparent border border-[#fb57ff]/30 rounded-xl">
                  <Shield className="w-6 h-6 text-[#fb57ff]" />
                </div>
                <h2 className="text-3xl font-bold">Security</h2>
              </div>

              <div className="space-y-6">
                <p className="text-gray-300 leading-relaxed">
                  StakePoint is built with security as the top priority. We use industry best practices and 
                  battle-tested frameworks to protect your assets.
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/30 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <Shield className="w-5 h-5 text-green-400" />
                      </div>
                      <h3 className="text-white font-semibold">Smart Contract Security</h3>
                    </div>
                    <ul className="space-y-2 text-gray-300 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span>Built with Anchor framework for Solana</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span>Comprehensive input validation and error handling</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span>Protection against common exploits (reentrancy, overflow, etc.)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span>Open source code for community review</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/30 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Lock className="w-5 h-5 text-blue-400" />
                      </div>
                      <h3 className="text-white font-semibold">Asset Protection</h3>
                    </div>
                    <ul className="space-y-2 text-gray-300 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <span>Non-custodial - you always control your wallet</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <span>Separate vaults for staking and rewards</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <span>PDA-based account security</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <span>Automatic admin transfer for pool security</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-white">Best Practices for Users</h3>
                  
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h4 className="text-white font-semibold flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                          Do's
                        </h4>
                        <ul className="space-y-2 text-gray-300 text-sm">
                          <li className="flex items-start gap-2">
                            <span className="text-green-400">✓</span>
                            <span>Always verify transaction details before signing</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-400">✓</span>
                            <span>Use official StakePoint URL only</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-400">✓</span>
                            <span>Keep your wallet seed phrase secure and private</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-400">✓</span>
                            <span>Start with small amounts to test the platform</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-400">✓</span>
                            <span>Review pool details carefully before staking</span>
                          </li>
                        </ul>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-white font-semibold flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-red-400" />
                          Don'ts
                        </h4>
                        <ul className="space-y-2 text-gray-300 text-sm">
                          <li className="flex items-start gap-2">
                            <span className="text-red-400">✗</span>
                            <span>Never share your private key or seed phrase</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-red-400">✗</span>
                            <span>Don't interact with suspicious airdrop tokens</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-red-400">✗</span>
                            <span>Don't click on links from untrusted sources</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-red-400">✗</span>
                            <span>Don't stake more than you can afford to lock</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-red-400">✗</span>
                            <span>Don't ignore lock period warnings</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-gradient-to-br from-yellow-500/5 to-transparent border border-yellow-500/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-white font-semibold mb-2">Risk Disclosure</h4>
                      <p className="text-gray-300 text-sm">
                        While we implement extensive security measures, DeFi protocols carry inherent risks. 
                        Smart contract bugs, network issues, or market volatility can affect your returns. 
                        Never invest more than you can afford to lose. Always do your own research (DYOR) 
                        before participating in any staking pool.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-[#fb57ff]/20 to-transparent border border-[#fb57ff]/30 rounded-xl">
                  <AlertCircle className="w-6 h-6 text-[#fb57ff]" />
                </div>
                <h2 className="text-3xl font-bold">Frequently Asked Questions</h2>
              </div>

              <div className="space-y-4">
                {[
                  {
                    q: "What happens if I try to unstake before the lock period ends?",
                    a: "User-created pools on StakePoint use locked staking for the full duration. The unstake button will be disabled until your lock period expires. You can still claim rewards at any time without affecting your stake."
                  },
                  {
                    q: "How often are rewards calculated?",
                    a: "Rewards are calculated in real-time, every second. Your pending rewards update continuously based on your stake size, duration, and the pool's reward rate. You can claim rewards at any time."
                  },
                  {
                    q: "Can I add more tokens to an existing stake?",
                    a: "Yes! You can increase your stake at any time by staking additional tokens to the same pool. The new stake will have its own lock period starting from the time of the new stake."
                  },
                  {
                    q: "What happens if the reward pool runs out?",
                    a: "If a pool's reward vault is depleted, stakers will stop earning new rewards. However, any rewards already earned can still be claimed. The pool APY is calculated based on available rewards, so it will show 0% if rewards are exhausted."
                  },
                  {
                    q: "How do I know which pools are safe to stake in?",
                    a: "Check the pool details carefully: look for pools with sufficient reward deposits, reasonable APY (extremely high APY can be suspicious), and active staking participation. Official platform pools are clearly marked. For user-created pools, verify the token contract address."
                  },
                  {
                    q: "Can I cancel a pool I created?",
                    a: "Once a pool is created and finalized, it cannot be cancelled or paused. The reward tokens you deposited are locked for the pool duration. This ensures fairness for users who stake in your pool."
                  },
                  {
                    q: "What are Program Derived Addresses (PDAs)?",
                    a: "PDAs are special Solana accounts derived from program IDs and seeds. StakePoint uses PDAs to securely manage pool accounts, vaults, and user stakes. They provide deterministic account generation and enhanced security."
                  },
                  {
                    q: "Why do I need SOL in my wallet if I'm staking SPL tokens?",
                    a: "SOL is used to pay for transaction fees on the Solana network. Each transaction (stake, unstake, claim) requires a small amount of SOL, typically 0.001-0.01 SOL. Make sure you always have a small SOL balance for fees."
                  },
                  {
                    q: "Can I stake from multiple wallets?",
                    a: "Yes, each wallet can independently stake in any pool. Stakes are tracked per wallet address, so staking from different wallets creates separate stakes with their own lock periods and rewards."
                  },
                  {
                    q: "What's the difference between claiming rewards and unstaking?",
                    a: "Claiming rewards transfers only your earned rewards to your wallet while keeping your principal staked and earning. Unstaking (available after lock period) withdraws both your principal and any unclaimed rewards, ending your stake."
                  },
                  {
                    q: "How are reflection rewards different from staking rewards?",
                    a: "Staking rewards come from the pool's reward vault and are based on the pool's APY. Reflection rewards are an additional bonus that come from a separate reflection vault and are distributed proportionally to all stakers. You claim them separately."
                  },
                  {
                    q: "Can I view my transaction history?",
                    a: "All transactions are recorded on the Solana blockchain. You can view your transaction history using your wallet's transaction explorer or by searching your wallet address on Solscan or Solana Explorer."
                  }
                ].map((faq, index) => (
                  <details key={index} className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden group">
                    <summary className="p-6 cursor-pointer list-none flex items-start justify-between gap-4 hover:bg-white/[0.02] transition-all">
                      <span className="text-white font-semibold">{faq.q}</span>
                      <ArrowRight className="w-5 h-5 text-[#fb57ff] flex-shrink-0 transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="px-6 pb-6 text-gray-300 text-sm leading-relaxed">
                      {faq.a}
                    </div>
                  </details>
                ))}
              </div>

              <div className="mt-8 p-6 bg-gradient-to-br from-[#fb57ff]/10 to-transparent border border-[#fb57ff]/30 rounded-xl">
                <div className="text-center space-y-3">
                  <h3 className="text-white font-semibold text-lg">Still have questions?</h3>
                  <p className="text-gray-300 text-sm max-w-2xl mx-auto">
                    Join our community on Telegram or reach out on Twitter. Our team and community members 
                    are happy to help answer your questions about StakePoint.
                  </p>
                  <div className="flex items-center justify-center gap-4 pt-2">
                    <a
                      href="https://t.me/StakePointPortal"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#fb57ff] to-[#fb57ff]/80 rounded-lg hover:from-[#fb57ff]/90 hover:to-[#fb57ff]/70 transition-all font-semibold text-sm text-black"
                    >
                      <Send className="w-4 h-4" />
                      Join Telegram
                    </a>
                    <a
                      href="https://x.com/StakePointApp"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/[0.05] border border-white/[0.05] rounded-lg hover:bg-white/[0.08] transition-all font-semibold text-sm"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      Follow on X
                    </a>
                  </div>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}

