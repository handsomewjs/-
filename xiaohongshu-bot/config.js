const path = require('path');

const config = {
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY || '',

  imageWidth: 1080,
  imageHeight: 1440,

  booksFile: path.join(__dirname, 'books.json'),
  postsDir: path.join(__dirname, 'posts'),

  aiModel: 'deepseek-chat',
  aiBaseUrl: 'https://api.deepseek.com/v1',
  aiMaxTokens: 2000,
  aiTemperature: 0.75,

  maxImages: 8,
  maxQuotes: 5,
};

module.exports = config;
