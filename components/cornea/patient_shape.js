/* Patient-linked corneal shape. Image estimates and measured exports are kept
 * distinct. No generic cone, fitted progression model, remote reader or PHI log. */
(function(root){'use strict';
const node=typeof module!=='undefined'&&module.exports;
const I=node?require('../image_regions.js'):root.NKPIImageRegions;
const C=node?require('./surface_schema.js'):root.CornealData;
const finite=Number.isFinite,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function solve(a,b){a=a.map((r,i)=>[...r,b[i]]);for(let i=0;i<b.length;i++){let k=i;for(let j=i+1;j<b.length;j++)if(Math.abs(a[j][i])>Math.abs(a[k][i]))k=j;[a[i],a[k]]=[a[k],a[i]];if(Math.abs(a[i][i])<1e-10)return null;const v=a[i][i];a[i]=a[i].map(x=>x/v);for(let j=0;j<b.length;j++)if(j!==i){const f=a[j][i];a[j]=a[j].map((x,q)=>x-f*a[i][q]);}}return a.map(r=>r[b.length]);}
function smooth(grid,i,j,step){
 // Local weighted plane, including a nearest-support and coverage requirement.
 // Small printed-number occlusions may be interpolated; large gaps remain open.
 const radius=.6,n=Math.ceil(radius/step),points=[];let possible=0,near=Infinity;
 for(let y=Math.max(0,j-n);y<=Math.min(40,j+n);y++)for(let x=Math.max(0,i-n);x<=Math.min(40,i+n);x++){
  const dx=(x-i)*step,dy=(y-j)*step,d=Math.hypot(dx,dy);if(d>radius||Math.hypot(x-20,y-20)>20)continue;possible++;const q=grid[y][x];if(q){points.push({dx,dy,v:q.value,w:Math.exp(-d*d/.08)});near=Math.min(near,d);}
 }
 if(points.length<6||points.length<possible*.5||near>Math.max(step*2.01,.25))return null;
 const a=Array.from({length:3},()=>[0,0,0]),b=[0,0,0];for(const p of points){const v=[1,p.dx,p.dy];for(let k=0;k<3;k++){b[k]+=p.w*v[k]*p.v;for(let l=0;l<3;l++)a[k][l]+=p.w*v[k]*v[l];}}
 const fit=solve(a,b);return fit?{value:fit[0],dx:fit[1],dy:fit[2],interpolated:!grid[j][i]}:null;
}
function imageModel(shape,thickness){
 I.validateShape(shape);I.validateMap(thickness);
 if(thickness.id!=='thickness'||Math.abs(shape.diameter_mm-thickness.diameter_mm)>.001)throw Error('Elevation and thickness need the same printed plot diameter.');
 const radius=shape.diameter_mm/3,step=radius/20,R=shape.bfs_radius_mm,vertices=[],nx=41;let possible=0,interpolated=0;
 for(let j=0;j<41;j++)for(let i=0;i<41;i++){
  const x=(i-20)*step,y=(j-20)*step;if(Math.hypot(x,y)>radius+1e-8){vertices.push(null);continue;}possible++;
  const e=smooth(shape.elevation_um,i,j,step),t=smooth(thickness.grid,i,j,step);
  if(!e||!t||t.value<100||t.value>1200||R*R<=x*x+y*y){vertices.push(null);continue;}
  const sag=Math.sqrt(R*R-x*x-y*y),z=sag-R+e.value/1000,dx=-x/sag+e.dx/1000,dy=y/sag-e.dy/1000,den=Math.hypot(dx,dy,1),normal=[-dx/den,-dy/den,1/den];
  const front=[x,-y,z],back=front.map((v,k)=>v-normal[k]*t.value/1000);
  if(![...front,...back].every(finite)){vertices.push(null);continue;}
  if(e.interpolated||t.interpolated)interpolated++;
  vertices.push({front,back,thickness:t.value,interpolated:e.interpolated||t.interpolated,elevation:e.value});
 }
 const valid=vertices.filter(Boolean);if(valid.length/possible<.5)throw Error('Too little overlapping elevation and thickness coverage for a 3D estimate.');
 return finish({vertices,nx,ny:41,kind:'estimated',radius,coverage:valid.length/possible,interpolated,possible,bfs:R,fit_diameter:shape.fit_diameter_mm,legend_step:shape.legend_step_um});
}
function nativeModel(raw,eye,visit){
 const s=C.validate(raw);if(s.kind!=='measured'||s.eye!==eye||s.visit!==visit||!s.anterior?.z_mm)throw Error('A matching measured anterior height grid is needed.');
 const cs=s.coordinate_system,mx=(cs.x_positive==='temporal'?1:-1)*(eye==='OD'?-1:1),my=cs.y_positive==='superior'?1:-1,mz=cs.z_positive==='anterior'?1:-1;
 const radius=Math.min(6,Math.max(...s.x_mm.map(Math.abs)),Math.max(...s.y_mm.map(Math.abs)));
 const vertices=[];let possible=0;for(let j=0;j<s.y_mm.length;j++)for(let i=0;i<s.x_mm.length;i++){
  const x=s.x_mm[i]*mx,y=s.y_mm[j]*my;if(Math.hypot(x,y)>radius){vertices.push(null);continue;}possible++;
  const z=s.anterior.z_mm[j][i],b=s.posterior?.z_mm?.[j]?.[i],t=s.thickness_um?.[j]?.[i];
  if(!finite(z)||(finite(b)&&mz*z<=mz*b))vertices.push(null);else vertices.push({front:[x,y,mz*z],back:finite(b)?[x,y,mz*b]:null,thickness:finite(t)?t:null,interpolated:false,elevation:s.anterior.elevation_um?.[j]?.[i]??null,posterior_elevation:s.posterior?.elevation_um?.[j]?.[i]??null,anterior:s.anterior.curvature_D?.[j]?.[i]??null,posterior:s.posterior?.curvature_D?.[j]?.[i]??null});
 }
 if(!vertices.some(Boolean))throw Error('No usable height samples in the central region.');
 return finish({vertices,nx:s.x_mm.length,ny:s.y_mm.length,kind:'native',radius,coverage:vertices.filter(Boolean).length/possible,possible,interpolated:0});
}
function finish(m){
 const triangles=[];for(let j=0;j<m.ny-1;j++)for(let i=0;i<m.nx-1;i++){const a=j*m.nx+i,b=a+1,c=a+m.nx,d=c+1;for(const ids of [[a,b,c],[b,d,c]])if(ids.every(k=>m.vertices[k]))triangles.push(ids);}
 if(!triangles.length)throw Error('No complete surface cells.');m.triangles=triangles;
 const ts=m.vertices.flatMap(v=>v&&finite(v.thickness)?[v.thickness]:[]);m.thicknessRange=ts.length?[Math.min(...ts),Math.max(...ts)]:null;
 m.centerZ=m.vertices.filter(Boolean).reduce((s,v)=>s+v.front[2],0)/m.vertices.filter(Boolean).length;
 return prepare(m);
}
function referenceModel(maps=[]){
 const radius=3,R=7.8,vertices=[],ts=maps.filter(m=>m.id==='thickness');
 const thickness=ts.length===1?I.validateMap(ts[0]):null;
 for(let j=0;j<41;j++)for(let i=0;i<41;i++){
  const x=(i-20)*.15,y=(j-20)*.15,r=Math.hypot(x,y);if(r>radius+1e-8){vertices.push(null);continue;}
  const z=Math.sqrt(R*R-r*r)-R,front=[x,-y,z],n=unit([x/R,-y/R,(z+R)/R]);
  let t=null;if(thickness){const step=thickness.diameter_mm/60,u=Math.round(x/step+20),v=Math.round(y/step+20);if(u>=0&&u<=40&&v>=0&&v<=40)t=smooth(thickness.grid,u,v,step)?.value??null;}
  if(finite(t)&&(t<100||t>1200))t=null;vertices.push({front,back:finite(t)?front.map((v,k)=>v-n[k]*t/1000):null,thickness:t,elevation:null,interpolated:false});
 }
 return addImageOverlays(finish({vertices,nx:41,ny:41,kind:'reference',radius,coverage:1,possible:vertices.filter(Boolean).length,interpolated:0,bfs:R}),maps);
}
function fromReport(s){
 if(!s)throw Error('No report is linked to this visit.');
 if(s.surface?.kind==='measured'&&s.surface?.anterior?.z_mm)return nativeModel(s.surface,s.eye,s.visit);
 const maps=s.image_maps||[],ts=maps.filter(v=>v.id==='thickness');
 if(s.shape_estimate&&ts.length===1){try{return addImageOverlays(imageModel(s.shape_estimate,ts[0]),maps);}catch(e){const m=referenceModel(maps);m.referenceReason=e.message;return m;}}
 const m=referenceModel(maps);m.referenceReason=s.shape_issue||'Usable elevation and thickness are not both available.';return m;
}

// Curvature is a color overlay, never a substitute for surface height. Sample
// in the report's physical frame; missing values remain missing on the mesh.
function addImageOverlays(m,maps){
 for(const id of ['anterior','posterior']){
  const candidates=maps.filter(v=>v.id===id);if(candidates.length!==1)continue;
  const map=I.validateMap(candidates[0]),r=map.diameter_mm/3,step=r/20;
  for(const v of m.vertices){if(!v)continue;const u=v.front[0]/step+20,w=-v.front[1]/step+20;
   if(u<0||w<0||u>40||w>40)continue;
   const i=Math.min(39,Math.floor(u)),j=Math.min(39,Math.floor(w)),fx=u-i,fy=w-j;
   const points=[[i,j,(1-fx)*(1-fy)],[i+1,j,fx*(1-fy)],[i,j+1,(1-fx)*fy],[i+1,j+1,fx*fy]].filter(p=>p[2]>1e-8);
   const vals=points.map(([x,y,weight])=>({value:I.canonicalValue(map.grid[y][x],id,map.unit)?.value,weight}));
   v[id]=vals.every(p=>finite(p.value))?vals.reduce((s,p)=>s+p.value*p.weight,0):null;
  }
 }
 return prepare(m);
}
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const d=Math.hypot(...a)||1;return a.map(v=>v/d);};
function prepare(m){
 delete m.displayMesh;
 for(const v of m.vertices)if(v){v.frontNormal=[0,0,0];v.backNormal=[0,0,0];}
 for(const ids of m.triangles)for(const side of ['front','back']){
  const vs=ids.map(i=>m.vertices[i]);if(vs.some(v=>!v[side]))continue;
  let n=cross(sub(vs[1][side],vs[0][side]),sub(vs[2][side],vs[0][side]));
  if((side==='front'?1:-1)*n[2]<0)n=n.map(v=>-v);
  for(const v of vs)for(let i=0;i<3;i++)v[side+'Normal'][i]+=n[i];
 }
 for(const v of m.vertices)if(v)for(const side of ['front','back'])v[side+'Normal']=unit(v[side+'Normal']);
 m.overlays=[{id:'shape',label:'Corneal surface',unit:''}];
 for(const [id,label,u]of [['thickness','Thickness','µm'],['anterior','Anterior curvature','D'],['posterior','Posterior curvature |D|','D'],['elevation','Anterior elevation','µm'],['posterior_elevation','Posterior elevation','µm']]){
  const values=m.vertices.flatMap(v=>v&&finite(v[id])?[id==='posterior'?Math.abs(v[id]):v[id]]:[]);
  if(values.length)m.overlays.push({id,label,unit:u,min:Math.min(...values),max:Math.max(...values),coverage:values.length/m.vertices.filter(Boolean).length});
 }
 return m;
}
function rotate(v,yaw,pitch){const x=v[0]*Math.cos(yaw)+v[2]*Math.sin(yaw),z=-v[0]*Math.sin(yaw)+v[2]*Math.cos(yaw);return [x,v[1]*Math.cos(pitch)-z*Math.sin(pitch),v[1]*Math.sin(pitch)+z*Math.cos(pitch)];}
function project(m,v,state,width=1000,height=680){const p=rotate([v[0],v[1],v[2]-(state.eyeContext?referenceEye(m).apex-9.5:m.centerZ)],state.yaw,state.pitch),camera=(state.eyeContext?12:m.radius)*5,k=Math.min(width*.29,height*.37)/(state.eyeContext?12:m.radius)*(state.zoom||1),scale=k*camera/(camera-p[2]);return [width*.46+p[0]*scale,height*.48-p[1]*scale,p[2],scale];}
function paletteColor(m,id,value){
 if(id==='shape')return [116,186,207];
 if(!finite(value))return [70,80,95];
 const layer=m.overlays.find(v=>v.id===id),number=id==='posterior'?Math.abs(value):value,f=clamp((number-layer.min)/Math.max(1e-8,layer.max-layer.min),0,1);
 const stops=id==='thickness'?[[139,105,208],[133,182,217],[188,228,222]]:[[73,132,197],[80,181,188],[221,211,123],[213,126,100]];
 const x=f*(stops.length-1),i=Math.min(stops.length-2,Math.floor(x)),t=x-i;return stops[i].map((v,k)=>v*(1-t)+stops[i+1][k]*t);
}
function meshFaces(m,cut){
 const faces=[],edges=new Map();
 for(const ids of m.triangles){if(cut&&ids.some(i=>m.vertices[i].front[0]>1e-8))continue;
  for(const side of ['back','front'])if(ids.every(i=>m.vertices[i][side]))faces.push({ids,side});
  for(const [a,b]of [[ids[0],ids[1]],[ids[1],ids[2]],[ids[2],ids[0]]]){const key=[a,b].sort((a,b)=>a-b).join(':');if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}
 }
 for(const [a,b]of edges.values()){const v=m.vertices[a],w=m.vertices[b];if(v.back&&w.back){const n=unit(cross(sub(w.front,v.front),sub(v.back,v.front)));faces.push({ids:[a,b,b],side:'wall',positions:[v.front,w.front,w.back],normal:n});faces.push({ids:[a,b,a],side:'wall',positions:[v.front,w.back,v.back],normal:n});}}
 return faces;
}
// Clip only the outer display rim slightly inside the sampled aperture. This
// removes staircase edges without extending geometry into unmeasured tissue.
// All new vertices are linear interpolation within an existing valid triangle.
function displayMesh(m){
 if(m.displayMesh)return m.displayMesh;
 const steps=m.vertices.filter(Boolean).map(v=>v.front[0]).sort((a,b)=>a-b),gaps=steps.slice(1).map((v,i)=>v-steps[i]).filter(v=>v>1e-6),step=gaps.length?Math.min(...gaps):m.radius/20;
 const radius=m.radius-Math.min(step*1.2,m.radius*.08),vertices=[],triangles=[];
 const point=(v,id)=>({...v,sourceId:id});
 function blend(a,b,t){const out={};for(const k of ['front','back','frontNormal','backNormal'])out[k]=a[k]&&b[k]?a[k].map((v,i)=>v*(1-t)+b[k][i]*t):null;
 for(const k of ['thickness','elevation','posterior_elevation','anterior','posterior'])out[k]=finite(a[k])&&finite(b[k])?a[k]*(1-t)+b[k]*t:null;
 out.sourceId=t<.5?a.sourceId:b.sourceId;return out;}
 const planes=Array.from({length:96},(_,i)=>[Math.cos(i*2*Math.PI/96),Math.sin(i*2*Math.PI/96)]);
 for(const ids of m.triangles){let poly=ids.map(i=>point(m.vertices[i],i));
  if(poly.some(v=>Math.hypot(v.front[0],v.front[1])>radius))for(const [nx,ny]of planes){
   const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=a.front[0]*nx+a.front[1]*ny-radius,db=b.front[0]*nx+b.front[1]*ny-radius;
    if(da<=0)out.push(a);if((da<0&&db>0)||(da>0&&db<0))out.push(blend(a,b,da/(da-db)));
   }poly=out;if(!poly.length)break;
  }
  const offset=vertices.length;vertices.push(...poly);for(let i=1;i<poly.length-1;i++)triangles.push([offset,offset+i,offset+i+1]);
 }
 // Shared coordinate keys preserve only actual boundary walls after clipping.
 const lookup=new Map(),unique=[],index=vertices.map(v=>{const key=v.front.map(x=>x.toFixed(8)).join(':');if(!lookup.has(key)){lookup.set(key,unique.length);unique.push(v);}return lookup.get(key);});
 m.displayMesh={...m,vertices:unique,triangles:triangles.map(ids=>ids.map(i=>index[i])),displayRadius:radius};return m.displayMesh;
}

function referenceEye(m){
 if(m.referenceEye)return m.referenceEye;
 const center=m.vertices.filter(Boolean).sort((a,b)=>Math.hypot(...a.front.slice(0,2))-Math.hypot(...b.front.slice(0,2)))[0],apex=center?.front[2]||0;
 const faces=[],R=12,limbus=5.7,cz=apex-Math.sqrt(R*R-limbus*limbus)-2.48,N=80;
 function ringMesh(rings,color,kind){for(let j=1;j<rings.length;j++)for(let i=0;i<N;i++){const a=rings[j-1][i],b=rings[j-1][(i+1)%N],c=rings[j][i],d=rings[j][(i+1)%N];for(const pts of [[a,b,c],[b,d,c]])faces.push({reference:true,kind,positions:pts.map(p=>p.p),normals:pts.map(p=>p.n),colors:pts.map(p=>typeof color==='function'?color(p):color)});}}
 const sclera=Array.from({length:39},(_,j)=>{const t=Math.asin(limbus/R)+(Math.PI-Math.asin(limbus/R)-.001)*j/38;return Array.from({length:N},(_,i)=>{const a=i*2*Math.PI/N,n=[Math.sin(t)*Math.cos(a),Math.sin(t)*Math.sin(a),Math.cos(t)];return {p:[R*n[0],R*n[1],cz+R*n[2]],n};});});
 ringMesh(sclera,[213,222,226],'sclera');
 const iris=Array.from({length:13},(_,j)=>Array.from({length:N},(_,i)=>{const r=5.65*j/12,a=i*2*Math.PI/N;return {p:[r*Math.cos(a),r*Math.sin(a),apex-3.25],n:[0,0,1],r,a};}));
 ringMesh(iris,p=>p.r<1.85?[8,16,23]:p.r>5.25?[27,45,49]:[55+12*Math.sin(p.a*29),93+15*Math.sin(p.a*29),94+12*Math.sin(p.a*29)],'iris');
 // Reference peripheral cornea, beyond the data patch. Its shape and placement
 // are schematic. It is NEVER joined into the patient's numerical mesh.
 const inner=Math.min(5.5,m.displayRadius||m.radius),cornea=Array.from({length:16},(_,j)=>Array.from({length:N},(_,i)=>{const r=inner+(5.7-inner)*j/15,a=i*2*Math.PI/N,z=Math.sqrt(7.8**2-r*r)-7.8;return {p:[r*Math.cos(a),r*Math.sin(a),apex+z],n:[r*Math.cos(a)/7.8,r*Math.sin(a)/7.8,(z+7.8)/7.8]};}));
 ringMesh(cornea,[98,174,193],'reference_cornea');
 return m.referenceEye={faces,apex};
}
// Dependency-free, depth-buffered software rendering. Smooth normals affect
// lighting only; the mesh's coordinates and missing-region mask are unchanged.
function render(canvas,m,options={}){
 m=displayMesh(m);const state={yaw:-.5,pitch:.25,zoom:1,eyeContext:true,cut:false,color:'shape',eye:'OS',visit:'latest',...options},w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d'),bg=ctx.createLinearGradient(0,0,w,h);
 bg.addColorStop(0,'#111c2e');bg.addColorStop(1,'#060c16');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 const glow=ctx.createRadialGradient(w*.43,h*.4,10,w*.43,h*.4,w*.43);glow.addColorStop(0,'rgba(47,74,103,.35)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 const img=ctx.getImageData(0,0,w,h),pixels=img.data,zbuf=new Float32Array(w*h).fill(-Infinity),pick=new Int32Array(w*h).fill(-1),key=unit([-.7,-.7,.3]),fill=unit([.7,.5,1]),half=unit([key[0],key[1],key[2]+1]);
 const cache=m.vertices.map(v=>v?Object.fromEntries(['front','back'].filter(side=>v[side]).map(side=>[side,{p:project(m,v[side],state,w,h),n:rotate(v[side+'Normal'],state.yaw,state.pitch)}])):null);
 const reference=state.eyeContext?referenceEye(m).faces.filter(f=>!(state.cut&&f.kind==='reference_cornea'&&f.positions.some(p=>p[0]>0))):[];
 for(const face of [...reference,...meshFaces(m,state.cut)]){
  const ref=face.reference,vs=ref?[]:face.ids.map(i=>m.vertices[i]),wall=face.side==='wall';
  const ps=ref||wall?face.positions.map(v=>project(m,v,state,w,h)):face.ids.map(i=>cache[i][face.side].p);
  const ns=ref?face.normals.map(n=>rotate(n,state.yaw,state.pitch)):wall?ps.map(()=>rotate(face.normal,state.yaw,state.pitch)):face.ids.map(i=>cache[i][face.side].n);
  const colors=ref?face.colors:vs.map(v=>wall?[185,162,120]:face.side==='back'&&state.color==='shape'?[77,126,150]:paletteColor(m,state.color,state.color==='posterior'?Math.abs(v.posterior??NaN):v[state.color]));
  const [a,b,c]=ps,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-8)continue;
  const x0=Math.max(0,Math.floor(Math.min(...ps.map(p=>p[0])))),x1=Math.min(w-1,Math.ceil(Math.max(...ps.map(p=>p[0])))),y0=Math.max(0,Math.floor(Math.min(...ps.map(p=>p[1])))),y1=Math.min(h-1,Math.ceil(Math.max(...ps.map(p=>p[1]))));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/den,v=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/den,t=1-u-v;
   if(u<-.001||v<-.001||t<-.001)continue;const depth=u*a[2]+v*b[2]+t*c[2],idx=y*w+x;if(depth<=zbuf[idx])continue;
   zbuf[idx]=depth;pick[idx]=ref?-1:m.vertices[face.ids[u>v&&u>t?0:v>t?1:2]].sourceId;
   let nx=ns[0][0]*u+ns[1][0]*v+ns[2][0]*t,ny=ns[0][1]*u+ns[1][1]*v+ns[2][1]*t,nz=ns[0][2]*u+ns[1][2]*v+ns[2][2]*t;const d=Math.hypot(nx,ny,nz)||1;nx/=d;ny/=d;nz/=d;if(nz<0){nx=-nx;ny=-ny;nz=-nz;}
   const diffuse=Math.max(0,nx*key[0]+ny*key[1]+nz*key[2]),secondary=Math.max(0,nx*fill[0]+ny*fill[1]+nz*fill[2]),spec=Math.pow(Math.max(0,nx*half[0]+ny*half[1]+nz*half[2]),32),rim=Math.pow(1-nz,3),light=ref&&face.kind==='sclera'?.55+.30*diffuse+.15*secondary:.27+.58*diffuse+.14*secondary;
   for(let k=0;k<3;k++){const base=colors[0][k]*u+colors[1][k]*v+colors[2][k]*t;const shade=clamp(base*light+(wall?18:160)*spec+rim*38,0,255),alpha=ref&&face.kind==='reference_cornea'?.18:!ref&&state.eyeContext&&state.color==='shape'&&!wall?(face.side==='back'?.12:.46):1;pixels[idx*4+k]=alpha*(ref&&face.kind==='sclera'?Math.sqrt(shade/255)*255:shade)+(1-alpha)*pixels[idx*4+k];}
  }
 }
 ctx.putImageData(img,0,0);const font=Math.max(13,w*.014);ctx.font=font+'px system-ui';ctx.textAlign='center';ctx.fillStyle='#b9cadc';
 const r=(state.eyeContext?6.7:m.radius*1.13);for(const [label,v]of [['Superior',[0,r,0]],['Inferior',[0,-r,0]],[state.eye==='OD'?'Temporal':'Nasal',[-r,0,0]],[state.eye==='OD'?'Nasal':'Temporal',[r,0,0]]]){const p=project(m,v,state,w,h);ctx.fillText(label,clamp(p[0],50,w-50),clamp(p[1],70,h-85));}
 ctx.textAlign='left';ctx.font='600 '+Math.round(w*.017)+'px system-ui';ctx.fillStyle='#eef5fd';ctx.fillText(state.eye+' · '+(state.visit==='latest'?'Latest scan':'Earlier / selected scan'),28,36);ctx.font=Math.round(w*.012)+'px system-ui';ctx.fillStyle='#9bafc6';ctx.fillText(state.demo?'SIMULATED EXAMPLE':m.kind==='reference'?'REFERENCE SHAPE · AVAILABLE DATA OVERLAYS':state.eyeContext?'SCHEMATIC EYE + DATA-DERIVED CENTRAL CORNEA':m.kind==='estimated'?'REPORT-IMAGE RECONSTRUCTION · APPROXIMATE':'SUPPLIED DEVICE HEIGHTS',28,58);
 ctx.font=Math.round(w*.012)+'px system-ui';ctx.fillText((state.eyeContext?'Eye, iris and outer cornea: reference anatomy · data patch ':'Equal physical scale · displayed diameter ')+(m.displayRadius*2).toFixed(1)+' mm · no height exaggeration',28,h-26);
 const layer=m.overlays.find(v=>v.id===state.color);ctx.fillStyle='#cad7e7';ctx.fillText(layer.id==='shape'?'CORNEAL SURFACE':layer.label.toUpperCase()+' · '+layer.min.toFixed(layer.unit==='D'?1:0)+'–'+layer.max.toFixed(layer.unit==='D'?1:0)+' '+layer.unit,28,h-48);
 // A true-scale orthographic slice makes the two boundaries visible, even
 // when the viewer rotates to an almost face-on perspective.
 const slice=m.vertices.filter(v=>v&&Math.abs(v.front[1])<m.radius/25).sort((a,b)=>a.front[0]-b.front[0]),sx=w*.75,sy=h*.78,sk=w*.20/(m.radius*2);
 ctx.fillStyle='rgba(19,31,49,.92)';ctx.fillRect(sx-16,sy-38,w*.23,h*.17);ctx.fillStyle='#a9bdd3';ctx.font=Math.round(w*.011)+'px system-ui';ctx.fillText(m.kind==='reference'?'REFERENCE CENTER SECTION':'CENTER SECTION · TRUE SCALE',sx,sy-20);
 const section=v=>[sx+w*.10+v[0]*sk,sy+30-(v[2]-m.centerZ)*sk];
 for(let i=1;i<slice.length;i++){const a=slice[i-1],b=slice[i];if(b.front[0]-a.front[0]>m.radius*.14)continue;
  if(a.back&&b.back){ctx.beginPath();[a.front,b.front,b.back,a.back].map(section).forEach((p,j)=>j?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle='#5c8393';ctx.fill();}
  for(const side of ['front','back'])if(a[side]&&b[side]){ctx.beginPath();ctx.moveTo(...section(a[side]));ctx.lineTo(...section(b[side]));ctx.strokeStyle=side==='front'?'#b4e6f1':'#d4b886';ctx.lineWidth=1.5;ctx.stroke();}
 }
 const selectedVertex=Number.isInteger(state.selected)?m.vertices.find(v=>v.sourceId===state.selected):null;
 if(selectedVertex){
  const v=selectedVertex,p=project(m,v.front,state,w,h);ctx.strokeStyle='#fff2c9';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p[0],p[1],7,0,Math.PI*2);ctx.stroke();
  if(v.back){const q=project(m,v.back,state,w,h);ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();ctx.setLineDash([]);}
 }
 return {pick,width:w,height:h,state};
}
const api={referenceModel,referenceEye,smooth,imageModel,nativeModel,fromReport,addImageOverlays,prepare,rotate,project,meshFaces,displayMesh,render};
if(node){module.exports=api;return;}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,n=1)=>finite(v)?v.toFixed(n):'—';
function mount(el,sets,eye,result){
 let visit=sets.find(s=>s.visit==='latest')?'latest':'first',state={yaw:-.5,pitch:.25,zoom:1,eyeContext:true,cut:false,color:'shape',eye,selected:null},model=null,error='',drag=null,dead=false,frame=null,picking=null;
 const data=()=>sets.find(s=>s.visit===visit);
 const scaleText=()=>{const l=model.overlays.find(v=>v.id===state.color);return l.id==='shape'?(model.kind==='reference'?'Standard reference shape':'Data-derived central geometry')+' · pale blue: outer surface · gold: cut edge':l.label+' · '+fmt(l.min,l.unit==='D'?1:0)+'–'+fmt(l.max,l.unit==='D'?1:0)+' '+l.unit+' · gray: unavailable';};
 function metrics(){const c=result?.case,values=visit==='latest'?c?.latest:c?.first;if(!values)return '';return '<div class="rg-shape-metrics">'+[['A','A · ARC',2,'mm'],['B','B · PRC',2,'mm'],['C','Thinnest',0,'µm'],['Kmax','Kmax',1,'D'],['BAD_D','BAD-D',2,''],['ARTmax','ARTmax',0,'µm']].map(([key,label,n,u])=>'<div><span>'+label+'</span><strong>'+fmt(values[key],n)+' <small>'+u+'</small></strong></div>').join('')+'</div><p class="rg-small">'+(finite(result?.prediction?.nkpi)?'NKPI '+result.prediction.nkpi.toFixed(1)+' / 100 · ':'')+'These are the calculator’s confirmed summary values. They do not each have a point-by-point spatial map.</p>';}
 function details(){return '<details class="rg-details"><summary>What is measured and what is estimated?</summary><p>'+(model.kind==='reference'?'The outer shape is a standard 7.8-mm-radius cornea. '+esc(model.referenceReason||'')+' Thickness, when readable, determines its inner offset; curvature is a color overlay and is not converted into elevation. The cone shape is not known in this mode.':model.kind==='estimated'?'The outer surface combines printed anterior elevation with a centered, untilted BFS (radius '+fmt(model.bfs,2)+' mm). Its missing translation and tilt prevent an exact replica. The inner surface is inferred by offsetting along the outer surface normal using thickness. It is not an independently measured posterior surface.':'The geometry uses the supplied anterior and, when available, posterior height coordinates. It inherits their sampling and measurement limits.')+'</p><p>Lighting smooths the appearance; the trimmed display rim uses linear interpolation within existing supported triangles. Readable image data use the existing 0.6-mm local plane; large missing areas remain absent. Open patches indicate unavailable data, not holes in the tissue. '+(model.kind==='reference'?'The reference front is complete by construction; this is not a data-coverage percentage.':Math.round(model.coverage*100)+'% modeled coverage, including local interpolation.')+'</p><p>Curvature overlays come from separately extracted maps. Posterior curvature is displayed on the outer shell for location comparison; it does not create posterior geometry. Gray areas lack that overlay. Earlier and latest views are independent reconstructions, not registered height subtraction.</p><p>The modeled data cover the central '+fmt(model.radius*2)+' mm. The outer display rim is clipped slightly inside the sample boundary (about '+fmt(displayMesh(model).displayRadius*2)+' mm) to remove staircase edges without inventing tissue. The surrounding eye, iris and peripheral cornea are schematic reference anatomy (12-mm globe radius, 7.8-mm corneal radius), with assumed placement. They never contribute to reported measurements. The reference cornea is not a measured continuation of the central patch. For a more faithful measured reconstruction, use anterior/posterior x/y/z grids, device thickness, units and the coordinate system via the documented numerical import.</p></details>';}
 function layout(){
  try{model=fromReport(data());error='';}catch(e){model=null;error=e.message;}
  state.selected=null;if(model&&!model.overlays.some(l=>l.id===state.color))state.color='shape';
  el.innerHTML='<div class="rg-shape-toolbar"><div class="rg-actions">'+sets.map(s=>'<button type="button" data-shape-visit="'+s.visit+'" aria-pressed="'+(s.visit===visit)+'">'+(s.visit==='latest'?'Latest scan':sets.length>1?'Earlier scan':'Selected scan')+'</button>').join('')+'</div></div>';
  if(!model){el.innerHTML+='<p class="rg-empty-small">'+esc(error)+' The original report remains available below.</p>';return;}
  el.innerHTML+='<div class="rg-shape-label"><div><b>Cornea &amp; eye · '+eye+'</b><span>'+ (model.kind==='reference'?'Reference shape with available map data':model.kind==='estimated'?'Data-derived central shape within a reference eye':'Device heights within a reference eye')+'</span></div><span>Central patch '+fmt(displayMesh(model).displayRadius*2)+' mm · schematic surroundings</span></div><div class="rg-shape-toolbar"><label>View <select data-shape-context><option value="eye">Cornea + eye</option><option value="cornea">Cornea close-up</option></select></label><label>Show <select data-shape-color>'+model.overlays.map(l=>'<option value="'+l.id+'">'+l.label+'</option>').join('')+'</select></label><div class="rg-actions">'+[['reset','3D'],['front','Front'],['profile','Side']].map(([v,label])=>'<button type="button" data-shape-view="'+v+'">'+label+'</button>').join('')+'</div><label><input type="checkbox" data-shape-cut> Cutaway</label></div><div class="rg-shape-stage"><canvas width="1000" height="680" tabindex="0" aria-label="'+eye+' corneal 3D surface. Drag or arrow keys to rotate. Plus and minus zoom. Click to inspect a nearby surface sample."></canvas><div class="rg-shape-controls"><span>Drag to rotate · click to inspect</span><button type="button" data-shape-zoom="out" aria-label="Zoom out">−</button><button type="button" data-shape-zoom="in" aria-label="Zoom in">+</button></div></div><div class="rg-shape-scale" data-shape-scale></div><div class="rg-shape-pick" data-shape-pick role="status">Select the central cornea to inspect a sample. Reference eye anatomy has no patient measurements.</div>'+metrics()+'<div class="rg-shape-toolbar"><span class="rg-small">Eye and iris are reference anatomy. Open data patches mean unavailable samples, not tissue defects.</span><button type="button" data-shape-save>Save 3D figure</button></div>'+details();
  el.querySelector('[data-shape-context]').value=state.eyeContext?'eye':'cornea';el.querySelector('[data-shape-color]').value=state.color;el.querySelector('[data-shape-cut]').checked=state.cut;
  const canvas=el.querySelector('canvas');canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;state.yaw+=(e.clientX-drag.x)*.008;state.pitch=clamp(state.pitch+(e.clientY-drag.y)*.008,-1.55,1.55);drag.x=e.clientX;drag.y=e.clientY;request();});
  canvas.addEventListener('pointerup',e=>{if(drag&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5&&picking){const r=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)*canvas.width/r.width),y=Math.floor((e.clientY-r.top)*canvas.height/r.height),idx=picking.pick[y*canvas.width+x];state.selected=idx>=0?idx:null;inspect();request();}drag=null;request();});canvas.addEventListener('pointercancel',()=>{drag=null;request();});
  canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','=','Escape'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')state.yaw-=.1;if(e.key==='ArrowRight')state.yaw+=.1;if(e.key==='ArrowUp')state.pitch=clamp(state.pitch-.1,-1.55,1.55);if(e.key==='ArrowDown')state.pitch=clamp(state.pitch+.1,-1.55,1.55);if(e.key==='+'||e.key==='=')state.zoom=clamp(state.zoom*1.12,.6,1.8);if(e.key==='-')state.zoom=clamp(state.zoom/1.12,.6,1.8);if(e.key==='Escape'){state.selected=null;inspect();}request();});
  canvas.addEventListener('wheel',e=>{e.preventDefault();state.zoom=clamp(state.zoom*Math.exp(-e.deltaY*.001),.6,1.8);request();},{passive:false});draw();
 }
 function draw(){frame=null;if(dead||!model)return;const canvas=el.querySelector('canvas');canvas.width=drag?640:1000;canvas.height=drag?435:680;picking=render(canvas,model,{...state,visit});const scale=el.querySelector('[data-shape-scale]');scale.textContent=scaleText();if(state.color!=='shape'){const l=model.overlays.find(v=>v.id===state.color),bar=document.createElement('i');bar.className='rg-shape-gradient';bar.style.background='linear-gradient(90deg,'+[0,.33,.67,1].map(t=>'rgb('+paletteColor(model,state.color,l.min+(l.max-l.min)*t).map(Math.round).join(',')+')').join(',')+')';scale.prepend(bar);}}
 function request(){if(frame===null)frame=requestAnimationFrame(draw);}
 function inspect(){const node=el.querySelector('[data-shape-pick]'),v=model?.vertices[state.selected];if(!v){node.textContent='Reference anatomy or unavailable area. Select the central data patch to inspect its samples.';return;}const [x,y]=v.front,side=x>0?(eye==='OD'?'nasal':'temporal'):(eye==='OD'?'temporal':'nasal');node.innerHTML='<b>'+fmt(Math.abs(x),2)+' mm '+side+' · '+fmt(Math.abs(y),2)+' mm '+(y>=0?'superior':'inferior')+'</b><span>'+model.overlays.filter(l=>l.id!=='shape').map(l=>l.label+': '+(finite(v[l.id])?(model.kind==='estimated'?'~':'')+fmt(l.id==='posterior'?Math.abs(v[l.id]):v[l.id],l.unit==='D'?1:0)+' '+l.unit:'unavailable')).join(' · ')+'</span>';}
 function click(e){const b=e.target.closest('button');if(!b)return;if(b.dataset.shapeVisit){visit=b.dataset.shapeVisit;layout();}else if(b.dataset.shapeView){const v=b.dataset.shapeView;state.yaw=v==='reset'?-.5:0;state.pitch=v==='front'?0:v==='profile'?1.48:state.eyeContext?.25:.9;state.zoom=1;request();}else if(b.dataset.shapeZoom){state.zoom=clamp(state.zoom*(b.dataset.shapeZoom==='in'?1.15:1/1.15),.6,1.8);request();}else if(b.hasAttribute('data-shape-save')&&model){draw();const a=document.createElement('a');a.href=el.querySelector('canvas').toDataURL('image/png');a.download='NKPI_'+eye+'_'+visit+'_cornea_'+model.kind+'.png';a.click();}}
 function change(e){if(e.target.hasAttribute('data-shape-context')){state.eyeContext=e.target.value==='eye';state.yaw=-.5;state.pitch=state.eyeContext?.25:.9;state.zoom=1;}else if(e.target.hasAttribute('data-shape-color'))state.color=e.target.value;else if(e.target.hasAttribute('data-shape-cut'))state.cut=e.target.checked;else return;request();}
 el.addEventListener('click',click);el.addEventListener('change',change);layout();return ()=>{dead=true;if(frame!==null)cancelAnimationFrame(frame);el.removeEventListener('click',click);el.removeEventListener('change',change);};
}
root.NKPIPatientShape={...api,mount};
})(typeof window!=='undefined'?window:globalThis);
