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
  const displayQuote = quote.length > 40 ? quote.slice(0, 40) + '...' : quote;

  // Title sizing: longer titles use smaller font
  const titleLen = book.title.length;
  const titleFontSize = titleLen > 6 ? 52 : titleLen > 4 ? 64 : 80;
  const titleLines = wrapText(book.title, 8);
  const titleY = H * 0.32;
  const titleBlockHeight = titleLines.length * (titleFontSize + 10);

  const titleEls = titleLines.map((line, i) =>
    '<text x="540" y="' + (titleY + i * (titleFontSize + 16)) + '" text-anchor="middle" font-family="\'Noto Serif CJK SC\', serif" font-size="' + titleFontSize + '" font-weight="bold" fill="' + p.text + '">' + escapeXml(line) + '</text>'
  ).join('\n');

  const coverExists = coverPath && fs.existsSync(coverPath);

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
'<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">\n' +
'  <defs>\n' +
'    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">\n' +
'      <stop offset="0%" stop-color="' + p.bg + '"/>\n' +
'      <stop offset="100%" stop-color="' + p.light + '"/>\n' +
'    </linearGradient>\n' +
'    <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">\n' +
'      <stop offset="0%" stop-color="' + p.accent + '"/>\n' +
'      <stop offset="100%" stop-color="' + p.accent + '" stop-opacity="0.3"/>\n' +
'    </linearGradient>\n' +
'  </defs>\n' +
'  <rect width="' + W + '" height="' + H + '" fill="url(#bgGrad)"/>\n' +
'\n' +
(coverExists
  ? '  <image href="file://' + path.resolve(coverPath).replace(/\\/g, '/') + '" x="0" y="0" width="' + W + '" height="' + H + '" preserveAspectRatio="xMidYMid slice"/>\n' +
    '  <rect width="' + W + '" height="' + H + '" fill="#000" opacity="0.5"/>\n' +
    '  <text x="540" y="' + titleY + '" text-anchor="middle" font-family="\'Noto Serif CJK SC\', serif" font-size="' + titleFontSize + '" font-weight="bold" fill="#fff">' + escapedTitle + '</text>\n' +
    '  <text x="540" y="' + (titleY + titleFontSize + 30) + '" text-anchor="middle" font-family="\'Noto Sans CJK SC\', sans-serif" font-size="28" fill="#ccc">' + escapedAuthor + ' 著</text>\n'
  : '  <!-- Text-only cover design -->\n' +
    '  <rect x="140" y="' + (titleY - 150) + '" width="800" height="5" fill="url(#accentGrad)" rx="2"/>\n' +
    '  <rect x="70" y="' + (titleY - 130) + '" width="940" height="' + (titleBlockHeight + 160) + '" rx="16" fill="' + p.bg + '" opacity="0.35"/>\n' +
    '  ' + titleEls + '\n' +
    '  <line x1="240" y1="' + (titleY + titleBlockHeight + 20) + '" x2="840" y2="' + (titleY + titleBlockHeight + 20) + '" stroke="' + p.accent + '" stroke-width="2" opacity="0.6"/>\n' +
    '  <text x="540" y="' + (titleY + titleBlockHeight + 60) + '" text-anchor="middle" font-family="\'Noto Sans CJK SC\', sans-serif" font-size="28" fill="' + p.text + '" opacity="0.8">' + escapedAuthor + ' 著</text>\n'
) +
'\n' +
'  <!-- Divider -->\n' +
'  <rect x="240" y="1220" width="600" height="1" fill="' + p.accent + '" opacity="0.2"/>\n' +
'  <!-- Quote preview -->\n' +
'  <text x="540" y="1270" text-anchor="middle" font-family="\'Noto Sans CJK SC\', sans-serif" font-size="24" fill="' + p.text + '" opacity="0.45">"' + escapeXml(displayQuote) + '"</text>\n' +
'\n' +
'  <!-- Brand badge -->\n' +
'  <rect x="340" y="1320" width="400" height="48" rx="24" fill="' + p.accent + '" opacity="0.12"/>\n' +
'  <text x="540" y="1352" text-anchor="middle" font-family="\'Noto Sans CJK SC\', sans-serif" font-size="20" fill="' + p.accent + '">每日荐书 · 关注我每天一本好书</text>\n' +
'</svg>';
}

// SVG for quote card: single quote with elegant typography
function buildQuoteSvg(quote, index, total) {
  const p = pickPalette();
  const qLines = wrapText(quote, 16);
  const yStart = H / 2 - (qLines.length - 1) * 35;

  const quoteTextEls = qLines.map((line, i) =>
    '<text x="540" y="' + (yStart + i * 70) + '" text-anchor="middle" font-family="\'Noto Sans CJK SC\', sans-serif" font-size="42" font-weight="bold" fill="' + p.text + '">' + escapeXml(line) + '</text>'
  ).join('\n');

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
'<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">\n' +
'  <defs>\n' +
'    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">\n' +
'      <stop offset="0%" stop-color="' + p.bg + '"/>\n' +
'      <stop offset="100%" stop-color="' + p.light + '"/>\n' +
'    </linearGradient>\n' +
'  </defs>\n' +
'  <rect width="' + W + '" height="' + H + '" fill="url(#grad)"/>\n' +
'\n' +
'  <line x1="340" y1="' + (yStart - 80) + '" x2="740" y2="' + (yStart - 80) + '" stroke="' + p.accent + '" stroke-width="3" opacity="0.6"/>\n' +
'  <text x="540" y="' + (yStart - 120) + '" text-anchor="middle" font-family="\'Noto Serif CJK SC\', serif" font-size="100" fill="' + p.accent + '" opacity="0.25">"</text>\n' +
'\n' +
'  ' + quoteTextEls + '\n' +
'\n' +
'  <text x="540" y="1350" text-anchor="middle" font-family="\'Noto Sans CJK SC\', sans-serif" font-size="20" fill="' + p.text + '" opacity="0.25">' + index + ' / ' + total + '</text>\n' +
'</svg>';
}

// SVG for follow/end card
function buildFollowSvg(bookTitle) {
  const p = pickPalette();
  const escapedTitle = escapeXml(bookTitle);

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
'<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">\n' +
'  <defs>\n' +
'    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">\n' +
'      <stop offset="0%" stop-color="' + p.bg + '"/>\n' +
'      <stop offset="100%" stop-color="' + p.light + '"/>\n' +
'    </linearGradient>\n' +
'  </defs>\n' +
'  <rect width="' + W + '" height="' + H + '" fill="url(#grad)"/>\n' +
'\n' +
'  <text x="540" y="520" text-anchor="middle" font-family="\'Noto Sans CJK SC\', sans-serif" font-size="72" fill="' + p.accent + '">📖</text>\n' +
'  <text x="540" y="620" text-anchor="middle" font-family="\'Noto Sans CJK SC\', sans-serif" font-size="36" font-weight="bold" fill="' + p.text + '">今天的好书就推荐到这里</text>\n' +
'  <text x="540" y="690" text-anchor="middle" font-family="\'Noto Sans CJK SC\', sans-serif" font-size="26" fill="' + p.text + '" opacity="0.7">如果你也读过《' + escapedTitle + '》</text>\n' +
'  <text x="540" y="740" text-anchor="middle" font-family="\'Noto Sans CJK SC\', sans-serif" font-size="26" fill="' + p.text + '" opacity="0.7">欢迎在评论区聊聊你的感受</text>\n' +
'\n' +
'  <rect x="270" y="840" width="540" height="70" rx="35" fill="' + p.accent + '" opacity="0.12"/>\n' +
'  <text x="540" y="885" text-anchor="middle" font-family="\'Noto Sans CJK SC\', sans-serif" font-size="36" font-weight="bold" fill="' + p.accent + '">关注我 · 每天一本好书</text>\n' +
'\n' +
'  <text x="540" y="960" text-anchor="middle" font-family="\'Noto Sans CJK SC\', sans-serif" font-size="22" fill="' + p.text + '" opacity="0.3">每晚 8 点更新</text>\n' +
'</svg>';
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
      const quoteOut = path.join(outputDir, num + '-quote.png');
      await renderSvgToPng(quoteSvg, quoteOut);
      images.push(quoteOut);
    } catch (err) {
      console.error('Failed to generate quote card ' + (i + 1) + ':', err.message);
    }
  }

  // 3. Follow card
  try {
    const num = String(quoteCount + 2).padStart(2, '0');
    const followSvg = buildFollowSvg(bookData.title);
    const followOut = path.join(outputDir, num + '-end.png');
    await renderSvgToPng(followSvg, followOut);
    images.push(followOut);
  } catch (err) {
    console.error('Failed to generate follow card:', err.message);
  }

  return images;
}

module.exports = { generateImages };
