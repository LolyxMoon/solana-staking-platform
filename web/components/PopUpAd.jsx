'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export default function PopUpAd() {
  const [popUpData, setPopUpData] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchActivePopUp();
    }
  }, [mounted]);

  async function fetchActivePopUp() {
    try {
      const response = await fetch('/api/popup-ads/active');
      const result = await response.json();

      if (result.success && result.data) {
        const ad = result.data;
        
        if (shouldDisplayAd(ad)) {
          setPopUpData(ad);
          setTimeout(() => setIsVisible(true), 1000);
        }
      }
    } catch (error) {
      console.error('Error fetching pop-up ad:', error);
    }
  }

  function shouldDisplayAd(ad) {
    const storageKey = 'popup_ad_' + ad.id;
    const lastShown = localStorage.getItem(storageKey);

    if (ad.display_frequency === 'every_visit') {
      return true;
    }
    
    if (ad.display_frequency === 'once_per_session') {
      if (sessionStorage.getItem(storageKey)) {
        return false;
      }
      sessionStorage.setItem(storageKey, Date.now().toString());
      return true;
    }
    
    if (ad.display_frequency === 'once_per_day') {
      if (lastShown) {
        const lastShownDate = new Date(parseInt(lastShown));
        const now = new Date();
        const hoursSinceLastShown = (now.getTime() - lastShownDate.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastShown < 24) {
          return false;
        }
      }
      localStorage.setItem(storageKey, Date.now().toString());
      return true;
    }
    
    return true;
  }

  function closePopUp() {
    setIsVisible(false);
    setTimeout(() => setPopUpData(null), 300);
  }

  if (!mounted || !popUpData || !isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={closePopUp}>
      <div
        className="relative bg-white/[0.02] border border-white/[0.05] rounded-lg shadow-2xl w-full max-w-lg mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closePopUp}
          className="absolute top-3 right-3 md:top-4 md:right-4 text-gray-400 hover:text-white transition-colors z-10 bg-black/50 rounded-full p-1.5"
        >
          <X className="w-5 h-5" />
        </button>

        {popUpData.image_url && (
          <div className="rounded-t-lg overflow-hidden border-b border-white/[0.05]">
            <img
              src={popUpData.image_url}
              alt={popUpData.title}
              className="w-full h-auto"
              style={{
                aspectRatio: '16/9',
                objectFit: 'cover',
                maxHeight: '360px'
              }}
            />
          </div>
        )}

        <div className="p-6 md:p-8">
          <h2 
            className="text-xl md:text-2xl font-bold mb-3"
            style={{ 
              background: 'linear-gradient(45deg, white, #fb57ff)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent', 
              backgroundClip: 'text' 
            }}
          >
            {popUpData.title}
          </h2>

          {popUpData.description && (
            <p className="text-gray-400 mb-6 leading-relaxed text-sm md:text-base">
              {popUpData.description}
            </p>
          )}

          {popUpData.cta_text && popUpData.cta_link && (
            <a
              href={popUpData.cta_link}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-white font-semibold py-3 px-6 rounded-lg text-center transition-transform hover:scale-[1.02]"
              style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
            >
              {popUpData.cta_text}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}