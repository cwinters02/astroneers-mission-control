/* Smoke test: every tab renders, nothing overflows a phone screen, no console errors.
   Run from the site folder:  NODE_PATH=$(npm root -g) node smoke.cjs   (needs playwright) */
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.argv[2]||'.';const mime={'.html':'text/html','.json':'application/json','.png':'image/png'};
const tabs=['home','coach','players','games','compare','lineups','ratings','club','trophies','profile','stats'];
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'content-type':mime[path.extname(p)]||'x'});r.end(d)})}).listen(0,async()=>{
 const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});const pg=await b.newPage({viewport:{width:390,height:844}});const bad=[];
 pg.on('pageerror',e=>bad.push('pageerror '+e.message));pg.on('console',m=>m.type()==='error'&&bad.push('console '+m.text()));
 const base='http://127.0.0.1:'+srv.address().port+'/';
 for(const t of tabs){await pg.goto(base+'#'+t);await pg.waitForTimeout(500);await pg.evaluate(()=>window.dispatchEvent(new Event('hashchange')));await pg.waitForTimeout(200);
  const r=await pg.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,txt:document.querySelector('#view').innerText.length,err:!!document.querySelector('#view .empty')&&/went wrong/.test(document.querySelector('#view').innerText)}));
  if(r.sw>r.cw+1)bad.push(t+': page scrolls sideways');if(r.txt<200)bad.push(t+': looks empty');if(r.err)bad.push(t+': render error');console.log(t,r.txt,'chars')}
 console.log(bad.length?'FAIL\n'+bad.join('\n'):'ALL TABS OK');await b.close();srv.close();process.exit(bad.length?1:0)});
