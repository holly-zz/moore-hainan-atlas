"""Same-four-district building source comparison; no combining of overlapping footprints."""
import json,sys
from pathlib import Path
import geopandas as gpd
from shapely.ops import unary_union
from shapely.validation import make_valid

def main(root="data"):
 root=Path(root)
 districts=gpd.read_file(root/"haikou_districts.geojson").to_crs("EPSG:32649")
 ref=gpd.read_file(root/"overture_buildings_4districts.geojson").to_crs("EPSG:32649")
 osm=gpd.read_file(root/"buildings.geojson").to_crs("EPSG:32649")
 reports=[]
 for district in districts.itertuples():
  polygon=make_valid(district.geometry)
  record={"district":district.name,"adcode":str(district.adcode)}
  for name,frame in [("overture",ref),("osm",osm)]:
   selected=frame[frame.intersects(polygon)]
   areas=[]
   invalid=0
   for g in selected.geometry:
    try:
     if not g.is_valid:invalid+=1
     areas.append(make_valid(g).intersection(polygon).area)
    except Exception:invalid+=1
   record[name]={"intersecting_footprints":len(selected),"sum_clipped_area_km2":round(sum(areas)/1e6,5),"invalid_geometry_count":invalid,"warning":"Sum may double-count overlapping polygons"}
  record["count_ratio_overture_over_osm"]=round(record["overture"]["intersecting_footprints"]/record["osm"]["intersecting_footprints"],3) if record["osm"]["intersecting_footprints"] else None
  reports.append(record)
 meta={"status":"comparison_not_completeness_proof","study":"same four reference district polygons for both datasets","source_osm":"Geofabrik Hainan OSM GIS buildings","source_overture":"Overture Maps Buildings","districts":reports,"cautions":["Boundary geometry is non-authoritative reference; CRS adjustment not survey-verified","Overlap, omission and positional accuracy need independent imagery or surveyed checks","OSM vs Overture feature and area ratios cannot establish completeness"]}
 (root/"building_comparison_4districts.json").write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding="utf8")
 print(json.dumps(reports,ensure_ascii=False))
if __name__=="__main__":main(sys.argv[1] if len(sys.argv)>1 else "data")
