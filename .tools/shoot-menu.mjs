import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
const SITE='c:/Users/hasan/hhshanto.github.io/.tools/.site', OUT='c:/Users/hasan/hhshanto.github.io/.tools/shots', PORT=4993;
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{try{let f=join(SITE,decodeURIComponent(new URL(req.url,'http://x').pathname));if(!extname(f))f=join(f,'index.html');res.writeHead(200,{'content-type':MIME[extname(f)]??'application/octet-stream'});res.end(await readFile(f));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(PORT,r));
await mkdir(OUT,{recursive:true});
const b=await chromium.launch();
for (const theme of ['light','dark']) {
  for (const [name,w] of [['phone',375],['tablet',700]]) {
    const ctx=await b.newContext({viewport:{width:w,height:760},deviceScaleFactor:2});
    await ctx.addInitScript(t=>{try{localStorage.setItem('theme',t)}catch{}},theme);
    const p=await ctx.newPage();
    await p.goto(`http://localhost:${PORT}/reflections/`);
    await p.evaluate(()=>document.fonts.ready);
    await p.click('.masthead-disclosure');
    await p.waitForTimeout(250);
    await p.screenshot({path:join(OUT,`menu__${theme}__${name}-${w}.png`)});
    // report geometry of the open panel
    const g = await p.evaluate(()=>{
      const nav=document.getElementById('masthead-nav');
      const bar=document.querySelector('.masthead-bar');
      const r=nav.getBoundingClientRect(), br=bar.getBoundingClientRect();
      const cs=getComputedStyle(nav);
      return {navTop:Math.round(r.top),navLeft:Math.round(r.left),navW:Math.round(r.width),navH:Math.round(r.height),
              barBottom:Math.round(br.bottom),pos:cs.position,bg:cs.backgroundColor,z:cs.zIndex};
    });
    console.log(`${theme}/${name}`, JSON.stringify(g));
    await ctx.close();
  }
}
await b.close(); server.close();
