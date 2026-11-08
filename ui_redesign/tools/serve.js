// Tiny static server for the prototype (no dependencies).
//   node serve.js            → http://localhost:4173/
//   startServer(root, port)  → { url, close } for the tests (port 0 = any free port)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

function startServer(root = path.resolve(__dirname, '..'), port = 0) {
  root = path.resolve(root);
  const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { p = '/'; }
    if (p.endsWith('/')) p += 'index.html';
    const file = path.resolve(root, '.' + p);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    if (/[\\/]node_modules[\\/]/.test(file)) { res.writeHead(404); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const { port: actual } = server.address();
      resolve({ url: `http://localhost:${actual}`, close: () => new Promise(r => server.close(() => r())) });
    });
  });
}

module.exports = { startServer };

if (require.main === module) {
  startServer(undefined, Number(process.env.PORT) || 4173).then(({ url }) => console.log(`Prototype gallery: ${url}/`));
}
