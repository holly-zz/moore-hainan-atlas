"""MOORE local Blender bridge. Explicitly allowlisted origin, fixed Blender command.
Launch: python scripts/local_blender_bridge.py --blender "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe"
Visit http://127.0.0.1:8765/health; no cloud execution.
"""
import argparse,json,subprocess,threading,uuid,os,shutil
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse,unquote
BASE=Path(__file__).resolve().parent.parent
ROOT=(BASE/"blender_jobs").resolve()
MAX_BYTES=12_000_000
ALLOWED={"https://holly-zz.github.io","http://localhost:7100","http://127.0.0.1:7100"}
jobs={}
lock=threading.Lock()
def validate(bundle):
 if not isinstance(bundle,dict) or bundle.get("schema")!="moore-blender-site-v1":raise ValueError("Invalid MOORE bundle schema")
 if bundle.get("crs")!="EPSG:4326":raise ValueError("Only EPSG:4326 supported")
 features=0
 for key,collection in bundle.get("layers",{}).items():
  if key not in ("buildings","roads","commercial","residential","industrial","green","agriculture","other_landuse","water"):raise ValueError("Unknown GIS layer")
  for feature in collection.get("features",[]):
   features+=1
   if features>22000:raise ValueError("Too many GIS features")
   if (feature.get("geometry") or {}).get("type") not in ("Polygon","MultiPolygon","LineString","MultiLineString"):raise ValueError("Unsupported geometry")
 if not (bundle.get("selection") or {}).get("geometry"):raise ValueError("Missing AOI selection")
 return features
def build(job_id,exe):
 work=ROOT/job_id
 try:
  with lock:jobs[job_id]["status"]="running"
  result=subprocess.run([exe,"--background","--factory-startup","--python",str(BASE/"scripts/import_site_blender.py"),"--",str(work/"scene.json"),str(work/"site.blend")],capture_output=True,text=True,timeout=480,check=False)
  (work/"blender.log").write_text((result.stdout+"\n"+result.stderr)[-18000:],encoding="utf8")
  if result.returncode or not (work/"site.blend").is_file() or not (work/"site.glb").is_file():raise RuntimeError("Blender failed, see job log")
  with lock:jobs[job_id].update(status="completed",file="site.blend",glb_ready=(work/"site.glb").is_file())
 except Exception as e:
  with lock:jobs[job_id].update(status="failed",error=str(e))
class Handler(BaseHTTPRequestHandler):
 def send(self,status,obj):
  content=json.dumps(obj,ensure_ascii=False).encode()
  self.send_response(status);self.send_header("Content-Type","application/json; charset=utf-8");self.cors();self.send_header("Content-Length",str(len(content)));self.end_headers();self.wfile.write(content)
 def cors(self):
  origin=self.headers.get("Origin","")
  if origin in ALLOWED:self.send_header("Access-Control-Allow-Origin",origin);self.send_header("Vary","Origin")
  self.send_header("Cache-Control","no-store")
 def allowed(self):return self.headers.get("Origin","") in ALLOWED or not self.headers.get("Origin")
 def do_OPTIONS(self):
  if not self.allowed():return self.send(403,{"error":"Origin not allowed"})
  self.send_response(204);self.cors();self.send_header("Access-Control-Allow-Methods","GET, POST, OPTIONS");self.send_header("Access-Control-Allow-Headers","Content-Type");self.end_headers()
 def do_GET(self):
  if not self.allowed():return self.send(403,{"error":"Origin not allowed"})
  path=urlparse(self.path).path
  if path=="/health":return self.send(200,{"status":"ready","blender":ARGS.blender})
  parts=path.strip("/").split("/")
  if len(parts)>=2 and parts[0]=="jobs":
   with lock:job=dict(jobs.get(parts[1]) or {})
   if not job:return self.send(404,{"error":"Job not found"})
   if len(parts)==2:return self.send(200,job)
   if len(parts)==3 and parts[2] in ("site.blend","site.glb","scene.json","blender.log") and job.get("status")=="completed":
    file=ROOT/parts[1]/parts[2]
    if not file.is_file():return self.send(404,{"error":"File unavailable"})
    data=file.read_bytes();self.send_response(200);self.cors();self.send_header("Content-Type","model/gltf-binary" if parts[2]=="site.glb" else "application/octet-stream");self.send_header("Content-Disposition",'attachment; filename="'+parts[2]+'"');self.send_header("Content-Length",str(len(data)));self.end_headers();self.wfile.write(data);return
  return self.send(404,{"error":"Not found"})
 def do_POST(self):
  if not self.allowed():return self.send(403,{"error":"Origin not allowed"})
  if urlparse(self.path).path!="/jobs":return self.send(404,{"error":"Not found"})
  try:
   size=int(self.headers.get("Content-Length","0"))
   if size<=0 or size>MAX_BYTES:return self.send(413,{"error":"Data exceeds 12 MB limit"})
   bundle=json.loads(self.rfile.read(size))
   count=validate(bundle)
   uid=uuid.uuid4().hex;work=ROOT/uid;work.mkdir(parents=True,exist_ok=False)
   (work/"scene.json").write_text(json.dumps(bundle),encoding="utf8")
   with lock:jobs[uid]={"id":uid,"status":"queued","features":count}
   threading.Thread(target=build,args=(uid,ARGS.blender),daemon=True).start()
   return self.send(202,{"id":uid,"status":"queued"})
  except Exception as e:return self.send(400,{"error":str(e)})
if __name__=="__main__":
 p=argparse.ArgumentParser();p.add_argument("--blender",required=True);p.add_argument("--port",type=int,default=8765);ARGS=p.parse_args()
 if not Path(ARGS.blender).is_file() and not shutil.which(ARGS.blender):raise SystemExit("Blender executable not found: "+ARGS.blender)
 ROOT.mkdir(exist_ok=True)
 print("MOORE bridge http://127.0.0.1:"+str(ARGS.port)+"/health",flush=True)
 ThreadingHTTPServer(("127.0.0.1",ARGS.port),Handler).serve_forever()
