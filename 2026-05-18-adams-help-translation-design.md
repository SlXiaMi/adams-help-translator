# Adams 帮助文件自动翻译 — 设计文档

日期：2026-05-18
版本：4.0（+ 缓存控制、日志重定向、PID 清理）

## 1. 目标

在 Adams 软件中按 F1 时，帮助页面自动从 `file://` 跳转到 `http://localhost:8777/`，使 Edge 浏览器自带翻译功能可用。用户只需以管理员身份运行一次配置脚本，之后永久自动生效，无需额外操作。

## 2. 约束

- 不依赖 AI 翻译，仅使用 Edge 浏览器自带微软翻译
- 一次配置，永久自动生效
- 不接受浏览器扩展方案
- 不额外安装软件（仅使用系统已有的 Node.js）
- 服务在后台静默运行，无命令行窗口，无托盘图标
- 开机自启

## 3. 架构

```
Adams F1
  → Edge 打开 file:///C:/.../help/xxx.htm
  → 注入脚本执行（等 DOM 就绪后）
  → <img> 加载 /__health（无 CORS 限制）
  → 在线: window.location → http://localhost:8777/xxx.htm
  → 不在线: 右下角提示"翻译服务未运行 · 点击重试"，8 秒后消失
  → 跳转后的 http 页面可被 Edge 翻译按钮正常翻译
```

**关键设计决策**：`file://` 页面的 origin 为 `null`，向 `http://localhost` 发 XMLHttpRequest/fetch 会被 CORS 拦截。因此探活方式必须使用无 CORS 限制的资源加载（`<img>` 标签），而非 XHR。

## 4. 文件清单

所有文件位于 `C:\Program Files\MSC.Software\Adams\2024_1\help\translation\`：

| 文件 | 用途 |
|---|---|
| `server.js` | Node.js 静态文件 HTTP 服务，端口 8777 |
| `inject.js` | 向所有 .htm 文件注入自动跳转片段 |
| `recover.js` | 从所有 .htm 文件移除注入片段（恢复原状） |
| `setup.bat` | 一键配置：检查环境 + 注入 + 生成启动器 + 开机自启 + 立即启动 |
| `recover.bat` | 一键恢复：移除注入 + 停止服务 + 删除自启项 |

自动生成文件：
- `launch_server.vbs`：VBS 启动器，静默启动 Node 服务
- `server.pid`：服务进程 PID（用于精确停止）
- `server.log`：服务运行日志（每次启动覆盖）
- 启动文件夹快捷方式：`%APPDATA%\...\Startup\launch_server.lnk`

## 5. 各模块设计

### 5.1 server.js

- 端口：8777
- 根目录：`path.resolve(__dirname, '..')`，即 `help/` 目录
- 路由：
  - `GET /__health`：返回 1×1 透明 PNG，`Content-Type: image/png`，**必须加** `Cache-Control: no-cache, no-store, must-revalidate`（防止浏览器缓存导致服务离线后仍跳转）
  - `GET /*`：映射到本地文件，自动处理子目录
- **路径遍历防护**：`path.normalize` + 前缀匹配，严格限制在 help 根目录内，否则返回 403
- **MIME 类型**：`.html .htm .css .js .json .png .gif .svg .jpg .jpeg .ico .woff .woff2 .ttf .txt .xml`
- 404：文件不存在或不是文件时返回 404
- **日志**：启动成功/端口冲突输出到 console，由 VBS 重定向到 `server.log`
- **PID 文件**：启动后写入 `server.pid`，在 `process.on('exit')` 和 `SIGTERM`/`SIGINT` 中删除

### 5.2 inject.js

- 递归扫描 `../` 下所有 `.htm` 文件（排除 `translation/` 自身）
- 在 `</body>` 前注入跳转片段
- 通过 `data-translate-injected` 属性跳过已注入文件
- 注入后打印：扫描数、修改数、跳过数

### 5.3 注入的跳转片段

```javascript
(function(){
    if(location.protocol !== 'file:') return;

    var rawPath = decodeURIComponent(location.pathname);
    var lowerPath = rawPath.toLowerCase();
    var i = lowerPath.indexOf('/help/');
    if(i === -1) return;
    var rel = rawPath.substring(i + 6).replace(/^\/+/, '');

    var targetUrl = 'http://localhost:8777/' + rel;

    function tryRedirect() {
        // 用 <img> 而非 XHR，因为 file:// 下 XHR 会被 CORS 拦截
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
```

### 5.4 recover.js

- 扫描所有 .htm 文件
- 精确移除 `<script data-translate-injected>` 到 `</script>` 之间的代码块（含标签自身）
- 不影响其他 `<script>` 标签
- 输出恢复文件数

### 5.5 setup.bat

按顺序执行：
1. 检查 `node --version`，不可用则报错退出
2. 运行 `node inject.js`
3. 动态生成 `launch_server.vbs`（路径用 `%~dp0` 自动计算，不硬编码）
4. 用 PowerShell 在启动文件夹创建快捷方式（含工作目录）
5. 通过 `cscript //B` 立即启动服务
6. 等 2 秒后检查 `server.log` 是否启动成功，提示用户结果

### 5.6 recover.bat

按顺序执行：
1. 运行 `node recover.js`
2. **精确停止服务**：读取 `server.pid`，先 `tasklist` 确认进程存在，再 `taskkill /PID`（避免误杀和残留 PID 报错）：
   ```batch
   set /p PID=<server.pid
   tasklist /FI "PID eq %PID%" 2>NUL | find /I "%PID%" >NUL && taskkill /PID %PID%
   ```
3. 删除启动文件夹中的 `launch_server.lnk`
4. 删除 `server.pid`

### launch_server.vbs

```vbscript
Set ws = CreateObject("WScript.Shell")
ws.CurrentDirectory = "<动态路径>"
ws.Run "cmd /c node server.js >> server.log 2>&1", 0, False
```

说明：
- `cmd /c ... >> server.log 2>&1`：将 stdout 和 stderr 都重定向到日志文件，隐藏窗口
- `CurrentDirectory` 设为脚本所在目录，确保 server.js 能找到正确的路径

## 6. 降级行为

| 场景 | 行为 |
|---|---|
| HTTP 服务正常运行 | `<img>` 加载成功 → 跳转到 http://localhost:8777 |
| HTTP 服务未运行 | `<img>` 加载失败 → 留在 file:// 页面，右下角 8 秒提示，可点击重试 |
| 页面路径不含 `/help/` | 不做任何处理 |
| Edge 未弹出翻译提示 | 手动点击地址栏翻译图标即可 |

## 7. 安全

- server.js 用 `path.normalize` + 前缀匹配做路径遍历防护
- localhost 通信不走 Windows 防火墙，无需额外配置
- 注入脚本假设文件编码为 UTF-8
- `recover.bat` 通过 PID 精确杀进程，不影响用户其他 Node 任务

## 8. 用户操作

**配置（仅一次）：**
1. 右键 `setup.bat` → 以管理员身份运行
2. 看到"配置完成"提示即可

**恢复（如需）：**
1. 右键 `recover.bat` → 以管理员身份运行
2. 所有 .htm 文件恢复原状，服务停止，自启项删除

**日常使用（无需任何操作）：**
- Adams 中按 F1 → 自动跳转 → 点击 Edge 地址栏翻译图标 → 中文
