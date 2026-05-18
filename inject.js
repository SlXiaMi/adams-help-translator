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

// 翻译增强：标记导航为 translate=no，内容页提供阅读模式按钮
// URL 加 ?__reader=1 进入左右分栏阅读 + Edge 翻译模式
const HINT = `
<script ${MARKER}="true">
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

        // Two independent panes, synced by scroll percentage.
        // contain:layout isolates each pane; will-change hints the compositor.
        var colStyle='width:50%;overflow-y:auto;padding:32px 36px;box-sizing:border-box;'+
            'contain:layout style paint;will-change:scroll-position;'+
            'font-family:"Georgia","Noto Serif",serif;font-size:15px;line-height:1.85;color:#333';

        document.body.innerHTML=''
            +'<div style="display:flex;flex-direction:column;height:100vh;background:#fff;margin:0">'
            +headerHtml
            +'<div id="_tr_dual" style="flex:1;display:flex;overflow:hidden">'
            +'<div id="_tr_left" translate="no" style="'+colStyle+';border-right:1px solid #eee;background:#fdfdfd">'+content+'</div>'
            +'<div id="_tr_right" style="'+colStyle+';background:#fff">'+content+'</div>'
            +'</div>'
            +footerHtml
            +'</div>';
        // Percentage-based scroll sync: both panes stay at same % regardless of height diff
        var left=document.getElementById('_tr_left'),right=document.getElementById('_tr_right');
        var syncing=false;

        function scrollPct(el){var m=el.scrollHeight-el.clientHeight;return m>0?el.scrollTop/m:0}
        function setScrollPct(el,p){var m=el.scrollHeight-el.clientHeight;el.scrollTop=p*m}

        // Native scrolling on the pane the user interacts with (GPU compositor, smooth).
        // The other pane catches up via rAF percentage sync (~1 frame delay).
        var leftRaf=false,rightRaf=false;
        left.addEventListener('scroll',function(){
            if(syncing||leftRaf)return;
            leftRaf=true;
            requestAnimationFrame(function(){leftRaf=false;syncing=true;setScrollPct(right,scrollPct(left));syncing=false});
        },{passive:true});
        right.addEventListener('scroll',function(){
            if(syncing||rightRaf)return;
            rightRaf=true;
            requestAnimationFrame(function(){rightRaf=false;syncing=true;setScrollPct(left,scrollPct(right));syncing=false});
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
                    if(target){
                        var pct=target.offsetTop/(target.parentNode.scrollHeight-target.parentNode.clientHeight||1);
                        setScrollPct(left,pct);
                        setScrollPct(right,pct);
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

    var btnBase='position:fixed;right:24px;z-index:2147483646;width:108px;'+
        'padding:10px 0;border-radius:8px;text-align:center;cursor:pointer;'+
        'font-size:15px;font-family:"Microsoft YaHei","PingFang SC",sans-serif;'+
        'font-weight:500;line-height:1.4;letter-spacing:0.04em;'+
        'box-shadow:0 2px 8px rgba(0,0,0,0.12);transition:all 0.2s;'+
        'margin:0;border:none;white-space:nowrap';

    // Dual View button — primary
    var dualBtn=topDoc.createElement('div');
    dualBtn.id='_tr_dual_btn';
    dualBtn.style.cssText=btnBase+'bottom:24px;'
        +'background:#fff;color:#333;border:1px solid #ddd';
    dualBtn.textContent='对照翻译';
    dualBtn.onmouseover=function(){dualBtn.style.boxShadow='0 4px 16px rgba(0,0,0,0.18)';dualBtn.style.borderColor='#bbb'};
    dualBtn.onmouseout=function(){dualBtn.style.boxShadow='0 2px 8px rgba(0,0,0,0.12)';dualBtn.style.borderColor='#ddd'};
    dualBtn.onclick=function(){topWin.open(location.pathname+'?__reader=1','_blank')};
    topDoc.body.appendChild(dualBtn);

    // Reading Mode button — secondary
    var readBtn=topDoc.createElement('div');
    readBtn.id='_tr_read_btn';
    readBtn.style.cssText=btnBase+'bottom:78px;'
        +'background:#fff;color:#666;border:1px solid #eee';
    readBtn.textContent='阅读模式';
    readBtn.onmouseover=function(){readBtn.style.boxShadow='0 4px 16px rgba(0,0,0,0.18)';readBtn.style.borderColor='#bbb'};
    readBtn.onmouseout=function(){readBtn.style.boxShadow='0 2px 8px rgba(0,0,0,0.12)';readBtn.style.borderColor='#eee'};
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
        readBtn.style.color='#107c10';readBtn.style.borderColor='#107c10';

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
            readBtn.style.color='#666';readBtn.style.borderColor='#eee';
        }
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

    if (content.includes(MARKER)) {
        skipped++;
        console.log('  SKIP:', path.relative(HELP_DIR, filePath));
        return;
    }

    const idx = content.lastIndexOf('</body>');
    if (idx === -1) {
        console.log('  WARN: no </body> in', path.relative(HELP_DIR, filePath));
        return;
    }

    const newContent = content.slice(0, idx) + SNIPPET + '\n' + HINT + '\n' + content.slice(idx);
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
