'use strict';
// Static server for the local test fixture (a fictional brand site).
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, 'fixture');
const port = +process.argv[2] || 4173;
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': f.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8' });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log('fixture on http://localhost:' + port));
