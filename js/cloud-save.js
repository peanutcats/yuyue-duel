/* Versioned account save shared by the server and both clients. */
(function (G) {
  'use strict';
  const Y = G.YY;
  const defaults = { target:7, courtMode:'2d', music:true, sound:true, voice:false, hint:true, skills:true, haptics:true, venue:'random', moveCtrl:'pad', shotControl:'tap' };
  function settings(value) {
    const d = value && typeof value === 'object' ? value : {}, out = { ...defaults };
    for (const key of ['music','sound','voice','hint','skills','haptics','emoteMute']) if (typeof d[key] === 'boolean') out[key] = d[key];
    if ([7,15,21].includes(d.target)) out.target = d.target;
    if (['2d','3d'].includes(d.courtMode)) out.courtMode = d.courtMode;
    if (['tap','swipe'].includes(d.shotControl)) out.shotControl=d.shotControl;
    if (['pad','stick'].includes(d.moveCtrl)) out.moveCtrl = d.moveCtrl;
    if (d.venue === 'random' || Y.MATCH_VENUES.includes(d.venue)) out.venue = d.venue;
    // These two options are validated again by their corresponding setup pages.
    if (d.train && typeof d.train === 'object') {
      out.train = {};
      for (const [k,v] of Object.entries(d.train)) if (/^[a-zA-Z]{1,24}$/.test(k) && !['constructor','prototype'].includes(k) && ['string','number','boolean'].includes(typeof v)) out.train[k] = typeof v === 'string' ? v.slice(0,64) : v;
    }
    if (d.quick && typeof d.quick === 'object') out.quick = {level:['easy','normal','hard','nightmare'].includes(d.quick.level)?d.quick.level:'normal',opp:Y.CHARS.some(c=>c.id===d.quick.opp)?d.quick.opp:'random',kit:Array.isArray(d.quick.kit)?d.quick.kit.filter(v=>typeof v==='string').slice(0,2):null};
    return out;
  }
  function controls(d) {
    const out = {v:1,solo:{},duo:{}}, ids = ['move','jump','clear','drop','smash','skill','skill2'];
    for (const mode of ['solo','duo']) for (const id of mode==='solo'?ids:[0,1].flatMap(i=>ids.map(k=>`p${i}-${k}`))) {
      const p = d?.v===1 && d[mode]?.[id];
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x>=0 && p.x<=1 && p.y>=0 && p.y<=1) out[mode][id] = {x:p.x,y:p.y};
    }
    return out;
  }
  Y.CloudSave = {
    settings, controls,
    clean(d) { return {v:1,profile:Y.Profile.clean(d?.profile),settings:settings(d?.settings),controls:controls(d?.controls)}; },
    summary(d) { const p=d?.profile;return {stages:Object.keys(p?.stages||{}).length,stars:Object.values(p?.stages||{}).reduce((a,n)=>a+n,0),chars:p?.chars?.length||4}; },
  };
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
