# Adams 帮助文件自动翻译工具 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一键配置脚本，注入所有帮助文件使其从 file:// 自动跳转到 http://localhost:8777，让 Edge 可用自带翻译。

**Architecture:** Node.js 静态文件服务器 + 批量注入 `<img>` 探活脚本到 ~6043 个 htm/html 文件 + VBS 静默启动 + 启动文件夹开机自启。恢复脚本可精确还原。

**Tech Stack:** Node.js v24.14.0（已安装，纯内置模块无依赖）、Windows Batch、VBScript

**文件数量:** 47 个 `.htm` + 5996 个 `.html` ≈ 6043 个文件

---

### Task 1: server.js — 静态文件 HTTP 服务

**Files:**
- Create: `c:/Program Files/MSC.Software/Adams/2024_1/help/translation/server.js`

- [ ] **Step 1: 创建 server.js 完整代码**

```javascript
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8777;
const ROOT = path.resolve(__dirname, '..');
const PID_FILE = path.join(__dirname, 'server.pid');

// 1×1 透明 PNG (最小化)
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

// 路径遍历防护
function isSafe(filePath) {
    const normalized = path.normalize(filePath);
    return normalized.startsWith(ROOT + path.sep) || normalized === ROOT;
}

const server = http.createServer((req, res) => {
    try {
        const urlPath = decodeURIComponent(req.url.split('?')[0]);

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

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405);
            res.end();
            return;
        }

        // 默认首页
        let relPath = urlPath === '/' ? '/master.htm' : urlPath;
        let filePath = path.join(ROOT, relPath);

        if (!isSafe(filePath)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        // 如果路径是目录，尝试 index
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
        if (!res.headersSent) {
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    }
});

// 写 PID 文件
fs.writeFileSync(PID_FILE, String(process.pid));

// 清理 PID 文件
function cleanup() {
    try { if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE); } catch (_) {}
}
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
```

- [ ] **Step 2: 验证 server.js 语法**

```bash
node --check "c:/Program Files/MSC.Software/Adams/2024_1/help/translation/server.js"
```

期望: 无输出（语法正确）

- [ ] **Step 3: 启动服务测试**

```bash
node "c:/Program Files/MSC.Software/Adams/2024_1/help/translation/server.js" &
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://localhost:8777/__health
```

期望: `200`

- [ ] **Step 4: 测试路径遍历防护**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8777/../../../Windows/System32/drivers/etc/hosts
```

期望: `403`

- [ ] **Step 5: 检查 PID 文件生成**

```bash
cat "c:/Program Files/MSC.Software/Adams/2024_1/help/translation/server.pid"
```

期望: 数字 PID

---

### Task 2: inject.js — 批量注入跳转脚本

**Files:**
- Create: `c:/Program Files/MSC.Software/Adams/2024_1/help/translation/inject.js`

- [ ] **Step 1: 创建 inject.js 完整代码**

```javascript
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
        h.textContent = '翻译服务未运行 \\xB7 点击重试';
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
```

- [ ] **Step 2: 验证 inject.js 语法**

```bash
node --check "c:/Program Files/MSC.Software/Adams/2024_1/help/translation/inject.js"
```

期望: 无输出

- [ ] **Step 3: 运行注入脚本**

```bash
node "c:/Program Files/MSC.Software/Adams/2024_1/help/translation/inject.js"
```

期望: 输出扫描/修改/跳过统计，6043 个文件全部标记为 DONE

- [ ] **Step 4: 再次运行确认幂等性**

```bash
node "c:/Program Files/MSC.Software/Adams/2024_1/help/translation/inject.js"
```

期望: Modified=0, Skipped=6043（全部跳过，不重复注入）

- [ ] **Step 5: 抽查一个注入文件验证内容正确**

```bash
grep -c "data-translate-injected" "c:/Program Files/MSC.Software/Adams/2024_1/help/master.htm"
```

期望: `1`

---

### Task 3: recover.js — 批量恢复脚本

**Files:**
- Create: `c:/Program Files/MSC.Software/Adams/2024_1/help/translation/recover.js`

- [ ] **Step 1: 创建 recover.js 完整代码**

```javascript
const fs = require('fs');
const path = require('path');

const HELP_DIR = path.resolve(__dirname, '..');
const MARKER = 'data-translate-injected';

let total = 0, recovered = 0, clean = 0;

function walk(dir) {
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
}

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');

    if (!content.includes(MARKER)) {
        clean++;
        return;
    }

    // 精确移除注入的 <script> 块：从 <script data-translate-injected 到 </script>
    const re = /[\t ]*<script data-translate-injected[^>]*>[\s\S]*?<\/script>\n?/g;
    const newContent = content.replace(re, '');

    if (newContent === content) {
        console.log('  WARN: marker found but regex did not match in', path.relative(HELP_DIR, filePath));
        return;
    }

    fs.writeFileSync(filePath, newContent, 'utf-8');
    recovered++;
    console.log('  DONE:', path.relative(HELP_DIR, filePath));
}

console.log('Scanning help directory...');
walk(HELP_DIR);
console.log('');
console.log('Total scanned:', total);
console.log('Recovered:', recovered);
console.log('Already clean:', clean);
```

- [ ] **Step 2: 验证 recover.js 语法**

```bash
node --check "c:/Program Files/MSC.Software/Adams/2024_1/help/translation/recover.js"
```

期望: 无输出

- [ ] **Step 3: 运行恢复脚本**

```bash
node "c:/Program Files/MSC.Software/Adams/2024_1/help/translation/recover.js"
```

期望: 输出 Recovered=6043, Already clean=0

- [ ] **Step 4: 再次运行确认幂等性**

```bash
node "c:/Program Files/MSC.Software/Adams/2024_1/help/translation/recover.js"
```

期望: Recovered=0, Already clean=6043

- [ ] **Step 5: 抽查文件确认注入已移除**

```bash
grep -c "data-translate-injected" "c:/Program Files/MSC.Software/Adams/2024_1/help/master.htm"
```

期望: `0`

---

### Task 4: setup.bat / recover.bat — 一键配置与恢复

**Files:**
- Create: `c:/Program Files/MSC.Software/Adams/2024_1/help/translation/setup.bat`
- Create: `c:/Program Files/MSC.Software/Adams/2024_1/help/translation/recover.bat`

- [ ] **Step 1: 创建 setup.bat**

```batch
@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   Adams 帮助翻译工具 - 一键配置
echo ========================================
echo.

:: 1. 检查 Node.js
echo [1/5] 检查 Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org
    pause
    exit /b 1
)
echo Node.js 版本:
node --version

:: 2. 注入跳转脚本
echo.
echo [2/5] 注入跳转脚本到帮助文件...
node "%~dp0inject.js"
if %errorlevel% neq 0 (
    echo [错误] 注入失败
    pause
    exit /b 1
)

:: 3. 生成 VBS 启动器
echo.
echo [3/5] 生成后台启动器...
set CURDIR=%~dp0
set CURDIR=%CURDIR:\=\\%
set CURDIR=%CURDIR:~0,-1%
> "%CURDIR%\launch_server.vbs" echo Set ws = CreateObject("WScript.Shell")
>> "%CURDIR%\launch_server.vbs" echo ws.CurrentDirectory = "%CURDIR%"
>> "%CURDIR%\launch_server.vbs" echo ws.Run "cmd /c node server.js >> server.log 2>&1", 0, False
echo launch_server.vbs 已生成

:: 4. 设置开机自启
echo.
echo [4/5] 设置开机自启...
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%STARTUP%\launch_server.lnk'); $s.TargetPath = '%CURDIR%\launch_server.vbs'; $s.WorkingDirectory = '%CURDIR%'; $s.Save()"
if %errorlevel% neq 0 (
    echo [错误] 创建快捷方式失败
    pause
    exit /b 1
)
echo 开机自启已设置

:: 5. 立即启动服务
echo.
echo [5/5] 启动服务...
cscript //B "%CURDIR%\launch_server.vbs"
timeout /t 2 /nobreak >nul

:: 验证启动
if exist "%CURDIR%\server.log" (
    type "%CURDIR%\server.log"
) else (
    echo [警告] 未生成日志文件，服务可能未成功启动
)

echo.
echo ========================================
echo   配置完成！
echo   以后在 Adams 中按 F1，帮助页面会自动跳转，
echo   点击 Edge 地址栏翻译图标即可翻译。
echo ========================================
pause
```

- [ ] **Step 2: 创建 recover.bat**

```batch
@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   Adams 帮助翻译工具 - 一键恢复
echo ========================================
echo.

:: 1. 恢复 HTML 文件
echo [1/3] 恢复帮助文件...
node "%~dp0recover.js"
if %errorlevel% neq 0 (
    echo [错误] 恢复失败
    pause
    exit /b 1
)

:: 2. 停止服务并清理
echo.
echo [2/3] 停止服务...
set CURDIR=%~dp0
set CURDIR=%CURDIR:\=\\%
set CURDIR=%CURDIR:~0,-1%

if exist "%CURDIR%\server.pid" (
    set /p PID=<"%CURDIR%\server.pid"
    tasklist /FI "PID eq !PID!" 2>NUL | find /I "!PID!" >NUL
    if !errorlevel! equ 0 (
        taskkill /PID !PID! >nul 2>&1
        echo 服务进程 PID=!PID! 已停止
    ) else (
        echo 进程 PID=!PID! 已不存在，跳过
    )
    del "%CURDIR%\server.pid"
) else (
    echo 未找到 server.pid，跳过
)

:: 3. 删除开机自启
echo.
echo [3/3] 移除开机自启...
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
if exist "%STARTUP%\launch_server.lnk" (
    del "%STARTUP%\launch_server.lnk"
    echo 开机自启已移除
) else (
    echo 未找到自启项，跳过
)

echo.
echo ========================================
echo   恢复完成！所有帮助文件已恢复原状。
echo ========================================
pause
```

- [ ] **Step 3: 验证 bat 文件语法（BOM/编码）**

```bash
file "c:/Program Files/MSC.Software/Adams/2024_1/help/translation/setup.bat"
file "c:/Program Files/MSC.Software/Adams/2024_1/help/translation/recover.bat"
```

确认文件编码为 ASCII/UTF-8（无 BOM 问题）

---

### Task 5: 端到端集成测试

- [ ] **Step 1: 运行完整配置流程**

```bash
# 以管理员身份运行
cmd /c "c:\Program Files\MSC.Software\Adams\2024_1\help\translation\setup.bat"
```

期望: 5 步全部通过，server.log 包含 "Server started"

- [ ] **Step 2: 验证服务可访问**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8777/__health
```

期望: `200`

- [ ] **Step 3: 验证帮助首页可访问**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8777/master.htm
```

期望: `200`

- [ ] **Step 4: 验证注入文件中的跳转 URL 正确**

打开浏览器访问 `file:///C:/Program Files/MSC.Software/Adams/2024_1/help/master.htm`

期望: 页面自动跳转到 `http://localhost:8777/master.htm`

- [ ] **Step 5: 验证翻译功能**

在 Edge 中打开 `http://localhost:8777/master.htm`，点击地址栏翻译图标

期望: 出现翻译选项，选中中文后可看到翻译结果

- [ ] **Step 6: 运行完整恢复流程**

```bash
cmd /c "c:\Program Files\MSC.Software\Adams\2024_1\help\translation\recover.bat"
```

期望: 3 步全部通过，node 进程已停止

- [ ] **Step 7: 恢复后验证文件已还原**

```bash
grep -r "data-translate-injected" "c:/Program Files/MSC.Software/Adams/2024_1/help/" --include="*.htm" --include="*.html" | wc -l
```

期望: `0`

- [ ] **Step 8: 恢复后重新配置（验证可重复执行）**

再次运行 `setup.bat`，确认一切正常。
