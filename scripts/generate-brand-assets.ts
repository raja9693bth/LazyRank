import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const BRAND_DIR = path.resolve('public/brand');

if (!fs.existsSync(BRAND_DIR)) {
  fs.mkdirSync(BRAND_DIR, { recursive: true });
}

// Color System
const COLORS = {
  primaryCharcoal: '#20242C', // Deep Charcoal / Navy (#20242C)
  accentGold: '#F4C542',      // Signature LAZY Warm Butter / Amber Yellow (#F4C542)
  accentGoldHover: '#E0B232',
  surfaceLight: '#FAF9F5',    // Warm Off-White (#FAF9F5)
  surfaceDark: '#121418',     // Rich Deep Dark
  pureWhite: '#FFFFFF',
  textMuted: '#64748B'
};

// ==========================================
// 1. ICON ONLY SVG (32x32)
// Signature Warm Amber Gold Slouch Step
// ==========================================
function getIconSvg(color = COLORS.accentGold) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none">
  <!-- Ground Seat Bar (Slumped flat) -->
  <rect x="2" y="21" width="26" height="6" rx="3" fill="${color}"/>
  <!-- Reclining Slouch Diagonal -->
  <path d="M19.5 9.5L9.5 22.5" stroke="${color}" stroke-width="6.5" stroke-linecap="round"/>
  <!-- Rank #1 Golden Step (Offset right) -->
  <rect x="11" y="5" width="17" height="6" rx="3" fill="${color}"/>
</svg>`;
}

// ==========================================
// 2. WORDMARK ONLY SVG (92x32)
// ==========================================
function getWordmarkSvg(color = COLORS.primaryCharcoal) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 92 32" width="92" height="32" fill="none">
  <g transform="translate(0, 5)" fill="${color}">
    <!-- L -->
    <path d="M1 1H6.5V16.8H18V22H1V1Z"/>
    <!-- A -->
    <path d="M21 22L29.5 1H35.5L44 22H38.2L36.8 17.6H28.2L26.8 22H21ZM29.6 13.2H35.4L32.5 4.5L29.6 13.2Z"/>
    <!-- Z (Slouch Angle Signature) -->
    <path d="M47 1H63V5.8L54.8 16.8H63.5V22H46.5V17.2L54.8 6.2H47V1Z"/>
    <!-- Y -->
    <path d="M65.5 1H71.8L76.5 9.6L81.2 1H87.5L79.8 13.2V22H73.2V13.2L65.5 1Z"/>
  </g>
</svg>`;
}

// ==========================================
// 3. PRIMARY HORIZONTAL LOGO SVG (134x32)
// Icon = Warm Amber Gold (#F6C34A)
// Wordmark = Deep Charcoal (#20242C)
// ==========================================
function getHorizontalLogoSvg(iconColor = COLORS.accentGold, textColor = COLORS.primaryCharcoal) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 134 32" width="134" height="32" fill="none">
  <!-- ICON (32x32): Warm Amber Gold -->
  <g transform="translate(0, 0)">
    <rect x="2" y="21" width="26" height="6" rx="3" fill="${iconColor}"/>
    <path d="M19.5 9.5L9.5 22.5" stroke="${iconColor}" stroke-width="6.5" stroke-linecap="round"/>
    <rect x="11" y="5" width="17" height="6" rx="3" fill="${iconColor}"/>
  </g>
  <!-- WORDMARK: LAZY in Deep Charcoal -->
  <g transform="translate(38, 5)" fill="${textColor}">
    <!-- L -->
    <path d="M1 1H6.5V16.8H18V22H1V1Z"/>
    <!-- A -->
    <path d="M21 22L29.5 1H35.5L44 22H38.2L36.8 17.6H28.2L26.8 22H21ZM29.6 13.2H35.4L32.5 4.5L29.6 13.2Z"/>
    <!-- Z -->
    <path d="M47 1H63V5.8L54.8 16.8H63.5V22H46.5V17.2L54.8 6.2H47V1Z"/>
    <!-- Y -->
    <path d="M65.5 1H71.8L76.5 9.6L81.2 1H87.5L79.8 13.2V22H73.2V13.2L65.5 1Z"/>
  </g>
</svg>`;
}

// ==========================================
// 4. SOCIAL AVATAR / APP ICON SVG (512x512)
// ==========================================
function getSocialAvatarSvg(bg = COLORS.surfaceLight, iconColor = COLORS.accentGold) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
  <!-- Canvas Background -->
  <rect width="512" height="512" rx="104" fill="${bg}"/>
  <rect width="508" height="508" x="2" y="2" rx="102" stroke="#E2E8F0" stroke-width="4"/>
  
  <!-- Scaled Icon Center (32x32 scaled to 256x256 at offset 128, 128) -->
  <g transform="translate(128, 128) scale(8)">
    <rect x="2" y="21" width="26" height="6" rx="3" fill="${iconColor}"/>
    <path d="M19.5 9.5L9.5 22.5" stroke="${iconColor}" stroke-width="6.5" stroke-linecap="round"/>
    <rect x="11" y="5" width="17" height="6" rx="3" fill="${iconColor}"/>
  </g>
</svg>`;
}

// Dark Social Avatar
function getSocialAvatarDarkSvg() {
  return getSocialAvatarSvg(COLORS.surfaceDark, COLORS.accentGold);
}

async function exportAllAssets() {
  console.log('Generating refined LAZY Brand Identity suite (v1.2)...');

  // 1. Primary Horizontal Logo — SVG & Transparent PNG (Amber Gold Icon + Deep Charcoal Wordmark)
  const horizontalLightSvg = getHorizontalLogoSvg(COLORS.accentGold, COLORS.primaryCharcoal);
  fs.writeFileSync(path.join(BRAND_DIR, 'lazy-logo-primary.svg'), horizontalLightSvg);
  await sharp(Buffer.from(horizontalLightSvg))
    .resize(536, 128)
    .png()
    .toFile(path.join(BRAND_DIR, 'lazy-logo-primary.png'));

  // 2. Icon Only — SVG & Transparent PNG (Amber Gold #F6C34A)
  const iconLightSvg = getIconSvg(COLORS.accentGold);
  fs.writeFileSync(path.join(BRAND_DIR, 'lazy-icon.svg'), iconLightSvg);
  await sharp(Buffer.from(iconLightSvg))
    .resize(256, 256)
    .png()
    .toFile(path.join(BRAND_DIR, 'lazy-icon.png'));

  // 3. Wordmark Only — SVG & Transparent PNG (Deep Charcoal #20242C)
  const wordmarkSvg = getWordmarkSvg(COLORS.primaryCharcoal);
  fs.writeFileSync(path.join(BRAND_DIR, 'lazy-wordmark.svg'), wordmarkSvg);
  await sharp(Buffer.from(wordmarkSvg))
    .resize(368, 128)
    .png()
    .toFile(path.join(BRAND_DIR, 'lazy-wordmark.png'));

  // 4. Reversed / Dark-Background Version — SVG & Transparent PNG (Amber Gold Icon + White Wordmark)
  const horizontalDarkSvg = getHorizontalLogoSvg(COLORS.accentGold, COLORS.pureWhite);
  fs.writeFileSync(path.join(BRAND_DIR, 'lazy-logo-dark.svg'), horizontalDarkSvg);
  await sharp(Buffer.from(horizontalDarkSvg))
    .resize(536, 128)
    .png()
    .toFile(path.join(BRAND_DIR, 'lazy-logo-dark.png'));

  const iconDarkSvg = getIconSvg(COLORS.accentGold);
  fs.writeFileSync(path.join(BRAND_DIR, 'lazy-icon-dark.svg'), iconDarkSvg);
  await sharp(Buffer.from(iconDarkSvg))
    .resize(256, 256)
    .png()
    .toFile(path.join(BRAND_DIR, 'lazy-icon-dark.png'));

  // 5. One-Color / Monochrome Version (Solid Charcoal) — SVG & Transparent PNG
  const horizontalMonoSvg = getHorizontalLogoSvg(COLORS.primaryCharcoal, COLORS.primaryCharcoal);
  fs.writeFileSync(path.join(BRAND_DIR, 'lazy-logo-mono.svg'), horizontalMonoSvg);
  await sharp(Buffer.from(horizontalMonoSvg))
    .resize(536, 128)
    .png()
    .toFile(path.join(BRAND_DIR, 'lazy-logo-mono.png'));

  // 6. Favicon 512x512 SVG & PNG, plus 32x32, 16x16 (Amber Gold #F6C34A)
  const faviconSvg = getIconSvg(COLORS.accentGold);
  fs.writeFileSync(path.resolve('public/favicon.svg'), faviconSvg);
  
  await sharp(Buffer.from(faviconSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(BRAND_DIR, 'lazy-favicon-512.png'));
  
  await sharp(Buffer.from(faviconSvg))
    .resize(32, 32)
    .png()
    .toFile(path.resolve('public/favicon.png'));

  // 7. Social Avatar Square Version (512x512) — Light & Dark
  const avatarLightSvg = getSocialAvatarSvg(COLORS.surfaceLight, COLORS.accentGold);
  fs.writeFileSync(path.join(BRAND_DIR, 'lazy-avatar-light.svg'), avatarLightSvg);
  await sharp(Buffer.from(avatarLightSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(BRAND_DIR, 'lazy-avatar-light.png'));

  const avatarDarkSvg = getSocialAvatarDarkSvg();
  fs.writeFileSync(path.join(BRAND_DIR, 'lazy-avatar-dark.svg'), avatarDarkSvg);
  await sharp(Buffer.from(avatarDarkSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(BRAND_DIR, 'lazy-avatar-dark.png'));

  // Clean up scratch test files if any
  try {
    if (fs.existsSync('public/brand/test-refined-preview.png')) {
      fs.unlinkSync('public/brand/test-refined-preview.png');
    }
  } catch {}

  console.log('Successfully updated all LAZY Brand Identity assets (v1.2)!');
}

exportAllAssets().catch(console.error);
