# 对照翻译滚动同步修复 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复对照翻译模式（`?__reader=1`）左右分栏滚动不同步问题，用直接 scrollTop 操作替换 CSS translateY 变换方案。

**Architecture:** 单文件修改 `snippets.js`，替换 HINT 模板字面量中的滚动同步代码段（约第 88-241 行）。三个新辅助函数（`syncScroll`、`offsetTo`、`elAtFrac`）+ 简化的 scroll 事件处理器，防回环用布尔锁。

**Tech Stack:** 纯 JavaScript（注入到浏览器环境执行的脚本），无外部依赖

---

## 修改范围

单文件 `snippets.js`，修改 HINT 模板字面量中 reader mode 部分的以下区域：

| 区域 | 行号 | 改动类型 |
|------|------|----------|
| colStyle 变量 | 89-93 | 移除 will-change/contain CSS |
| inner wrapper HTML | 100, 102 | 移除 will-change:transform |
| 滚动同步系统 | 120-211 | 全部替换 |
| handleLinkClick | 222-235 | 简化锚点跳转 |

---

### Task 1: 移除 colStyle 中无用的 CSS 属性

**文件:** `snippets.js:89-93`

- [ ] **Step 1: 移除 `contain` 和 `will-change`**

将：
```javascript
var colStyle='width:50%;overflow-y:auto;padding:32px 36px;box-sizing:border-box;'+
    'contain:layout style paint;will-change:scroll-position;'+
    'font-family:"Georgia","Noto Serif",serif;font-size:15px;line-height:1.85;color:#333';
```

改为：
```javascript
var colStyle='width:50%;overflow-y:auto;padding:32px 36px;box-sizing:border-box;'+
    'font-family:"Georgia","Noto Serif",serif;font-size:15px;line-height:1.85;color:#333';
```

`contain` 和 `will-change:scroll-position` 是为旧的 transform 方案服务的，新方案用原生 scrollTop 不需要。

- [ ] **Step 2: 验证语法**

运行 `node -c snippets.js`，确保无语法错误。

---

### Task 2: 移除 inner wrapper 上的 will-change:transform

**文件:** `snippets.js:100,102`

- [ ] **Step 1: 移除 left inner 的 will-change**

将第 100 行：
```javascript
+'<div id="_tr_left_inner" style="will-change:transform">'+content+'</div></div>'
```

改为：
```javascript
+'<div id="_tr_left_inner">'+content+'</div></div>'
```

- [ ] **Step 2: 移除 right inner 的 will-change**

将第 102 行：
```javascript
+'<div id="_tr_right_inner" style="will-change:transform">'+content+'</div></div>'
```

改为：
```javascript
+'<div id="_tr_right_inner">'+content+'</div></div>'
```

- [ ] **Step 3: 验证语法**

运行 `node -c snippets.js`，确保无语法错误。

---

### Task 3: 替换整个滚动同步系统

**文件:** `snippets.js:120-211`

删除第 120-211 行（从 `// === 滚动同步系统 ===` 到 `},{passive:true});`），替换为以下代码：

- [ ] **Step 1: 删除旧代码并写入新代码**

```javascript
        // === 滚动同步（直接 scrollTop，锚定 33% 视口高度）===
        var syncing=false;

        function offsetTo(el,container){
            var o=0;
            while(el&&el!==container){
                o+=el.offsetTop;
                el=el.offsetParent;
            }
            return o;
        }

        function elAtFrac(panel,frac){
            var r=panel.getBoundingClientRect();
            var el=document.elementFromPoint(r.left+r.width/2, r.top+r.height*frac);
            while(el&&el!==panel&&(!el.hasAttribute||!el.hasAttribute('data-tr-i'))){
                el=el.parentElement;
            }
            return (el&&el!==panel&&el.hasAttribute('data-tr-i'))?el:null;
        }

        function syncScroll(src,tgt){
            if(syncing)return;
            syncing=true;
            var anchor=elAtFrac(src,0.33);
            if(!anchor){syncing=false;return;}
            var idx=anchor.getAttribute('data-tr-i');
            var tgtEl=tgt.querySelector('[data-tr-i="'+idx+'"]');
            if(!tgtEl){syncing=false;return;}
            var anchorY=offsetTo(anchor,src.firstElementChild)-src.scrollTop;
            tgt.scrollTop=offsetTo(tgtEl,tgt.firstElementChild)-anchorY;
            requestAnimationFrame(function(){syncing=false;});
        }

        left.addEventListener('scroll',function(){syncScroll(left,right);},{passive:true});
        right.addEventListener('scroll',function(){syncScroll(right,left);},{passive:true});
```

- [ ] **Step 2: 验证语法**

运行 `node -c snippets.js`，确保无语法错误。

---

### Task 4: 简化 handleLinkClick 中的锚点跳转

**文件:** `snippets.js:222-235`（行号在 Task 3 替换后会偏移，按内容定位）

- [ ] **Step 1: 移除 switching/followTY/leader 重置逻辑**

将：
```javascript
            if(isSamePage||rawHref.charAt(0)==='#'){
                e.preventDefault();
                var id=resolved.hash?resolved.hash.replace(/^#/,''):'';
                if(id){
                    var target=document.getElementById(id);
                    if(target&&target.hasAttribute('data-tr-i')){
                        switching=true;
                        rightInner.style.transform='';
                        followTY=0;
                        leader='left';
                        switching=false;
                        left.scrollTo({top:target.offsetTop,behavior:'instant'});
                    }
                }
            }
```

改为：
```javascript
            if(isSamePage||rawHref.charAt(0)==='#'){
                e.preventDefault();
                var id=resolved.hash?resolved.hash.replace(/^#/,''):'';
                if(id){
                    var target=document.getElementById(id);
                    if(target&&target.hasAttribute('data-tr-i')){
                        left.scrollTo({top:target.offsetTop,behavior:'instant'});
                    }
                }
            }
```

- [ ] **Step 2: 验证语法**

运行 `node -c snippets.js`，确保无语法错误。

---

### Task 5: 完整验证

- [ ] **Step 1: 语法检查**

```bash
node -c "c:\Program Files\MSC.Software\Adams\2024_1\help\translation\snippets.js"
```
预期：无错误输出。

- [ ] **Step 2: 注入并测试**

```bash
node "c:\Program Files\MSC.Software\Adams\2024_1\help\translation\inject.js"
```
预期：正常注入，无报错。

- [ ] **Step 3: 手动浏览器测试**

打开一个已注入的帮助页面（如 `http://localhost:8777/some_page.htm?__reader=1`）：
1. 确认左右两侧有内容显示
2. 滚动左侧面板，确认右侧同步跟手
3. 滚动右侧面板，确认左侧同步跟手
4. 快速滚动，确认无跳跃和顿挫
5. 点击页面内锚点链接（如有），确认跳转正常
6. 确认左右两侧相同内容在屏幕上方 1/3 处对齐

- [ ] **Step 4: 提交**

```bash
cd "c:\Program Files\MSC.Software\Adams\2024_1\help\translation"
git add snippets.js
git commit -m "fix: replace transform-based scroll sync with direct scrollTop anchoring"
```
