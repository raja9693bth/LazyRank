import React from 'react';
import { CreditCard, TrendingUp, ShieldCheck } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      icon: CreditCard,
      step: '01',
      title: 'Pay What You Want',
      desc: 'Enter your name and any amount from ₹1 upwards. Instant UPI & card checkout.'
    },
    {
      icon: TrendingUp,
      step: '02',
      title: 'Higher Pay = Higher Rank',
      desc: 'Your verified amount dictates your rank. Outbid the current #1 to claim the top spot.'
    },
    {
      icon: ShieldCheck,
      step: '03',
      title: 'Permanent Legitimacy',
      desc: '100% server-verified. Every rupee is authenticated before ranking updates.'
    }
  ];

  return (
    <section className="w-full max-w-2xl mx-auto my-5 sm:my-6">
      <div className="pb-2 border-b border-zinc-100 mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          How LAZY Works
        </h3>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          A serious interface for a ridiculous social experiment.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.step}
              className="p-3 sm:p-3.5 rounded-xl border border-zinc-200/70 bg-white shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-mono-numbers text-[10px] font-black text-zinc-300">
                    {s.step}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-zinc-900 mb-1">
                  {s.title}
                </h4>

                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  {s.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
