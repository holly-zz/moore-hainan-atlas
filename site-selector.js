/* MOORE Haikou Site Selection Lab: geometry-aware land-use lens and candidate routing. */
(()=>{
const $=id=>document.getElementById(id);
const layerNames=['commercial','residential','industrial','green','agriculture','other_landuse'];
let origin=null,destination=null,mode=null,focusGroup=null,routeGroup=null,routeData=null,routeLoading=false,siteResults=null;
const panel=document.createElement('section');
panel.innerHTML=`<h2>05 / 场地筛选 SITE SELECTION</h2>
<div class="note">选中学校 POI 后设为起点，或用下方地图点选指定校门。研究半径是直线距离；路线计算使用单独的候选步行网络。</div>
<div class="actions"><button id="siteFromSelected">所选要素 → 起点</button><button id="siteToSelected">所选要素 → 终点</button></div>
<div class="actions"><button id="sitePickStart">地图点选起点</button><button id="sitePickEnd">地图点选终点</button></div>
<div id="sitePair" class="note">起点和终点尚未选定。可搜索“海口中学”“海口东站”，核对校区和站点后设置。</div>
<label>周边用地分析半径</label><select id="siteRadius"><option value="500">500 米</option><option value="1000" selected>1 公里</option><option value="3000">3 公里</option></select>
<div class="actions"><button id="siteAnalyze" class="primary">分析范围内用地</button><button id="siteClear">关闭专题着色</button></div>
<div id="siteStats" class="note">数据图层保持独立；启动分析后仅着色所选范围内的真实多边形。</div>
<h2>多指标场地权重评分</h2><div class="sub">指标为研究性示例：范围内已映射用地组成及 POI 数量，不是规划部门评分。</div>
<label>商业用地权重 <output id="wtCommerceValue">30</output>%</label><input type="range" id="wtCommerce" min="0" max="100" value="30">
<label>居住用地权重 <output id="wtResidentialValue">30</output>%</label><input type="range" id="wtResidential" min="0" max="100" value="30">
<label>绿地权重 <output id="wtGreenValue">25</output>%</label><input type="range" id="wtGreen" min="0" max="100" value="25">
<label>医疗/交通 POI 权重 <output id="wtPOIValue">15</output>%</label><input type="range" id="wtPOI" min="0" max="100" value="15">
<div id="siteScore" class="note">先选场地并点击“分析范围内用地”。权重将自动归一化。</div>
<h2>真实路网候选最短路径</h2><button id="siteRoute" class="wide">计算起点 → 终点路径</button><button id="siteRouteClear" class="wide">关闭路径图层</button>
<div id="siteRouteStatus" class="note">从已发布的候选道路网络计算最短距离。校门与车站入口需要现场核对。</div>
<button id="siteExport" class="wide">导出场地分析 JSON</button>`;
const left=document.querySelector('main > aside');left.append(panel);
const status=(id,s)=>$(id).textContent=s;
function coordsFromSelected(){if(!selected?.layer)return null;const l=selected.layer;if(l.getLatLng){const p=l.getLatLng();return [p.lng,p.lat]}try{const p=turf.pointOnFeature(l.toGeoJSON());return p.geometry.coordinates}catch(e){return null}}
function setLocation(which,coord,title){if(!coord)return status('sitePair','此要素没有有效点位。');if(which==='start')origin={coord,title};else destination={coord,title};status('sitePair','起点：'+(origin?.title||'未选')+'　→　终点：'+(destination?.title||'未选'));if(which==='start')clearFocus();clearRoute()}
function fromSelected(which){const p=coordsFromSelected();if(!p)return status('sitePair','先在 POI 搜索中点击学校或站点，或使用地图点选。');const props=selected.layer.feature?.properties||{};setLocation(which,p,String(props.name||props.fclass||'所选地物'))}
$('siteFromSelected').onclick=()=>fromSelected('start');
$('siteToSelected').onclick=()=>fromSelected('end');
$('sitePickStart').onclick=()=>{mode='start';status('sitePair','请在地图上点击起点（建议明确校门位置）')};
$('sitePickEnd').onclick=()=>{mode='end';status('sitePair','请在地图上点击终点（建议明确车站出入口）')};
function bindMap(){if(typeof map==='undefined'||!map){setTimeout(bindMap,200);return}map.on('click',e=>{if(!mode)return;setLocation(mode,[e.latlng.lng,e.latlng.lat],'手动选点 '+e.latlng.lat.toFixed(5)+','+e.latlng.lng.toFixed(5));mode=null})}bindMap();
function restoreLanduse(){for(const name of layerNames){if(layers[name]&&states[name]?.visible)layers[name].addTo(map)}}
function clearFocus(){if(focusGroup&&map)map.removeLayer(focusGroup);focusGroup=null;restoreLanduse();siteResults=null;status('siteStats','专题颜色已清除。图层恢复独立显隐控制。');status('siteScore','请选择场地并运行周边用地分析。')}
$('siteClear').onclick=clearFocus;
function calc(){if(!origin)return status('siteStats','请先设置场地起点。');if(typeof turf==='undefined')return status('siteStats','Turf 未加载。');const radius=Number($('siteRadius').value),disk=turf.circle(origin.coord,radius/1000,{steps:96,units:'kilometers'});if(!focusGroup)focusGroup=L.featureGroup();else focusGroup.clearLayers();const out={};let recognized=0;
for(const name of layerNames){if(!layers[name])continue;recognized++;map.removeLayer(layers[name]);out[name]={area_m2:0,count:0};const parts=[];for(const feature of features(name)){if(!feature.geometry||!feature.geometry.type.includes('Polygon'))continue;try{const intersect=turf.intersect(turf.featureCollection([feature,disk]));if(intersect){parts.push(intersect);out[name].area_m2+=turf.area(intersect);out[name].count++}}catch(e){out[name].errors=(out[name].errors||0)+1}}if(parts.length)L.geoJSON({type:'FeatureCollection',features:parts},{style:{color:colors[name],fillColor:colors[name],fillOpacity:.72,weight:.6},interactive:false}).addTo(focusGroup)}
L.geoJSON(disk,{style:{color:'#133e3b',fillOpacity:0,weight:2,dashArray:'7 5'},interactive:false}).addTo(focusGroup);focusGroup.addTo(map);
if(!recognized){status('siteStats','尚未加载土地利用数据。先点击“加载道路 / 居住用地 / 土地利用等背景图层”，再重试。');return}
const total=Object.values(out).reduce((a,b)=>a+b.area_m2,0);const stats=Object.entries(out).map(([key,value])=>names[key]+': '+(value.area_m2/1e6).toFixed(3)+' km²').join(' · ');
siteResults={origin,study_radius_m:radius,landuse:out,landuse_detected_sum_km2:total/1e6,method:'Turf geodesic circular mask and polygon intersection, OSM tagged landuse; potential polygon overlap; not official zoning'};status('siteStats','只显示 '+radius+' m 内的着色用地。'+stats+'。未映射区域不会凭空着色。');score()}
function score(){if(!siteResults)return;const r=siteResults,ws=['wtCommerce','wtResidential','wtGreen','wtPOI'].map(id=>Number($(id).value)),wSum=ws.reduce((a,b)=>a+b,0);if(!wSum)return status('siteScore','权重之和不能为 0');const total=r.landuse_detected_sum_km2*1e6;const proportion=k=>total?(r.landuse[k]?.area_m2||0)/total:0;const countPOI=['poi_health','poi_transit'].reduce((n,k)=>n+features(k).filter(f=>{try{return turf.distance(turf.point(r.origin.coord),turf.point(f.geometry.coordinates),{units:'kilometers'})<=r.study_radius_m/1000}catch(e){return false}}).length,0);const factors=[proportion('commercial'),proportion('residential'),proportion('green'),Math.min(1,countPOI/20)];const value=100*factors.reduce((s,v,i)=>s+v*ws[i]/wSum,0);r.score={value:Number(value.toFixed(1)),weights_normalized:ws.map(w=>w/wSum),raw_factors:factors,poi_health_transit_count:countPOI,poi_target_saturation:20};status('siteScore','评分 '+value.toFixed(1)+' / 100 · 商业 '+(factors[0]*100).toFixed(1)+'% · 居住 '+(factors[1]*100).toFixed(1)+'% · 绿地 '+(factors[2]*100).toFixed(1)+'% · 医疗/交通点 '+countPOI+' 个。仅适用于统一数据口径下的候选场地比较。')}
$('siteAnalyze').onclick=calc;$('siteRadius').onchange=()=>{if(origin)calc()};
for(const id of ['wtCommerce','wtResidential','wtGreen','wtPOI'])$(id).oninput=()=>{$(id+'Value').textContent=$(id).value;score()};
function clearRoute(){if(routeGroup&&map)map.removeLayer(routeGroup);routeGroup=null;status('siteRouteStatus','路径图层已关闭。')}
$('siteRouteClear').onclick=clearRoute;
const rad=Math.PI/180;function metres(a,b){const dy=(a[1]-b[1])*111200,dx=(a[0]-b[0])*111200*Math.cos((a[1]+b[1])/2*rad);return Math.hypot(dx,dy)}
async function graph(){if(routeData)return routeData;if(routeLoading)return null;routeLoading=true;try{const r=await fetch('./data/walk_graph.json');if(!r.ok)throw Error('网络文件 HTTP '+r.status);routeData=await r.json();return routeData}finally{routeLoading=false}}
function nearest(nodes,p){let best=-1,d=Infinity;for(let i=0;i<nodes.length;i++){const t=metres(nodes[i],p);if(t<d){d=t;best=i}}return [best,d]}
function dijkstra(g,s,t){const adj=Array.from({length:g.nodes.length},()=>[]);for(const [u,v,w] of g.edges){adj[u].push([v,w]);adj[v].push([u,w])}const dist=new Float64Array(adj.length);dist.fill(Infinity);dist[s]=0;const prev=new Int32Array(adj.length);prev.fill(-1);const heap=[[0,s]];function add(item){let i=heap.length;heap.push(item);while(i){let p=(i-1)>>1;if(heap[p][0]<=item[0])break;heap[i]=heap[p];i=p}heap[i]=item}function take(){const x=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(last[0]<=heap[c][0])break;heap[i]=heap[c];i=c}heap[i]=last}return x}while(heap.length){const [d,u]=take();if(d>dist[u])continue;if(u===t)break;for(const [v,w] of adj[u]){const next=d+w;if(next<dist[v]){dist[v]=next;prev[v]=u;add([next,v])}}}if(!Number.isFinite(dist[t]))return null;const path=[];let i=t;while(i!==-1){path.push(g.nodes[i]);i=prev[i]}path.reverse();return {path,distance_m:dist[t]}}
$('siteRoute').onclick=async()=>{if(!origin||!destination)return status('siteRouteStatus','请先设置起点和终点；学校校区及车站入口位置需要确认。');status('siteRouteStatus','正在读取道路网络并计算最短路径…');try{const g=await graph();if(!g)return;const [s,ds]=nearest(g.nodes,origin.coord),[t,dt]=nearest(g.nodes,destination.coord);if(ds>350||dt>350)return status('siteRouteStatus','起点/终点距离候选道路网络过远（分别 '+ds.toFixed(0)+'m、'+dt.toFixed(0)+'m）；请核对实际入口和研究边界。');const result=dijkstra(g,s,t);if(!result)return status('siteRouteStatus','当前道路网络中不存在连通路径。没有画直线来冒充路线。');clearRoute();routeGroup=L.featureGroup().addTo(map);L.polyline(result.path.map(x=>[x[1],x[0]]),{color:'#d44f24',weight:5,opacity:.94}).addTo(routeGroup);map.fitBounds(routeGroup.getBounds(),{padding:[35,35]});siteResults=siteResults||{};siteResults.route={...result,snap_start_m:ds,snap_end_m:dt,algorithm:'Dijkstra on preliminary undirected road graph; not validated route or time'};status('siteRouteStatus','候选路网最短距离 '+(result.distance_m/1000).toFixed(2)+' km；起点接入 '+ds.toFixed(0)+'m，终点接入 '+dt.toFixed(0)+'m。道路通行权限、桥隧分层和实际入口未核查；不是导航路线。')}catch(e){status('siteRouteStatus','路线计算失败：'+e.message)}};
$('siteExport').onclick=()=>{if(!siteResults)return status('siteStats','暂无分析结果');download('haikou-site-selection.json',siteResults)};
})();