/* Regional research view. Numerical maps remain in this browser, outside NKPI.
 * Numerical and image-estimated paths remain separate. No clinical threshold,
 * local storage, network reader, probability or progression classification.
 */
(function(root){'use strict';
const node=typeof module!=='undefined'&&module.exports;
const C=node?require('./cornea/surface_schema.js'):root.CornealData;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LAYERS=[
 {id:'anterior',name:'Anterior curvature',unit:'D',cutoff:1,decimals:2,direction:'Increase in curvature',get:d=>d.anterior?.curvature_D,delta:(a,b)=>b-a},
 {id:'posterior',name:'Posterior curvature',unit:'D',cutoff:.25,decimals:2,direction:'Increase in curvature magnitude',get:d=>d.posterior?.curvature_D,delta:(a,b)=>Math.abs(b)-Math.abs(a)},
 {id:'thickness',name:'Thickness',unit:'µm',cutoff:10,decimals:1,direction:'Thinning',get:d=>d.thickness_um,delta:(a,b)=>a-b}
];
const DEFAULTS={anterior:1,posterior:.25,thickness:10};
function fail(s){throw new Error(s);}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function validatePair(raw){
 if(!raw||raw.schema!=='nkpi-regional-pair-1'||Object.keys(raw).some(k=>!['schema','interval_days','first','latest'].includes(k)))fail('Use the documented numerical pair JSON. Report images and six summary values do not contain map grids.');
 if(!Number.isInteger(raw.interval_days)||raw.interval_days<1||raw.interval_days>36525)fail('Supply the actual positive interval in whole days.');
 const a=C.validate(raw.first),b=C.validate(raw.latest);
 if(a.eye!==b.eye||a.visit!=='first'||b.visit!=='latest')fail('The pair must contain first and latest maps for the same eye.');
 if(a.kind!==b.kind||a.source!==b.source)fail('Measured and simulated maps cannot be combined.');
 if(!same(a.coordinate_system,b.coordinate_system)||!same(a.x_mm,b.x_mm)||!same(a.y_mm,b.y_mm))fail('The maps must have identical physical axes and coordinate definitions. This module does not align or resample scans.');
 if(!a.comparison||!b.comparison||!same(a.comparison,b.comparison))fail('A common registration and map-definition key must be supplied by the numerical conversion workflow. Matching image sizes are insufficient.');
 const layers=[];
 for(const l of LAYERS){
  if(!l.get(a)||!l.get(b))continue;
  if(l.id!=='thickness'){
   const x=a[l.id],y=b[l.id];
   if(x.curvature_type!==y.curvature_type||!['axial','tangential','mean'].includes(x.curvature_type))fail(l.name+': use the same specified curvature definition at both visits.');
   const vals=[...l.get(a).flat(),...l.get(b).flat()].filter(finite);
   if(l.id==='anterior'&&vals.some(v=>v<=0))fail('Anterior curvature must use a positive keratometric convention.');
   if(l.id==='posterior'&&!(vals.every(v=>v>0)||vals.every(v=>v<0)))fail('Posterior curvature must have one consistent nonzero sign convention across both scans.');
  }
  layers.push(l.id);
 }
 if(!layers.length)fail('No matching curvature or thickness maps were supplied at both visits. Elevation alone is not analyzed in this version.');
 return {schema:raw.schema,interval_days:raw.interval_days,first:a,latest:b};
}
function analyze(raw,settings=DEFAULTS){
 const p=validatePair(raw),a=p.first,b=p.latest,x=a.x_mm,y=a.y_mm;
 p.layers=LAYERS.filter(l=>l.get(a)&&l.get(b)).map(l=>l.id);
 const limits={};for(const l of LAYERS){const t=settings[l.id];if(!finite(t)||t<=0||t>(l.id==='thickness'?200:20))fail('Display cutoffs must be finite and positive.');limits[l.id]=t;}
 const nx=x.length-1,ny=y.length-1,cells=[];
 let apertureArea=0;
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const corners=[[j,i],[j,i+1],[j+1,i],[j+1,i+1]];
  // Full cell must lie inside the central 6-mm aperture. Edge cells are omitted.
  if(corners.some(([r,c])=>Math.hypot(x[c],y[r])>3+1e-9))continue;
  const area=(x[i+1]-x[i])*(y[j+1]-y[j]),v={i,j,x:(x[i]+x[i+1])/2,y:(y[j]+y[j+1])/2,area,values:{}};
  apertureArea+=area;
  for(const id of p.layers){const l=LAYERS.find(l=>l.id===id),ga=l.get(a),gb=l.get(b),va=corners.map(([r,c])=>ga[r][c]),vb=corners.map(([r,c])=>gb[r][c]);
   if([...va,...vb].every(finite)){const av=va.reduce((s,v)=>s+v,0)/4,bv=vb.reduce((s,v)=>s+v,0)/4;v.values[id]={first:av,latest:bv,change:l.delta(av,bv)};}
  }
  cells.push(v);
 }
 if(!apertureArea)fail('There are no complete grid cells inside the central 6-mm aperture.');
 const regions=[];
 function components(above){
  const lookup=new Map(above.map(v=>[v.j*nx+v.i,v])),seen=new Set(),out=[];
  for(const c of above){const key=c.j*nx+c.i;if(seen.has(key))continue;let queue=[c],area=0,sx=0,sy=0;seen.add(key);
   while(queue.length){const v=queue.pop();area+=v.area;sx+=v.x*v.area;sy+=v.y*v.area;
    for(const [i,j]of [[v.i-1,v.j],[v.i+1,v.j],[v.i,v.j-1],[v.i,v.j+1]]){if(i<0||j<0||i>=nx||j>=ny)continue;const k=j*nx+i;if(lookup.has(k)&&!seen.has(k)){seen.add(k);queue.push(lookup.get(k));}}
   }out.push({area,x:sx/area,y:sy/area});
  }return out.sort((a,b)=>b.area-a.area);
 }
 for(const id of p.layers){const valid=cells.filter(c=>c.values[id]),above=valid.filter(c=>c.values[id].change>=limits[id]);const area=above.reduce((s,c)=>s+c.area,0),patches=components(above);
  regions.push({id,valid_area:valid.reduce((s,c)=>s+c.area,0),area:valid.length?area:null,patch_count:valid.length?patches.length:null,largest:patches[0]||null,mean_change:area?above.reduce((s,c)=>s+c.area*c.values[id].change,0)/area:null});
 }
 if(!regions.some(r=>r.valid_area>0))fail('No comparable complete numerical cells are available inside the analysis aperture.');
 const common=cells.filter(c=>p.layers.every(id=>c.values[id]));
 const shared=p.layers.length>=2?common.filter(c=>p.layers.filter(id=>c.values[id].change>=limits[id]).length>=2):[];
 return {pair:p,limits,cells,regions,aperture_area:apertureArea,common_area:common.reduce((s,c)=>s+c.area,0),shared_area:p.layers.length>=2&&common.length?shared.reduce((s,c)=>s+c.area,0):null,shared_patches:components(shared)};
}
function demo(eye='OS',pattern='together'){
 const coords=Array.from({length:61},(_,i)=>+(i*.1-3).toFixed(1));
 const frame={schema:'nkpi-corneal-maps-1',kind:'synthetic',source:'synthetic_fixture',eye,units:{xy:'mm',z:'mm',elevation:'um',thickness:'um',curvature:'D'},coordinate_system:{origin:'corneal_vertex',x_positive:'temporal',y_positive:'superior',z_positive:'anterior'},x_mm:coords,y_mm:coords,comparison:{alignment:'verified_common_grid',registration_id:'synthetic-grid',map_definition_id:'synthetic-tangential'}};
 const centers=pattern==='together'?[[.55,-.7],[.85,-.6],[.65,-1]]:[[-1.2,-.9],[1.3,-.9],[0,1.3]];
 const peaks=eye==='OS'?[1.8,.55,20]:[.45,.12,4];
 const gauss=(x,y,c,s)=>Math.exp(-((x-c[0])**2+(y-c[1])**2)/(2*s*s));
 const make=(visit,future)=>{const d=structuredClone(frame);d.visit=visit;
  for(const [index,l]of LAYERS.entries()){
   const grid=coords.map(y=>coords.map(x=>{if(Math.hypot(x,y)>3.01)return null;const base=l.id==='anterior'?46+6*gauss(x,y,[.6,-.8],1):l.id==='posterior'?-6.5-.8*gauss(x,y,[.6,-.8],1):520-45*gauss(x,y,[.6,-.8],1);const change=(future?1:0)*peaks[index]*gauss(x,y,centers[index],.55);return base+(l.id==='anterior'?change:-change);}));
   if(l.id==='thickness'){d.thickness_um=grid;d.thickness_definition='device_pachymetry';}else d[l.id]={curvature_D:grid,curvature_type:'tangential'};
  }return d;
 };
 return {schema:'nkpi-regional-pair-1',interval_days:180,first:make('first',false),latest:make('latest',true)};
}
function audit(a){return {schema:'nkpi-regional-audit-1',eye:a.pair.first.eye,kind:a.pair.first.kind,interval_days:a.pair.interval_days,method:'Four-corner means on supplied common grid; complete cells within central 6-mm aperture; planar cell areas; four-neighbor patches.',alignment:'Supplied by importer; not independently verified here.',interpretation:'Descriptive display-cutoff crossings only. No repeatability calibration or progression diagnosis.',cone_evolution:numericTracks(a).map(({cells,...t})=>t),cutoffs:a.limits,regions:a.regions,common_area_mm2:a.common_area,shared_area_mm2:a.shared_area};}

// Experimental, descriptive footprint tracking. Both visits use the SAME paired
// mask and the SAME baseline-derived threshold. No clinical event classifier.
function coneTrack(cells,id,{radius=3,image=false}={}){
 const sign=id==='thickness'?-1:1,all=cells.map(c=>({...c,key:c.j+':'+c.i})),valid=all.filter(c=>finite(c.first)&&finite(c.latest));
 const area=xs=>xs.reduce((n,c)=>n+c.area,0),total=area(all),coverage=total?area(valid)/total:0;
 const out={id,radius,image,coverage,available:false};
 if(coverage<.6||valid.length<20)return {...out,reason:'Insufficient paired coverage for a footprint (60% required).'};
 const mean=(xs,k)=>xs.reduce((n,c)=>n+c[k]*c.area,0)/area(xs);
 const median=xs=>{const a=[...xs].sort((a,b)=>a-b);return a[Math.floor(a.length/2)];};
 // Local means suppress printed numbers / pixel outliers; identical neighbor
 // support at both visits. They do not create samples in a missing center cell.
 const sm=[];
 for(const c of valid){if(Math.hypot(c.x,c.y)+.4>radius)continue;
  const zone=all.filter(n=>Math.hypot(n.x-c.x,n.y-c.y)<=.4+1e-8),reads=zone.filter(n=>finite(n.first)&&finite(n.latest));
  if(reads.length<5||area(reads)<.75*area(zone))continue;
  sm.push({...c,f:sign*mean(reads,'first'),l:sign*mean(reads,'latest')});
 }
 if(sm.length<20)return {...out,reason:'Too little local support to define a reproducible footprint.'};
 const ref=median(sm.map(c=>c.f)),peak=Math.max(...sm.map(c=>c.f)),prominence=peak-ref;
 const resolution=image?median(valid.map(c=>c.error||0)):0;
 if(prominence<=Math.max(1e-6,Math.abs(peak)*.002))return {...out,reason:'No distinct localized baseline footprint in the available values.'};
 const threshold=ref+.5*prominence,lookup=new Map(sm.map(c=>[c.key,c]));
 function components(field,level){const eligible=new Map(sm.filter(c=>c[field]>=level).map(c=>[c.key,c])),seen=new Set(),parts=[];
  for(const c of eligible.values()){if(seen.has(c.key))continue;const todo=[c],part=[];seen.add(c.key);while(todo.length){const n=todo.pop();part.push(n);for(const [i,j]of [[n.i-1,n.j],[n.i+1,n.j],[n.i,n.j-1],[n.i,n.j+1]]){const k=j+':'+i;if(eligible.has(k)&&!seen.has(k)){seen.add(k);todo.push(eligible.get(k));}}}parts.push(part);}return parts;
 }
 const bases=components('f',threshold).sort((a,b)=>Math.max(...b.map(c=>c.f))-Math.max(...a.map(c=>c.f))||area(b)-area(a));
 const base=bases[0]||[];if(area(base)<.2)return {...out,reason:'The baseline footprint is smaller than the 0.2 mm² display minimum.'};
 const keys=new Set(base.map(c=>c.key)),laterParts=components('l',threshold),overlap=part=>area(part.filter(c=>keys.has(c.key)));
 laterParts.sort((a,b)=>overlap(b)-overlap(a)||area(b)-area(a));
 // Never silently switch to a disconnected new region: show absence / new
 // area separately if no component intersects the original footprint.
 const later=laterParts[0]&&overlap(laterParts[0])>0?laterParts[0]:[],latestKeys=new Set(later.map(c=>c.key));
 const added=later.filter(c=>!keys.has(c.key)),lost=base.filter(c=>!latestKeys.has(c.key));
 const centroid=xs=>xs.length?{x:mean(xs,'x'),y:mean(xs,'y')}:null,firstCenter=centroid(base),latestCenter=centroid(later);
 const fixed=valid.filter(c=>keys.has(c.key)),surround=valid.filter(c=>!keys.has(c.key)&&base.some(b=>Math.hypot(b.x-c.x,b.y-c.y)<=.6));
 const delta=xs=>xs.length?sign*(mean(xs,'latest')-mean(xs,'first')):null;
 const change=delta(fixed),surroundChange=delta(surround),error=fixed.length?mean(fixed,'error'):null;
 const edge=xs=>xs.some(c=>[[c.i-1,c.j],[c.i+1,c.j],[c.i,c.j-1],[c.i,c.j+1]].some(([i,j])=>!lookup.has(j+':'+i)));
 const step=Math.sqrt(total/all.length),displacement=latestCenter?Math.hypot(firstCenter.x-latestCenter.x,firstCenter.y-latestCenter.y):null;
 const levelChecks=[.4,.6].map(f=>{const lev=ref+f*prominence,aa=components('f',lev).sort((a,b)=>area(b)-area(a))[0]||[],kk=new Set(aa.map(c=>c.key));const bb=components('l',lev).sort((a,b)=>area(b.filter(c=>kk.has(c.key)))-area(a.filter(c=>kk.has(c.key))))[0]||[];return {fraction:f,first_area:area(aa),latest_area:bb.some(c=>kk.has(c.key))?area(bb):0};});
 return {...out,available:true,resolution_limited:image&&prominence<=resolution,threshold:sign*threshold,reference:sign*ref,prominence,resolution,first_area:area(base),latest_area:area(later),added_area:area(added),lost_area:area(lost),new_disconnected_area:area(laterParts.flat().filter(c=>!latestKeys.has(c.key))),change,surround_change:surroundChange,relative_change:finite(surroundChange)?change-surroundChange:null,resolution_error:error,first_center:firstCenter,latest_center:latestCenter,displacement,step,edge_limited:edge(base)||edge(later),level_checks:levelChecks,cells:all.map(c=>({i:c.i,j:c.j,x:c.x,y:c.y,area:c.area,dx:c.dx||Math.sqrt(c.area),dy:c.dy||Math.sqrt(c.area),valid:lookup.has(c.key),first:keys.has(c.key),latest:latestKeys.has(c.key)}))};
}
function imageTracks(a){return a.layers.map(l=>coneTrack(a.cells.map(c=>{const v=c.values[l.id];return {i:c.i,j:c.j,x:(c.i-20)*l.radius_mm/20,y:(c.j-20)*l.radius_mm/20,area:(l.radius_mm/20)**2,dx:l.radius_mm/20,dy:l.radius_mm/20,first:v?.first,latest:v?.latest,error:v?Math.max(Math.abs(v.value-v.lo),Math.abs(v.hi-v.value)):0};}),l.id,{radius:l.radius_mm,image:true}));}
function numericTracks(a){const cs=a.pair.first.coordinate_system,mx=(cs.x_positive==='temporal'?1:-1)*(a.pair.first.eye==='OD'?-1:1),my=cs.y_positive==='superior'?-1:1;return a.pair.layers.map(id=>coneTrack(a.cells.map(c=>({i:c.i,j:c.j,x:c.x*mx,y:c.y*my,area:c.area,dx:a.pair.first.x_mm[c.i+1]-a.pair.first.x_mm[c.i],dy:a.pair.first.y_mm[c.j+1]-a.pair.first.y_mm[c.j],first:id==='posterior'?Math.abs(c.values[id]?.first??NaN):c.values[id]?.first,latest:id==='posterior'?Math.abs(c.values[id]?.latest??NaN):c.values[id]?.latest,error:0})),id));}
function paintCone(canvas,t,eye='OS'){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,cx=w/2,cy=h/2,r=Math.min(w,h)*.38,k=r/t.radius;
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#f0edf5';ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
 const cells=t.cells||[],lookup=new Map(cells.map(c=>[c.j+':'+c.i,c]));
 ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();
 for(const c of cells){const q=(c.dx||Math.sqrt(c.area))*k,qy=(c.dy||Math.sqrt(c.area))*k,x=cx+c.x*k,y=cy+c.y*k;ctx.fillStyle=c.first&&c.latest?'#a18bbd':c.latest?'#624085':c.first?'#c9e4df':'#f0edf5';ctx.fillRect(x-q/2,y-qy/2,q+.25,qy+.25);if(!c.valid){ctx.strokeStyle='#c8c2cf';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-q/2,y+qy/2);ctx.lineTo(x+q/2,y-qy/2);ctx.stroke();}}
 // Outlines are shown on a common grid; boundaries by physical cell position
 // avoid assuming increasing screen-y for native coordinate arrays.
 for(const [field,color,dash]of [['first','#207a73',[5,3]],['latest','#503270',[]]]){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(dash);for(const c of cells.filter(c=>c[field])){const q=(c.dx||Math.sqrt(c.area))*k,qy=(c.dy||Math.sqrt(c.area))*k,x=cx+c.x*k,y=cy+c.y*k;for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const near=cells.find(n=>Math.abs(n.x-c.x-dx*((c.dx||Math.sqrt(c.area))+(n.dx||Math.sqrt(n.area)))/2)<1e-6&&Math.abs(n.y-c.y-dy*((c.dy||Math.sqrt(c.area))+(n.dy||Math.sqrt(n.area)))/2)<1e-6);if(near?.[field])continue;ctx.beginPath();if(dx){ctx.moveTo(x+dx*q/2,y-qy/2);ctx.lineTo(x+dx*q/2,y+qy/2);}else{ctx.moveTo(x-q/2,y+dy*qy/2);ctx.lineTo(x+q/2,y+dy*qy/2);}ctx.stroke();}}}ctx.restore();ctx.setLineDash([]);
 ctx.strokeStyle='#d1cadb';ctx.lineWidth=1;for(const rr of [r/3,r*2/3,r]){ctx.beginPath();ctx.arc(cx,cy,rr,0,Math.PI*2);ctx.stroke();}
 if(t.first_center&&t.latest_center){const a=t.first_center,b=t.latest_center;ctx.strokeStyle='#3a2a4b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx+a.x*k,cy+a.y*k);ctx.lineTo(cx+b.x*k,cy+b.y*k);ctx.stroke();for(const [p,fill]of [[a,'#fff'],[b,'#503270']]){ctx.fillStyle=fill;ctx.beginPath();ctx.arc(cx+p.x*k,cy+p.y*k,4,0,Math.PI*2);ctx.fill();ctx.stroke();}}
 ctx.fillStyle='#63596d';ctx.textAlign='center';ctx.font=Math.round(w*.035)+'px system-ui';ctx.fillText('Superior',cx,h*.06);ctx.fillText('Inferior',cx,h*.96);ctx.fillText(eye==='OD'?'T':'N',w*.045,cy);ctx.fillText(eye==='OD'?'N':'T',w*.955,cy);
}
function coneHTML(tracks,interval,eye,selectedId='anterior'){
 const t=tracks.find(t=>t.id===selectedId)||tracks[0];if(!t)return '';
 const l=LAYERS.find(l=>l.id===t.id),f=(v,d=1)=>finite(v)?v.toFixed(d):'—',sg=(v,d=1)=>finite(v)?(v>0?'+':'')+v.toFixed(d):'—',d=t.id==='thickness'?0:1;
 const text=t.available?[(t.image?'Image-derived':'Numerical')+' footprint',t.edge_limited?'partial at missing data / analysis edge':'descriptive comparison',t.resolution_limited?'boundary uncertain at printed resolution':''].filter(Boolean).join(' · '):t.reason;
 return '<details class="rg-details rg-cone"><summary><b>Cone evolution tracker</b><span class="rg-small"> · Footprint, local change &amp; location</span></summary><div class="rg-title-row"><div><h3>How the region changed</h3><p>'+esc(eye)+' · '+interval+' days between scans</p></div><label>Track <select id="rg-cone-layer">'+tracks.map(v=>'<option value="'+v.id+'"'+(v===t?' selected':'')+'>'+LAYERS.find(l=>l.id===v.id).name+'</option>').join('')+'</select></label></div><p class="rg-small">'+esc(text)+'</p>'+(t.available?'<div class="rg-cone-grid"><div><canvas data-cone-map="'+t.id+'" width="460" height="460" role="img" aria-label="Earlier and latest corneal footprints"></canvas><div class="rg-legend"><span><i style="background:#c9e4df"></i>Earlier only</span><span><i style="background:#a18bbd"></i>Both</span><span><i style="background:#624085"></i>Latest only</span></div></div><div class="rg-cone-metrics"><div><span>Estimated sampled footprint</span><strong>'+f(t.first_area)+' → '+f(t.latest_area)+' <small>mm²</small></strong><p>'+sg(t.latest_area-t.first_area)+' mm² net · same threshold and paired mask</p></div><div><span>Inside the earlier footprint</span><strong>'+f(Math.abs(t.change),d)+' <small>'+l.unit+' '+(Math.abs(t.change)<1e-8?'change':t.id==='thickness'?(t.change>0?'thinning':'thickening'):(t.change>0?'steepening':'flattening'))+'</small></strong><p>'+sg(t.relative_change,d)+' '+l.unit+' relative to the surrounding band'+(t.image&&Math.abs(t.change)<=t.resolution_error?' · below color-bin resolution':'')+'</p></div><div><span>Footprint center shift</span><strong>'+f(t.displacement)+' <small>mm</small></strong><p>'+(t.displacement===null?'No overlapping latest footprint':t.displacement<t.step?'Less than one grid step':'Distribution shift; review scan alignment')+'</p></div></div></div><details class="rg-details"><summary>Definition &amp; comparison details</summary><p>This experimental footprint is the connected steep / thin region above half the baseline prominence: midway between the baseline median and strongest 0.8-mm local mean. The same absolute level ('+f(t.threshold,d)+' '+l.unit+') and readable mask are used at both visits. A latest region must overlap the earlier footprint; a separate region is not silently substituted.</p><p>When the printed scale is too coarse, the point-estimate footprint is still shown as resolution-limited; its boundary is not resolved by the source. Area describes sampled support, not a validated cone boundary. Purple shows newly included samples; teal shows samples no longer included. Neither implies tissue appearing or disappearing. The fixed-region change uses the earlier footprint. The surrounding band extends 0.6 mm beyond it. Center shift is not tissue migration.</p><p>Newly included '+f(t.added_area)+' mm²; no longer included '+f(t.lost_area)+' mm²; separate latest regions '+f(t.new_disconnected_area)+' mm². Supported paired area '+Math.round(t.coverage*100)+'%. Threshold sensitivity (40% / 60% prominence): '+t.level_checks.map(q=>f(q.first_area)+' → '+f(q.latest_area)+' mm²').join(' / ')+'. These are processing checks, not confidence limits.</p><p>Local means require 75% paired support. The 60% whole-map coverage and 0.2 mm² footprint minimum are display rules, not clinical thresholds. Image comparisons inherit color resolution, recovery and print alignment limitations. Native pairs inherit the supplied registration. Scan repeatability is not calibrated. This tracker does not diagnose progression or alter NKPI.</p></details>':'')+'</details>';
}

const api={coneTrack,imageTracks,numericTracks,paintCone,coneHTML,LAYERS,DEFAULTS,validatePair,analyze,demo,audit};if(node){module.exports=api;return;}
root.NKPIRegionalMath=api;

// DOM controller: simulated and imported maps never overwrite calculator inputs.
const el=root.document.getElementById('regional-root');if(!el)return;
let context={cases:{},results:{},sourceDirty:false},reports=[],mode='patient',eye='OS',pattern='together',layer='combined',limits={...DEFAULTS},loaded=null,loadError='',active=null,selected=null,epoch=0;
let imageActive=null,imageLayer="combined",coneLayer="anterior",coneTracks=[];
const bindings={};
const inputKey=c=>root.NKPI.stable(root.NKPI.canonical(c));
const reportKey=e=>JSON.stringify(reports.filter(s=>s.eye===e).map(s=>[s.visit,s.source_id]).sort());
const pageSelections={};let disposeShape=null;
function boundShapeSets(){const c=context.cases[eye];if(mode!=='patient'||context.sourceDirty||!c?.enabled||!context.results[eye]||!bindings[eye]||bindings[eye].inputs!==inputKey(c)||bindings[eye].reports!==reportKey(eye))return [];return reports.filter(r=>r.eye===eye);}

const format=(v,d=2)=>finite(v)?v.toFixed(d):'—';
const signed=(v,d=2)=>finite(v)?(v<0?'−':v>0?'+':'')+Math.abs(v).toFixed(d):'—';
function pairFromReports(){
 const c=context.cases[eye],r=context.results[eye];
 if(context.sourceDirty||!c?.enabled||!r||r.case.mode!=='longitudinal')return null;
 const first=reports.find(s=>s.eye===eye&&s.visit==='first')?.surface,latest=reports.find(s=>s.eye===eye&&s.visit==='latest')?.surface;
 if(!first||!latest)return null;
 if(!bindings[eye]||bindings[eye].inputs!==inputKey(c)||bindings[eye].reports!==reportKey(eye))throw new Error('The numerical maps are not bound to this input snapshot. Reimport the selected report pair after editing measurements.');
 // Synthetic fixtures in a report archive never acquire patient status.
 if(first.kind!=='measured'||latest.kind!=='measured')throw new Error('Synthetic numerical fixtures are not patient maps. Use the demo tab.');
 return {schema:'nkpi-regional-pair-1',interval_days:r.case.interval_days,first,latest};
}
function imagePairFromReports(){
 const c=context.cases[eye],r=context.results[eye];if(context.sourceDirty||!c?.enabled||!r||r.case.mode!=='longitudinal')return null;
 const a=reports.find(s=>s.eye===eye&&s.visit==='first'),b=reports.find(s=>s.eye===eye&&s.visit==='latest');if(!a?.image_maps?.length||!b?.image_maps?.length)return null;
 if(!bindings[eye]||bindings[eye].inputs!==inputKey(c)||bindings[eye].reports!==reportKey(eye))throw Error('Reimport the selected source reports after changing measurements to reconnect the image comparison.');
 const result=root.NKPIImageRegions.compare(a.image_maps,b.image_maps);enrichImageComparison(result,a.image_maps,b.image_maps);result.interval=r.case.interval_days;return result;
}

function enrichImageComparison(a,first,last){
 const I=root.NKPIImageRegions;
 const variants=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>last.map(m=>({...m,grid:m.grid.map((row,j)=>row.map((v,i)=>m.grid[j+dy]?.[i+dx]??null))})));
 // Quantization endpoints are image-resolution scenarios, not confidence limits.
 for(const end of ['lo','hi'])variants.push(last.map(m=>({...m,grid:m.grid.map(row=>row.map(v=>v?{...v,value:v[end]}:null))})));
 const results=variants.map(v=>{try{return I.compare(first,v);}catch(_){return null;}});
 for(const s of a.summaries){
  const cells=a.cells.filter(c=>c.values[s.id]);const max=Math.max(...cells.map(c=>c.values[s.id].first));
  const base=cells.map(c=>{const v=c.values[s.id].first,value=s.id==='thickness'?max-v:v;return {...c,values:{[s.id]:{value,lo:value,hi:value}}};});
  const marker=I.localPeak(base,s.id,s.radius_mm);s.baseline=marker;
  if(marker){const zone=cells.filter(c=>Math.hypot((c.i-20)*s.radius_mm/20-marker.x_mm,(c.j-20)*s.radius_mm/20-marker.y_mm)<=.4);const possible=a.cells.filter(c=>Math.hypot((c.i-20)*s.radius_mm/20-marker.x_mm,(c.j-20)*s.radius_mm/20-marker.y_mm)<=.4).length;
   s.fixed_region=zone.length>=possible*.85&&zone.length>=5?{mean:zone.reduce((sum,c)=>sum+c.values[s.id].value,0)/zone.length,first:zone.reduce((sum,c)=>sum+c.values[s.id].first,0)/zone.length,latest:zone.reduce((sum,c)=>sum+c.values[s.id].latest,0)/zone.length}:null;
  }
  const tests=results.map(r=>r?.summaries.find(q=>q.id===s.id)?.peak||null);
  s.location_checks={same:s.peak?tests.filter(p=>p&&Math.hypot(p.x_mm-s.peak.x_mm,p.y_mm-s.peak.y_mm)<=.8).length:0,total:tests.length};
 }
 const peaks=a.summaries.filter(s=>s.peak&&s.peak.lo>0);let together=0;
 for(const s of peaks)together=Math.max(together,peaks.filter(t=>Math.hypot(s.peak.x_mm-t.peak.x_mm,s.peak.y_mm-t.peak.y_mm)<=.8).length);
 a.pattern=together>=2?together+' maps have resolved hotspots near the same region (within 0.8 mm of one hotspot).':peaks.length>=2?'The resolved hotspots occur in different regions.':'The reports do not resolve a shared hotspot across two maps.';
}

function percent(v){return Number.isFinite(v)?(v>0&&v<.01?'&lt;1':Math.round(v*100))+'%':'—';}
function imageLocation(p){if(!p)return 'No resolved region';const h=Math.abs(p.x)<.09?'central':(p.x>0)===(eye==='OS')?'temporal':'nasal',v=Math.abs(p.y)<.09?'central':p.y>0?'inferior':'superior';return h==='central'&&v==='central'?'Central':v==='central'?h:h==='central'?v:v+' '+h;}
function imagePanel(a){
 const cards=Object.keys(root.NKPIImageRegions.names).map(id=>{
  const s=a.summaries.find(v=>v.id===id),name=root.NKPIImageRegions.names[id];
  if(!s)return '<article class="rg-map-card rg-image-card"><h4>'+name+'</h4><div class="rg-map-unavailable"><span>Map unavailable</span><p>'+esc(a.unavailable.find(v=>v.id===id)?.reason||'A readable source is needed at both visits.')+'</p></div></article>';
  const peak=s.peak,d=id==='thickness'?0:1;
  return '<article class="rg-map-card rg-image-card"><div class="rg-card-heading"><h4>'+name+'</h4><span>'+percent(s.coverage)+' sampled</span></div>'+imageCanvas(id,600)+
   '<div class="rg-map-scale"><span>0</span><i></i><span>≥ ~'+format(s.color_max,d)+' '+s.unit+'</span></div>'+
   '<p class="rg-small rg-coverage">'+percent(s.directCoverage)+' direct · '+percent(s.recoveredCoverage)+' locally recovered</p>'+
   '<p class="rg-peak-label">'+(peak?'Strongest local '+(id==='thickness'?'thinning':'steepening'):'No distinct positive hotspot')+'</p>'+
   '<div class="rg-peak-result">'+(peak?esc(imageLocation(peak)):'—')+'</div>'+
   '<p class="rg-small">'+(peak?'Circle mean ~'+signed(peak.mean,d)+' '+s.unit+' · 0.8-mm diameter'+(peak.lo<=0?'<br>Below the printed scale’s resolving limit.':'<br>Exceeds overlapping color-bin bounds.'):s.mean>0?'Change is diffuse or a well-supported local peak cannot be located.':'No supported local increase in this comparison.')+'</p>'+ (s.fixed_region?'<div class="rg-baseline-note"><b>At the baseline '+(id==='thickness'?'thinnest':'steepest')+' region</b><span>'+signed(s.fixed_region.mean,d)+' '+s.unit+' since the earlier scan</span></div>':'')+'<p class="rg-small">'+(peak?'Hotspot stays within 0.8 mm in '+s.location_checks.same+'/'+s.location_checks.total+' sensitivity checks.':'')+'</p></article>';
 }).join('');
 return '<div class="rg-title-row"><div><span class="rg-tag">PATIENT REPORTS · EXPERIMENTAL IMAGE ESTIMATE</span><h3>'+eye+' · Where change is concentrated</h3><p>Earlier → latest · '+a.interval+' days · '+a.layers.length+' of 3 maps available</p></div><div class="rg-actions"><button type="button" data-rg-download="image-figure">Save map figure</button><button type="button" data-rg-download="image-audit">Download audit</button></div></div>'+
 '<p class="rg-pattern">'+esc(a.pattern)+'</p><p class="rg-image-intro">Purple shows estimated steepening or thinning. The small circle marks the strongest local average, when a distinct hotspot can be located.</p><div class="rg-three-maps">'+cards+'</div>'+
 '<div class="rg-legend rg-image-key"><span><i style="background:#744f9f"></i>Darker = larger estimated change within that map</span><span><i style="background:#eeebf2"></i>Zero or opposite direction</span><span><i class="rg-hatch-key"></i>Unreadable</span><span>Dashed teal circle = baseline steepest / thinnest region</span></div>'+
 '<p class="rg-small">Color scales differ between maps. Circles locate relative peaks; they are not progression thresholds. These image estimates do not change NKPI.</p><div id="rg-image-pick" class="rg-pick" aria-live="polite">Select a map location to inspect the estimated values.</div>'+
 '<details class="rg-details"><summary>Shared change across maps</summary><div class="rg-grid"><div class="rg-map-card"><label class="rg-select-label">Map view<select id="rg-image-layer">'+[['combined','Shared change'],...a.layers.map(l=>[l.id,root.NKPIImageRegions.names[l.id]])].map(([v,n])=>'<option value="'+v+'"'+(imageLayer===v?' selected':'')+'>'+n+'</option>').join('')+'</select></label>'+imageCanvas(imageLayer,600)+
 '<div class="rg-legend">'+(imageLayer==='combined'?'<span><i style="background:#d9cced"></i>1 map</span><span><i style="background:#a38bc8"></i>2 maps</span><span><i style="background:#67428e"></i>3 maps</span>':'<span><i style="background:#744f9f"></i>Estimated steepening / thinning</span>')+'</div></div><div class="rg-stat"><span>Shared color-scale shifts · 2+ maps</span><strong>'+percent(a.sharedFraction)+'</strong><p>'+(a.sharedFraction===null?(!a.sharedGeometry?'Map diameters differ across layers; an overlap is not calculated.':'At least two maps and 35% common readable coverage are required.'):'Of the common readable region shifts beyond overlapping color bins in at least two maps.')+'</p><p class="rg-small">'+percent(a.commonCoverage)+' common coverage. This stricter view may show less change than the three estimated maps.</p></div></div></details>'+
 '<details class="rg-details"><summary>Method, coverage &amp; source checks</summary><p>Each printed legend is read locally and calibrated separately. Curvature is expressed in D (anterior 337.5/r and posterior magnitude 40/r when the source uses mm radius); thickness is in µm. Change is latest minus earlier for curvature magnitude and earlier minus latest for thickness. Text and contour pixels are excluded. Narrow occlusions may be recovered from matching visible colors within 3% of the printed plot radius, with balanced support around the sample. These locally recovered samples are counted separately; no neighboring grid value is copied into a blank. Large, one-sided or inconsistent gaps remain missing.</p><p>Maps are aligned by their printed plotting circles, without warping the cone. Each map uses its central two-thirds radius. Different diameters between visits are rejected; different diameters across map types disable overlap. This is display alignment, not verified anatomical registration.</p><p>The dashed teal marker is the baseline’s steepest (curvature) or thinnest (thickness) 0.8-mm region, located using readable paired samples. Its mean change is measured at the same coordinates, without chasing a new peak. A location check shifts the latest map by one sampling cell in each of four directions and separately uses each latest color-bin endpoint (six checks); it counts peaks within 0.8 mm of the original. This tests only those processing assumptions, not scan repeatability.</p><p>The circle is the highest mean estimated change in a fully contained 0.8-mm-diameter window with at least 85% readable samples. Zero, opposite-only and nearly uniform maps receive no hotspot. Color-bin bounds describe image resolution; they are not confidence intervals or limits of scan repeatability.</p><p>Percentages describe sampled readable areas, not exact tissue areas. Scan noise, image compression, alignment and color resolution can affect the result. No clinical progression diagnosis or forecast is inferred.</p><p>Scan quality: '+esc(context.results[eye]?.case.scan_quality?.first||'unknown')+' / '+esc(context.results[eye]?.case.scan_quality?.latest||'unknown')+'. Check the original reports below if the pattern is unexpected.</p></details>'+imageIssues();
}
function imageCanvas(id,size){return '<canvas data-rg-image-map="'+id+'" width="'+size+'" height="'+size+'" role="img" aria-label="'+esc(id==='combined'?'Shared color-scale changes':root.NKPIImageRegions.names[id]+' estimated change and strongest local concentration')+'"></canvas>';}
function imageIssues(){const list=reports.filter(s=>s.eye===eye).flatMap(s=>(s.image_issues||[]).map(v=>(s.visit==='first'?'Earlier':'Latest')+' '+(root.NKPIImageRegions?.names[v.id]||'map')+': '+v.message));return list.length?'<details class="rg-details"><summary>Map reading details</summary><ul>'+list.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul></details>':'';}
function imageShade(value,max){if(value<=0||max<=0)return '#eeebf2';const t=Math.min(1,value/max),lo=[237,230,245],hi=[98,59,145];return 'rgb('+lo.map((v,k)=>Math.round(v+(hi[k]-v)*t)).join(',')+')';}
function paintImageMap(c,a,id){
 const x=c.getContext('2d'),s=a.summaries.find(s=>s.id===id),shared=id==='combined',geometry=!shared||a.sharedGeometry;
 x.clearRect(0,0,600,600);x.fillStyle='#eeebf2';x.beginPath();x.arc(300,300,234,0,Math.PI*2);x.fill();
 x.save();x.beginPath();x.arc(300,300,234,0,Math.PI*2);x.clip();
 for(const cell of a.cells){
  const valid=geometry&&(shared?a.layers.every(l=>cell.values[l.id]):!!cell.values[id]);let color='#eeebf2';
  if(valid){if(shared){const n=a.layers.filter(l=>cell.values[l.id].lo>1e-6).length;color=['#eeebf2','#d9cced','#a38bc8','#67428e'][n];}else color=imageShade(cell.values[id].value,s.color_max);}
  const px=300+(cell.i-20)*11.7,py=300+(cell.j-20)*11.7;x.fillStyle=color;x.fillRect(px-5.9,py-5.9,11.9,11.9);
  if(!valid){x.strokeStyle='#b8b0c2';x.lineWidth=1;x.beginPath();x.moveTo(px-5,py+5);x.lineTo(px+5,py-5);x.stroke();}
 }
 x.restore();x.strokeStyle='#c9c1d4';x.lineWidth=1;x.setLineDash([4,5]);
 for(const r of [78,156,234]){x.beginPath();x.arc(300,300,r,0,Math.PI*2);x.stroke();}
 x.beginPath();x.moveTo(66,300);x.lineTo(534,300);x.moveTo(300,66);x.lineTo(300,534);x.stroke();x.setLineDash([]);
 if(s?.baseline){const p=s.baseline;x.strokeStyle='#247d76';x.lineWidth=2.5;x.setLineDash([7,5]);x.beginPath();x.arc(300+p.x*351,300+p.y*351,.4/s.radius_mm*234,0,Math.PI*2);x.stroke();x.setLineDash([]);}
 if(s?.peak){const p=s.peak,px=300+p.x*351,py=300+p.y*351,r=p.radius_mm/s.radius_mm*234;x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.lineWidth=7;x.strokeStyle='white';x.stroke();x.lineWidth=3;x.strokeStyle='#332241';x.stroke();}
 x.fillStyle='#64566e';x.font='19px system-ui';x.textAlign='center';x.fillText('Superior',300,38);x.fillText('Inferior',300,580);x.fillText(eye==='OD'?'T':'N',34,306);x.fillText(eye==='OD'?'N':'T',566,306);x.font='16px system-ui';
 const radius=shared?a.layers[0]?.radius_mm:s?.radius_mm;x.fillText(geometry?'Central '+format(radius*2,1)+' mm':'Overlap unavailable: different map diameters',300,552);
}
function drawImageMap(){if(!imageActive)return;el.querySelectorAll('[data-rg-image-map]').forEach(c=>paintImageMap(c,imageActive,c.dataset.rgImageMap));}
function saveImageFigure(){
 if(!imageActive)return;const a=imageActive,c=document.createElement('canvas');c.width=1800;c.height=980;const x=c.getContext('2d');
 x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='#332241';x.font='bold 34px system-ui';x.fillText('NKPI | '+eye+' · Regional change',50,65);x.font='22px system-ui';x.fillText('Earlier → latest · '+a.interval+' days · experimental report-image estimates',50,105);
 Object.keys(root.NKPIImageRegions.names).forEach((id,k)=>{const s=a.summaries.find(s=>s.id===id),left=k*600;x.fillStyle='#332241';x.font='bold 26px system-ui';x.fillText(root.NKPIImageRegions.names[id],left+50,170);if(s){const map=document.createElement('canvas');map.width=map.height=600;paintImageMap(map,a,id);x.drawImage(map,left,180);x.font='22px system-ui';x.fillText(s.peak?imageLocation(s.peak):'No distinct positive hotspot',left+50,805);x.font='18px system-ui';x.fillText(s.peak?'Circle mean ~'+signed(s.peak.mean,id==='thickness'?0:1)+' '+s.unit+' · 0.8-mm diameter':'',left+50,839);x.fillText(Math.round(s.coverage*100)+'% sampled · '+Math.round(s.recoveredCoverage*100)+'% locally recovered',left+50,870);x.fillText('Darkest at ≥ ~'+format(s.color_max,id==='thickness'?0:1)+' '+s.unit,left+50,895);}else{x.font='23px system-ui';x.fillText('Map unavailable',left+50,450);}});
 x.font='20px system-ui';x.fillStyle='#72667f';x.fillText('Purple: estimated steepening / thinning. Hatched: unreadable. Solid circle: change hotspot. Teal dashed: baseline region.',50,925);x.fillText('Separate color scales. Image resolution and scan alignment limit interpretation; not a progression diagnosis.',50,955);
 const link=document.createElement('a');link.download='NKPI_'+eye+'_regional_change.png';link.href=c.toDataURL('image/png');link.click();
}

function controls(){return '<div class="rg-toolbar"><div class="rg-tabs" role="group" aria-label="Regional data source">'+[['patient','Current case'],['demo','Explore demo'],['numeric','Numerical pair']].map(([v,n])=>'<button type="button" data-rg-mode="'+v+'" aria-pressed="'+(mode===v)+'">'+n+'</button>').join('')+'</div><div class="rg-eyes" role="group" aria-label="Regional eye">'+['OD','OS'].map(v=>'<button type="button" data-rg-eye="'+v+'" aria-pressed="'+(eye===v)+'">'+v+' · '+(v==='OD'?'Right':'Left')+'</button>').join('')+'</div></div>';}
function coordinate(c,p){if(!c)return 'No region at these cutoffs';const cs=p.first.coordinate_system;const horizontal=Math.abs(c.x)<.05?'near center':Math.abs(c.x).toFixed(2)+' mm '+(c.x>0?cs.x_positive:cs.x_positive==='temporal'?'nasal':'temporal');const vertical=Math.abs(c.y)<.05?'near center':Math.abs(c.y).toFixed(2)+' mm '+(c.y>0?cs.y_positive:cs.y_positive==='superior'?'inferior':'superior');return horizontal+' / '+vertical;}
function tableForCase(){const r=context.results[eye];if(!r||context.sourceDirty||!context.cases[eye]?.enabled)return '';const c=r.case,paired=c.mode==='longitudinal';return '<details class="rg-details"><summary>Measured values for this eye</summary><div class="rg-table-wrap"><table><thead><tr><th>Measurement</th><th>First / only</th>'+(paired?'<th>Latest</th><th>Change</th>':'')+'</tr></thead><tbody>'+root.NKPI.features.map(f=>'<tr><th>'+esc(f.label)+'</th><td>'+format(c.first[f.key],f.decimals)+' '+esc(f.unit)+'</td>'+(paired?'<td>'+format(c.latest[f.key],f.decimals)+'</td><td>'+signed(c.latest[f.key]-c.first[f.key],f.decimals)+'</td>':'')+'</tr>').join('')+'</tbody></table></div><p>These summary measurements do not specify a spatial map.'+(paired?' Observed over '+c.interval_days+' days.':' One visit cannot establish change.')+'</p></details>';}
function sourceReports(){const sets=reports.filter(s=>s.eye===eye);if(!sets.length)return '';return '<div class="rg-report-grid">'+sets.map(s=>{const k=s.eye+':'+s.visit,p=s.pages.find(p=>p.id===pageSelections[k])||s.pages.find(p=>p.kind==='topometric')||s.pages[0];return '<article class="rg-report"><label>'+ (s.visit==='first'?'First / only scan':'Latest scan')+'<select data-rg-page="'+k+'" aria-label="'+eye+' '+s.visit+' source page">'+s.pages.map(q=>'<option value="'+esc(q.id)+'"'+(q.id===p.id?' selected':'')+'>'+esc(q.label)+'</option>').join('')+'</select></label><a href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer" title="Open original report"><img src="'+esc(p.url)+'" alt="'+eye+' '+s.visit+' original report" loading="lazy"></a><small>Original report image · select to enlarge</small></article>';}).join('')+'</div>';}
function emptyPatient(message){const c=context.cases[eye],r=context.results[eye],single=r?.case.mode==='baseline';return '<div class="rg-empty"><span class="rg-tag">'+eye+' · CURRENT CASE</span><h3>'+(single?'One scan shows shape; change needs two visits':'Regional comparison of your reports')+'</h3><p>'+esc(message||'Import both visits and calculate NKPI to compare the readable maps in your original report images.')+'</p><p class="rg-small">The reader supports Topometric/KC-Staging curvature and Belin/Ambrósio thickness maps. Each available map is checked separately.</p><button type="button" data-rg-mode="demo" class="rg-primary">Explore the working demo →</button></div>'+imageIssues()+sourceReports()+tableForCase();}
function dataPanel(a){const p=a.pair,synthetic=p.first.kind==='synthetic';return '<div class="rg-banner"><span class="rg-tag">'+(synthetic?'SIMULATED MAPS':mode==='numeric'?'SEPARATE NUMERICAL PAIR':'IMPORTED NUMERICAL MAPS')+'</span><p>'+(synthetic?'Fictional '+eye+' scans · independent of the patient values above':mode==='numeric'?'This research import is not linked to the current NKPI case.':'Explicitly linked to the selected report pair. Alignment is declared by the data supplier.')+'</p></div>'+
 (mode==='patient'?'<p class="rg-small">Scan quality: '+esc(context.results[eye]?.case.scan_quality.first||'unknown')+' / '+esc(context.results[eye]?.case.scan_quality.latest||'unknown')+'. Numerical parsing does not verify scan quality.</p>':'')+
 '<div class="rg-title-row"><div><h3>'+eye+' · Regional corneal change</h3><p>Earlier → latest · '+p.interval_days+' days · central 6 mm</p></div><button type="button" data-rg-download="audit">Download map audit</button></div>'+
 (mode==='demo'?'<div class="rg-demo-controls"><span>Same peak changes, different locations</span><div class="rg-tabs"><button type="button" data-rg-pattern="together" aria-pressed="'+(pattern==='together')+'">Changes nearby</button><button type="button" data-rg-pattern="apart" aria-pressed="'+(pattern==='apart')+'">Changes apart</button></div></div>':'')+
 '<div class="rg-grid"><div class="rg-map-card"><label class="rg-select-label">Map view<select id="rg-layer">'+[['combined','Shared change'],...p.layers.map(id=>[id,LAYERS.find(l=>l.id===id).name])].map(([v,n])=>'<option value="'+v+'"'+(layer===v?' selected':'')+'>'+n+'</option>').join('')+'</select></label><canvas id="rg-map" width="600" height="600" role="img" aria-label="Corneal change map; exact regional measurements in the adjacent table. Click a region to inspect values."></canvas><div class="rg-legend">'+(layer==='combined'?'<span><i style="background:#d9cced"></i>1 map</span><span><i style="background:#a38bc8"></i>2 maps</span><span><i style="background:#67428e"></i>3 maps</span>':'<span><i style="background:#cfddd8"></i>Opposite direction</span><span><i style="background:#ede9f2"></i>Below cutoff</span><span><i style="background:#67428e"></i>At/above cutoff</span>')+'</div><p class="rg-small">Gray: no qualifying change · hatched: incomplete data.<br>Display cutoffs describe this view; they are not clinical progression thresholds.</p><div id="rg-pick" class="rg-pick" aria-live="polite">Select a map cell to inspect its values.</div></div>'+
 '<div class="rg-results"><div class="rg-stat"><span>Shared area · 2+ available layers</span><strong data-rg-shared>'+format(a.shared_area)+' <small>mm²</small></strong><p>Area at or above the current cutoffs. Overlap does not establish progression; true changes can be offset.</p></div>'+a.regions.map(r=>{const l=LAYERS.find(l=>l.id===r.id);return '<article class="rg-region"><div><h4>'+l.name+'</h4><b>'+format(r.area)+' mm²</b></div><p>'+l.direction+' ≥ '+format(a.limits[r.id],l.decimals)+' '+l.unit+'</p><dl><div><dt>Mean change in highlighted area</dt><dd>'+format(r.mean_change,l.decimals)+' '+l.unit+'</dd></div><div><dt>Largest connected region</dt><dd>'+format(r.valid_area>0?(r.largest?.area||0):null)+' mm²</dd></div></dl><small>'+esc(coordinate(r.largest,p))+'</small></article>';}).join('')+'</div></div>'+
 '<details class="rg-details"><summary>Display cutoffs &amp; calculation</summary><p>Adjust the map display only. The defaults (1 D anterior, 0.25 D posterior, 10 µm thinning) are illustrative engineering settings, not literature-derived limits for progression.</p><div class="rg-cutoffs">'+LAYERS.map(l=>'<label>'+l.name+' ('+l.unit+')<input type="number" data-rg-cutoff="'+l.id+'" value="'+limits[l.id]+'" min="'+(l.id==='thickness'?1:.01)+'" max="'+(l.id==='thickness'?200:20)+'" step="'+(l.id==='thickness'?1:.01)+'"></label>').join('')+'</div><p>Curvature: '+p.layers.filter(id=>id!=='thickness').map(id=>id+' '+p.first[id].curvature_type).join('; ')+'. Posterior change uses |latest curvature| − |earlier curvature| with a consistent sign convention. This is not the B / PRC 3-mm radius.</p><p>Four corner values are averaged within each complete grid cell. Area is its planar x–y footprint. Only full cells inside the central 6-mm aperture are used. Shared area requires data in every available layer. Connected regions share an edge; tiny regions are not removed.</p><p>Common numerical coverage: '+format(a.common_area)+' mm²; full grid cells in aperture: '+format(a.aperture_area)+' mm². Missing data are never filled with zero. Near-border changes may be outside this analysis.</p><p>No local scan-noise limits, spatial significance test, biomechanical inference, registration algorithm or validated progression diagnosis is included. Repeat scans and independent outcome validation are needed before clinical interpretation.</p><p>Largest-region centers: '+a.regions.filter(r=>r.largest).map(r=>esc(LAYERS.find(l=>l.id===r.id).name)+': '+esc(coordinate(r.largest,p))).join('; ')+'. Centers from different map types need not coincide.</p></details>';
}
function numericalTools(){return '<div class="rg-import"><h3>Analyze a numerical map pair</h3><p>Load a de-identified pair in the documented NKPI numerical format. Standard Pentacam JPEG ZIPs are not numerical exports. This separate import does not change or authenticate the NKPI case.</p><div class="rg-actions"><label class="rg-file">Choose numerical pair<input id="rg-file" type="file" accept=".json,application/json"></label><button type="button" data-rg-download="example">Download synthetic example JSON</button>'+(loaded?'<button type="button" data-rg-clear-import>Clear pair</button>':'')+'</div><p class="rg-small">Processed locally in this browser. See docs/REGIONAL_CHANGE.md for the conversion contract. No identifiers or dates are required.</p><p id="rg-load-status" role="status">'+esc(loadError)+'</p></div>';}
function render(){
 if(disposeShape){disposeShape();disposeShape=null;}
 const openDetails=new Set([...el.querySelectorAll('details[open]')].map(d=>d.querySelector('summary')?.textContent));
 active=null;imageActive=null;const shapeSets=boundShapeSets();let content='',pair=null;
 try{pair=mode==='demo'?demo(eye,pattern):mode==='numeric'?(loaded?.first.eye===eye?loaded:null):pairFromReports();if(pair)active=analyze(pair,limits);}catch(e){content='<p class="rg-inline-error" role="status">Numerical comparison unavailable: '+esc(e.message)+'</p>';}
 if(!active&&mode==='patient')try{imageActive=imagePairFromReports();}catch(e){content+='<p class="rg-inline-error">'+esc(e.message)+'</p>';}
 if(imageActive){if(imageLayer!=='combined'&&!imageActive.layers.some(l=>l.id===imageLayer))imageLayer='combined';content+=imagePanel(imageActive);}
 else if(active){if(layer!=='combined'&&!active.pair.layers.includes(layer))layer='combined';content+=dataPanel(active);}
 else if(mode==='patient'&&shapeSets.length&&context.results[eye]?.case.mode==='baseline')content+='<p class="rg-small">One visit supports a corneal shape view. Regional change needs an earlier and a later scan.</p>';
 else if(mode==='patient')content+=emptyPatient(context.sourceDirty?'The source selection changed. Confirm the selected studies and recalculate to link the current case.':undefined);
 else if(mode==='numeric')content+='<p class="rg-empty-small">'+(loaded?'The loaded pair belongs to '+loaded.first.eye+'. Select that eye above.':'No numerical pair loaded. The synthetic example demonstrates the exact supported format.')+'</p>';
 coneTracks=imageActive?imageTracks(imageActive):active?numericTracks(active):[];
 if(coneTracks.length)content+=coneHTML(coneTracks,imageActive?.interval||active?.pair.interval_days,eye,coneLayer);
 if(shapeSets.length)content+='<details class="rg-details rg-shape-drawer"><summary><b>3D corneal view</b><span class="rg-small"> · Reference eye + available corneal data</span></summary><div id="rg-patient-shape"></div></details>';
 el.innerHTML=controls()+(mode==='numeric'?numericalTools():'')+content+(mode==='patient'&&(active||imageActive||shapeSets.length)?'<details class="rg-details"><summary>Original source reports</summary>'+sourceReports()+'</details>'+tableForCase():'')+'<details class="rg-details rg-evidence"><summary>Research behind this supplement</summary><p>Regional averages and spatial patterns are an active research area. The strongest case is for reproducible local measurements. The displayed overlap has not been validated as a progression score.</p><p><a href="https://pubmed.ncbi.nlm.nih.gov/34050086/" target="_blank" rel="noopener noreferrer">REDCAKE · regional versus single-point parameters</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/35389929/" target="_blank" rel="noopener noreferrer">Long-term zonal analysis</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/36203753/" target="_blank" rel="noopener noreferrer">Differences in cone localization</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/29234085/" target="_blank" rel="noopener noreferrer">Tomography alignment and repeatability</a></p></details>';
 for(const d of el.querySelectorAll('details'))if(openDetails.has(d.querySelector('summary')?.textContent))d.open=true;
 el.querySelectorAll('[data-cone-map]').forEach(c=>paintCone(c,coneTracks.find(t=>t.id===c.dataset.coneMap),eye));
 if(active)draw();if(imageActive)drawImageMap();if(shapeSets.length&&root.NKPIPatientShape)disposeShape=root.NKPIPatientShape.mount(el.querySelector('#rg-patient-shape'),shapeSets,eye,context.results[eye]);
}
function project(a,x,y){const cs=a.pair.first.coordinate_system;const mx=(cs.x_positive==='temporal'?1:-1)*(a.pair.first.eye==='OD'?-1:1),my=cs.y_positive==='superior'?-1:1;return [300+x*mx*78,300+y*my*78];}
function draw(){const canvas=el.querySelector('#rg-map');if(!canvas||!active)return;const ctx=canvas.getContext('2d'),a=active;ctx.clearRect(0,0,600,600);ctx.fillStyle='#f1eff4';ctx.beginPath();ctx.arc(300,300,234,0,2*Math.PI);ctx.fill();
 for(const c of a.cells){const points=[project(a,a.pair.first.x_mm[c.i],a.pair.first.y_mm[c.j]),project(a,a.pair.first.x_mm[c.i+1],a.pair.first.y_mm[c.j+1])],x=Math.min(points[0][0],points[1][0]),y=Math.min(points[0][1],points[1][1]),w=Math.abs(points[0][0]-points[1][0]),h=Math.abs(points[0][1]-points[1][1]);
  const valid=layer==='combined'?a.pair.layers.every(id=>c.values[id]):!!c.values[layer];let fill='#eeebf2';
  if(valid){if(layer==='combined'){const count=a.pair.layers.filter(id=>c.values[id].change>=a.limits[id]).length;fill=['#eeebf2','#d9cced','#a38bc8','#67428e'][count];}else{const d=c.values[layer].change;fill=d>=a.limits[layer]?'#67428e':d<0?'#cfddd8':'#eeebf2';}}
  ctx.fillStyle=fill;ctx.fillRect(x,y,w+.15,h+.15);if(!valid){ctx.strokeStyle='#cac5d0';ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x+w,y);ctx.stroke();}
 }
 ctx.strokeStyle='#c9c1d4';ctx.lineWidth=1;ctx.setLineDash([4,5]);for(const r of [78,156,234]){ctx.beginPath();ctx.arc(300,300,r,0,2*Math.PI);ctx.stroke();}ctx.beginPath();ctx.moveTo(66,300);ctx.lineTo(534,300);ctx.moveTo(300,66);ctx.lineTo(300,534);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='#64566e';ctx.font='18px system-ui';ctx.textAlign='center';ctx.fillText('Superior',300,39);ctx.fillText('Inferior',300,578);ctx.font='16px system-ui';ctx.fillText(a.pair.first.eye==='OD'?'T':'N',35,306);ctx.fillText(a.pair.first.eye==='OD'?'N':'T',565,306);ctx.fillText('6 mm',490,547);
 if(selected){const p=project(a,selected.x,selected.y);ctx.strokeStyle='#302239';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p[0],p[1],8,0,2*Math.PI);ctx.stroke();showPick(selected);}
}
function showPick(c){const target=el.querySelector('#rg-pick');if(!target||!active)return;target.innerHTML='<b>Cell center · '+esc(coordinate(c,active.pair))+'</b><div class="rg-table-wrap"><table><thead><tr><th>Map</th><th>Earlier</th><th>Latest</th><th>Directional change</th></tr></thead><tbody>'+active.pair.layers.map(id=>{const l=LAYERS.find(l=>l.id===id),v=c.values[id];return '<tr><th>'+l.name+'</th><td>'+format(v?.first,l.decimals)+'</td><td>'+format(v?.latest,l.decimals)+'</td><td>'+signed(v?.change,l.decimals)+' '+l.unit+'</td></tr>';}).join('')+'</tbody></table></div>';}
function save(raw,name){const url=URL.createObjectURL(new Blob([JSON.stringify(raw,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
el.addEventListener('click',event=>{const b=event.target.closest('button');if(b){if(b.dataset.rgMode){mode=b.dataset.rgMode;selected=null;render();}else if(b.dataset.rgEye){eye=b.dataset.rgEye;selected=null;render();}else if(b.dataset.rgPattern){pattern=b.dataset.rgPattern;selected=null;render();}else if(b.hasAttribute('data-rg-clear-import')){epoch++;loaded=null;loadError='';render();}else if(b.dataset.rgDownload==='image-figure'&&imageActive)saveImageFigure();else if(b.dataset.rgDownload==='image-audit'&&imageActive)save({schema:'nkpi-image-regional-audit-2',eye,interval_days:imageActive.interval,source:'report_color_estimate',layers:imageActive.layers,unavailable:imageActive.unavailable,shared_geometry:imageActive.sharedGeometry,shared_fraction:imageActive.sharedFraction,common_coverage:imageActive.commonCoverage,summaries:imageActive.summaries,cone_evolution:coneTracks.map(({cells,...t})=>t),method:'Printed plot-circle alignment; central two-thirds radius. Estimated difference maps in D / µm; direct and locally recovered coverage reported separately. Narrow obstructions use balanced source colors within 3% of plot radius; isolated colored-marker jumps are excluded. Peak is highest 0.8-mm-window mean with 85% coverage; overlap requires non-overlapping color bins. Not a clinical threshold, confidence interval or device numerical map.'},'NKPI_'+eye+'_image_regional_audit.json');else if(b.dataset.rgDownload==='example')save(demo(eye,pattern),'NKPI_synthetic_regional_pair.json');else if(b.dataset.rgDownload==='audit'&&active)save(audit(active),'NKPI_'+eye+'_regional_research_audit.json');}
 if(event.target.hasAttribute('data-rg-image-map')&&imageActive){const rect=event.target.getBoundingClientRect(),i=Math.round(((event.clientX-rect.left)*600/rect.width-300)/11.7+20),j=Math.round(((event.clientY-rect.top)*600/rect.height-300)/11.7+20),cell=imageActive.cells.find(c=>c.i===i&&c.j===j);el.querySelector('#rg-image-pick').innerHTML=cell?'<b>Color-derived estimates · '+esc(imageLocation(cell))+'</b><div class="rg-table-wrap"><table><tr><th>Map</th><th>Earlier</th><th>Latest</th><th>Change toward steepening / thinning</th></tr>'+imageActive.layers.map(l=>{const v=cell.values[l.id],d=l.unit==='µm'?0:1;return '<tr><th>'+root.NKPIImageRegions.names[l.id]+'</th><td>'+format(v?.first,d)+'</td><td>'+format(v?.latest,d)+'</td><td>'+signed(v?.value,d)+' '+l.unit+'</td></tr>';}).join('')+'</table></div><small>Curvature in D; thickness in µm. Positive change means steeper / thinner. Color estimates include local recovery around narrow obstructions; larger gaps remain missing.</small>':'Outside the comparable central region.';}
 if(event.target.id==='rg-map'&&active){const rect=event.target.getBoundingClientRect(),px=(event.clientX-rect.left)*600/rect.width,py=(event.clientY-rect.top)*600/rect.height;let found=null;for(const c of active.cells){const [x,y]=project(active,c.x,c.y),w=(active.pair.first.x_mm[c.i+1]-active.pair.first.x_mm[c.i])*78,h=(active.pair.first.y_mm[c.j+1]-active.pair.first.y_mm[c.j])*78;if(Math.abs(px-x)<=w/2&&Math.abs(py-y)<=h/2){found=c;break;}}selected=found;draw();if(!found)el.querySelector('#rg-pick').textContent='Outside complete grid cells in the 6-mm aperture.';}
});
el.addEventListener('change',async event=>{const t=event.target;if(t.id==='rg-cone-layer'){coneLayer=t.value;render();}else if(t.id==='rg-image-layer'){imageLayer=t.value;render();}else if(t.id==='rg-layer'){layer=t.value;selected=null;render();}else if(t.dataset.rgPage){pageSelections[t.dataset.rgPage]=t.value;render();}else if(t.dataset.rgCutoff){const l=LAYERS.find(l=>l.id===t.dataset.rgCutoff),v=Number(t.value);if(!finite(v)||v<=0||v>(l.id==='thickness'?200:20)){t.setCustomValidity('Enter a positive value within the displayed range.');t.reportValidity();return;}t.setCustomValidity('');limits[l.id]=v;selected=null;render();}else if(t.id==='rg-file'){
  const token=++epoch,file=t.files?.[0];loaded=null;loadError='';selected=null;if(!file){render();return;}
  try{if(file.size>12*1024*1024)throw new Error('Use a numerical JSON file under 12 MB.');const text=await file.text();if(token!==epoch)return;const p=validatePair(JSON.parse(text));analyze(p,limits);if(token!==epoch)return;loaded=p;eye=p.first.eye;loadError='Numerical structure accepted. Alignment is supplied in the file; this app does not verify anatomical registration.';}catch(error){if(token!==epoch)return;loadError='Pair not loaded: '+error.message;}render();
 }});
function sanitizeReports(raw){if(!Array.isArray(raw)||raw.length>4)fail('Invalid report sets');const used=new Set();return raw.map(s=>{const key=s.eye+':'+s.visit;if(!['OD','OS'].includes(s.eye)||!['first','latest'].includes(s.visit)||used.has(key)||!Array.isArray(s.pages)||s.pages.length>48)fail('Invalid report association');used.add(key);const pages=s.pages.filter(p=>{try{return typeof p.url==='string'&&p.url.startsWith('blob:')&&new URL(p.url).origin===location.origin&&typeof p.id==='string'&&/^[a-z0-9-]{1,60}$/i.test(p.id);}catch(_){return false;}}).map(p=>({id:p.id,url:p.url,label:String(p.label||'Source report').slice(0,140),kind:p.kind}));const image_maps=(Array.isArray(s.image_maps)?s.image_maps:[]).slice(0,3).filter(m=>{try{root.NKPIImageRegions.validateMap(m);return true;}catch(_){return false;}});const image_issues=(Array.isArray(s.image_issues)?s.image_issues:[]).slice(0,8).map(v=>({id:v.id,message:String(v.message||'Map unavailable').slice(0,200)}));let shape_estimate=null;try{if(s.shape_estimate)shape_estimate=root.NKPIImageRegions.validateShape(s.shape_estimate);}catch(_){}return {eye:s.eye,visit:s.visit,pages,image_maps,image_issues,shape_estimate,shape_issue:String(s.shape_issue||'').slice(0,240),surface:s.surface||null,source_id:String(s.source_id||'').slice(0,100)};}).filter(s=>s.pages.length);}
root.NKPIRegional={setContext(c){context=c;if(!context.cases[eye]?.enabled){const available=['OD','OS'].find(e=>context.cases[e]?.enabled&&context.results[e]);if(available)eye=available;}selected=null;render();},bindImported(cases){for(const e of ['OD','OS'])if(cases[e])bindings[e]={inputs:inputKey(cases[e]),reports:reportKey(e)};},setReports(raw){try{reports=sanitizeReports(raw);}catch(_){reports=[];}selected=null;render();},clear(){epoch++;reports=[];loaded=null;loadError='';selected=null;mode='patient';limits={...DEFAULTS};for(const k of Object.keys(bindings))delete bindings[k];for(const k of Object.keys(pageSelections))delete pageSelections[k];render();},removeEye(e){delete bindings[e];reports=reports.filter(s=>s.eye!==e);if(loaded?.first.eye===e){epoch++;loaded=null;}selected=null;render();}};
render();
})(typeof window!=='undefined'?window:globalThis);
