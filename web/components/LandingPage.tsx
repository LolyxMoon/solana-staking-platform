"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import PopUpAd from '@/components/PopUpAd';
import {
  Sparkles,
  Shield,
  TrendingUp,
  Zap,
  ArrowRight,
  Check,
  Coins,
  Lock,
  Rocket,
  BarChart3,
  Users,
  Award,
  ChevronRight,
  ChevronLeft,
  Send,
  Twitter,
  ExternalLink,
  Mail,
} from "lucide-react";

interface Pool {
  id: string;
  name: string;
  symbol: string;
  logo?: string;
  apy?: number;
  apr?: number;
  type: string;
  totalStaked: number;
  featured: boolean;
  hidden?: boolean;
}

export default function LandingPage() {
  const router = useRouter();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ✅ ADD: Carousel state
  const [currentBenefit, setCurrentBenefit] = useState(0);
  const benefitsRef = useRef<HTMLDivElement>(null);
  
  const [tokenData, setTokenData] = useState({
    totalSupply: "TBA",
    circulatingSupply: "TBA",
    marketCap: "TBA",
    holders: "TBA",
    loading: true,
  });
  const [platformStats, setPlatformStats] = useState({
    totalValueLocked: "TBA",
    activeStakers: "TBA",
    poolsAvailable: "TBA",
    averageReturn: "TBA",
    loading: true,
  });

  const socialLinks = {
    telegram: "https://t.me/StakePointPortal",
    twitter: "https://x.com/StakePointApp",
  };

  const SOLSTREAM_TOKEN_ADDRESS = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

  const benefits = [
    "No minimum staking amount!",
    "Withdraw anytime! (unlocked pools)",
    "Claim rewards anytime!",
    "Reflection tokens compatible!",
    "Competetive platform fees!",
    "Lifetime referral program!",
  ];

  // ✅ ADD: Auto-scroll effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBenefit((prev) => (prev + 2) % benefits.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [benefits.length]);

  // ✅ ADD: Scroll synchronization
  useEffect(() => {
    if (benefitsRef.current) {
      const container = benefitsRef.current;
      const cardWidth = container.scrollWidth / Math.ceil(benefits.length / 2);
      container.scrollTo({
        left: (currentBenefit / 2) * cardWidth,
        behavior: 'smooth'
      });
    }
  }, [currentBenefit, benefits.length]);

  // ✅ ADD: Navigation functions
  const nextBenefit = () => {
    setCurrentBenefit((prev) => (prev + 2) % benefits.length);
  };

  const prevBenefit = () => {
    setCurrentBenefit((prev) => (prev - 2 + benefits.length) % benefits.length);
  };

  const goToBenefit = (index: number) => {
    setCurrentBenefit(index * 2);
  };

  useEffect(() => {
    fetchFeaturedPools();
    fetchPlatformStats();
    if (SOLSTREAM_TOKEN_ADDRESS) {
      fetchTokenData();
      const interval = setInterval(fetchTokenData, 60000);
      return () => clearInterval(interval);
    }
  }, []);

  const fetchPlatformStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch stats");
      }

      const formatNumber = (num: number) => {
        if (num >= 1_000_000) {
          return `${(num / 1_000_000).toFixed(2)}M`;
        } else if (num >= 1_000) {
          return `${(num / 1_000).toFixed(2)}K`;
        }
        return num.toFixed(2);
      };

      const formatWholeNumber = (num: number) => {
        if (num >= 1_000_000) {
          return `${Math.floor(num / 1_000_000)}M`;
        } else if (num >= 1_000) {
          return `${Math.floor(num / 1_000)}K`;
        }
        return Math.floor(num).toString();
      };

      const poolsRes = await fetch("/api/pools");
      const poolsData = await poolsRes.json();
      const visiblePools = poolsData.filter((p: any) => !p.hidden);

      const poolsWithAPY = visiblePools.filter((p: any) => p.apy && p.apy > 0);
      const poolsWithAPR = visiblePools.filter((p: any) => p.apr && p.apr > 0);
      
      let averageReturn = 0;
      let returnType = "APY";
      
      if (poolsWithAPY.length > 0) {
        averageReturn = poolsWithAPY.reduce((sum: number, p: any) => sum + p.apy, 0) / poolsWithAPY.length;
        returnType = "APY";
      } else if (poolsWithAPR.length > 0) {
        averageReturn = poolsWithAPR.reduce((sum: number, p: any) => sum + p.apr, 0) / poolsWithAPR.length;
        returnType = "APR";
      }

      setPlatformStats({
        totalValueLocked: data.totalValueLocked > 0 
          ? `${formatNumber(data.totalValueLocked)}` 
          : "TBA",
        activeStakers: data.totalStakers > 0 
          ? formatWholeNumber(data.totalStakers) 
          : "TBA",
        poolsAvailable: visiblePools.length > 0 
          ? visiblePools.length.toString() 
          : "TBA",
        averageReturn: averageReturn > 0 
          ? `${Math.round(averageReturn)}% ${returnType}` 
          : "TBA",
        loading: false,
      });
    } catch (error) {
      console.error("Failed to fetch platform stats:", error);
      setPlatformStats({
        totalValueLocked: "TBA",
        activeStakers: "TBA",
        poolsAvailable: "TBA",
        averageReturn: "TBA",
        loading: false,
      });
    }
  };

  const fetchTokenData = async () => {
    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${SOLSTREAM_TOKEN_ADDRESS}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch token data");
      }

      const data = await response.json();

      if (data.pairs && data.pairs.length > 0) {
        const sortedPairs = data.pairs.sort((a: any, b: any) => {
          const liquidityA = a.liquidity?.usd || 0;
          const liquidityB = b.liquidity?.usd || 0;
          return liquidityB - liquidityA;
        });
        
        const mainPair = sortedPairs[0];

        const formatNumber = (num: number | string) => {
          const value = typeof num === 'string' ? parseFloat(num) : num;
          if (isNaN(value)) return "TBA";
          
          if (value >= 1_000_000_000) {
            return `${(value / 1_000_000_000).toFixed(2)}B`;
          } else if (value >= 1_000_000) {
            return `${(value / 1_000_000).toFixed(2)}M`;
          } else if (value >= 1_000) {
            return `${(value / 1_000).toFixed(2)}K`;
          }
          return value.toFixed(2);
        };

        console.log("DexScreener main pair data:", mainPair);

        setTokenData({
          totalSupply: mainPair.fdv
            ? `$${formatNumber(mainPair.fdv)}`
            : "TBA",
          circulatingSupply: mainPair.liquidity?.usd
            ? `$${formatNumber(mainPair.liquidity.usd)}`
            : "TBA",
          marketCap: mainPair.marketCap
            ? `$${formatNumber(mainPair.marketCap)}`
            : "TBA",
          holders: mainPair.txns?.h24?.buys && mainPair.txns?.h24?.sells
            ? formatNumber(mainPair.txns.h24.buys + mainPair.txns.h24.sells)
            : "TBA",
          loading: false,
        });
      } else {
        setTokenData({
          totalSupply: "TBA",
          circulatingSupply: "TBA",
          marketCap: "TBA",
          holders: "TBA",
          loading: false,
        });
      }
    } catch (error) {
      console.error("Failed to fetch token data from DexScreener:", error);
      setTokenData({
        totalSupply: "TBA",
        circulatingSupply: "TBA",
        marketCap: "TBA",
        holders: "TBA",
        loading: false,
      });
    }
  };

  useEffect(() => {
    fetchFeaturedPools();
  }, []);

  const fetchFeaturedPools = async () => {
    try {
      const res = await fetch("/api/pools");
      const data = await res.json();
      const featured = data
        .filter((p: Pool) => p.featured && !p.hidden)
        .slice(0, 3);
      setPools(featured);
    } catch (error) {
      console.error("Failed to fetch pools:", error);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Shield,
      title: "Prioritising Security",
      description:
        "Built on Solana with battle-tested smart contracts. Your assets are protected by industry-leading security.",
      gradient: "from-blue-600 to-cyan-600",
    },
    {
      icon: TrendingUp,
      title: "High APY Returns",
      description:
        "Earn competitive returns on your tokens. Lock for higher yields or stay flexible with unlocked pools.",
      gradient: "from-purple-600 to-pink-600",
    },
    {
      icon: Zap,
      title: "Instant Rewards",
      description:
        "Claim your rewards anytime. Watch your earnings grow in real-time with our transparent reward system.",
      gradient: "from-orange-600 to-red-600",
    },
    {
      icon: Coins,
      title: "Reflection Rewards",
      description:
        "Earn additional tokens through reflection tokens like USDC, SOL or your favourite SPL.",
      gradient: "from-green-600 to-emerald-600",
    },
  ];

  const stats = [
    { label: "Total Value Locked", value: platformStats.totalValueLocked, icon: Lock },
    { label: "Active Stakers", value: platformStats.activeStakers, icon: Users },
    { label: "Pools Available", value: platformStats.poolsAvailable, icon: BarChart3 },
    { label: "Average APY", value: platformStats.averageReturn, icon: Award },
  ];

  return (
    <>
      <PopUpAd /> {/* ✅ ADD ONLY THIS LINE */}
      <div className="min-h-screen bg-[#060609] relative">
        {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#060609]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full blur-3xl" style={{ background: 'rgba(251, 87, 255, 0.05)' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 text-center lg:text-left">
              <h1 className="text-5xl lg:text-7xl font-bold leading-tight text-white">
                Stake. Earn. Claim.
              </h1>

              <p className="text-xl text-gray-400 max-w-2xl">
                The most advanced staking platform on Solana. Earn passive income
                with industry-leading APYs and flexible lock periods.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button
                  onClick={() => router.push("/pools")}
                  className="group flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg transition-all font-semibold text-sm"
                  style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                >
                  <Rocket className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  Start Staking
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={() => router.push("/pools")}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white/[0.05] border border-white/[0.05] rounded-lg hover:bg-white/[0.08] transition-all font-semibold text-sm"
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                >
                  <BarChart3 className="w-4 h-4" />
                  Browse Pools
                </button>
              </div>

              <div className="flex flex-wrap gap-8 justify-center lg:justify-start pt-4">
                {stats.slice(0, 2).map((stat, idx) => (
                  <div key={idx} className="text-center lg:text-left">
                    <div className="flex items-center gap-2 text-3xl font-bold text-white mb-1">
                      <stat.icon className="w-6 h-6" style={{ color: '#fb57ff' }} />
                      {stat.value}
                    </div>
                    <p className="text-sm text-gray-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:block">
              <div className="relative overflow-hidden backdrop-blur-xl bg-white/[0.02] border border-white/[0.08] rounded-xl p-6 space-y-4">
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(251, 87, 255, 0.1)' }}></div>
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">
                        Trending Pools
                      </h3>
                      <p className="text-xs text-gray-500">
                        {pools.length} pools available
                      </p>
                    </div>
                  </div>

                  {loading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-20 bg-white/[0.03] rounded-lg animate-pulse"
                        />
                      ))}
                    </div>
                  ) : pools.length > 0 ? (
                    <div className="space-y-2">
                      {pools.map((pool) => (
                        <div
                          key={pool.id}
                          className="relative group p-3.5 bg-white/[0.03] hover:bg-white/[0.06] rounded-lg transition-all cursor-pointer border border-white/[0.05]"
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                        >
                          <div className="flex items-center gap-3">
                            {pool.logo ? (
                              <img
                                src={pool.logo}
                                alt={pool.symbol}
                                className="w-10 h-10 rounded-full ring-2 ring-white/[0.05]"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ring-2 ring-white/[0.05]" style={{ background: 'linear-gradient(135deg, rgba(251, 87, 255, 0.2), rgba(251, 87, 255, 0.1))', color: '#fb57ff' }}>
                                {pool.symbol.slice(0, 2)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white text-sm truncate">
                                {pool.name}
                              </p>
                              <p className="text-xs text-gray-500">{pool.symbol}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-accent-green">
                                {pool.apy
                                  ? `${pool.apy}%`
                                  : pool.apr
                                  ? `${pool.apr}%`
                                  : "—"}
                              </p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                                {pool.apy ? "APY" : pool.apr ? "APR" : "Variable"}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-1" style={{ ['--hover-color' as any]: '#fb57ff' }} onMouseEnter={(e) => e.currentTarget.style.color = '#fb57ff'} onMouseLeave={(e) => e.currentTarget.style.color = ''} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">No featured pools yet</p>
                    </div>
                  )}

                  <button
                    onClick={() => router.push("/pools")}
                    className="w-full mt-4 px-4 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-lg transition-all font-medium text-xs text-gray-400"
                    style={{ ['--hover-border' as any]: 'rgba(251, 87, 255, 0.3)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'; e.currentTarget.style.color = '#fb57ff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = ''; }}
                  >
                    View All Pools →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-y border-white/[0.05] bg-[#060609]">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <stat.icon className="w-6 h-6" style={{ color: '#fb57ff' }} />
                  {platformStats.loading ? (
                    <div className="h-9 bg-white/[0.05] rounded animate-pulse w-20"></div>
                  ) : (
                    <p className="text-3xl font-bold text-white">{stat.value}</p>
                  )}
                </div>
                <p className="text-sm text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-16 lg:py-20 bg-[#060609]">
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-2" style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Why Choose Our Platform
            </h2>
            <p className="text-sm text-gray-500 max-w-2xl mx-auto">
              Built for the future of DeFi
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="group p-5 bg-white/[0.02] border border-white/[0.05] rounded-lg transition-all hover:bg-white/[0.04]"
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="inline-flex items-center justify-center w-10 h-10 rounded-lg transition-transform"
                    style={{ background: 'rgba(251, 87, 255, 0.1)' }}
                  >
                    <feature.icon className="w-5 h-5" style={{ color: '#fb57ff' }} />
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    {feature.title}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ✅ FIXED: Benefits Section */}
      <section className="relative py-16 lg:py-20 bg-[#060609]">
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl lg:text-4xl font-bold mb-2" style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Everything You Need
            </h2>
            <p className="text-sm text-gray-500">
              Join thousands earning passive income on Solana
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* ✅ FIXED: Left Benefits Slider with Navigation */}
            <div className="relative">
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-5 h-full flex flex-col">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-white mb-1">Platform Benefits</h3>
                  <p className="text-xs text-gray-500">Everything you need to succeed</p>
                </div>
                
                <div className="flex-1 relative">
                  {/* Navigation Arrows */}
                  <button
                    onClick={prevBenefit}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.05] flex items-center justify-center transition-all"
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                    aria-label="Previous benefits"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                  </button>

                  <button
                    onClick={nextBenefit}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.05] flex items-center justify-center transition-all"
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                    aria-label="Next benefits"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>

                  {/* Scrollable Container */}
                  <div 
                    ref={benefitsRef}
                    className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 px-8"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {benefits.map((benefit, idx) => (
                      <div
                        key={idx}
                        className="flex-shrink-0 w-[calc(50%-6px)] snap-start"
                      >
                        <div 
                          className="h-full flex flex-col items-center justify-center text-center p-4 bg-white/[0.02] rounded-lg border border-white/[0.05] hover:bg-white/[0.04] transition-all"
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.2)'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                        >
                          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(251, 87, 255, 0.2)' }}>
                            <Check className="w-5 h-5" style={{ color: '#fb57ff' }} />
                          </div>
                          <span className="text-sm text-gray-300 leading-snug">{benefit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* ✅ FIXED: Clickable dots */}
                <div className="flex justify-center gap-1.5 mt-4">
                  {[0, 1, 2].map((dot) => (
                    <button
                      key={dot}
                      onClick={() => goToBenefit(dot)}
                      className="rounded-full transition-all hover:scale-125"
                      style={{ 
                        background: Math.floor(currentBenefit / 2) === dot ? '#fb57ff' : 'rgba(251, 87, 255, 0.2)',
                        width: Math.floor(currentBenefit / 2) === dot ? '12px' : '6px',
                        height: '6px',
                      }}
                      aria-label={`Go to benefit page ${dot + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Right: CTA Card */}
            <div>
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-5 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-5 pb-5 border-b border-white/[0.05]">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251, 87, 255, 0.2)' }}>
                    <Rocket className="w-5 h-5" style={{ color: '#fb57ff' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Get Started</h3>
                    <p className="text-xs text-gray-500">In 3 simple steps</p>
                  </div>
                </div>

                <div className="space-y-3 mb-5 flex-1">
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: 'rgba(251, 87, 255, 0.1)', color: '#fb57ff' }}>
                      1
                    </div>
                    <p className="text-xs text-gray-400 pt-1">Connect your Solana wallet</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: 'rgba(251, 87, 255, 0.1)', color: '#fb57ff' }}>
                      2
                    </div>
                    <p className="text-xs text-gray-400 pt-1">Choose a staking pool</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: 'rgba(251, 87, 255, 0.1)', color: '#fb57ff' }}>
                      3
                    </div>
                    <p className="text-xs text-gray-400 pt-1">Stake & earn rewards</p>
                  </div>
                </div>

                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full px-5 py-2.5 rounded-lg transition-all font-semibold text-sm"
                  style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                >
                  Launch App →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* List Your Project Section */}
      <section className="relative py-16 lg:py-20 bg-[#060609] border-y border-white/[0.05]">
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-8 lg:p-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4" style={{ background: 'rgba(251, 87, 255, 0.2)' }}>
                <Rocket className="w-6 h-6" style={{ color: '#fb57ff' }} />
              </div>
              
              <h2 className="text-3xl lg:text-4xl font-bold mb-3" style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                List Your Project
              </h2>
              
              <p className="text-sm text-gray-500 max-w-2xl mx-auto">
                Join the growing ecosystem offering staking rewards. Increase engagement, build loyalty, and grow your holder base.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div 
                className="text-center p-4 bg-white/[0.02] rounded-lg border border-white/[0.05] hover:bg-white/[0.04] transition-all"
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(251, 87, 255, 0.1)' }}>
                  <Users className="w-5 h-5" style={{ color: '#fb57ff' }} />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5">
                  Grow Your Community
                </h3>
                <p className="text-xs text-gray-500">
                  Attract and retain holders
                </p>
              </div>

              <div 
                className="text-center p-4 bg-white/[0.02] rounded-lg border border-white/[0.05] hover:bg-white/[0.04] transition-all"
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(251, 87, 255, 0.1)' }}>
                  <TrendingUp className="w-5 h-5" style={{ color: '#fb57ff' }} />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5">
                  Increase Token Utility
                </h3>
                <p className="text-xs text-gray-500">
                  Add real value and use cases
                </p>
              </div>

              <div 
                className="text-center p-4 bg-white/[0.02] rounded-lg border border-white/[0.05] hover:bg-white/[0.04] transition-all"
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(251, 87, 255, 0.1)' }}>
                  <Shield className="w-5 h-5" style={{ color: '#fb57ff' }} />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5">
                  Battle-Tested Security
                </h3>
                <p className="text-xs text-gray-500">
                  Audited smart contracts
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <a
                href="mailto:contact@example.com"
                className="group inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg transition-all font-semibold text-sm"
                style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
              >
                <Mail className="w-4 h-4" />
                Get in Touch
                <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </a>

              {socialLinks.telegram && (
                <a
                  href={socialLinks.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white/[0.05] border border-white/[0.05] rounded-lg hover:bg-white/[0.08] transition-all font-semibold text-sm"
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                >
                  <Send className="w-4 h-4" />
                  Contact on Telegram
                </a>
              )}
            </div>

            <div className="text-center">
              <p className="text-xs text-gray-600">
                We review all applications and respond within 48 hours
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-16 bg-[#060609]">
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-3" style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Start Earning Today
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Join the future of decentralized finance on Solana
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all font-semibold text-sm"
            style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
          >
            <Sparkles className="w-4 h-4" />
            Get Started Now
            <ArrowRight className="w-4 h-4" />
          </button>
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
                href={socialLinks.telegram || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 bg-white/[0.02] border border-white/[0.05] rounded-full hover:bg-white/[0.05] transition-all group"
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                aria-label="Telegram"
              >
                <Send className="w-5 h-5 text-gray-400 transition-colors" style={{ ['--hover-color' as any]: '#fb57ff' }} onMouseEnter={(e) => e.currentTarget.style.color = '#fb57ff'} onMouseLeave={(e) => e.currentTarget.style.color = ''} />
              </a>
              <a
                href={socialLinks.twitter || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 bg-white/[0.02] border border-white/[0.05] rounded-full hover:bg-white/[0.05] transition-all group"
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5 text-gray-400 transition-colors" style={{ ['--hover-color' as any]: '#fb57ff' }} onMouseEnter={(e) => e.currentTarget.style.color = '#fb57ff'} onMouseLeave={(e) => e.currentTarget.style.color = ''} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </>
  );
}