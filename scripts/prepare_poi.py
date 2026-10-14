"""Make categorized POI point layers from OSM point and polygon objects.
Input: cropped data/poi.geojson and data/transport.geojson.
Polygon POIs become representative interior points; original geometry is not overwritten.
"""
import sys,json
from pathlib import Path
import geopandas as gpd
import pandas as pd

GROUPS={
 "poi_health":{"hospital","clinic","doctors","dentist","pharmacy","veterinary"},
 "poi_schools":{"school","university","college","kindergarten","library"},
 "poi_retail":{"mall","supermarket","department_store","shopping_centre","shopping_center","marketplace","convenience","clothes","bakery","retail"},
 "poi_transit":{"bus_stop","bus_station","railway_station","train_station","station","tram_stop","subway_entrance","ferry_terminal","taxi","airport","aerodrome","parking"},
 "poi_food":{"restaurant","cafe","fast_food","food_court","bar","pub"},
 "poi_civic":{"police","fire_station","town_hall","post_office","courthouse","community_centre","place_of_worship","bank","atm"},
 "poi_leisure":{"cinema","theatre","museum","art_gallery","sports_centre","stadium","park","zoo","hotel","hostel","attraction"},
}
def run(folder="data"):
 root=Path(folder); sources=[]; counts={}
 for name in ("poi","transport"):
  p=root/(name+".geojson")
  if p.exists():
   g=gpd.read_file(p)
   if not g.empty:
    if g.crs is None:raise ValueError("Missing CRS in "+str(p))
    g=g.to_crs("EPSG:4326")
    g["source_family"]=name
    sources.append(g)
 if not sources:
  print("No source POI data");return
 raw=gpd.GeoDataFrame(pd.concat(sources,ignore_index=True),geometry="geometry",crs="EPSG:4326")
 raw=raw[raw.geometry.notna() & ~raw.geometry.is_empty].copy()
 raw["fclass"]=raw.get("fclass",pd.Series("",index=raw.index)).fillna("").astype(str).str.lower().str.strip()
 # Deduplicate exact OSM objects, but keep distinct source families if IDs differ.
 if "osm_id" in raw:
  key=raw["osm_id"].astype(str)
  known=(key.notna() & ~key.isin(["","nan","None"]))
  raw= pd.concat([raw.loc[known].drop_duplicates(subset=["osm_id","fclass"]),raw.loc[~known]],ignore_index=True)
  raw=gpd.GeoDataFrame(raw,geometry="geometry",crs="EPSG:4326")
 projected=raw.to_crs("EPSG:32649")
 projected.geometry=projected.geometry.representative_point()
 points=projected.to_crs("EPSG:4326")
 claimed=pd.Series(False,index=points.index)
 for category,classes in GROUPS.items():
  mask=points["fclass"].isin(classes)&~claimed
  claimed|=mask
  out=points.loc[mask].copy()
  if out.empty:continue
  out["poi_category"]=category
  out["position_method"]="point_or_polygon_representative_point"
  out.to_file(root/(category+".geojson"),driver="GeoJSON")
  counts[category]=int(len(out))
 other=points.loc[~claimed].copy()
 if not other.empty:
  other["poi_category"]="poi_other"
  other["position_method"]="point_or_polygon_representative_point"
  other.to_file(root/"poi_other.geojson",driver="GeoJSON")
  counts["poi_other"]=int(len(other))
 manifest={"source":"Geofabrik / OpenStreetMap POI + transport","counts":counts,
 "unclassified_fclass":other["fclass"].value_counts().to_dict() if not other.empty else {},
 "notes":"Only OSM mapped POIs; names may be missing; polygon sites mapped to representative internal point; points are not verified entrances; not comprehensive"}
 (root/"poi_manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
 print(json.dumps(counts,ensure_ascii=False))
if __name__=="__main__":run(sys.argv[1] if len(sys.argv)>1 else "data")
