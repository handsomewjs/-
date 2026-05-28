const fs = require('fs');
const path = require('path');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPreviewHtml(book, content, images, outputDir) {
  const imageRows = images.map((img, i) => {
    const relPath = path.relative(outputDir, img).replace(/\\/g, '/');
    return `
    <div class="slide">
      <img src="${relPath}" alt="图${i + 1}" loading="lazy">
      <span class="page-num">${i + 1}/${images.length}</span>
    </div>`;
  }).join('\n');

  const quotes = content.quotes || [];
  const tags = content.tags || [];

  const tagsHtml = tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>每日荐书 - ${escapeHtml(book.title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #1a1a1a;
    color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
  }
  .container { max-width: 540px; width: 100%; }
  h1 { font-size: 22px; margin: 20px 0 8px; color: #fff; text-align: center; }
  .meta { text-align: center; color: #e94560; margin-bottom: 24px; font-size: 15px; }
  .slide { position: relative; margin-bottom: 16px; border-radius: 12px; overflow: hidden; }
  .slide img { width: 100%; display: block; border-radius: 12px; }
  .page-num {
    position: absolute; bottom: 12px; right: 16px;
    background: rgba(0,0,0,0.6); color: #fff;
    padding: 4px 12px; border-radius: 20px; font-size: 13px;
  }

  .text-section {
    background: #222; border-radius: 12px; padding: 24px;
    margin: 20px 0;
  }
  .text-section h2 { font-size: 18px; color: #e94560; margin-bottom: 12px; }
  .text-section .review { font-size: 15px; line-height: 1.8; color: #ccc; white-space: pre-wrap; }
  .text-section .headline { font-size: 20px; font-weight: bold; color: #fff; margin-bottom: 16px; }

  .quotes-section {
    background: #222; border-radius: 12px; padding: 24px; margin: 20px 0;
  }
  .quotes-section h2 { font-size: 18px; color: #e9c46a; margin-bottom: 12px; }
  .quote-item {
    font-size: 15px; line-height: 1.6; color: #bbb;
    padding: 10px 0; border-bottom: 1px solid #333;
  }
  .quote-item:last-child { border-bottom: none; }

  .tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0; }
  .tag {
    background: #333; color: #e94560;
    padding: 6px 14px; border-radius: 20px; font-size: 13px;
  }

  .footer {
    text-align: center; color: #666; font-size: 13px;
    margin: 30px 0; padding: 20px 0; border-top: 1px solid #333;
  }
</style>
</head>
<body>
<div class="container">

  <h1>${escapeHtml(book.title)}</h1>
  <p class="meta">${escapeHtml(book.author)} 著 · ${new Date().toLocaleDateString('zh-CN')} 发布</p>

  <div class="text-section">
    <div class="headline">${escapeHtml(content.headline)}</div>
    <h2>📖 读后感</h2>
    <div class="review">${escapeHtml(content.review)}</div>
  </div>

  <div class="quotes-section">
    <h2>✒️ 名句摘抄</h2>
    ${quotes.map(q => `<div class="quote-item">"${escapeHtml(q)}"</div>`).join('\n')}
  </div>

  <div class="tags">${tagsHtml}</div>

  <h2 style="text-align:center;margin:24px 0 12px;font-size:18px;color:#fff;">🖼️ 发布图片预览</h2>
  ${imageRows}

  <div class="footer">
    每日荐书机器人 · 每晚 8 点更新<br>
    审核通过后可手动发布到小红书
  </div>

</div>
</body>
</html>`;

  const htmlPath = path.join(outputDir, 'index.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');
  return htmlPath;
}

module.exports = { buildPreviewHtml };
