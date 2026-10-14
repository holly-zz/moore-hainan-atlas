"""MOORE Hainan Atlas: deterministic thematic extraction of Geofabrik free GPKG."""
import json, sys, zipfile, tempfile, shutil
from pathlib import Path
import geopandas as gpd
import pandas as pd

GROUPS = {
 "commercial":{"retail","commercial"},
 "residential":{"residential"},
 "industrial":{"industrial"},
 "green":{"forest","wood","grass","meadow","park","nature_reserve","scrub","heath","recreation_ground","village_green"},
 "agriculture":{"farmland","farm","farmyard","orchard","vineyard","allotments","plant_nursery"},
}
CATEGORIES = {
 "landuse": ("landuse",),
 "roads": ("roads",),
 "transport": ("transport", "traffic"),
 "poi": ("pois",),
 "water": ("waterways","water"),
 "buildings": ("buildings",),
}
def norm(f):
    return f.fillna("").astype(str).str.strip().str.lower()
def main(source):
    out=Path("data"); out.mkdir(parents=True,exist_ok=True)
    for p in out.glob("*.geojson"):p.unlink()
    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(source) as z:
            members=[m for m in z.infolist() if m.filename.lower().endswith(".gpkg") and not m.is_dir()]
            if len(members)!=1:raise RuntimeError("Expected exactly one GPKG file")
            member=members[0]
            if member.file_size>2_000_000_000:raise RuntimeError("Unexpected GPKG size")
            if Path(member.filename).is_absolute() or ".." in Path(member.filename).parts:raise RuntimeError("Unsafe ZIP member")
            gpkg=Path(tmp)/"hainan.gpkg"
            with z.open(member) as reader,gpkg.open("wb") as writer:shutil.copyfileobj(reader,writer)
        actual=gpd.list_layers(gpkg)["name"].tolist()
        report={"source":"Geofabrik Hainan / © OpenStreetMap contributors ODbL","layers_in_source":actual,"generated":[],"unmatched_landuse_classes":{}}
        used=set()
        def emit(name,frame,parents):
            frame=frame[frame.geometry.notna() & ~frame.geometry.is_empty].copy()
            if frame.empty:return
            if frame.crs is None:raise RuntimeError("Missing CRS: "+name)
            frame=frame.to_crs("EPSG:4326")
            preserve=[k for k in ["osm_id","name","fclass","code","type"] if k in frame.columns]
            frame=frame[preserve+["geometry"]]
            frame["atlas_layer"]=name
            frame.to_file(out/(name+".geojson"),driver="GeoJSON")
            counts=frame["fclass"].fillna("unknown").astype(str).value_counts().to_dict() if "fclass" in frame else {}
            report["generated"].append({"id":name,"features":len(frame),"sources":parents,"fclass_counts":counts})
        # Match known Geofabrik gis_osm_* layer families, avoiding accidental substring overlaps.
        collections={}
        for cat,fragments in CATEGORIES.items():
            matches=[n for n in actual if any(n.lower().startswith("gis_osm_"+fragment+"_") for fragment in fragments)]
            if not matches:
                report.setdefault("missing_source_families",[]).append(cat)
                continue
            frames=[]
            for n in matches:
                g=gpd.read_file(gpkg,layer=n)
                if g.empty:continue
                if g.crs is None:raise RuntimeError("Missing CRS: "+n)
                cols=[x for x in ("osm_id","name","fclass","code","type") if x in g.columns]
                frames.append(g[cols+["geometry"]].to_crs("EPSG:4326"))
            if frames:
                collections[cat]=(gpd.GeoDataFrame(pd.concat(frames,ignore_index=True),geometry="geometry",crs="EPSG:4326"),matches)
        if "landuse" in collections:
            frame,parents=collections["landuse"]
            if "fclass" not in frame:raise RuntimeError("landuse lacks fclass; cannot classify honestly")
            classes=norm(frame["fclass"])
            classified=pd.Series(False,index=frame.index)
            for name,values in GROUPS.items():
                mask=classes.isin(values);emit(name,frame.loc[mask],parents);classified=classified|mask
            other=frame.loc[~classified]
            report["unmatched_landuse_classes"]=other["fclass"].fillna("unknown").astype(str).value_counts().to_dict()
            emit("other_landuse",other,parents)
        for cat in ("roads","transport","poi","water","buildings"):
            if cat in collections:emit(cat,*collections[cat])
        if not report["generated"]:raise RuntimeError("No real geometries extracted; inspect source layer names")
        (out/"data_manifest.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
        print(json.dumps({"layers":[(x["id"],x["features"]) for x in report["generated"]],"missing":report.get("missing_source_families",[])},ensure_ascii=False))
if __name__=="__main__":main(sys.argv[1])
