/* MOORE boundary lens v2: explicit analysis only; radius 0–10 km or user-chosen polygon. */
(()=>{
const $=id=>document.getElementById(id);
const legacy=$('serviceRadius');if(!legacy)return;
legacy.style.display='none';
const ui=document.createElement('section');
ui.innerHTML=`<h2>范围筛选 / SPATIAL MASK</h2>
<div class="sub">POI 点击仅选中点位。分析必须手动开启。范围外保留浅灰建筑、道路与土地利用底纹；范围内突出彩色专题，POI 严格按范围筛选。</div>
<label>筛选模式</label><select id="maskMode"><option value="radius">服务半径（直线）</option><option value="polygon">矢量选框 / 行政区界</option></select>
<div id="radiusControls"><label>分析半径（km，0–10 整数）</label><div style="display:flex;gap:7px;align-items:center"><input id="maskRadius" type="range" min="0" max="10" step="1" value="1" style="flex:1;min-width:0"><input id="maskNumber" type="number" min="0" max="10" step="1" value="1" style="width:68px"> km</div></div>
<div id="polygonControls" hidden><label>海口行政区参考边界</label><select id="districtChoose"><option value="">请选择区界</option><option value="460105">秀英区</option><option value="460106">龙华区</option><option value="460108">美兰区</option></select><button id="districtFetch" class="wide">使用所选区界（2021 年参考数据）</button><button id="maskUseFeature" class="wide">使用地图当前选中的面 / 区界</button><button id="maskDrawRect" class="wide">绘制矩形选框（点击两个角点）</button><button id="maskDrawPoly" class="wide">使用左侧绘制工具画多边形</button><div class="sub">真实区界需作为 GeoJSON 导入；系统不会将研究矩形伪称行政区。</div></div>
<div class="actions"><button id="maskApply" class="primary">开启范围筛选</button><button id="maskOff">退出范围筛选</button></div>
<div id="maskStatus" class="note">尚未开启。地图仍按每个图层的独立开关显示。</div>`;
legacy.after(ui);
const dataKeys=()=>Object.keys(layers).filter(k=>k!=='edits');
let mask=null,focus=null,selectedArea=null,center=null,enabled=false,corner=null,rectangleMode=false;
let previous={};
function status(msg){$('maskStatus').textContent=msg}
function getCenter(){if(typeof selected!=='undefined'&&selected?.layer){const l=selected.layer;if(l.getLatLng){const p=l.getLatLng();return [p.lng,p.lat]}try{return turf.pointOnFeature(l.toGeoJSON()).geometry.coordinates}catch(e){}}if(typeof origin!=='undefined'&&origin?.coord)return origin.coord;return null}
function geoSelected(){if(typeof selected==='undefined'||!selected?.layer)return null;try{const f=selected.layer.toGeoJSON();return /Polygon$/.test(f.geometry.type)?f:null}catch(e){return null}}
function addPanelFeature(f,k,target){let geom=f.geometry;if(!geom)return;let result=null;try{
if(geom.type==='Point'){if(turf.booleanPointInPolygon(f,mask))result=f}
else if(geom.type==='MultiPoint'){const a=geom.coordinates.filter(c=>turf.booleanPointInPolygon(turf.point(c),mask));if(a.length)result={...f,geometry:{type:'MultiPoint',coordinates:a}}}
else if(geom.type.includes('Polygon')){result=turf.intersect(turf.featureCollection([f,mask]))}
else if(geom.type.includes('LineString')){const pieces=turf.lineSplit(f,turf.polygonToLine(mask));const inside=pieces.features.filter(p=>turf.booleanPointInPolygon(turf.along(p,turf.length(p,{units:'kilometers'})/2,{units:'kilometers'}),mask));if(inside.length)result=turf.featureCollection(inside)}
}catch(e){console.warn('geometry clipping error',k,e)}
if(!result)return;const array=result.type==='FeatureCollection'?result.features:[result];
for(const feature of array){L.geoJSON(feature,{style:{color:colors[k]||'#666',fillColor:colors[k]||'#666',weight:k==='roads'?2:1,fillOpacity:.65},pointToLayer:(v,ll)=>L.circleMarker(ll,{radius:5,color:'#fff',weight:1,fillColor:colors[k]||'#777',fillOpacity:1}),onEachFeature:(v,l)=>l.on('click',()=>{if(typeof pick==='function')pick(l,k)})}).addTo(target)}
}
function contains(feature){if(!mask||!feature?.geometry)return true;try{const g=feature.geometry;if(g.type==='Point')return turf.booleanPointInPolygon(feature,mask);if(g.type==='MultiPoint')return g.coordinates.some(c=>turf.booleanPointInPolygon(turf.point(c),mask));return !turf.booleanDisjoint(feature,mask)}catch(e){return false}}
function redraw(){if(!enabled||!mask||!map)return;if(focus)map.removeLayer(focus);focus=L.featureGroup().addTo(map);let counts={},failed=0;
const palette=window.mooreStyle?.value?.palette||{};const cfg=window.mooreStyle?.value||{};
const mutedKeys=new Set(['roads','buildings','commercial','residential','industrial','green','agriculture','other_landuse','water']);
for(const k of dataKeys()){const group=layers[k];if(!group)continue;map.removeLayer(group);if(!mutedKeys.has(k))continue;
  if(mutedKeys.has(k)){
    // Context stays visible in full extent as non-interactive pale outlines; never mutate the original dataset.
    L.geoJSON(group.toGeoJSON(),{interactive:false,style:{color:palette.muted||'#b5bcb8',weight:k==='roads'?1.05:0.65,opacity:.52,fillColor:palette.muted||'#b5bcb8',fillOpacity:k==='roads'?0:(cfg.mutedOpacity??.18)}}).addTo(focus);
  }
}
for(const k of dataKeys()){const group=layers[k];if(!group||!previous[k]||k==='boundary'||k==='land'||k==='edits')continue;let n=0;
  group.eachLayer(l=>{try{const before=focus.getLayers().length;addPanelFeature(l.toGeoJSON(),k,focus);if(focus.getLayers().length>before)n++}catch(e){failed++}});if(n)counts[k]=n;
}
L.geoJSON(mask,{style:{color:palette.mask||'#145e54',weight:2.5,dashArray:'7 5',fillOpacity:0},interactive:false}).addTo(focus);
if(typeof refreshPOISearch==='function')refreshPOISearch();
status('分析范围内彩色专题：'+Object.entries(counts).map(([k,v])=>(names[k]||k)+' '+v).join(' / ')+(failed?'；几何运算异常 '+failed:'')+'。范围外保留浅灰建筑、道路、土地利用轮廓；POI 范围外隐藏。右侧原统计仍为整个研究区。');
}
function start(){if(!map||!window.turf)return status('地图或 Turf 尚未就绪');const mode=$('maskMode').value;if(mode==='polygon'){if(!selectedArea)return status('先绘制选框或选中导入的行政区面。');mask=selectedArea}else{const point=getCenter();if(!point)return status('请先选择一个 POI 或场地起点。');center=point;const r=Number($('maskRadius').value);if(r===0){mask=turf.circle(center,0.000001,{steps:32,units:'kilometers'});status('0 km 模式：只标记中心点，不显示任何范围内的面积要素。')}else mask=turf.circle(center,r,{steps:96,units:'kilometers'})}
if(!enabled)previous=Object.fromEntries(dataKeys().map(k=>[k,!!states[k]?.visible]));enabled=true;redraw()}
function stop(){enabled=false;mask=null;if(focus)map.removeLayer(focus);focus=null;for(const k of dataKeys()){if(!layers[k])continue;states[k].visible=!!previous[k];if(previous[k])layers[k].addTo(map);else map.removeLayer(layers[k])}if(typeof refresh==='function')refresh();if(typeof refreshPOISearch==='function')refreshPOISearch();status('范围分析已关闭；恢复原图层可见状态。')}
$('maskMode').onchange=()=>{$('radiusControls').hidden=$('maskMode').value!=='radius';$('polygonControls').hidden=$('maskMode').value!=='polygon';if(enabled)stop()};
function setRadius(v){const n=Math.max(0,Math.min(10,Math.round(Number(v)||0)));$('maskRadius').value=n;$('maskNumber').value=n;legacy.value=String(n);if(enabled)start()}
for(let n=0;n<=10;n++){if(!Array.from(legacy.options).some(o=>Number(o.value)===n)){const opt=document.createElement('option');opt.value=String(n);opt.textContent=n+' km';legacy.append(opt)}}
$('maskRadius').oninput=e=>setRadius(e.target.value);$('maskNumber').onchange=e=>setRadius(e.target.value);
$('maskApply').onclick=start;$('maskOff').onclick=stop;
$('maskUseFeature').onclick=()=>{const f=geoSelected();if(!f)return status('请先选中一个真实 Polygon/MultiPolygon 地块或导入的行政区面。');selectedArea=f;status('已选中矢量范围，点击“开启范围筛选”。')};
$('districtFetch').onclick=async()=>{const code=$('districtChoose').value;if(!code)return status('先选择秀英、龙华或美兰区。');try{const response=await fetch('./data/haikou_districts.geojson',{cache:'no-store'});if(!response.ok)throw Error('区界文件 HTTP '+response.status);const data=await response.json();const candidates=data.features.filter(f=>String(f.properties?.adcode)===code);if(!candidates.length)throw Error('区界数据不完整');selectedArea=candidates.length===1?candidates[0]:turf.union(turf.featureCollection(candidates));status('已选 '+candidates[0].properties?.name+' 参考边界。点击开启范围筛选，边界外仅保留浅灰轮廓。注：2021 年历史边界，坐标偏移尚需核验。');if(enabled)start()}catch(e){status('区界不可用：'+e.message)}};
$('maskDrawRect').onclick=()=>{rectangleMode=true;corner=null;status('请在地图上依次点击选框的两个对角点。')};
$('maskDrawPoly').onclick=()=>status('使用地图左侧多边形绘制工具；完成后点击该面，并按“使用地图当前选中的面 / 区界”。');
function bind(){if(typeof map==='undefined'||!map){setTimeout(bind,200);return}map.on('click',e=>{if(!rectangleMode)return;const p=[e.latlng.lng,e.latlng.lat];if(!corner){corner=p;status('第一个角点已选。请点击第二个角点。');return}const [a,b]=corner;selectedArea=turf.bboxPolygon([Math.min(a,p[0]),Math.min(b,p[1]),Math.max(a,p[0]),Math.max(b,p[1])]);corner=null;rectangleMode=false;status('矩形范围已设置。点击“开启范围筛选”。')})}bind();
const control=$('layers');if(control)control.addEventListener('change',()=>{if(!enabled)return;setTimeout(()=>{for(const k of dataKeys())previous[k]=!!states[k]?.visible;redraw()},20)});
for(const id of ['showNone','showPOI','quickLand','quickRoad','quickPOI','quickHide']){const b=$(id);if(b)b.addEventListener('click',()=>{if(enabled)setTimeout(()=>{for(const k of dataKeys())previous[k]=!!states[k]?.visible;redraw()},20)})}
window.spatialMask={get active(){return enabled},refresh:()=>{if(enabled){for(const k of dataKeys())if(k.startsWith('poi_'))previous[k]=!!states[k]?.visible;redraw()}},stop,contains};
})();