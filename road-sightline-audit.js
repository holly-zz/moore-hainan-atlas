/* V19.1 Evidence-gated road interface and 2D visibility analysis.
   OSM line proximity is not road-access permission; polygon occlusion is planar only. */
(()=>{
'use strict';
const $=id=>document.getElementById(id), lab=window.mooreParcelEntryLab;
if(!lab||!window.turf||!window.L)return;
const parent=$('parcelEntryLab');if(!parent)return;
const section=document.createElement('section');section.innerHTML=`
<h2>V19.1 / ROAD + SIGHTLINE AUDIT</h2>
<div class="note">以当前红线、入口 G、体量与 OSM 实际加载地物为依据。临路边必须人工指定；OSM 道路只检查位置匹配，不证明合法开口。</div>
<label>视线采样范围（m）</label><input id="auditRange" type="number" min="20" max="200" step="10" value="80" style="width:100%">
<div class="actions"><button id="auditRun" class="primary">重算道路与视线</button><button id="auditHide">隐藏分析线</button></div>
<label><input type="checkbox" id="auditAuto" checked> 拖动入口或体量后自动更新（松开时）</label>
<div id="auditResult" class="note">先创建或导入宗地，确认临路边，再点击重算。</div>
<button id="auditExport" class="wide">导出道路/视线证据 JSON</button>
`;parent.append(section);
let drawn=L.layerGroup().addTo(map),current=null,previousSignature='',pending=false;
const validLine=g=>g&&['LineString','MultiLineString'].includes(g.type);
function geom(f){return f?.geometry||null}
function sourceFeatures(k){return typeof layers!=='undefined'&&layers[k]?layers[k].toGeoJSON().features:null}
function toLngLat(p){const f=lab.export().geojson.features.find(x=>x.properties.feature_id===p);return f?.geometry?.coordinates}
const label=(v,unit='m')=>Number.isFinite(v)?v.toFixed(1)+unit:'N/A';
function boundary(){const f=lab.export().geojson.features.find(x=>x.properties.feature_id==='FRONTAGE_01');return f?.geometry?.coordinates}
function segmentLengths(coords){let total=0;for(let i=1;i<coords.length;i++)total+=turf.distance(turf.point(coords[i-1]),turf.point(coords[i]),{units:'kilometers'})*1000;return total}
function roadDist(road,front){try{return turf.pointToLineDistance(turf.midpoint(turf.point(front[0]),turf.point(front[1])),road,{units:'meters'})}catch(e){return Infinity}}
function roadMatch(front){
 const roads=sourceFeatures('roads');
 if(roads===null)return {status:'unavailable',distance_m:null,road_id:null,classification:null,reason:'OSM 道路图层未加载'};
 let min=Infinity,best=null;
 for(const road of roads){if(!validLine(geom(road)))continue;const d=roadDist(road,front);if(d<min){min=d;best=road}}
 if(!best)return {status:'unavailable',distance_m:null,reason:'无可用 OSM 道路线'};
 const p=best.properties||{};
 return {status:min<=25?'near_mapped_road_unverified':'not_close_to_mapped_road',distance_m:+min.toFixed(2),road_id:p.osm_id||p.id||null,classification:p.fclass||p.highway||null,permission:'N/A',source:'current loaded OSM/Geofabrik roads',note:'只检查临路边中点到道路中心线；道路宽度、通行权、开口许可与高差未验证'};
}
function blockedByMappedBuildings(a,b,buildings){
 const seg=turf.lineString([a,b]);let tested=0,failed=0;
 for(const f of buildings){if(!geom(f)||!geom(f).type.includes('Polygon'))continue;
  try{
   const close=turf.booleanIntersects(seg,f);tested++;
   if(close)return {blocked:true,tested,failed};
  }catch(e){failed++}
 }
 return {blocked:false,tested,failed};
}
function evaluate(){
 const state=lab.state,c=lab.compute();
 if(!state.ring||!c)throw Error('请先加载宗地');
 const frontage=boundary(),gate=toLngLat('GATE_01'),foyer=toLngLat('FOYER_01'),publicPt=toLngLat('PUBLIC_FACADE_01');
 if(!frontage||!gate||!foyer||!publicPt)throw Error('测试几何不完整');
 const road=roadMatch(frontage),buildings=sourceFeatures('buildings');
 let rays=[],counts={total:0,unblocked:0,blocked:0,errors:0},visibilityStatus='unavailable';
 // Sampling from two end points + gate along assumed frontage, projecting target across public frontage.
 const a=frontage[0],b=frontage[1],R=Math.min(200,Math.max(20,Number($('auditRange').value)||80));
 const samples=Array.from({length:11},(_,i)=>[a[0]+(b[0]-a[0])*i/10,a[1]+(b[1]-a[1])*i/10]);
 if(buildings!==null&&buildings.length){
   visibilityStatus='two_dimensional_osm_occlusion_proxy';
   for(const sample of samples){
    const d=turf.distance(turf.point(sample),turf.point(publicPt),{units:'kilometers'})*1000;
    if(d>R)continue;
    const hit=blockedByMappedBuildings(sample,publicPt,buildings);
    counts.total++;counts.errors+=hit.failed;if(hit.blocked)counts.blocked++;else counts.unblocked++;
    rays.push({from:sample,to:publicPt,occluded:hit.blocked});
   }
   if(counts.total===0)visibilityStatus='no_samples_in_range';
 }else visibilityStatus=buildings===null?'building_layer_missing':'no_mapped_obstacles';
 return {schema:'moore-v19-1-interface-sightline',timestamp:new Date().toISOString(),parcel_source:state.source,frontage:{coordinates:frontage,geodesic_length_m:+segmentLengths(frontage).toFixed(1),manual_frontage:true},gate,foyer,road,rays,counts,visibility:{status:visibilityStatus,unblocked_ratio_proxy:visibilityStatus==='two_dimensional_osm_occlusion_proxy'&&counts.total?counts.unblocked/counts.total:null,measured_privacy:null,limitation:'2D mapped building footprints only; no validated walls, vegetation, windows, height, ground elevation, line-of-sight rights, observation heights or legal access'},legal_buildability:'N/A'};
}
function display(r){
 drawn.clearLayers();const road=r.road;
 L.polyline(r.frontage.coordinates.map(p=>[p[1],p[0]]),{color:road.status==='near_mapped_road_unverified'?'#24a9a3':'#b96932',weight:5}).addTo(drawn);
 for(const x of r.rays)L.polyline([x.from,x.to].map(p=>[p[1],p[0]]),{color:x.occluded?'#c75f54':'#8a65a4',weight:1.8,opacity:.85,dashArray:x.occluded?'3 4':null,interactive:false}).addTo(drawn);
 $('auditResult').textContent='临路边（人工指定）：'+r.frontage.geodesic_length_m+'m\n'
 +'最近道路中心线：'+label(road.distance_m)+' · '+(road.classification||'未知')+' · '+road.status+'\n'
 +'二维障碍采样：'+r.counts.total+' 条，其中无遮挡代理 '+r.counts.unblocked+'，被已映射建筑遮挡 '+r.counts.blocked+'\n'
 +'路侧→公共立面可视比例代理：'+(r.visibility.unblocked_ratio_proxy===null?'N/A':(r.visibility.unblocked_ratio_proxy*100).toFixed(0)+'%')+'\n'
 +'隐私真实暴露度：N/A；道路开口许可：N/A；法定地块：'+(r.parcel_source.startsWith('synthetic')?'教学示意':'未核验')+'\n'
 +'注意：无遮挡不等于真实可见，OSM 未映射的围墙、植被与建筑会改变结果。';
}
function run(){try{current=evaluate();display(current)}catch(e){$('auditResult').textContent='无法计算：'+e.message}}
$('auditRun').onclick=run;
$('auditHide').onclick=()=>drawn.clearLayers();
$('auditExport').onclick=()=>{if(!current)return $('auditResult').textContent='请先计算';const blob=new Blob([JSON.stringify(current,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='moore-v19-1-road-sightline.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
map.on('mouseup',()=>{if(!$('auditAuto').checked||!lab.state.ring)return;setTimeout(()=>{const s=JSON.stringify([lab.state.gateT,lab.state.building,lab.state.front,lab.state.version,lab.state.w,lab.state.d]);if(previousSignature!==s){previousSignature=s;run()}},0)});
window.mooreRoadSightline={evaluate,run,get report(){return current}};
})();