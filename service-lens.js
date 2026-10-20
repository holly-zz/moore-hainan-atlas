/* Service-area lens: all thematic features outside the radius are hidden. */
(()=>{
const $=id=>document.getElementById(id);
const anchor=$('serviceRadius');
if(!anchor)return;
const wrap=document.createElement('div');
wrap.innerHTML='<label style="display:block;margin:9px 0">服务范围（整数公里 0–100 km）</label><div style="display:flex;gap:8px;align-items:center"><input id="serviceRange" type="range" min="0" max="100" step="1" value="1" style="min-width:0;flex:1"><input id="serviceNumber" type="number" min="0" max="100" step="1" value="1" aria-label="服务半径公里" style="width:75px"><span>km</span></div><label style="display:flex;align-items:center;gap:6px;margin-top:10px"><input type="checkbox" id="lensEnabled" style="width:auto"> 开启半径分析（范围外全部隐藏）</label><div id="lensSummary" class="note">关闭时各图层保持自己的开关状态。开启时只显示范围内的用地、道路和已勾选 POI。</div>';
anchor.style.display='none';anchor.after(wrap);for(let n=0;n<=100;n++){if(!Array.from(anchor.options).some(o=>Number(o.value)===n)){const option=document.createElement('option');option.value=String(n);option.textContent=n+' km';anchor.append(option)}}
const radiusInput=$('serviceRange'),numberInput=$('serviceNumber'),active=$('lensEnabled');
let visibleBefore=null,overlay=null,sourcePosition=null,busy=false,token=0;
const setSummary=s=>$('lensSummary').textContent=s;
function radius(){return Number(radiusInput.value)}
function updateRadius(v){const n=Math.max(0,Math.min(100,Math.round(Number(v)||0)));radiusInput.value=n;numberInput.value=n;anchor.value=String(n);if(active.checked)renderLens()}
radiusInput.addEventListener('input',e=>updateRadius(e.target.value));
numberInput.addEventListener('input',e=>updateRadius(e.target.value));
function pointOfSelected(){if(typeof selected==='undefined'||!selected?.layer)return null;const l=selected.layer;if(l.getLatLng){const v=l.getLatLng();return [v.lng,v.lat]}try{return turf.pointOnFeature(l.toGeoJSON()).geometry.coordinates}catch(e){return null}}
function chosenCentre(){const p=pointOfSelected();if(p)return p;if(typeof origin!=='undefined'&&origin?.coord)return origin.coord;return sourcePosition}
function clearOverlay(){if(overlay&&typeof map!=='undefined'&&map)map.removeLayer(overlay);overlay=null}
function restore(){clearOverlay();if(visibleBefore){for(const [k,v] of Object.entries(visibleBefore)){if(!layers[k])continue;states[k].visible=v;v?layers[k].addTo(map):map.removeLayer(layers[k])}visibleBefore=null}if(typeof refresh==='function')refresh();setSummary('分析已关闭，各专题图层恢复原始显隐。')}
function enable(){if(!map||!window.turf)return setSummary('地图或 Turf 尚未准备好');const centre=chosenCentre();if(!centre){active.checked=false;return setSummary('请先点击医院、学校、地块或在场地筛选工具中设置起点。')}sourcePosition=centre;visibleBefore=Object.fromEntries(Object.keys(layers).map(k=>[k,!!states[k]?.visible]));renderLens()}
function renderLens(){if(!active.checked||!map||!window.turf)return;if(typeof serviceGraphics!=='undefined'&&serviceGraphics)map.removeLayer(serviceGraphics);const centre=sourcePosition||chosenCentre();if(!centre)return setSummary('请选择分析中心');sourcePosition=centre;clearOverlay();overlay=L.featureGroup().addTo(map);const r=radius();const circle=r>0?turf.circle(centre,r,{steps:96,units:'kilometers'}):null;let totals=0,counts={};for(const [key,group] of Object.entries(layers)){if(!visibleBefore?.[key]){map.removeLayer(group);continue}map.removeLayer(group);if(key==='boundary'||key==='land'||key==='edits')continue;let n=0;const feats=[];group.eachLayer(item=>{const feature=item.toGeoJSON();const g=feature.geometry;if(!g)return;try{let clipped=null;if(g.type==='Point'){if(circle&&turf.booleanPointInPolygon(feature,circle))clipped=feature}else if(g.type==='MultiPoint'){if(circle){const coordinates=g.coordinates.filter(c=>turf.booleanPointInPolygon(turf.point(c),circle));if(coordinates.length)clipped={...feature,geometry:{type:'MultiPoint',coordinates}}}}else if(g.type.includes('Polygon')){if(circle)clipped=turf.intersect(turf.featureCollection([feature,circle]))}else if(g.type.includes('LineString')){if(circle){const pieces=turf.lineSplit(feature,turf.polygonToLine(circle));const inside=pieces.features.filter(f=>{const midpoint=turf.along(f,turf.length(f,{units:'kilometers'})/2,{units:'kilometers'});return turf.booleanPointInPolygon(midpoint,circle)});if(inside.length)clipped=turf.featureCollection(inside)}}if(clipped){n++;if(clipped.type==='FeatureCollection')feats.push(...clipped.features);else feats.push(clipped)}}catch(e){console.warn('Lens geometry',key,e)}});if(feats.length){const groupView=L.geoJSON({type:'FeatureCollection',features:feats},{style:{color:colors[key]||'#657c78',fillColor:colors[key]||'#657c78',weight:key==='roads'?2:0.7,fillOpacity:.65},pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:5,color:'#fff',weight:1,fillColor:colors[key]||'#888',fillOpacity:1}),onEachFeature:(f,l)=>l.on('click',()=>{if(typeof pick==='function')pick(l,key)})});groupView.addTo(overlay)}totals+=n;counts[key]=n}
if(circle)L.geoJSON(circle,{style:{color:'#12584c',weight:2,dashArray:'6 4',fill:false},interactive:false}).addTo(overlay);
else L.circleMarker([centre[1],centre[0]],{radius:7,color:'#12584c'}).addTo(overlay);
setSummary('只显示中心 '+r+' km 内、且此前已勾选的图层：'+totals+' 个相交要素。图层明细：'+Object.entries(counts).filter(x=>x[1]>0).map(x=>((names[x[0]]||x[0])+':'+x[1])).join(' · ')+'。0 km 只标中心点。范围外原始地物未删除。');
}
active.addEventListener('change',()=>active.checked?enable():restore());
const layerPanel=$('layers');if(layerPanel)layerPanel.addEventListener('change',()=>{if(active.checked)setTimeout(()=>{for(const k of Object.keys(layers))visibleBefore[k]=!!states[k]?.visible;renderLens()},0)});
for(const id of ['quickLand','quickRoad','quickPOI','showPOI','showNone']){const btn=$(id);if(btn)btn.addEventListener('click',()=>{if(active.checked)setTimeout(()=>{for(const k of Object.keys(layers))visibleBefore[k]=!!states[k]?.visible;renderLens()},0)})}
if(typeof map!=='undefined'&&map)map.on('click',()=>{if(active.checked)setTimeout(()=>renderLens(),0)});
const oldRefresh=typeof refresh==='function'?refresh:null;
if(typeof window!=='undefined'){window.reapplyServiceLens=()=>{if(active.checked)renderLens()};window.disableServiceLens=()=>{active.checked=false;restore()}}
const clear=$('clearService');if(clear)clear.addEventListener('click',()=>{if(active.checked){active.checked=false;restore()}});
const details=$('featureDetails');if(details)details.insertAdjacentHTML('afterend','<div class="sub">详情和搜索结果可在右侧面板查看，地图要素可点击。左上角“隐藏右侧信息”可收起面板。</div>');
// Leave the original service buffer feature in place for users who do not enable strict filtering.
})();
