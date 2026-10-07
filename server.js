'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8777;
const ROOT = path.resolve(__dirname, '..');
const PID_FILE = path.join(__dirname, 'server.pid');
const LOG_FILE = path.join(__dirname, 'server.log');

// The reader UI is served as an external script (see inject.js), so updating it
// only takes editing snippets.js and restarting the service - no re-injection.
const { HINT } = require('./snippets');

// Strip the surrounding <script> tag from the template, keeping the JS body.
const READER_JS = HINT
    .replace(/^[\s\S]*?<script[^>]*>/i, '')
    .replace(/<\/script>\s*$/i, '');

// 重定向 stdout/stderr 到日志文件
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
const stdoutWrite = logStream.write.bind(logStream);
const stderrWrite = logStream.write.bind(logStream);
process.stdout.write = function() { stdoutWrite.apply(logStream, arguments); };
process.stderr.write = function() { stderrWrite.apply(logStream, arguments); };

// 1x1 transparent PNG
const PIXEL_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk'
    + '+M9QDwADgQGBTtgOWwAAAABJRU5ErkJggg==',
    'base64'
);

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
};

const getMime = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    return MIME[ext] || 'application/octet-stream';
};

const isSafe = (filePath) => {
    const normalized = path.normalize(filePath);
    return normalized.startsWith(ROOT + path.sep) || normalized === ROOT;
};

const server = http.createServer((req, res) => {
    try {
        const urlPath = decodeURIComponent(req.url.split('?')[0]);

        // Health check
        if (req.method === 'GET' && urlPath === '/__health') {
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            });
            res.end(PIXEL_PNG);
            return;
        }

        // Reader UI script, injected into every help page as
        // <script src="/__aht/reader.js" defer data-translate-injected="true">
        if (req.method === 'GET' && urlPath === '/__aht/reader.js') {
            res.writeHead(200, {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            });
            res.end(READER_JS);
            return;
        }

        // Only allow GET/HEAD for static files
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405);
            res.end();
            return;
        }

        // Default to master.htm
        const relPath = urlPath === '/' ? '/master.htm' : urlPath;
        let filePath = path.join(ROOT, relPath);

        if (!isSafe(filePath)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        // If path is directory, try index
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            filePath = path.join(filePath, 'master.htm');
        }

        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }

        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': getMime(filePath) });
        res.end(content);
    } catch (e) {
        console.error(new Date().toISOString(), 'Request error:', e.message);
        if (!res.headersSent) {
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    }
});

// Write PID file
fs.writeFileSync(PID_FILE, String(process.pid));

const cleanup = () => {
    try { if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE); } catch (_) {}
};
process.on('exit', cleanup);
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('uncaughtException', (err) => {
    console.error(new Date().toISOString(), 'ERROR:', err.message);
    cleanup();
    process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(new Date().toISOString(), 'Server started on http://localhost:' + PORT);
});

server.on('error', (err) => {
    console.error(new Date().toISOString(), 'Failed to start:', err.message);
    process.exit(1);
});
