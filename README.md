# Adams Help Translator

一键配置工具，让 Adams 2024.1 帮助文件支持 Edge 浏览器翻译，并提供中英对照阅读体验。

## 原理

Adams 按 F1 默认打开 `file://` 协议的本地帮助文件，Edge 翻译功能只对 `http://` 页面生效。本工具解决三个问题：

1. **自动重定向** — 在所有帮助文件中注入跳转脚本，将 `file://` 页面自动重定向到本地 HTTP 服务
2. **后台 HTTP 服务** — Node.js 静态文件服务器，开机自启，无窗口静默运行
3. **翻译增强** — 自动标记导航/TOC 为 `translate="no"`，节省翻译预算给正文；提供对照翻译和阅读模式

## 功能

| 功能 | 说明 |
|------|------|
| 自动跳转 | 打开帮助页面自动从 `file://` 跳转到 `http://localhost:8777` |
| Edge 翻译 | 跳转后可直接使用 Edge 浏览器自带翻译功能 |
| 对照翻译 | 左右分栏并排显示英文原文 + 中文翻译，双向同步滚动 |
| 阅读模式 | 弹窗模态阅读器，支持全屏，提取纯净正文内容 |
| 导航保护 | 自动标记目录、面包屑等 UI 元素跳过翻译，只为正文翻译 |

---

# 操作手册

## 1. 适用环境

| 要求 | 说明 |
|------|------|
| 操作系统 | Windows 10 / Windows 11（64 位） |
| Adams 版本 | Adams 2024.1（其他版本需调整帮助目录路径） |
| 浏览器 | Microsoft Edge（Chromium 内核版本） |
| Node.js | 已随 Adams 2024.1 安装，无需额外安装 |
| 权限 | **管理员权限**（需修改帮助文件并创建开机自启快捷方式） |

> **检查 Node.js：** 打开命令提示符，输入 `node --version`。如果显示版本号，说明可用。如果提示"找不到命令"，说明 Adams 未安装或 Node.js 不在 PATH 中。

## 2. 安装（在新电脑上首次配置）

### 步骤 1：找到 Adams 帮助目录

Adams 帮助目录通常位于：

```
C:\Program Files\MSC.Software\Adams\2024_1\help\
```

如果不在此路径，可通过以下方式查找：
- 在 Adams 中按 F1 → 浏览器地址栏会显示类似 `file:///C:/MSC.Software/.../help/xxx.htm` 的路径
- 或在安装目录下搜索 `master.htm` 文件

### 步骤 2：下载工具文件

**方式一：Git 克隆（推荐）**

```bash
cd "C:\Program Files\MSC.Software\Adams\2024_1\help"
git clone https://github.com/SlXiaMi/adams-help-translator.git translation
```

**方式二：下载 ZIP 包**

1. 浏览器打开 https://github.com/SlXiaMi/adams-help-translator
2. 点击绿色 `Code` 按钮 → `Download ZIP`
3. 解压到 `<帮助目录>\translation\`

最终目录结构应为：

```
help\
├── master.htm
├── ... (其他帮助文件)
└── translation\
    ├── setup.bat
    ├── recover.bat
    ├── server.js
    ├── inject.js
    ├── snippets.js
    ├── recover.js
    └── README.md
```

### 步骤 3：运行配置脚本

1. 右键 `translation\setup.bat`
2. 选择 **以管理员身份运行**
3. 脚本会自动完成 5 个步骤：
   - 检测 Node.js
   - 向所有帮助文件注入跳转和翻译增强脚本
   - 创建后台服务启动器（VBS，无窗口）
   - 配置开机自启（开始菜单→启动文件夹）
   - 启动 HTTP 服务

成功后会显示 `Setup complete!`。

## 3. 验证安装

1. 打开 Adams 软件
2. 按 F1 打开任意帮助页面
3. 观察浏览器地址栏：应从 `file:///...` 自动跳转为 `http://localhost:8777/...`
4. 点击 Edge 地址栏右侧的翻译图标 → 选择"中文(简体)"

**验证对照翻译：**
1. 在任意长文档帮助页面，URL 后手动添加 `?__reader=1` 并回车
2. 应看到左右分栏布局（左侧英文原文 + 右侧可翻译）
3. 滚动任一侧，另一侧应同步跟随
4. 点击右下角"对照翻译"按钮，在新标签页打开完整对照视图

## 4. 日常使用

配置完成后无需任何额外操作：

| 操作 | 效果 |
|------|------|
| Adams 中按 F1 | 自动弹出帮助页面，自动跳转到 `http://localhost:8777` |
| 点击 Edge 地址栏翻译图标 | 选择中文，页面被翻译 |
| URL 加 `?__reader=1` | 进入中英对照阅读模式 |
| 右下角"对照翻译"按钮 | 新标签页打开左右对照视图 |
| 右下角"阅读模式"按钮 | 弹窗纯净阅读，支持全屏 |
| 重启电脑 | 服务自动启动，无需手动干预 |

## 5. 常见问题

### Q: 按 F1 后没有自动跳转？

- 检查服务是否运行：浏览器访问 `http://localhost:8777/__health`，应看到 1×1 透明图片
- 如果无法访问，运行 `translation\setup.bat` 重新启动服务
- 检查防火墙是否拦截了 Node.js

### Q: 跳转后 Edge 没有弹出翻译提示？

这是 Edge 的已知行为——对 `localhost` 地址不会自动弹翻译栏。**手动点击地址栏右侧的翻译图标**即可。

### Q: 对照翻译模式两侧不同步？

偶尔快速滚动可能出现微小偏差，在任一侧手动滚动一下鼠标滚轮即可重新对齐。

### Q: 端口 8777 被占用？

编辑 `server.js`，将 `const PORT = 8777;` 改为其他端口（如 8778）。同时编辑 `snippets.js` 中 SNIPPET 模板里的 `localhost:8777` 为新端口。然后重新运行 `setup.bat`。

### Q: 对照翻译的 URL `?__reader=1` 怎么用？

在任意帮助页面地址栏末尾加上 `?__reader=1` 后回车，例如：

```
http://localhost:8777/some_page.htm?__reader=1
```

也可点击任意帮助页面右下角的"对照翻译"按钮。

### Q: 如何更新到最新版本？

```bash
cd "C:\Program Files\MSC.Software\Adams\2024_1\help\translation"
git pull
node inject.js
```

如果下载的是 ZIP 包，重新下载并解压覆盖，然后重新运行 `setup.bat`。

## 6. 卸载与恢复

1. 右键 `translation\recover.bat` → **以管理员身份运行**
2. 脚本会自动：
   - 移除帮助文件中注入的脚本，恢复原状
   - 停止后台 HTTP 服务
   - 删除开机自启快捷方式

恢复后，Adams 按 F1 将回到原始的 `file://` 页面。

---

## 文件说明

| 文件 | 用途 |
|------|------|
| `server.js` | HTTP 静态文件服务（端口 8777） |
| `inject.js` | 批量注入跳转和增强脚本到所有 .htm/.html 帮助文件 |
| `snippets.js` | 注入的脚本模板（供 inject.js 引用） |
| `recover.js` | 批量移除注入的脚本，恢复帮助文件原状 |
| `launch_server.vbs` | 后台启动器（setup.bat 自动生成，无窗口静默运行） |
| `setup.bat` | 一键配置脚本 |
| `recover.bat` | 一键恢复脚本 |

## 依赖

- Node.js（Adams 2024.1 自带，路径：`C:\Program Files\MSC.Software\Adams\2024_1\Win64\node.exe`）
- Microsoft Edge 浏览器
