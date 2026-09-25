import React from 'react';
import { LazyLogo } from './LazyLogo';
import { ShieldAlert, ShieldCheck, Sliders } from 'lucide-react';
import { LEGAL_CONFIG } from '../config/legal';

interface FooterProps {
  onNavigate: (path: string) => void;
  onOpenAdmin: () => void;
  onOpenSettings?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenAdmin, onOpenSettings }) => {
  return (
    <footer className="w-full border-t border-zinc-200 mt-10 sm:mt-12 py-8 sm:py-10 pb-24 sm:pb-10 bg-white text-xs text-zinc-600">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 text-center space-y-4">
        {/* LAZY logo & descriptor */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2 group cursor-pointer focus-visible:outline-2 focus-visible:outline-zinc-950 rounded-sm"
            aria-label="LAZY Home"
          >
            <LazyLogo variant="horizontal" size="sm" />
          </button>
          <p className="text-xs text-zinc-500 max-w-md leading-relaxed">
            {LEGAL_CONFIG.POSITIONING_TITLE}. Higher cumulative verified sponsorship determines leaderboard position.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 bg-zinc-50 px-3 py-1 rounded-full border border-zinc-200/80">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Server-Authoritative Payment Verification</span>
              <span className="text-zinc-300">·</span>
              <span>Zero Client Authority</span>
            </div>
            {onOpenSettings && (
              <button
                type="button"
                id="footer-settings-btn"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-700 hover:text-stone-950 bg-[#faf6f0] hover:bg-[#f3ede3] px-3 py-1 rounded-full border border-[#e4dcce] transition-colors cursor-pointer"
                title="Manage participant profile and settings"
              >
                <Sliders className="w-3.5 h-3.5 text-stone-600" />
                <span>Profile Settings</span>
              </button>
            )}
          </div>
        </div>

        {/* Link row: About, Rules, Terms, Privacy, Refund, Delivery, Contact */}
        <nav aria-label="Footer Navigation" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-zinc-600 font-medium text-xs">
          <button
            id="footer-link-about"
            type="button"
            onClick={() => onNavigate('/about')}
            className="hover:text-zinc-950 transition-colors cursor-pointer"
          >
            About
          </button>
          <button
            id="footer-link-rules"
            type="button"
            onClick={() => onNavigate('/rules')}
            className="hover:text-zinc-950 transition-colors cursor-pointer"
          >
            Rules
          </button>
          <button
            id="footer-link-terms"
            type="button"
            onClick={() => onNavigate('/terms')}
            className="hover:text-zinc-950 transition-colors cursor-pointer"
          >
            Terms of Service
          </button>
          <button
            id="footer-link-privacy"
            type="button"
            onClick={() => onNavigate('/privacy')}
            className="hover:text-zinc-950 transition-colors cursor-pointer"
          >
            Privacy Policy
          </button>
          <button
            id="footer-link-refund"
            type="button"
            onClick={() => onNavigate('/refund-cancellation')}
            className="hover:text-zinc-950 transition-colors cursor-pointer"
          >
            Refund & Cancellation
          </button>
          <button
            id="footer-link-delivery"
            type="button"
            onClick={() => onNavigate('/delivery')}
            className="hover:text-zinc-950 transition-colors cursor-pointer"
          >
            Delivery Policy
          </button>
          <button
            id="footer-link-contact"
            type="button"
            onClick={() => onNavigate('/contact')}
            className="hover:text-zinc-950 transition-colors cursor-pointer"
          >
            Contact
          </button>
          {onOpenSettings && (
            <button
              id="footer-link-settings"
              type="button"
              onClick={onOpenSettings}
              className="hover:text-zinc-950 transition-colors cursor-pointer font-bold"
            >
              Settings
            </button>
          )}
        </nav>

        {/* Admin Link (Unobtrusive) */}
        <div>
          <button
            id="footer-link-admin"
            type="button"
            onClick={onOpenAdmin}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            title="Restricted Administrator Access"
          >
            <ShieldAlert className="w-3 h-3 text-zinc-400" />
            <span>Admin</span>
          </button>
        </div>

        {/* Copyright, entity, & support email */}
        <div className="pt-3 border-t border-zinc-100 text-[11px] text-zinc-400 space-y-1">
          <div>
            © {new Date().getFullYear()} {LEGAL_CONFIG.BRAND_NAME}. Operated by {LEGAL_CONFIG.LEGAL_BUSINESS_NAME}, a sole proprietorship registered in India.
          </div>
          <div>
            Support:{' '}
            <a href={`mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}`} className="font-semibold text-zinc-600 hover:underline">
              {LEGAL_CONFIG.SUPPORT_EMAIL}
            </a>{' '}
            | {LEGAL_CONFIG.SUPPORT_PHONE}
          </div>
          <div className="text-[10px] text-zinc-400 max-w-lg mx-auto">
            {LEGAL_CONFIG.DISCLAIMER}
          </div>
        </div>
      </div>
    </footer>
  );
};
