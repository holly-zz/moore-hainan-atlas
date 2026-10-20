/* MOORE map style studio — independent Leaflet/GeoJSON style configuration.
   Does not invoke Baidu API or imply compatibility with Baidu's proprietary style IDs. */
(()=>{
const $=id=>document.getElementById(id);
const categories=[['background','地图背景'],['roads','道路'],['buildings','建筑轮廓'],['commercial','商业用地'],['residential','居住用地'],['industrial','工业用地'],['green','绿地'],['agriculture','农业用地'],['other_landuse','其他用地'],['water','水系'],['poi_health','医疗 POI'],['poi_schools','学校 POI'],['poi_retail','零售 POI'],['poi_transit','交通 POI'],['poi_food','餐饮 POI'],['poi_civic','公共 POI'],['poi_leisure','休闲 POI'],['poi_other','其他 POI'],['mask','分析边界'],['muted','范围外浅灰背景']];
const preset={
 atlas:{background:'#e6ede8',roads:'#c29f76',buildings:'#71827b',commercial:'#d9814b',residential:'#cc8392',industrial:'#9783b6',green:'#569b73',agriculture:'#b1b35f',other_landuse:'#c2a47a',water:'#4a99b9',poi_health:'#c94f50',poi_schools:'#326fb3',poi_retail:'#d18a39',poi_transit:'#7456bb',poi_food:'#c47e50',poi_civic:'#407f81',poi_leisure:'#689c61',poi_other:'#929798',mask:'#145e54',muted:'#b5bcb8'},
 monochrome:{background:'#f2f1eb',roads:'#878d8b',buildings:'#59615f',commercial:'#777b78',residential:'#a4aba7',industrial:'#777e79',green:'#adb6ac',agriculture:'#bcc2bb',other_landuse:'#c1c3bf',water:'#b4c3c5',poi_health:'#3f4745',poi_schools:'#3f4745',poi_retail:'#3f4745',poi_transit:'#3f4745',poi_food:'#3f4745',poi_civic:'#3f4745',poi_leisure:'#3f4745',poi_other:'#3f4745',mask:'#1e3330',muted:'#c6cbc7'},
 night:{background:'#182725',roads:'#8d9994',buildings:'#667b73',commercial:'#b18b69',residential:'#886b89',industrial:'#85849a',green:'#577c69',agriculture:'#878861',other_landuse:'#727e75',water:'#3a7280',poi_health:'#e59090',poi_schools:'#83acd8',poi_retail:'#d3ad73',poi_transit:'#b5a1e0',poi_food:'#d0a182',poi_civic:'#71b5ab',poi_leisure:'#94bb7f',poi_other:'#9baca5',mask:'#e8ba7a',muted:'#596a65'}
};
let saved=null;try{saved=JSON.parse(localStorage.getItem('moore-map-style-v1')||'null')}catch(e){}
let style={palette:{...preset.atlas,...(saved?.palette||{})},fill:Math.max(0,Math.min(1,Number(saved?.fill??.46))),stroke:Math.max(.2,Math.min(6,Number(saved?.stroke??1.1))),mutedOpacity:Math.max(0,Math.min(1,Number(saved?.mutedOpacity??.18)))};
const parent=document.querySelector('main > aside');if(!parent)return;
const section=document.createElement('section');
section.innerHTML='<h2>地图样式 / MAP STYLE STUDIO</h2><div class="sub">参考个性化地图的分类元素编辑方式。仅修改本项目 Leaflet 矢量渲染，不改变 OSM 数据。</div><label>样式预设</label><select id="stylePreset"><option value="atlas">Atlas / 图解配色</option><option value="monochrome">Monochrome / 黑白图解</option><option value="night">Night / 深色地图</option><option value="custom">Custom / 当前自定义</option></select><div id="styleEditors"></div><label>面填充透明度 <output id="styleFillText"></output></label><input id="styleFill" type="range" min="0" max="100" step="1"><label>矢量线宽 <output id="styleStrokeText"></output></label><input id="styleStroke" type="range" min="0.2" max="6" step="0.2"><label>背景灰度强度 <output id="styleMutedText"></output></label><input id="styleMuted" type="range" min="0" max="100" step="1"><div class="actions"><button id="styleExport">导出样式 JSON</button><button id="styleImport">导入样式 JSON</button></div><button id="styleReset" class="wide">恢复默认样式</button><input id="styleFile" type="file" accept=".json,application/json" hidden><div class="note">纯 GIS 矢量可完全编辑颜色；OSM 在线底图是预先渲染的栅格瓦片，不能在这里逐元素换色。需要选择“纯 GIS”查看完整效果。</div>';
const target=$('dataDiagnostics');if(target)target.before(section);else parent.append(section);
const colorsRoot=$('styleEditors');
for(const [id,name] of categories){const row=document.createElement('label');row.style.cssText='display:flex;align-items:center;justify-content:space-between;margin:7px 0;gap:12px';row.textContent=name;const input=document.createElement('input');input.type='color';input.id='styleColor_'+id;input.style.cssText='width:46px;height:32px;padding:2px';input.addEventListener('input',()=>{style.palette[id]=input.value;$('stylePreset').value='custom';apply()});row.append(input);colorsRoot.append(row)}
function reRender(){for(const [id] of categories){$( 'styleColor_'+id).value=style.palette[id]}$('styleFill').value=Math.round(style.fill*100);$('styleStroke').value=style.stroke;$('styleMuted').value=Math.round(style.mutedOpacity*100);$('styleFillText').textContent=Math.round(style.fill*100)+'%';$('styleStrokeText').textContent=style.stroke+' px';$('styleMutedText').textContent=Math.round(style.mutedOpacity*100)+'%'}
function styleFor(name){const c=style.palette[name]||'#657970';return {color:c,fillColor:c,weight:name==='roads'?style.stroke*1.4:style.stroke,opacity:.92,fillOpacity:name==='boundary'?.02:style.fill}}
function apply(){for(const [id] of categories)if(id!=='background'&&id!=='mask'&&id!=='muted'&&typeof colors!=='undefined')colors[id]=style.palette[id];
 const m=$('map');if(m)m.style.backgroundColor=style.palette.background;
 if(typeof layers!=='undefined')for(const [name,group] of Object.entries(layers))group.eachLayer(l=>{
  if(l.setStyle)l.setStyle(name.startsWith('poi_')?{color:'#ffffff',weight:1.2,fillColor:style.palette[name]||'#777777',fillOpacity:.95}:styleFor(name));
 });
 if(typeof refresh==='function')refresh();
 if(typeof window.spatialMask?.refresh==='function')window.spatialMask.refresh();
 try{localStorage.setItem('moore-map-style-v1',JSON.stringify(style))}catch(e){}
}
function setControls(){style.fill=Number($('styleFill').value)/100;style.stroke=Number($('styleStroke').value);style.mutedOpacity=Number($('styleMuted').value)/100;$('stylePreset').value='custom';reRender();apply()}
for(const id of ['styleFill','styleStroke','styleMuted'])$(id).addEventListener('input',setControls);
$('stylePreset').onchange=()=>{const key=$('stylePreset').value;if(!preset[key])return;style.palette={...preset[key]};reRender();apply()};
$('styleReset').onclick=()=>{style={palette:{...preset.atlas},fill:.46,stroke:1.1,mutedOpacity:.18};$('stylePreset').value='atlas';reRender();apply()};
$('styleExport').onclick=()=>{const blob=new Blob([JSON.stringify({format:'moore-leaflet-style-v1',...style},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='moore-map-style.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('styleImport').onclick=()=>$('styleFile').click();
$('styleFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const o=JSON.parse(await file.text());if(o.format!=='moore-leaflet-style-v1'||!o.palette)throw Error('不是 MOORE 地图样式文件');for(const [id] of categories){const c=o.palette[id];if(typeof c!=='string'||!/^#[0-9a-fA-F]{6}$/.test(c))throw Error('无效颜色 '+id)}style={palette:Object.fromEntries(categories.map(([id])=>[id,o.palette[id]])),fill:Math.max(0,Math.min(1,Number(o.fill??.46))),stroke:Math.max(.2,Math.min(6,Number(o.stroke??1.1))),mutedOpacity:Math.max(0,Math.min(1,Number(o.mutedOpacity??.18)))};$('stylePreset').value='custom';reRender();apply()}catch(err){alert('导入失败：'+err.message)}};
window.mooreStyle={get value(){return style},styleFor,reapply:apply};
reRender();apply();
})();