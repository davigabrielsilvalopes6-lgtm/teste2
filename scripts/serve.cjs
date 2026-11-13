'use strict';

// Serve only the shipped game documents, on loopback. No runtime packages.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const entry = 'ORIGENS — Survival v0.9 Fauna Elemental.html';
const documents = new Set([
  entry,
  'ORIGENS — Survival v0.8.1.html',
  'ORIGENS — Survival v0.8 Combate.html',
  'ORIGENS — Survival v0.8.html',
  'ORIGENS — Survival v0.7.html',
  'ORIGENS — Survival v0.5.html',
  'ORIGENS — Survival v0.4.html',
  'ORIGENS — Survival v0.3.html',
  'ORIGENS — Mundo Procedural v0.2.html',
]);
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida');

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  } catch {
    response.writeHead(400);
    response.end('URL inválida');
    return;
  }
  if (pathname === '/favicon.ico') {
    response.writeHead(204);
    response.end();
    return;
  }
  // Keep the same URL and origin on reload; serve the original bytes unchanged.
  const filename = pathname === '/' ? entry : pathname.slice(1);
  const isMobScript = filename === 'assets/mobs/mobs-v09.js';
  const isMobPng = /^assets\/mobs\/(fire_salamander|rock_boar|wind_spirit|river_serpent)\/[a-z0-9_-]+\.png$/.test(filename);
  if (!documents.has(filename) && !isMobScript && !isMobPng) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Não encontrado');
    return;
  }
  fs.readFile(path.join(root, filename), (error, contents) => {
    if (error) {
      response.writeHead(500);
      response.end('Falha ao abrir o jogo');
      return;
    }
    response.writeHead(200, {
      'Content-Type': isMobScript ? 'application/javascript; charset=utf-8' : isMobPng ? 'image/png' : 'text/html; charset=utf-8',
      'Content-Length': contents.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : contents);
  });
});
server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`ORIGENS: servidor HTTP na porta ${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
