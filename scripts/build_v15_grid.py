"""V15 pilot: fixed 500 m comparable projected cells across the *existing* Haikou study rectangle.
Do not describe this extent as complete Meilan, Longhua or Xiuying districts.
Per-cell measurements and percentile reference population are reproducible from pinned source files.
"""
import json, math, sys, statistics
from pathlib import Path
from datetime import datetime, timezone
from shapely.geometry import box, mapping, Point
from shapely.ops import transform
from shapely.validation import make_valid
from pyproj import Transformer
import geopandas as gpd
from shapely.strtree import STRtree

CELL=500
STUDY_BBOX=[110.15,19.85,110.55,20.12]
METRICS=['building_pct','road_km_km2','transit_km2','retail_km2','green_pct']
DIRECTION={k:'higher_is_better_for_pilot_only' for k in METRICS}
WEIGHTS={'building_pct':15,'road_km_km2':20,'transit_km2':25,'retail_km2':20,'green_pct':20}
CRS='EPSG:32649'
def read(root,name):
 p=root/(name+'.geojson')
 if not p.exists():return None
 g=gpd.read_file(p)
 if g.crs is None:raise ValueError('Missing CRS: '+str(p))
 g=g.to_crs(CRS)
 return g[g.geometry.notna()&~g.geometry.is_empty]
def rank(values,x):
 # Midrank percentile, pinned across the same eligible study cells.
 a=sorted(values)
 import bisect
 return 100*(bisect.bisect_left(a,x)+bisect.bisect_right(a,x))/(2*len(a)) if a else None
def main(root='data'):
 root=Path(root)
 layers={k:read(root,k) for k in ('buildings','roads','poi_transit','poi_retail','green')}
 missing=[k for k,g in layers.items() if g is None]
 out=root/'v15_grid.geojson';meta=root/'v15_grid_manifest.json'
 if missing:
  meta.write_text(json.dumps({'status':'unavailable','missing_layers':missing,'scores':'N/A'},ensure_ascii=False,indent=2))
  raise RuntimeError('Required grid metric layers missing: '+', '.join(missing))
 west_to_m=Transformer.from_crs('EPSG:4326',CRS,always_xy=True).transform
 to_wgs=Transformer.from_crs(CRS,'EPSG:4326',always_xy=True).transform
 study=transform(west_to_m,box(*STUDY_BBOX))
 indexes={}
 for k,g in layers.items():
  geom=list(g.geometry)
  indexes[k]=(geom,STRtree(geom) if geom else None)
 def clipped(key,cell):
  geom,tree=indexes[key]
  if tree is None:return []
  return [geom[int(i)] for i in tree.query(cell,predicate='intersects')]
 gx0=math.floor(study.bounds[0]/CELL)*CELL;gy0=math.floor(study.bounds[1]/CELL)*CELL
 gx1=math.ceil(study.bounds[2]/CELL)*CELL;gy1=math.ceil(study.bounds[3]/CELL)*CELL
 rows=[];geom_errors=0
 for x in range(gx0,gx1,CELL):
  for y in range(gy0,gy1,CELL):
   cell=box(x,y,x+CELL,y+CELL)
   included=cell.intersection(study)
   ratio=included.area/(CELL*CELL)
   if ratio<.999:continue  # Reject partial-edge cells: comparable 0.25 km² denominator.
   try:
    vals={}
    for key,col in [('buildings','building_pct'),('green','green_pct')]:
     a=0
     for poly in clipped(key,cell):
      try:a+=make_valid(poly).intersection(cell).area
      except Exception:geom_errors+=1
     vals[col]=round(100*a/(CELL*CELL),4)
    length=0
    for road in clipped('roads',cell):
     try:length+=road.intersection(cell).length
     except Exception:geom_errors+=1
    vals['road_km_km2']=round(length/1000/.25,4)
    for key,col in [('poi_transit','transit_km2'),('poi_retail','retail_km2')]:
     vals[col]=round(sum(1 for pt in clipped(key,cell) if pt.geom_type=='Point' and cell.covers(pt))/.25,4)
    # OSM zero signifies *zero mapped features*, not evidence of true absence.
    rows.append({'x':x,'y':y,'values':vals,'geometry':transform(to_wgs,cell)})
   except Exception as e:
    geom_errors+=1
    continue
 if not rows:raise RuntimeError('No eligible 500 m cells')
 ref={k:[r['values'][k] for r in rows] for k in METRICS}
 # No minimum mapped completeness can be certified from OSM; rank is explicitly provisional.
 for r in rows:
  r['percentiles']={k:round(rank(ref[k],r['values'][k]),2) for k in METRICS}
  r['score']=None  # FAIL CLOSED: OSM building footprint coverage not validated
  r['rank_status']='N/A_building_coverage_not_validated'
 properties=[]
 for idx,r in enumerate(rows):
  p={'cell_id':f'HK500_{r["x"]}_{r["y"]}','grid_m':CELL,'score':r['score'],'rank_status':r['rank_status']}
  p.update(r['values'])
  p.update({'pctile_'+k:v for k,v in r['percentiles'].items()})
  properties.append({'type':'Feature','properties':p,'geometry':mapping(r['geometry'])})
 out.write_text(json.dumps({'type':'FeatureCollection','features':properties},ensure_ascii=False,separators=(',',':')),encoding='utf8')
 manifest={'status':'N/A_pending_four_district_validation','method':'Fixed 500m grid in EPSG:32649, full cells inside existing research rectangle; source metrics from OSM mapped geometry; empirical midrank percentile across same cell population','study_bbox_wgs84':STUDY_BBOX,'is_full_administrative_coverage':False,'building_coverage_validated':False,'overall_score_validated':False,'grid_m':CELL,'cell_count':len(rows),'weights':WEIGHTS,'metrics':METRICS,'metric_direction':DIRECTION,'minmax_score_reference':'all eligible 500m cells in this version, not independent city population','reference_distribution':{k:{'min':min(v),'max':max(v),'median':statistics.median(v),'p10':sorted(v)[int(.1*(len(v)-1))],'p90':sorted(v)[int(.9*(len(v)-1))]} for k,v in ref.items()},'geometry_errors':geom_errors,'critical_warnings':['All combined scores intentionally N/A until all four districts and Overture/OSM quality gates pass','Source buildings and POIs are incompletely mapped: score is a demonstration of within-dataset ranking, NOT proven planning suitability','Building percentage measures footprint mapping, NOT FAR or actual development intensity','Transit and shopping density are mapped POI density, NOT actual demand or footfall','Partial-edge cells excluded; the old rectangle does not cover entire three districts','All indicators default positive only for algorithm smoke testing; program-specific objectives and hard exclusions are required before decision-making']}
 meta.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
 print(json.dumps({'cells':len(rows),'score_min':None,'score_max':None,'errors':geom_errors}))
if __name__=='__main__':main(sys.argv[1] if len(sys.argv)>1 else 'data')
