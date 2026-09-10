import React from 'react';
import { ArrowLeft, Mail, ShieldCheck, FileText, HelpCircle, RefreshCw } from 'lucide-react';

interface LegalPageLayoutProps {
  title: string;
  subtitle?: string;
  lastUpdated?: string;
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({
  title,
  subtitle,
  lastUpdated = 'September 10, 2026',
  currentPath,
  onNavigate,
  children
}) => {
  const policyNav = [
    { label: 'Terms & Conditions', path: '/terms' },
    { label: 'Privacy Policy', path: '/privacy' },
    { label: 'Refund & Cancellation', path: '/refund-cancellation' },
    { label: 'Contact Us', path: '/contact' },
    { label: 'About LAZY', path: '/about' },
    { label: 'Rules & Ranking', path: '/rules' }
  ];

  return (
    <div className="w-full max-w-3xl mx-auto py-6 sm:py-10 px-4 sm:px-6">
      {/* Top Nav & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-zinc-200">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-700 hover:text-zinc-950 bg-white hover:bg-zinc-100 border border-zinc-200 shadow-2xs transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Leaderboard</span>
        </button>

        <nav aria-label="Breadcrumb" className="text-xs text-zinc-500 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="hover:text-zinc-900 cursor-pointer"
          >
            Home
          </button>
          <span>/</span>
          <span className="font-semibold text-zinc-900 truncate max-w-[200px]">
            {title}
          </span>
        </nav>
      </div>

      {/* Header Info */}
      <header className="mb-8">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100/70 border border-amber-200/80 text-[11px] font-black tracking-wider text-amber-900 uppercase mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Official LAZY Documentation</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
          {title}
        </h1>

        {subtitle && (
          <p className="mt-2 text-sm sm:text-base text-zinc-600 leading-relaxed">
            {subtitle}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-zinc-500 pb-4 border-b border-zinc-200">
          <div>
            <span className="text-zinc-400">Last updated:</span>{' '}
            <time className="font-medium text-zinc-700">{lastUpdated}</time>
          </div>
          <span className="hidden sm:inline text-zinc-300">•</span>
          <div>
            <span className="text-zinc-400">Support email:</span>{' '}
            <a href="mailto:raja@xaivon.com" className="font-semibold text-zinc-900 hover:underline">
              raja@xaivon.com
            </a>
          </div>
          <span className="hidden sm:inline text-zinc-300">•</span>
          <div>
            <span className="text-zinc-400">Entity:</span>{' '}
            <span className="text-zinc-700 font-medium">Associated with XAIVON / [INSERT VERIFIED LEGAL BUSINESS NAME]</span>
          </div>
        </div>

        {/* Quick Cross-Policy Tabs */}
        <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {policyNav.map(item => {
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate(item.path)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-zinc-950 text-white shadow-2xs'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Legal / Support Article */}
      <article className="prose prose-zinc max-w-none text-zinc-800 text-sm leading-relaxed space-y-6">
        {children}
      </article>

      {/* Footer Support Card */}
      <div className="mt-12 p-5 sm:p-6 rounded-2xl bg-zinc-50 border border-zinc-200 shadow-2xs">
        <h3 className="text-sm font-bold text-zinc-950 mb-1.5 flex items-center gap-2">
          <Mail className="w-4 h-4 text-amber-600" />
          <span>Have questions about our policies or your payment?</span>
        </h3>
        <p className="text-xs text-zinc-600 leading-relaxed mb-3">
          Our team is available to assist with transaction confirmations, rank allocation queries, duplicate charge reconciliations, and content review.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="mailto:raja@xaivon.com"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email raja@xaivon.com</span>
          </a>
          <button
            type="button"
            onClick={() => onNavigate('/contact')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-bold transition-colors cursor-pointer"
          >
            <span>Visit Contact Page →</span>
          </button>
        </div>
      </div>
    </div>
  );
};
