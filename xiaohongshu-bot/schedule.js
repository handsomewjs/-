const fs = require('fs');
const path = require('path');
const config = require('./config');
const { getNextBook } = require('./book-queue');
const { fetchBookData, downloadCover, slugify } = require('./book-fetcher');
const { generateContent } = require('./content-generator');
const { generateImages } = require('./image-generator');
const { buildPreviewHtml } = require('./preview-builder');

function getTodayDir() {
  const today = new Date().toISOString().split('T')[0];
  return path.join(config.postsDir, today);
}

async function main() {
  console.log('=== 小红书每日荐书机器人 ===');
  console.log(`开始时间：${new Date().toISOString()}\n`);

  // 1. Get next book from queue
  const book = getNextBook();
  if (!book) {
    console.error('书单已空！请编辑 books.json 添加新书后重新运行。');
    process.exit(1);
  }
  console.log(`[1/5] 选定书籍：《${book.title}》- ${book.author}`);

  // 2. Fetch book metadata
  console.log('[2/5] 获取图书数据...');
  const bookData = await fetchBookData(book);
  console.log(`  来源：${bookData.source}`);
  console.log(`  封面：${bookData.coverUrl || '无'}`);

  // 3. Create output directory
  const slug = slugify(book.title);
  const todayDir = getTodayDir();
  const postDir = path.join(todayDir, slug);
  const imagesDir = path.join(postDir, 'images');
  fs.mkdirSync(imagesDir, { recursive: true });

  // 4. Download cover
  const coverPath = await downloadCover(bookData.coverUrl, imagesDir);
  if (coverPath) {
    console.log(`  封面已下载：${coverPath}`);
  } else {
    console.log('  无封面可用，使用占位符');
  }

  // 5. Generate content
  console.log('[3/5] 生成内容...');
  const content = await generateContent(bookData);
  console.log(`  标题：${content.headline}`);
  console.log(`  名句：${content.quotes.length} 条`);

  // 6. Generate images
  console.log('[4/5] 生成图片...');
  const images = await generateImages(bookData, content, coverPath, imagesDir);
  console.log(`  生成 ${images.length} 张图片`);

  // 7. Save post.json
  const postData = {
    date: new Date().toISOString().split('T')[0],
    book: bookData,
    content,
    images: images.map(i => path.relative(postDir, i).replace(/\\/g, '/')),
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(postDir, 'post.json'),
    JSON.stringify(postData, null, 2),
    'utf-8'
  );

  // 8. Build preview
  console.log('[5/5] 构建预览页面...');
  const htmlPath = buildPreviewHtml(bookData, content, images, postDir);
  console.log(`  预览页面：${htmlPath}`);

  // Summary
  console.log('\n=== 生成完毕 ===');
  console.log(`目录：${postDir}`);
  console.log(`图片：${images.length} 张`);
  console.log(`预览：${htmlPath}`);
}

main().catch(err => {
  console.error('执行失败：', err);
  process.exit(1);
});
