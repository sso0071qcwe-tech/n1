import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { matchRoute } from './routes.js';
import { seedDatabase } from './seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend', 'public');

const PORT = process.env.PORT || 3000;

// Seed database on startup
seedDatabase();

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function parseQueryString(url) {
  const qIdx = url.indexOf('?');
  if (qIdx === -1) return {};
  const qs = url.slice(qIdx + 1);
  const params = {};
  qs.split('&').forEach(pair => {
    const [key, val] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(val || '');
  });
  return params;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function serveStatic(res, urlPath) {
  let filePath = path.join(FRONTEND_DIR, urlPath === '/' ? 'index.html' : urlPath);
  
  // Security: prevent path traversal
  if (!filePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  
  // If file doesn't exist, serve index.html (SPA routing)
  if (!fs.existsSync(filePath)) {
    filePath = path.join(FRONTEND_DIR, 'index.html');
  }
  
  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  const urlPath = req.url.split('?')[0];
  
  // API routes
  if (urlPath.startsWith('/api/')) {
    const body = await readBody(req);
    const query = parseQueryString(req.url);
    
    const matched = matchRoute(req.method, urlPath);
    if (matched) {
      req.params = matched.params;
      req.query = query;
      
      try {
        const result = matched.handler(req, body);
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.data));
      } catch (err) {
        console.error('Route error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
    return;
  }
  
  // Static files (frontend)
  serveStatic(res, urlPath);
});

server.listen(PORT, () => {
  console.log(`\n==========================================`);
  console.log(`  Housekeeping Compliance App`);
  console.log(`  Glebe House Care (Nursing) Home`);
  console.log(`==========================================`);
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log(`  API available at http://localhost:${PORT}/api/`);
  console.log(`==========================================\n`);
  console.log('Staff PINs for testing:');
  console.log('  Hannah Smith (Housekeeper): 1234');
  console.log('  Sarah Mitchell (Supervisor): 5678');
  console.log('  Jane Cooper (Manager): 6789');
  console.log('  Linda Audit (Auditor): 8901');
  console.log('');
});
