import { useCallback, useRef, useEffect } from 'react';

type SoundType = 'success' | 'error' | 'processing' | 'swap';

export function useSound() {
  const audioRef = useRef<{ [key: string]: HTMLAudioElement }>({});
  const isInitialized = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialized.current) {
      // Initialize all sounds
      audioRef.current['success'] = new Audio('/sounds/success.mp3');
      audioRef.current['error'] = new Audio('/sounds/error.mp3');
      audioRef.current['processing'] = new Audio('/sounds/processing.mp3');
      audioRef.current['swap'] = new Audio('/sounds/swap.mp3');
      
      // Set default volume (50%)
      Object.values(audioRef.current).forEach(audio => {
        audio.volume = 0.5;
      });
      
      isInitialized.current = true;
    }

    // Cleanup
    return () => {
      Object.values(audioRef.current).forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
    };
  }, []);

  const playSound = useCallback((type: SoundType) => {
    if (audioRef.current[type]) {
      // ✅ STOP ALL OTHER SOUNDS FIRST
      Object.values(audioRef.current).forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
      
      // ✅ THEN PLAY THE NEW SOUND
      audioRef.current[type].currentTime = 0;
      audioRef.current[type].play().catch(err => {
        console.log('Sound play failed (autoplay blocked?):', err);
      });
    }
  }, []);

  const stopSound = useCallback((type: SoundType) => {
    if (audioRef.current[type]) {
      audioRef.current[type].pause();
      audioRef.current[type].currentTime = 0;
    }
  }, []);

  const stopAllSounds = useCallback(() => {
    Object.values(audioRef.current).forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }, []);

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    Object.values(audioRef.current).forEach(audio => {
      audio.volume = clampedVolume;
    });
  }, []);

  return { playSound, stopSound, stopAllSounds, setVolume };
}