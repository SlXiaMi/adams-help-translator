# 对照翻译滚动同步优化 — 设计文档

日期：2026-05-18
版本：1.0

## 问题

对照翻译（`?__reader=1`）左右分栏滚动时：
1. 同一内容在左右两侧不在一行/同一高度（中英文长度差异，百分比同步先天不对齐）
2. 滚动有顿挫感和跳跃感（`scrollTo()` 触发重布局）

## 方案：元素锚点 + Transform 驱动

### DOM 结构

两侧内容各自包一层 inner wrapper：

```html
<div id="_tr_left" style="overflow-y:auto">
  <div id="_tr_left_inner" style="will-change:transform">
    <h1 data-tr-i="0">...</h1>
    <p  data-tr-i="1">...</p>
    ...
  </div>
</div>
<div id="_tr_right" style="overflow-y:auto">
  <div id="_tr_right_inner" style="will-change:transform">
    <h1 data-tr-i="0">...</h1>
    <p  data-tr-i="1">...</p>
    ...
  </div>
</div>
```

### 同步逻辑

1. 两侧 HTML 注入后，给所有块级子元素按 DFS 顺序打 `data-tr-i` 索引
2. 滚动时 rAF 节流（保留现有机制）
3. 在 leader 面板用 `getBoundingClientRect` 找视口顶部第一个可见元素，读取 `data-tr-i`
4. 计算该元素在 leader 视口中的相对位置比例
5. 在 follower 面板找同 `data-tr-i` 元素，计算 translateY 使该元素出现在同一视觉高度
6. 仅修改 `transform: translateY()`，不触发重布局

### Leader 切换

当用户滚动 follower 侧时（该侧当前有 transform 偏移）：
1. 将 transform 偏移量等效转换为 scrollTop 并生效
2. 重置 transform 为 0
3. 切换 leader/follower 角色

### 对比

| | 旧方案 | 新方案 |
|------|------|------|
| 对齐方式 | 百分比 | 元素锚点 |
| 驱动方式 | scrollTo | transform |
| 高度对齐 | ❌ 错位 | ✅ 同元素同行 |
| 流畅度 | ❌ 重布局 | ✅ GPU 合成 |
| 数据标记 | — | data-tr-i |
