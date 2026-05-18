# 对照翻译滚动同步优化 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将对照翻译左右分栏的滚动同步从百分比%驱动改为元素锚点+transform驱动，解决高度不对齐和顿挫感。

**Architecture:** 两个面板内容各自包一层 inner wrapper（`will-change:transform`），左侧作为默认 leader，右侧通过 CSS `transform: translateY()` 跟随。同步算法用 `elementFromPoint` 定位 leader 顶部锚点元素，通过 `data-tr-i` 索引在 follower 中找到对应元素，计算 translateY 使同一内容对齐。

**Tech Stack:** 纯浏览器端 JS，修改 `snippets.js` 中的 `HINT` 模板字符串，需重新注入全部 6043 个 HTML 文件生效。

---

### Task 1: 重写 HINT 模板中的滚动同步代码

**Files:**
- Modify: `c:/Program Files/MSC.Software/Adams/2024_1/help/translation/snippets.js:89-158`

**涉及部分：** snippets.js 中 HINT 模板的 reader mode 区段（`?__reader=1` 分支），需替换：
1. DOM 结构（加 inner wrapper）
2. 滚动同步逻辑（百分比 → 元素锚点 + transform）
3. 锚点链接跳转逻辑

- [ ] **Step 1: 更新 DOM 结构，两侧内容各自包 inner wrapper**

将 `snippets.js` 第 95-103 行的 DOM 构建代码：

```javascript
document.body.innerHTML=''
    +'<div style="display:flex;flex-direction:column;height:100vh;background:#fff;margin:0">'
    +headerHtml
    +'<div id="_tr_dual" style="flex:1;display:flex;overflow:hidden">'
    +'<div id="_tr_left" translate="no" style="'+colStyle+';border-right:1px solid #eee;background:#fdfdfd">'+content+'</div>'
    +'<div id="_tr_right" style="'+colStyle+';background:#fff">'+content+'</div>'
    +'</div>'
    +footerHtml
    +'</div>';
```

替换为（两侧各加一层 inner wrapper）：

```javascript
document.body.innerHTML=''
    +'<div style="display:flex;flex-direction:column;height:100vh;background:#fff;margin:0">'
    +headerHtml
    +'<div id="_tr_dual" style="flex:1;display:flex;overflow:hidden">'
    +'<div id="_tr_left" translate="no" style="'+colStyle+';border-right:1px solid #eee;background:#fdfdfd">'
    +'<div id="_tr_left_inner" style="will-change:transform">'+content+'</div></div>'
    +'<div id="_tr_right" style="'+colStyle+';background:#fff">'
    +'<div id="_tr_right_inner" style="will-change:transform">'+content+'</div></div>'
    +'</div>'
    +footerHtml
    +'</div>';
```

- [ ] **Step 2: 替换滚动同步逻辑（百分比 → 元素锚点 + transform）**

将 `snippets.js` 第 104-128 行的旧同步代码全部删除：

```javascript
// 删除以下全部代码
var left=document.getElementById('_tr_left'),right=document.getElementById('_tr_right');
var syncing=false;

function scrollPct(el){return el.scrollTop/Math.max(1,el.scrollHeight-el.clientHeight)}
function syncScroll(src,dst){...}

var leftRaf=false,rightRaf=false;
left.addEventListener('scroll',function(){...},{passive:true});
right.addEventListener('scroll',function(){...},{passive:true});
```

替换为新的元素锚点 + transform 驱动代码：

```javascript
var left=document.getElementById('_tr_left'),right=document.getElementById('_tr_right');
var leftInner=document.getElementById('_tr_left_inner'),rightInner=document.getElementById('_tr_right_inner');

// === 给两侧 DOM 树中所有元素打索引（DFS 序，两侧完全一致） ===
(function indexAll(root){
    var i=0;
    (function walk(el){
        if(el.nodeType===1){el.setAttribute('data-tr-i',i++);}
        for(var c=el.firstChild;c;c=c.nextSibling){walk(c);}
    })(root);
})(leftInner);
(function indexAll(root){
    var i=0;
    (function walk(el){
        if(el.nodeType===1){el.setAttribute('data-tr-i',i++);}
        for(var c=el.firstChild;c;c=c.nextSibling){walk(c);}
    })(root);
})(rightInner);

// === 滚动同步系统 ===
var leader='left';          // 当前主驱动面板
var followTY=0;             // follower inner 当前的 translateY 值
var switching=false;        // leader 切换中标记
var leftRaf=false,rightRaf=false;

// 用 elementFromPoint 找到面板视口顶部的第一个已索引元素
function anchorAtTop(panel){
    var r=panel.getBoundingClientRect();
    var el=document.elementFromPoint(r.left+r.width/2, r.top+1);
    while(el&&el!==panel&&(!el.hasAttribute||!el.hasAttribute('data-tr-i'))){
        el=el.parentElement;
    }
    return (el&&el!==panel&&el.hasAttribute('data-tr-i'))?el:null;
}

function doSync(){
    if(switching)return;
    var leadPanel=leader==='left'?left:right;
    var followPanel=leader==='left'?right:left;
    var followInner=leader==='left'?rightInner:leftInner;

    // --- Read phase ---
    var anchor=anchorAtTop(leadPanel);
    if(!anchor)return;
    var idx=anchor.getAttribute('data-tr-i');
    var leadPanelRect=leadPanel.getBoundingClientRect();
    var anchorOffset=anchor.getBoundingClientRect().top-leadPanelRect.top;

    // 在 follower 中找到同一索引的元素
    var followEl=followPanel.querySelector('[data-tr-i="'+idx+'"]');
    if(!followEl)return;

    // 计算所需 translateY：
    //   followEl 视觉位置 = followPanelRect.top + el.offsetTop + translateY - followScroll
    //   令其 = leadPanelRect.top + anchorOffset
    var followPanelRect=followPanel.getBoundingClientRect();
    var fScroll=followPanel.scrollTop;
    followTY=leadPanelRect.top+anchorOffset-followPanelRect.top-followEl.offsetTop+fScroll;

    // --- Write phase ---
    followInner.style.transform='translateY('+followTY+'px)';
}

function switchLeader(newLeader){
    switching=true;
    var oldFollowInner=newLeader==='left'?rightInner:leftInner;
    var oldFollowPanel=newLeader==='left'?right:left;

    // 将 follower 的视觉位置转换为真实 scrollTop
    var effectiveScroll=oldFollowPanel.scrollTop-followTY;
    if(effectiveScroll<0)effectiveScroll=0;
    var maxScroll=oldFollowPanel.scrollHeight-oldFollowPanel.clientHeight;
    if(effectiveScroll>maxScroll)effectiveScroll=maxScroll;

    // 重置 transform，提交真实滚动位置
    oldFollowInner.style.transform='';
    followTY=0;
    oldFollowPanel.scrollTop=effectiveScroll;

    leader=newLeader;
    switching=false;
    doSync();   // 新 follower 对齐新 leader
}

left.addEventListener('scroll',function(){
    if(leftRaf)return;
    leftRaf=true;
    requestAnimationFrame(function(){
        leftRaf=false;
        if(leader==='right')switchLeader('left');
        if(leader==='left')doSync();
    });
},{passive:true});

right.addEventListener('scroll',function(){
    if(rightRaf)return;
    rightRaf=true;
    requestAnimationFrame(function(){
        rightRaf=false;
        if(leader==='left')switchLeader('right');
        if(leader==='right')doSync();
    });
},{passive:true});
```

- [ ] **Step 3: 更新锚点链接跳转逻辑**

将 `snippets.js` 第 129-155 行的 `handleLinkClick` 函数中的滚动部分：

```javascript
if(isSamePage||rawHref.charAt(0)=='#'){
    e.preventDefault();
    var id=resolved.hash?resolved.hash.replace(/^#/,''):'';
    if(id){
        var target=document.getElementById(id);
        if(target){
            var pct=target.offsetTop/(target.parentNode.scrollHeight-target.parentNode.clientHeight||1);
            left.scrollTo({top:pct*(left.scrollHeight-left.clientHeight),behavior:'instant'});
            right.scrollTo({top:pct*(right.scrollHeight-right.clientHeight),behavior:'instant'});
        }
    }
}
```

替换为元素锚点跳转：

```javascript
if(isSamePage||rawHref.charAt(0)=='#'){
    e.preventDefault();
    var id=resolved.hash?resolved.hash.replace(/^#/,''):'';
    if(id){
        // 锚点元素在左侧面板中（DOM 顺序左侧在前，getElementById 返回左侧的）
        var target=document.getElementById(id);
        if(target&&target.hasAttribute('data-tr-i')){
            switching=true;
            rightInner.style.transform='';
            followTY=0;
            leader='left';
            switching=false;
            left.scrollTo({top:target.offsetTop,behavior:'instant'});
            // scroll 事件会触发 doSync 对齐右侧
        }
    }
}
```

- [ ] **Step 4: 验证 snippetes.js 语法**

```bash
node --check "c:/Program Files/MSC.Software/Adams/2024_1/help/translation/snippets.js"
```

期望: 无输出（语法正确）

- [ ] **Step 5: 验证 inject.js 能正确引用**

```bash
node -e "const s=require('c:/Program Files/MSC.Software/Adams/2024_1/help/translation/snippets.js');console.log('OK',s.HINT.length)"
```

期望: `OK` + 数字

- [ ] **Step 6: 运行注入并做烟雾测试**

```bash
cd "c:/Program Files/MSC.Software/Adams/2024_1/help/translation" && node inject.js 2>&1 | tail -6
```

期望: Modified > 0（6043 个文件重新注入新代码）

- [ ] **Step 7: 启动服务器，在浏览器中验证**

```bash
# 启动 server
node "c:/Program Files/MSC.Software/Adams/2024_1/help/translation/server.js" &
# 在 Edge 中打开 http://localhost:8777/ 并进入某个内容页面
# 点击「对照翻译」按钮
# 验证：
#   1. 滚动左侧时右侧跟随，同一内容在同一高度
#   2. 滚动右侧时左侧跟随
#   3. 滚动流畅无顿挫
#   4. 点击页面内锚点链接正常跳转
```

- [ ] **Step 8: 提交**

```bash
git add snippets.js
git commit -m "feat: replace percentage-based scroll sync with element-anchored transform sync

- Index all elements in both panes with data-tr-i (DFS order)
- Use elementFromPoint to find anchor at top of leader viewport
- Drive follower via CSS transform: translateY() (GPU compositor only)
- Handle leader/follower switching when user scrolls the follower side

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
