/* 原创可缩放剧情美术。相同矢量图元用于游戏 Canvas 与独立 SVG 导出。 */
(function (G) {
  'use strict';
  const YY=G.YY;
  const art={};
  const palette={wall:'#1a3044',floor:'#603d37',gold:'#efbd68',ink:'#102235',mint:'#67bba8',paper:'#e9d8b6'};
  function scene(id,name,mode) {
    const shapes=[];
    const rect=(x,y,w,h,fill,rx=0)=>shapes.push({type:'rect',x,y,w,h,fill,rx});
    const line=(points,stroke,width=2,fill='none')=>shapes.push({type:'poly',points,stroke,width,fill});
    const ellipse=(x,y,rx,ry,fill)=>shapes.push({type:'ellipse',x,y,rx,ry,fill});
    const text=(x,y,words,size=24,fill=palette.paper)=>shapes.push({type:'text',x,y,text:words,size,fill});
    const window=(x,y,w,h,day=false)=>{
      rect(x-8,y-8,w+16,h+16,'#102032',7);rect(x,y,w,h,day?'#93bac4':'#375b72',2);
      rect(x+w*.5-3,y,6,h,'#192c3e');rect(x,y+h*.55,w,6,'#192c3e');
      for(let k=0;k<7;k++)rect(x+k*w/7,y+h*.72-(k%3)*15,w/8,h*.28+(k%3)*15,day?'#718f9a':'#263c55');
      line([[x,y+h],[x+w,y+h],[x+w+120,610],[x+30,610]],'none',0,day?'#a49b7840':'#56748d20');
    };
    const board=(x,y,w,h,title)=>{
      rect(x-9,y-9,w+18,h+18,'#443126',8);rect(x,y,w,h,'#37534f',3);text(x+20,y+32,title,23,'#f3cf86');
      for(let i=0;i<6;i++) {const px=x+18+(i%3)*(w-28)/3,py=y+53+Math.floor(i/3)*(h-62)/2;rect(px,py,(w-48)/3,(h-83)/2,i%2?'#d2c6aa':'#eadabd',2);ellipse(px+12,py+7,3,3,'#ab5f58');for(let j=0;j<3;j++)rect(px+9,py+19+j*8,(w-48)/3-22,2,'#87938e');}
    };
    const chair=(x,y,c='#49717a')=>{rect(x,y,46,63,c,5);rect(x-3,y+59,52,9,c,4);line([[x+4,y+65],[x+2,y+103]],'#243543',5);line([[x+42,y+65],[x+45,y+103]],'#243543',5);};
    const plant=(x,y)=>{rect(x-18,y-4,38,36,'#a97052',4);for(let j=0;j<5;j++){line([[x,y],[x+(j-2)*17,y-48-Math.abs(j-2)*4]],'#3d6454',4);ellipse(x+(j-2)*14,y-44-Math.abs(j-2)*4,12,22,j%2?'#698c64':'#427561');}};
    rect(0,0,1280,720,'#142338');
    rect(0,0,1280,520,mode==='dawn'?'#5f7a7c':mode==='hearing'?'#526366':'#253b4b');
    rect(0,520,1280,200,mode==='community'?'#346d68':'#59423b');
    for(let k=0;k<16;k++)line([[640+(k-8)*42,520],[640+(k-8)*165,720]],'#cfaa7540',2);
    [560,610,675].forEach(y=>line([[0,y],[1280,y]],'#1b2a3440',2));
    rect(0,515,1280,8,'#d1ad7760');
    if(['rain','dawn','community'].includes(mode)) {
      for(let k=0;k<5;k++)window(68+k*245,92,173,235,mode==='dawn');
      for(let k=0;k<6;k++){rect(k*246-8,0,18,517,'#122b39');line([[k*245,0],[640,88]],'#60767a',9);}
      rect(0,16,1280,24,'#122335');
      for(let k=0;k<4;k++){line([[195+k*300,40],[195+k*300,81]],'#c5c0a0',2);rect(149+k*300,81,92,12,'#f9d88d',4);ellipse(195+k*300,101,79,19,'#f5c36618');}
      line([[218,711],[407,547],[884,547],[1101,711]],'#d7e7d4',3);
      line([[287,650],[1024,650]],'#d7e7d4',3);line([[646,549],[650,717]],'#d7e7d4',3);
      line([[359,479],[360,607]],'#172b39',7);line([[971,479],[972,607]],'#172b39',7);
      rect(360,482,612,78,'#1c2c3148');
      for(let j=0;j<35;j++)line([[360+j*18,483],[360+j*18,559]],'#afcbc02f',1);
      for(let j=0;j<6;j++)line([[360,484+j*13],[972,484+j*13]],'#afcbc02f',1);
      rect(356,478,620,6,'#e9dfc9');
      board(20,345,235,140,mode==='dawn'?'明天也开门':'星光球馆');
      chair(1095,449);chair(1152,449);plant(1221,492);
      if(mode==='rain'){rect(0,0,1280,720,'#10223835');for(let k=0;k<80;k++){const x=(k*117)%1280,y=(k*83)%300+94;line([[x,y],[x-8,y+22]],'#b2d9e94a',1);}ellipse(1030,522,27,6,'#99bbbf');rect(1010,484,40,37,'#567e84',5);}
      if(mode==='dawn'){line([[1010,0],[1150,0],[740,720],[450,720]],'none',0,'#ffe4a71a');rect(0,0,1280,720,'#ffcf7010');}
      if(mode==='community'){board(986,331,250,102,'欢迎第一次拿拍');for(let i=0;i<6;i++){line([[80+i*180,40],[90+i*180,85],[112+i*180,40]],'none',0,['#d27c69','#d9b566','#6faea3'][i%3]);}}
    } else if(mode==='archive') {
      window(890,72,278,283,false);
      for(let row=0;row<3;row++){rect(40,139+row*104,706,15,'#a7805e');for(let j=0;j<9;j++){const x=52+j*75;rect(x,72+row*104,60,65,'#786c58',3);rect(x+7,82+row*104,44,19,'#d8c5a1');rect(x+9,86+row*104,32,3,'#6d7b75');}}
      rect(43,49,19,407,'#362e29');rect(738,49,19,407,'#362e29');
      rect(242,444,766,34,'#b98a61',8);rect(265,478,21,155,'#302c2c');rect(963,478,21,155,'#302c2c');
      rect(500,376,165,71,'#162b37',7);rect(511,389,143,48,'#4e7682');line([[540,403],[621,423],[570,428]],'#91c7c2',3);
      rect(302,412,152,25,'#e7d4ac',2);rect(327,391,146,23,'#ddd2af',2);
      rect(742,390,118,65,'#997451',4);rect(752,399,98,46,'#e5d5b5');
      for(let k=0;k<4;k++){ellipse(768+k*21,414,6,7,'#ba8b6a');rect(761+k*21,424,15,16,['#bd7161','#668c8a','#798466','#e0b66e'][k]);}
      text(63,42,'球馆档案 · 1996—',21,'#dfc99e');plant(1180,507);
    } else if(mode==='hearing') {
      for(let k=0;k<12;k++)rect(k*110,0,3,510,'#253c4430');
      rect(418,85,444,210,'#183c4c',12);rect(436,102,408,174,'#244c55',4);text(516,166,'星光球馆',44,'#e5d4a9');text(518,214,'开放计划 · 公开说明',25,'#acd6ca');
      window(42,85,220,276,true);window(1014,85,220,276,true);
      for(let k=0;k<7;k++)chair(380+k*80,387,'#315966');
      rect(289,445,706,29,'#bd936a',8);rect(309,474,20,100,'#263a42');rect(953,474,20,100,'#263a42');
      for(let k=0;k<5;k++){rect(398+k*95,427,52,17,'#e4d7b4');line([[430+k*95,440],[442+k*95,410]],'#1a303e',3);ellipse(445+k*95,407,7,4,'#102735');}
      for(let k=0;k<4;k++){chair(80+k*91,549);chair(845+k*91,549);}plant(1180,480);plant(107,488);
    } else if(mode==='locker') {
      for(let k=0;k<8;k++){const x=33+k*157;rect(x,94,145,366,k%2?'#466670':'#3a5564',7);rect(x+7,102,131,350,'#2e4b59',4);for(let j=0;j<4;j++)rect(x+40,120+j*9,67,3,'#122c3b');rect(x+117,242,6,29,'#d6bf87',2);text(x+23,210,String(k+1).padStart(2,'0'),24,'#719394');}
      rect(100,498,1080,23,'#b58960',5);for(let x=132;x<1160;x+=240)rect(x,521,18,86,'#152e3b');
      rect(303,464,140,34,'#b27063',12);line([[340,465],[365,437],[390,465]],'#c89974',6);ellipse(837,453,40,17,'#718c76');rect(837,443,57,27,'#496b71',7);text(40,49,'下一拍 · 从这里准备',28,'#cfb98f');
    } else { // notice / blackout
      window(944,87,233,290,false);board(164,93,647,319,mode==='blackout'?'停馆检查 · 请勿训练':'羽跃社 · 每个人都有位置');
      rect(911,431,287,18,'#ac8259',4);rect(930,447,15,98,'#22323a');rect(1170,447,15,98,'#22323a');
      plant(82,493);chair(838,441);text(178,463,'下一球，我们一起。',31,'#ddcba2');
      if(mode==='blackout'){rect(0,0,1280,720,'#050e20b8');line([[143,531],[841,224],[1000,389]],'none',0,'#ead99a20');rect(1004,57,169,47,'#4e8a75',4);text(1022,89,'安全出口 →',24,'#d7eee0');}
    }
    // Fine foreground scratches and soft vignette are shared visual texture.
    for(let k=0;k<15;k++)line([[k*91,706-(k%3)*11],[k*91+40,706-(k%3)*11]],'#d7bc8020',1);
    art[id]={id,name,width:1280,height:720,shapes};
    if(YY.SCENES)YY.SCENES[id]={name,bake(g,W,H){g.save();g.scale(W/1280,H/720);for(const s of shapes){
      if(s.type==='rect'){g.fillStyle=s.fill;if(s.rx&&YY.rr){YY.rr(g,s.x,s.y,s.w,s.h,s.rx);g.fill();}else g.fillRect(s.x,s.y,s.w,s.h);}
      else if(s.type==='ellipse'){g.fillStyle=s.fill;g.beginPath();g.ellipse(s.x,s.y,s.rx,s.ry,0,0,Math.PI*2);g.fill();}
      else if(s.type==='text'){g.fillStyle=s.fill;g.font=`600 ${s.size}px sans-serif`;g.textAlign='left';g.fillText(s.text,s.x,s.y);}
      else{g.beginPath();s.points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));if(s.fill!=='none'){g.closePath();g.fillStyle=s.fill;g.fill();}if(s.stroke!=='none'){g.strokeStyle=s.stroke;g.lineWidth=s.width;g.stroke();}}
    }g.restore();}};
  }
  scene('notice','羽跃社公告栏','notice');scene('archive','球馆档案室','archive');scene('rainhall','风雨中的星光球馆','rain');scene('blackout','停电后的安全出口','blackout');
  scene('hearing','公开说明会','hearing');scene('community','社区开放日','community');scene('locker','赛前更衣室','locker');scene('dawnhall','清晨重新开门','dawn');
  YY.STORY_ART=art;
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
