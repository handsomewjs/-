const fs = require('fs');
const config = require('./config');

function readBooks() {
  try {
    const raw = fs.readFileSync(config.booksFile, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    console.error('readBooks error:', err.message);
    return [];
  }
}

function writeBooks(books) {
  try {
    fs.writeFileSync(config.booksFile, JSON.stringify(books, null, 2), 'utf-8');
  } catch (err) {
    console.error('writeBooks error:', err.message);
  }
}

function getNextBook(specificTitle) {
  const books = readBooks();
  const idx = specificTitle
    ? books.findIndex(b => b.title === specificTitle && !b.used)
    : books.findIndex(b => !b.used);
  if (idx === -1) return null;
  books[idx].used = true;
  books[idx].usedDate = new Date().toISOString().split('T')[0];
  writeBooks(books);
  return { title: books[idx].title, author: books[idx].author, source: 'queue' };
}

function addBook(title, author) {
  if (!title || typeof title !== 'string' || title.trim() === '') {
    console.error('addBook error: title must be a non-empty string');
    return;
  }
  author = author || '';
  }
  const books = readBooks();
  const exists = books.some(b => b.title === title && b.author === author);
  if (!exists) {
    books.push({ title, author, used: false });
    writeBooks(books);
  }
}

function resetBook(title) {
  const books = readBooks();
  const book = books.find(b => b.title === title);
  if (book) {
    book.used = false;
    delete book.usedDate;
    writeBooks(books);
    return true;
  }
  return false;
}

function getQueueStats() {
  const books = readBooks();
  const remaining = books.filter(b => !b.used).length;
  return { total: books.length, remaining, used: books.length - remaining };
}

module.exports = { getNextBook, addBook, getQueueStats, resetBook };
