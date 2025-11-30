"use client";

import { useState } from "react";
import { X, Copy, Check, Code, Eye, ExternalLink } from "lucide-react";

interface IntegrateModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolId: string;
}

export default function IntegrateModal({ isOpen, onClose, poolId }: IntegrateModalProps) {
  const [buttonColor, setButtonColor] = useState("#fb57ff");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [copied, setCopied] = useState(false);

  // Remove # from color for clean URL
  const colorWithoutHash = buttonColor.replace('#', '');
  const embedUrl = `${window.location.origin}/embed/pool/${poolId}?color=${colorWithoutHash}&theme=${theme}`;
  
  const iframeCode = `<iframe 
  src="${embedUrl}" 
  width="100%" 
  height="800" 
  frameborder="0"
  style="border-radius: 16px; max-width: 600px;"
></iframe>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(iframeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePreview = () => {
    window.open(embedUrl, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0b0f] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-white/[0.05]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.05]">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Integrate Pool</h2>
            <p className="text-gray-400 text-sm">Embed this staking pool on your website</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Customization */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Code className="w-5 h-5 text-[#fb57ff]" />
              Customize Appearance
            </h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              {/* Button Color */}
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Button Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={buttonColor}
                    onChange={(e) => setButtonColor(e.target.value)}
                    className="w-16 h-16 rounded-lg cursor-pointer border-2 border-white/[0.1] bg-transparent"
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={buttonColor}
                      onChange={(e) => setButtonColor(e.target.value)}
                      className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#fb57ff]/50"
                      placeholder="#fb57ff"
                    />
                    <p className="text-xs text-gray-500 mt-1">Primary button color</p>
                  </div>
                </div>
              </div>

              {/* Theme Selector */}
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Theme</label>
                <div className="flex gap-3 h-16 items-center">
                  <button
                    onClick={() => setTheme("dark")}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                      theme === "dark"
                        ? "border-[#fb57ff] bg-[#fb57ff]/10 text-white"
                        : "border-white/[0.1] bg-white/[0.05] text-gray-400"
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-semibold">Dark</div>
                      <div className="text-xs">Black background</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setTheme("light")}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                      theme === "light"
                        ? "border-[#fb57ff] bg-[#fb57ff]/10 text-white"
                        : "border-white/[0.1] bg-white/[0.05] text-gray-400"
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-semibold">Light</div>
                      <div className="text-xs">White background</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-300">Live Preview</p>
                <button
                  onClick={handlePreview}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg text-sm text-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in New Tab
                </button>
              </div>
              <div className="rounded-lg overflow-hidden border border-white/[0.1]">
                <iframe 
                  src={embedUrl}
                  width="100%"
                  height="500"
                  style={{ 
                    border: 'none',
                    borderRadius: '8px'
                  }}
                  title="Embed Preview"
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                This is a live preview of how the embed will look on your website
              </p>
            </div>
          </div>

          {/* Embed Code */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Embed Code</h3>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 bg-[#fb57ff]/20 hover:bg-[#fb57ff]/30 rounded-lg text-sm text-white transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Code
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <pre className="bg-black/40 border border-white/[0.1] rounded-xl p-4 overflow-x-auto text-sm text-gray-300">
                <code>{iframeCode}</code>
              </pre>
            </div>

            <div className="bg-gradient-to-br from-[#fb57ff]/10 to-transparent border border-[#fb57ff]/20 rounded-xl p-4">
              <p className="text-sm text-gray-300 leading-relaxed">
                <strong className="text-white">💡 Tip:</strong> Copy this code and paste it into your website's HTML. 
                Users will be able to stake directly from your site without leaving the page.
              </p>
            </div>
          </div>

          {/* Embed URL */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Direct URL</h3>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={embedUrl}
                readOnly
                className="flex-1 px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-gray-300 focus:outline-none text-sm"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(embedUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-4 py-3 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg transition-colors"
              >
                <Copy className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/[0.05]">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg font-semibold text-white transition-colors"
          >
            Close
          </button>
          <button
            onClick={handlePreview}
            className="px-6 py-2.5 rounded-lg font-semibold text-white transition-all"
            style={{ 
              background: theme === "dark" 
                ? `linear-gradient(45deg, black, ${buttonColor})` 
                : buttonColor 
            }}
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview Embed
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

