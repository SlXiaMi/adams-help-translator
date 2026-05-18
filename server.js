const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8777;
const ROOT = path.resolve(__dirname, '..');
const PID_FILE = path.join(__dirname, 'server.pid');

// 1x1 transparent PNG (minimal)
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

function getMime(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME[ext] || 'application/octet-stream';
}

// Path traversal protection
function isSafe(filePath) {
    const normalized = path.normalize(filePath);
    return normalized.startsWith(ROOT + path.sep) || normalized === ROOT;
}

// In-memory store for reader content (auto-cleans after 30 min)
var readerStore = new Map();
setInterval(function() {
    var now = Date.now();
    readerStore.forEach(function(v, k) {
        if (now - v.created > 1800000) readerStore.delete(k);
    });
}, 600000);

// Strip HTML tags to count text length
function countText(html) {
    return html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim().length;
}

// Split content HTML into pages at heading/horizontal-rule boundaries
function splitIntoPages(content) {
    var MAX_CHARS = 6000;
    if (countText(content) <= MAX_CHARS) return [content];

    // Split at heading or hr boundaries
    var blocks = content.split(/(<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>|<hr[^>]*>)/i);
    var pages = [], current = '', currentLen = 0;

    for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        var blockLen = countText(block);

        if (blockLen === 0) {
            current += block;
            continue;
        }

        if (currentLen + blockLen > MAX_CHARS && currentLen > 0) {
            pages.push(current);
            current = block;
            currentLen = blockLen;
        } else {
            current += block;
            currentLen += blockLen;
        }
    }
    if (current.trim()) pages.push(current);

    // If any single block is still too large, split it at paragraph boundaries
    var finalPages = [];
    for (var j = 0; j < pages.length; j++) {
        if (countText(pages[j]) <= MAX_CHARS) {
            finalPages.push(pages[j]);
        } else {
            // Split at paragraph or div boundaries
            var bigBlocks = pages[j].split(/(<p[^>]*>|<\/p>|<div[^>]*>|<\/div>|<br[^>]*>)/i);
            var cur = '', curLen = 0;
            for (var k = 0; k < bigBlocks.length; k++) {
                var bLen = countText(bigBlocks[k]);
                if (curLen + bLen > MAX_CHARS && curLen > 0) {
                    finalPages.push(cur);
                    cur = bigBlocks[k];
                    curLen = bLen;
                } else {
                    cur += bigBlocks[k];
                    curLen += bLen;
                }
            }
            if (cur.trim()) finalPages.push(cur);
        }
    }

    return finalPages.length > 0 ? finalPages : [content];
}

const server = http.createServer((req, res) => {
    try {
        var urlPath = decodeURIComponent(req.url.split('?')[0]);

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

        // POST /__reader — store content, return id + page count
        if (req.method === 'POST' && urlPath === '/__reader') {
            var body = '';
            req.on('data', function(c) { body += c; });
            req.on('end', function() {
                try {
                    var data = JSON.parse(body);
                    var content = data.content || '';
                    var pages = splitIntoPages(content);
                    var id = String(Date.now());
                    readerStore.set(id, { title: data.title || '', pages: pages, created: Date.now() });
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ id: id, pages: pages.length }));
                } catch (e) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // GET /__reader?id=X&page=Y — serve reader page or a content page
        if (req.method === 'GET' && urlPath === '/__reader') {
            var query = {};
            if (req.url.indexOf('?') !== -1) {
                req.url.split('?')[1].split('&').forEach(function(p) {
                    var kv = p.split('=');
                    query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
                });
            }
            var entry = readerStore.get(query.id);
            if (!entry) {
                // Fallback: try sessionStorage-based old approach
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
                    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
                    + '<title>Reading Mode</title>'
                    + '<style>body{font-family:"Microsoft YaHei","Segoe UI",sans-serif;'
                    + 'font-size:15px;line-height:1.8;padding:24px 40px;max-width:900px;'
                    + 'margin:0 auto;color:#222;background:#fff}'
                    + 'img{max-width:100%;height:auto}'
                    + 'table{width:100%;border-collapse:collapse}'
                    + 'td,th{border:1px solid #ddd;padding:6px 10px}'
                    + 'pre,code{background:#f5f5f5;padding:2px 6px;border-radius:3px;font-size:13px}'
                    + '.empty{text-align:center;color:#999;padding:60px 20px;font-size:15px}'
                    + '</style></head><body><div id="content">'
                    + '<p class="empty">Content not found.<br><small>Please close this window and click "新窗口" again from the reading mode.</small></p>'
                    + '</div>'
                    + '<script>try{var d=JSON.parse(sessionStorage.getItem("_tr_content"));'
                    + 'if(d&&d.content){document.getElementById("content").innerHTML=d.content;'
                    + 'document.title=d.title||"Reading Mode"}}catch(e){}'
                    + '</\\/script></body></html>');
                return;
            }

            var pageNum = parseInt(query.page) || 1;
            if (pageNum < 1 || pageNum > entry.pages.length) pageNum = 1;
            var pageContent = entry.pages[pageNum - 1];

            var navHtml = '';
            if (entry.pages.length > 1) {
                navHtml = '<div style="position:fixed;bottom:0;left:0;right:0;background:#fafafa;'
                    + 'border-top:1px solid #e0e0e0;padding:10px 20px;display:flex;'
                    + 'justify-content:center;align-items:center;gap:16px;z-index:9999;'
                    + 'font-family:"Microsoft YaHei",sans-serif;font-size:14px">'
                    + (pageNum > 1 ? '<a href="/__reader?id=' + query.id + '&page=' + (pageNum - 1)
                        + '" style="color:#0078d4;text-decoration:none;cursor:pointer">&larr; 上一页</a>'
                        : '<span style="color:#ccc">&larr; 上一页</span>')
                    + '<span style="color:#666">第 ' + pageNum + ' / ' + entry.pages.length + ' 页</span>'
                    + (pageNum < entry.pages.length ? '<a href="/__reader?id=' + query.id + '&page=' + (pageNum + 1)
                        + '" style="color:#0078d4;text-decoration:none;cursor:pointer">下一页 &rarr;</a>'
                        : '<span style="color:#ccc">下一页 &rarr;</span>')
                    + '</div>';
            }

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
                + '<meta name="viewport" content="width=device-width,initial-scale=1">'
                + '<title>' + entry.title + ' (' + pageNum + '/' + entry.pages.length + ')</title>'
                + '<style>body{font-family:"Microsoft YaHei","Segoe UI",sans-serif;'
                + 'font-size:15px;line-height:1.8;padding:24px 40px 60px 40px;max-width:900px;'
                + 'margin:0 auto;color:#222;background:#fff}'
                + 'img{max-width:100%;height:auto}'
                + 'table{width:100%;border-collapse:collapse}'
                + 'td,th{border:1px solid #ddd;padding:6px 10px}'
                + 'pre,code{background:#f5f5f5;padding:2px 6px;border-radius:3px;font-size:13px}'
                + '</style></head><body><div id="content">' + pageContent + '</div>'
                + navHtml + '</body></html>');
            return;
        }

        // Only allow GET/HEAD for static files
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405);
            res.end();
            return;
        }

        // Default to master.htm
        var relPath = urlPath === '/' ? '/master.htm' : urlPath;
        var filePath = path.join(ROOT, relPath);

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

        var content = fs.readFileSync(filePath);
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

// Cleanup PID file
function cleanup() {
    try { if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE); } catch (_) {}
}
process.on('exit', cleanup);
process.on('SIGTERM', function() { cleanup(); process.exit(0); });
process.on('SIGINT', function() { cleanup(); process.exit(0); });
process.on('uncaughtException', function(err) {
    console.error(new Date().toISOString(), 'ERROR:', err.message);
    cleanup();
    process.exit(1);
});

server.listen(PORT, '127.0.0.1', function() {
    console.log(new Date().toISOString(), 'Server started on http://localhost:' + PORT);
});

server.on('error', function(err) {
    console.error(new Date().toISOString(), 'Failed to start:', err.message);
    process.exit(1);
});
