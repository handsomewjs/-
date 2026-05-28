const fs = require('fs');
const path = require('path');
const config = require('./config');

async function fetchFromGoogleBooks(title, author) {
  const query = author ? `${title}+inauthor:${author}` : title;
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&langRestrict=zh&maxResults=3&key=${config.googleBooksApiKey}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Google Books API error: ${res.status}`);
  const data = await res.json();
  if (!data.items || data.items.length === 0) return null;

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

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
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

function buildFallbackData(book) {
  return {
    title: book.title,
    author: book.author || '未知',
    coverUrl: '',
    description: `《${book.title}》是一部值得细细品读的作品。`,
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
  if (config.googleBooksApiKey) {
    try { result = await fetchFromGoogleBooks(title, author); } catch {}
  }
  if (!result) {
    try { result = await fetchFromOpenLibrary(title, author); } catch {}
  }
  if (!result) {
    result = buildFallbackData(book);
  }

  return result;
}

module.exports = { fetchBookData, downloadCover, slugify };
