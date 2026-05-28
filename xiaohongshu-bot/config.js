const path = require('path');

const config = {
  claudeApiKey: process.env.CLAUDE_API_KEY || '',
  googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY || '',

  imageWidth: 1080,
  imageHeight: 1440,

  booksFile: path.join(__dirname, 'books.json'),
  postsDir: path.join(__dirname, 'posts'),

  claudeModel: 'claude-3-5-haiku-latest',
  claudeMaxTokens: 2000,
  claudeTemperature: 0.75,

  maxImages: 8,
  maxQuotes: 5,
};

module.exports = config;
