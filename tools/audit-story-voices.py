"""Decode and measure every packaged dialogue file. Requires FFmpeg and NumPy."""
import json,pathlib,subprocess,numpy as np,concurrent.futures
root=pathlib.Path(__file__).resolve().parents[1]
(root/'output/story-expansion').mkdir(parents=True,exist_ok=True)
bank=json.loads((root/'assets/story/voice-manifest.json').read_text())
def audit(entry):
 key,item=entry
 p=root/'assets/story/voices'/item['file']
 data=subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-ac','1','-ar','24000','-'],capture_output=True,check=True).stdout
 samples=np.frombuffer(data,dtype=np.float32)
 peak=float(np.max(np.abs(samples)));rms=float(np.sqrt(np.mean(samples**2)));duration=len(samples)/24000
 if not np.isfinite(samples).all() or peak>.99 or rms<.003 or duration<.2:raise ValueError((key,peak,rms,duration))
 return key,{'peak':round(peak,4),'rms':round(rms,4),'duration':round(duration,3)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=dict(pool.map(audit,bank.items()))
report={'files':len(results),'minutes':round(sum(r['duration'] for r in results.values())/60,2),'maxPeak':max(r['peak'] for r in results.values()),'clips':results}
(root/'output/story-expansion/voice-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print({k:v for k,v in report.items() if k!='clips'})
