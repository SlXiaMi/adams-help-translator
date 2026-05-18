# 源码优化 — 设计文档

日期：2026-05-18
版本：1.0

## 目标

优化源码结构和代码风格，清理死代码，不改变任何功能。

## 变更清单

### server.js
- 删除死代码：readerStore Map、countText()、splitIntoPages()、POST/GET /__reader 端点（约 110 行）
- var → const/let
- 添加 'use strict'

### inject.js
- 提取 SNIPPET 和 HINT 模板字符串到 snippets.js
- Node.js 部分 var → const/let + 'use strict'
- 注入的脚本内容不变

### snippets.js（新建）
- 导出 SNIPPET 和 HINT 两个常量字符串

### recover.js
- var → const/let
- 添加 'use strict'

### setup.bat
- 修复路径转义写法，使用 "%~dp0" 直接引用

### README.md
- 更新以反映当前功能
