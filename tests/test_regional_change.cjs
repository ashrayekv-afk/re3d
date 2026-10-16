const assert=require('node:assert/strict');
const R=require('../components/regional_change.js');
const copy=v=>structuredClone(v),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
let count=0;function test(name,fn){fn();count++;console.log('PASS',name);}
function flatPair(){const p=R.demo('OD');for(const d of [p.first,p.latest]){d.x_mm=[-1,0,1];d.y_mm=[-1,0,1];for(const l of R.LAYERS){const v=l.id==='anterior'?(d.visit==='first'?50:52):l.id==='posterior'?(d.visit==='first'?-6:-6.5):(d.visit==='first'?500:480);const g=Array.from({length:3},()=>Array(3).fill(v));if(l.id==='thickness')d.thickness_um=g;else d[l.id].curvature_D=g;}}return p;}
test('Physical cell areas, signed posterior convention and thinning',()=>{const a=R.analyze(flatPair());near(a.shared_area,4);for(const r of a.regions){near(r.area,4);near(r.largest.area,4);assert.equal(r.patch_count,1);near(r.largest.x,0);near(r.largest.y,0);}near(a.regions[1].mean_change,.5);near(a.regions[2].mean_change,20);});
test('Nonuniform axes use actual area, not sample counts',()=>{const p=flatPair();for(const d of [p.first,p.latest]){d.x_mm=[-1,0,2];d.y_mm=[-1,0,1];}near(R.analyze(p).shared_area,6);});
test('Matched scans have zero qualifying change',()=>{const p=flatPair();p.latest=copy(p.first);p.latest.visit='latest';near(R.analyze(p).shared_area,0);});
test('Missing data cannot become an observed zero or shared support',()=>{const p=flatPair();p.latest.thickness_um[1][1]=null;const a=R.analyze(p);assert.equal(a.shared_area,null);assert.equal(a.regions[2].area,null);near(a.regions[0].area,4);});
test('One available layer cannot claim a shared area',()=>{const p=flatPair();for(const d of [p.first,p.latest]){delete d.posterior;delete d.thickness_um;delete d.thickness_definition;}assert.equal(R.analyze(p).shared_area,null);});
test('All central cells missing is unavailable',()=>{const p=flatPair();for(const l of R.LAYERS){const g=l.id==='thickness'?p.latest.thickness_um:p.latest[l.id].curvature_D;g[1][1]=null;}assert.throws(()=>R.analyze(p),/No comparable complete/);});
test('Eye, visit, units, registration and map definitions fail closed',()=>{const invalid=[p=>p.latest.eye='OS',p=>p.latest.visit='first',p=>p.latest.units.xy='pixels',p=>delete p.latest.comparison,p=>p.latest.comparison.registration_id='other',p=>p.latest.comparison.map_definition_id='other',p=>p.latest.coordinate_system.x_positive='nasal',p=>p.latest.x_mm[0]=-1.1,p=>p.latest.anterior.curvature_type='axial'];for(const mutate of invalid){const p=flatPair();mutate(p);assert.throws(()=>R.analyze(p));}});
test('Opposite-sign posterior conventions rejected',()=>{const p=flatPair();p.latest.posterior.curvature_D[0][0]=6.5;assert.throws(()=>R.analyze(p),/consistent nonzero sign/);});
test('Unknown fields / identifiers and invalid cutoff inputs rejected',()=>{const p=flatPair();p.patient_name='private';assert.throws(()=>R.analyze(p));for(const v of [0,-1,NaN,Infinity,'1',30])assert.throws(()=>R.analyze(flatPair(),{...R.DEFAULTS,anterior:v}));});
test('Simulated and measured sources cannot be combined',()=>{const p=flatPair();p.latest.kind='measured';p.latest.source='device_numeric_export';assert.throws(()=>R.analyze(p),/cannot be combined/);});
test('Nearby vs apart spatial patterns give different shared area',()=>{const together=R.analyze(R.demo('OS','together')),apart=R.analyze(R.demo('OS','apart'));assert.ok(together.shared_area>.2);near(apart.shared_area,0);for(let i=0;i<3;i++)assert.ok(Math.abs(together.regions[i].area-apart.regions[i].area)<.15);near(R.analyze(R.demo('OD')).shared_area,0);});
test('Imported pair and limits are not mutated; normalized pair roundtrips',()=>{const p=flatPair(),before=JSON.stringify(p),limits={...R.DEFAULTS};R.analyze(p,limits);assert.equal(JSON.stringify(p),before);assert.deepEqual(limits,R.DEFAULTS);near(R.analyze(R.validatePair(p)).shared_area,4);});
test('Audit explicitly remains descriptive and retains source kind',()=>{const a=R.audit(R.analyze(flatPair()));assert.equal(a.kind,'synthetic');assert.match(a.interpretation,/No repeatability calibration/);assert.equal(a.eye,'OD');assert.ok(!('probability' in a));});
console.log(`${count} regional calculation checks passed.`);

const I=require('../components/image_regions.js');
function imageMap(id,value,half=.1,unit=id==='thickness'?'µm':'mm') {return {schema:'nkpi-report-image-map-1',id,unit,map_type:id==='thickness'?'pachymetry':'axial',source:'report_color_estimate',diameter_mm:9,registration:'printed_plot_circle',extent:2/3,grid:Array.from({length:41},(_,j)=>Array.from({length:41},(_,i)=>Math.hypot(i-20,j-20)<=20?{value,lo:value-half,hi:value+half}:null))};}
test('Image estimates: identical inputs yield no highlighted changes',()=>{const a=[imageMap('anterior',7),imageMap('posterior',5)];near(I.compare(a,a).sharedFraction,0);});
test('Image estimates: resolved radius decrease and thinning share direction',()=>{const a=[imageMap('anterior',7),imageMap('thickness',500,5)],b=[imageMap('anterior',6.5),imageMap('thickness',480,5)],r=I.compare(a,b);near(r.sharedFraction,1);near(r.summaries[0].fraction,1);near(r.summaries[1].fraction,1);});
test('Image estimates: overlapping color bins do not claim resolution',()=>{const r=I.compare([imageMap('anterior',7)],[imageMap('anterior',6.95)]);near(r.summaries[0].fraction,0);assert.equal(r.sharedFraction,null);});
test('Image estimates: mismatched visit diameters cannot compare',()=>{const a=imageMap('anterior',7),b=copy(a);b.diameter_mm=8;assert.throws(()=>I.compare([a],[b]));});
test('Equivalent radius and D scans have zero point-estimate change',()=>{const a=imageMap('anterior',7),b=imageMap('anterior',337.5/7,.1,'D');const r=I.compare([a],[b]);near(r.summaries[0].mean,0);assert.equal(r.layers[0].unit,'D');assert.equal(r.summaries[0].peak,null);});
test('Radius conversion preserves nonlinear interval ordering',()=>{const v=I.canonicalValue({value:5,lo:4.9,hi:5.1},'posterior','mm');near(v.value,8);near(v.lo,40/5.1);near(v.hi,40/4.9);assert.equal(I.canonicalValue({value:1,lo:0,hi:2},'posterior','mm'),null);});
test('Cross-layer aperture mismatch never claims shared tissue location',()=>{const a=[imageMap('anterior',7),imageMap('thickness',500,5)],b=[imageMap('anterior',6.5),imageMap('thickness',480,5)];a[1].diameter_mm=b[1].diameter_mm=8;const r=I.compare(a,b);assert.equal(r.layers.length,2);assert.equal(r.sharedGeometry,false);assert.equal(r.sharedFraction,null);near(r.commonCoverage,0);});
test('Image estimates: insufficient shared samples are unavailable',()=>{const a=imageMap('anterior',7),b=copy(a);for(let j=0;j<41;j++)for(let i=0;i<41;i++)if(i<30)b.grid[j][i]=null;assert.throws(()=>I.compare([a],[b]));});
test('Image estimates: invalid intervals and wrong map definitions are rejected',()=>{let a=imageMap('anterior',7);a.grid[20][20].lo=8;assert.throws(()=>I.validateMap(a));a=imageMap('thickness',500);a.unit='D';assert.throws(()=>I.validateMap(a));});
test('Image estimates: signed posterior D and interval crossing zero',()=>{const v=I.change({value:-6,lo:-6.1,hi:-5.9},{value:-7,lo:-7.1,hi:-6.9},'posterior','D');near(v.value,1);assert(v.lo>0);const z=I.change({value:0,lo:-1,hi:1},{value:2,lo:1.5,hi:2.5},'posterior','D');near(z.hi,2.5);});
test('Image estimates: blank / nonmonotonic legends fail closed',()=>{assert.throws(()=>I.validateAnchors([],'anterior','mm',{y:0,h:100}));const a=Array.from({length:16},(_,i)=>({y:i*6,value:7}));assert.throws(()=>I.validateAnchors(a,'anterior','mm',{y:0,h:100}));});
test('Image estimates: obscured colors missing; per-legend scale matters',()=>{assert.equal(I.decodeColor([255,255,255],[]),null);const rgb=[230,30,50],a=I.decodeColor(rgb,[{rgb,value:50,step:1}]),b=I.decodeColor(rgb,[{rgb,value:60,step:1}]);near(a.value,50);near(b.value,60);assert(I.change(a,b,'anterior','D').lo>0);});
console.log(`${count} total regional/image checks passed.`);

function localizedPair(sign=1){const a=imageMap('anterior',50,.01,'D'),b=copy(a);for(let j=0;j<41;j++)for(let i=0;i<41;i++){if(!b.grid[j][i])continue;const bump=sign*3*Math.exp(-((i-25)**2+(j-24)**2)/12);b.grid[j][i]={value:50+bump,lo:49.99+bump,hi:50.01+bump};}return [a,b];}
test('Circle tracks a known local maximum in physical coordinates',()=>{const [a,b]=localizedPair(),r=I.compare([a],[b]),p=r.summaries[0].peak;assert(p);near(p.x_mm,.75);near(p.y_mm,.6);near(p.radius_mm,.4);assert(p.mean>2);assert(p.coverage>=.85);});
test('Flat, opposite-only and identical scans receive no positive circle',()=>{let [a,b]=localizedPair(-1);assert.equal(I.compare([a],[b]).summaries[0].peak,null);b=imageMap('anterior',53,.01,'D');assert.equal(I.compare([a],[b]).summaries[0].peak,null);assert.equal(I.compare([a],[a]).summaries[0].peak,null);});
test('Missing peak data never get filled or counted as a zero',()=>{const [a,b]=localizedPair();for(let j=20;j<=28;j++)for(let i=21;i<=29;i++)b.grid[j][i]=null;const r=I.compare([a],[b]),p=r.summaries[0].peak;assert(!r.cells.find(c=>c.i===25&&c.j===24).values.anterior);assert(!p||Math.hypot(p.x_mm-.75,p.y_mm-.6)>.5);});
test('Image comparison preserves inputs and records unavailable layers',()=>{const [a,b]=localizedPair(),before=JSON.stringify([a,b]),r=I.compare([a],[b]);assert.equal(JSON.stringify([a,b]),before);assert.equal(r.unavailable.length,2);assert.deepEqual(r.layers[0].source_units,['D','D']);});
test('Plus signs are read as crosses, not dropped as unknown digits',()=>{const g={w:5,h:5,row_h:9,top:3,bottom:7,data:[[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0]]};assert.equal(I.readGlyph(g),'+');});
console.log(`${count} total regional/image checks passed.`);
test('Legend calibration follows swatch colors, not displaced text centers',()=>{
 const width=60,height=210,data=new Uint8ClampedArray(width*height*4).fill(255),put=(x,y,c)=>{const k=(y*width+x)*4;data[k]=c[0];data[k+1]=c[1];data[k+2]=c[2];};
 for(let y=0;y<height;y++)for(let x=39;x<49;x++)put(x,y,[220,20+y,50]);
 const anchors=Array.from({length:10},(_,i)=>({y:10+i*20,value:10+i}));
 for(const p of anchors)for(let y=p.y-2;y<=p.y+2;y++)for(let x=2;x<8;x++)put(x,y,[220,24+p.y,50]);
 const palette=I.palette({width,height,data},{x:0,y:0,w:50,h:210},anchors);
 for(const p of anchors.slice(0,9)){const at=palette.find(v=>v.y===p.y+4);assert(at);near(at.value,p.value);}
});
console.log(`${count} total regional/image checks passed.`);

test('Mixed posterior D/radius visits display comparable positive magnitudes',()=>{const a=imageMap('posterior',-8,.1,'D'),b=imageMap('posterior',5,.01,'mm'),r=I.compare([a],[b]),v=r.cells.find(c=>c.i===20&&c.j===20).values.posterior;near(v.value,0);near(v.first,8);near(v.latest,8);});
console.log(`${count} total regional/image checks passed.`);

const Shape=require('../components/cornea/patient_shape.js');
function imageShape(){return {schema:'nkpi-image-shape-1',source:'report_elevation_estimate',reference:'centered_untilted_float_bfs',bfs_radius_mm:7.8,fit_diameter_mm:8,diameter_mm:9,extent:2/3,elevation_um:Array.from({length:41},(_,j)=>Array.from({length:41},(_,i)=>Math.hypot(i-20,j-20)<=20?{value:0,lo:-2.5,hi:2.5}:null)),legend_step_um:5};}
test('3D image geometry uses BFS sag and normal thickness, without a generic cone',()=>{const shape=imageShape(),t=imageMap('thickness',500,5),m=Shape.imageModel(shape,t);const center=m.vertices[20*41+20];near(center.front[2],0);near(center.back[2],-.5);for(const v of m.vertices.filter(Boolean)){near(Math.hypot(...v.front.map((x,i)=>x-v.back[i])),v.thickness/1000,1e-8);near(v.front[2],Math.sqrt(7.8**2-v.front[0]**2-v.front[1]**2)-7.8,1e-8);}assert(m.triangles.length>1500);});
test('3D image estimate preserves absent regions and does not mutate source grids',()=>{const shape=imageShape(),t=imageMap('thickness',500,5);for(let j=15;j<=25;j++)for(let i=15;i<=25;i++)shape.elevation_um[j][i]=null;const before=JSON.stringify(shape),m=Shape.imageModel(shape,t);assert.equal(m.vertices[20*41+20],null);assert.equal(JSON.stringify(shape),before);});
test('3D rejects mismatched diameter, insufficient coverage and non-height native data',()=>{const shape=imageShape(),t=imageMap('thickness',500,5);t.diameter_mm=8;assert.throws(()=>Shape.imageModel(shape,t));shape.elevation_um=shape.elevation_um.map(r=>r.map(()=>null));assert.throws(()=>I.validateShape(shape));assert.throws(()=>Shape.nativeModel(R.demo().first,'OS','first'));});
test('3D native geometry handles laterality and z convention without synthetic substitution',()=>{const n=R.demo('OD').first;n.schema='nkpi-corneal-surface-1';n.kind='measured';n.source='device_numeric_export';n.anterior.z_mm=n.y_mm.map(y=>n.x_mm.map(x=>Math.hypot(x,y)<=3?-.02*(x*x+y*y):null));n.posterior.z_mm=n.anterior.z_mm.map(r=>r.map(v=>v===null?null:v-.5));const m=Shape.nativeModel(n,'OD','first');assert.equal(m.kind,'native');const v=m.vertices.find(v=>v&&v.front[0]>2);assert(v);assert(v.back[2]<v.front[2]);assert.throws(()=>Shape.nativeModel(n,'OS','first'));n.kind='synthetic';n.source='synthetic_fixture';assert.throws(()=>Shape.nativeModel(n,'OD','first'));});
console.log(`${count} total regional/image/3D checks passed.`);

test('Local color recovery restores narrow ink without filling missing regions',()=>{
 const width=101,height=101,color=[220,40,80],data=new Uint8ClampedArray(width*height*4).fill(255),palette=[{rgb:color,value:50,step:1}],im={width,height,data},c={r:100};
 const paint=(x0,y0,x1,y1,rgb)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=(y*width+x)*4;data[i]=rgb[0];data[i+1]=rgb[1];data[i+2]=rgb[2];}};
 paint(0,0,100,100,color);let v=I.sampleColor(im,c,palette,50,50);assert.equal(v.sampling,'direct');near(v.value,50);
 paint(50,0,50,100,[0,0,0]);v=I.sampleColor(im,c,palette,50,50);assert.equal(v.sampling,'local_color');near(v.value,50);
 paint(44,44,56,56,[255,255,255]);assert.equal(I.sampleColor(im,c,palette,50,50),null);
 paint(0,0,100,100,[255,255,255]);paint(51,0,100,100,color);assert.equal(I.sampleColor(im,c,palette,50,50),null);
});
test('Local recovery rejects incompatible colors on either side of an occlusion',()=>{
 const width=101,height=101,data=new Uint8ClampedArray(width*height*4).fill(255),colors=[[220,40,80],[30,220,70]],p=colors.map((rgb,i)=>({rgb,value:50+i*20,step:1}));
 for(let y=0;y<101;y++)for(let x=0;x<101;x++){const c=x===50?[0,0,0]:colors[x>50?1:0],i=(y*width+x)*4;data[i]=c[0];data[i+1]=c[1];data[i+2]=c[2];}
 assert.equal(I.sampleColor({width,height,data},{r:100},p,50,50),null);
});
test('Coverage distinguishes direct and locally recovered paired samples',()=>{
 const a=imageMap('anterior',50,.1,'D'),b=copy(a);b.grid[20][20].sampling='local_color';const r=I.compare([a],[b]);near(r.summaries[0].coverage,r.summaries[0].directCoverage+r.summaries[0].recoveredCoverage);near(r.summaries[0].recoveredCoverage,1/1257);near(r.summaries[0].mean,0);
});
test('Plot tag parser requires units and never substitutes a BFS fitting diameter',()=>{
 assert.equal(I.parseDiameter('9mm'),9);assert.equal(I.parseDiameter(' 10 mm '),10);assert.equal(I.parseDiameter('3mm'),null);assert.equal(I.parseDiameter('Dia=8.00'),null);assert.equal(I.parseDiameter('9'),null);assert.equal(I.parseDiameter('BFS 7.49 Float'),null);
});
console.log(`${count} total regional/image/3D checks passed.`);
test('Colored alignment ink cannot masquerade as an isolated tissue peak',()=>{
 const width=101,height=101,data=new Uint8ClampedArray(width*height*4).fill(255),colors=[[220,40,80],[30,30,220]],p=colors.map((rgb,i)=>({rgb,value:500+i*250,step:10}));
 for(let y=0;y<101;y++)for(let x=0;x<101;x++){const c=colors[Math.abs(x-50)<=1?1:0],i=(y*width+x)*4;data[i]=c[0];data[i+1]=c[1];data[i+2]=c[2];}
 assert.equal(I.sampleColor({width,height,data},{r:100},p,50,50),null);
});
console.log(`${count} total regional/image/3D checks passed.`);

test('3D map overlays use physical coordinates and do not change geometry',()=>{
 const m=Shape.imageModel(imageShape(),imageMap('thickness',500,5)),before=JSON.stringify(m.vertices.map(v=>v&&[v.front,v.back]));
 const anterior=imageMap('anterior',7.5,.01,'mm'),posterior=imageMap('posterior',-6,.1,'D');
 for(let j=0;j<41;j++)for(let i=0;i<41;i++)if(anterior.grid[j][i]){const v=7+i*.01;anterior.grid[j][i]={value:v,lo:v-.005,hi:v+.005};}
 Shape.addImageOverlays(m,[anterior,posterior]);const center=m.vertices[20*41+20];near(center.anterior,337.5/7.2);near(center.posterior,6);
 assert(m.vertices[20*41+25].anterior<m.vertices[20*41+15].anterior);assert.equal(JSON.stringify(m.vertices.map(v=>v&&[v.front,v.back])),before);
});
test('3D overlay preserves missing values and converts diameters without stretching',()=>{
 const m=Shape.imageModel(imageShape(),imageMap('thickness',500,5)),anterior=imageMap('anterior',50,.5,'D');anterior.diameter_mm=6;
 anterior.grid[20][20]=null;Shape.addImageOverlays(m,[anterior]);assert.equal(m.vertices[20*41+20].anterior,null);assert(!Number.isFinite(m.vertices[20*41+38]?.anterior));
});
test('3D smooth normals do not change normal-offset thickness',()=>{
 const m=Shape.imageModel(imageShape(),imageMap('thickness',500,5));for(const v of m.vertices.filter(Boolean)){assert(v.frontNormal[2]>0);assert(v.backNormal[2]<0);near(Math.hypot(...v.frontNormal),1);near(Math.hypot(...v.front.map((q,i)=>q-v.back[i])),.5);}
});
test('3D display trim stays inside supported triangles without filling central holes',()=>{
 const shape=imageShape();for(let j=15;j<26;j++)for(let i=15;i<26;i++)shape.elevation_um[j][i]=null;
 const m=Shape.imageModel(shape,imageMap('thickness',500,5)),d=Shape.displayMesh(m);assert(d.displayRadius<m.radius);assert(d.vertices.every(v=>Math.hypot(v.front[0],v.front[1])>.3));
 for(const v of d.vertices){assert(m.vertices[v.sourceId]);assert(Math.hypot(v.front[0],v.front[1])<=d.displayRadius/Math.cos(Math.PI/96)+1e-7);}
 assert(d.triangles.length>500);assert.equal(Shape.displayMesh(m),d);
});
test('3D projection keeps equal spatial units and cutaway never adds tissue',()=>{
 const m=Shape.imageModel(imageShape(),imageMap('thickness',500,5)),state={yaw:0,pitch:0,zoom:1};const o=[0,0,m.centerZ],p=Shape.project(m,o,state),x=Shape.project(m,[1,0,m.centerZ],state),y=Shape.project(m,[0,1,m.centerZ],state);near(x[0]-p[0],p[1]-y[1]);
 const whole=Shape.meshFaces(m,false),cut=Shape.meshFaces(m,true);assert(cut.length<whole.length);assert(cut.filter(f=>f.side==='front').every(f=>f.ids.every(i=>m.vertices[i].front[0]<=1e-8)));
});
console.log(`${count} total regional/image/3D checks passed.`);
test('Native corneal view retains a wider supplied aperture and optional posterior elevation',()=>{
 const s=R.demo('OD').first;s.schema='nkpi-corneal-surface-1';s.kind='measured';s.source='device_numeric_export';s.x_mm=Array.from({length:21},(_,i)=>(i-10)*.5);s.y_mm=[...s.x_mm];
 const g=fn=>s.y_mm.map(y=>s.x_mm.map(x=>Math.hypot(x,y)<=5?fn(x,y):null));
 s.anterior={z_mm:g((x,y)=>Math.sqrt(64-x*x-y*y)-8)};
 s.posterior={z_mm:g((x,y)=>Math.sqrt(64-x*x-y*y)-8.5),elevation_um:g(()=>3),elevation_reference:{type:'best_fit_sphere',fit_diameter_mm:8}};
 s.thickness_um=g(()=>500);const m=Shape.nativeModel(s,'OD','first');assert.equal(m.radius,5);assert(m.vertices.some(v=>v&&Math.abs(v.front[0])>3));assert(m.overlays.some(l=>l.id==='posterior_elevation'));assert(!m.overlays.some(l=>l.id==='anterior'));
});
console.log(`${count} total regional/image/3D checks passed.`);

function coneFixture({shift=0,gain=0,width=.65,missing=false}={}){const cells=[];for(let j=0;j<41;j++)for(let i=0;i<41;i++){const x=(i-20)*.15,y=(j-20)*.15;if(Math.hypot(x,y)>3)continue;const g=(cx,w)=>Math.exp(-((x-cx)**2+(y-.4)**2)/(2*w*w));const a=45+8*g(.3,.65),b=45+(8+gain)*g(.3+shift,width),blank=missing&&x<-.5;cells.push({i,j,x,y,area:.0225,first:blank?null:a,latest:blank?null:b,error:0});}return cells;}
test('Cone tracker: identical scans retain area, center and zero fixed-region change',()=>{const cells=coneFixture(),before=JSON.stringify(cells),t=R.coneTrack(cells,'anterior');assert(t.available);near(t.first_area,t.latest_area);near(t.change,0);near(t.displacement,0);near(t.added_area,0);assert.equal(JSON.stringify(cells),before);});
test('Cone tracker: expansion uses a locked baseline threshold and same footprint for change',()=>{const a=R.coneTrack(coneFixture(),'anterior'),b=R.coneTrack(coneFixture({width:1}),'anterior');near(a.threshold,b.threshold);near(a.first_area,b.first_area);assert(b.latest_area>b.first_area);assert(b.added_area>0);assert(b.change>0);near(b.latest_area-b.first_area,b.added_area-b.lost_area);});
test('Cone tracker: translation is detected in physical mm without inferring tissue motion',()=>{const t=R.coneTrack(coneFixture({shift:.3}),'anterior');assert(t.available);assert(Math.abs(t.displacement-.3)<.08);assert(t.latest_center.x>t.first_center.x);});
test('Cone tracker: missing coverage and flat maps do not create cones',()=>{const flat=coneFixture().map(c=>({...c,first:45,latest:46}));assert(!R.coneTrack(flat,'anterior').available);const missing=coneFixture().map(c=>({...c,first:c.x<1?null:c.first}));assert(!R.coneTrack(missing,'anterior').available);const same=R.coneTrack(coneFixture({missing:true}),'anterior');assert(same.available);near(same.first_area,same.latest_area);near(same.change,0);});
test('Cone tracker: thickness direction and image resolution stay explicit',()=>{const c=coneFixture({gain:2}).map(c=>({...c,first:600-c.first*2,latest:600-c.latest*2,error:80})),t=R.coneTrack(c,'thickness',{image:true});assert(t.available&&t.resolution_limited);assert(t.change>0);assert(t.latest_area>t.first_area);assert(t.threshold>0);assert.match(R.coneHTML([t],180,'OD','thickness'),/below color-bin resolution/);});
test('Cone tracker: unrelated latest region is not silently matched',()=>{const t=R.coneTrack(coneFixture({shift:2.3}),'anterior');assert(t.available);assert.equal(t.latest_area,0);assert.equal(t.latest_center,null);assert.equal(t.displacement,null);});
test('Reference anatomy never modifies patient vertices or fabricates data fields',()=>{const m=Shape.imageModel(imageShape(),imageMap('thickness',500,5)),before=JSON.stringify(m.vertices),ref=Shape.referenceEye(m);assert(ref.faces.length>1000);assert.equal(JSON.stringify(m.vertices),before);assert(ref.faces.every(f=>f.reference&&!f.sourceId));const empty=Shape.fromReport({image_maps:[]});assert.equal(empty.kind,'reference');assert(empty.vertices.filter(Boolean).every(v=>v.thickness===null&&v.back===null));assert.deepEqual(empty.overlays.map(v=>v.id),['shape']);});
test('Reference fallback uses thickness but never converts curvature into cone height',()=>{const a=Shape.fromReport({image_maps:[imageMap('anterior',60,.1,'D'),imageMap('thickness',450,5)]}),b=Shape.fromReport({image_maps:[imageMap('anterior',40,.1,'D'),imageMap('thickness',550,5)]});assert.equal(a.kind,'reference');assert.deepEqual(a.vertices.filter(Boolean).map(v=>v.front),b.vertices.filter(Boolean).map(v=>v.front));assert(a.vertices.filter(Boolean).every(v=>Math.abs(Math.hypot(...v.front.map((q,k)=>q-v.back[k]))-.45)<1e-8));});
console.log('Cone and reference-eye checks complete.');
test('Cone tracker: native OD and OS preserve correct nasal/temporal orientation',()=>{const os=R.demo('OS'),od=copy(os);od.first.eye=od.latest.eye='OD';const a=R.numericTracks(R.analyze(os))[0],b=R.numericTracks(R.analyze(od))[0];near(a.first_center.x,-b.first_center.x);near(a.first_center.y,b.first_center.y);near(a.first_area,b.first_area);near(a.change,b.change);});
console.log('56 regional/image/3D/cone test groups passed.');
