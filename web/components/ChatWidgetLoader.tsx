'use client';

/**
 * StakePoint Helpdesk - SEO-Optimized Chat Widget Loader
 * 
 * Loads the chat widget AFTER page load + idle time
 * Zero impact on Core Web Vitals (LCP, INP, CLS)
 */

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the chat widget (code splitting)
const ChatWidget = dynamic(() => import('./ChatWidget'), {
  ssr: false, // Don't render on server
  loading: () => null // No loading state
});

interface ChatWidgetLoaderProps {
  /** Delay in ms after page load before loading widget (default: 0) */
  loadDelay?: number;
  /** Whether to wait for requestIdleCallback (default: true) */
  waitForIdle?: boolean;
  /** All props passed to ChatWidget */
  position?: 'bottom-right' | 'bottom-left';
  primaryColor?: string;
  logoUrl?: string;
  welcomeMessage?: string;
  placeholderText?: string;
}

export default function ChatWidgetLoader({
  loadDelay = 0,
  waitForIdle = true,
  ...widgetProps
}: ChatWidgetLoaderProps) {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    // Function to trigger load
    const triggerLoad = () => {
      setTimeout(() => {
        setShouldLoad(true);
      }, loadDelay);
    };

    // Wait for page load event
    if (document.readyState === 'complete') {
      // Page already loaded
      if (waitForIdle && 'requestIdleCallback' in window) {
        // Wait for browser idle
        requestIdleCallback(triggerLoad, { timeout: 5000 });
      } else {
        triggerLoad();
      }
    } else {
      // Wait for load event
      const handleLoad = () => {
        if (waitForIdle && 'requestIdleCallback' in window) {
          requestIdleCallback(triggerLoad, { timeout: 5000 });
        } else {
          triggerLoad();
        }
      };

      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, [loadDelay, waitForIdle]);

  // Don't render anything until ready
  if (!shouldLoad) return null;

  return <ChatWidget {...widgetProps} />;
}

/**
 * Alternative: Script-based loader for non-Next.js sites
 * 
 * Add this to your HTML:
 * <script src="https://stakepoint.app/helpdesk/widget.js" defer></script>
 * <script>
 *   window.StakePointHelpdesk = {
 *     primaryColor: '#6366f1',
 *     position: 'bottom-right'
 *   };
 * </script>
 */
export function createEmbedScript() {
  return `
(function() {
  'use strict';
  
  // Wait for load + idle
  function loadWidget() {
    var config = window.StakePointHelpdesk || {};
    
    // Create container
    var container = document.createElement('div');
    container.id = 'stakepoint-helpdesk-widget';
    document.body.appendChild(container);
    
    // Load React + Widget bundle
    var script = document.createElement('script');
    script.src = 'https://stakepoint.app/helpdesk/widget.bundle.js';
    script.async = true;
    script.onload = function() {
      window.StakePointHelpdeskInit(container, config);
    };
    document.head.appendChild(script);
  }
  
  // SEO-safe loading
  if (document.readyState === 'complete') {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadWidget, { timeout: 5000 });
    } else {
      setTimeout(loadWidget, 100);
    }
  } else {
    window.addEventListener('load', function() {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(loadWidget, { timeout: 5000 });
      } else {
        setTimeout(loadWidget, 100);
      }
    });
  }
})();
`;
}
