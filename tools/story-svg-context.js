'use strict';
// Canvas subset used by the shared scene and character artists. Exports their
// actual paths, including the existing game rig, without a second avatar design.
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
class SVGContext {
 constructor(){this.body=[];this.defs=[];this.stack=[];this.transforms=[];this.clips=[];this.globalAlpha=1;this.fillStyle='#000';this.strokeStyle='#000';this.lineWidth=1;this.lineCap='round';this.lineJoin='round';this.font='16px sans-serif';this.textAlign='left';this.textBaseline='alphabetic';this.beginPath();}
 save(){const state={};for(const k of ['globalAlpha','fillStyle','strokeStyle','lineWidth','lineCap','lineJoin','font','textAlign','textBaseline'])state[k]=this[k];this.stack.push({...state,transforms:[...this.transforms],clips:[...this.clips]});}
 restore(){Object.assign(this,this.stack.pop()||{});}
 translate(x,y){this.transforms.push(`translate(${x} ${y})`);}scale(x,y){this.transforms.push(`scale(${x} ${y})`);}rotate(r){this.transforms.push(`rotate(${r*180/Math.PI})`);}
 beginPath(){this.d=[];this.hasPoint=false;}moveTo(x,y){this.d.push(`M${x} ${y}`);this.hasPoint=true;this.cx=x;this.cy=y;}lineTo(x,y){this.d.push(`${this.hasPoint?'L':'M'}${x} ${y}`);this.hasPoint=true;this.cx=x;this.cy=y;}closePath(){this.d.push('Z');}
 rect(x,y,w,h){this.d.push(`M${x} ${y}h${w}v${h}h${-w}Z`);this.hasPoint=true;}
 quadraticCurveTo(...v){this.d.push('Q'+v.join(' '));}bezierCurveTo(...v){this.d.push('C'+v.join(' '));}
 arcTo(x,y,x2,y2,r){const ax=this.cx-x,ay=this.cy-y,bx=x2-x,by=y2-y,al=Math.hypot(ax,ay),bl=Math.hypot(bx,by);if(!al||!bl||!r){this.lineTo(x,y);return;}const ux=ax/al,uy=ay/al,vx=bx/bl,vy=by/bl,angle=Math.acos(Math.max(-1,Math.min(1,ux*vx+uy*vy))),d=r/Math.tan(angle/2),tx=x+vx*d,ty=y+vy*d;this.lineTo(x+ux*d,y+uy*d);this.d.push(`A${r} ${r} 0 0 ${ux*vy-uy*vx<0?1:0} ${tx} ${ty}`);this.cx=tx;this.cy=ty;}
 arc(x,y,r,a,b,ccw){this.ellipse(x,y,r,r,0,a,b,ccw);}
 ellipse(x,y,rx,ry,rot,a,b,ccw=false){let delta=b-a;if(Math.abs(delta)>=Math.PI*2-1e-8)delta=ccw?-Math.PI*2:Math.PI*2;else if(ccw&&delta>0)delta-=Math.PI*2;else if(!ccw&&delta<0)delta+=Math.PI*2;const n=Math.max(4,Math.ceil(Math.abs(delta)/.16));for(let i=0;i<=n;i++){const t=a+delta*i/n,xx=x+rx*Math.cos(t)*Math.cos(rot)-ry*Math.sin(t)*Math.sin(rot),yy=y+rx*Math.cos(t)*Math.sin(rot)+ry*Math.sin(t)*Math.cos(rot);this.lineTo(xx,yy);}}
 gradient(kind,v){const id='g'+this.defs.length,stops=[],item={id,kind,v,stops,addColorStop(at,c){stops.push([at,c]);}};this.defs.push(item);return item;}
 createLinearGradient(...v){return this.gradient('linear',v);}createRadialGradient(...v){return this.gradient('radial',v);}
 color(c){return typeof c==='object'?`url(#${c.id})`:c;}
 wrap(el){let text=`<g transform="${this.transforms.join(' ')}" opacity="${this.globalAlpha}">${el}</g>`;for(const c of this.clips)text=`<g clip-path="url(#${c})">${text}</g>`;this.body.push(text);}
 fill(){this.wrap(`<path d="${this.d.join(' ')}" fill="${esc(this.color(this.fillStyle))}"/>`);}
 stroke(){this.wrap(`<path d="${this.d.join(' ')}" fill="none" stroke="${esc(this.color(this.strokeStyle))}" stroke-width="${this.lineWidth}" stroke-linecap="${this.lineCap}" stroke-linejoin="${this.lineJoin}"/>`);}
 fillRect(x,y,w,h){this.wrap(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${esc(this.color(this.fillStyle))}"/>`);}
 strokeRect(x,y,w,h){const d=this.d;this.beginPath();this.rect(x,y,w,h);this.stroke();this.d=d;}
 clip(){const id='clip'+this.defs.length;this.defs.push({id,kind:'clip',d:this.d.join(' '),transform:this.transforms.join(' ')});this.clips.push(id);}
 fillText(text,x,y){this.wrap(`<text x="${x}" y="${y}" style="font:${esc(this.font)}" text-anchor="${this.textAlign==='center'?'middle':this.textAlign==='right'?'end':'start'}" dominant-baseline="${this.textBaseline==='middle'?'central':'auto'}" fill="${esc(this.color(this.fillStyle))}">${esc(text)}</text>`);}
 svg(name){const defs=this.defs.map(g=>{if(g.kind==='clip')return `<clipPath id="${g.id}"><path transform="${g.transform}" d="${g.d}"/></clipPath>`;const stops=g.stops.map(([at,c])=>`<stop offset="${at}" stop-color="${esc(c)}"/>`).join('');return g.kind==='linear'?`<linearGradient id="${g.id}" gradientUnits="userSpaceOnUse" x1="${g.v[0]}" y1="${g.v[1]}" x2="${g.v[2]}" y2="${g.v[3]}">${stops}</linearGradient>`:`<radialGradient id="${g.id}" gradientUnits="userSpaceOnUse" cx="${g.v[3]}" cy="${g.v[4]}" r="${g.v[5]}" fx="${g.v[0]}" fy="${g.v[1]}">${stops}</radialGradient>`;}).join('');return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><title>${esc(name)}</title><defs>${defs}</defs>${this.body.join('')}</svg>\n`;}
}
module.exports=SVGContext;
