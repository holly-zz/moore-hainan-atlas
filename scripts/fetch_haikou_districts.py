"""Download district GeoJSON from DataV GeoAtlas; validate identity, geometry, CRS and provenance.
Historical (2021.5) illustration boundary, not authoritative current statutory limits.
"""
import json,urllib.request
from pathlib import Path
import geopandas as gpd
from shapely.validation import make_valid
DISTRICTS={"460105":"秀英区","460106":"龙华区","460108":"美兰区"}
def main():
 out=Path("data");out.mkdir(exist_ok=True)
 features=[];checks=[]
 for adcode,name in DISTRICTS.items():
  url=f"https://geo.datav.aliyun.com/areas_v3/bound/{adcode}.json"
  req=urllib.request.Request(url,headers={"User-Agent":"MOORE-Hainan-Atlas/1.0"})
  with urllib.request.urlopen(req,timeout=45) as r: data=json.load(r)
  if data.get("type")=="Feature": data={"type":"FeatureCollection","features":[data]}
  raw=data.get("features") or []
  if not raw:raise RuntimeError(f"No polygons: {name}")
  g=gpd.GeoDataFrame.from_features(raw,crs="EPSG:4326")
  if g.empty or not g.geometry.geom_type.isin(["Polygon","MultiPolygon"]).all():raise RuntimeError(f"Invalid boundary type: {name}")
  g.geometry=g.geometry.apply(make_valid)
  g=g[g.geometry.is_valid&~g.geometry.is_empty]
  if g.empty:raise RuntimeError(f"No valid geometries: {name}")
  # Historical provider geometry may be in GCJ-02, not survey-grade WGS84. Preserve this warning.
  for geom in g.geometry:
   b=geom.bounds
   if not (108<b[0]<112 and 18<b[1]<21 and 108<b[2]<112 and 18<b[3]<21):raise RuntimeError(f"District bbox outside Hainan: {name} {b}")
   features.append({"type":"Feature","properties":{"name":name,"adcode":adcode,"source":url,"source_vintage":"2021-05","precision":"reference boundary; CRS/GCJ02 overlay needs verification"},"geometry":geom.__geo_interface__})
  checks.append({"name":name,"adcode":adcode,"features":len(g),"source":url})
 if len(features)<3:raise RuntimeError("Missing districts")
 (out/"haikou_districts.geojson").write_text(json.dumps({"type":"FeatureCollection","features":features},ensure_ascii=False),encoding="utf8")
 (out/"district_manifest.json").write_text(json.dumps({"source":"DataV.GeoAtlas / AMap 2021.5","current_official":False,"districts":checks,"warning":"Not a verified current legal district boundary; positional overlay with OSM requires datum assessment"},ensure_ascii=False,indent=2),encoding="utf8")
 print(json.dumps(checks,ensure_ascii=False))
if __name__=="__main__":main()
