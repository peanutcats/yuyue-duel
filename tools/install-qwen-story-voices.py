"""Validate and package all approved Qwen masters; leaves old assets backed up."""
import concurrent.futures, hashlib, json, pathlib, shutil, subprocess
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'output/qwen-full';ENC=OUT/'encoded';ENC.mkdir(exist_ok=True)
rows=json.loads((ROOT/'assets/story/voice-script.json').read_text())
cast=json.loads((ROOT/'output/qwen-voice-audition/voices.json').read_text())

def encode(row):
 source=OUT/(row['id']+'.wav');meta=json.loads((OUT/(row['id']+'.json')).read_text())
 assert meta['model']=='qwen-audio-3.1-tts-plus' and meta['text']==row['text'] and meta['who']==row['who']
 assert meta['voice']==cast[row['who']]['voice'], 'Unapproved voice for '+row['who']
 raw=subprocess.run(['ffmpeg','-v','error','-i',str(source),'-f','f32le','-ar','24000','-ac','1','-'],capture_output=True,check=True).stdout
 values=np.frombuffer(raw,dtype='<f4');duration=len(values)/24000
 if not np.isfinite(values).all() or not .2<duration<90 or np.sqrt(np.mean(values**2))<.001:raise ValueError('Invalid master '+row['id'])
 target=ENC/(row['id']+'.mp3')
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-af','highpass=f=70,loudnorm=I=-19:TP=-2:LRA=9,afade=t=in:d=0.008','-ar','24000','-ac','1','-b:a','48k','-metadata','comment=AI-generated dialogue; Qwen-Audio-3.1-TTS-Plus',str(target)],capture_output=True,check=True)
 entry={'root':row['root'],'file':target.name,'duration':duration,'speaker':row['who'],'engine':meta['model'],'voice':meta['voice'],'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
 return row['id'],entry

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:manifest=dict(pool.map(encode,rows))
assert len(manifest)==603
size=sum((ENC/x['file']).stat().st_size for x in manifest.values());packs={}
for x in manifest.values():packs[x['root']]=packs.get(x['root'],0)+(ENC/x['file']).stat().st_size
if any(n>3.95*1048576 for n in packs.values()):raise ValueError('Speech subpackage too large: '+str(packs))
backup=OUT/'previous-assets'
if not backup.exists():
 backup.mkdir();shutil.copytree(ROOT/'assets/story/voices',backup/'voices');shutil.copy(ROOT/'assets/story/voice-manifest.json',backup/'voice-manifest.json')
dest=ROOT/'assets/story/voices'
for row in rows:
 shutil.copy(ENC/(row['id']+'.mp3'),dest/(row['id']+'.mp3'))
 shutil.copy(OUT/(row['id']+'.json'),dest/(row['id']+'.json'))
(ROOT/'assets/story/voice-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
for file in dest.iterdir():
 if file.suffix in ['.json','.mp3'] and file.stem not in manifest:file.unlink()
report={'clips':len(manifest),'minutes':sum(x['duration'] for x in manifest.values())/60,'bytes':size,'packages':packs,'billedCharacters':sum(json.loads((OUT/(r['id']+'.json')).read_text()).get('usage',{}).get('characters',0) for r in rows)}
(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
