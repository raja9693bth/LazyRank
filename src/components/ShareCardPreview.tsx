import React, { useRef, useEffect, useState } from 'react';
import { UserProfile } from '../types.ts';
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

    if (activeTemplate === 'gold_winner' || profile.rank === 1) {
      // TEMPLATE 1: Gold / Winner
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      // Gold border accent
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 14;
      ctx.strokeRect(50, 50, width - 100, height - 100);

      // Top brand badge
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LAZY • LEGITIMACY VERIFIED', width / 2, 220);

      // Crown / Trophy
      ctx.font = '84px sans-serif';
      ctx.fillText('👑', width / 2, 340);

      // Punchy main statement
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 68px sans-serif';
      ctx.fillText('I PAID', width / 2, 480);

      // Huge Amount
      ctx.fillStyle = '#f59e0b';
      ctx.font = '900 130px sans-serif';
      ctx.fillText(`₹${profile.amount.toLocaleString('en-IN')}`, width / 2, 620);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 60px sans-serif';
      ctx.fillText("TO PROVE I'M LAZY.", width / 2, 730);

      // Center container for Rank & Identity
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.roundRect(140, 830, width - 280, 520, 32);
      ctx.fill();
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Rank display
      ctx.fillStyle = '#f59e0b';
      ctx.font = '900 170px sans-serif';
      ctx.fillText(`#${profile.rank}`, width / 2, 1020);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 56px sans-serif';
      ctx.fillText(profile.name.toUpperCase(), width / 2, 1140);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText('✓ LEGITIMACY VERIFIED ON-CHAIN/SERVER', width / 2, 1240);

      // Quote / Roast / Reason
      if (includeRoast && roast) {
        ctx.fillStyle = '#f59e0b';
        ctx.font = '900 28px sans-serif';
        ctx.fillText('🔥 AI LAZY ROAST', width / 2, 1420);
        ctx.fillStyle = '#d4d4d8';
        ctx.font = 'italic 36px sans-serif';
        wrapText(ctx, `"${roast}"`, width / 2, 1480, width - 260, 48);
      } else if (profile.reason) {
        ctx.fillStyle = '#a1a1aa';
        ctx.font = 'italic 38px sans-serif';
        wrapText(ctx, `"${profile.reason}"`, width / 2, 1470, width - 260, 54);
      }

      // Social handle
      if (profile.instagram || profile.linkedin || profile.website) {
        ctx.fillStyle = '#d4d4d8';
        ctx.font = 'bold 36px sans-serif';
        const linkText = [
          profile.instagram ? `@${profile.instagram.replace(/^@/, '')}` : null,
          profile.linkedin ? 'LinkedIn' : null,
          profile.website ? profile.website.replace(/^https?:\/\//, '') : null
        ].filter(Boolean).join(' • ');
        ctx.fillText(linkText, width / 2, 1620);
      }

      // Challenge footer
      ctx.fillStyle = '#f59e0b';
      ctx.font = '900 48px sans-serif';
      ctx.fillText('TOP ME IF YOU CAN.', width / 2, 1750);
      ctx.fillStyle = '#71717a';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('lazy.lol', width / 2, 1810);

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
      ctx.fillText('LAZY • OFFICIAL LEADERBOARD', width / 2, 220);

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

      // Quote / Roast / Reason
      if (includeRoast && roast) {
        ctx.fillStyle = '#d97706';
        ctx.font = '900 28px sans-serif';
        ctx.fillText('🔥 AI LAZY ROAST', width / 2, 1420);
        ctx.fillStyle = '#27272a';
        ctx.font = 'italic 36px sans-serif';
        wrapText(ctx, `"${roast}"`, width / 2, 1480, width - 260, 48);
      } else if (profile.reason) {
        ctx.fillStyle = '#52525b';
        ctx.font = 'italic 38px sans-serif';
        wrapText(ctx, `"${profile.reason}"`, width / 2, 1470, width - 260, 54);
      }

      // Links
      if (profile.instagram || profile.linkedin || profile.website) {
        ctx.fillStyle = '#27272a';
        ctx.font = 'bold 36px sans-serif';
        const linkText = [
          profile.instagram ? `@${profile.instagram.replace(/^@/, '')}` : null,
          profile.linkedin ? 'LinkedIn' : null,
          profile.website ? profile.website.replace(/^https?:\/\//, '') : null
        ].filter(Boolean).join(' • ');
        ctx.fillText(linkText, width / 2, 1620);
      }

      // Footer
      ctx.fillStyle = '#09090b';
      ctx.font = '900 48px sans-serif';
      ctx.fillText('TOP ME IF YOU CAN.', width / 2, 1750);
      ctx.fillStyle = '#a1a1aa';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('lazy.lol', width / 2, 1810);

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
      ctx.fillText('LAZY • VERIFIED RANK', width / 2, 220);

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

      // Quote / Roast / Reason
      if (includeRoast && roast) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = '900 28px sans-serif';
        ctx.fillText('🔥 AI LAZY ROAST', width / 2, 1420);
        ctx.fillStyle = '#f4f4f5';
        ctx.font = 'italic 36px sans-serif';
        wrapText(ctx, `"${roast}"`, width / 2, 1480, width - 260, 48);
      } else if (profile.reason) {
        ctx.fillStyle = '#d4d4d8';
        ctx.font = 'italic 38px sans-serif';
        wrapText(ctx, `"${profile.reason}"`, width / 2, 1470, width - 260, 54);
      }

      // Links
      if (profile.instagram || profile.linkedin || profile.website) {
        ctx.fillStyle = '#e4e4e7';
        ctx.font = 'bold 36px sans-serif';
        const linkText = [
          profile.instagram ? `@${profile.instagram.replace(/^@/, '')}` : null,
          profile.linkedin ? 'LinkedIn' : null,
          profile.website ? profile.website.replace(/^https?:\/\//, '') : null
        ].filter(Boolean).join(' • ');
        ctx.fillText(linkText, width / 2, 1620);
      }

      // Footer
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 48px sans-serif';
      ctx.fillText('TOP ME IF YOU CAN.', width / 2, 1750);
      ctx.fillStyle = '#71717a';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('lazy.lol', width / 2, 1810);
    }

    if (onCardRendered) {
      try {
        onCardRendered(canvas.toDataURL('image/png'));
      } catch {
        // Ignored
      }
    }
  }, [profile, activeTemplate, roast, includeRoast]);

  // Helper function for canvas text wrapping
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
            className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
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
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 mb-3 text-xs font-semibold">
        <button
          type="button"
          onClick={() => onChangeTemplate('gold_winner')}
          className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
            activeTemplate === 'gold_winner'
              ? 'bg-amber-400 text-zinc-950 shadow-2xs font-bold'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          Gold Winner
        </button>
        <button
          type="button"
          onClick={() => onChangeTemplate('bold_dark')}
          className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
            activeTemplate === 'bold_dark'
              ? 'bg-zinc-950 text-white shadow-2xs font-bold'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          Dark Mode
        </button>
        <button
          type="button"
          onClick={() => onChangeTemplate('clean_white')}
          className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
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
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
        >
          <Download className="w-4 h-4" />
          <span>{downloading ? 'Exporting...' : 'Save 9:16 Image'}</span>
        </button>

        <button
          type="button"
          onClick={handleCopyImage}
          className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition-all active:scale-95 cursor-pointer border border-zinc-200"
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
