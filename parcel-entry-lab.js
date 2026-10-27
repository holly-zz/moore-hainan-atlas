/* MOORE V18 Parcel Editor + V19 Entrance Lab — experimental, evidence-labelled.
   Depends on Leaflet and Turf already loaded by MOORE Atlas. No statutory parcel is inferred. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const host=$('rightPanel')||document.querySelector('main > aside');
if(!host||!window.L||!window.turf||typeof map==='undefined')return;
const section=document.createElement('section');
section.id='parcelEntryLab';
section.innerHTML=[
'<h2>V18 + V19 / SITE-TO-PLAN LAB</h2>',
'<div class="note">从候选研究区域进入宗地与入口测试。网格≠法定地块。绘制、导入或演示红线均标为“未核验”，不能据此认定住宅用地、退界或车辆开口许可。</div>',
'<div class="actions"><button id="pelDemo" class="primary">创建 40×50m 测试地块</button><button id="pelDraw">手绘宗地红线</button></div>',
'<div class="actions"><button id="pelFinish" disabled>完成绘制</button><button id="pelImport">导入 GeoJSON</button></div>',
'<input type="file" id="pelFile" accept=".geojson,.json" hidden>',
'<div class="actions"><button id="pelFront">点选临路边</button><button id="pelClear">清除测试</button></div>',
'<div id="pelStatus" class="note">请使用测试地块，或导入具有准确坐标的宗地 GeoJSON。手绘数据为示意测量。</div>',
'<h2>入口实验 / ENTRANCE LAB</h2>',
'<div class="actions"><button id="pelA">入口 A · 左侧</button><button id="pelB" class="primary">入口 B · 中部</button></div>',
'<button id="pelC" class="wide">入口 C · 右侧</button>',
'<div class="sub">拖动橙色场地门点，观察路径与门厅关系联动；拖动深色圆点移动建筑基底。车库/后勤连接为推荐原型，并非固定建筑物。</div>',
'<label>建筑基底宽度（设计变量） <output id="pelWOut">20</output>m</label><input id="pelW" type="range" min="10" max="28" value="20" step="1" style="width:100%">',
'<label>建筑基底进深（设计变量） <output id="pelDOut">18</output>m</label><input id="pelD" type="range" min="10" max="30" value="18" step="1" style="width:100%">',
'<div id="pelMetrics" class="note">等待有效地块与临路边。</div>',
'<div class="actions"><button id="pelExport" class="primary">导出分析包 JSON</button><button id="pelAudit">查看核验缺口</button></div>',
'<div class="sub">橙色=场地门；黑色=体量中心；绿色=步行；蓝色=车行；灰线=公共立面方向视线代理。庭院“可用”面积只扣除估算路面，非正式景观面积。离真实建设尚需复尺、控规、道路开口及消防审核。</div>'
].join('');
host.prepend(section);
const css=document.createElement('style');css.textContent='#parcelEntryLab{padding:13px;border:1px solid #bac9c0;border-radius:6px;background:#fffefa;margin:15px 0}#parcelEntryLab button.active{background:#b14b2e;color:#fff}#pelMetrics{white-space:pre-line}';document.head.append(css);
const R=6378137,rad=Math.PI/180;
const state={ring:null,origin:null,source:'missing',front:2,gateT:.5,building:null,w:20,d:18,mode:null,drawPts:[],version:0,computed:null};
const overlay=L.layerGroup().addTo(map), vertexOverlay=L.layerGroup().addTo(map), handles=L.layerGroup().addTo(map);
let preview=L.polyline([],{color:'#aa5030',weight:2,dashArray:'5 3'}).addTo(map),gateHandle=null,buildHandle=null;
const status=s=>$('pelStatus').textContent=s;
const fmt=n=>Number.isFinite(n)?n.toFixed(1):'N/A';
function originOf(ring){return [ring.reduce((s,p)=>s+p[0],0)/ring.length,ring.reduce((s,p)=>s+p[1],0)/ring.length]}
function xy(p){const o=state.origin;return [(p[0]-o[0])*rad*R*Math.cos(o[1]*rad),(p[1]-o[1])*rad*R]}
function ll(p){const o=state.origin;return [o[0]+p[0]/(R*Math.cos(o[1]*rad))/rad,o[1]+p[1]/R/rad]}
function add(a,b){return [a[0]+b[0],a[1]+b[1]]}
function sub(a,b){return [a[0]-b[0],a[1]-b[1]]}
function mul(v,s){return [v[0]*s,v[1]*s]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]}
function norm(v){const l=Math.hypot(...v);return l>1e-8?mul(v,1/l):[1,0]}
function polygonArea(poly){let s=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];s+=a[0]*b[1]-b[0]*a[1]}return Math.abs(s)/2}
function cleanRing(r){if(r.length>1&&Math.abs(r[0][0]-r[r.length-1][0])<1e-9&&Math.abs(r[0][1]-r[r.length-1][1])<1e-9)return r.slice(0,-1);return r}
function geoPoly(p,properties={}){return turf.polygon([[...p,p[0]].map(ll)],properties)}
function featurePoint(p,properties={}){return turf.point(ll(p),properties)}
function line(points,properties={}){return turf.lineString(points.map(ll),properties)}
function centerOf(poly){const a=poly.reduce((s,p)=>add(s,p),[0,0]);return mul(a,1/poly.length)}
function signed(p,a,n){return dot(sub(p,a),n)}
function clip(poly,a,n,limit,keepLess){const result=[];if(!poly.length)return result;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];const dp=signed(p,a,n)-limit,dq=signed(q,a,n)-limit;const pin=keepLess?dp<=1e-8:dp>=-1e-8,qin=keepLess?dq<=1e-8:dq>=-1e-8;if(pin)result.push(p);if(pin!==qin){const t=dp/(dp-dq);result.push(add(p,mul(sub(q,p),t)))}}return result}
function inside(pt,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>pt[1])!==(b[1]>pt[1])&&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes}
function distSeg(p,a,b){const v=sub(b,a),t=Math.min(1,Math.max(0,dot(sub(p,a),v)/(dot(v,v)||1)));return Math.hypot(...sub(p,add(a,mul(v,t))))}
function pathLength(points){return points.slice(1).reduce((s,p,i)=>s+Math.hypot(...sub(p,points[i])),0)}
function pavingInYard(poly,paths){if(poly.length<3)return 0;const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);const step=1,cols=Math.ceil((maxx-minx)/step),rows=Math.ceil((maxy-miny)/step);if(cols*rows>30000)return null;let n=0;for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){const p=[minx+(i+.5)*step,miny+(j+.5)*step];if(!inside(p,poly))continue;if(paths.some(item=>item.pts.slice(1).some((q,k)=>distSeg(p,item.pts[k],q)<=item.width/2)))n++}return n*step*step}
function nearestEdge(point){const p=xy(point),poly=state.ring.map(xy);let best=0,bestD=Infinity;poly.forEach((a,i)=>{const d=distSeg(p,a,poly[(i+1)%poly.length]);if(d<bestD){bestD=d;best=i}});return best}
function axes(){const poly=state.ring.map(xy),a=poly[state.front],b=poly[(state.front+1)%poly.length],t=norm(sub(b,a)),c=centerOf(poly);let n=[-t[1],t[0]];if(dot(n,sub(c,a))<0)n=mul(n,-1);return {poly,a,b,t,n,c}}
function gateXY(ax){return add(ax.a,mul(sub(ax.b,ax.a),state.gateT))}
function projectionT(p,ax){const e=sub(ax.b,ax.a);return Math.max(.03,Math.min(.97,dot(sub(p,ax.a),e)/(dot(e,e)||1)))}
function compute(){
 if(!state.ring)return null;
 const ax=axes(),{poly,t,n,a}=ax,gate=gateXY(ax),c=state.building||ax.c,w=state.w,d=state.d;
 const front=add(c,mul(n,-d/2)),back=add(c,mul(n,d/2));
 const building=[add(add(c,mul(t,-w/2)),mul(n,-d/2)),add(add(c,mul(t,w/2)),mul(n,-d/2)),add(add(c,mul(t,w/2)),mul(n,d/2)),add(add(c,mul(t,-w/2)),mul(n,d/2))];
 const west=add(front,mul(t,-w*.35)),east=add(front,mul(t,w*.35));
 const side=pathLength([gate,west])<=pathLength([gate,east])?'left':'right';
 const garage=side==='left'?west:east,service=add(garage,mul(n,d*.42)),foyer=front,publicFacade=add(front,mul(t,w*.18));
 const lead=add(gate,mul(n,Math.min(4,Math.max(1.5,signed(front,a,n)*.25))));
 const ped=[gate,lead,foyer],car=[gate,lead,garage],servicePath=[garage,service];
 const frontCut=signed(front,a,n),backCut=signed(back,a,n);
 const frontZone=clip(poly,a,n,frontCut,true),rearZone=clip(poly,a,n,backCut,false);
 const frontGross=polygonArea(frontZone),rearGross=polygonArea(rearZone),plotArea=polygonArea(poly);
 const paving=[{pts:ped,width:1.5},{pts:car,width:3},{pts:servicePath,width:1.2}];
 const frontPaved=pavingInYard(frontZone,paving),rearPaved=pavingInYard(rearZone,paving);
 const frontage=Math.hypot(...sub(ax.b,ax.a));
 const viewVec=sub(publicFacade,gate),direction=norm(viewVec),incidence=Math.acos(Math.max(-1,Math.min(1,dot(direction,n))))/rad;
 const fits=building.every(p=>inside(p,poly));
 const bounds={plot_area_m2:plotArea,building_footprint_m2:w*d,front_yard_gross_m2:frontGross,rear_yard_gross_m2:rearGross,front_yard_usable_proxy_m2:frontPaved===null?null:Math.max(0,frontGross-frontPaved),rear_yard_usable_proxy_m2:rearPaved===null?null:Math.max(0,rearGross-rearPaved)};
 return {ax,gate,building,foyer,garage,service,publicFacade,ped,car,servicePath,bounds,frontZone,rearZone,frontage,incidence,side,fits,walkM:pathLength(ped),driveM:pathLength(car),serviceM:pathLength(servicePath)};
}
function dropHandles(){handles.clearLayers();vertexOverlay.clearLayers();gateHandle=null;buildHandle=null}
function marker(p,color,letter){return L.marker([ll(p)[1],ll(p)[0]],{draggable:true,icon:L.divIcon({className:'',html:'<div style="width:23px;height:23px;display:grid;place-items:center;border:2px solid white;border-radius:50%;background:'+color+';color:white;font:bold 11px Arial;box-shadow:0 1px 7px #2227">'+letter+'</div>',iconSize:[23,23],iconAnchor:[11,11]})})}
function rebuildHandles(){
 dropHandles();if(!state.ring)return;
 state.ring.forEach((p,i)=>{const m=marker(xy(p),'#677872',String(i+1));vertexOverlay.addLayer(m);m.on('dragend',()=>{const next=state.ring.map(v=>v.slice());const q=m.getLatLng();next[i]=[q.lng,q.lat];try{setParcel(next,state.source,state.front,false)}catch(e){status('顶点修改未应用：'+e.message)}})});
 const c=compute();if(!c)return;
 gateHandle=marker(c.gate,'#bf5428','G').addTo(handles);
 gateHandle.bindTooltip('场地入口 G — 可沿临路边拖动');
 gateHandle.on('drag',()=>{const q=gateHandle.getLatLng();state.gateT=projectionT(xy([q.lng,q.lat]),axes());render(false)});
 gateHandle.on('dragend',()=>{const g=gateXY(axes()),q=ll(g);gateHandle.setLatLng([q[1],q[0]]);render(false)});
 buildHandle=marker(state.building||c.ax.c,'#1b2a29','B').addTo(handles);
 buildHandle.bindTooltip('建筑基底中心 B — 可拖动');
 buildHandle.on('drag',()=>{const q=buildHandle.getLatLng();state.building=xy([q.lng,q.lat]);render(false)});
 buildHandle.on('dragend',()=>render(false));
}
function render(rebuild=true){
 overlay.clearLayers();const c=compute();state.computed=c;if(!c)return;
 const feat=geoPoly(c.ax.poly);L.geoJSON(feat,{style:{color:'#263d39',weight:2.5,fillColor:'#c5d4c3',fillOpacity:.12}}).addTo(overlay);
 const f=c.ax.poly;L.polyline([[ll(f[state.front])[1],ll(f[state.front])[0]],[ll(f[(state.front+1)%f.length])[1],ll(f[(state.front+1)%f.length])[0]]],{color:'#e2672e',weight:7,opacity:.7}).addTo(overlay);
 if(c.frontZone.length>=3)L.geoJSON(geoPoly(c.frontZone),{style:{color:'#5b8b70',weight:.5,fillColor:'#90b992',fillOpacity:.17}}).addTo(overlay);
 if(c.rearZone.length>=3)L.geoJSON(geoPoly(c.rearZone),{style:{color:'#6487a0',weight:.5,fillColor:'#b2cbda',fillOpacity:.17}}).addTo(overlay);
 L.geoJSON(geoPoly(c.building),{style:{color:c.fits?'#253735':'#b62626',weight:2,fillColor:c.fits?'#586a64':'#e47b6a',fillOpacity:.52}}).addTo(overlay);
 const coords=pts=>pts.map(p=>{const v=ll(p);return [v[1],v[0]]});
 L.polyline(coords(c.ped),{color:'#39866d',weight:3.5}).addTo(overlay);
 L.polyline(coords(c.car),{color:'#367fba',weight:4,dashArray:'6 3'}).addTo(overlay);
 L.polyline(coords(c.servicePath),{color:'#8f6da1',weight:3,dashArray:'2 3'}).addTo(overlay);
 L.polyline(coords([c.gate,c.publicFacade]),{color:'#636a70',weight:1.6,dashArray:'4 5'}).addTo(overlay);
 for(const [p,title,color] of [[c.foyer,'建筑门厅','#39866d'],[c.garage,'推荐车库入口','#367fba'],[c.service,'建议服务点','#8f6da1'],[c.publicFacade,'公共空间立面采样点','#636a70']]){const q=ll(p);L.circleMarker([q[1],q[0]],{radius:5,color:'#fff',weight:1,fillColor:color,fillOpacity:1}).bindTooltip(title).addTo(overlay)}
 if(rebuild)rebuildHandles();
 const b=c.bounds,warning=c.fits?'体量四角落在输入红线内（仍未核验法定退界）':'警告：体量超出输入红线，须调整';
 $('pelMetrics').textContent='宗地面积 '+fmt(b.plot_area_m2)+'㎡ · 建筑基底 '+fmt(b.building_footprint_m2)+'㎡\n'
 +'前庭总面积 '+fmt(b.front_yard_gross_m2)+'㎡ → 扣除估算铺装后 '+fmt(b.front_yard_usable_proxy_m2)+'㎡\n'
 +'后院总面积 '+fmt(b.rear_yard_gross_m2)+'㎡ → 扣除估算铺装后 '+fmt(b.rear_yard_usable_proxy_m2)+'㎡\n'
 +'步行到门厅 '+fmt(c.walkM)+'m · 车行到车库 '+fmt(c.driveM)+'m · 后勤连接 '+fmt(c.serviceM)+'m\n'
 +'推荐车库/后勤侧 '+(c.side==='left'?'临路边左侧':'临路边右侧')+' · 入门路径方向偏转 '+fmt(c.incidence)+'°（仅平面视线代理）\n'
 +'公共空间暴露：只有入口→立面示意视线；窗洞、围墙、树木、邻栋高度缺失，不能计算真实可见比例。\n'
 +warning+'\n用地性质 / 开口许可 / 消防车道 / 法定退界：N/A · 待官方核验。';
}
function setParcel(input,source,front=2,fit=true){
 const ring=cleanRing(input).map(p=>[Number(p[0]),Number(p[1])]);
 if(ring.length<3||ring.some(p=>p.some(v=>!Number.isFinite(v)))||ring.some(p=>Math.abs(p[0])>180||Math.abs(p[1])>90))throw Error('GeoJSON 需要 WGS84 [经度,纬度] 多边形');
 state.ring=ring;state.origin=originOf(ring);const a=polygonArea(ring.map(xy));if(a<30||a>1e7)throw Error('宗地面积超出测试范围：'+fmt(a)+'㎡');
 state.source=source;state.front=Math.max(0,Math.min(ring.length-1,front));state.building=null;state.gateT=.5;state.version++;
 render(true);if(fit){const geo=geoPoly(ring.map(xy));map.fitBounds(L.geoJSON(geo).getBounds().pad(.6))}
 status('宗地已加载：'+fmt(a)+'㎡ · '+source+'。橙色边为当前假设临路边；点击“点选临路边”修改。所有法定条件仍未核实。');
}
function setDemo(){
 const c=window.idolResidenceAgent?.candidates?.[0]?.coord||[map.getCenter().lng,map.getCenter().lat];
 const old=state.origin;state.origin=[c[0],c[1]];
 const r=[[-20,-25],[20,-25],[20,25],[-20,25]].map(ll);state.origin=old;
 setParcel(r,'synthetic_demo_40x50m_not_real',2,true);
}
function mapClick(e){if(state.mode==='draw'){state.drawPts.push([e.latlng.lng,e.latlng.lat]);preview.setLatLngs(state.drawPts.map(p=>[p[1],p[0]]));$('pelFinish').disabled=state.drawPts.length<3;status('已绘制 '+state.drawPts.length+' 个顶点。至少 3 个顶点后点击“完成绘制”。')}else if(state.mode==='front'&&state.ring){state.front=nearestEdge([e.latlng.lng,e.latlng.lat]);state.mode=null;state.gateT=.5;state.building=null;render(true);status('临路边已更新为边 '+(state.front+1)+'。请核对真实道路权属及开口条件。')}}
map.on('click',mapClick);
$('pelDemo').onclick=setDemo;
$('pelDraw').onclick=()=>{state.mode='draw';state.drawPts=[];preview.setLatLngs([]);$('pelFinish').disabled=true;status('开始点选宗地顶点，完成后点击“完成绘制”。不要把手绘边界视为权属边界。')};
$('pelFinish').onclick=()=>{try{setParcel(state.drawPts,'manual_trace_unverified',0,false);state.mode=null;preview.setLatLngs([]);$('pelFinish').disabled=true}catch(e){status('绘制失败：'+e.message)}};
$('pelFront').onclick=()=>{if(!state.ring)return status('请先建立宗地');state.mode='front';status('请点击宗地临路边附近。必须再核实这条路是否允许设置出入口。')};
$('pelImport').onclick=()=>$('pelFile').click();
$('pelFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());const feature=data.type==='FeatureCollection'?data.features.find(f=>f.geometry?.type==='Polygon'):data.type==='Feature'?data:{type:'Feature',geometry:data};const polygon=feature?.geometry;if(polygon?.type!=='Polygon'||!Array.isArray(polygon.coordinates?.[0]))throw Error('只接受 Polygon 或包含 Polygon 的 FeatureCollection');setParcel(polygon.coordinates[0],'user_imported_unverified',0,true)}catch(err){status('导入失败：'+err.message)}e.target.value=''};
$('pelClear').onclick=()=>{state.ring=null;state.computed=null;state.mode=null;state.drawPts=[];dropHandles();overlay.clearLayers();preview.setLatLngs([]);$('pelMetrics').textContent='等待有效地块与临路边。';status('V18/V19 测试场景已清除。')};
for(const [k,t] of [['pelA',.15],['pelB',.5],['pelC',.85]])$(k).onclick=()=>{if(!state.ring)return status('先建立测试地块');state.gateT=t;render(true);for(const el of ['pelA','pelB','pelC'])$(el).classList.toggle('active',el===k)};
for(const [key,k] of [['pelW','w'],['pelD','d']])$(key).oninput=()=>{state[k]=Number($(key).value);$(key+'Out').textContent=$(key).value;if(state.ring)render(true)};
function getExport(){const c=state.computed;if(!c)throw Error('请先建立场地');const p=c.ax.poly;const fc={type:'FeatureCollection',features:[
 geoPoly(p,{feature_id:'PARCEL_01',role:'parcel',source_status:state.source,legal_status:'unknown'}),
 line([p[state.front],p[(state.front+1)%p.length]],{feature_id:'FRONTAGE_01',role:'assumed_road_frontage',permission:'unverified'}),
 geoPoly(c.building,{feature_id:'MASS_01',role:'concept_building_footprint',legality:'unverified'}),
 featurePoint(c.gate,{feature_id:'GATE_01',role:'site_gate',status:'design_proposal'}),
 featurePoint(c.foyer,{feature_id:'FOYER_01',role:'building_main_entry',status:'design_proposal'}),
 featurePoint(c.garage,{feature_id:'GARAGE_01',role:'garage_anchor',status:'generated_design_option'}),
 featurePoint(c.service,{feature_id:'SERVICE_01',role:'service_anchor',status:'generated_design_option'}),
 featurePoint(c.publicFacade,{feature_id:'PUBLIC_FACADE_01',role:'public_facade_sample',visibility_status:'not_measured'}),
 line(c.ped,{feature_id:'ROUTE_PED_01',role:'concept_pedestrian_route'}),
 line(c.car,{feature_id:'ROUTE_CAR_01',role:'concept_car_route'}),
 line(c.servicePath,{feature_id:'ROUTE_SERVICE_01',role:'concept_service_route'})
 ]};return {schema:'moore-site-to-plan-v18-v19-test',created_at:new Date().toISOString(),data_status:state.source,coordinate_system:'EPSG:4326',metrics:c.bounds,paths_m:{walk:c.walkM,vehicle:c.driveM,service:c.serviceM},privacy_proxy:{entry_to_public_facade_incidence_deg:c.incidence,measured_visibility:null},validation:{parcel_boundary:'unverified',zoning:'missing',road_access:'missing',setbacks:'missing',fire_access:'missing',terrain:'missing',neighbor_height:'missing'},geojson:fc}}
$('pelExport').onclick=()=>{try{const body=getExport(),blob=new Blob([JSON.stringify(body,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='moore-v18-v19-site-to-plan.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}catch(e){status(e.message)}};
$('pelAudit').onclick=()=>{if(!state.computed)return status('请先建立测试地块');status('核验缺口：① 法定宗地与权属、② 控规用途与指标、③ 允许开口的临路位置、④ 道路和场地高程、⑤ 法定退界及消防、⑥ 邻栋高度与窗洞、⑦ 实测噪声与围墙/绿植遮挡。未核验时所有方案仅用于课堂设计推演。')};
window.mooreParcelEntryLab={get state(){return state},compute,createDemo:setDemo,export:getExport};
})();