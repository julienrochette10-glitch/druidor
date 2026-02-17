const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const TOOL_REGISTRY = path.join(PUBLIC_DIR, 'modules', 'tools.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function safeResolve(target) {
  const resolved = path.resolve(ROOT, target);
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 8 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function send(res, status, payload, headers = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': headers['Content-Type'] || 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    ...headers
  });
  res.end(body);
}

function parseListeners(jsSource) {
  const listeners = [];
  const addEventRegex = /([\w.$\]\[]+)\s*\.\s*addEventListener\s*\(\s*['\"]([\w:-]+)['\"]/g;
  const onPropRegex = /([\w.$\]\[]+)\s*\.\s*on([a-z]+)\s*=\s*(?:function|\([^)]*\)\s*=>)/g;
  let match;
  while ((match = addEventRegex.exec(jsSource)) !== null) {
    listeners.push({ target: match[1], event: match[2], type: 'addEventListener' });
  }
  while ((match = onPropRegex.exec(jsSource)) !== null) {
    listeners.push({ target: match[1], event: match[2], type: 'onProperty' });
  }
  return listeners;
}

async function handleApi(req, res, urlObj) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
    });
    return res.end();
  }

  if (req.method === 'POST' && urlObj.pathname === '/api/load-files') {
    try {
      const body = JSON.parse(await readBody(req));
      const htmlPath = safeResolve(body.htmlPath || '');
      const cssPath = safeResolve(body.cssPath || '');
      const jsPath = safeResolve(body.jsPath || '');
      if (!htmlPath || !cssPath || !jsPath) return send(res, 400, { error: 'Invalid paths' });

      const [html, css, js] = await Promise.all([
        fs.promises.readFile(htmlPath, 'utf8'),
        fs.promises.readFile(cssPath, 'utf8'),
        fs.promises.readFile(jsPath, 'utf8')
      ]);

      return send(res, 200, {
        files: {
          html: { path: path.relative(ROOT, htmlPath), content: html },
          css: { path: path.relative(ROOT, cssPath), content: css },
          js: { path: path.relative(ROOT, jsPath), content: js }
        },
        jsAnalysis: parseListeners(js)
      });
    } catch (error) {
      return send(res, 500, { error: error.message });
    }
  }

  if (req.method === 'PUT' && urlObj.pathname === '/api/save-files') {
    try {
      const body = JSON.parse(await readBody(req));
      const targets = [
        { key: 'html', entry: body.html },
        { key: 'css', entry: body.css },
        { key: 'js', entry: body.js }
      ];

      await Promise.all(targets.map(async ({ entry }) => {
        const filePath = safeResolve(entry.path || '');
        if (!filePath) throw new Error('Invalid save path');
        await fs.promises.writeFile(filePath, entry.content, 'utf8');
      }));

      return send(res, 200, { saved: true });
    } catch (error) {
      return send(res, 500, { error: error.message });
    }
  }

  if (req.method === 'GET' && urlObj.pathname === '/api/tools') {
    try {
      const raw = await fs.promises.readFile(TOOL_REGISTRY, 'utf8');
      return send(res, 200, JSON.parse(raw));
    } catch (error) {
      return send(res, 500, { error: error.message });
    }
  }

  if (req.method === 'POST' && urlObj.pathname === '/api/tools') {
    try {
      const nextTool = JSON.parse(await readBody(req));
      const raw = await fs.promises.readFile(TOOL_REGISTRY, 'utf8');
      const registry = JSON.parse(raw);
      registry.tools.push({ ...nextTool, id: `tool_${Date.now()}` });
      await fs.promises.writeFile(TOOL_REGISTRY, JSON.stringify(registry, null, 2), 'utf8');
      return send(res, 200, registry);
    } catch (error) {
      return send(res, 500, { error: error.message });
    }
  }

  return false;
}

function serveStatic(req, res, urlObj) {
  let filePath = path.join(PUBLIC_DIR, urlObj.pathname === '/' ? 'index.html' : urlObj.pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }
    const ext = path.extname(filePath);
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream'
    });
    stream.pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  if (urlObj.pathname.startsWith('/api/')) {
    const handled = await handleApi(req, res, urlObj);
    if (handled !== false) return;
  }
  serveStatic(req, res, urlObj);
});

server.listen(PORT, () => {
  console.log(`AirCode Scene Builder listening on http://localhost:${PORT}`);
});
