'use strict';
// The local copy is a write-ahead cache. Only an acknowledged server revision is
// shown as synced; conflicts retain both branches until the player chooses.
class CloudAccount {
  constructor(Y, P, config, options={}) {
    this.Y=Y;this.P=P;this.config=config;this.options=options;this.wx=P.wx||{};
    this.enabled=config.account?.enabled!==false&&(!!options.request||typeof this.wx.login==='function');
    this.status=this.enabled?'offline':'unavailable';this.message=this.enabled?'等待微信登录':'请在微信小游戏中登录云存档';this.revision=0;this.serial=0;this.dirty=false;
    this.rawSet=P.setStorage.bind(P);this.legacy=!!(P.getStorage('yuyue.sixteen.profile')||P.getStorage('yuyue.profile'));
    if(!this.enabled)return;
    const id=P.read('yuyue.cloud.current',null),cache=id&&P.read('yuyue.cloud.cache.'+id,null);
    if(cache?.user?.id===id&&cache.save){this.user=cache.user;this.revision=cache.revision||0;this.dirty=!!cache.dirty;this.updatedAt=cache.updatedAt;this.apply(cache.save);}
    const previous=Y.Profile.onSave;Y.Profile.onSave=d=>{previous?.(d);if(!this.applying)this.changed();};
    P.setStorage=(key,value)=>{const ok=this.rawSet(key,value);if(key==='yuyue.controls.v1')try{this.controls=JSON.parse(value);}catch(_){}if(!this.applying&&['yuyue.settings','yuyue.controls.v1'].includes(key))this.changed();return ok;};
  }
  capture(){return this.Y.CloudSave.clean({profile:this.Y.Profile.d,settings:this.getSettings?.()||this.P.read('yuyue.settings',{}),controls:this.controls||this.P.read('yuyue.controls.v1',null)});}
  cache(){if(this.user)this.cacheError=this.rawSet('yuyue.cloud.cache.'+this.user.id,JSON.stringify({user:this.user,revision:this.revision,save:this.capture(),dirty:this.dirty,updatedAt:this.updatedAt}))===false;}
  changed(){
    if(!this.enabled||this.applying)return;
    this.serial++;this.dirty=true;this.cache();
    if(this.pending){if(!this.user||this.user.id===this.pending.remote.user.id){const remote=this.pending.remote;this.pending=null;this.user=remote.user;this.setConflict(remote);}return;}
    if(this.conflict)return;
    this.status=this.token?'pending':'offline';this.message=this.cacheError?'设备缓存写入失败，请保持联网完成同步':this.token?'有进度等待上传':'进度已保留，联网后同步';this.schedule();
  }
  schedule(ms=800){if(this.disposed||this.timer||!this.token||this.conflict||this.pending)return;this.timer=setTimeout(()=>{this.timer=null;this.flush().catch(()=>{});},ms);this.timer.unref?.();}
  apply(save){
    this.applying=true;
    try{save=this.Y.CloudSave.clean(save);this.Y.Profile.load(save.profile);this.Y.Profile.save();this.controls=save.controls;this.rawSet('yuyue.settings',JSON.stringify(save.settings));this.rawSet('yuyue.controls.v1',JSON.stringify(save.controls));this.onApply?.(save);}finally{this.applying=false;}
  }
  adopt(remote,save=remote.save){
    if(this.canApply&&!this.canApply()){this.pending={remote,save};this.status='waiting';this.message='云存档已就绪，返回主页后载入';return;}
    this.pending=null;this.user=remote.user;this.revision=remote.revision;this.updatedAt=remote.updatedAt;this.dirty=false;this.conflict=null;
    this.apply(save||this.Y.CloudSave.clean(null));this.rawSet('yuyue.cloud.current',JSON.stringify(this.user.id));this.cache();
    this.status='synced';this.message='云存档已同步';
  }
  applyPending(){if(this.pending&&(!this.canApply||this.canApply())){const p=this.pending;this.adopt(p.remote,p.save);}}
  async request(path,method='GET',data,token=this.token){
    if(this.options.request)return this.options.request(path,method,data,token);
    const header={'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})};
    let result;
    if(this.config.networkTransport==='cloud'){
      const cloud=this.wx.cloud,cfg=this.config.cloud;
      if(!cloud?.callContainer)throw Error('当前微信版本不支持云存档，请更新微信');
      if(!this.cloudReady)this.cloudReady=Promise.resolve(cloud.init({env:cfg.env,traceUser:false})).catch(e=>{this.cloudReady=null;throw e;});
      await this.cloudReady;result=await this.timeout(cloud.callContainer({config:{env:cfg.env},path,method,header:{...header,'X-WX-SERVICE':cfg.service},data}));
    }else{
      const base=this.config.account?.apiUrl||String(this.config.serverUrl||'').replace(/^ws/,'http').replace(/\/ws$/,'');
      if(!/^https:\/\//.test(base)&&!(this.config.allowLocalhost&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)))throw Error('云存档地址尚未配置');
      result=await this.timeout(new Promise((resolve,reject)=>this.wx.request({url:base+path,method,header,data,timeout:12000,success:resolve,fail:reject})));
    }
    let body;try{body=typeof result.data==='string'?JSON.parse(result.data):result.data;}catch(_){throw Error('暂时无法同步进度，请稍后重试');}
    if(result.statusCode<200||result.statusCode>=300)throw Object.assign(Error(body?.message||'云存档暂不可用'),{status:result.statusCode,code:body?.code,current:body?.current});return body;
  }
  timeout(promise){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('网络连接超时，进度已保留')),14000);timer.unref?.();Promise.resolve(promise).then(resolve,reject).finally(()=>clearTimeout(timer));});}
  async login(){
    if(!this.enabled)throw Error(this.message);
    if(this.logging)return this.logging;
    this.status='logging';this.message='正在使用微信登录…';
    this.logging=(async()=>{
      const d=await this.timeout(new Promise((resolve,reject)=>this.wx.login({timeout:10000,success:resolve,fail:reject})));
      const remote=await this.request('/api/account/login','POST',{code:d.code},null);this.token=remote.token;this.expires=remote.expires;
      await this.reconcile(remote);this.refreshUserInfo().catch(()=>{});return this.user;
    })().catch(e=>{this.failed(e);throw e;}).finally(()=>{this.logging=null;});return this.logging;
  }
  async reconcile(remote){
    if(this.disposed)return;
    const same=this.user?.id===remote.user.id,claim=this.P.read('yuyue.cloud.migrated',null),local=this.capture();
    if(same&&!this.dirty&&this.revision===remote.revision&&remote.save&&JSON.stringify(local)===JSON.stringify(remote.save)){
      this.user=remote.user;this.updatedAt=remote.updatedAt;this.status='synced';this.message='云存档已同步';this.cache();return;
    }
    const migratable=!this.user&&!claim&&(this.legacy||this.dirty);
    if(same&&this.dirty||migratable){
      this.user=remote.user;this.rawSet('yuyue.cloud.current',JSON.stringify(this.user.id));
      if(!remote.save||same&&this.revision===remote.revision){this.revision=remote.revision;this.dirty=true;this.cache();await this.flush();}
      else if(JSON.stringify(local)===JSON.stringify(remote.save)){this.adopt(remote);}
      else this.setConflict(remote);
    }else this.adopt(remote);
    if(!claim)this.rawSet('yuyue.cloud.migrated',JSON.stringify(remote.user.id));
    if(!this.pending&&!remote.save&&!this.dirty){this.dirty=true;await this.flush();}
  }
  setConflict(remote){this.conflict=remote;this.status='conflict';this.message='两台设备的进度不同，请选择保留版本';this.cache();}
  failed(e){this.status='offline';this.message=e?.message||e?.errMsg||'连接失败，进度已保留';if(e?.status===401)this.token=null;this.cache();}
  async flush(){
    if(this.disposed||this.pending||this.conflict||!this.dirty)return;
    if(!this.token)throw Error('请先使用微信登录');
    if(this.writing)return this.writing;
    const serial=this.serial,owner=this.user?.id,save=this.capture();this.status='syncing';this.message='正在同步云存档…';
    this.writing=this.request('/api/account/save','PUT',{baseRevision:this.revision,save}).then(remote=>{
      if(this.disposed||this.user?.id!==owner)return;
      this.revision=remote.revision;this.updatedAt=remote.updatedAt;this.dirty=this.serial!==serial;
      this.status=this.dirty?'pending':'synced';this.message=this.dirty?'新进度等待同步':'云存档已同步';this.cache();this.retry=0;
    }).catch(e=>{if(e.status===409&&e.current)this.setConflict(e.current);else{this.failed(e);if(this.token)this.schedule(Math.min(60000,5000*2**(this.retry++||0)));}throw e;}).finally(()=>{this.writing=null;if(this.dirty&&this.status==='pending')this.schedule();});return this.writing;
  }
  async sync(){
    if(!this.enabled)return;
    if(this.logging)return this.logging;
    if(this.wx.checkSession&&this.token){const valid=await new Promise(resolve=>this.wx.checkSession({success:()=>resolve(true),fail:()=>resolve(false)}));if(!valid)return this.login();}
    if(!this.token||this.expires&&Date.now()>=this.expires)return this.login();
    if(this.pending){this.applyPending();if(this.pending)return;}
    if(this.conflict)return;
    try{if(this.dirty)await this.flush();if(this.conflict)return;const remote=await this.request('/api/account/save');await this.reconcile(remote);}catch(e){if(!this.conflict)this.failed(e);throw e;}
  }
  async authToken(){await this.sync();if(this.conflict)throw Error('请先在「个人资料」选择游戏进度');if(!this.token||this.pending)throw Error('请先返回主页载入游戏进度');return this.token;}
  async resolve(which){
    const remote=this.conflict;if(!remote)return;
    if(this.canApply&&!this.canApply())throw Error('请先返回主页处理存档');
    this.rawSet('yuyue.cloud.branch.'+this.user.id,JSON.stringify({savedAt:new Date().toISOString(),save:this.capture(),revision:this.revision}));
    this.conflict=null;
    if(which==='cloud'){this.adopt(remote);return;}
    this.revision=remote.revision;this.dirty=true;this.serial++;await this.flush();
  }
  async updateUserInfo(d){
    return this.savePublicProfile('/api/account/userinfo',{rawData:d.rawData,signature:d.signature});
  }
  acceptUser(user){
    this.user=user;if(this.conflict?.user?.id===user.id)this.conflict.user=user;
    if(this.pending?.remote?.user?.id===user.id)this.pending.remote.user=user;this.cache();
  }
  savePublicProfile(path,data){
    // Keep automatic WeChat refreshes in order with player edits.
    const writing=(this.profileWriting||Promise.resolve()).catch(()=>{}).then(async()=>{const r=await this.request(path,'POST',data);this.acceptUser(r.user);return this.user;});
    this.profileWriting=writing;
    return writing.catch(e=>{if(e.status===401)this.failed(e);throw e;}).finally(()=>{if(this.profileWriting===writing)this.profileWriting=null;});
  }
  async updateNickname(value){
    const nickname=typeof value==='string'?value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'').trim():'';
    if(!nickname||[...nickname].length>24)throw Error('昵称需为 1–24 个字符');
    return this.savePublicProfile('/api/account/profile',{nickname});
  }
  async refreshUserInfo(){
    if(!this.wx.getSetting||!this.wx.getUserInfo)return;
    const setting=await new Promise((resolve,reject)=>this.wx.getSetting({success:resolve,fail:reject}));
    if(!setting.authSetting?.['scope.userInfo'])return;
    const d=await new Promise((resolve,reject)=>this.wx.getUserInfo({withCredentials:true,lang:'zh_CN',success:resolve,fail:reject}));return this.updateUserInfo(d);
  }
  async history(){const r=await this.request('/api/account/history');return r.history||[];}
  async restore(entry){if(this.dirty||this.conflict)throw Error('请先完成当前存档同步');const r=await this.request('/api/account/save','PUT',{baseRevision:this.revision,save:entry.save});this.adopt(r);}
  async logout(){if(this.token)await this.request('/api/account/logout','POST',{});this.token=null;this.expires=null;this.status='offline';this.message='已退出登录，设备上的进度已保留';}
  dispose(){this.disposed=true;clearTimeout(this.timer);this.timer=null;}
}
if(typeof module!=='undefined')module.exports=CloudAccount;
else globalThis.YY.CloudAccount=CloudAccount;
