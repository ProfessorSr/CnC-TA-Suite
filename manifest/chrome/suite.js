(() => {
  'use strict';
  if (window.CnCTASuite) return;

  const VERSION = '0.1.0';
  const PREFIX = 'cnc-ta-suite:';

  class EventBus {
    constructor(){ this.listeners = new Map(); }
    on(name, fn){ if(!this.listeners.has(name)) this.listeners.set(name,new Set()); this.listeners.get(name).add(fn); return () => this.off(name,fn); }
    off(name, fn){ this.listeners.get(name)?.delete(fn); }
    emit(name, payload){ for(const fn of this.listeners.get(name) || []) { try { fn(payload); } catch(e) { console.error('[CnC-TA-Suite]',e); } } }
  }

  class Store {
    get(key, fallback=null){ try { const value=localStorage.getItem(PREFIX+key); return value===null?fallback:JSON.parse(value); } catch { return fallback; } }
    set(key, value){ localStorage.setItem(PREFIX+key, JSON.stringify(value)); }
  }

  class WindowManager {
    constructor(store){ this.store=store; this.z=2147482000; }
    create(id,title,content,{x=90,y=120,width=390}={}){
      const saved=this.store.get('window:'+id,{x,y,width,open:false});
      const win=document.createElement('section'); win.className='cts-window'; win.dataset.ctsWindow=id;
      win.style.left=saved.x+'px'; win.style.top=saved.y+'px'; win.style.width=saved.width+'px'; win.style.display=saved.open?'block':'none';
      win.innerHTML=`<header class="cts-titlebar"><strong>${title}</strong><span class="cts-small">v${VERSION}</span><button title="Close">×</button></header><div class="cts-body"></div>`;
      document.body.appendChild(win);
      win.querySelector('.cts-body').append(content);
      win.querySelector('header button').onclick=()=>this.hide(id);
      win.addEventListener('mousedown',()=>win.style.zIndex=String(++this.z));
      this.drag(win,win.querySelector('.cts-titlebar'),id);
      return win;
    }
    drag(win,bar,id){ let sx=0,sy=0,ox=0,oy=0,moving=false;
      bar.addEventListener('mousedown',e=>{ if(e.target.tagName==='BUTTON')return; moving=true;sx=e.clientX;sy=e.clientY;ox=win.offsetLeft;oy=win.offsetTop;e.preventDefault(); });
      addEventListener('mousemove',e=>{ if(!moving)return;win.style.left=Math.max(0,ox+e.clientX-sx)+'px';win.style.top=Math.max(0,oy+e.clientY-sy)+'px'; });
      addEventListener('mouseup',()=>{ if(!moving)return;moving=false;this.persist(id,win); });
    }
    persist(id,win){ this.store.set('window:'+id,{x:win.offsetLeft,y:win.offsetTop,width:win.offsetWidth,open:win.style.display!=='none'}); }
    toggle(id){ const w=document.querySelector(`[data-cts-window="${id}"]`); if(!w)return; w.style.display=w.style.display==='none'?'block':'none'; this.persist(id,w); }
    hide(id){ const w=document.querySelector(`[data-cts-window="${id}"]`); if(w){w.style.display='none';this.persist(id,w);} }
  }

  class ModuleRegistry {
    constructor(ctx){this.ctx=ctx;this.modules=new Map();}
    register(module){this.modules.set(module.id,module);module.mount(this.ctx);}
  }

  const bus=new EventBus(); const store=new Store(); const windows=new WindowManager(store);
  const suite={version:VERSION,bus,store,windows,modules:null,game:{ready:false,application:null}};
  suite.modules=new ModuleRegistry(suite); window.CnCTASuite=suite;

  function launcher(){
    const node=document.createElement('nav');node.className='cts-launcher';node.title='CnC-TA-Suite';
    node.innerHTML='<button data-open="battle" title="Battle Simulator">⚔</button><button data-open="about" title="Suite Status">◈</button>';
    node.addEventListener('click',e=>{const id=e.target.dataset.open;if(id)windows.toggle(id);});document.body.appendChild(node);
  }

  const AboutModule={id:'about',mount(ctx){const body=document.createElement('div');body.innerHTML=`<div class="cts-status" data-ready>Waiting for game API…</div><div class="cts-row"><b>CnC-TA-Suite</b><span class="cts-small">clean foundation</span></div><div class="cts-grid"><div class="cts-card"><b>Shared runtime</b><span class="cts-small">Events, storage, windows and modules.</span></div><div class="cts-card"><b>Reference pack</b><span class="cts-small">68 scripts inventoried.</span></div></div>`;ctx.windows.create('about','Suite Status',body,{x:70,y:165,width:370});ctx.bus.on('game:ready',()=>{const n=body.querySelector('[data-ready]');n.textContent='Game API connected';n.classList.add('ready');});}};

  const BattleModule={id:'battle',mount(ctx){const body=document.createElement('div');body.innerHTML=`<div class="cts-status" data-battle-status>Battle adapter waiting for game API…</div><div class="row cts-row"><button class="cts-button" data-test>Check connection</button><label><input type="checkbox" data-auto> Auto simulate</label></div><div class="cts-grid"><div class="cts-card"><b>Defender</b><span class="cts-small">Result model will appear here.</span></div><div class="cts-card"><b>Own repairs</b><span class="cts-small">Normalized repair totals.</span></div><div class="cts-card"><b>Loot</b><span class="cts-small">Resource projections.</span></div><div class="cts-card"><b>Formation</b><span class="cts-small">Live army-change integration.</span></div></div><p class="cts-small">v0.1.0 intentionally uses no TABS runtime. It establishes the independent suite foundation before the battle request/result adapter is connected.</p>`;
      const win=ctx.windows.create('battle','Combat Simulator',body,{x:125,y:130,width:430});
      const status=body.querySelector('[data-battle-status]'); const auto=body.querySelector('[data-auto]'); auto.checked=ctx.store.get('battle:auto',false);auto.onchange=()=>ctx.store.set('battle:auto',auto.checked);
      const update=()=>{status.textContent=ctx.game.ready?'Connected to ClientLib — battle adapter ready for implementation.':'Game API is not ready.';status.classList.toggle('ready',ctx.game.ready);};
      body.querySelector('[data-test]').onclick=update;ctx.bus.on('game:ready',update);update();
    }};

  function detectGame(){
    try {
      const app=window.qx?.core?.Init?.getApplication?.();
      if(app && window.ClientLib){suite.game.ready=true;suite.game.application=app;bus.emit('game:ready',app);return true;}
    } catch(e){console.debug('[CnC-TA-Suite] waiting',e);}
    return false;
  }

  function start(){launcher();suite.modules.register(AboutModule);suite.modules.register(BattleModule);if(!detectGame()){const timer=setInterval(()=>{if(detectGame())clearInterval(timer);},1000);}console.info(`[CnC-TA-Suite] v${VERSION} started`);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
