"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";

// Import Sidebar dynamically to prevent SSR issues
const Sidebar = dynamic(() => import("@/components/Sidebar"), { ssr: false });

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Check if we're on an embed route - if so, render without navbar/sidebar
  const isEmbedRoute = pathname?.startsWith('/embed');

  const handleMenuToggle = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  // If it's an embed route, just render children without layout chrome
  if (isEmbedRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navbar - Fixed, doesn't scroll */}
      <Navbar onMenuClick={handleMenuToggle} />
      
      {/* Main container below navbar */}
      <div className="flex flex-1 pt-16">
        {/* Sidebar - Overlay drawer on mobile, fixed on desktop */}
        <Sidebar 
          isMobileMenuOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        
        {/* Main content - Full width on mobile, margin on desktop */}
        <main className="flex-1 w-full lg:ml-64 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

