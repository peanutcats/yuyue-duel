"""Render original dialogue locally with Apache-licensed Kokoro 1.1 Chinese.

python tools/build-story-voices.py --model-dir /path/to/models
See assets/story/README.md for dependencies, provenance and download locations.
Models never enter the mini-game package. No API key or speech upload.
"""
import argparse, hashlib, json, pathlib, re, subprocess, tempfile, time
import numpy as np
import onnxruntime as ort
import soundfile as sf
from misaki import zh
ort.disable_telemetry_events()

ROOT = pathlib.Path(__file__).resolve().parents[1]
ENGINE = 'kokoro-v1.1-zh-int8'
PROFILES = {
 'me': ('zm_010', 1.02), 'lingfeng': ('zm_010', 1.02),
 'canglan': ('zf_026', .98), 'xiaohong': ('zm_025', 1.04),
 'ranran': ('zf_001', .99), 'xingxing': ('zf_017', .98),
 'ruibao': ('zm_033', 1.00), 'dingding': ('zm_050', 1.05),
 'lu': ('zm_009', .97), 'tianchu': ('zm_045', .98),
 'zhu': ('zm_014', .94), 'mm': ('zf_005', 1.08), 'nar': ('zf_008', 1.00),
 'houzi': ('zm_030', 1.00), 'laochen': ('zm_062', 1.03), 'guoge': ('zm_080', .96),
}

def main():
 parser = argparse.ArgumentParser()
 parser.add_argument('--model-dir', type=pathlib.Path, required=True)
 parser.add_argument('--limit', type=int, default=0, help='Audition only; do not replace manifest')
 parser.add_argument('--threads', type=int, default=4)
 args = parser.parse_args()
 rows = json.loads((ROOT/'assets/story/voice-script.json').read_text())
 model = args.model_dir/'kokoro-v1.1-zh.int8.onnx'
 voices_file = args.model_dir/'voices-v1.1-zh.bin'
 config = json.loads((args.model_dir/'config.json').read_text())
 model_hash = hashlib.sha256(model.read_bytes()).hexdigest()
 opts = ort.SessionOptions(); opts.intra_op_num_threads=args.threads; opts.inter_op_num_threads=1
 session = ort.InferenceSession(str(model), opts, providers=['CPUExecutionProvider'])
 voices = np.load(voices_file, allow_pickle=False)
 inputs = {i.name: i.type for i in session.get_inputs()}
 tokens_key = 'input_ids' if 'input_ids' in inputs else 'tokens'
 g2p = zh.ZHG2P(version='1.1')
 out = ROOT/'assets/story/voices'; out.mkdir(parents=True, exist_ok=True)
 results = {}; started=time.monotonic()
 for i,row in enumerate(rows[:args.limit or len(rows)], 1):
  voice, speed = PROFILES[row['who']]
  digest = hashlib.sha256(f"{ENGINE}|{model_hash}|{voice}|{speed}|{row['text']}".encode()).hexdigest()
  target = out/(row['id']+'.mp3'); stamp=out/(row['id']+'.json')
  cached = json.loads(stamp.read_text()) if stamp.exists() else {}
  if not target.exists() or cached.get('digest') != digest:
   spoken = row['text'].replace('BWF','世界羽联').replace('AI','人工智能').replace('3×15','三局十五分制')
   spoken = re.sub(r'(\d+)[:：](\d+)', r'\1比\2', spoken)
   pieces = [p for p in re.findall(r'[^。！？；]+[。！？；]?', spoken) if re.search(r'[A-Za-z0-9\u4e00-\u9fff]',p)]
   chunks=[]
   for piece in pieces:
    if chunks and len(chunks[-1])<8:chunks[-1]+=piece
    else:chunks.append(piece)
   if len(chunks)>1 and len(chunks[-1])<8:
    tail=chunks.pop();chunks[-1]+=tail
   audio=[]
   for chunk in chunks:
    if not re.search(r'[A-Za-z0-9\u4e00-\u9fff]',chunk):continue
    phonemes,_ = g2p(chunk)
    ids = [config['vocab'][c] for c in phonemes if c in config['vocab']]
    if not ids: continue
    if len(ids)>490: raise ValueError('Split long dialogue before synthesis: '+row['id'])
    pace=speed*max(.84,1-max(0,len(ids)-83)/600)
    speed_value=np.array([pace], dtype=np.float32)
    if inputs['speed']=='tensor(int64)':speed_value=np.array([1],dtype=np.int64)
    feed={
      tokens_key:np.array([[0,*ids,0]],dtype=np.int64),
      'style':np.asarray(voices[voice][len(ids)-1],dtype=np.float32),
      'speed':speed_value,
    }
    sound=session.run(None,feed)[0].flatten()
    if not np.isfinite(sound).all():
     feed['speed']=np.array([.9],dtype=speed_value.dtype)
     sound=session.run(None,feed)[0].flatten()
    active=np.flatnonzero(np.abs(sound)>.004)
    if len(active):sound=sound[max(0,active[0]-240):min(len(sound),active[-1]+1200)]
    audio.extend([sound,np.zeros(2400,dtype=np.float32)])
   if not audio:raise ValueError('No speech generated: '+row['id'])
   samples=np.concatenate(audio)
   if not np.isfinite(samples).all() or np.max(np.abs(samples))<.01:raise ValueError('Invalid audio: '+row['id'])
   with tempfile.TemporaryDirectory(prefix='yuyue-speech-') as temp:
    raw=pathlib.Path(temp)/'line.wav';sf.write(raw,samples,24000)
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw),'-af',
       'highpass=f=75,loudnorm=I=-20:TP=-3:LRA=7,afade=t=in:d=0.012',
       '-ac','1','-ar','24000','-b:a','32k',str(target)],check=True,capture_output=True)
   cached={'digest':digest,'engine':ENGINE,'modelSHA256':model_hash,'duration':len(samples)/24000,'voice':voice,'speed':speed}
   stamp.write_text(json.dumps(cached,ensure_ascii=False)+'\n')
  results[row['id']]={'root':row['root'],'file':target.name,'duration':cached['duration'],'speaker':row['who'],'engine':ENGINE,
      'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
  if i%10==0 or args.limit:print(f'Voiced {i}/{args.limit or len(rows)} in {time.monotonic()-started:.0f}s',flush=True)
 if not args.limit:
  (ROOT/'assets/story/voice-manifest.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
  for file in out.iterdir():
   if re.fullmatch(r'v[0-9a-f]+\.(mp3|json)',file.name) and file.stem not in results:
    file.unlink()
 print(f'Finished {len(results)} files, {sum((out/v["file"]).stat().st_size for v in results.values())/1024/1024:.2f} MiB',flush=True)

if __name__=='__main__':main()
