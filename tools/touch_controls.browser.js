// Playwright CLI run-code; run against the current site in Chromium and WebKit.
async page => {
  const browser = page.context().browser(), engine = browser.browserType().name();
  const context = await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const p = await context.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  const check = (ok, text) => { if (!ok) throw new Error(text); };
  try {
    await p.goto(page.url());
    await p.evaluate(() => {
      App.startAI('normal'); App.paused=true; App.R.setVenue('arena'); App.R.clearFx(); App.pausedDrawn=false;
      window.touchEnds=[]; document.addEventListener('touchend', e=>touchEnds.push(e.defaultPrevented));
    });
    for (const action of ['jump','clear','drop','smash']) for(let i=0;i<8;i++) await p.locator('.arc .t-'+action).tap();
    const taps=await p.evaluate(()=>({counts:{...App.ctrlFor[0].counts},scale:visualViewport.scale,ends:touchEnds}));
    check(Object.values(taps.counts).every(n=>n===8),'Rapid taps lost or duplicated');
    check(taps.scale===1 && taps.ends.length===32 && taps.ends.every(Boolean),'Touch zoom prevention failed');
    const controls = await p.evaluate(() => {
      const c=App.ctrlFor[0], pad=document.querySelector('.move-pad');
      const left=pad.querySelector('.move-left'), right=pad.querySelector('.move-right');
      const action=btn=>document.querySelector('.arc .t-'+btn);
      const center=b=>{const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};};
      const emit=(el,type,id,point=center(el))=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',button:0,clientX:point.x,clientY:point.y}));
      const require=(ok,text)=>{if(!ok)throw new Error(text);};
      YY.Input.releaseAll();
      emit(left,'pointerdown',71); require(c.touchDir===-1,'Left not held');
      emit(right,'pointerdown',72); require(c.touchDir===1,'Newest direction not selected');
      emit(right,'pointerup',72); require(c.touchDir===-1,'Releasing right cancelled held left');
      emit(left,'pointercancel',71); require(c.touchDir===0,'Cancel left left stale movement');
      emit(left,'pointerdown',73); emit(right,'pointerdown',74); emit(left,'lostpointercapture',73);
      require(c.touchDir===1,'Capture loss on left cancelled right');
      emit(right,'pointerup',74); require(c.touchDir===0,'Movement did not stop');
      emit(left,'pointerdown',75); emit(left,'pointermove',75,center(right)); require(c.touchDir===1,'Sliding did not change direction');
      emit(left,'pointermove',75,{x:400,y:100}); require(c.touchDir===0,'Sliding outside did not stop');
      emit(left,'pointermove',75,center(left)); require(c.touchDir===-1,'Returning to arrow failed');
      emit(left,'pointerup',75);
      // Different actions and movement must survive independent release/cancel order.
      let combinations=0;
      for(const first of ['jump','clear','drop','smash']) for(const second of ['jump','clear','drop','smash']) {
        if(first===second)continue;
        YY.Input.releaseAll(); const before={...c.counts};
        emit(right,'pointerdown',80); emit(action(first),'pointerdown',81); emit(action(second),'pointerdown',82);
        require(c.touchDir===1 && c.counts[first]===before[first]+1 && c.counts[second]===before[second]+1,'Multi-key down conflict');
        emit(action(first),'pointerup',81);
        require(c.touchDir===1 && action(second).classList.contains('down'),'One release cancelled another key');
        emit(right,'pointercancel',80); require(c.touchDir===0 && action(second).classList.contains('down'),'Move cancellation cancelled action');
        emit(action(second),'lostpointercapture',82); require(!action(second).classList.contains('down'),'Lost capture left action stuck');
        combinations++;
      }
      // Two fingers on the same button each count once; duplicate pointer events do not.
      const b=action('clear'), before=c.counts.clear;
      emit(b,'pointerdown',91); emit(b,'pointerdown',91); emit(b,'pointerdown',92);
      require(c.counts.clear===before+2,'Overlapping taps lost/duplicated');
      emit(b,'pointerup',91); require(b.classList.contains('down'),'First finger cleared second finger');
      emit(b,'pointerup',92); require(!b.classList.contains('down'),'Last finger left button stuck');
      b.dispatchEvent(new PointerEvent('click',{bubbles:true,pointerType:'touch',detail:0}));
      require(c.counts.clear===before+2,'Synthetic touch click duplicated action');
      emit(left,'pointerdown',93); emit(action('jump'),'pointerdown',94); YY.Input.releaseAll();
      require(c.touchDir===0 && !c.queue.length && !document.querySelector('#touch .down'),'Release all did not clear input');
      const dbl=new MouseEvent('dblclick',{bubbles:true,cancelable:true}); document.querySelector('#game').dispatchEvent(dbl);
      return {combinations,oppositePriority:true,slideDirection:true,independentRelease:true,overlappingTaps:true,reset:true,dblBlocked:dbl.defaultPrevented};
    });
    check(controls.dblBlocked,'Double tap zoom not blocked');
    let nativeMultiTouch=false;
    if(engine==='chromium') {
      const cdp=await context.newCDPSession(p);
      const center=async selector=>{const r=await p.locator(selector).boundingBox();return{x:r.x+r.width/2,y:r.y+r.height/2};};
      const right={...await center('.move-right'),id:1}, jump={...await center('.arc .t-jump'),id:2}, smash={...await center('.arc .t-smash'),id:3};
      const before=await p.evaluate(()=>({...App.ctrlFor[0].counts}));
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[right]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[right,jump]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[right,jump,smash]});
      await p.waitForFunction(b=>App.ctrlFor[0].touchDir===1 && App.ctrlFor[0].counts.jump===b.jump+1 && App.ctrlFor[0].counts.smash===b.smash+1,before);
      // CDP releases the listed IDs (rather than treating the list as remaining fingers).
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[jump]});
      await p.waitForFunction(()=>App.ctrlFor[0].touchDir===1 && document.querySelector('.t-smash').classList.contains('down'));
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[smash]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await p.waitForFunction(()=>App.ctrlFor[0].touchDir===0 && !document.querySelector('#touch .down'));
      nativeMultiTouch=true;
    }
    const layouts=[];
    for(const [width,height] of [[568,320],[844,390],[390,844]]) {
      await p.setViewportSize({width,height});
      // App deliberately reapplies the viewport 250ms after orientationchange.
      await p.waitForTimeout(300);
      await p.evaluate(()=>{YY.forceLand=innerHeight>innerWidth;App.applyViewport();App.pausedDrawn=false;App.render(0);});
      const geometry=await p.evaluate(()=>{
        const vp=YY.viewport();
        const moves=[...document.querySelectorAll('.move-btn')].map(el=>YY.appRect(el));
        const shots=[...document.querySelectorAll('.arc .tbtn')].map(el=>({label:el.getAttribute('aria-label'),...YY.appRect(el)}));
        const centers=shots.map(r=>({x:r.left+r.width/2,y:r.top+r.height/2,r:r.width/2}));
        let minGap=Infinity;
        for(let i=0;i<centers.length;i++)for(let j=i+1;j<centers.length;j++)minGap=Math.min(minGap,Math.hypot(centers[i].x-centers[j].x,centers[i].y-centers[j].y)-centers[i].r-centers[j].r);
        return{vp,moves,shots,minGap};
      });
      const {vp,moves,shots,minGap}=geometry;
      check(moves.length===2 && moves[1].left-moves[0].left-moves[0].width>=10,'Arrow targets overlap');
      check([...moves,...shots].every(r=>r.width>=48&&r.left>=0&&r.top>=0&&r.left+r.width<=vp.W+1&&r.top+r.height<=vp.H+1),'Controls outside viewport or too small');
      check(minGap>=8 && moves.every(a=>shots.every(b=>a.left+a.width<=b.left || a.top>=b.top+b.height)),'Movement/action target conflict');
      const jump=shots.find(b=>b.label==='跳');
      check(shots.filter(b=>b!==jump).every(b=>b.width<jump.width),'Jump target too small');
      // Press at physical screen coordinates after CSS rotation, then resize during a hold.
      await p.evaluate(()=>{
        const b=document.querySelector('.move-left'),r=b.getBoundingClientRect();
        b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:121,pointerType:'touch',button:0,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));
      });
      check(await p.evaluate(()=>App.ctrlFor[0].touchDir)===-1,`Direction wrong at ${width}x${height}`);
      await p.evaluate(()=>App.applyViewport());
      check(await p.evaluate(()=>App.ctrlFor[0].touchDir===0 && !document.querySelector('#touch .down')),'Rotation left input held');
      await p.locator('.arc .t-clear').tap();
      layouts.push({width,height,rot:vp.rot,arrowSize:Math.round(moves[0].width),gap:Math.round(minGap)});
      await p.screenshot({path:`output/playwright/arrows-${engine}-${width}.png`});
    }
    await p.setViewportSize({width:844,height:390});
    await p.evaluate(()=>{YY.forceLand=false;App.applyViewport();App.show('help');});
    const help=p.locator('#scr-help .panel');
    await help.evaluate(el=>el.scrollTop=150); check(await help.evaluate(el=>el.scrollTop)>0,'Help scrolling broken');
    await help.evaluate(el=>el.scrollTop=0); await p.locator('#scr-help button[data-go="menu"]').tap();
    check(await p.evaluate(()=>App.screen)==='menu','Menu taps swallowed');
    await p.evaluate(()=>{App.startLocal();App.paused=true;App.R.clearFx();App.pausedDrawn=false;App.render(0);});
    const duo=await p.evaluate(()=>{
      const emit=(selector,type,id)=>document.querySelector(selector).dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:'touch',button:0}));
      emit('.move-pad.left .move-right','pointerdown',131);emit('.move-pad.right .move-left','pointerdown',132);
      const directions=App.ctrlFor.map(c=>c.move());
      emit('.move-pad.left .move-right','pointerup',131);const after=App.ctrlFor.map(c=>c.move());
      emit('.mini-arc.left .t-jump','pointerdown',133);emit('.mini-arc.right .t-jump','pointerdown',134);
      const jumps=App.ctrlFor.map(c=>c.counts.jump);YY.Input.releaseAll();
      return{directions,after,jumps,cleared:App.ctrlFor.every(c=>c.move()===0)&&!document.querySelector('#touch .down')};
    });
    check(duo.directions.every(n=>n===1) && duo.after[0]===0 && duo.after[1]===1 && duo.jumps.every(n=>n===1) && duo.cleared,'Local two-player controls interfere');
    for(const width of [568,844]) {
      await p.setViewportSize({width,height:390});await p.evaluate(()=>{App.applyViewport();App.pausedDrawn=false;App.render(0);});
      const overlap=await p.evaluate(()=>{
        const move=[...document.querySelectorAll('.move-btn')].map(YY.appRect),shot=[...document.querySelectorAll('.mini-arc .tbtn')].map(YY.appRect);
        return move.some(a=>shot.some(b=>a.left<b.left+b.width&&a.left+a.width>b.left&&a.top<b.top+b.height&&a.top+a.height>b.top));
      });
      check(!overlap,'Two-player arrow/action targets overlap');
      await p.screenshot({path:`output/playwright/arrows-${engine}-duo-${width}.png`});
    }
    check(errors.length===0,errors.join(';'));
    return{engine,taps:taps.counts,controls,nativeMultiTouch,layouts,duo,errors};
  } finally { await context.close(); }
}
