#!/usr/bin/env node
/**
 * Deterministic stub of the DeepSeek chat-completions endpoint for Playwright
 * (implementation plan task 5.5). Replaced with the real scenarios in phase 5;
 * for now it answers /health and returns an empty JSON object.
 */
import http from 'node:http';

const port = Number(process.argv[process.argv.indexOf('--port') + 1] || 3999);

http
  .createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          choices: [{ message: { content: '{}' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
          model: 'stub',
        }),
      );
    });
  })
  .listen(port, () => console.log(`stub-ai listening on ${port}`));
