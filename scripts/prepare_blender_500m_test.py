"""Prepare an actual, reproducible 500m MOORE Blender smoke-test bundle.
Center comes from the user's earlier school-site AOI, NOT independently verified campus.
Uses published OSM geometry, never fabricates buildings.
"""
import json,urllib.request,math
from pathlib import Path
import geopandas as gpd
from shapely.geometry import Point, mapping
from shapely.ops import transform
from pyproj import Transformer
ROOT="https://holly-zz.github.io/moore-hainan-atlas/data/"
OUT=Path("blender_test");OUT.mkdir(exist_ok=True)
lon,lat=110.302509,20.029762
to_meter=Transformer.from_crs("EPSG:4326","EPSG:32649",always_xy=True).transform
to_geo=Transformer.from_crs("EPSG:32649","EPSG:4326",always_xy=True).transform
study=transform(to_geo,Point(*to_meter(lon,lat)).buffer(500,resolution=48))
layers={}
counts={}
for k in ["buildings","roads","commercial","residential","industrial","green","agriculture","other_landuse","water"]:
 try:
  with urllib.request.urlopen(ROOT+k+".geojson",timeout=55) as response: data=json.load(response)
 except Exception as e:
  print("WARN unserved layer",k,str(e));data={"type":"FeatureCollection","features":[]}
 src=gpd.GeoDataFrame.from_features(data["features"],crs="EPSG:4326")
 if len(src):
  src=src[src.geometry.notna() & src.geometry.intersects(study)].copy()
  src.geometry=src.geometry.intersection(study)
  src=src[~src.geometry.is_empty]
 feats=json.loads(src.to_json())["features"] if len(src) else []
 # Assign expected feature properties untouched.
 layers[k]={"type":"FeatureCollection","features":feats}
 counts[k]=len(feats)
if not counts["buildings"]:raise RuntimeError("Test requires real building footprint(s); study GIS empty")
payload={"schema":"moore-blender-site-v1","crs":"EPSG:4326","selection":{"type":"Feature","geometry":mapping(study),"properties":{"radius_m":500,"center":[lon,lat]}},"layers":layers,"metadata":{"case":"Haikou School 500m candidate center; unverified gate","data":"published Haikou OSM layers","height_policy":"no inferred height","counts":counts}}
(OUT/"scene.json").write_text(json.dumps(payload,ensure_ascii=False),encoding="utf8")
(OUT/"fixture_manifest.json").write_text(json.dumps(payload["metadata"],ensure_ascii=False,indent=2),encoding="utf8")
print(counts)
