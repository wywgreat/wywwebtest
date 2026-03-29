const http = require('http');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const AGENT_TERMS = [
  'agent',
  'multi-agent',
  'autonomous agent',
  'tool use',
  'tool calling',
  'planning',
  'task decomposition',
  'agentic',
];

function buildArxivQuery(fromDate, toDate) {
  const termQuery = AGENT_TERMS.map((term) => `all:\"${term}\"`).join(' OR ');
  const dateQuery = `submittedDate:[${fromDate}0000 TO ${toDate}2359]`;
  return `(${termQuery}) AND ${dateQuery}`;
}

function decodeXml(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseArxivXml(xml) {
  const entries = xml.split('<entry>').slice(1);

  return entries.map((entryRaw) => {
    const entry = `<entry>${entryRaw}`;
    const getTag = (tag) => {
      const match = entry.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return match ? decodeXml(match[1].trim().replace(/\s+/g, ' ')) : '';
    };

    return {
      id: getTag('id'),
      title: getTag('title'),
      summary: getTag('summary'),
      published: getTag('published'),
      updated: getTag('updated'),
    };
  });
}

async function fetchArxiv(query, maxResults = 20) {
  const url = new URL('https://export.arxiv.org/api/query');
  url.searchParams.set('search_query', query);
  url.searchParams.set('start', '0');
  url.searchParams.set('max_results', String(maxResults));
  url.searchParams.set('sortBy', 'submittedDate');
  url.searchParams.set('sortOrder', 'descending');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`arXiv request failed: ${response.status}`);
  }

  return parseArxivXml(await response.text());
}

async function translateToChinese(text) {
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', 'en|zh-CN');

  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'arxiv-agent-paper-finder/1.0' } });
    if (!response.ok) return text;
    const data = await response.json();
    return data?.responseData?.translatedText || text;
  } catch {
    return text;
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

async function handleApi(urlObj, res) {
  if (urlObj.pathname !== '/api/papers') {
    sendJson(res, 404, { error: 'not found' });
    return;
  }

  const days = Number(urlObj.searchParams.get('days') || '7');
  const max = Math.min(Math.max(Number(urlObj.searchParams.get('max') || '20'), 1), 50);

  if (!Number.isInteger(days) || days < 1 || days > 365) {
    sendJson(res, 400, { error: 'days must be an integer between 1 and 365' });
    return;
  }

  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(now.getUTCDate() - days);

  const formatDate = (date) => `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
  const query = buildArxivQuery(formatDate(from), formatDate(now));

  try {
    const papers = await fetchArxiv(query, max);
    const translated = await Promise.all(
      papers.map(async (paper) => ({
        ...paper,
        titleZh: await translateToChinese(paper.title),
        summaryZh: await translateToChinese(paper.summary),
      }))
    );

    sendJson(res, 200, { queryWindowDays: days, total: translated.length, papers: translated });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'failed to fetch papers' });
  }
}

function handleStatic(urlObj, res) {
  const pathname = urlObj.pathname === '/' ? '/index.html' : urlObj.pathname;
  const safePath = path.normalize(path.join(PUBLIC_DIR, pathname));

  if (!safePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(safePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(safePath) });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);

  if (urlObj.pathname.startsWith('/api/')) {
    await handleApi(urlObj, res);
    return;
  }

  handleStatic(urlObj, res);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
