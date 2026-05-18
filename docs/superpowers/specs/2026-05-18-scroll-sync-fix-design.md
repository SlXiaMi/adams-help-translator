# 对照翻译滚动同步修复设计

## 问题

对照翻译模式（`?__reader=1`）左右分栏滚动不同步。旧方案使用 CSS `translateY` 变换模拟右侧面板的滚动位置，导致跳跃、卡顿和精度丢失。

## 根因

旧方案采用 Leader-Follower + CSS Transform 架构：
- 右侧面板真实 `scrollTop` 始终为 0，视觉位置由 `_tr_right_inner` 的 `transform: translateY()` 模拟
- Leader 切换时需要将 transform 偏移"转换"回 scrollTop，累积误差会逐渐偏离
- 每帧需要 `elementFromPoint` + `querySelector` + 多次 `getBoundingClientRect`，成本高
- 对齐锚点在视口顶部（0px），而非用户的阅读视线位置

## 方案：直接 scrollTop 同步 + 元素锚定

### 核心思路

扔掉 CSS Transform 间接方案，直接操作两个面板的 `scrollTop`。两侧 DOM 结构完全一致且已通过 `data-tr-i` 索引，同一索引元素可直接定位。

### 对齐位置

屏幕上方 1/3 处（视口高度 33%），这是自然阅读视线所在位置。

### 算法

```
1. 用户滚动面板 A（源面板）
2. 在 A 的 33% 视口高度处, 用 elementFromPoint 找到已索引元素 el_A
3. 拿到 el_A 的 data-tr-i 索引 N
4. 在面板 B 中用 querySelector('[data-tr-i="N"]') 找到 el_B
5. 计算 el_A 在 A 中的视觉偏移: anchorY = offsetTo(el_A, A.inner) - A.scrollTop
6. 设置 B.scrollTop = offsetTo(el_B, B.inner) - anchorY
```

### 防回环

设置 `B.scrollTop` 会触发 B 的 scroll 事件，该事件又会尝试同步回 A。用一个 `syncing` 布尔锁：

```javascript
var syncing = false;

function syncScroll(srcPanel, tgtPanel) {
    if (syncing) return;   // 锁已持有，跳过
    syncing = true;
    // ... 执行同步 ...
    requestAnimationFrame(function() { syncing = false; });  // 下一帧释放
}
```

scroll 事件是异步入队的，在当前帧设置 scrollTop 后，对侧 scroll 事件在下一帧之前触发时 `syncing` 仍为 true，被正确拦截。

### 三个核心函数

1. **syncScroll(srcPanel, tgtPanel)** — 主同步函数，30 行
2. **offsetTo(el, container)** — 沿 offsetParent 链计算元素到容器的累计 offsetTop
3. **elAtFrac(panel, frac)** — 返回面板中 fractionFromTop 位置的已索引元素

### 辅助：链接点击处理简化

旧方案 `handleLinkClick` 中复杂的 leader 切换逻辑替换为直接 `scrollTo({top: target.offsetTop, behavior: 'instant'})`。

## 改动范围

单文件：`snippets.js` 中 HINT 脚本的滚动同步部分（约第 120-211 行）

### 删除
- `leader`、`followTY`、`switching`、`leftRaf`、`rightRaf` 变量
- `doSync()` 函数
- `switchLeader()` 函数（~25 行）
- `anchorAtTop()` 替换为 `elAtFrac()`
- inner wrapper 上的 `will-change:transform`、`contain:layout style paint` CSS
- handleLinkClick 中的 switching/followTY/leader 重置逻辑

### 新增
- `syncing` 变量
- `syncScroll(srcPanel, tgtPanel)` 函数
- `offsetTo(el, container)` 函数
- `elAtFrac(panel, frac)` 函数

### 修改
- 左右 scroll 事件处理器简化为调用 `syncScroll(left, right)` / `syncScroll(right, left)`
- handleLinkClick 锚点跳转简化为直接 scrollTo
- inner wrapper style 移除 will-change 和 contain 声明

## 预期效果

- 左右两侧相同内容精确对齐在屏幕 1/3 处
- 滚动跟手，无滞后感（scrollTop 同步赋值，当前帧生效）
- 无跳跃或顿挫（每次独立计算，无累积状态）
- 代码量从 ~90 行降到 ~40 行

## 风险与边界

- `elementFromPoint` 可能因 F12 DevTools 面板遮挡返回错误元素，但这只影响开发调试场景，不影响正常使用
- 如果 Edge 翻译后某些元素被移除/替换导致 querySelector 找不到索引元素，本次同步会跳过（静默降级，不影响滚动）
- 极快速度滚动时可能丢帧，但因每次同步独立计算，不会累积偏差
