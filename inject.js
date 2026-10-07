'use strict';

const fs = require('fs');
const path = require('path');
const { SNIPPET, HINT } = require('./snippets');

const HELP_DIR = path.resolve(__dirname, '..');
const MARKER = 'data-translate-injected';

// The exact payload written into each page. It is the same structure that
// recover.js strips, so a page that is already up to date can be restored
// byte-for-byte and re-running this script stays idempotent.
const PAYLOAD = SNIPPET + '\n' + HINT + '\n';

// Fallback for blocks written by an older version of snippets.js: their
// content differs, so the exact match above fails and we strip by regex.
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

    // Strip the previous injection first: exact match for the current version,
    // regex fallback for older ones.
    let base = content;
    if (content.includes(PAYLOAD)) {
        base = content.split(PAYLOAD).join('');
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
