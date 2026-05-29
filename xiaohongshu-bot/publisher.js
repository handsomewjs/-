const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const config = require('./config');

const CREATOR_URL = 'https://creator.xiaohongshu.com';
const PUBLISH_URL = 'https://creator.xiaohongshu.com/publish/publish';
const USER_DATA_DIR = path.join(__dirname, '.browser-data2');
const SCREENSHOT_DIR = path.join(__dirname, '.debug-screenshots');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function publish() {
  console.log('=== 小红书发布助手 ===\n');

  // Find today's post
  const today = new Date().toISOString().split('T')[0];
  const todayDir = path.join(config.postsDir, today);

  if (!fs.existsSync(todayDir)) {
    console.error('找不到今天的帖子，请先运行 node schedule.js');
    process.exit(1);
  }

  const dirs = fs.readdirSync(todayDir, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);
  if (dirs.length === 0) { console.error('帖子目录为空'); process.exit(1); }

  const bookDir = path.join(todayDir, dirs[0]);
  const postJson = JSON.parse(fs.readFileSync(path.join(bookDir, 'post.json'), 'utf-8'));
  const imagesDir = path.join(bookDir, 'images');
  const imageFiles = fs.readdirSync(imagesDir)
    .filter(f => f.endsWith('.png'))
    .sort()
    .map(f => path.join(imagesDir, f));

  console.log(`书名：《${postJson.book.title}》`);
  console.log(`标题：${postJson.content.headline}`);
  console.log(`图片：${imageFiles.length} 张\n`);

  // Build the post body text
  const postBody = `${postJson.content.review}`;

  // Copy body to clipboard using clip command
  try {
    exec(`echo ${JSON.stringify(postBody)} | clip`, { shell: 'powershell.exe' });
    console.log('✓ 正文已复制到剪贴板\n');
  } catch {}

  // Launch browser
  console.log('启动浏览器...');
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1400, height: 900 },
    args: ['--no-sandbox'],
  });

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  await page.goto(CREATOR_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await sleep(3000);

  const url = page.url();
  console.log(`当前页面：${url}\n`);

  // Handle login
  if (url.includes('/login')) {
    console.log('========================================');
    console.log('  请在浏览器中用小红书 APP 扫码登录');
    console.log('========================================\n');
    await page.waitForFunction(() => {
      const u = window.location.href;
      return !u.includes('/login');
    }, { timeout: 180000 });
    console.log('登录成功！\n');
    await sleep(2000);
  }

  // Navigate to publish page
  console.log('正在打开发布页面...');
  await page.goto(PUBLISH_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await sleep(5000);

  // Click "上传图文" to switch from video mode to image mode
  // Use page.evaluate to click via JS since the sidebar element is outside Playwright's viewport
  const clicked = await page.evaluate(() => {
    const all = [...document.querySelectorAll('span')];
    const target = all.find(s => s.textContent.trim() === '上传图文');
    if (target) { target.click(); return true; }
    return false;
  });
  if (clicked) {
    console.log('✓ 切换到图文模式');
    await sleep(3000);
  } else {
    console.log('未找到"上传图文"按钮，尝试直接上传');
  }

  // Try auto-upload images — look for image-specific file input
  console.log('尝试自动上传图片...');
  const fileInput = page.locator('input[type="file"]').last();
  const allFileInputs = await page.locator('input[type="file"]').count();
  console.log(`找到 ${allFileInputs} 个文件输入框`);

  if (allFileInputs > 0) {
    // Try each file input
    const inputs = page.locator('input[type="file"]');
    for (let i = 0; i < allFileInputs; i++) {
      try {
        const inp = inputs.nth(i);
        const accept = await inp.getAttribute('accept');
        console.log(`  输入框 ${i}: accept="${accept || '无'}"`);
        // Skip video-only inputs
        if (accept && accept.includes('mp4')) continue;
        await inp.setInputFiles(imageFiles);
        console.log(`✓ 使用输入框 ${i} 上传 ${imageFiles.length} 张图片`);
        await sleep(10000);
        break;
      } catch (err) {
        // Try single file as fallback
        try {
          const inp = inputs.nth(i);
          await inp.setInputFiles(imageFiles[0]);
          console.log(`✓ 使用输入框 ${i} 上传第一张图片`);
          await sleep(3000);
          // Upload remaining individually
          for (let j = 1; j < imageFiles.length; j++) {
            try {
              const inp2 = page.locator('input[type="file"]').nth(i);
              await inp2.setInputFiles(imageFiles[j]);
              await sleep(1000);
            } catch {}
          }
          console.log('  图片上传完成');
          await sleep(5000);
          break;
        } catch {}
      }
    }
  } else {
    console.log('未找到文件上传入口，请手动拖入图片');
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'publish.png') });

  // === Auto-fill title ===
  console.log('\n尝试自动填写标题...');
  try {
    const titleInputs = page.locator('[placeholder*="标题"], [placeholder*="title"], input[type="text"]');
    const titleCount = await titleInputs.count();
    console.log(`  找到 ${titleCount} 个可能的标题输入框`);
    for (let i = 0; i < titleCount; i++) {
      const inp = titleInputs.nth(i);
      try {
        await inp.click({ force: true, timeout: 3000 });
        await sleep(500);
        await inp.fill(postJson.content.headline);
        console.log(`  ✓ 使用输入框 ${i} 填写标题`);
        break;
      } catch {}
    }
  } catch (err) {
    console.log(`  标题填写失败: ${err.message}`);
  }

  // === Auto-fill body ===
  console.log('尝试自动填写正文...');
  // Append tags to body so they appear as inline hashtags
  const fullBody = postBody + '\n\n' + postJson.content.tags.join(' ');
  try {
    const filled = await page.evaluate((body) => {
      const editables = document.querySelectorAll('[contenteditable="true"]');
      let best = null, bestArea = 0;
      for (const el of editables) {
        const rect = el.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > bestArea && rect.width > 200 && rect.height > 100) {
          bestArea = area;
          best = el;
        }
      }
      if (best) {
        best.focus();
        best.textContent = body;
        best.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    }, fullBody);

    if (filled) {
      console.log('  ✓ 正文已填入 contenteditable 编辑器（含标签）');
    } else {
      const textareas = page.locator('textarea');
      const taCount = await textareas.count();
      for (let i = 0; i < taCount; i++) {
        try {
          await textareas.nth(i).fill(fullBody);
          console.log(`  ✓ 使用 textarea ${i} 填写正文`);
          break;
        } catch {}
      }
    }
  } catch (err) {
    console.log(`  正文填写失败: ${err.message}`);
  }

  // === Auto-add topics via "添加话题" link ===
  console.log('尝试添加话题标签...');
  try {
    // Try clicking "添加话题" text
    const addTopic = await page.evaluate(() => {
      const all = [...document.querySelectorAll('span, div')];
      const target = all.find(el => el.textContent.trim() === '添加话题' && el.getBoundingClientRect().width > 0);
      if (target) { target.click(); return true; }
      return false;
    });
    if (addTopic) {
      console.log('  ✓ 已点击"添加话题"');
      await sleep(2000);

      // Look for the search input that appeared
      const searchInput = page.locator('input[placeholder*="搜索"], input[type="text"]').last();
      if (await searchInput.count() > 0) {
        for (const tag of postJson.content.tags) {
          try {
            await searchInput.fill(tag);
            await sleep(1200);
            await searchInput.press('Enter');
            await sleep(800);
            console.log(`  ✓ 添加标签: ${tag}`);
          } catch (err) {
            console.log(`  标签 "${tag}" 失败: ${err.message}`);
          }
        }
      }
    } else {
      console.log('  未找到"添加话题"，标签已包含在正文中');
    }
  } catch (err) {
    console.log(`  话题标签（已含在正文中）`);
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'filled.png') });

  // === Try to click publish ===
  console.log('\n尝试点击发布按钮...');

  // Monitor network requests to detect publish API call
  let publishApiCalled = false;
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('publish') || url.includes('note') || url.includes('create') || url.includes('save')) {
      if (req.method() === 'POST') {
        console.log(`  >> API: ${req.method()} ${url.slice(0, 120)}`);
        publishApiCalled = true;
      }
    }
  });
  page.on('response', (res) => {
    const url = res.url();
    if ((url.includes('publish') || url.includes('note') || url.includes('create')) && res.request().method() === 'POST') {
      console.log(`  << Response: ${res.status()} ${url.slice(0, 100)}`);
    }
  });

  try {
    // Find and click the actual "发布" button within xhs-publish-btn
    // The component has multiple buttons — we target by visible text
    const clicked = await page.evaluate(() => {
      const host = document.querySelector('xhs-publish-btn');
      if (!host) return 'no-host';
      const shadow = host.shadowRoot;
      const root = shadow || host;

      // Strategy 1: find button whose text is exactly "发布"
      const buttons = root.querySelectorAll('button, a, div[role="button"], span[role="button"]');
      for (const btn of buttons) {
        if (btn.textContent.trim() === '发布') {
          btn.click();
          return 'clicked';
        }
      }

      // Strategy 2: find any element with exact text "发布" inside the host
      const all = root.querySelectorAll('*');
      for (const el of all) {
        if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 && el.textContent.trim() === '发布') {
          el.click();
          return 'clicked-deep';
        }
      }

      return 'not-found';
    });
    console.log(`  发布按钮: ${clicked}`);

    await sleep(4000);

    if (publishApiCalled) {
      console.log('✓ 发布 API 已调用成功！');
    } else {
      console.log('（发布请求可能未触发，请检查截图确认）');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'published.png') });
  } catch (err) {
    console.log(`发布点击失败: ${err.message}`);
  }

  // Display final status
  console.log('\n========================================');
  console.log('  自动填写完成，请检查内容');
  console.log('========================================\n');
  console.log(`标题：${postJson.content.headline}`);
  console.log(`标签：${postJson.content.tags.join('  ')}\n`);
  console.log('========================================');
  console.log('浏览器窗口将保持打开 2 分钟');
  console.log('========================================\n');

  await sleep(120000);
  await context.close();
}

publish().catch(err => {
  console.error('失败:', err.message);
  console.error(err.stack);
  process.exit(1);
});
