"""Assemble local listening samples without touching the game's installed voices."""
import pathlib,json,subprocess,wave,hashlib,html
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'output/qwen-voice-audition'
profiles=json.loads((ROOT/'tools/qwen-voice-profiles.json').read_text())['profiles']
samples=json.loads((OUT/'samples.json').read_text())
audit={};audios={}
for key,item in samples.items():
 raw=subprocess.run(['ffmpeg','-v','error','-i',str(OUT/item['file']),'-f','f32le','-ar','24000','-ac','1','-'],capture_output=True,check=True).stdout
 s=np.frombuffer(raw,dtype=np.float32).copy()
 if not len(s) or not np.isfinite(s).all() or np.sqrt(np.mean(s*s))<.001:raise ValueError('Invalid audio '+key)
 peak=float(max(abs(s)));s*=min(1,.84/max(.001,peak))
 audit[key]={'seconds':round(len(s)/24000,3),'sourcePeak':round(peak,5),'sourceSaturatedSamples':int((abs(np.frombuffer(raw,dtype=np.float32))>=.9997).sum()),'sha256':hashlib.sha256((OUT/item['file']).read_bytes()).hexdigest()}
 audios[key]=s

def export(name,parts):
 samples=np.concatenate([p for a in parts for p in [a,np.zeros(12000,dtype=np.float32)]])
 wav=OUT/(name+'.wav')
 with wave.open(str(wav),'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(np.round(np.clip(samples,-.99,.99)*32767).astype('<i2').tobytes())
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-ac','1','-ar','24000','-b:a','128k',str(OUT/(name+'.mp3'))],check=True,capture_output=True)
 return round(len(samples)/24000,2)

for who in profiles:
 parts=[audios[k] for k,v in samples.items() if v['who']==who]
 if parts:export(who+'-audition',parts)
showcase=['me','canglan','xiaohong','mm','houzi','guoge','zhu','nar']
parts=[];order=[]
for who in showcase:
 keys=[k for k,v in samples.items() if v['who']==who]
 if keys:parts.append(audios[keys[0]]);order.append(profiles[who]['name'])
length=export('role-showcase',parts)
audit_summary={'clips':len(audit),'seconds':sum(x['seconds'] for x in audit.values()),'billableCharacters':sum(x.get('usage',{}).get('characters',0) for x in samples.values()),'showcaseOrder':order,'showcaseSeconds':length,'clipsDetail':audit}
(OUT/'audit.json').write_text(json.dumps(audit_summary,ensure_ascii=False,indent=2)+'\n')

e=html.escape
cards=[]
for who,p in profiles.items():
 rows=[v for v in samples.values() if v['who']==who]
 if not rows:continue
 lines=''.join('<li><b>'+e({'talk':'自然对白','think':'思考','point':'提醒','smile':'带笑','wave':'招呼','happy':'喜悦','cheer':'兴奋','angry':'生气','fist':'坚定','surprise':'惊讶','sad':'低落','shy':'含蓄','tired':'疲惫'}.get(r['mood'],r['delivery']))+'</b> '+e(r['text'])+'</li>' for r in rows)
 cards.append(f'<article><div class="number">{len(cards)+1:02}</div><h2>{e(p["name"])}</h2><p class="direction">{e(p["prompt"])}</p><audio controls preload="metadata" src="{who}-audition.mp3"></audio><ol>{lines}</ol></article>')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>羽跃对决 · Qwen 角色试音</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f1e9;color:#162a2b;font:16px/1.6 system-ui,-apple-system,sans-serif}header,main,footer{max-width:1180px;margin:auto;padding:32px}header{padding-top:48px}.eyebrow{font-size:12px;letter-spacing:.16em;color:#657676}h1{font-size:38px;margin:8px 0;line-height:1.2}header p{max-width:760px;color:#566564}.sample{border-left:4px solid #c3753a;padding:8px 22px;background:#ebe8df}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}article{position:relative;background:#fffdf7;border:1px solid #d8d8ca;border-radius:12px;padding:22px;min-width:0}.number{font-size:12px;color:#988467;letter-spacing:.13em}h2{margin:4px 0 12px;font-size:25px}.direction{font-size:13px;color:#677472;min-height:130px}audio{width:100%;height:42px;margin:10px 0}ol{padding-left:20px;font-size:14px}li{margin:14px 0}b{display:block;font-size:11px;color:#9b653b;letter-spacing:.09em}footer{color:#6a7773;font-size:13px}@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:580px){header,main,footer{padding:22px}.grid{grid-template-columns:1fr}h1{font-size:31px}.direction{min-height:0}}
</style><header><div class="eyebrow">YUYUE DUEL / VOICE CASTING</div><h1>让每个人，听起来像自己。</h1><p>Qwen-Audio-3.1-TTS-Plus 原创角色音色试听。每个角色提供三段真实剧情台词，覆盖常态与不同情绪；旁白以场景叙述为主。</p><div class="sample"><strong>先听角色速览</strong><p>ORDER</p><audio controls preload="metadata" src="role-showcase.mp3"></audio></div></header><main class="grid">CARDS</main><footer>这是试听稿，尚未替换游戏内配音。音频由 AI 合成。请选择需要调整的角色，并说明声音的年龄感、音调或语气；同一角色的音色 ID 会在全剧中固定使用。</footer><script>document.addEventListener('play',e=>{if(e.target.tagName==='AUDIO')document.querySelectorAll('audio').forEach(a=>{if(a!==e.target)a.pause()})},true)</script></html>'''.replace('ORDER',e(' → '.join(order))).replace('CARDS',''.join(cards))
(OUT/'index.html').write_text(page)
print(json.dumps({k:v for k,v in audit_summary.items() if k!='clipsDetail'},ensure_ascii=False))
