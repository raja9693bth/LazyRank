export const SHOWCASE_CATEGORIES = [
  'All',
  'Overthinkers',
  'Bed Warmers',
  '9-to-5 Escapers',
  'Nap Kings',
  'Founders',
  'Students'
] as const;

export type ShowcaseCategory = (typeof SHOWCASE_CATEGORIES)[number];

export const BROWSE_CATEGORIES = SHOWCASE_CATEGORIES.filter(c => c !== 'All') as Exclude<ShowcaseCategory, 'All'>[];

export const WITTY_LAZY_TAGS = [
  'Procrastinator',
  'Meeting Dodger',
  'Couch Potato',
  'Nap Strategist',
  'Deadline Skeptic',
  'Tab Hoarder',
  'Snooze Specialist',
  'Inbox Ignorer'
] as const;

/**
 * Deterministically pick or derive a witty tag for a profile
 */
export function getWittyTag(profile: { name: string; reason?: string; lazyReason?: string; id?: string }): string {
  if (profile.lazyReason && profile.lazyReason.trim()) {
    return profile.lazyReason;
  }
  const str = profile.id || profile.name || 'lazy';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % WITTY_LAZY_TAGS.length;
  return WITTY_LAZY_TAGS[index];
}

/**
 * Fixed illustrative exchange rate: 1 USD = 85 INR
 * Note: USD display is purely illustrative. Backend always charges integer INR paise.
 */
export const USD_EXCHANGE_RATE = 85;

/**
 * Illustrative USD calculation: Math.round(inr / 85)
 * Always formatted with ~$ prefix
 */
export function formatIllustrativeUSD(amountINR: number): string {
  const usd = Math.round(amountINR / USD_EXCHANGE_RATE);
  return `~$${usd.toLocaleString('en-US')}`;
}

/**
 * Formats currency for display based on selected mode.
 */
export function formatDisplayCurrency(amountINR: number, mode: 'INR' | 'USD' | string = 'INR'): string {
  if (mode === 'USD') {
    return formatIllustrativeUSD(amountINR);
  }
  return `₹${amountINR.toLocaleString('en-IN')}`;
}

/**
 * Helper to match category filter on loaded profiles
 */
export function matchesCategory(profile: { reason?: string; lazyReason?: string; title?: string }, category: ShowcaseCategory): boolean {
  if (category === 'All') return true;
  const target = category.toLowerCase();
  const text = `${profile.lazyReason || ''} ${profile.reason || ''} ${profile.title || ''}`.toLowerCase();

  if (category === 'Overthinkers') return text.includes('overthink') || text.includes('tab') || text.includes('procrastinat');
  if (category === 'Bed Warmers') return text.includes('bed') || text.includes('blanket') || text.includes('mattress') || text.includes('horizontal');
  if (category === '9-to-5 Escapers') return text.includes('9-to-5') || text.includes('meeting') || text.includes('work') || text.includes('office') || text.includes('escap');
  if (category === 'Nap Kings') return text.includes('nap') || text.includes('snooze') || text.includes('sleep') || text.includes('couch');
  if (category === 'Founders') return text.includes('founder') || text.includes('chief') || text.includes('sloth officer') || text.includes('startup');
  if (category === 'Students') return text.includes('student') || text.includes('study') || text.includes('exam') || text.includes('tomorrow') || text.includes('homework');

  return text.includes(target);
}
