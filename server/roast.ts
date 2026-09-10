import { GoogleGenAI } from '@google/genai';
import { UserProfile } from '../src/types.ts';

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length === 0) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

/**
 * Curated, dynamic fallback roasts tailored to rank, amount, and excuse.
 * Ensures the roast feature ALWAYS succeeds even without internet, credentials, or during rate limits.
 */
export function generateFallbackRoast(profile: UserProfile): string {
  const { name, amount, rank, reason } = profile;
  const formattedAmount = `₹${amount.toLocaleString('en-IN')}`;

  if (rank === 1) {
    const winnerRoasts = [
      `${name} really parted with ${formattedAmount} just to be crowned CEO of lying down.`,
      `${formattedAmount} to prove you do nothing. Financial advisors everywhere are quietly weeping.`,
      `${name} dropped ${formattedAmount} on #1 because walking to the fridge felt like a marathon.`,
      `Peak ambition: spending ${formattedAmount} so nobody on the internet expects anything from you today.`
    ];
    return winnerRoasts[Math.floor(Math.random() * winnerRoasts.length)];
  }

  if (rank === 2 || rank === 3) {
    const podiumRoasts = [
      `Paid ${formattedAmount} for Rank #${rank}—couldn't even be bothered to pay enough to win.`,
      `Silver-tier lethargy: ${name} spent ${formattedAmount} just to be the runner-up in inaction.`,
      `Rank #${rank} on LAZY. Close enough to look like effort, lazy enough to stop right there.`,
      `${name} dropped ${formattedAmount} only to watch #1 stay out of reach from the couch.`
    ];
    return podiumRoasts[Math.floor(Math.random() * podiumRoasts.length)];
  }

  if (amount >= 500) {
    const bigSpenderMidRank = [
      `${name} spent a whole ${formattedAmount} only to sit at Rank #${rank}. Double the regret, zero the hustle.`,
      `Imagine dropping ${formattedAmount} and still being ranked #${rank}. Truly inspirational inefficiency.`,
      `Paid ${formattedAmount} to publicly celebrate avoiding responsibility at Rank #${rank}.`
    ];
    return bigSpenderMidRank[Math.floor(Math.random() * bigSpenderMidRank.length)];
  }

  if (amount <= 50) {
    const budgetRoasts = [
      `${name} paid ${formattedAmount} for Rank #${rank}. Even the financial commitment was low-effort.`,
      `${formattedAmount} to buy a spot on the leaderboard. The absolute coupon-clipper of sloth.`,
      `Rank #${rank} for ${formattedAmount}. Literally the bare minimum in monetary form.`
    ];
    return budgetRoasts[Math.floor(Math.random() * budgetRoasts.length)];
  }

  // General Rank Roasts
  const generalRoasts = [
    `${name} invested ${formattedAmount} into Rank #${rank}. Productivity has officially left the chat.`,
    `Rank #${rank} secured. ${formattedAmount} down the drain with zero intention of doing anything about it.`,
    `${name} paid ${formattedAmount} to formally register as non-functional today.`
  ];
  return generalRoasts[Math.floor(Math.random() * generalRoasts.length)];
}

/**
 * Generates an AI Lazy Roast using Gemini (gemini-3.8-flash) or fallback.
 * Strictly non-blocking, safe, and stored for permanence.
 */
export async function generateRoast(
  profile: UserProfile,
  options?: { previousTopName?: string; forceRegenerate?: boolean }
): Promise<{ roast: string; source: 'gemini' | 'fallback' }> {
  // If user already has a saved roast and not forcing regeneration, reuse it
  if (profile.roast && !options?.forceRegenerate) {
    return { roast: profile.roast, source: 'gemini' };
  }

  const ai = getGeminiClient();
  if (!ai) {
    return { roast: generateFallbackRoast(profile), source: 'fallback' };
  }

  try {
    const prompt = `You are the official witty, deadpan roast engine for "LAZY" (lazy.lol), an internet pay-to-rank game where users spend real money solely to prove how lazy they are.

PARTICIPANT DETAILS:
- Name: ${profile.name}
- Verified Paid Amount: ₹${profile.amount.toLocaleString('en-IN')}
- Public Rank: #${profile.rank}
- Their Reason/Confession: ${profile.reason ? `"${profile.reason}"` : 'None given'}
${profile.rank === 1 ? '- Status: CURRENT #1 SUPREME OVERLORD OF INACTION.' : ''}
${options?.previousTopName ? `- Previous #1 dethroned: ${options.previousTopName}` : ''}

TASK:
Write a single sharp, deadpan roast (1 to 2 short sentences, under 130 characters, max 22 words) roasting their financial decision and laziness.

STRICT TONE & FORMAT RULES:
- Friendly deadpan internet humor. Setup + punchline.
- Sound like a witty friend or sharp internet post.
- Under 130 characters so it fits on a 9:16 social story card.
- NO clichés ("Well well well", "Looks like someone", "Behold", "Legend has it", "Ah yes").
- NO quotation marks around the entire output.
- NO hashtags, no emojis, no asterisks, no exclamation overload.
- Keep it clean, harmless, and self-deprecating about money vs laziness.`;

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.85,
        maxOutputTokens: 80,
      }
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API request timed out')), 3500)
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);

    let text = response.text ? response.text.trim() : '';

    // Strip wrapping quotes or backticks if returned
    text = text.replace(/^["'`]+|["'`]+$/g, '').trim();

    // Fallback if empty or overly long
    if (!text || text.length < 10) {
      return { roast: generateFallbackRoast(profile), source: 'fallback' };
    }

    // Limit length to keep card layout pristine
    if (text.length > 180) {
      text = text.slice(0, 175) + '...';
    }

    return { roast: text, source: 'gemini' };
  } catch (err) {
    console.warn('Gemini AI Roast call failed, using context fallback:', err);
    return { roast: generateFallbackRoast(profile), source: 'fallback' };
  }
}
