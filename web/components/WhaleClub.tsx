"use client";
import React from 'react';
import { Lock } from 'lucide-react';

const WhaleClub: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        
        {/* Padlock Icon */}
        <div 
          className="w-24 h-24 mx-auto rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, rgba(251, 87, 255, 0.2), rgba(251, 87, 255, 0.05))' }}
        >
          <Lock className="w-12 h-12" style={{ color: '#fb57ff' }} />
        </div>

        {/* Badge */}
        <div 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm"
          style={{ background: 'rgba(251, 87, 255, 0.15)', color: '#fb57ff' }}
        >
          <span>🐋</span>
          <span className="font-semibold tracking-wide">EXCLUSIVE ACCESS</span>
        </div>

        {/* Title */}
        <h1 
          className="text-4xl font-bold"
          style={{ 
            background: 'linear-gradient(45deg, white, #fb57ff)', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent', 
            backgroundClip: 'text' 
          }}
        >
          Whale Club
        </h1>

        {/* Coming Soon */}
        <p className="text-xl text-gray-400">Coming Soon</p>

        {/* Description */}
        <p className="text-gray-500 text-sm">
          Hold 10M+ SPT to unlock exclusive rewards, private chat, and Twitter engagement bonuses.
        </p>

        {/* Divider */}
        <div className="w-16 h-1 mx-auto rounded-full" style={{ background: 'linear-gradient(90deg, transparent, #fb57ff, transparent)' }} />

        {/* Features Preview */}
        <div className="grid grid-cols-3 gap-4 pt-4">
          <div className="text-center">
            <div className="text-2xl mb-1">💬</div>
            <p className="text-xs text-gray-500">Private Chat</p>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-1">🏆</div>
            <p className="text-xs text-gray-500">Leaderboard</p>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-1">🎁</div>
            <p className="text-xs text-gray-500">SOL Rewards</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default WhaleClub;