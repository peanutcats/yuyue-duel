/* WeChat approves a short-lived browser code; no OpenID or secret is typed here. */
(function(G){
  'use strict';const Y=G.YY,A=G.App,$=id=>document.getElementById(id),settingKeys=['target','music','sound','hint','skills','venue','courtMode'];
  A.initAccount=function(){
    const cfg=Y.MATCH_CONFIG||{},api=cfg.accountApiUrl||String(cfg.serverUrl||'').replace(/^ws/,'http').replace(/\/ws$/,'');
    const P={wx:{},getStorage:key=>localStorage.getItem(key),setStorage:(key,value)=>{try{localStorage.setItem(key,value);return true;}catch(_){return false;}},read(key,fallback){try{const v=this.getStorage(key);return v===null?fallback:JSON.parse(v);}catch(_){return fallback;}}};
    if(!P.getStorage('yuyue.settings'))P.setStorage('yuyue.settings',JSON.stringify(this.settings));
    const request=async(path,method,data,token)=>{
      const r=await fetch(api+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(14000),credentials:'omit',cache:'no-store'});
      let body;try{body=await r.json();}catch(_){throw Error('云存档服务尚未更新，请稍后重试');}
      if(!r.ok)throw Object.assign(Error(body.message||'云存档暂不可用'),{status:r.status,code:body.code,current:body.current});return body;
    };
    const s=this.account=new Y.CloudAccount(Y,P,{account:{enabled:cfg.accountEnabled!==false}},{request});
    s.canApply=()=>this.mode==='attract'&&!this.story;
    const apply=save=>{
      this.settings={...save.settings};for(const key of settingKeys)P.rawSet?.('yuyue.'+key,JSON.stringify(this.settings[key]));
      Y.Audio.enabled=this.settings.sound;
      for(const [id,key]of [['optMusic','music'],['optSound','sound'],['optHint','hint'],['optSkill','skills']])if($(id))$(id).checked=this.settings[key]!==false;
      if($('optTarget'))$('optTarget').value=this.settings.target;
    };
    P.rawSet=s.rawSet;s.onApply=apply;
    if(s.user)apply(s.capture());
    s.getSettings=()=>this.settings;
    const saved=P.read('yuyue.cloud.web-session',null);
    if(saved?.token&&saved.id===s.user?.id&&saved.expires>Date.now()){s.token=saved.token;s.expires=saved.expires;}
    s.login=async()=>{if(!s.token){s.status='unlinked';s.message='在微信小游戏中确认关联，即可读取你的云存档';throw Error('请先在主页的「微信云存档」关联微信小游戏账号');}const remote=await s.request('/api/account/save');await s.reconcile(remote);return s.user;};
    const setStorage=Y.platform.setStorage.bind(Y.platform);
    Y.platform.setStorage=(key,value)=>{const result=setStorage(key,value);if(settingKeys.some(k=>key==='yuyue.'+k))P.setStorage('yuyue.settings',JSON.stringify(this.settings));return result;};
    const originalSave=Y.Profile.onSave;Y.Profile.onSave=d=>{originalSave?.(d);this.renderAccount?.();};
    if(this.matchNet&&s.enabled)this.matchNet.getSession=()=>s.authToken();
    this.createAccountPanel();
    const button=document.createElement('button');button.className='cloud-menu-entry';button.id='btnCloudAccount';button.innerHTML='<span>微信云存档</span><small id="cloudMenuStatus">进度随身携带 ↗</small>';button.onclick=()=>this.show('account');$('scr-menu').querySelector('.menu-left').append(button);
    if(s.token)s.sync().then(()=>this.renderAccount(),e=>{s.failed(e);this.renderAccount();});else{s.status='unlinked';s.message='在微信小游戏中确认关联，即可读取你的云存档';}
    G.addEventListener('pagehide',()=>s.flush().catch(()=>{}));
    document.addEventListener('visibilitychange',()=>{if(document.hidden)s.flush().catch(()=>{});else if(s.token)s.sync().then(()=>this.renderAccount(),()=>this.renderAccount());});
  };
  A.createAccountPanel=function(){
    const section=document.createElement('section');section.id='scr-account';section.className='screen panel-screen hidden';
    section.innerHTML=`<div class="panel account-panel"><header class="ph"><button class="back" id="accountBack" aria-label="返回主页">‹</button><div><span class="account-overline">PLAYER PASSPORT</span><h2>账号与云存档</h2></div><span id="accountBadge" class="account-badge">等待关联</span></header>
    <div class="account-grid"><div class="account-passport"><div class="account-orbit" aria-hidden="true"></div><img id="accountAvatar" alt="玩家头像"><span class="account-overline">YUYUE DUEL / PLAYER</span><h3 id="accountName">微信羽友</h3><p class="account-id" id="accountId">关联后创建专属玩家 ID</p><div class="account-counts"><div><b id="accountStages">0</b><span>已通关</span></div><div><b id="accountStars">0</b><span>星级</span></div><div><b id="accountChars">4</b><span>角色</span></div></div><small>同一微信账号，进度随身携带。</small></div>
    <div class="account-detail"><div class="account-state"><span class="account-overline">CLOUD SAVE</span><h3 id="accountStatus">关联你的微信账号</h3><p id="accountMessage" role="status" aria-live="polite"></p><small id="accountStamp"></small></div>
    <div id="accountPair" hidden><p>1. 打开羽跃对决微信小游戏<br>2. 主页 → 账号与云存档 → 关联浏览器<br>3. 输入下面的关联码</p><strong id="accountPairCode" aria-label="关联码"></strong><small>3 分钟内有效。请只在你自己的浏览器上使用。</small></div>
    <div id="accountConflict" hidden><p>两台设备的进度不同。选择前，两份存档都会保留。</p><div class="account-choices"><button id="accountLocalChoice"><small>本机进度</small><b id="accountLocalSummary"></b><span>使用本机 →</span></button><button id="accountCloudChoice"><small>云端进度</small><b id="accountCloudSummary"></b><span>使用云端 →</span></button></div></div>
    <div class="account-actions"><button class="btn primary" id="accountConnect">关联微信小游戏</button><button class="btn" id="accountSync">立即同步</button><button class="btn" id="accountHistoryBtn">历史版本</button><button class="btn" id="accountLogout">退出登录</button></div><div id="accountHistory" hidden></div></div></div>
    <footer class="account-footnote">微信昵称与头像在小游戏中授权更新。对手可见昵称、头像和玩家 ID；登录凭证只用于账号验证。离线进度会在联网后同步。</footer></div>`;
    $('ui').append(section);$('accountBack').onclick=()=>this.show('menu');
    const action=fn=>Promise.resolve().then(fn).catch(e=>{this.account.message=e.message;this.renderAccount();}).finally(()=>this.renderAccount());
    $('accountConnect').onclick=()=>action(()=>this.startAccountPair());
    $('accountSync').onclick=()=>action(()=>this.account.sync());
    $('accountLocalChoice').onclick=()=>action(()=>this.account.resolve('local'));
    $('accountCloudChoice').onclick=()=>action(()=>this.account.resolve('cloud'));
    $('accountHistoryBtn').onclick=()=>action(async()=>{
      const items=await this.account.history(),list=$('accountHistory');list.replaceChildren();list.hidden=false;
      if(!items.length)list.textContent='首次同步后，旧版本会自动保留在这里。';
      for(const entry of items){const row=document.createElement('div'),label=document.createElement('span'),button=document.createElement('button'),sum=Y.CloudSave.summary(entry.save);row.className='account-history-row';label.textContent=`版本 ${entry.revision} · ${sum.stages} 关 / ${sum.stars} 星 · ${new Date(entry.updatedAt).toLocaleString()}`;button.textContent='恢复';button.className='btn';button.disabled=this.account.dirty||!!this.account.conflict;button.onclick=()=>action(async()=>{if(G.confirm('恢复此历史版本？当前云端版本会保留在历史记录中。'))await this.account.restore(entry);});row.append(label,button);list.append(row);}
    });
    $('accountLogout').onclick=()=>action(async()=>{await this.account.logout();localStorage.removeItem('yuyue.cloud.web-session');});
  };
  A.startAccountPair=async function(){
    const s=this.account;clearTimeout(this.accountPairTimer);this.accountPair=await s.request('/api/account/link','POST',{},null);this.renderAccount();
    const poll=async()=>{
      const link=this.accountPair;if(!link)return;
      try{
        if(Date.now()>link.expires)throw Error('关联码已过期，请重新生成');
        const remote=await s.request('/api/account/link/poll','POST',{code:link.code,secret:link.secret},null);
        if(remote.pending){this.accountPairTimer=setTimeout(poll,2500);return;}
        this.accountPair=null;s.token=remote.token;s.expires=remote.expires;
        // Store the business session only; WeChat session keys never leave the server.
        localStorage.setItem('yuyue.cloud.web-session',JSON.stringify({id:remote.user.id,token:remote.token,expires:remote.expires}));
        await s.reconcile(remote);this.renderAccount();
      }catch(e){this.accountPair=null;s.message=e.message;this.renderAccount();}
    };
    this.accountPairTimer=setTimeout(poll,2500);
  };
  A.renderAccount=function(){
    const s=this.account;if(!s||!$('accountStatus'))return;
    const user=s.user,sum=Y.CloudSave.summary(s.capture()),busy=['logging','syncing'].includes(s.status),labels={synced:'云存档已同步',syncing:'正在同步进度',pending:'有进度等待同步',conflict:'请选择保留的进度',waiting:'返回主页载入云存档',offline:'离线 · 进度已保留',unlinked:'关联你的微信账号'};
    $('accountStatus').textContent=labels[s.status]||'微信云存档';$('accountMessage').textContent=s.message;$('accountBadge').textContent=s.status==='synced'?'已同步':s.token?'已关联':'等待关联';$('accountBadge').dataset.state=s.status;
    $('accountName').textContent=user?.nickname||'微信羽友';$('accountId').textContent=user?.id||'关联后创建专属玩家 ID';
    const img=$('accountAvatar'),url=user?.avatarUrl||this.charURL(Y.Profile.sel.char);if(img.getAttribute('src')!==url){img.onerror=()=>{img.onerror=null;img.src=this.charURL(Y.Profile.sel.char);};img.src=url;}
    $('accountStages').textContent=sum.stages;$('accountStars').textContent=sum.stars;$('accountChars').textContent=sum.chars;
    $('accountStamp').textContent=s.updatedAt?`版本 ${s.revision} · ${new Date(s.updatedAt).toLocaleString()} 已确认`:'尚未收到服务器同步确认';
    $('accountPair').hidden=!this.accountPair;if(this.accountPair)$('accountPairCode').textContent=this.accountPair.code.slice(0,4)+' '+this.accountPair.code.slice(4);
    $('accountConflict').hidden=!s.conflict;if(s.conflict){const remote=Y.CloudSave.summary(s.conflict.save);$('accountLocalSummary').textContent=`${sum.stages} 关 · ${sum.stars} 星`;$('accountCloudSummary').textContent=`${remote.stages} 关 · ${remote.stars} 星`;}
    $('accountSync').hidden=!s.token;$('accountSync').disabled=busy||!!s.conflict;$('accountConnect').hidden=!!s.token&&!this.accountPair;$('accountConnect').textContent=this.accountPair?'重新生成关联码':'关联微信小游戏';
    $('accountHistoryBtn').hidden=!s.token;$('accountLogout').hidden=!s.token;
    if($('cloudMenuStatus'))$('cloudMenuStatus').textContent=s.status==='synced'?'已同步 · '+(user?.nickname||'微信羽友'):s.status==='conflict'?'进度有差异 · 点此选择':'进度随身携带 ↗';
  };
  const init=A.init;A.init=function(){init.call(this);if(Y.MATCH_CONFIG?.accountEnabled!==false)this.initAccount();};
  const show=A.show;A.show=function(name){show.call(this,name);this.account?.applyPending();if(name==='account')this.renderAccount();};
  const render=A.render;A.render=function(dt){const result=render.call(this,dt);if(this.screen==='account'&&this.account&&performance.now()-(this.accountRenderAt||0)>500){this.accountRenderAt=performance.now();this.renderAccount();}return result;};
})(window);
