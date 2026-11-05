"""Qwen-Audio-TTS role audition. Credentials come from local .env, never output.

--check: read voice service connectivity. --design: create/reuse 15 voices.
--audition: render three actual lines per role; does not replace production audio.
"""
import argparse, base64, hashlib, json, os, pathlib, re, subprocess, sys, time
from urllib.parse import urlparse
import requests
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'output/qwen-voice-audition'
CATALOG=json.loads((ROOT/'tools/qwen-voice-profiles.json').read_text())
MODEL=CATALOG['model']


def credentials():
 values={}
 p=ROOT/'.env'
 if p.exists():
  for line in p.read_text().splitlines():
   if '=' in line and not line.lstrip().startswith('#'):
    k,v=line.split('=',1);values[k.strip()]=v.strip().strip('\"\'')
 for k in ['DASHSCOPE_API_KEY','DASHSCOPE_WORKSPACE_ID','DASHSCOPE_REGION']:
  if os.environ.get(k):values[k]=os.environ[k]
 if not values.get('DASHSCOPE_API_KEY'):raise RuntimeError('Missing DASHSCOPE_API_KEY')
 if values.get('DASHSCOPE_REGION')!='cn-beijing':raise RuntimeError('Audition is configured for Beijing')
 if not re.fullmatch(r'[a-z0-9-]+',values.get('DASHSCOPE_WORKSPACE_ID','')):raise RuntimeError('Invalid workspace ID')
 return values


def save_json(path,value):
 temp=path.with_suffix(path.suffix+'.tmp');temp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');temp.replace(path)


class Client:
 def __init__(self,conf):
  self.key=conf['DASHSCOPE_API_KEY']
  self.base='https://'+conf['DASHSCOPE_WORKSPACE_ID']+'.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/'
  self.session=requests.Session()
 def call(self,resource,body):
  try:
   r=self.session.post(self.base+resource,headers={'Authorization':'Bearer '+self.key,'Content-Type':'application/json'},json=body,timeout=(15,120),allow_redirects=False)
  except requests.RequestException as e:
   raise RuntimeError('Network request failed: '+type(e).__name__) from None
  try:data=r.json()
  except ValueError:raise RuntimeError('Service returned HTTP '+str(r.status_code)+' without JSON') from None
  if not r.ok or data.get('code'):
   message=str(data.get('message',''))[:400].replace(self.key,'[redacted]')
   raise RuntimeError(f"HTTP {r.status_code}; code={data.get('code','unknown')}; {message}")
  return data
 def custom(self,input):return self.call('customization',{'model':'voice-enrollment','input':input})
 def download(self,url):
  host=urlparse(url).hostname or ''
  if not host.endswith('.aliyuncs.com'):raise RuntimeError('Unexpected audio result host')
  # Result files use temporary signed URLs, with no API credential attached.
  url='https:'+url[5:] if url.startswith('http:') else url
  r=requests.get(url,timeout=(15,120));r.raise_for_status();return r.content


def lines_for(who,rows):
 source=[r for r in rows if r['who']==who]
 if not source:raise RuntimeError('Missing role '+who)
 groups=[('日常',['talk','think','point','smile','wave']),('激动',['cheer','angry','fist','surprise','happy']),('柔和',['sad','shy','tired','smile'])]
 result=[];used=set()
 for label,moods in groups:
  selected=next((r for m in moods for r in source if r['mood']==m and r['id'] not in used and 12<=len(r['text'])<=48),None)
  selected=selected or next((r for r in source if r['id'] not in used),source[0])
  used.add(selected['id']);result.append({**selected,'delivery':label})
 return result


MOODS={'angry':'有点不服气和着急，声音有力度但不要喊叫。','fist':'认真坚定，短句有力量。','cheer':'高兴而充满干劲，笑意自然。','surprise':'短暂惊讶，随后像向同伴确认。','happy':'轻松高兴，带自然的笑意。','sad':'略感失落，声音放轻，保留完整吐字，不要哭腔。','shy':'有点不好意思，停顿轻微，自然含蓄。','tired':'稍显疲惫，语速放缓但清楚。','think':'边想边说，停顿有分寸，不拖长。','point':'清楚地提醒同伴，强调关键动作。','smile':'温和带笑地交谈。','wave':'亲切地招呼同伴。','talk':'自然平实地交谈。'}


def main():
 p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');p.add_argument('--design',action='store_true');p.add_argument('--audition',action='store_true');p.add_argument('--role');p.add_argument('--max-billable-chars',type=int,default=5000)
 args=p.parse_args();OUT.mkdir(parents=True,exist_ok=True)
 conf=credentials();client=Client(conf)
 roles=CATALOG['profiles'];roles={args.role:roles[args.role]} if args.role else roles
 rows=json.loads((ROOT/'assets/story/voice-script.json').read_text())
 if args.check:
  result=client.custom({'action':'list_voice','prefix':'yy','page_index':0,'page_size':100})
  print('Voice service reachable; existing project voices:',len(result.get('output',{}).get('voice_list',[])))
  return
 cache=OUT/'voices.json';bank=json.loads(cache.read_text()) if cache.exists() else {}
 if args.design:
  existing=client.custom({'action':'list_voice','prefix':'yy','page_index':0,'page_size':100}).get('output',{}).get('voice_list',[])
  for who,profile in roles.items():
   if who in bank and bank[who].get('model')==MODEL and bank[who].get('prompt')==profile['prompt']:continue
   lines=lines_for(who,rows);preview=''.join(x['text'] for x in lines[:2])[:180]
   prefix='yy'+who[:8]
   # Recover an earlier server success before any retry could create a duplicate.
   recovered=next((v for v in existing if '-vd-'+prefix+'-' in v.get('voice_id','') and v.get('voice_prompt')==profile['prompt'] and v.get('voice_id','').startswith(MODEL)),None)
   if recovered:voice=recovered['voice_id'];request_id=None
   else:
    r=client.call('customization',{'model':'voice-enrollment','input':{'action':'create_voice','target_model':MODEL,'voice_prompt':profile['prompt'],'preview_text':preview,'prefix':prefix,'language_hints':['zh']},'parameters':{'sample_rate':24000,'response_format':'wav'}})
    voice=r['output']['voice_id'];request_id=r.get('request_id')
    raw=r['output'].get('preview_audio',{}).get('data')
    if raw:(OUT/(who+'-design.wav')).write_bytes(base64.b64decode(raw))
   bank[who]={'name':profile['name'],'voice':voice,'model':MODEL,'prompt':profile['prompt'],'request_id':request_id}
   save_json(cache,bank);print('Designed',profile['name'],flush=True)
 if not args.audition:return
 tasks=[line for who in roles for line in lines_for(who,rows)]
 estimated=sum(len(t['text'])+len(re.findall(r'[\u3400-\u9fff]',t['text'])) for t in tasks)
 if estimated>args.max_billable_chars:raise RuntimeError('Audition text exceeds configured character budget')
 samples_file=OUT/'samples.json';samples=json.loads(samples_file.read_text()) if samples_file.exists() else {}
 for line in tasks:
  who=line['who'];profile=roles[who]
  if who not in bank:raise RuntimeError('Design voice first: '+who)
  instruction=CATALOG['direction']+'本句：'+MOODS.get(line['mood'],MOODS['talk'])
  # Dialogue text, voice and direction are all part of the cache identity.
  digest=hashlib.sha256((MODEL+bank[who]['voice']+line['text']+instruction).encode()).hexdigest()
  key=who+'-'+line['id'];dest=OUT/(key+'.wav')
  if samples.get(key,{}).get('digest')==digest and dest.exists():continue
  state=client.custom({'action':'query_voice','voice_id':bank[who]['voice']}).get('output',{})
  if state.get('status') and state['status']!='OK':raise RuntimeError('Voice still under review: '+profile['name']+' '+state['status'])
  r=client.call('SpeechSynthesizer',{'model':MODEL,'input':{'text':line['text'],'voice':bank[who]['voice'],'format':'wav','sample_rate':24000,'language_hints':['zh'],'instruction':instruction,'seed':2026,'enable_aigc_tag':True}})
  raw=client.download(r['output']['audio']['url']);dest.write_bytes(raw)
  if raw[:4]!=b'RIFF':raise RuntimeError('Unexpected audio format: '+key)
  samples[key]={'digest':digest,'file':dest.name,'who':who,'name':profile['name'],'text':line['text'],'mood':line['mood'],'delivery':line['delivery'],'instruction':instruction,'request_id':r.get('request_id'),'usage':r.get('usage',{})}
  save_json(samples_file,samples);print('Rendered',profile['name'],line['delivery'],flush=True)
 print('Audition ready:',len(samples),'clips; planned billable characters:',estimated)

if __name__=='__main__':
 try:main()
 except Exception as e:
  # No response bodies, authorization headers or signed download URLs in logs.
  if isinstance(e,RuntimeError):print(str(e),file=sys.stderr)
  else:print('Generation failed: '+type(e).__name__,file=sys.stderr)
  sys.exit(1)
