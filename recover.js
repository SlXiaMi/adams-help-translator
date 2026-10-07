'use strict';

const fs = require('fs');
const path = require('path');

const HELP_DIR = path.resolve(__dirname, '..');
const MARKER = 'data-translate-injected';

let total = 0, recovered = 0, clean = 0;

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

    if (!content.includes(MARKER)) {
        clean++;
        return;
    }

    // 优先移除带分隔注释的整块（任意版本都能精确还原），
    // 兜底：逐块移除旧版本注入的 <script data-translate-injected ...> 块
    const regionRe = /<!--aht:start-->[\s\S]*?<!--aht:end-->[ \t]*\r?\n?/g;
    const blockRe = /[\t ]*<script data-translate-injected[^>]*>[\s\S]*?<\/script>\r?\n?/g;
    let newContent = content.replace(regionRe, '');
    if (newContent.includes(MARKER)) {
        newContent = newContent.replace(blockRe, '');
    }

    if (newContent === content) {
        console.log('  WARN: marker found but regex did not match in', path.relative(HELP_DIR, filePath));
        return;
    }

    fs.writeFileSync(filePath, newContent, 'utf-8');
    recovered++;
    console.log('  DONE:', path.relative(HELP_DIR, filePath));
};

console.log('Scanning help directory...');
walk(HELP_DIR);
console.log('');
console.log('Total scanned:', total);
console.log('Recovered:', recovered);
console.log('Already clean:', clean);
