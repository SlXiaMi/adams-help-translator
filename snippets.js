'use strict';

const SNIPPET = `
<script data-translate-injected="true">
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

// 翻译增强：标记导航为 translate=no，内容页提供阅读模式按钮
// URL 加 ?__reader=1 进入左右分栏阅读 + Edge 翻译模式
const HINT = `
<script data-translate-injected="true">
(function(){
    if(location.hostname!=='localhost'&&location.hostname!=='127.0.0.1')return;

    // === READER MODE: ?__reader=1 in URL ===
    if(location.search.indexOf('__reader=1')!==-1){
        document.body.style.visibility='visible';
        // Hide everything, extract content
        var contentEl=document.getElementById('page_content')||
                       document.getElementById('ww_content_container');
        var content=contentEl?contentEl.innerHTML:'';
        if(!content||content.trim().length<50){
            document.body.innerHTML='<p style="color:#999;text-align:center;padding:60px">Content not available</p>';
            return;
        }
        // Remove injected scripts from content
        content=content.replace(/<script[^>]*data-translate-injected[^>]*>[\\s\\S]*?<\\/script>/g,'');

        // Minimalist header
        var title=contentEl?((contentEl.querySelector('h1,h2,h3')||{}).textContent||''):'';
        var headerHtml='<header style="height:44px;display:flex;align-items:center;justify-content:center;'
            +'background:#fafafa;border-bottom:1px solid #eee;flex-shrink:0">'
            +'<span style="font-size:13px;font-weight:500;color:#444;font-family:system-ui,-apple-system,sans-serif;letter-spacing:0.02em">'+title+'</span>'
            +'</header>';

        // Minimalist footer
        var footerHtml='<footer style="height:32px;display:flex;align-items:center;justify-content:center;gap:16px;'
            +'background:#fafafa;border-top:1px solid #eee;flex-shrink:0;font-size:11px;'
            +'font-family:system-ui,-apple-system,sans-serif;color:#999">'
            +'<span style="display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:#b0b0b0;display:inline-block"></span> English</span>'
            +'<span style="color:#ddd">|</span>'
            +'<span style="display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:#c0504d;display:inline-block"></span> 中文翻译</span>'
            +'</footer>';

        // contain/scroll-position 隔离每个面板的布局与绘制,GPU 层提升滚动性能
        // content-visibility 对大面积文档跳过屏外渲染,大文件关键优化
        var colStyle='width:50%;overflow-y:auto;padding:32px 36px;box-sizing:border-box;'+
            'contain:layout style paint;will-change:scroll-position;'+
            'font-family:"Georgia","Noto Serif",serif;font-size:15px;line-height:1.85;color:#333';

        document.body.innerHTML=''
            +'<div style="display:flex;flex-direction:column;height:100vh;background:#fff;margin:0">'
            +headerHtml
            +'<div id="_tr_dual" style="flex:1;display:flex;overflow:hidden">'
            +'<div id="_tr_left" translate="no" style="'+colStyle+';border-right:1px solid #eee;background:#fdfdfd">'
            +'<div id="_tr_left_inner">'+content+'</div></div>'
            +'<div id="_tr_right" style="'+colStyle+';background:#fff">'
            +'<div id="_tr_right_inner">'+content+'</div></div>'
            +'</div>'
            +footerHtml
            +'</div>';

        // 大文档优化：跳过屏外内容块的渲染
        if(content.length>30000){
            var cvStyle=document.createElement('style');
            cvStyle.textContent=
                '#_tr_left_inner>div,#_tr_left_inner>p,#_tr_left_inner>section,#_tr_left_inner>table,#_tr_left_inner>ul,#_tr_left_inner>ol,'+
                '#_tr_right_inner>div,#_tr_right_inner>p,#_tr_right_inner>section,#_tr_right_inner>table,#_tr_right_inner>ul,#_tr_right_inner>ol'+
                '{content-visibility:auto;contain-intrinsic-size:auto 500px}';
            document.head.appendChild(cvStyle);
        }
        var left=document.getElementById('_tr_left'),right=document.getElementById('_tr_right');
        var leftInner=document.getElementById('_tr_left_inner'),rightInner=document.getElementById('_tr_right_inner');

        // === 给两侧 DOM 树中所有元素打索引（DFS 序，两侧完全一致） ===
        var indexAll=function(root){
            var i=0;
            (function walk(el){
                if(el.nodeType===1){el.setAttribute('data-tr-i',i++);}
                for(var c=el.firstChild;c;c=c.nextSibling){walk(c);}
            })(root);
        };
        indexAll(leftInner);
        indexAll(rightInner);

        // === 滚动同步（直接 scrollTop 镜像，零 DOM 查询）===
        var syncing=false;

        left.addEventListener('scroll',function(){
            if(syncing)return;
            syncing=true;
            right.scrollTop=left.scrollTop;
            syncing=false;
        },{passive:true});

        right.addEventListener('scroll',function(){
            if(syncing)return;
            syncing=true;
            left.scrollTop=right.scrollTop;
            syncing=false;
        },{passive:true});

        // === 滚动穿透：一侧到底后，滚轮继续传递给对侧 ===
        left.addEventListener('wheel',function(e){
            if(e.deltaY>0&&left.scrollTop>=left.scrollHeight-left.clientHeight-1){
                syncing=true;
                right.scrollTop=right.scrollTop+e.deltaY;
                requestAnimationFrame(function(){syncing=false;});
            }else if(e.deltaY<0&&left.scrollTop<=0){
                syncing=true;
                right.scrollTop=right.scrollTop+e.deltaY;
                requestAnimationFrame(function(){syncing=false;});
            }
        },{passive:true});

        right.addEventListener('wheel',function(e){
            if(e.deltaY>0&&right.scrollTop>=right.scrollHeight-right.clientHeight-1){
                syncing=true;
                left.scrollTop=left.scrollTop+e.deltaY;
                requestAnimationFrame(function(){syncing=false;});
            }else if(e.deltaY<0&&right.scrollTop<=0){
                syncing=true;
                left.scrollTop=left.scrollTop+e.deltaY;
                requestAnimationFrame(function(){syncing=false;});
            }
        },{passive:true});

        function handleLinkClick(e){
            var a=e.target.closest('a');
            if(!a||!a.href||a.href==='#'||a.getAttribute('href')==='#')return;
            var rawHref=a.getAttribute('href');
            if(!rawHref||rawHref.startsWith('javascript:'))return;

            var resolved=new URL(a.href,location.href);
            var isSamePage=(resolved.origin===location.origin&&
                            resolved.pathname===location.pathname);

            if(isSamePage||rawHref.charAt(0)==='#'){
                e.preventDefault();
                var id=resolved.hash?resolved.hash.replace(/^#/,''):'';
                if(id){
                    var target=document.getElementById(id);
                    if(target&&target.hasAttribute('data-tr-i')){
                        var lr=left.getBoundingClientRect();
                        var tr=target.getBoundingClientRect();
                        left.scrollTo({top:left.scrollTop+tr.top-lr.top,behavior:'instant'});
                    }
                }
            }else{
                e.preventDefault();
                window.open(a.href,'_blank');
            }
        }
        document.body.addEventListener('click',handleLinkClick);

        document.title='Bilingual Reader - '+(contentEl?contentEl.querySelector('h1,h2,h3')?contentEl.querySelector('h1,h2,h3').textContent:'':'');
        return;
    }

    // === NORMAL MODE: mark nav as translate="no" ===
    var skipIds=['menu_content','menu_frame','menu_backdrop','toolbar_div',
        'header_div','footer_div','panels','toc','index','nav_buttons_div',
        'back_to_top','lightbox_background','parcels','modal_container',
        'unsupported_browser_container','progress','noscript_padding',
        'noscript_warning','search_div','search_title','search_iframe',
        'wwconnect_header','page_dates','dropdown_button_container'];
    for(var i=0;i<skipIds.length;i++){
        var el=document.getElementById(skipIds[i]);
        if(el)el.setAttribute('translate','no');
    }
    var crumbs=document.querySelector('.ww_skin_breadcrumbs');
    if(crumbs)crumbs.setAttribute('translate','no');
    var toolbar=document.querySelector('.ww_skin_page_toolbar');
    if(toolbar)toolbar.setAttribute('translate','no');

    // Check if this is a content page
    var contentEl=document.getElementById('page_content')||
                   document.getElementById('ww_content_container');
    if(!contentEl)return;
    if((document.body.textContent||'').length<5000)return;

    // Target the top window so position:fixed works relative to browser viewport
    var topWin=window.top||window;
    var topDoc=topWin.document;

    // Inject styles into top window (so overlay renders correctly there)
    if(!topDoc.getElementById('_tr_styles')){
        var topStyle=topDoc.createElement('style');
        topStyle.id='_tr_styles';
        topStyle.textContent=
        '._tr_overlay{position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483640;'+
        'background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center}'+
        '._tr_reader{position:relative;width:90%;max-width:900px;height:85%;background:#fff;'+
        'border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.3);display:flex;flex-direction:column;overflow:hidden}'+
        '._tr_reader_head{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;'+
        'border-bottom:1px solid #e0e0e0;background:#fafafa;flex-shrink:0}'+
        '._tr_reader_title{font-size:16px;font-weight:600;color:#333;font-family:"Microsoft YaHei",sans-serif}'+
        '._tr_reader_close{cursor:pointer;font-size:22px;color:#888;line-height:1;padding:0 4px}'+
        '._tr_reader_close:hover{color:#333}'+
        '._tr_reader_body{flex:1;overflow-y:auto;padding:24px 32px;color:#222;background:#fff}'+
        '._tr_reader_body *{max-width:100%!important;box-sizing:border-box}'+
        '._tr_reader_body table{width:100%!important}'+
        '._tr_reader_body img{max-width:100%!important;height:auto!important}';
        topDoc.head.appendChild(topStyle);
    }

    // Remove any previous buttons (when navigating between pages in iframe)
    var oldDual=topDoc.getElementById('_tr_dual_btn');
    if(oldDual)oldDual.remove();
    var oldRead=topDoc.getElementById('_tr_read_btn');
    if(oldRead)oldRead.remove();

    // Shared button base — matches Adams help blue/corporate theme
    var btnBase='position:fixed;right:24px;z-index:2147483646;'+
        'min-width:96px;padding:10px 22px;border-radius:8px;'+
        'font-size:14px;font-weight:500;font-family:"Microsoft YaHei","Segoe UI",sans-serif;'+
        'cursor:pointer;text-align:center;line-height:1.5;white-space:nowrap;'+
        'transition:all 0.2s;border:none;margin:0;color:#fff;';

    // Dual View — primary, Adams blue
    var dualBtn=topDoc.createElement('div');
    dualBtn.id='_tr_dual_btn';
    dualBtn.style.cssText=btnBase+'bottom:80px;'+
        'background:#106ebe;box-shadow:0 2px 8px rgba(16,110,190,0.3);';
    dualBtn.textContent='对照翻译';
    dualBtn.onmouseover=function(){dualBtn.style.background='#0e5fa5';dualBtn.style.boxShadow='0 4px 14px rgba(16,110,190,0.4)'};
    dualBtn.onmouseout=function(){dualBtn.style.background='#106ebe';dualBtn.style.boxShadow='0 2px 8px rgba(16,110,190,0.3)'};
    dualBtn.onclick=function(){topWin.open(location.pathname+'?__reader=1','_blank')};
    topDoc.body.appendChild(dualBtn);

    // Reading Mode — secondary, muted blue-gray
    var readBtn=topDoc.createElement('div');
    readBtn.id='_tr_read_btn';
    readBtn.style.cssText=btnBase+'bottom:142px;'+
        'background:#5c7a92;box-shadow:0 2px 8px rgba(0,0,0,0.12);';
    readBtn.textContent='阅读模式';
    readBtn.onmouseover=function(){readBtn.style.background='#4a6378';readBtn.style.boxShadow='0 4px 14px rgba(0,0,0,0.18)'};
    readBtn.onmouseout=function(){readBtn.style.background='#5c7a92';readBtn.style.boxShadow='0 2px 8px rgba(0,0,0,0.12)'};
    topDoc.body.appendChild(readBtn);

    window.addEventListener('beforeunload',function(){
        if(dualBtn.parentNode)dualBtn.remove();
        if(readBtn.parentNode)readBtn.remove();
    });

    var readerOpen=false;

    readBtn.onclick=function(){
        if(readerOpen)return;
        readerOpen=true;
        readBtn.textContent='已开启';
        readBtn.style.background='#3b755f';
        readBtn.style.boxShadow='0 2px 8px rgba(59,117,95,0.3)';

        var content=contentEl.innerHTML;
        if(!content||content.trim().length<50){
            content='<p style="color:#999;text-align:center;padding:40px">Content loading, please retry</p>';
        }

        var overlay=topDoc.createElement('div');
        overlay.className='_tr_overlay';

        var reader=topDoc.createElement('div');
        reader.className='_tr_reader';

        var head=topDoc.createElement('div');
        head.className='_tr_reader_head';
        head.innerHTML='<span class="_tr_reader_title">Reading Mode</span>'
            +'<div style="display:flex;align-items:center;gap:12px">'
            +'<span id="_tr_fs" style="cursor:pointer;font-size:16px;color:#888;padding:2px 6px" title="Fullscreen">&#9974;</span>'
            +'<span class="_tr_reader_close">&times;</span>'
            +'</div>';

        var body=topDoc.createElement('div');
        body.className='_tr_reader_body';
        body.innerHTML=content;

        reader.appendChild(head);
        reader.appendChild(body);
        overlay.appendChild(reader);
        topDoc.body.appendChild(overlay);

        head.querySelector('._tr_reader_close').onclick=closeReader;
        head.querySelector('#_tr_fs').onclick=function(){
            if(topDoc.fullscreenElement)topDoc.exitFullscreen();
            else reader.requestFullscreen();
        };
        overlay.onclick=function(e){
            if(e.target===overlay)closeReader();
        };

        function closeReader(){
            overlay.remove();
            readerOpen=false;
            readBtn.textContent='阅读模式';
            readBtn.style.background='#5c7a92';
            readBtn.style.boxShadow='0 2px 8px rgba(0,0,0,0.12)';
        }
    }
})();
</script>
`;

module.exports = { SNIPPET, HINT };
