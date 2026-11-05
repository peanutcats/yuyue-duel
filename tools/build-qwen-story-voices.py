"""Generate the approved complete cast, with resumable per-line masters and metadata."""
import concurrent.futures, hashlib, importlib.util, json, pathlib, shutil, subprocess, threading, time
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('qwen',ROOT/'tools/qwen-story-voices.py'); q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
OUT=ROOT/'output/qwen-full';OUT.mkdir(parents=True,exist_ok=True)
rows=json.loads((ROOT/'assets/story/voice-script.json').read_text())
cast=json.loads((ROOT/'output/qwen-voice-audition/voices.json').read_text())
pilots=json.loads((ROOT/'output/qwen-voice-audition/samples.json').read_text())
conf=q.credentials();local=threading.local()

def render(row):
 who=row['who'];voice=cast[who]
 instruction=q.CATALOG['direction']+'本句：'+q.MOODS.get(row['mood'],q.MOODS['talk'])
 digest=hashlib.sha256((q.MODEL+voice['voice']+row['text']+instruction).encode()).hexdigest()
 wav=OUT/(row['id']+'.wav');meta=OUT/(row['id']+'.json');cached=json.loads(meta.read_text()) if meta.exists() else {}
 if cached.get('digest')!=digest or not wav.exists():
  pilot=pilots.get(who+'-'+row['id'])
  if pilot and pilot.get('digest')==digest:
   shutil.copyfile(ROOT/'output/qwen-voice-audition'/pilot['file'],wav)
   cached={**pilot,'digest':digest,'reused_audition':True}
  else:
   if not hasattr(local,'client'):local.client=q.Client(conf)
   client=local.client
   for attempt in range(3):
    try:
     r=client.call('SpeechSynthesizer',{'model':q.MODEL,'input':{'text':row['text'],'voice':voice['voice'],'format':'wav','sample_rate':24000,'language_hints':['zh'],'instruction':instruction,'seed':2026,'enable_aigc_tag':True}})
     raw=client.download(r['output']['audio']['url'])
     if raw[:4]!=b'RIFF':raise RuntimeError('Unexpected audio format')
     wav.write_bytes(raw);cached={'digest':digest,'request_id':r.get('request_id'),'usage':r.get('usage',{}),'reused_audition':False};break
    except RuntimeError as e:
     if attempt==2 or not any(s in str(e) for s in ['429','500','502','503','504','Network']):raise
     time.sleep(2**(attempt+1))
  cached.update({'model':q.MODEL,'voice':voice['voice'],'text':row['text'],'instruction':instruction,'who':who})
  q.save_json(meta,cached)
 return row['id']

if __name__=='__main__':
 assert len(rows)==603,'Script changed: review current line count before full generation'
 assert all(r['who'] in cast for r in rows)
 started=time.monotonic();done=0;errors=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  jobs={pool.submit(render,r):r for r in rows}
  for job in concurrent.futures.as_completed(jobs):
   try:job.result();done+=1
   except Exception as e:errors.append(jobs[job]['id']);print('FAILED',jobs[job]['id'],str(e) if isinstance(e,RuntimeError) else type(e).__name__,flush=True)
   if done%25==0:print(f'Generated {done}/{len(rows)} in {time.monotonic()-started:.0f}s',flush=True)
 if errors:raise SystemExit('Incomplete lines: '+','.join(errors))
 print('All 603 approved Qwen master recordings ready.',flush=True)
