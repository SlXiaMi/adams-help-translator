const fs = require('fs');
const path = require('path');

const HELP_DIR = path.resolve(__dirname, '..');
const MARKER = 'data-translate-injected';

const SNIPPET = `
<script ${MARKER}="true">
(function(){
    if(location.protocol !== 'file:') return;

    var rawPath = decodeURIComponent(location.pathname);
    var lowerPath = rawPath.toLowerCase();
    var i = lowerPath.indexOf('/help/');
    if(i === -1) return;
    var rel = rawPath.substring(i + 6).replace(/^\\/+/, '');

    var targetUrl = 'http://localhost:8777/' + rel;

    function tryRedirect() {
        var img = new Image();
        img.onload = function() {
            location.href = targetUrl;
        };
        img.onerror = function() {
            showHint();
        };
        img.src = 'http://localhost:8777/__health';
    }

    function showHint() {
        var h = document.createElement('div');
        h.textContent = '翻译服务未运行 · 点击重试';
        h.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;'
            + 'padding:8px 16px;background:rgba(0,0,0,0.72);color:#fff;border-radius:6px;'
            + 'font-size:13px;font-family:"Microsoft YaHei",sans-serif;cursor:pointer;'
            + 'opacity:0;transition:opacity 0.4s;';
        h.onclick = function() { h.remove(); tryRedirect(); };
        document.body.appendChild(h);
        requestAnimationFrame(function() { h.style.opacity = '1'; });
        setTimeout(function() {
            h.style.opacity = '0';
            setTimeout(function() { if(h.parentNode) h.remove(); }, 400);
        }, 8000);
    }

    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryRedirect);
    } else {
        tryRedirect();
    }
})();
</script>
`;

let total = 0, modified = 0, skipped = 0;

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // 跳过 translation 目录自身
            if (entry.name === 'translation') continue;
            walk(full);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ext !== '.htm' && ext !== '.html') continue;
            total++;
            processFile(full);
        }
    }
}

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 已注入，跳过
    if (content.includes(MARKER)) {
        skipped++;
        console.log('  SKIP:', path.relative(HELP_DIR, filePath));
        return;
    }

    // 找到 </body> 前插入
    const idx = content.lastIndexOf('</body>');
    if (idx === -1) {
        console.log('  WARN: no </body> in', path.relative(HELP_DIR, filePath));
        return;
    }

    const newContent = content.slice(0, idx) + SNIPPET + '\n' + content.slice(idx);
    fs.writeFileSync(filePath, newContent, 'utf-8');
    modified++;
    console.log('  DONE:', path.relative(HELP_DIR, filePath));
}

console.log('Scanning help directory...');
walk(HELP_DIR);
console.log('');
console.log('Total scanned:', total);
console.log('Modified:', modified);
console.log('Skipped (already injected):', skipped);
