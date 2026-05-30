const fs = require('fs');
const path = require('path');
const config = require('./config');

async function fetchFromGoogleBooks(title, author) {
  const query = author ? `${title}+inauthor:${author}` : title;
  let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&langRestrict=zh&maxResults=3`;
  // Only append key if configured — empty key breaks the request
  if (config.googleBooksApiKey) {
    url += `&key=${config.googleBooksApiKey}`;
  }

  console.log(`  [GoogleBooks] 查询: ${query}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Google Books API error: ${res.status}`);
  const data = await res.json();
  if (!data.items || data.items.length === 0) {
    console.log('  [GoogleBooks] 无结果');
    return null;
  }

  const volume = data.items[0].volumeInfo;
  return {
    title: volume.title,
    author: volume.authors ? volume.authors.join('、') : '未知',
    coverUrl: volume.imageLinks
      ? (volume.imageLinks.thumbnail || '').replace('http://', 'https://')
      : '',
    description: volume.description || '暂无简介',
    publisher: volume.publisher || '未知',
    year: volume.publishedDate ? volume.publishedDate.substring(0, 4) : '未知',
    isbn: volume.industryIdentifiers
      ? volume.industryIdentifiers.map(i => i.identifier).join(', ')
      : '',
    source: 'google_books',
  };
}

async function fetchFromOpenLibrary(title, author) {
  const query = author ? `${title} ${author}` : title;
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=3`;

  console.log(`  [OpenLibrary] 查询: ${query}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`OpenLibrary API error: ${res.status}`);
  const data = await res.json();
  if (!data.docs || data.docs.length === 0) return null;

  const doc = data.docs[0];
  return {
    title: doc.title || title,
    author: doc.author_name ? doc.author_name.join('、') : (author || '未知'),
    coverUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      : '',
    description: doc.first_sentence
      ? (Array.isArray(doc.first_sentence) ? doc.first_sentence.join(' ') : doc.first_sentence)
      : '暂无简介',
    publisher: doc.publisher ? doc.publisher[0] : '未知',
    year: doc.first_publish_year ? String(doc.first_publish_year) : '未知',
    isbn: doc.isbn ? doc.isbn[0] : '',
    source: 'openlibrary',
  };
}

async function fetchFromDouban(title, author) {
  const query = author ? `${title} ${author}` : title;
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

  console.log(`  [Douban] 搜索: ${query}`);
  try {
    // Step 1: Search for the book
    const searchUrl = `https://www.douban.com/search?q=${encodeURIComponent(query)}&cat=1001`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(10000), headers });
    if (!searchRes.ok) {
      console.log(`  [Douban] 搜索返回 ${searchRes.status}`);
      return null;
    }
    const searchHtml = await searchRes.text();

    // Try multiple regex patterns to find the subject ID
    let subjectId = null;
    let coverUrl = '';

    const idPatterns = [
      /https:\/\/book\.douban\.com\/subject\/(\d+)\//,
      /\/subject\/(\d+)\//,
      /sid:\s*(\d+)/,
    ];
    for (const pat of idPatterns) {
      const m = searchHtml.match(pat);
      if (m) { subjectId = m[1]; break; }
    }

    if (!subjectId) {
      console.log(`  [Douban] 未找到书籍ID`);
      return null;
    }
    console.log(`  [Douban] 找到 Subject ID: ${subjectId}`);

    // Try to get cover from search results first
    const imgMatch = searchHtml.match(/src="(https:\/\/img\d+\.doubanio\.com\/view\/subject\/[lms]\/public\/[^"]+)"/);
    if (imgMatch) {
      coverUrl = imgMatch[1].replace(/\/[ms]\//, '/l/');
      console.log(`  [Douban] 搜索页找到封面`);
    }

    // Step 2: Fetch subject page for cover + metadata
    const subjectUrl = `https://book.douban.com/subject/${subjectId}/`;
    const subRes = await fetch(subjectUrl, { signal: AbortSignal.timeout(10000), headers });
    if (subRes.ok) {
      const subHtml = await subRes.text();

      // Cover image from subject page
      if (!coverUrl) {
        const subImg = subHtml.match(/src="(https:\/\/img\d+\.doubanio\.com\/view\/subject\/[lms]\/public\/[^"]+)"/);
        if (subImg) coverUrl = subImg[1].replace(/\/[ms]\//, '/l/');
      }

      // Description
      let description = '';
      const descPatterns = [
        /<span\s+class="all\s*hidden">\s*<div\s+class="intro">\s*<p>([\s\S]*?)<\/p>/,
        /<div\s+class="intro">\s*<p>([\s\S]*?)<\/p>/,
        /<meta\s+name="description"\s+content="([^"]+)"/,
      ];
      for (const pat of descPatterns) {
        const m = subHtml.match(pat);
        if (m) { description = m[1].replace(/<[^>]+>/g, '').trim().slice(0, 500); break; }
      }

      // Author from subject page
      if (!author || author === '') {
        const authorMatch = subHtml.match(/<span\s+class="pl">\s*作者[\s\S]*?<a\s+[^>]*>([^<]+)<\/a>/);
        if (authorMatch) author = authorMatch[1].trim();
      }

      // Publisher info
      const pubMatch = subHtml.match(/出版社:\s*<\/span>\s*([^<\n]+)/);
      const publisher = pubMatch ? pubMatch[1].trim() : '';

      const yearMatch = subHtml.match(/出版年:\s*<\/span>\s*([^<\n]+)/);
      const year = yearMatch ? yearMatch[1].trim() : '';

      if (coverUrl) console.log(`  [Douban] 详情页获取封面成功`);

      return {
        title,
        author: author || '未知',
        coverUrl,
        description: description || '',
        publisher,
        year,
        isbn: subjectId,
        source: 'douban',
      };
    }

    // Subject page failed, return what we have from search
    return {
      title,
      author: author || '未知',
      coverUrl,
      description: '',
      publisher: '',
      year: '',
      isbn: subjectId,
      source: 'douban',
    };
  } catch (err) {
    console.log(`  [Douban] 失败: ${err.message}`);
    return null;
  }
}

function buildFallbackData(book) {
  return {
    title: book.title,
    author: book.author || '未知',
    coverUrl: '',
    description: '',
    publisher: '未知',
    year: '未知',
    isbn: '',
    source: 'fallback',
  };
}

function slugify(text) {
  return text.replace(/[^\w一-鿿]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}

async function downloadCover(url, destDir) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = url.match(/\.(jpg|jpeg|png)/i)?.[1] || 'jpg';
    const filepath = path.join(destDir, `cover.${ext}`);
    await fs.promises.writeFile(filepath, buf);
    return filepath;
  } catch {
    return null;
  }
}

async function fetchBookData(book) {
  const { title, author } = book;

  // Try all sources in parallel, collect results
  const sources = [
    { name: 'GoogleBooks', fn: () => fetchFromGoogleBooks(title, author) },
    { name: 'OpenLibrary', fn: () => fetchFromOpenLibrary(title, author) },
    { name: 'Douban', fn: () => fetchFromDouban(title, author) },
  ];

  const results = await Promise.allSettled(
    sources.map(async (s) => {
      try {
        const r = await s.fn();
        if (r) console.log(`  [${s.name}] 封面: ${r.coverUrl ? '有' : '无'}, 简介: ${(r.description || '').length}字`);
        return r;
      } catch (err) {
        console.log(`  [${s.name}] 错误: ${err.message}`);
        return null;
      }
    })
  );

  const data = results.map(r => r.value).filter(Boolean);

  // Pick best: has cover > has description > first result
  const best = data.find(d => d.coverUrl) || data.find(d => d.description) || data[0];

  if (best) {
    console.log(`  -> 选用: ${best.source}${best.coverUrl ? ' (有封面)' : ''}`);
    return best;
  }

  console.log('  所有来源均无结果，使用 fallback');
  return buildFallbackData(book);
}

module.exports = { fetchBookData, downloadCover, slugify };
