"use client";

import { useState } from "react";
import { 
  Mail, 
  MessageCircle, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Zap,
  HelpCircle,
  ExternalLink,
  Copy,
  Check
} from "lucide-react";

export default function SupportClient() {
  const [emailCopied, setEmailCopied] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("support@stakepoint.app");
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };

  const supportTopics = [
    {
      icon: HelpCircle,
      title: "General Questions",
      description: "Questions about how StakePoint works, features, or getting started"
    },
    {
      icon: AlertCircle,
      title: "Technical Issues",
      description: "Problems with staking, transactions, wallet connections, or errors"
    },
    {
      icon: Zap,
      title: "Pool Creation",
      description: "Help with creating pools, configuration, or managing your pools"
    },
    {
      icon: MessageCircle,
      title: "Partnerships",
      description: "Business inquiries, collaborations, or partnership opportunities"
    }
  ];

  const tipsList = [
    "Include your wallet address (public key only - never share private keys)",
    "Describe the issue in detail with step-by-step information",
    "Attach screenshots or transaction signatures if relevant",
    "Mention which browser and wallet you're using",
    "Include any error messages you received"
  ];

  return (
    <div className="min-h-screen bg-[#060609] text-white">
      {/* Hero Section */}
      <div className="relative border-b border-white/[0.05] bg-gradient-to-b from-black/50 to-[#060609]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/3 w-[600px] h-[600px] rounded-full blur-3xl" style={{ background: 'rgba(251, 87, 255, 0.08)' }} />
        </div>
        
        <div className="relative max-w-5xl mx-auto px-6 py-16">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.05] border border-white/[0.05] rounded-full mb-4">
              <MessageCircle className="w-4 h-4 text-[#fb57ff]" />
              <span className="text-sm text-gray-300">Support Center</span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold bg-gradient-to-r from-white via-white to-[#fb57ff] bg-clip-text text-transparent">
              How Can We Help?
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Our team is here to assist you with any questions or issues you may have
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        
        {/* Contact Methods */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {/* Email Support */}
          <div className="group relative bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] rounded-2xl p-8 hover:border-[#fb57ff]/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-[#fb57ff]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
            
            <div className="relative">
              <div className="flex items-start justify-between mb-6">
                <div className="p-4 bg-gradient-to-br from-[#fb57ff]/20 to-[#fb57ff]/5 rounded-xl border border-[#fb57ff]/20">
                  <Mail className="w-8 h-8 text-[#fb57ff]" />
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs text-green-400 font-semibold">Active</span>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white mb-3">Email Support</h2>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                Send us a detailed email and our team will get back to you as soon as possible. 
                Best for non-urgent inquiries and detailed questions.
              </p>

              <div className="bg-black/30 border border-white/[0.05] rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Email Address</p>
                    <a 
                      href="mailto:support@stakepoint.app" 
                      className="text-white font-semibold hover:text-[#fb57ff] transition-colors text-lg"
                    >
                      support@stakepoint.app
                    </a>
                  </div>
                  <button
                    onClick={handleCopyEmail}
                    className="p-2 hover:bg-white/[0.05] rounded-lg transition-all active:scale-95"
                    aria-label="Copy email"
                  >
                    {emailCopied ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Clock className="w-4 h-4" />
                <span>Response time: 24-48 hours</span>
              </div>
            </div>
          </div>

          {/* Twitter Support */}
          <div className="group relative bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] rounded-2xl p-8 hover:border-[#fb57ff]/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-[#fb57ff]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
            
            <div className="relative">
              <div className="flex items-start justify-between mb-6">
                <div className="p-4 bg-gradient-to-br from-[#fb57ff]/20 to-[#fb57ff]/5 rounded-xl border border-[#fb57ff]/20">
                  <svg className="w-8 h-8 text-[#fb57ff]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs text-green-400 font-semibold">Active</span>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white mb-3">Twitter / X Support</h2>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                Reach out to us on X (Twitter) for quick questions and community support. 
                Great for real-time assistance and updates.
              </p>

              <a
                href="https://x.com/StakePointApp"
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-gradient-to-r from-[#fb57ff] to-[#fb57ff]/80 hover:from-[#fb57ff]/90 hover:to-[#fb57ff]/70 text-white font-semibold rounded-xl p-4 mb-6 transition-all group/button"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span>@StakePointApp</span>
                  </div>
                  <ExternalLink className="w-5 h-5 group-hover/button:translate-x-1 transition-transform" />
                </div>
              </a>

              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Clock className="w-4 h-4" />
                <span>Response time: 2-12 hours</span>
              </div>
            </div>
          </div>
        </div>

        {/* Support Topics */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">What Can We Help You With?</h2>
            <p className="text-gray-400">Choose a category that best matches your inquiry</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {supportTopics.map((topic, index) => {
              const Icon = topic.icon;

              return (
                <div
                  key={index}
                  className="bg-gradient-to-br from-[#fb57ff]/10 to-[#fb57ff]/5 border border-[#fb57ff]/20 rounded-xl p-6 hover:scale-[1.02] transition-transform"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-black/20 rounded-lg border border-[#fb57ff]/20">
                      <Icon className="w-6 h-6 text-[#fb57ff]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-semibold mb-2">{topic.title}</h3>
                      <p className="text-gray-400 text-sm">{topic.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tips for Better Support */}
        <div className="bg-gradient-to-br from-[#fb57ff]/10 to-transparent border border-[#fb57ff]/20 rounded-2xl p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-[#fb57ff]/20 rounded-xl">
              <CheckCircle className="w-6 h-6 text-[#fb57ff]" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Tips for Faster Support</h3>
              <p className="text-gray-400">Help us help you! Include these details in your message:</p>
            </div>
          </div>

          <ul className="space-y-3">
            {tipsList.map((tip, index) => (
              <li key={index} className="flex items-start gap-3 text-gray-300">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#fb57ff]/20 border border-[#fb57ff]/30 flex items-center justify-center mt-0.5">
                  <span className="text-[#fb57ff] text-sm font-bold">{index + 1}</span>
                </div>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Security Notice */}
        <div className="mt-8 p-6 bg-gradient-to-br from-white/[0.05] to-transparent border border-white/[0.1] rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#fb57ff] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-white font-semibold mb-2">Security Warning</h4>
              <p className="text-gray-300 text-sm leading-relaxed">
                <strong className="text-white">Never share your private keys, seed phrases, or passwords with anyone!</strong> 
                {" "}StakePoint support will never ask for sensitive information like private keys. 
                Be cautious of impersonators on social media. Always verify you're contacting official StakePoint channels.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Link */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 mb-4">Looking for answers to common questions?</p>
          <a
            href="/docs#faq"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.05] border border-white/[0.05] rounded-lg hover:bg-white/[0.08] hover:border-[#fb57ff]/30 transition-all font-semibold"
          >
            <HelpCircle className="w-5 h-5 text-[#fb57ff]" />
            Check our FAQ
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

