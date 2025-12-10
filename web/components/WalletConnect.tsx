'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect } from 'react';
import { Copy, LogOut, Wallet } from 'lucide-react';

export default function WalletConnect() {
  const { publicKey, disconnect, connected } = useWallet();
  const [showMenu, setShowMenu] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Wait for client-side hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div 
        className="px-3 py-2 lg:px-4 lg:py-2 rounded-lg text-white text-sm font-medium"
        style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
      >
        <Wallet className="w-5 h-5 lg:w-3.5 lg:h-3.5" />
      </div>
    );
  }

  // If not connected, show the connect button with gradient style
  if (!connected || !publicKey) {
    return (
      <WalletMultiButton 
        className="!rounded-lg !font-medium !transition-all !w-auto !whitespace-nowrap !min-w-0"
        style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
      />
    );
  }

  // If connected, show wallet info with dropdown
  const address = publicKey.toBase58();
  const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-2 lg:px-4 lg:py-2 rounded-lg text-white transition-all text-sm font-medium whitespace-nowrap active:scale-95"
        style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
      >
        <Wallet className="w-5 h-5 lg:w-3.5 lg:h-3.5 flex-shrink-0" />
        <span className="hidden lg:inline text-sm font-mono">{shortAddress}</span>
        <svg 
          className={`hidden lg:block w-3 h-3 transition-transform flex-shrink-0 ${showMenu ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          {/* Backdrop to close menu */}
          <div 
            className="fixed inset-0 z-[60]" 
            onClick={() => setShowMenu(false)}
          />
          
          {/* Menu */}
          <div className="absolute top-full right-0 mt-2 w-64 bg-[#1A1F2E] border border-white/[0.08] rounded-md shadow-2xl z-[70] overflow-hidden">
            <div className="p-3 border-b border-white/[0.05]">
              <div className="text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Wallet Address</div>
              <div className="text-xs font-mono text-gray-300 break-all">{address}</div>
            </div>
            
            <button
              onClick={() => {
                navigator.clipboard.writeText(address);
                setShowMenu(false);
              }}
              className="w-full px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2.5"
            >
              <Copy className="w-4 h-4 text-gray-500" />
              <span>Copy Address</span>
            </button>
            
            <button
              onClick={() => {
                disconnect();
                setShowMenu(false);
              }}
              className="w-full px-3 py-2.5 text-left text-sm text-accent-red hover:bg-white/5 transition-colors flex items-center gap-2.5 border-t border-white/[0.05]"
            >
              <LogOut className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}