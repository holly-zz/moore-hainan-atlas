"""Precompute Euclidean medical service coverage against mapped residential polygons.
This is NOT pedestrian-network accessibility or population coverage.
"""
import json,sys
from pathlib import Path
import geopandas as gpd
from shapely.ops import unary_union
from shapely.geometry import GeometryCollection

RADII=(500,1000,3000)
def main(folder="data"):
 root=Path(folder)
 hp=root/"poi_health.geojson";rp=root/"residential.geojson"
 if not hp.exists() or not rp.exists():
  print("Missing health or residential data; omitting accessibility summary");return
 health=gpd.read_file(hp).to_crs("EPSG:32649")
 residential=gpd.read_file(rp).to_crs("EPSG:32649")
 health=health[health.geometry.notna() & ~health.geometry.is_empty].copy()
 residential=residential[residential.geometry.notna() & ~residential.geometry.is_empty].copy()
 residential.geometry=residential.geometry.make_valid()
 # Overlapping residential polygons should not be double-counted.
 residential_union=unary_union(list(residential.geometry))
 total=residential_union.area
 categories=health.get("fclass")
 actual_hospitals=health[health.fclass.fillna("").str.lower().eq("hospital")] if categories is not None else health.iloc[0:0]
 def coverage(geoms,r):
  if not geoms:return {"covered_km2":0,"coverage_ratio":0 if total else None}
  u=unary_union([g.buffer(r,resolution=20) for g in geoms])
  x=residential_union.intersection(u).area
  return {"covered_km2":round(x/1e6,5),"coverage_ratio":round(x/total,6) if total else None}
 aggregate={}
 for label,subset in [("hospitals_only",actual_hospitals),("all_mapped_medical",health)]:
  aggregate[label]={"facilities":len(subset),"radii":{str(r):coverage(list(subset.geometry),r) for r in RADII}}
 individual=[]
 for idx,row in health.iterrows():
  geom=row.geometry
  item={"osm_id":str(row.get("osm_id","")),"fclass":str(row.get("fclass","")),"name":str(row.get("name","") or ""),"radii":{str(r):coverage([geom],r) for r in RADII}}
  individual.append(item)
 result={"study":"Haikou research rectangle; NOT official administrative boundary","projected_crs":"EPSG:32649","measurement":"Euclidean buffer radius and unioned mapped residential polygon area, not pedestrian accessibility or population","residential_mapped_union_km2":round(total/1e6,5),"health_features":len(health),"actual_hospital_features":len(actual_hospitals),"aggregate":aggregate,"individual":individual,"source":"Geofabrik OpenStreetMap; incomplete coverage"}
 (root/"health_accessibility.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
 print(json.dumps({"health_features":len(health),"hospitals":len(actual_hospitals),"residential_union_km2":result["residential_mapped_union_km2"],"all_health_1000m":aggregate["all_mapped_medical"]["radii"]["1000"]},ensure_ascii=False))
if __name__=="__main__":main(sys.argv[1] if len(sys.argv)>1 else "data")
