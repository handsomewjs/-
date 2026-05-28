const fs = require('fs');
const path = require('path');
const config = require('./config');

function readBooks() {
  const raw = fs.readFileSync(config.booksFile, 'utf-8');
  return JSON.parse(raw);
}

function writeBooks(books) {
  fs.writeFileSync(config.booksFile, JSON.stringify(books, null, 2), 'utf-8');
}

function getNextBook() {
  const books = readBooks();
  const idx = books.findIndex(b => !b.used);
  if (idx === -1) return null;
  books[idx].used = true;
  books[idx].usedDate = new Date().toISOString().split('T')[0];
  writeBooks(books);
  return { title: books[idx].title, author: books[idx].author, source: 'queue' };
}

function addBook(title, author) {
  const books = readBooks();
  const exists = books.some(b => b.title === title && b.author === author);
  if (!exists) {
    books.push({ title, author, used: false });
    writeBooks(books);
  }
}

function getQueueStats() {
  const books = readBooks();
  const remaining = books.filter(b => !b.used).length;
  return { total: books.length, remaining, used: books.length - remaining };
}

module.exports = { getNextBook, addBook, getQueueStats };
