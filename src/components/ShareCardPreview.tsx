import React, { useRef, useEffect, useState } from 'react';
import { UserProfile, getLazyReasonEmoji } from '../types.ts';
import { Download, Check, Copy, Share2, Sparkles, Flame } from 'lucide-react';

export type CardTemplateType = 'bold_dark' | 'clean_white' | 'gold_winner';

interface ShareCardPreviewProps {
  profile: UserProfile;
  activeTemplate: CardTemplateType;
  onChangeTemplate: (template: CardTemplateType) => void;
  onCardRendered?: (dataUrl: string) => void;
  roast?: string;
  includeRoast?: boolean;
  onToggleIncludeRoast?: (include: boolean) => void;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}

interface LazyReasonBadgeColors {
  bg: string;
  border: string;
  text: string;
}

function drawLazyReasonBadge(
  ctx: CanvasRenderingContext2D,
  lazyReason: string | undefined,
  width: number,
  colors: LazyReasonBadgeColors
) {
  if (!lazyReason) return;
  ctx.save();
  ctx.font = 'bold 28px sans-serif';
  const emoji = getLazyReasonEmoji(lazyReason);
  const reasonText = `${emoji} REASON: ${lazyReason.toUpperCase()}`;
  const pillW = Math.min(width - 320, ctx.measureText(reasonText).width + 50);
  ctx.fillStyle = colors.bg;
  ctx.beginPath();
  ctx.roundRect((width - pillW) / 2, 1276, pillW, 46, 23);
  ctx.fill();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = colors.text;
  ctx.textAlign = 'center';
  ctx.fillText(reasonText, width / 2, 1308);
  ctx.restore();
}

interface RoastColors {
  header: string;
  text: string;
}

function drawRoastOrReason(
  ctx: CanvasRenderingContext2D,
  profile: UserProfile,
  roast: string | null | undefined,
  includeRoast: boolean,
  width: number,
  colors: RoastColors
) {
  if (includeRoast && roast) {
    ctx.fillStyle = colors.header;
    ctx.font = '900 28px sans-serif';
    ctx.fillText('🔥 AI LAZY ROAST', width / 2, 1420);
    ctx.fillStyle = colors.text;
    ctx.font = 'italic 36px sans-serif';
    wrapText(ctx, `"${roast}"`, width / 2, 1480, width - 260, 48);
  } else if (profile.reason) {
    ctx.fillStyle = colors.text;
    ctx.font = 'italic 38px sans-serif';
    wrapText(ctx, `"${profile.reason}"`, width / 2, 1470, width - 260, 54);
  }
}

function drawSocialLinks(
  ctx: CanvasRenderingContext2D,
  profile: UserProfile,
  width: number,
  color: string
) {
  if (!profile.instagram && !profile.linkedin && !profile.website) return;
  ctx.fillStyle = color;
  ctx.font = 'bold 36px sans-serif';
  const linkText = [
    profile.instagram ? `@${profile.instagram.replace(/^@/, '')}` : null,
    profile.linkedin ? 'LinkedIn' : null,
    profile.website ? profile.website.replace(/^https?:\/\//, '') : null
  ].filter(Boolean).join(' • ');
  ctx.fillText(linkText, width / 2, 1620);
}

function drawCardFooter(
  ctx: CanvasRenderingContext2D,
  width: number,
  highlightColor: string,
  domainColor: string
) {
  ctx.fillStyle = highlightColor;
  ctx.font = '900 48px sans-serif';
  ctx.fillText('TOP ME IF YOU CAN.', width / 2, 1750);
  ctx.fillStyle = domainColor;
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('lazyproof.online', width / 2, 1810);
}

export const ShareCardPreview: React.FC<ShareCardPreviewProps> = ({
  profile,
  activeTemplate,
  onChangeTemplate,
  onCardRendered,
  roast,
  includeRoast = true,
  onToggleIncludeRoast
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  // Generate canvas rendering for 1080x1920 (9:16 aspect ratio)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1080;
    const height = 1920;
    canvas.width = width;
    canvas.height = height;

    if (activeTemplate === 'gold_winner') {
      // TEMPLATE 1: Warm Orange / Light Showcase (Approved Brand Aesthetic)
      ctx.fillStyle = '#faf8f5';
      ctx.fillRect(0, 0, width, height);

      // Warm border accent
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 14;
      ctx.strokeRect(50, 50, width - 100, height - 100);

      // Top brand badge
      ctx.fillStyle = '#9c3a16';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      const streakText1 = profile.rank === 1 ? 'ALL-TIME #1 • TOP SPONSOR' : 'LAZY • SPONSORED PROOF';
      ctx.fillText(streakText1, width / 2, 240);

      // Punchy main statement
      ctx.fillStyle = '#1c1917';
      ctx.font = '900 68px sans-serif';
      ctx.fillText('I PAID', width / 2, 450);

      // Huge Amount
      ctx.fillStyle = '#ea580c';
      ctx.font = '900 130px sans-serif';
      ctx.fillText(`₹${profile.amount.toLocaleString('en-IN')}`, width / 2, 600);

      ctx.fillStyle = '#1c1917';
      ctx.font = '800 60px sans-serif';
      ctx.fillText("TO PROVE I'M LAZY.", width / 2, 720);

      // Center container for Rank & Identity
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(140, 830, width - 280, 520, 32);
      ctx.fill();
      ctx.strokeStyle = '#f2ded0';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Rank display
      ctx.fillStyle = '#ea580c';
      ctx.font = '900 170px sans-serif';
      ctx.fillText(`#${profile.rank}`, width / 2, 1020);

      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 56px sans-serif';
      ctx.fillText(profile.name.toUpperCase(), width / 2, 1140);

      ctx.fillStyle = '#059669';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText('✓ SERVER-VERIFIED PARTICIPANT', width / 2, 1240);

      drawLazyReasonBadge(ctx, profile.lazyReason, width, {
        bg: '#fef3c7',
        border: '#f59e0b',
        text: '#78350f'
      });
      drawRoastOrReason(ctx, profile, roast, includeRoast, width, {
        header: '#f59e0b',
        text: (includeRoast && roast) ? '#d4d4d8' : '#a1a1aa'
      });
      drawSocialLinks(ctx, profile, width, '#d4d4d8');
      drawCardFooter(ctx, width, '#f59e0b', '#71717a');

    } else if (activeTemplate === 'clean_white') {
      // TEMPLATE 2: Crisp Minimal White
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, width, height);

      // Outer border
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 14;
      ctx.strokeRect(50, 50, width - 100, height - 100);

      // Top brand
      ctx.fillStyle = '#18181b';
      ctx.font = '900 40px sans-serif';
      ctx.textAlign = 'center';
      const streakText2 = profile.rank === 1 ? 'ALL-TIME #1 • TOP SPONSOR' : 'LAZY • OFFICIAL LEADERBOARD';
      ctx.fillText(streakText2, width / 2, 220);

      // Statement
      ctx.font = '900 72px sans-serif';
      ctx.fillText('I PAID', width / 2, 450);

      ctx.fillStyle = '#09090b';
      ctx.font = '900 140px sans-serif';
      ctx.fillText(`₹${profile.amount.toLocaleString('en-IN')}`, width / 2, 600);

      ctx.font = '800 64px sans-serif';
      ctx.fillText("TO PROVE I'M LAZY.", width / 2, 720);

      // Center container
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(140, 830, width - 280, 520, 32);
      ctx.fill();
      ctx.strokeStyle = '#e4e4e7';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Big Rank
      ctx.fillStyle = '#09090b';
      ctx.font = '900 180px sans-serif';
      ctx.fillText(`#${profile.rank}`, width / 2, 1020);

      ctx.fillStyle = '#18181b';
      ctx.font = 'bold 56px sans-serif';
      ctx.fillText(profile.name.toUpperCase(), width / 2, 1140);

      ctx.fillStyle = '#059669';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('✓ LEGITIMACY VERIFIED', width / 2, 1240);

      drawLazyReasonBadge(ctx, profile.lazyReason, width, {
        bg: '#fef3c7',
        border: '#d97706',
        text: '#92400e'
      });
      drawRoastOrReason(ctx, profile, roast, includeRoast, width, {
        header: '#d97706',
        text: (includeRoast && roast) ? '#27272a' : '#52525b'
      });
      drawSocialLinks(ctx, profile, width, '#27272a');
      drawCardFooter(ctx, width, '#09090b', '#a1a1aa');

    } else {
      // TEMPLATE 3: Bold Dark Contrast
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, width, height);

      // Accent border
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 10;
      ctx.strokeRect(50, 50, width - 100, height - 100);

      // Top brand
      ctx.fillStyle = '#a1a1aa';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      const streakText3 = profile.rank === 1 ? 'ALL-TIME #1 • TOP SPONSOR' : 'LAZY • VERIFIED RANK';
      ctx.fillText(streakText3, width / 2, 220);

      // Text
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 70px sans-serif';
      ctx.fillText('I PAID', width / 2, 450);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '900 135px sans-serif';
      ctx.fillText(`₹${profile.amount.toLocaleString('en-IN')}`, width / 2, 600);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 62px sans-serif';
      ctx.fillText("TO PROVE I'M LAZY.", width / 2, 720);

      // Center container
      ctx.fillStyle = '#27272a';
      ctx.beginPath();
      ctx.roundRect(140, 830, width - 280, 520, 32);
      ctx.fill();

      // Rank
      ctx.fillStyle = '#38bdf8';
      ctx.font = '900 170px sans-serif';
      ctx.fillText(`#${profile.rank}`, width / 2, 1020);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 54px sans-serif';
      ctx.fillText(profile.name.toUpperCase(), width / 2, 1140);

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText('✓ LEGITIMACY VERIFIED', width / 2, 1240);

      drawLazyReasonBadge(ctx, profile.lazyReason, width, {
        bg: '#3f3f46',
        border: '#38bdf8',
        text: '#38bdf8'
      });
      drawRoastOrReason(ctx, profile, roast, includeRoast, width, {
        header: '#38bdf8',
        text: (includeRoast && roast) ? '#f4f4f5' : '#d4d4d8'
      });
      drawSocialLinks(ctx, profile, width, '#e4e4e7');
      drawCardFooter(ctx, width, '#ffffff', '#71717a');
    }

    if (onCardRendered) {
      try {
        onCardRendered(canvas.toDataURL('image/png'));
      } catch {
        // Ignored
      }
    }
  }, [profile, activeTemplate, roast, includeRoast]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDownloading(true);
    try {
      const link = document.createElement('a');
      link.download = `lazy-rank-${profile.rank}-${profile.name.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  };

  const handleCopyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2000);
      });
    } catch {
      // Fallback to direct download if clipboard image copy isn't supported
      handleDownload();
    }
  };

  return (
    <div className="flex flex-col items-center max-w-sm mx-auto">
      {/* Optional Roast Toggle for 9:16 Story Card */}
      {roast && (
        <div className="flex items-center justify-between w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl mb-3">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold text-zinc-800">Include AI Roast on Card</span>
          </div>
          <button
            type="button"
            onClick={() => onToggleIncludeRoast?.(!includeRoast)}
            aria-pressed={includeRoast}
            aria-label={`Toggle AI roast on card, currently ${includeRoast ? 'on' : 'off'}`}
            className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
              includeRoast
                ? 'bg-amber-400 text-zinc-950 shadow-2xs'
                : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
            }`}
          >
            {includeRoast ? 'ON' : 'OFF'}
          </button>
        </div>
      )}

      {/* Template Selector Tabs */}
      <div role="tablist" aria-label="Card design templates" className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 mb-3 text-xs font-semibold">
        <button
          type="button"
          role="tab"
          aria-selected={activeTemplate === 'gold_winner'}
          onClick={() => onChangeTemplate('gold_winner')}
          className={`px-3 py-1 rounded-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
            activeTemplate === 'gold_winner'
              ? 'bg-amber-400 text-zinc-950 shadow-2xs font-bold'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          Gold Winner
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTemplate === 'bold_dark'}
          onClick={() => onChangeTemplate('bold_dark')}
          className={`px-3 py-1 rounded-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 ${
            activeTemplate === 'bold_dark'
              ? 'bg-zinc-950 text-white shadow-2xs font-bold'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          Dark Mode
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTemplate === 'clean_white'}
          onClick={() => onChangeTemplate('clean_white')}
          className={`px-3 py-1 rounded-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 ${
            activeTemplate === 'clean_white'
              ? 'bg-white text-zinc-950 shadow-2xs font-bold'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          Clean White
        </button>
      </div>

      {/* 9:16 Canvas Card Display with max-height constrain */}
      <div className="relative w-full aspect-9/16 max-h-[500px] rounded-2xl overflow-hidden shadow-xl border border-zinc-200 bg-zinc-950 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Card Action Buttons */}
      <div className="mt-3 flex items-center gap-2 w-full">
        <button
          id="download-share-card-btn"
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          aria-label="Save 9:16 story image to device"
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>{downloading ? 'Exporting...' : 'Save 9:16 Image'}</span>
        </button>

        <button
          type="button"
          onClick={handleCopyImage}
          aria-label="Copy card image to clipboard"
          className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition-all active:scale-95 cursor-pointer border border-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800"
          title="Copy Image to Clipboard"
        >
          {copiedImage ? (
            <>
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-zinc-600" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
