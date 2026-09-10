import React from 'react';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { Trophy, CheckCircle, ShieldAlert, ArrowUpDown, Clock, Lock, Sparkles, AlertCircle } from 'lucide-react';

interface RulesPageProps {
  onNavigate: (path: string) => void;
}

export const RulesPage: React.FC<RulesPageProps> = ({ onNavigate }) => {
  const rules = [
    {
      num: 1,
      title: 'Verified Payment Is the Sole Ranking Metric',
      desc: 'Only successfully captured payments in INR verified by our backend server against recognized payment aggregator webhooks count toward your official rank. Frontend claims or unverified orders have zero standing.'
    },
    {
      num: 2,
      title: 'Higher Verified Amount Takes Higher Rank',
      desc: 'The leaderboard is strictly ordered in descending order of total verified paid amount. A participant who has verified ₹1,000 will always rank higher than someone who has verified ₹999.'
    },
    {
      num: 3,
      title: 'Earlier Server Timestamp Breaks Ties',
      desc: 'If two or more participants have verified the exact same amount in INR, the participant whose payment was verified earlier by our backend server takes the higher rank.'
    },
    {
      num: 4,
      title: 'Real-Time Rank Displacement Is an Active Game Feature',
      desc: 'The leaderboard is dynamic and competitive. When a new participant pays a higher amount than your verified total, your entry will be automatically pushed down by one or more positions. Displacement is an intended dynamic.'
    },
    {
      num: 5,
      title: 'Projected Ranks Are Estimates, Not Guarantees',
      desc: 'Any preview or projected rank displayed during checkout is calculated against the leaderboard state at that precise moment. Final rank is assigned at the moment of server verification, accounting for any simultaneous payments.'
    },
    {
      num: 6,
      title: 'Server Authority Is Absolute',
      desc: 'Client-side state, browser cookies, network interception, or local storage modifications are strictly ignored by the ranking engine. The server-side database is the sole arbiter of legitimacy.'
    },
    {
      num: 7,
      title: 'Profile Ownership & Rank Upgrades',
      desc: 'When you create a profile, a private cryptographic token is saved to your browser session. This allows you to add further funds to your existing profile later to climb higher, without creating a duplicate entry.'
    },
    {
      num: 8,
      title: 'Community Decency & Content Standards',
      desc: 'Display names, laziness reasons, and external links must not contain hate speech, slurs, harassment, sexually explicit content, or malicious URLs. Violations will be sanitized or removed.'
    },
    {
      num: 9,
      title: 'Strictly Entertainment — Zero Monetary Return',
      desc: 'LAZY is not an investment, cryptocurrency, lottery, or gambling scheme. Paid amounts are fees for digital leaderboard placement and share card generation. No financial return or prize is offered.'
    },
    {
      num: 10,
      title: 'Payment Finality & Fair Reversal Policy',
      desc: 'Because digital leaderboard placement and downloadable cards are delivered immediately upon verification, payments are generally non-refundable. Failed debits auto-reverse through standard banking channels (3–7 days). Duplicate payments are fully refundable upon inquiry.'
    }
  ];

  return (
    <LegalPageLayout
      title="How LAZY Works — Official Rules & Ranking Guide"
      subtitle="Complete rules governing the pay-to-rank mechanic, server verification, tie-breaking, and platform integrity."
      lastUpdated="September 10, 2026"
      currentPath="/rules"
      onNavigate={onNavigate}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          The 10 Golden Rules of LAZY
        </h2>
        <div className="space-y-3 mt-4">
          {rules.map((rule) => (
            <div
              key={rule.num}
              className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 transition-all hover:bg-zinc-100/70"
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-zinc-950 text-white font-black text-xs flex items-center justify-center">
                  #{rule.num}
                </span>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-zinc-950">
                    {rule.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                    {rule.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 mt-8">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          Frequently Asked Rule Questions
        </h2>
        <div className="space-y-3 text-xs sm:text-sm">
          <div className="p-3.5 rounded-xl bg-white border border-zinc-200">
            <strong className="text-zinc-950 block mb-1">Q: What happens if I get displaced from #1?</strong>
            <p className="text-zinc-600">
              You automatically move to #2. You will retain your verified badge and can upgrade your amount anytime to take back the #1 throne.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-zinc-200">
            <strong className="text-zinc-950 block mb-1">Q: Can I change my social handle or quote later?</strong>
            <p className="text-zinc-600">
              Yes, from the device you used to claim your rank (or using your owner token), you can edit your profile details or add to your total verified amount.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-zinc-200">
            <strong className="text-zinc-950 block mb-1">Q: How do I report an inappropriate name or link?</strong>
            <p className="text-zinc-600">
              You can click the report flag on any leaderboard item, submit our <button type="button" onClick={() => onNavigate('/contact')} className="text-amber-800 font-bold hover:underline cursor-pointer">Contact Form</button>, or email <a href="mailto:raja@xaivon.com" className="text-amber-800 font-bold hover:underline">raja@xaivon.com</a>.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 pt-4 border-t border-zinc-200 text-xs text-zinc-500">
        <p>
          For additional legal information, please consult our{' '}
          <button type="button" onClick={() => onNavigate('/terms')} className="text-zinc-800 font-bold underline cursor-pointer">
            Terms & Conditions
          </button>{' '}
          and{' '}
          <button type="button" onClick={() => onNavigate('/refund-cancellation')} className="text-zinc-800 font-bold underline cursor-pointer">
            Refund & Cancellation Policy
          </button>.
        </p>
      </section>
    </LegalPageLayout>
  );
};
