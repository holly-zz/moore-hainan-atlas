"""Retrieve a referenced ADM1 province outline from geoBoundaries (not a surveyed coastline)."""
import json,urllib.request
from pathlib import Path
API="https://www.geoboundaries.org/api/current/gbOpen/CHN/ADM1/"
def get(url):
  req=urllib.request.Request(url,headers={"User-Agent":"MOORE-Hainan-Atlas/1.0"})
  with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)
def main():
  meta=get(API)
  url=meta.get("simplifiedGeometryGeoJSON") or meta.get("gjDownloadURL")
  if not url:raise ValueError("Missing geoBoundaries download URL")
  features=get(url).get("features",[])
  selected=[f for f in features if "hainan" in str(f.get("properties",{}).get("shapeName","")).lower() or "海南" in str(f.get("properties",{}).get("shapeName",""))]
  if len(selected)!=1:raise ValueError("Expected 1 Hainan province feature, found "+str(len(selected))+"; no fabricated boundary")
  out=Path("data");out.mkdir(exist_ok=True)
  for f in selected:f.setdefault("properties",{}).update({"source":"geoBoundaries gbOpen ADM1","boundary_type":"province_administrative_outline","not_official_coastline":True})
  (out/"boundary.geojson").write_text(json.dumps({"type":"FeatureCollection","features":selected},ensure_ascii=False),encoding="utf-8")
  (out/"boundary_source.json").write_text(json.dumps({"source_api":API,"download_url":url,"license":"Check geoBoundaries gbOpen CC BY 4.0 attribution","not_coastline":True},indent=2),encoding="utf-8")
  print("geoBoundaries province outline loaded")
if __name__=="__main__":main()
