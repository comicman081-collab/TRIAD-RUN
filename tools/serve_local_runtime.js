const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.TRIAD_PORT || 4173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

http.createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html';
    const target = path.resolve(root, `.${pathname}`);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      send(res, 403, 'Forbidden');
      return;
    }
    fs.stat(target, (error, stats) => {
      if (error || !stats.isFile()) {
        send(res, 404, 'Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      fs.createReadStream(target).pipe(res);
    });
  } catch (error) {
    send(res, 500, 'Server error');
  }
}).listen(port, '127.0.0.1');
