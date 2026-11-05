'use strict';
const BANK=require('./voice-bank');
module.exports=function createStoryVoice(wx,allowed){
  const loaded=new Set(),pending=new Map();let generation=0,current=null,state='idle',failed=false;
  function stop(){generation++;if(current){try{current.stop();current.destroy?.();}catch(_){}current=null;}state='idle';}
  function load(root){
    if(loaded.has(root)||!wx.loadSubpackage)return Promise.resolve();
    if(pending.has(root))return pending.get(root);
    const promise=new Promise((resolve,reject)=>{try{wx.loadSubpackage({name:root,success(){loaded.add(root);resolve();},fail:reject});}catch(e){reject(e);}}).finally(()=>pending.delete(root));
    pending.set(root,promise);return promise;
  }
  return {
    stop,
    async play(id){
      stop();failed=false;const item=BANK[id];if(!item||!allowed()||!wx.createInnerAudioContext)return false;
      const request=generation;state='loading';
      try{
        await load(item.root);
        if(request!==generation)return false;
        if(!allowed()){stop();return false;}
        const ctx=wx.createInnerAudioContext();current=ctx;
        ctx.obeyMuteSwitch=true;ctx.volume=.82;ctx.loop=false;ctx.autoplay=false;
        ctx.onEnded?.(()=>{if(request===generation)stop();});
        ctx.onError?.(()=>{if(request===generation){stop();failed=true;state='unavailable';}});
        ctx.src=item.root+'/'+item.file;
        if(request!==generation||!allowed()){try{ctx.destroy?.();}catch(_){}return false;}
        state='playing';ctx.play();return true;
      }catch(_){if(request===generation){stop();failed=true;state='unavailable';}return false;}
    },
    get state(){return state;},get failed(){return failed;},
    destroy(){stop();loaded.clear();},
  };
};
