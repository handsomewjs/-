const Anthropic = require('@anthropic-ai/sdk');
const config = require('./config');

const SYSTEM_PROMPT = `你是一个小红读书博主，经营着一个"每日荐书"账号。你的粉丝是25-35岁的年轻人，喜欢有态度、有深度的内容，但不喜欢说教。

你的任务是为一本书写一篇小红书荐书帖子。必须严格输出如下 JSON 格式，不要输出任何其他内容：

{
  "headline": "抓眼球的标题（15-30字），有情绪张力，像朋友分享而非标题党",
  "review": "个人化读后感（250-350字），表达你对这本书的真实感受和思考，不要像教科书或百度百科。可以用第一人称，可以联系现实生活",
  "quotes": ["名句1，必须来自原书", "名句2", "名句3", "名句4", "名句5"],
  "tags": ["#书名", "#读书分享", "#好书推荐", "#主题标签"]
}

要求：
- headline 要有情绪和态度，不要"XX读后感""推荐一本好书"这种平淡标题
- review 要有个人观点，像朋友在聊天分享，不是书评人在分析
- quotes 必须来自原书真实内容，不确定的名句宁可不用，至少要3条
- 全部内容为中文
- 只输出 JSON，不要任何解释性文字`;

function buildUserPrompt(book) {
  return `请为以下书籍生成小红书荐书帖子内容：

书名：《${book.title}》
作者：${book.author}
简介：${book.description}
出版信息：${book.publisher}，${book.year}年`;
}

function parseClaudeResponse(text) {
  const cleaned = text
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_first) {
    const jsonMatch = cleaned.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    parsed = JSON.parse(jsonMatch[0]);
  }

  if (!parsed.headline || !parsed.review) {
    throw new Error('Missing headline or review');
  }
  if (!Array.isArray(parsed.quotes) || parsed.quotes.length < 2) {
    throw new Error('Insufficient quotes (need >= 2)');
  }
  if (!Array.isArray(parsed.tags) || parsed.tags.length < 2) {
    parsed.tags = ['#读书分享', '#好书推荐'];
  }

  parsed.review = parsed.review.slice(0, 500);
  parsed.quotes = parsed.quotes.slice(0, config.maxQuotes);

  return parsed;
}

function buildFallbackContent(book) {
  return {
    headline: `最近读完了《${book.title}》，想和你聊聊`,
    review: `《${book.title}》是${book.author}的一部作品。这本书给了我很多启发和思考，值得反复阅读。每个人都能从中找到属于自己的感悟。无论你正处于人生的哪个阶段，这本书都能给你带来不一样的阅读体验。推荐给所有喜欢阅读的朋友。`,
    quotes: [
      '书中的智慧需要慢慢品味。',
      '阅读是一场与自己的对话。',
      '每一本好书都是一次心灵的旅行。',
    ],
    tags: ['#读书分享', '#好书推荐', `#${book.title}`],
  };
}

async function generateContent(bookData) {
  if (!config.claudeApiKey) {
    console.warn('CLAUDE_API_KEY not set, using fallback content');
    return buildFallbackContent(bookData);
  }

  const anthropic = new Anthropic({ apiKey: config.claudeApiKey });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const msg = await anthropic.messages.create({
        model: config.claudeModel,
        max_tokens: config.claudeMaxTokens,
        temperature: config.claudeTemperature,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(bookData) }],
        timeout: 30000,
      });

      const textBlock = msg.content.find(b => b.type === 'text');
      if (!textBlock) throw new Error('No text in response');
      const raw = textBlock.text;
      const result = parseClaudeResponse(raw);
      return result;
    } catch (err) {
      console.error(`Content generation attempt ${attempt + 1} failed:`, err.message);
      if (attempt === 1) break;
    }
  }

  return buildFallbackContent(bookData);
}

module.exports = { generateContent };
