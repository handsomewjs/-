const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const config = require('./config');

const { imageWidth: W, imageHeight: H } = config;

// Color palettes for different visual styles
const PALETTES = [
  { bg: '#1a1a2e', accent: '#e94560', text: '#eee', light: '#16213e' },
  { bg: '#0f3460', accent: '#e94560', text: '#f5f5f5', light: '#1a1a40' },
  { bg: '#2d3436', accent: '#fdcb6e', text: '#ffeaa7', light: '#3d3d3d' },
  { bg: '#faf3e0', accent: '#e07a5f', text: '#3d405b', light: '#f4f1de' },
  { bg: '#264653', accent: '#e9c46a', text: '#fefae0', light: '#2a9d8f' },
  { bg: '#1b1b2f', accent: '#bbe1fa', text: '#e4e4e4', light: '#162447' },
];

function pickPalette() {
  return PALETTES[Math.floor(Math.random() * PALETTES.length)];
}

function wrapText(text, maxChars) {
  const result = [];
  for (let i = 0; i < text.length; i += maxChars) {
    result.push(text.slice(i, i + maxChars));
  }
  return result;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// SVG for cover card: book cover + title + author + quote
function buildCoverSvg(book, content, coverPath) {
  const p = pickPalette();
  const escapedTitle = escapeXml(book.title);
  const escapedAuthor = escapeXml(book.author);
  const quote = content.quotes ? content.quotes[0] : '';
  const displayQuote = quote.length > 30 ? quote.slice(0, 30) + '...' : quote;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.bg}"/>
      <stop offset="100%" stop-color="${p.light}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#grad)"/>

  <!-- Cover image placeholder -->
  <rect x="240" y="160" width="600" height="840" rx="12" fill="#2a2a3a" opacity="0.5"/>
  ${coverPath
    ? `<image href="file://${path.resolve(coverPath).replace(/\\/g, '/')}" x="260" y="180" width="560" height="800" preserveAspectRatio="xMidYMid slice"/>`
    : `<text x="540" y="600" text-anchor="middle" font-family="'Noto Sans CJK SC', sans-serif" font-size="64" fill="#555">📚</text>`}

  <!-- Book title -->
  <text x="540" y="1100" text-anchor="middle" font-family="'Noto Sans CJK SC', sans-serif" font-size="48" font-weight="bold" fill="${p.text}">${escapedTitle}</text>

  <!-- Author -->
  <text x="540" y="1170" text-anchor="middle" font-family="'Noto Sans CJK SC', sans-serif" font-size="32" fill="${p.accent}">${escapedAuthor} 著</text>

  <!-- Quote preview -->
  <text x="540" y="1260" text-anchor="middle" font-family="'Noto Sans CJK SC', sans-serif" font-size="26" fill="${p.text}" opacity="0.6">"${escapeXml(displayQuote)}"</text>

  <!-- Brand badge -->
  <rect x="340" y="1330" width="400" height="50" rx="25" fill="${p.accent}" opacity="0.15"/>
  <text x="540" y="1363" text-anchor="middle" font-family="'Noto Sans CJK SC', sans-serif" font-size="22" fill="${p.accent}">每日荐书 · 关注我每天一本好书</text>
</svg>`;
}

// SVG for quote card: single quote with elegant typography
function buildQuoteSvg(quote, index, total) {
  const p = pickPalette();
  const qLines = wrapText(quote, 16);
  const yStart = H / 2 - (qLines.length - 1) * 35;

  const quoteTextEls = qLines.map((line, i) =>
    `<text x="540" y="${yStart + i * 70}" text-anchor="middle" font-family="'Noto Sans CJK SC', sans-serif" font-size="42" font-weight="bold" fill="${p.text}">${escapeXml(line)}</text>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.bg}"/>
      <stop offset="100%" stop-color="${p.light}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#grad)"/>

  <!-- Decorative top line -->
  <line x1="340" y1="${yStart - 80}" x2="740" y2="${yStart - 80}" stroke="${p.accent}" stroke-width="3" opacity="0.6"/>

  <!-- Opening quote mark -->
  <text x="540" y="${yStart - 120}" text-anchor="middle" font-family="'Noto Serif CJK SC', serif" font-size="100" fill="${p.accent}" opacity="0.25">"</text>

  ${quoteTextEls}

  <!-- Card number -->
  <text x="540" y="1350" text-anchor="middle" font-family="'Noto Sans CJK SC', sans-serif" font-size="20" fill="${p.text}" opacity="0.25">${index} / ${total}</text>
</svg>`;
}

// SVG for follow/end card
function buildFollowSvg(bookTitle) {
  const p = pickPalette();
  const escapedTitle = escapeXml(bookTitle);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.bg}"/>
      <stop offset="100%" stop-color="${p.light}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#grad)"/>

  <text x="540" y="520" text-anchor="middle" font-family="'Noto Sans CJK SC', sans-serif" font-size="72" fill="${p.accent}">📖</text>
  <text x="540" y="620" text-anchor="middle" font-family="'Noto Sans CJK SC', sans-serif" font-size="36" font-weight="bold" fill="${p.text}">今天的好书就推荐到这里</text>
  <text x="540" y="690" text-anchor="middle" font-family="'Noto Sans CJK SC', sans-serif" font-size="26" fill="${p.text}" opacity="0.7">如果你也读过《${escapedTitle}》</text>
  <text x="540" y="740" text-anchor="middle" font-family="'Noto Sans CJK SC', sans-serif" font-size="26" fill="${p.text}" opacity="0.7">欢迎在评论区聊聊你的感受</text>

  <rect x="270" y="840" width="540" height="70" rx="35" fill="${p.accent}" opacity="0.12"/>
  <text x="540" y="885" text-anchor="middle" font-family="'Noto Sans CJK SC', sans-serif" font-size="36" font-weight="bold" fill="${p.accent}">关注我 · 每天一本好书</text>

  <text x="540" y="960" text-anchor="middle" font-family="'Noto Sans CJK SC', sans-serif" font-size="22" fill="${p.text}" opacity="0.3">每晚 8 点更新</text>
</svg>`;
}

async function renderSvgToPng(svgContent, outputPath) {
  await sharp(Buffer.from(svgContent))
    .png({ compressionLevel: 6 })
    .toFile(outputPath);
}

async function generateImages(bookData, content, coverPath, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const images = [];

  try {
    // 1. Cover card
    const coverSvg = buildCoverSvg(bookData, content, coverPath);
    const coverOut = path.join(outputDir, '01-cover.png');
    await renderSvgToPng(coverSvg, coverOut);
    images.push(coverOut);
  } catch (err) {
    console.error('Failed to generate cover card:', err.message);
  }

  // 2. Quote cards (up to maxQuotes)
  const quoteArr = content.quotes || [];
  const quoteCount = Math.min(quoteArr.length, config.maxQuotes);
  const totalCards = quoteCount + 2; // cover + quotes + follow

  for (let i = 0; i < quoteCount; i++) {
    try {
      const num = String(i + 2).padStart(2, '0');
      const quoteSvg = buildQuoteSvg(quoteArr[i], i + 2, totalCards);
      const quoteOut = path.join(outputDir, `${num}-quote.png`);
      await renderSvgToPng(quoteSvg, quoteOut);
      images.push(quoteOut);
    } catch (err) {
      console.error(`Failed to generate quote card ${i + 1}:`, err.message);
    }
  }

  // 3. Follow card
  try {
    const num = String(quoteCount + 2).padStart(2, '0');
    const followSvg = buildFollowSvg(bookData.title);
    const followOut = path.join(outputDir, `${num}-end.png`);
    await renderSvgToPng(followSvg, followOut);
    images.push(followOut);
  } catch (err) {
    console.error('Failed to generate follow card:', err.message);
  }

  return images;
}

module.exports = { generateImages };
