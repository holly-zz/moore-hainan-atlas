"""Retrieve Overture building footprints for full Haikou 4-district study.
Runs separately from OSM; does NOT silently overwrite OSM buildings.
Use official Overture Python client and log coverage/geometry.
"""
from pathlib import Path
import json,subprocess,sys
import geopandas as gpd
from shapely.ops import unary_union
from shapely.validation import make_valid

def main(root="data"):
 root=Path(root)
 district=gpd.read_file(root/"haikou_districts.geojson").to_crs(4326)
 codes={str(x) for x in district["adcode"].tolist()}
 expected={"460105","460106","460107","460108"}
 if not expected.issubset(codes):raise RuntimeError("District data incomplete, missing "+str(expected-codes))
 # Download bounding rectangle only, then exact district clipping. Larger than old study rectangle.
 b=district.total_bounds
 bounds=",".join(str(round(float(t),6)) for t in b)
 dest=root/"overture_haikou_bbox.geojson"
 subprocess.run([sys.executable,"-m","overturemaps","download","--type=building","--bbox="+bounds,"-f","geojson","-o",str(dest)],check=True,timeout=900)
 buildings=gpd.read_file(dest)
 if buildings.empty:raise RuntimeError("No Overture building footprints returned")
 if buildings.crs is None:buildings=buildings.set_crs(4326)
 buildings=buildings.to_crs("EPSG:32649")
 administrative=district.to_crs("EPSG:32649")
 union=unary_union([make_valid(g) for g in administrative.geometry])
 buildings=buildings[buildings.intersects(union)].copy()
 buildings.geometry=buildings.geometry.apply(lambda g:make_valid(g).intersection(union))
 buildings=buildings[buildings.geometry.geom_type.isin(["Polygon","MultiPolygon"])&~buildings.geometry.is_empty]
 buildings=buildings[buildings.area>=5]
 if buildings.empty:raise RuntimeError("No valid buildings remain after clipping")
 buildings=buildings.to_crs(4326)
 fields=[k for k in ("id","height","num_floors","confidence") if k in buildings.columns]
 buildings=buildings[fields+["geometry"]]
 buildings["atlas_source"]="Overture Maps Buildings"
 buildings.to_file(root/"overture_buildings_4districts.geojson",driver="GeoJSON")
 manifest={"status":"retrieved_not_verified","source":"Overture Maps Buildings","four_districts":sorted(expected),"polygon_count":len(buildings),"limitations":["Not a guaranteed complete cadastral building inventory","Reference district boundaries may be offset","Do not sum with OSM or assert height without validity checks"],"geometry":"EPSG:4326"}
 (root/"overture_buildings_manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf8")
 dest.unlink(missing_ok=True)
 print(json.dumps(manifest,ensure_ascii=False))
if __name__=="__main__":main(sys.argv[1] if len(sys.argv)>1 else "data")
