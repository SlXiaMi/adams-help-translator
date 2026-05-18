'use strict';

const fs = require('fs');
const path = require('path');
const { SNIPPET, HINT } = require('./snippets');

const HELP_DIR = path.resolve(__dirname, '..');
const MARKER = 'data-translate-injected';

let total = 0, modified = 0, skipped = 0;

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

const processFile = (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');

    if (content.includes(MARKER)) {
        skipped++;
        console.log('  SKIP:', path.relative(HELP_DIR, filePath));
        return;
    }

    const idx = content.lastIndexOf('</body>');
    if (idx === -1) {
        console.log('  WARN: no </body> in', path.relative(HELP_DIR, filePath));
        return;
    }

    const newContent = content.slice(0, idx) + SNIPPET + '\n' + HINT + '\n' + content.slice(idx);
    fs.writeFileSync(filePath, newContent, 'utf-8');
    modified++;
    console.log('  DONE:', path.relative(HELP_DIR, filePath));
};

console.log('Scanning help directory...');
walk(HELP_DIR);
console.log('');
console.log('Total scanned:', total);
console.log('Modified:', modified);
console.log('Skipped (already injected):', skipped);
