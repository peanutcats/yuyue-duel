/* 纵深对战 · 三维比赛核心。x 沿场长，y 为高度，z 沿场宽；2D 核心保持独立。 */
(function (G) {
  'use strict';
  const Y = G.YY, C = Y.C, { clamp, lerp } = Y;
  const WIDTH = 2.59, LIMIT = 3.05;
  const finite = (n, d = 0) => Number.isFinite(n) ? n : d;
  Y.COURT3D = Object.freeze({ halfWidth: WIDTH, moveLimit: LIMIT, netWidth: 3.05, flightPace: .78, inputDeadzone: .14 });
  Y.cleanCourtMode = mode => mode === '3d' ? '3d' : '2d';
  Y.cleanCourtAim = a => a && Number.isFinite(a.x) && Number.isFinite(a.z)
    ? { x: clamp(a.x, .55, C.HALF - .12), z: clamp(a.z, -WIDTH, WIDTH) } : null;
  Y.spatialNear = (m, a, b, radius = .85) => m.courtMode !== '3d' || Math.abs(finite(a.z) - finite(b.z)) <= radius;

  // A single shared radial deadzone keeps native/web sticks identical. The
  // center never moves: sliding outside the base only saturates the vector.
  Y.courtStick = (x, y) => {
    const d = Math.hypot(x, y);
    if (!Number.isFinite(d) || d <= .14) return { x: 0, y: 0 };
    const k = Math.min(1, (d - .14) / .72) / d;
    return { x: x * k, y: y * k };
  };
  Y.courtDirection = (input) => {
    let move = clamp(finite(input?.move), -1, 1), strafe = clamp(finite(input?.strafe), -1, 1);
    const n = Math.hypot(move, strafe);
    if (n < .08) return { move: 0, strafe: 0 };
    if (n > 1) { move /= n; strafe /= n; }
    return { move, strafe };
  };

  // Same midpoint integrator and cork/net contact as 2D; the horizontal plane is
  // rotated into the flight direction. Drag is based on all three velocity axes.
  const step2D = Y.stepShuttle;
  Y.stepShuttle = function (s, dt, env) {
    if (!s.space3D) return step2D(s, dt, env);
    s.stepTime = 0;
    if (!(dt > 0) || !Number.isFinite(dt)) return null;
    let remaining = dt, result = null;
    while (remaining > 1e-10) {
      const h = Math.min(remaining, C.DT), px = s.x, py = s.y, pz = s.z;
      const wind = finite(env?.wind), lateralWind = finite(env?.windZ);
      const vx = s.vx - wind, vz = s.vz - lateralWind, vh = Math.hypot(vx, vz);
      const ux = vh > 1e-9 ? vx / vh : 1, uz = vh > 1e-9 ? vz / vh : 0;
      const plane = { x: 0, y: py, vx: vh, vy: s.vy, netHit: true };
      const pe = { ...env, wind: 0, spin: 0 };
      delete pe.curve;
      const weight = env?.curve ? Y.curveWeight(px, env.curve) : 1;
      if (env?.curve) pe.spin = env.curve.lift * weight;
      if (env?.gFar && px * env.gFar.side > 0) pe.g = (env.g ?? 1) * env.gFar.m;
      delete pe.gFar;
      if(env?.paper){
        const aero=Y.paperAero(px+s.vx*h*.5,env.paper);
        pe.drag=(env.drag??C.DRAG)*aero.drag;pe.g=(pe.g??1)*aero.gravity;
        delete pe.paper;
      }
      const contact = step2D(plane, h, pe), used = plane.stepTime;
      let x = px + plane.x * ux + wind * used, z = pz + plane.x * uz + lateralWind * used;
      s.vx = plane.vx * ux + wind; s.vz = plane.vx * uz + lateralWind; s.vy = plane.vy;
      const spin = env?.curve ? env.curve.side * weight : clamp(finite(env?.spin), -1.5, 1.5);
      if (spin) {
        const a=spin*used,cos=Math.cos(a),sin=Math.sin(a),vx=s.vx,vz=s.vz;
        s.vx=vx*cos-vz*sin;s.vz=vx*sin+vz*cos;
        x+=(s.vx-vx)*used*.5;z+=(s.vz-vz)*used*.5;
      }
      // A thin slab catches the cork continuously, including contacts ending at x=0.
      const netH = env?.netH || C.NET_H;
      const entering = !s.netHit && Math.abs(px) > C.SHUTTLE_R &&
        ((px < 0 && x >= -C.SHUTTLE_R) || (px > 0 && x <= C.SHUTTLE_R));
      if (entering) {
        const edge = Math.sign(px) * C.SHUTTLE_R;
        const f = clamp((edge - px) / (x - px || 1), 0, 1);
        const ny = lerp(py, plane.y, f), nz = lerp(pz, z, f);
        if (ny <= netH + C.SHUTTLE_R && Math.abs(nz) <= 3.05 + C.SHUTTLE_R) {
          s.x = edge + Math.sign(px) * .0001; s.y = ny; s.z = nz;
          s.vx *= -.06; s.vz *= .12; s.vy = Math.min(s.vy, 0) * .3 - .5;
          s.netHit = true; s.crossedNet = false; result = 'net';
          s.stepTime += used; remaining -= used; continue;
        }
      }
      s.x = x; s.z = z; s.y = plane.y;
      if (!s.netHit && ((px < C.SHUTTLE_R && x >= C.SHUTTLE_R) || (px > -C.SHUTTLE_R && x <= -C.SHUTTLE_R))) s.crossedNet = true;
      s.stepTime += used; remaining -= used;
      if (contact === 'floor') return 'floor';
      if (!(used > 0)) break;
    }
    return result;
  };
  Y.simulate3D = function (ball, env, record = true, maxT = 7) {
    const s = { ...ball, space3D: true, z: finite(ball.z), vz: finite(ball.vz) };
    const pts = record ? [{ t: 0, x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz }] : null;
    let t = 0, i = 0, apex = s.y, netY = null;
    while (t < maxT - 1e-9) {
      const x = s.x, y = s.y, r = Y.stepShuttle(s, Math.min(C.DT, maxT - t), env);
      if (!(s.stepTime > 0)) break;
      t += s.stepTime; apex = Math.max(apex, s.y);
      if (netY === null && Math.sign(x) !== Math.sign(s.x)) netY = lerp(y, s.y, x / (x - s.x));
      if (record && (++i % 3 === 0 || r)) pts.push({ t, x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz });
      if (r === 'floor') break;
    }
    return { landX: s.x, landZ: s.z, t, apex, netY, netHit: !!s.netHit, pts };
  };

  // Shot solution in the actual diagonal flight plane. Net clearance is checked
  // at the real net, not halfway between the two endpoints.
  Y.solveShot3D = function (s, target, type, power = 1, env) {
    const dx = target.x - s.x, dz = target.z - s.z, distance = Math.max(.05, Math.hypot(dx, dz));
    const ux = dx / distance, uz = dz / distance;
    const angles = { clear: 57, flatclear: 38, lift: 62, lserve: 58, sserve: 27,
      drop: 20, slice: 12, net: 30, tumble: 32, block: 38, push: 24, drive: 8, smash: -20, halfsmash: -10, kill: -23 };
    let angle = (angles[type] ?? 44) - (['smash','halfsmash','drive'].includes(type) ? (power-1)*30 : 0), speed = 0, solution;
    // Gravity changes act on the flying shuttle; aim against normal gravity so
    // gravity skills retain their effect instead of the solver cancelling them.
    const solveEnv = { ...env, wind: 0, spin: 0, g: 1 }; delete solveEnv.gFar; delete solveEnv.ceil;
    if (type === 'smash') {
      // Fixed launch speed gives high contacts a real advantage. Re-solve the
      // angle under drag, then verify the actual diagonal net crossing.
      let attack = 30 * power * (1 + clamp((s.y-C.SMASH_MIN_Y)/1.5,0,1)*.18);
      for (let n=0;n<9;n++,attack*=.92) {
        const a=Y.solveAngle(0,s.y,1,attack,distance,-75,35,solveEnv)*Math.PI/180;
        const v={vx:Math.cos(a)*attack*ux,vy:Math.sin(a)*attack,vz:Math.cos(a)*attack*uz};
        const path=Y.simulate3D({...s,...v,netHit:false},solveEnv,false);
        if(!path.netHit&&Math.hypot(path.landX-target.x,path.landZ-target.z)<.04)return v;
      }
    }
    for (let n = 0; n < 15; n++) {
      speed = Y.solveSpeed(0, s.y, 1, angle, distance, solveEnv);
      const rad = angle * Math.PI / 180;
      solution = { vx: Math.cos(rad) * speed * ux, vy: Math.sin(rad) * speed, vz: Math.cos(rad) * speed * uz };
      const path = Y.simulate3D({ ...s, ...solution, netHit: false }, solveEnv, false);
      if (!path.netHit && Math.hypot(path.landX-target.x,path.landZ-target.z)<.03) break;
      angle += 5;
    }
    return solution;
  };

  class Match3D extends Y.Match {
    constructor(opt) {
      super({ ...opt, courtMode: '3d' });
      this.courtMode = '3d';
    }
    resetPoint(first) {
      super.resetPoint(first);
      this.courtMode = '3d';
      const lane = this.score[this.server] % 2 ? -1 : 1;
      for (const p of this.players) {
        const serveLane = lane * this.players[this.server].dir;
        p.z = p.idx === this.server ? serveLane * 1.05 : -serveLane * 1.05;
        p.vz = 0; p.aim3D = null; p.input3D = {move:0,strafe:0}; p.hitPose3D = null; p.dash3D = null; p.shotQueue3D = null;
      }
      this.shuttle.space3D = true; this.shuttle.z = this.players[this.server].z; this.shuttle.vz = 0;
      this._ctl3D = null;
      this.placeHeld();
    }
    placeHeld() { super.placeHeld(); this.shuttle.z = finite(this.players[this.server].z); this.shuttle.vz = 0; }
    emit(e) {
      if (e.z == null) e.z = finite(e.p != null ? this.players?.[e.p]?.z : this.shuttle?.z);
      if (e.type === 'hit') { e.z = finite(this.shuttle.z); e.vz = finite(this.shuttle.vz); e.pace = Y.COURT3D.flightPace; e.displaySpeed = (e.speed||0)*this.shuttleScale(); }
      super.emit(e);
    }
    step(dt) {
      this._previous3D = { z: this.shuttle.z, players: this.players.map(p => p.z) };
      const ver = this.shuttle.ver;
      super.step(dt);
      const s = this.shuttle;
      if (s.live && !s.ctl) {
        s.speed = Math.hypot(s.vx, s.vy, s.vz);
        if (s.ver !== ver || this.pred?.landZ == null) this.rePred();
      }
      for (const p of this.players) {
        if (p.cnt.cloud && s.live) p.z = lerp(p.z, finite(this.pred?.landZ, s.z), Math.min(1, dt * 3));
      }
    }
    updatePlayer(p, dt) {
      const inp = this.inputs[p.idx], z = finite(p.z), oldVz = finite(p.vz), oldMotion=p.motion||{};
      p.input3D = Y.courtDirection(inp);
      if(p.shotQueue3D && p.shotQueue3D.until < this.time){
        p.shotQueue3D=null;this.spend(p,C.SWING_MISS_COST*this.costMul(p,true));p.cooldown=Math.max(p.cooldown,C.SW_MISS_RECOVER);
        this.emit({type:'whiff',p:p.idx,label:'挥空 · 准备过早，收拍后再试'});
      }
      const d = Y.courtDirection(inp), M0=this.mods(p), vig=this.vigor(p);
      let lateral=d.strafe;
      const locked = M0.fix || p.buff.prone > 0 || p.cnt.vine || ['over','point'].includes(this.phase) || (this.phase==='serve'&&p.idx===this.server);
      if(locked)lateral=0;
      const ice=this.iceAt(p),grip=ice?(Math.abs(lateral)<.05||lateral*oldVz<0?.14:.32):1;
      const accel=grip*(p.onGround?(lateral?C.ACCEL*(lateral*oldVz<-.4?1.12:1):C.DECEL):C.AIR_ACCEL)*p.st.accel*M0.accel*(.6+.4*vig);
      const slow=p.slow>0?1-.4*clamp(p.slow/.22,0,1):1;
      p.vz=locked?0:oldVz+clamp(lateral*this.maxSpeed(p,M0)*slow-oldVz,-accel*dt,accel*dt);
      const move=inp.move;inp.move=d.move;
      super.updatePlayer(p,dt);inp.move=move;
      const M=this.mods(p),lock=M.fix||p.buff.prone>0||p.cnt.vine||(this.phase==='serve'&&p.idx===this.server);
      if(lock)p.vz=0;
      if(p.dash3D?.t>0&&!lock){p.vz=p.dash3D.v;if(p.dash3D.x!=null){p.x+=(p.dash3D.x-p.vx)*dt;p.vx=p.dash3D.x;p.x=p.side*clamp(p.side*p.x,C.X_NEAR,C.X_FAR);}p.dash3D.t-=dt;}
      p.z=clamp(finite(p.z,z)+p.vz*dt,-LIMIT,LIMIT);
      if(Math.abs(p.z)===LIMIT)p.vz=0;
      p.motion.lateral=lerp(oldMotion.lateral||0,p.vz*p.dir,1-Math.exp(-26*dt));
      p.motion.bank=lerp(oldMotion.bank||0,clamp((p.vz-oldVz)/(C.ACCEL*dt),-1,1),1-Math.exp(-22*dt));
      if(Math.abs(p.vz)>.6)p.still=0;
    }
    runCost(p,dt) {
      if(this.phase!=='rally'||!p.onGround){p.peakV=0;p.runHeading=null;return;}
      const speed=Math.hypot(p.vx,p.vz||0),mul=this.costMul(p,true);
      if(speed>C.STAM_JOG)this.spend(p,(speed-C.STAM_JOG)*C.STAM_RUN*dt*mul,false);
      if(speed>.6){
        const heading=[p.vx/speed,(p.vz||0)/speed],old=p.runHeading;
        if(old&&old[0]*heading[0]+old[1]*heading[1]<-.15&&p.peakV>2.2){
          this.spend(p,C.STAM_TURN*clamp(p.peakV/C.MOVE,0,1.2)*mul);this.emit({type:'turn',p:p.idx,v:p.peakV});p.peakV=0;
        }
        // Preserve the loaded direction while decelerating, until direction changes.
        if(!old||speed>1.8||old[0]*heading[0]+old[1]*heading[1]<0)p.runHeading=heading;
      }
      p.peakV=Math.max(p.peakV*Math.exp(-dt*1.5),speed);
    }
    handlePress(p, pr) {
      // Smash is a single mobile action: jump first, keep the stroke in a short
      // anticipation buffer until the shuttle enters reach. Other strokes use it too.
      if (['clear', 'drop', 'smash'].includes(pr.btn) && this.phase === 'rally' && !pr.ready3D && !this.shuttle.ctl) {
        if(this.skSwingBlocked(p,pr.btn,this.mods(p)))return;
        if(p.swing||p.cooldown>0)return super.handlePress(p,pr);
        if(p.shotQueue3D)return; // Repeated taps cannot extend the anticipation window.
        this.spend(p,(pr.btn==='smash'?C.SWING_POWER_COST:C.SWING_COST)*this.costMul(p,true));
        if (pr.btn === 'smash' && p.onGround && this.shuttle.y > 2.6 && Math.hypot(this.shuttle.x-p.x, this.shuttle.z-p.z) < 1.8)
          super.handlePress(p, { btn: 'jump' });
        p.shotQueue3D = { btn:pr.btn, lead:pr.lead, paid3D:true, ready3D: true, until: this.time + .42 };
        return;
      }
      super.handlePress(p, pr);
    }
    checkContact(p, dt, previous, flightTime = dt) {
      const s = this.shuttle;
      if (p.shotQueue3D) {
        const q = p.shotQueue3D;
        if (q.until < this.time || this.phase !== 'rally') p.shotQueue3D = null;
        else if (!p.swing && p.cooldown <= 0 && this.ringError(p, s) < this.reachFor(p) + .6) {
          p.shotQueue3D = null; super.handlePress(p, q);
        }
      }
      if (!previous) return super.checkContact(p, dt, null, flightTime);
      // Parent contact logic dispatches to the spatial swept test below.
      previous.z = this._previous3D?.z ?? s.z;
      previous.players.forEach((v, i) => { v.z = this.cloneHitting?.o===i ? this.cloneHitting.z : this._previous3D?.players[i] ?? this.players[i].z; });
      return super.checkContact(p, dt, previous, flightTime);
    }
    ringError(p, s) {
      const dx = (s.x-p.x)*p.dir, dy = s.y-p.y-C.SHOULDER, dz = finite(s.z)-finite(p.z);
      return Math.abs(Math.hypot(dx,dy,dz)-C.ARM) + Math.max(0, -dx-.5)*.7;
    }
    checkSweptContact(p, dt, prev, flightTime) {
      const sw = p.swing, s = this.shuttle, reach = this.reachFor(p), old = prev.players[p.idx];
      const start = sw.t-dt, lo = Math.max(0,(C.SW_W0-start)/dt), hi = Math.min(1,flightTime/dt,(C.SW_W1-start)/dt);
      let best = null;
      if (hi >= lo) for (let j=0;j<=8;j++) {
        const u=lerp(lo,hi,j/8), f=clamp(u*dt/Math.max(1e-9,flightTime),0,1);
        const ball={x:lerp(prev.x,s.x,f),y:lerp(prev.y,s.y,f),z:lerp(prev.z,s.z,f)};
        if (ball.x*p.side <= C.SHUTTLE_R || ball.y <= C.SHUTTLE_R) continue;
        const pose={x:lerp(old.x,p.x,u),y:lerp(old.y,p.y,u),z:lerp(old.z,p.z,u),dir:p.dir};
        const e=this.ringError(pose,ball);
        if (!best || e<best.e) best={u,e,ball,pose};
      }
      if (best && best.e<reach && (best.e<.1 || best.e>sw.prevE+1e-4 || sw.t+dt>C.SW_W1)) {
        const pose={x:p.x,y:p.y,z:p.z,onGround:p.onGround}, time=sw.t;
        Object.assign(s,best.ball); Object.assign(p,best.pose); p.onGround=p.y<=0; sw.t=start+best.u*dt;
        this.doHit(p,sw,best.e,reach); Object.assign(p,pose); sw.t=time; return true;
      }
      sw.prevE=best?.e??99;
      if(sw.t>C.SW_W1 && !sw.judged){sw.judged=true;this.judgeWhiff(p);}
      return false;
    }
    shotTarget(p, type, isServe = false) {
      const s = this.shuttle, d = Y.courtDirection(this.inputs[p.idx]);
      const near = ['drop','slice','net','tumble','block','sserve'].includes(type);
      const attack = ['smash','halfsmash','kill','drive'].includes(type);
      const depth = clamp((near ? 1.45 : attack ? 3.7 : 5.6) + d.move*(attack ? 1.65 : .6), .7, this.halfOf(1-p.idx)-.25);
      // Neutral is a true straight flight in the current shuttle lane, even
      // after a diagonal shot. No remembered aim or velocity is consulted.
      let z = Math.abs(d.strafe)<.08 ? s.z : clamp(s.z+d.strafe*4.1,-2.4,2.4);
      let x = depth;
      if (isServe) { x = clamp(x,C.SHORT_LINE+.25,C.HALF-.35); z = -Math.sign(p.z||1)*clamp(Math.abs(z),.35,WIDTH-.2); }
      return { x, z, move:d.move, strafe:d.strafe };
    }
    resolveShot(p, btn, q, isServe, opt) {
      const shot = super.resolveShot(p,btn,q,isServe,opt), s=this.shuttle;
      const aim = this.shotTarget(p,shot.type,isServe);
      const margin=(1-q)*.14/(p.st.control||1);
      const depth=clamp(aim.x+Y.gauss()*margin,.6,this.halfOf(1-p.idx)-.12);
      Object.assign(shot,Y.solveShot3D(s,{x:p.dir*depth,z:aim.z},shot.type,clamp(p.st.power*(shot.type==='smash'?( .9+.1*q)*(.85+.15*this.vigor(p)):1),.75,1.12),this.physEnv()));
      shot.direction3D = { ...aim };
      return shot;
    }
    shuttleScale(dt) { return super.shuttleScale(dt) * Y.COURT3D.flightPace; }
    realT(tau) {
      if (!(tau>0)) return 0;
      const edit=this.editRealT(tau,Y.COURT3D.flightPace);if(edit!=null)return edit;
      const now=this.shuttleScale(), normal=Y.COURT3D.flightPace;
      if(this.shuttle.bun)return tau/now;
      const until=this.shuttle.rush>0?this.shuttle.rush:Math.max(0,this.slowT);
      return until>0 && tau>until*now ? until+(tau-until*now)/normal : tau/now;
    }
    afterHit(p,shot,q,ctx) {
      const s=this.shuttle;
      s.vz=finite(shot.vz,s.vz); s.space3D=true;
      super.afterHit(p,shot,q,ctx);
      if(p.swing?.contact){p.swing.contact.z=s.z;p.swing.hand3D=(s.z-p.z)*p.dir<-.12?'backhand':'forehand';}
      p.aim3D=shot.direction3D?{x:shot.direction3D.x,z:shot.direction3D.z}:null;
      p.hitPose3D={x:s.x,y:s.y,z:s.z,t:this.time,hand:(s.z-p.z)*p.dir<-.12?-1:1,type:shot.type};
      this.rePred();
    }
    rePred(hidden) {
      const s=this.shuttle, ctl=s.ctl;
      if(s.slam&&!s.crossedNet&&!s.netHit&&!ctl){
        const c=s.slam,p=this.players[c.o],path=Y.slamPath(s.x,s.y,s.vx,s.vy,{side:p.side,walls:this.wallsOf(c.o),boost:c.steam?1.25:1.18,floor:c.floor,env:this.physEnv()});
        this.pred={...path,landZ:s.z,pts:path.pts.map(q=>({...q,z:s.z,vz:0})),t0:this.time,hidden:hidden??false};return;
      }
      const src=ctl&&['freeze','warp'].includes(ctl.k)?{...s,vx:ctl.vx,vy:ctl.vy,vz:finite(ctl.vz,s.vz)}:s;
      this.pred={...Y.simulate3D(src,this.physEnv()),t0:this.time+(ctl?.t||0),hidden:hidden??this.hintHidden()};
    }
    scorePoint(x) { super.scorePoint(x); this.shuttle.vz=0; this.landMark.z=this.shuttle.z; for(const p of this.players)p.shotQueue3D=null; }
    racketGap(p,x,y) { return Math.hypot(x-p.x-p.dir*.6,y-p.y-C.SHOULDER,this.shuttle.z-p.z); }
    deviceContact(e,r) { if(!Y.spatialNear(this,e,this.shuttle,r))return false; return super.deviceContact(e,r); }
    addEnt(k,o,x,y,t,extra) {
      const p=this.players[o], s=this.shuttle;
      const offensive=['cone','packet','peel','quake','sign'].includes(k);
      let z=offensive?this.players[1-o]?.z:p?.z;
      if(['board','pane','moon','wind','appoint','mini'].includes(k))z=this._skillZ3D ?? (s.live && s.lastHitter!==o ? finite(this.pred?.landZ,s.z) : p?.z);
      if(k==='gate'&&extra?.pair)z=p?.aim3D?.z??-finite(p?.z);
      return super.addEnt(k,o,x,y,t,{z:clamp(finite(z),-WIDTH,WIDTH),...extra});
    }
    useSkill(p,slot=0,pr={}) {
      const id=p.kit?.act[slot], before=p.energy, x=p.x, z=p.z, old=this.eid;
      const d=Y.courtDirection(this.inputs[p.idx]);
      const manual=Math.hypot(d.move,d.strafe)>.12;
      const replayAim=id==='yipai'&&typeof pr?.aim==='object'?Y.cleanSkillAim(pr.aim):null;
      const raw={x:d.strafe,y:replayAim?.y??d.move};
      this._skillZ3D=manual?clamp(p.z+raw.x*2.6,-WIDTH,WIDTH):null;
      this._skillAim3D=manual||replayAim?.y?raw:null;
      const baseAim=manual?{x:raw.y,y:['weichui','bianpai','yipai'].includes(id)?raw.y*.55:.3}:0;
      const length=typeof baseAim==='object'?Math.max(1,Math.hypot(baseAim.x,baseAim.y)):1;
      const result=super.useSkill(p,slot,{aim:typeof baseAim==='object'?{x:baseAim.x/length,y:baseAim.y/length}:0,...(pr?.cookTarget?{cookTarget:pr.cookTarget}:{})});
      if(result || before!==p.energy || this.eid!==old) {
        const mobility=['yuyue','tafeng','jindou','shihua','shuizhong'];
        if(mobility.includes(id)) {
          const target=manual?this._skillZ3D:(this.shuttle.live?finite(this.pred?.landZ,this.shuttle.z):p.z);
          if(Math.abs(p.x-x)>1.2)p.z=clamp(target,-LIMIT,LIMIT);
          else p.dash3D={v:clamp((target-p.z)*4,-6.8,6.8),t:.38};
        }
        if(['yuyue','tafeng'].includes(id)){let vx=manual?d.move*p.dir:this.shuttle.x-p.x,vz=manual?d.strafe:finite(this.pred?.landZ,this.shuttle.z)-p.z;const n=Math.hypot(vx,vz)||1;p.dash3D={x:vx/n*6.8,v:vz/n*6.8,t:.38};}
        p.castPose3D={id,t:this.time};this.emit({type:'spatialSkill',p:p.idx,id,x:p.x,y:p.y,z:p.z});
      }
      this._skillZ3D=null; this._skillAim3D=null; return result;
    }
    skillTarget(p,id,v) {
      const at=super.skillTarget(p,id,v),raw=this._skillAim3D;
      if(id==='shuangji'){
        const o=this.players[1-p.idx],half=1.4,H=this.halfOf(o.idx);
        if(raw)at.x=o.side*clamp(o.side*o.x+raw.y*2.7,half+.25,H-half-.2);
        this._skillZ3D=clamp(raw?o.z+raw.x*2.5:o.z,-2.59+1.05,2.59-1.05);
        return at;
      }
      if(!raw){if(this.shuttle.live&&this.shuttle.lastHitter!==p.idx){const q=this.pred?.pts?.find(q=>q.t>this.time-(this.pred.t0||0)+.25&&q.x*p.side>.6&&q.y>.8&&q.y<3.8);if(q){this._skillZ3D=clamp(q.z,-WIDTH,WIDTH);return{x:q.x,y:q.y};}}return at;}
      at.x=p.side*clamp(p.side*p.x-finite(raw.y)*3.5,.65,this.halfOf(p.idx)-.35);
      let closest=null;
      for(const q of this.pred?.pts||[])if(q.y>.8&&q.y<4.2&&q.x*p.side>.3&&(!closest||Math.abs(q.x-at.x)<Math.abs(closest.x-at.x)))closest=q;
      at.y=closest?.y??(id==='yueliang'?2.5:1.6);
      return at;
    }
    skControl(dt) {
      const s=this.shuttle,c=s.ctl;
      if(!c)return;
      if(this._ctl3D!==c){this._ctl3D=c;c.z0=s.z;c.vz=finite(c.vz,s.vz);if(c.k==='relay'){const cl=this.entOf('clone',c.o);c.toZ=c.to==='clone'?finite(cl?.z):finite(this.players[c.o]?.z);}if(c.k==='wok')c.toZ??=finite(this.players[c.o]?.z);}
      const p=this.players[c.o];
      super.skControl(dt);
      if(s.ctl===c){
        if(['cradle','tether'].includes(c.k)&&p)s.z=lerp(s.z,p.z,Math.min(1,dt*9));
        else if(c.k==='rewind'&&c.path?.[c.i])s.z=c.path[c.i][4]??c.z0;
        else if(c.k==='relay'||c.k==='wok')s.z=lerp(c.z0,c.toZ,clamp(c.f/c.T,0,1));
        else if(c.k==='warp')s.z=c.z??c.z0;
        else if(c.k==='orbit')s.z=c.z0+Math.sin(c.a)*.35;
        s.vz=0;
      }else if(!s.ctl){if(['freeze','warp'].includes(c.k))s.vz=finite(c.vz);else if(['relay','wok','cradle','yoyo'].includes(c.k)){if(c.toZ!=null)s.z=c.toZ;s.vz=0;}this.rePred();}
    }
    skShuttle(previous,r) {
      // Local devices occupy lanes. Keep non-contact entities available to the
      // original skill code (paired portals, counters and return chains).
      return super.skShuttle(previous,r);
    }
  }
  Y.Match3D=Match3D;
  Y.createMatch=opt=>new (opt?.courtMode==='3d'?Y.Match3D:Y.Match)(opt);
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
