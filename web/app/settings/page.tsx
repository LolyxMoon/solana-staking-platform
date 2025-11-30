// app/settings/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/components/ToastContainer";
import { 
  User, 
  Bell, 
  Palette, 
  Globe, 
  Wallet, 
  Shield, 
  Save,
  Download,
  Trash2,
  ChevronRight,
  Moon,
  Sun
} from "lucide-react";

type SettingsSection = "profile" | "notifications" | "theme" | "currency" | "wallet" | "privacy";

export default function SettingsPage() {
  const { connected, publicKey, disconnect } = useWallet();
  const { showSuccess, showError, showInfo } = useToast();

  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Profile Settings
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState("en");

  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [notifyOnStake, setNotifyOnStake] = useState(true);
  const [notifyOnUnstake, setNotifyOnUnstake] = useState(true);
  const [notifyOnRewards, setNotifyOnRewards] = useState(true);

  // Theme Settings - LOCAL STATE (not using useTheme hook)
  const [themeMode, setThemeMode] = useState<"light" | "dark">("dark");
  const [accentColor, setAccentColor] = useState("#8b5cf6");
  const [autoTheme, setAutoTheme] = useState(false);

  // Currency Settings
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("UTC");
  const [numberFormat, setNumberFormat] = useState("en-US");

  // Privacy Settings
  const [activityPublic, setActivityPublic] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  // Load settings from localStorage
  useEffect(() => {
    setMounted(true);
    const savedSettings = localStorage.getItem("userSettings");
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setDisplayName(settings.displayName || "");
      setEmail(settings.email || "");
      setLanguage(settings.language || "en");
      setEmailNotifications(settings.emailNotifications ?? true);
      setPushNotifications(settings.pushNotifications ?? false);
      setNotifyOnStake(settings.notifyOnStake ?? true);
      setNotifyOnUnstake(settings.notifyOnUnstake ?? true);
      setNotifyOnRewards(settings.notifyOnRewards ?? true);
      setAccentColor(settings.accentColor || "#8b5cf6");
      setAutoTheme(settings.autoTheme ?? false);
      setThemeMode(settings.themeMode || "dark");
      setCurrency(settings.currency || "USD");
      setTimezone(settings.timezone || "UTC");
      setNumberFormat(settings.numberFormat || "en-US");
      setActivityPublic(settings.activityPublic ?? false);
      setShowBalance(settings.showBalance ?? true);
    }
  }, []);

  // Apply theme changes to document
  useEffect(() => {
    if (mounted) {
      document.documentElement.classList.toggle("light", themeMode === "light");
      localStorage.setItem("theme", themeMode);
    }
  }, [themeMode, mounted]);

  const saveSettings = () => {
    setIsSaving(true);
    
    const settings = {
      displayName,
      email,
      language,
      emailNotifications,
      pushNotifications,
      notifyOnStake,
      notifyOnUnstake,
      notifyOnRewards,
      accentColor,
      autoTheme,
      themeMode,
      currency,
      timezone,
      numberFormat,
      activityPublic,
      showBalance,
    };

    localStorage.setItem("userSettings", JSON.stringify(settings));

    setTimeout(() => {
      setIsSaving(false);
      showSuccess("Settings saved successfully!");
    }, 1000);
  };

  const exportData = () => {
    const data = {
      settings: JSON.parse(localStorage.getItem("userSettings") || "{}"),
      wallet: publicKey?.toString(),
      exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staking-data-export-${Date.now()}.json`;
    a.click();
    
    showSuccess("Data exported successfully!");
  };

  const deleteAccount = () => {
    if (confirm("Are you sure you want to delete all your data? This action cannot be undone.")) {
      localStorage.removeItem("userSettings");
      disconnect();
      showInfo("Your data has been cleared. We're sorry to see you go!");
    }
  };

  const sections = [
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "theme", label: "Theme", icon: Palette },
    { id: "currency", label: "Currency & Display", icon: Globe },
    { id: "wallet", label: "Wallet", icon: Wallet },
    { id: "privacy", label: "Privacy & Security", icon: Shield },
  ];

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div 
            className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" 
            style={{ borderColor: '#fb57ff', borderTopColor: 'transparent' }}
          />
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 
          className="text-3xl font-bold mb-2"
          style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
        >
          Settings
        </h1>
        <p className="text-gray-500">Manage your account preferences and settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <nav className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-2 space-y-1 sticky top-6">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id as SettingsSection)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    activeSection === section.id
                      ? "text-white shadow-lg"
                      : "text-gray-400 hover:bg-white/[0.05] hover:text-white"
                  }`}
                  style={activeSection === section.id ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{section.label}</span>
                  <ChevronRight className={`w-4 h-4 ml-auto ${activeSection === section.id ? "opacity-100" : "opacity-0"}`} />
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 space-y-6">
            {/* Profile Settings */}
            {activeSection === "profile" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    <User className="w-6 h-6" />
                    Profile Settings
                  </h2>
                  <p className="text-gray-400 mb-6">Manage your personal information</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-white/[0.05] text-white px-4 py-3 rounded-lg border border-white/[0.05] focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full bg-white/[0.05] text-white px-4 py-3 rounded-lg border border-white/[0.05] focus:outline-none transition-colors"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Used for important account notifications
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-white/[0.05] text-white px-4 py-3 rounded-lg border border-white/[0.05] focus:outline-none transition-colors"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="ja">日本語</option>
                  </select>
                </div>
              </div>
            )}

            {/* Notification Settings */}
            {activeSection === "notifications" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    <Bell className="w-6 h-6" />
                    Notification Preferences
                  </h2>
                  <p className="text-gray-400 mb-6">Choose what notifications you want to receive</p>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-white/[0.05] rounded-lg cursor-pointer hover:bg-white/[0.08] transition-colors">
                    <div>
                      <p className="font-semibold text-white">Email Notifications</p>
                      <p className="text-sm text-gray-400">Receive updates via email</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailNotifications}
                      onChange={(e) => setEmailNotifications(e.target.checked)}
                      className="w-5 h-5 rounded"
                      style={{ accentColor: '#fb57ff' }}
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-white/[0.05] rounded-lg cursor-pointer hover:bg-white/[0.08] transition-colors">
                    <div>
                      <p className="font-semibold text-white">Push Notifications</p>
                      <p className="text-sm text-gray-400">Browser push notifications</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={pushNotifications}
                      onChange={(e) => setPushNotifications(e.target.checked)}
                      className="w-5 h-5 rounded"
                      style={{ accentColor: '#fb57ff' }}
                    />
                  </label>
                </div>

                <div className="border-t border-white/[0.05] pt-6">
                  <h3 className="font-semibold text-white mb-4">Notification Types</h3>
                  
                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 bg-white/[0.05] rounded-lg cursor-pointer hover:bg-white/[0.08]">
                      <span className="text-white">Stake Confirmations</span>
                      <input
                        type="checkbox"
                        checked={notifyOnStake}
                        onChange={(e) => setNotifyOnStake(e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{ accentColor: '#fb57ff' }}
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-white/[0.05] rounded-lg cursor-pointer hover:bg-white/[0.08]">
                      <span className="text-white">Unstake Confirmations</span>
                      <input
                        type="checkbox"
                        checked={notifyOnUnstake}
                        onChange={(e) => setNotifyOnUnstake(e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{ accentColor: '#fb57ff' }}
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-white/[0.05] rounded-lg cursor-pointer hover:bg-white/[0.08]">
                      <span className="text-white">Reward Updates</span>
                      <input
                        type="checkbox"
                        checked={notifyOnRewards}
                        onChange={(e) => setNotifyOnRewards(e.target.checked)}
                        className="w-5 h-5 rounded"
                        style={{ accentColor: '#fb57ff' }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Theme Settings - WITHOUT useTheme hook */}
            {activeSection === "theme" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    <Palette className="w-6 h-6" />
                    Theme Settings
                  </h2>
                  <p className="text-gray-400 mb-6">Customize the appearance of your dashboard</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Color Mode
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => {
                        setThemeMode("dark");
                        setAutoTheme(false);
                      }}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        themeMode === "dark" && !autoTheme
                          ? "bg-white/[0.05]"
                          : "bg-white/[0.02] hover:bg-white/[0.05]"
                      }`}
                      style={themeMode === "dark" && !autoTheme ? { borderColor: '#fb57ff' } : { borderColor: 'rgba(255, 255, 255, 0.05)' }}
                    >
                      <div className="w-full h-16 bg-gradient-to-br from-slate-900 to-slate-800 rounded mb-2 flex items-center justify-center">
                        <Moon className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-white font-semibold text-center">Dark</p>
                    </button>

                    <button
                      onClick={() => {
                        setThemeMode("light");
                        setAutoTheme(false);
                      }}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        themeMode === "light" && !autoTheme
                          ? "border-purple-500 bg-purple-500/10"
                          : "border-slate-700 bg-slate-800 hover:border-slate-600"
                      }`}
                    >
                      <div className="w-full h-16 bg-gradient-to-br from-gray-100 to-white rounded mb-2 flex items-center justify-center">
                        <Sun className="w-6 h-6 text-gray-600" />
                      </div>
                      <p className="text-white font-semibold text-center">Light</p>
                    </button>

                    <button
                      onClick={() => setAutoTheme(true)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        autoTheme
                          ? "border-purple-500 bg-purple-500/10"
                          : "border-slate-700 bg-slate-800 hover:border-slate-600"
                      }`}
                    >
                      <div className="w-full h-16 bg-gradient-to-r from-slate-900 via-gray-500 to-gray-100 rounded mb-2" />
                      <p className="text-white font-semibold text-center">Auto</p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Accent Color
                  </label>
                  <div className="flex gap-3 flex-wrap">
                    {["#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"].map((color) => (
                      <button
                        key={color}
                        onClick={() => setAccentColor(color)}
                        className={`w-12 h-12 rounded-lg transition-all ${
                          accentColor === color ? "ring-4 ring-white/50 scale-110" : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Currency Settings */}
            {activeSection === "currency" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    <Globe className="w-6 h-6" />
                    Currency & Display
                  </h2>
                  <p className="text-gray-400 mb-6">Set your preferred currency and formats</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Preferred Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-white/[0.05] text-white px-4 py-3 rounded-lg border border-white/[0.05] focus:outline-none transition-colors"
                  >
                    <option value="USD">USD - US Dollar ($)</option>
                    <option value="EUR">EUR - Euro (€)</option>
                    <option value="GBP">GBP - British Pound (£)</option>
                    <option value="JPY">JPY - Japanese Yen (¥)</option>
                    <option value="CAD">CAD - Canadian Dollar ($)</option>
                    <option value="AUD">AUD - Australian Dollar ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Number Format
                  </label>
                  <select
                    value={numberFormat}
                    onChange={(e) => setNumberFormat(e.target.value)}
                    className="w-full bg-white/[0.05] text-white px-4 py-3 rounded-lg border border-white/[0.05] focus:outline-none transition-colors"
                  >
                    <option value="en-US">1,234.56 (US)</option>
                    <option value="de-DE">1.234,56 (DE)</option>
                    <option value="fr-FR">1 234,56 (FR)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-white/[0.05] text-white px-4 py-3 rounded-lg border border-white/[0.05] focus:outline-none transition-colors"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Europe/Paris">Paris (CET)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Wallet Settings */}
            {activeSection === "wallet" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    <Wallet className="w-6 h-6" />
                    Wallet Management
                  </h2>
                  <p className="text-gray-400 mb-6">Manage your connected wallets</p>
                </div>

                {connected ? (
                  <div className="bg-white/[0.05] rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Connected Wallet</p>
                        <p className="text-white font-mono text-sm">
                          {publicKey?.toString().slice(0, 8)}...{publicKey?.toString().slice(-8)}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-semibold">
                        Connected
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        disconnect();
                        showInfo("Wallet disconnected");
                      }}
                      className="w-full px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 rounded-lg transition-all"
                    >
                      Disconnect Wallet
                    </button>
                  </div>
                ) : (
                  <div className="bg-white/[0.05] rounded-lg p-6 text-center">
                    <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 mb-4">No wallet connected</p>
                    <p className="text-sm text-gray-500">
                      Connect your wallet using the button in the sidebar
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Privacy Settings */}
            {activeSection === "privacy" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    <Shield className="w-6 h-6" />
                    Privacy & Security
                  </h2>
                  <p className="text-gray-400 mb-6">Control your privacy and data</p>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-white/[0.05] rounded-lg cursor-pointer hover:bg-white/[0.08] transition-colors">
                    <div>
                      <p className="font-semibold text-white">Public Activity</p>
                      <p className="text-sm text-gray-400">Allow others to see your staking activity</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={activityPublic}
                      onChange={(e) => setActivityPublic(e.target.checked)}
                      className="w-5 h-5 rounded"
                      style={{ accentColor: '#fb57ff' }}
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-white/[0.05] rounded-lg cursor-pointer hover:bg-white/[0.08] transition-colors">
                    <div>
                      <p className="font-semibold text-white">Show Balance</p>
                      <p className="text-sm text-gray-400">Display your balance publicly</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={showBalance}
                      onChange={(e) => setShowBalance(e.target.checked)}
                      className="w-5 h-5 rounded"
                      style={{ accentColor: '#fb57ff' }}
                    />
                  </label>
                </div>

                <div className="border-t border-white/[0.05] pt-6">
                  <h3 className="font-semibold text-white mb-4">Data Management</h3>
                  
                  <div className="space-y-3">
                    <button
                      onClick={exportData}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg transition-all"
                      style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                    >
                      <Download className="w-5 h-5" />
                      Export My Data
                    </button>

                    <button
                      onClick={deleteAccount}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-all border border-red-600/50"
                    >
                      <Trash2 className="w-5 h-5" />
                      Delete All Data
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="border-t border-white/[0.05] pt-6">
              <button
                onClick={saveSettings}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 text-white rounded-lg font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
              >
                {isSaving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}