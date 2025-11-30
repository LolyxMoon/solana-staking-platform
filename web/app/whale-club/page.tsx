"use client";

import { Crown, Sparkles, TrendingUp, Award } from "lucide-react";

export default function WhaleClubPage() {
  return (
    <div className="min-h-screen p-3 sm:p-4 lg:p-6 pt-16 lg:pt-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <h1 
            className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2"
            style={{
              background: 'linear-gradient(45deg, white, #fb57ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            Whale Club
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Exclusive rewards for our biggest supporters
          </p>
        </div>

        {/* Coming Soon Card */}
        <div 
          className="bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all duration-200 rounded-lg p-8 sm:p-12 lg:p-16 text-center group relative"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
          }}
        >
          {/* Featured Badge */}
          <div className="absolute -top-2 left-2 sm:-top-2 sm:left-3">
            <div 
              className="px-2 py-1 rounded text-xs font-semibold border backdrop-blur-sm flex items-center gap-1"
              style={{ 
                background: 'rgba(251, 87, 255, 0.2)', 
                borderColor: 'rgba(251, 87, 255, 0.5)', 
                color: '#fb57ff' 
              }}
            >
              ⭐ <span>Coming Soon</span>
            </div>
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div 
              className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(45deg, black, #fb57ff)',
                boxShadow: '0 0 30px rgba(251, 87, 255, 0.3)'
              }}
            >
              <Crown className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
          </div>

          {/* Title */}
          <h2 
            className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4"
            style={{
              background: 'linear-gradient(45deg, white, #fb57ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            Whale Club
          </h2>

          {/* Description */}
          <p className="text-gray-300 text-base sm:text-lg lg:text-xl mb-8 max-w-2xl mx-auto leading-relaxed">
            Hold a minimum of <span className="font-bold text-white">10 million StakePoint tokens</span> to earn absolute exclusive rewards!
          </p>

          {/* Requirements Box */}
          <div 
            className="inline-block rounded-lg px-6 py-4 sm:px-8 sm:py-5 mb-12"
            style={{
              background: 'rgba(251, 87, 255, 0.1)',
              border: '1px solid rgba(251, 87, 255, 0.3)'
            }}
          >
            <div className="text-gray-400 text-sm sm:text-base mb-2">
              Minimum Requirement
            </div>
            <div 
              className="text-2xl sm:text-3xl font-bold"
              style={{
                background: 'linear-gradient(45deg, white, #fb57ff)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              10,000,000 SPT
            </div>
          </div>

          {/* Features Preview - 3 BOXES */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-4xl mx-auto">
            {[
              { 
                icon: TrendingUp,
                title: "Exclusive Rewards", 
                desc: "Special rewards and bonuses" 
              },
              { 
                icon: Sparkles,
                title: "Priority Access", 
                desc: "First access to new pools and features" 
              },
              { 
                icon: Award,
                title: "VIP Benefits", 
                desc: "Enhanced perks" 
              }
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all duration-200 rounded-lg p-4 sm:p-5 group/card"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                >
                  <div className="flex justify-center mb-3">
                    <div 
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center"
                      style={{
                        background: 'rgba(251, 87, 255, 0.1)',
                        border: '1px solid rgba(251, 87, 255, 0.3)'
                      }}
                    >
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#fb57ff' }} />
                    </div>
                  </div>
                  <div className="text-white font-semibold mb-2 text-sm sm:text-base">
                    {feature.title}
                  </div>
                  <div className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                    {feature.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Additional Info Section */}
        <div className="mt-6 bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(251, 87, 255, 0.1)',
                  border: '1px solid rgba(251, 87, 255, 0.3)'
                }}
              >
                <Sparkles className="w-4 h-4" style={{ color: '#fb57ff' }} />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-sm sm:text-base mb-2">
                What to Expect
              </h3>
              <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                The Whale Club is being developed to reward our most dedicated community members. 
                Hold 10 million SPT tokens to automatically qualify for exclusive benefits when this feature launches. 
                Stay tuned for announcements!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}