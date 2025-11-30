// components/MobileBanner.tsx
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function MobileBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    
    // Check if already in Phantom browser
    const isPhantomBrowser = typeof window !== "undefined" && window.solana?.isPhantom;
    
    // Check if user dismissed banner before
    const dismissed = sessionStorage.getItem('banner-dismissed');

    // Show banner only if: mobile + not in Phantom + not dismissed
    setShow(isMobile && !isPhantomBrowser && !dismissed);
  }, []);

  const openInPhantom = () => {
    const currentUrl = window.location.href;
    const phantomDeepLink = `https://phantom.app/ul/browse/${encodeURIComponent(currentUrl)}`;
    window.location.href = phantomDeepLink;
  };

  const dismissBanner = () => {
    sessionStorage.setItem('banner-dismissed', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-3 z-[100] shadow-lg">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            📱 Connect Your Wallet
          </p>
          <p className="text-xs opacity-90">
            Open in Phantom to connect
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={openInPhantom}
          className="px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold text-sm hover:bg-gray-100 transition-colors whitespace-nowrap flex-shrink-0"
        >
          Open Phantom
        </button>

        {/* Close button */}
        <button
          onClick={dismissBanner}
          className="p-1 hover:bg-white/20 rounded transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}