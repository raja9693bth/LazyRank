import React from 'react';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { Trophy, ShieldCheck, Sparkles, Smartphone, CheckCircle } from 'lucide-react';

interface AboutPageProps {
  onNavigate: (path: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  return (
    <LegalPageLayout
      title="About LAZY"
      subtitle="The satirical internet cultural experiment where you pay to prove you're the laziest person on the internet."
      lastUpdated="September 10, 2026"
      currentPath="/about"
      onNavigate={onNavigate}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          What is LAZY?
        </h2>
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-300 text-zinc-900 text-xs sm:text-sm font-medium leading-relaxed">
          <strong>Official Service Description:</strong> LAZY is an entertainment-based public pay-to-rank experience. A participant selects an amount and, after the payment is successfully verified, that verified amount determines their position on the LAZY leaderboard under the published rules.
        </div>
        <p>
          In a modern internet ecosystem flooded with toxic hustle culture, 4:00 AM routines, and aggressive productivity flexes, <strong>LAZY</strong> was created as a self-aware, tongue-in-cheek counterbalance. It is a live public spectacle where people celebrate the fine art of doing absolutely nothing—and back it up with verified Indian Rupees.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          The Core Mechanics: 100% Deterministic & Transparent
        </h2>
        <p>
          Unlike subjective social networks or vote-manipulated contests, LAZY runs on absolute, server-side truth:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
            <div className="font-bold text-zinc-950 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-600" />
              <span>Higher Payment = Higher Rank</span>
            </div>
            <p className="text-zinc-600">
              Your rank is strictly derived from your verified paid amount in INR. Pay ₹100, you beat everyone who paid ₹99. Pay ₹5,001, and you claim the throne until someone tops you.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
            <div className="font-bold text-zinc-950 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Timestamp Tie-Breaking</span>
            </div>
            <p className="text-zinc-600">
              If two participants pay the exact same amount, the earlier server-verified timestamp holds the higher rank. No randomness, no biased judging.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
            <div className="font-bold text-zinc-950 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Server-Verified Authority</span>
            </div>
            <p className="text-zinc-600">
              Frontend code and browser state have zero authority. Only transactions verified via official payment aggregator webhooks earn verified status.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
            <div className="font-bold text-zinc-950 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-purple-600" />
              <span>Social Story Cards</span>
            </div>
            <p className="text-zinc-600">
              Every verified participant receives downloadable 9:16 story cards rendered live in high-resolution canvas with verified badges, rank numbers, and quotes.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          What LAZY Is NOT
        </h2>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li><strong>Not an Investment:</strong> There are no dividends, interest, tokens, or financial appreciation.</li>
          <li><strong>Not Gambling or a Lottery:</strong> There is no element of chance, drawing of lots, or prize pool. Rank is an open, deterministic function of verified payment amount.</li>
          <li><strong>Not a Charity:</strong> Payments support the ongoing server operations, payment processing fees, and maintenance of the digital leaderboard.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          Operator & Compliance
        </h2>
        <p>
          LAZY is operated by and associated with XAIVON / [INSERT VERIFIED LEGAL BUSINESS NAME]. Payments are securely processed through recognized Indian payment aggregators compliant with RBI payment regulations.
        </p>
        <p>
          For complete rules, please review our <button type="button" onClick={() => onNavigate('/rules')} className="text-amber-800 font-bold hover:underline cursor-pointer">Official Rules & Ranking Guide</button>, or view our <button type="button" onClick={() => onNavigate('/terms')} className="text-amber-800 font-bold hover:underline cursor-pointer">Terms & Conditions</button>.
        </p>
      </section>
    </LegalPageLayout>
  );
};

function Clock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
