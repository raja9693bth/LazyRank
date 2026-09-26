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
              <span>Verified Payment Security</span>
              <span className="text-zinc-300">·</span>
              <span>Legitimate Public Ranking</span>
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
          <a
            id="footer-link-about"
            href="/about"
            onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onNavigate('/about');
            }}
            className="hover:text-zinc-950 transition-colors cursor-pointer"
          >
            About
          </a>
          <a
            id="footer-link-rules"
            href="/rules"
            onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onNavigate('/rules');
            }}
            className="hover:text-zinc-950 transition-colors cursor-pointer"
          >
            Rules
          </a>
          <a
            id="footer-link-terms"
            href="/terms"
            onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onNavigate('/terms');
            }}
            className="hover:text-zinc-950 transition-colors cursor-pointer"
          >
            Terms of Service
          </a>
          <a
            id="footer-link-privacy"
            href="/privacy"
            onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onNavigate('/privacy');
            }}
            className="hover:text-zinc-950 transition-colors cursor-pointer"
          >
            Privacy Policy
          </a>
          <a
            id="footer-link-refund"
            href="/refund-cancellation"
            onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onNavigate('/refund-cancellation');
            }}
            className="hover:text-zinc-950 transition-colors cursor-pointer"
          >
            Refund & Cancellation
          </a>
          <a
            id="footer-link-delivery"
            href="/delivery"
            onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onNavigate('/delivery');
            }}
            className="hover:text-zinc-950 transition-colors cursor-pointer"
          >
            Delivery Policy
          </a>
          <a
            id="footer-link-contact"
            href="/contact"
            onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onNavigate('/contact');
            }}
            className="hover:text-zinc-950 transition-colors cursor-pointer"
          >
            Contact
          </a>
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
            © {new Date().getFullYear()} {LEGAL_CONFIG.BRAND_NAME}. Operated by {LEGAL_CONFIG.LEGAL_BUSINESS_NAME} (Proprietor: {LEGAL_CONFIG.PROPRIETOR_NAME}), a sole proprietorship registered in India.
          </div>
          <div>
            Address: {LEGAL_CONFIG.PUBLIC_BUSINESS_ADDRESS}
          </div>
          <div>
            Support:{' '}
            <a href={`mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}`} className="font-semibold text-zinc-600 hover:underline">
              {LEGAL_CONFIG.SUPPORT_EMAIL}
            </a>{' '}
            |{' '}
            <a href={LEGAL_CONFIG.SUPPORT_PHONE_HREF} className="font-semibold text-zinc-600 hover:underline">
              {LEGAL_CONFIG.SUPPORT_PHONE}
            </a>
          </div>
          <div className="text-[10px] text-zinc-400 max-w-lg mx-auto">
            {LEGAL_CONFIG.DISCLAIMER}
          </div>
        </div>
      </div>
    </footer>
  );
};
