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
  const url = `https://www.douban.com/search?q=${encodeURIComponent(query)}&cat=1001`;

  console.log(`  [Douban] 搜索: ${query}`);
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract book URL from search results
    const bookMatch = html.match(/https:\/\/book\.douban\.com\/subject\/(\d+)\//);
    if (!bookMatch) return null;

    const subjectId = bookMatch[1];
    // Cover image is often embedded in search results
    const imgMatch = html.match(/src="(https:\/\/img\d+\.doubanio\.com\/view\/subject\/[lm]\/public\/[^"]+)"/);
    const coverUrl = imgMatch ? imgMatch[1].replace('/m/', '/l/') : '';

    // Extract description snippet
    const descMatch = html.match(/<span class="subject-cast">([^<]+)<\/span>/);
    const descSnippet = descMatch ? descMatch[1].trim() : '';

    return {
      title,
      author: author || '未知',
      coverUrl,
      description: descSnippet || '',
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

  let result = null;
  // Try each source in order
  try { result = await fetchFromGoogleBooks(title, author); } catch (err) { console.log(`  [GoogleBooks] 错误: ${err.message}`); }
  if (!result || !result.coverUrl) {
    try { result = await fetchFromOpenLibrary(title, author); } catch (err) { console.log(`  [OpenLibrary] 错误: ${err.message}`); }
  }
  if (!result || !result.coverUrl) {
    try { result = await fetchFromDouban(title, author); } catch (err) { console.log(`  [Douban] 错误: ${err.message}`); }
  }
  if (!result) {
    result = buildFallbackData(book);
  }

  return result;
}

module.exports = { fetchBookData, downloadCover, slugify };
