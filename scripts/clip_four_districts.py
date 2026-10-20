"""Prepare four-district OSM thematic layers using a shared clip boundary."""
import sys,json
from pathlib import Path
import geopandas as gpd
from shapely.ops import unary_union
from shapely.validation import make_valid
LAYERS=["commercial","residential","industrial","green","agriculture","other_landuse","roads","transport","poi","water","buildings"]
def main(root="data"):
 root=Path(root)
 districts=gpd.read_file(root/"haikou_districts.geojson").to_crs("EPSG:4326")
 area=unary_union([make_valid(g) for g in districts.geometry])
 out={}
 for name in LAYERS:
  p=root/(name+".geojson")
  if not p.exists():continue
  g=gpd.read_file(p).to_crs("EPSG:4326")
  g=g[g.intersects(area)].copy()
  if g.empty:continue
  g.geometry=g.geometry.apply(lambda geom:make_valid(geom).intersection(area))
  g=g[~g.geometry.is_empty]
  g.to_file(p,driver="GeoJSON")
  out[name]=len(g)
 (root/"four_district_clip_manifest.json").write_text(json.dumps({"clip":"four district union, historical reference boundaries","layers":out},ensure_ascii=False,indent=2),encoding="utf8")
 print(json.dumps(out))
if __name__=="__main__":main(sys.argv[1] if len(sys.argv)>1 else "data")
