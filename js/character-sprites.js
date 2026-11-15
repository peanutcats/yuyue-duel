/* Painted character art, shared by portraits and both articulated courts. */
(function(G){
  'use strict';
  const Y=G.YY,data=Y.CharacterSpriteData,cache=new Map(),packages=new Map();
  let warming=null,cacheEpoch=0;
  const names=new Map(Object.entries(data.characters).map(([id,c])=>[c.name,id]));
  const script=G.document?.currentScript?.src;
  const webRoot=script?new URL('../assets/characters/painted/',script).href:'assets/characters/painted/';
  const idOf=look=>typeof look==='string'?(data.characters[look]?look:names.get(look)):names.get(look?.name);
  const info=look=>data.characters[idOf(look)];
  const url=(look,kind='portrait')=>{
    const id=idOf(look),meta=data.characters[id];if(!meta)return null;
    return Y.platform.wx?(G.document?'/minigame/':'')+meta.package+'/'+id+'/'+kind+'.png':webRoot+id+'/'+kind+'.png?v='+data.revision;
  };
  function packageReady(meta){
    const wx=Y.platform.wx;if(!wx?.loadSubpackage)return Promise.resolve();
    if(!packages.has(meta.package))packages.set(meta.package,new Promise((resolve,reject)=>wx.loadSubpackage({name:meta.package,success:resolve,fail:reject})).catch(e=>{packages.delete(meta.package);throw e;}));
    return packages.get(meta.package);
  }
  function request(look,kind){
    const id=idOf(look),meta=data.characters[id];if(!meta)return null;
    const key=id+'/'+kind;let entry=cache.get(key);
    if(entry){entry.used=Date.now();if(!entry.failed||Date.now()-entry.usedAtFailure<15000)return entry;cache.delete(key);}
    const image=Y.platform.wx?.createImage?.()||(typeof G.Image==='function'?new G.Image():null);
    if(!image)return null;
    entry={image,ready:false,used:Date.now(),listeners:new Set()};cache.set(key,entry);
    entry.promise=new Promise(resolve=>{
      const finish=ok=>{entry.ready=ok;entry.failed=!ok;entry.usedAtFailure=Date.now();for(const fn of entry.listeners)if(ok)fn(image);entry.listeners.clear();resolve(ok?image:null);trim(kind);};
      image.onload=()=>finish(true);image.onerror=()=>finish(false);
      packageReady(meta).then(()=>{image.src=url(id,kind);},()=>finish(false));
    });
    return entry;
  }
  function trim(kind){
    // Keep the finite collection's portraits decoded (about 25 MiB). Match
    // atlases remain separately bounded; browsing must not evict earlier art.
    const limit=kind==='avatar'?32:kind==='portrait'?Object.keys(data.characters).length:(Y.CharacterSprites?.cacheLimit||6);
    const entries=[...cache].filter(([key,e])=>key.endsWith('/'+kind)&&e.ready).sort((a,b)=>b[1].used-a[1].used);
    for(const [key]of entries.slice(limit))cache.delete(key);
  }
  const image=(look,kind)=>{const e=request(look,kind);return e?.ready?e.image:null;};
  const ready=(look,kind)=>!!cache.get(idOf(look)+'/'+kind)?.ready;
  function watch(look,kind,fn){const e=request(look,kind);if(!e)return;if(e.ready)fn(e.image);else if(!e.failed)e.listeners.add(fn);}
  const load=(look,kinds=['portrait','avatar','rig'])=>Promise.all(kinds.map(k=>request(look,k)?.promise||Promise.resolve(null)));
  function warmPortraits(preferred){
    const id=idOf(preferred);
    if(warming){
      const at=warming.queue.indexOf(id);if(at>0)warming.queue.unshift(...warming.queue.splice(at,1));
      return warming.promise;
    }
    const queue=Object.keys(data.characters).filter(key=>!ready(key,'portrait'));
    const at=queue.indexOf(id);if(at>0)queue.unshift(...queue.splice(at,1));
    const job={queue,epoch:cacheEpoch};warming=job;
    const worker=async()=>{while(job.epoch===cacheEpoch&&job.queue.length)await load(job.queue.shift(),['portrait']);};
    // Limit background decoding/downloads; a selected character can still
    // request its own image immediately instead of waiting behind the queue.
    job.promise=Promise.all([worker(),worker()]).then(()=>{if(warming===job)warming=null;});
    return job.promise;
  }
  function avatar(g,look,size){const img=image(look,'avatar');if(!img)return false;g.drawImage(img,0,0,size,size);return true;}
  function figure(g,look,x,y,w,h,time=0){
    const entry=request(look,'portrait'),meta=info(look);if(!entry)return null;
    const [iw,ih]=meta.portrait,k=Math.min(w/iw,h/ih),dw=iw*k,dh=ih*k;
    // A small whole-figure breath preserves authored anatomy and planted feet.
    const breath=1+Math.sin(time*1.35)*.0014,dx=x+(w-dw)/2,dy=y+h-dh*breath;
    if(entry.ready){
      g.drawImage(entry.image,dx,dy,dw,dh*breath);
      request(look,'rig');if(meta.hair)request(look,'hair');
    }else{
      // Handled loading state: never fall through to an unrelated vector
      // standee, or keep the previous person's image under the new name.
      g.save();g.fillStyle='#a8bdc1';g.textAlign='center';g.textBaseline='middle';g.font='12px '+Y.FONT;
      g.fillText(entry.failed?'立绘暂未加载':'立绘加载中…',x+w/2,y+h/2);g.restore();
    }
    return{x:dx,y:dy,w:dw,h:dh*breath,pose:{painted:true,loading:!entry.ready,failed:!!entry.failed,character:look.name,time,revision:data.revision}};
  }
  function part(g,asset,meta,name,x,y,w,h,angle=0,mirror=false){
    const rect=meta.parts[name];if(!rect||!Number.isFinite(w+h+x+y+angle)||w<=0||h<=0)return;
    g.save();g.translate(x,y);if(angle)g.rotate(angle);if(mirror)g.scale(-1,1);
    g.drawImage(asset,...rect,-w/2,-h/2,w,h);g.restore();
  }
  const mid=(a,b,u=.5)=>({x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,k:a.k+(b.k-a.k)*u,d:(a.d||0)+((b.d||0)-(a.d||0))*u});
  function bone(g,asset,meta,name,a,b,width){
    const center=mid(a,b),length=Math.hypot(b.x-a.x,b.y-a.y),overlap=center.k*.018;
    const [x,y,w,h]=meta.parts[name],inset=h*.065;
    g.save();g.translate(center.x,center.y);g.rotate(Math.atan2(b.y-a.y,b.x-a.x)-Math.PI/2);
    g.drawImage(asset,x,y+inset,w,h-inset*2,-width*center.k/2,-length/2-overlap,width*center.k,length+overlap*2);g.restore();
  }
  function usable(look){return !look.prison&&!(look.marketTier>=3)&&!!info(look)?.parts;}
  function drawRig(g,look,P,opt={}){
    if(!usable(look))return false;
    const asset=image(look,'rig'),meta=info(look);if(!asset)return false;
    const art=Y.CharacterArt.profile(look),limb=art.limb,hip=mid(P.H1,P.H2),shoulder=mid(P.S1,P.S2),unit=shoulder.k;
    if(meta.hair){
      const hair=image(look,'hair');
      if(hair){const h=meta.hairHeight*unit,w=h*meta.hair[0]/meta.hair[1],top=P.hd.y-unit*.215;g.drawImage(hair,P.hd.x-w/2,top,w,h);}
    }
    const bodyAngle=Math.atan2(hip.y-P.N.y,hip.x-P.N.x)-Math.PI/2;
    const joint=(point,r,color)=>{g.fillStyle=color;g.beginPath();g.arc(point.x,point.y,r*point.k,0,Math.PI*2);g.fill();};
    const leg=(h,k,f,index)=>{
      joint(k,.065*limb,look.stockings||look.skin);
      bone(g,asset,meta,'thigh',h,k,.195*limb);
      bone(g,asset,meta,'calf',k,f,.145*limb);
      if(opt.shoe)opt.shoe(index);else{
        const side=!!opt.side;
        part(g,asset,meta,side?'shoeSide':'shoe',f.x+(side?.035:0)*f.k,f.y+.035*f.k,(side?.27:.18)*f.k,(side?.135:.19)*f.k);
      }
    };
    const arm=(s,e,w)=>{joint(e,.049*limb,look.skin);bone(g,asset,meta,'upperArm',s,e,.17*art.shoulder);bone(g,asset,meta,'forearm',e,w,.112*limb);};
    const arms=[{s:P.S1,e:P.E,w:P.W,main:true},{s:P.S2,e:P.E2,w:P.W2,main:false}];
    const legs=[{h:P.H1,k:P.K1,f:P.F1,index:0},{h:P.H2,k:P.K2,f:P.F2,index:1}].sort((a,b)=>(b.k.d||0)-(a.k.d||0));
    for(const l of legs)leg(l.h,l.k,l.f,l.index);
    const isBehind=a=>opt.side?!a.main:(a.e.d||0)>(shoulder.d||0);
    for(const a of arms)if(isBehind(a)){arm(a.s,a.e,a.w);if(!a.main)freeHand(a);}
    const bodyHeight=Math.hypot(hip.x-P.N.x,hip.y-P.N.y)+unit*.045;
    const bodyCenter=mid(P.N,hip);bodyCenter.y+=unit*.012;
    // The camera contracts widths, never limb lengths or contact coordinates.
    const width=unit*.51*art.shoulder*(opt.side?.78:1);
    const hipsHeight=unit*(look.dress?.31:.29),hipsWidth=unit*.45*art.waist*(opt.side?.79:1);
    part(g,asset,meta,'hips',hip.x,hip.y+hipsHeight*.38,hipsWidth,hipsHeight,bodyAngle*.55);
    part(g,asset,meta,opt.back?'torsoBack':'torso',bodyCenter.x,bodyCenter.y,width,bodyHeight,bodyAngle);
    const headHeight=unit*.41*Y.CharacterArt.headScale(look),headName=opt.back?'headBack':'head',rect=meta.parts[headName];
    const headWidth=headHeight*rect[2]/rect[3];
    part(g,asset,meta,headName,P.hd.x,P.hd.y-unit*.012,headWidth,headHeight,Math.max(-.22,Math.min(.22,bodyAngle*.25)));
    for(const a of arms)if(!isBehind(a)){arm(a.s,a.e,a.w);if(!a.main)freeHand(a);}
    function freeHand(a){
      const angle=Math.atan2(a.w.y-a.e.y,a.w.x-a.e.x)-Math.PI/2;
      part(g,asset,meta,'hand',a.w.x,a.w.y,.10*a.w.k,.135*a.w.k,angle,!!opt.back);
    }
    return true;
  }
  function grip(g,look,W,R){
    const asset=image(look,'rig'),meta=info(look);if(!asset||!meta?.parts)return;
    part(g,asset,meta,'hand',W.x,W.y,.105*W.k,.145*W.k,Math.atan2(R.y-W.y,R.x-W.x)+Math.PI/2);
  }
  const screen2D=P=>Object.fromEntries(Object.entries(P).filter(([,v])=>Array.isArray(v)&&v.length===2).map(([key,v])=>[key,{x:v[0],y:-v[1],k:1,d:key.endsWith('2')?1:0}]));
  function rig2D(g,look,P,opt={}){const points=screen2D(P);points.S1=points.S;g.save();g.scale(1,-1);const ok=drawRig(g,look,points,{side:true,...opt});g.restore();return ok;}
  function grip2D(g,look,P){const r=Y.racketHead(P);g.save();g.scale(1,-1);grip(g,look,{x:P.W[0],y:-P.W[1],k:1},{x:r[0],y:-r[1]});g.restore();}
  function head(g,look,back=false){
    if(!ready(look,'rig'))return false;
    const asset=image(look,'rig'),meta=info(look),name=back?'headBack':'head',rect=meta?.parts?.[name];if(!asset||!rect)return false;
    part(g,asset,meta,name,0,-.08,2.47*rect[2]/rect[3],2.47);return true;
  }
  Y.CharacterSprites={revision:data.revision,data,idOf,info,url,image,ready,watch,load,warmPortraits,avatar,figure,drawRig,grip,rig2D,grip2D,head,
    clear(){cacheEpoch++;warming=null;cache.clear();},stats(){return{images:cache.size,loaded:[...cache.values()].filter(e=>e.ready).length,pending:[...cache.values()].filter(e=>!e.ready&&!e.failed).length,
      byKind:Object.fromEntries(['portrait','avatar','rig','hair'].map(kind=>[kind,[...cache].filter(([key,e])=>key.endsWith('/'+kind)&&e.ready).length]))};}};
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
