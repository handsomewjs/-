# 小红书每日荐书机器人 — 使用指南

## 每日流程

### 自动模式（无需操作）
- **每天 20:00**，GitHub Actions 自动生成一篇帖子
- 内容包括：标题、读后感、5条名句、5-7张图片
- 自动推送到 GitHub，书单队列自动推进

### 手动发布（需要你操作）
1. 打开终端（CMD），输入：
   ```
   cd /d D:\Claude\First CC\xiaohongshu-bot && node publisher.js
   ```
2. 浏览器会自动打开小红书创作者平台
3. 如果需要登录，用手机小红书扫码
4. 程序自动上传图片、填写标题正文标签
5. **在浏览器里审核内容，点发布**

### 手动指定一本书（可选）
1. 打开 https://github.com/handsomewjs/-/actions/workflows/daily-post.yml
2. 点 "Run workflow"，在 book_title 框里输入书名
3. 点绿色按钮运行

## 文件位置

| 文件 | 作用 |
|------|------|
| `xiaohongshu-bot/books.json` | 书单队列，可手动添加 |
| `xiaohongshu-bot/posts/` | 每日生成的内容存档 |
| `xiaohongshu-bot/.debug-screenshots/` | 发布过程截图 |

## 添加新书

编辑 `xiaohongshu-bot/books.json`，按格式添加：
```json
{ "title": "书名", "author": "作者", "used": false }
```
提交推送后，新书就进入队列了。

## 当前剩余书单

1. 红楼梦 — 曹雪芹
2. 1984 — 乔治·奥威尔
3. 局外人 — 阿尔贝·加缪

还剩 3 本，需要补充。

## 常见问题

| 问题 | 解决 |
|------|------|
| 浏览器锁住 | 删掉 `.browser-data2/SingletonLock` |
| 发布点错按钮 | 已修复，如仍出现手动点发布 |
| 封面图缺失 | 需要 Google Books API Key，去 console.cloud.google.com 免费申请 |
| 队列空了 | 编辑 books.json 添加新书 |
