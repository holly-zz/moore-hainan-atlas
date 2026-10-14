"""Convert verified Geofabrik Hainan GPKG into browser-ready GeoJSON."""
import sys, json, zipfile, tempfile, shutil
from pathlib import Path
import geopandas as gpd
TYPES={"landuse":["landuse"],"roads":["roads"],"buildings":["buildings"],"water":["waterways","water"]}
def main(src):
    src=Path(src); out=Path("data");out.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as temp:
        with zipfile.ZipFile(src) as z:
            members=[m for m in z.infolist() if m.filename.lower().endswith(".gpkg") and not m.is_dir()]
            if not members:raise RuntimeError("Archive contains no GeoPackage")
            candidate=members[0]
            if Path(candidate.filename).is_absolute() or ".." in Path(candidate.filename).parts:raise RuntimeError("Unsafe archive")
            gpkg=Path(temp)/"hainan.gpkg"
            with z.open(candidate) as incoming,gpkg.open("wb") as output:shutil.copyfileobj(incoming,output)
        names=gpd.list_layers(gpkg)["name"].tolist()
        report={"source":"Geofabrik / OpenStreetMap Hainan","available_layers":names,"outputs":[]}
        for kind,aliases in TYPES.items():
            matches=[n for n in names if any(x in n.lower() for x in aliases)]
            if not matches:continue
            # Collect compatible layers, retaining all real geometry; do not fabricate polygons.
            frames=[]
            for n in matches:
                frame=gpd.read_file(gpkg,layer=n)
                if frame.empty:continue
                if frame.crs is None:raise RuntimeError("Missing CRS for "+n)
                frame=frame.to_crs("EPSG:4326")
                cols=[c for c in ("name","fclass","osm_id","type","code") if c in frame.columns]
                frame=frame[cols+["geometry"]]
                frame=frame[frame.geometry.notna() & ~frame.geometry.is_empty]
                frames.append(frame)
            if not frames:continue
            import pandas as pd
            combined=gpd.GeoDataFrame(pd.concat(frames,ignore_index=True),geometry="geometry",crs="EPSG:4326")
            filename=kind+".geojson";combined.to_file(out/filename,driver="GeoJSON")
            report["outputs"].append({"name":kind,"features":len(combined),"file":filename})
        (out/"data_manifest.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
        if not report["outputs"]:raise RuntimeError("No matching data layers; check: "+repr(names))
        print(json.dumps(report,ensure_ascii=False))
if __name__=="__main__":main(sys.argv[1])
