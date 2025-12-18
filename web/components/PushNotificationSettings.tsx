/**
 * StakePoint Helpdesk - Push Notification Settings Component
 * Add this to your admin settings/dashboard
 */

'use client';

import React from 'react';
import { Bell, BellOff, Loader2, AlertCircle, CheckCircle2, Smartphone } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PushNotificationSettingsProps {
  adminId: string;
}

export default function PushNotificationSettings({ adminId }: PushNotificationSettingsProps) {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    error
  } = usePushNotifications(adminId);

  if (!isSupported) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500" />
          <div>
            <p className="text-yellow-500 font-medium">Push Notifications Not Supported</p>
            <p className="text-yellow-500/70 text-sm">
              Your browser doesn't support push notifications. Try Chrome or Edge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isSubscribed ? 'bg-green-500/20' : 'bg-gray-700'
          }`}>
            {isSubscribed ? (
              <Bell className="w-6 h-6 text-green-400" />
            ) : (
              <BellOff className="w-6 h-6 text-gray-400" />
            )}
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">Push Notifications</h3>
            <p className="text-gray-400 text-sm">
              {isSubscribed 
                ? 'You will receive notifications on this device'
                : 'Get notified when visitors send messages'}
            </p>
          </div>
        </div>

        <button
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={isLoading}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            isSubscribed
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isSubscribed ? (
            <>
              <BellOff className="w-4 h-4" />
              Disable
            </>
          ) : (
            <>
              <Bell className="w-4 h-4" />
              Enable
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {isSubscribed && (
        <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <p className="text-green-400 text-sm">
              Notifications enabled! You'll receive alerts even when your browser is closed.
            </p>
          </div>
        </div>
      )}

      {permission === 'denied' && (
        <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          <p className="text-yellow-500 text-sm">
            Notifications are blocked. Please enable them in your browser settings:
            <br />
            Click the lock icon in the address bar → Site settings → Notifications → Allow
          </p>
        </div>
      )}

      {/* Mobile Install Tip */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-indigo-400 mt-0.5" />
          <div>
            <p className="text-white text-sm font-medium">Get notifications on your phone</p>
            <p className="text-gray-400 text-xs mt-1">
              Open this page on your phone → tap "Add to Home Screen" → Enable notifications
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
