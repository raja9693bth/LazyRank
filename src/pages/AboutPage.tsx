import React from 'react';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { LEGAL_CONFIG } from '../config/legal';
import { Trophy, ShieldCheck, Smartphone, Clock, Sparkles } from 'lucide-react';

interface AboutPageProps {
  onNavigate: (path: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  return (
    <LegalPageLayout
      title={`About ${LEGAL_CONFIG.PRODUCT_NAME}`}
      subtitle={`${LEGAL_CONFIG.POSITIONING_TITLE}: Transparent, deterministic digital profile placement.`}
      lastUpdated="September 24, 2026"
      currentPath="/about"
      onNavigate={onNavigate}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          What is {LEGAL_CONFIG.BRAND_NAME}?
        </h2>
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-300 text-zinc-900 text-xs sm:text-sm font-medium leading-relaxed">
          <strong>Official Service Description:</strong> {LEGAL_CONFIG.OPERATING_STATEMENT} {LEGAL_CONFIG.BRAND_NAME} is a digital sponsored profile showcase and public leaderboard. Users purchase digital profile visibility and optional social/website links. Leaderboard position is determined deterministically by cumulative verified sponsorship amount.
        </div>
        <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
          In an online environment dominated by relentless productivity flexing, {LEGAL_CONFIG.BRAND_NAME} provides a humorous, tongue-in-cheek public arena where individuals, creators, and enthusiasts can sponsor a profile placement to declare their dedication to doing absolutely nothing.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          Core Ranking Mechanics: 100% Deterministic & Transparent
        </h2>
        <p className="text-xs sm:text-sm text-zinc-600">
          The ranking system is entirely open and governed by unambiguous mathematical rules:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
            <div className="font-bold text-zinc-950 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-600" />
              <span>Cumulative Verified Amount</span>
            </div>
            <p className="text-zinc-600">
              Rank is strictly determined by cumulative verified sponsorship amount in Indian Rupees (INR). A higher cumulative verified amount yields a higher leaderboard position.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
            <div className="font-bold text-zinc-950 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Deterministic Tie-Breaking</span>
            </div>
            <p className="text-zinc-600">
              If two profiles have identical cumulative verified amounts, the profile with the earlier first verified payment timestamp (<code>first_verified_at ASC</code>) takes precedence. If timestamps match, the stable database profile ID (<code>id ASC</code>) deterministically breaks the tie.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
            <div className="font-bold text-zinc-950 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Server-Authoritative Settlement</span>
            </div>
            <p className="text-zinc-600">
              Zero client authority. Ranks are committed atomically on our backend only after cryptographic webhook settlement or direct verification from the payment gateway.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
            <div className="font-bold text-zinc-950 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-purple-600" />
              <span>Digital Deliverables & Cards</span>
            </div>
            <p className="text-zinc-600">
              Verified participants receive high-resolution 9:16 story cards, public link placement (Instagram, LinkedIn, website), and official digital receipts.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          What {LEGAL_CONFIG.BRAND_NAME} Is NOT
        </h2>
        <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-zinc-700 pl-1">
          <li><strong>Not Gambling, Lottery, or a Game of Chance:</strong> There is no random drawing, betting outcome, or element of chance. Position is an open, deterministic mathematical function of cumulative verified sponsorship.</li>
          <li><strong>No Cash Prizes or Winnings:</strong> There are no cash rewards, dividends, financial returns, or prize pools.</li>
          <li><strong>Not an Investment:</strong> Payments do not yield financial returns, tokens, interest, or redeemable capital.</li>
          <li><strong>No Permanent Rank Ownership:</strong> Another participant can at any time contribute a higher verified sponsorship amount and displace your rank to a lower position.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          Operating Entity & Governance
        </h2>
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs sm:text-sm space-y-1.5 text-zinc-700">
          <div><strong>Operating Business:</strong> {LEGAL_CONFIG.LEGAL_BUSINESS_NAME}</div>
          <div><strong>Organisation Type:</strong> {LEGAL_CONFIG.ENTITY_TYPE}</div>
          <div><strong>Country / Jurisdiction:</strong> Registered in India (West Champaran, Bihar)</div>
          <div><strong>Platform URL:</strong> <a href={LEGAL_CONFIG.APP_URL} className="text-amber-800 font-bold hover:underline">{LEGAL_CONFIG.APP_URL}</a></div>
          <div><strong>Support Email:</strong> <a href={`mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}`} className="text-amber-800 font-bold hover:underline">{LEGAL_CONFIG.SUPPORT_EMAIL}</a></div>
        </div>
        <p className="text-xs text-zinc-600 mt-2">
          For full details, please review our <button type="button" onClick={() => onNavigate('/rules')} className="text-amber-800 font-bold hover:underline cursor-pointer">Rules Guide</button>, <button type="button" onClick={() => onNavigate('/terms')} className="text-amber-800 font-bold hover:underline cursor-pointer">Terms & Conditions</button>, and <button type="button" onClick={() => onNavigate('/delivery')} className="text-amber-800 font-bold hover:underline cursor-pointer">Delivery Policy</button>.
        </p>
      </section>
    </LegalPageLayout>
  );
};
