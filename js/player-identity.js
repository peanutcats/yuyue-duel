/* Bounded avatar cache shared by the native UI and the broadcast scoreboard. */
(function(G){
  'use strict';const Y=G.YY,images=new Map();
  Y.PlayerIdentity={
    image(url){
      if(typeof url!=='string'||!/^https:\/\/(?:[a-z0-9-]+\.)*(?:qlogo\.cn|qpic\.cn)\//i.test(url))return null;
      let entry=images.get(url);
      if(!entry){
        const img=Y.platform.wx?.createImage?.()||(typeof G.Image==='function'?new G.Image():null);if(!img)return null;
        entry={img,ready:false};images.set(url,entry);if(images.size>24)images.delete(images.keys().next().value);
        img.onload=()=>{entry.ready=true;};img.onerror=()=>{entry.ready=false;};img.src=url;
      }
      return entry.ready?entry.img:null;
    },
    clear(){images.clear();},
  };
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
