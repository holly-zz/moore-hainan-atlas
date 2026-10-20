"""Audit Overture vs OSM 500m spatial distribution and building geometry quality.
Uses same 4784 eligible cells as V15; representative-point assignment, not polygon coverage.
No automatic quality approval.
"""
import json,sys
from pathlib import Path
import numpy as np
import geopandas as gpd
import pandas as pd

def summary(a):
 v=np.asarray(a,dtype=float)
 return {"mapped_cells":int((v>0).sum()),"empty_cells":int((v==0).sum()),"mapped_fraction":round(float(np.mean(v>0)),5),"median_per_cell":float(np.median(v)),"p90_per_cell":float(np.percentile(v,90)),"max_per_cell":int(np.max(v))}
def main(root="data"):
 root=Path(root)
 grid=gpd.read_file(root/"v15_four_district_grid.geojson").to_crs("EPSG:32649")[["cell_id","geometry"]]
 data={}
 counts={}
 for key,name in (("overture","overture_buildings_4districts"),("osm","buildings")):
  g=gpd.read_file(root/(name+".geojson")).to_crs("EPSG:32649")
  invalid=int((~g.geometry.is_valid).sum())
  p=g.geometry.representative_point()
  frame=gpd.GeoDataFrame({"feature_id":np.arange(len(g))},geometry=p,crs="EPSG:32649")
  hits=gpd.sjoin(frame,grid,how="inner",predicate="within")
  c=hits.groupby("cell_id").size().reindex(grid.cell_id,fill_value=0).astype(int)
  counts[key]=c.to_numpy()
  data[key]={"total_footprints":len(g),"invalid_geometry_count":invalid,"unique_representative_points_in_eligible_cells":int(len(hits)),"spatial_distribution":summary(counts[key])}
 x,y=counts["overture"],counts["osm"]
 data["cross_source"]={"cell_count":len(grid),"overture_positive_osm_zero":int(np.sum((x>0)&(y==0))),"both_positive":int(np.sum((x>0)&(y>0))),"osm_positive_overture_zero":int(np.sum((x==0)&(y>0))),"both_zero":int(np.sum((x==0)&(y==0))),"fraction_osm_zero_where_overture_positive":round(float(np.sum((x>0)&(y==0))/np.sum(x>0)),5) if np.sum(x>0) else None}
 records=[]
 for cell,a,b in zip(grid.cell_id,x,y):
  records.append({"cell_id":cell,"overture_building_centroids":int(a),"osm_building_centroids":int(b),"overture_positive_osm_zero":bool(a>0 and b==0)})
 report={"status":"spatial_distribution_not_completeness_certification","assignment":"Building representative points located within eligible 500m cells. Boundary and partial cells excluded; not exact building area coverage.","data":data,"warnings":["OSM or Overture footprint density does not prove completeness vs ground truth","Count discrepancy is affected by source building decomposition, not only missingness","District boundaries are reference 2021 geometries not surveying standard","No automatic score activation"]}
 (root/"building_spatial_qa.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
 (root/"building_cell_comparison.json").write_text(json.dumps(records,ensure_ascii=False,separators=(',',':')),encoding="utf8")
 print(json.dumps(report,ensure_ascii=False))
if __name__=="__main__":main(sys.argv[1] if len(sys.argv)>1 else "data")
