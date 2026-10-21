"""Create Blender GIS scene data from ACTUAL Overture mapped building polygons.
The selected center is user-exported, not verified as Haikou Middle School entrance.
Source: Overture buildings via overturemaps CLI. Do not fill missing heights.
"""
import json,subprocess,math,sys
from pathlib import Path
import geopandas as gpd
from shapely.geometry import Point, mapping
from shapely.ops import transform
from pyproj import Transformer
C=(110.302509,20.029762)
RADIUS_M=500
def main():
 out=Path("test-output");out.mkdir(exist_ok=True)
 project=Transformer.from_crs("EPSG:4326","EPSG:32649",always_xy=True)
 unproject=Transformer.from_crs("EPSG:32649","EPSG:4326",always_xy=True)
 xy=project.transform(*C)
 buffer=Point(xy).buffer(RADIUS_M,resolution=48)
 boundary=transform(unproject.transform,buffer)
 bbox=boundary.bounds
 src=out/"raw-overture-building.geojson"
 subprocess.run(["overturemaps","download","--type=building","--bbox="+",".join(map(str,bbox)),"-f","geojson","-o",str(src)],check=True,timeout=480)
 g=gpd.read_file(src)
 if g.empty:raise RuntimeError("No actual Overture buildings were returned")
 if g.crs is None:g=g.set_crs("EPSG:4326")
 g=g.to_crs("EPSG:32649")
 g=g[g.intersects(buffer)].copy()
 g.geometry=g.geometry.intersection(buffer)
 g=g[g.geometry.geom_type.isin(["Polygon","MultiPolygon"])&~g.geometry.is_empty]
 g=g.to_crs("EPSG:4326")
 cols=[k for k in ("id","height","num_floors","confidence") if k in g.columns]
 fcs=[]
 for _,row in g.iterrows():
  props={k:(None if str(row[k])=="nan" else row[k]) for k in cols}
  props["atlas_source"]="Overture"
  fcs.append({"type":"Feature","properties":props,"geometry":mapping(row.geometry)})
 selection={"type":"Feature","geometry":mapping(boundary),"properties":{"radius_m":500}}
 bundle={"schema":"moore-blender-site-v1","crs":"EPSG:4326","selection":selection,"layers":{"buildings":{"type":"FeatureCollection","features":fcs}},"metadata":{"source":"Overture Maps Buildings","center":C,"center_quality":"user-selected coordinate; campus entrance not independently verified","height_policy":"only explicit source height; otherwise no extrusion","radius_m":500}}
 (out/"haikou-school-500m-real-overture.json").write_text(json.dumps(bundle,ensure_ascii=False,default=str),encoding="utf8")
 report={"source":"Overture Maps Buildings","selected_center":C,"radius_m":500,"feature_count":len(fcs),"has_explicit_height":sum(1 for f in fcs if isinstance(f["properties"].get("height"),(int,float))),"selection_is_verified_school_gate":False}
 (out/"site_source_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
 print(json.dumps(report))
 if not fcs:raise RuntimeError("Zero buildings inside 500m circle")
if __name__=="__main__":main()
