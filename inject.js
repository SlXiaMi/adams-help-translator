'use strict';

const fs = require('fs');
const path = require('path');
const { SNIPPET } = require('./snippets');

const HELP_DIR = path.resolve(__dirname, '..');
const MARKER = 'data-translate-injected';

// What gets injected into every page:
//   1. the redirect snippet, kept inline because it has to run on file:// pages
//      before the page is redirected to the local server;
//   2. a loader for the reader UI, which server.js serves from /__aht/reader.js.
//      Keeping the UI external means editing snippets.js and restarting the
//      service is enough - no re-injection of all pages.
// The payload sits between <!--aht:start--> and <!--aht:end--> so that any
// future version can be removed byte-for-byte.
const START = '<!--aht:start-->';
const END = '<!--aht:end-->';
const LOADER = '<script src="/__aht/reader.js" data-translate-injected="true" defer></script>';
const PAYLOAD = START + '\n' + SNIPPET + '\n' + LOADER + '\n' + END + '\n';

// A delimited region from any version of the payload.
const REGION_RE = /<!--aht:start-->[\s\S]*?<!--aht:end-->[ \t]*\r?\n?/g;

// Fallback for pages injected before the delimiters existed: strip each block.
const BLOCK_RE = /[\t ]*<script data-translate-injected[^>]*>[\s\S]*?<\/script>\r?\n?/g;

let total = 0, injected = 0, updated = 0, current = 0, warned = 0;

const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'translation') continue;
            walk(full);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ext !== '.htm' && ext !== '.html') continue;
            total++;
            processFile(full);
        }
    }
};

const rel = (p) => path.relative(HELP_DIR, p);

const processFile = (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const hadMarker = content.includes(MARKER);

    // Strip a previous injection first: the delimited region if present (exact
    // for any version), otherwise per-block regex for pages injected before the
    // delimiters were introduced.
    let base = content;
    if (content.includes(START)) {
        base = content.replace(REGION_RE, '');
    } else if (hadMarker) {
        base = content.replace(BLOCK_RE, '');
        if (base === content) {
            console.log('  WARN: marker present but not removable, left untouched:', rel(filePath));
            warned++;
            return;
        }
    }

    const idx = base.lastIndexOf('</body>');
    if (idx === -1) {
        console.log('  WARN: no </body> in', rel(filePath));
        warned++;
        return;
    }

    const newContent = base.slice(0, idx) + PAYLOAD + base.slice(idx);

    // Already the current version: do not touch the file, keep its timestamp.
    if (newContent === content) {
        current++;
        return;
    }

    fs.writeFileSync(filePath, newContent, 'utf-8');
    if (hadMarker) {
        updated++;
        console.log('  UPDATE:', rel(filePath));
    } else {
        injected++;
        console.log('  ADD:', rel(filePath));
    }
};

console.log('Scanning help directory...');
walk(HELP_DIR);
console.log('');
console.log('Total scanned:', total);
console.log('Injected (new pages):', injected);
console.log('Updated (refreshed):', updated);
console.log('Already current:', current);
console.log('Warnings:', warned);
