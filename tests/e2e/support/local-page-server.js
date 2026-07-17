// Minimal static server for a single test page, so e2e tests don't depend
// on network access. No dependencies — Node's http module only.
const http = require('http');

const PAGE_HTML = '<!doctype html><html><head><title>SnapRecord e2e target</title></head>' +
  '<body><h1>SnapRecord e2e target page</h1></body></html>';

/**
 * Starts a local HTTP server serving one static page.
 * @returns {Promise<{ origin: string, url: string, close: () => Promise<void> }>}
 */
function startLocalPageServer() {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(PAGE_HTML);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const origin = `http://127.0.0.1:${port}`;
      resolve({
        origin,
        url: `${origin}/`,
        close: () => new Promise((res) => server.close(res))
      });
    });
  });
}

module.exports = { startLocalPageServer };
