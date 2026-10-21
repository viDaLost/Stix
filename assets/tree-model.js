export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const mix=(a,b,t)=>a+(b-a)*t;
export const ease=t=>{const p=clamp(t);return p*p*p*(p*(p*6-15)+10);};
export const HEART_PATH='M0 .85C-.18 .69-1 .13-1-.36C-1-.96-.25-1.04 0-.48C.25-1.04 1-.96 1-.36C1 .13.18 .69 0 .85Z';
export const COLORS=['#bd3156','#d74464','#e65d79','#ed7f94','#ee9aa9','#cf4c69','#b94560','#f1afba','#db6a85','#e88c9f'];
export function random(seed=2811){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}

// Gravity above ground, then continuous deceleration in the soil. No rebound.
export function createFall(distance=1,gravity=5.6,soilDepth=distance*.32){
  if(![distance,gravity,soilDepth].every(n=>Number.isFinite(n)&&n>0))throw new RangeError('Invalid fall parameters');
  const impact=Math.sqrt(2*distance/gravity),speed=gravity*impact,drag=speed/soilDepth;
  const duration=impact+Math.log(200)/drag;
  function at(seconds){
    const t=Math.max(0,seconds);
    if(t<impact)return{y:.5*gravity*t*t,velocity:gravity*t,entered:false,buried:false};
    const age=t-impact,decay=Math.exp(-drag*age);
    return{y:distance+soilDepth*(1-decay),velocity:speed*decay,entered:true,buried:t>=duration};
  }
  return{impact,duration,at};
}
export const FALL=createFall();
export const GROW_AT=FALL.impact;
export const GROWTH_RATE=4.6,LEAF_UNFURL_RATE=1.8;
export const MATURE_AT=GROW_AT+3.8;
export const COMPOSE_AT=GROW_AT+.18,COMPOSE_DURATION=2.4;
export const LEAF_FALL_PERIOD=44,LEAF_FALL_COUNT=78;
export const branchProgress=(b,time)=>ease((time-b.born)/b.duration);
function inverseEase(value){let a=0,b=1;for(let i=0;i<28;i++){const m=(a+b)/2;if(ease(m)<value)a=m;else b=m;}return(a+b)/2;}
export function pointOn(b,t){const u=1-t;return{x:u**3*b.a.x+3*u*u*t*b.b.x+3*u*t*t*b.c.x+t**3*b.d.x,y:u**3*b.a.y+3*u*u*t*b.b.y+3*u*t*t*b.c.y+t**3*b.d.y};}
export function insidePolygon(x,y,polygon){
  let yes=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)yes=!yes;
  }
  return yes;
}

export function createTree(seed=2811){
  const rng=random(seed),branches=[],leaves=[],stretch=1.26;
  const center={x:0,y:-395};
  const hull=Array.from({length:160},(_,i)=>{const a=i/160*Math.PI*2;return{x:16*Math.sin(a)**3*13.7,y:-395-(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))*10.3};});
  const within=(p,inset=0)=>insidePolygon(center.x+(p.x-center.x)/(1-inset),center.y+(p.y-center.y)/(1-inset),hull);
  function contain(p,inset=.075){
    if(within(p,inset))return p;
    let lo=0,hi=1;
    for(let i=0;i<22;i++){
      const m=(lo+hi)/2,q={x:mix(center.x,p.x,m),y:mix(center.y,p.y,m)};
      if(within(q,inset))lo=m;else hi=m;
    }
    return{x:mix(center.x,p.x,lo),y:mix(center.y,p.y,lo)};
  }
  const add=(a,b,c,d,width,tip,born,duration,parent=null,attach=0)=>{
    if(parent!==null){b=contain(b);c=contain(c);d=contain(d);}
    const branch={id:branches.length,a,b,c,d,width,tip,born,duration,parent,attach};branches.push(branch);return branch;
  };
  const trunk=add({x:0,y:0},{x:11,y:-81},{x:-16,y:-174},{x:4,y:-249},48,18,0,3.35);
  const leftAttach=.94,leftStart=pointOn(trunk,leftAttach);
  const left=add(leftStart,{x:leftStart.x+2,y:leftStart.y-64},{x:-127,y:-359},{x:-158,y:-421},14.4,1.5,inverseEase(leftAttach)*trunk.duration,3.55,0,leftAttach);
  const right=add({...trunk.d},{x:16,y:-309},{x:121,y:-350},{x:154,y:-407},12.6,1.35,trunk.duration,3.75,0,1);
  const specs=[
    [left,.4,-192,-415,6.4],[left,.62,-104,-478,6],[left,.82,-39,-444,4.5],
    [right,.38,196,-415,6.5],[right,.6,106,-482,6],[right,.8,35,-444,4.6]
  ];
  const leaders=[left,right];
  for(const[parent,attach,x,y,width]of specs){
    const a=pointOn(parent,attach),d=contain({x,y}),dx=d.x-a.x,dy=d.y-a.y;
    const b=contain({x:a.x+dx*.2,y:a.y+dy*.5}),c=contain({x:a.x+dx*.8,y:a.y+dy*.67});
    leaders.push(add(a,b,c,d,width,1,parent.born+inverseEase(attach)*parent.duration,2.1+rng()*.6,parent.id,attach));
  }
  function ramify(parent,depth){
    if(!depth)return;
    const slots=depth===2?[.38,.64,.88]:[.64,.91];
    for(let i=0;i<slots.length;i++){
      const attach=slots[i],a=pointOn(parent,attach),next=pointOn(parent,Math.min(1,attach+.02));
      const heading=Math.atan2(next.y-a.y,next.x-a.x),side=i%2?1:-1;
      const angle=clamp(heading+side*(.35+rng()*.48),-Math.PI+.16,-.16),length=(depth===2?45:24)*(.7+rng()*.55);
      const d=contain({x:a.x+Math.cos(angle)*length,y:a.y+Math.sin(angle)*length});
      const b=contain({x:a.x+Math.cos(heading)*length*.3,y:a.y+Math.sin(heading)*length*.3});
      const c=contain({x:d.x-Math.cos(angle+side*.12)*length*.28,y:d.y-Math.sin(angle+side*.12)*length*.28});
      const width=mix(parent.width,parent.tip,attach)*(.55+rng()*.08);
      const child=add(a,b,c,d,width,Math.min(.35,width*.24),parent.born+inverseEase(attach)*parent.duration,1.1+rng()*.45,parent.id,attach);
      ramify(child,depth-1);
    }
  }
  leaders.forEach(b=>ramify(b,2));
  // Only branches own leaves. The bare trunk never participates in leaf placement.
  const samples=branches.slice(1).flatMap(b=>Array.from({length:16},(_,i)=>{const t=.08+i*.92/15;return{...pointOn(b,t),branch:b,t};}));
  function leaf(x,y,nearest,size){
    const colorIndex=Math.floor(rng()*COLORS.length),base=nearest.branch.born+inverseEase(nearest.t)*nearest.branch.duration;
    leaves.push({id:leaves.length,x,y,size:size??(5+rng()*4.5),angle:(rng()-.5)*1.3,colorIndex,color:COLORS[colorIndex],
      branchId:nearest.branch.id,born:base+.3+rng()*.9,phase:rng()*Math.PI*2,depth:rng(),duration:1.35+rng()*.55});
  }
  let attempts=0;
  while(leaves.length<1180&&attempts++<22000){
    const x=(rng()*2-1)*219,y=-525+rng()*300;
    if(!within({x,y},.012))continue;
    let nearest,min=Infinity;
    for(const p of samples){const d=(p.x-x)**2+(p.y-y)**2;if(d<min){min=d;nearest=p;}}
    leaf(x,y,nearest);
  }
  // Small clusters on all tips prevent bare twigs protruding through the crown.
  for(const b of branches.slice(1))for(const t of [.72,.94,1]){
    const p=pointOn(b,t);
    if(within(p,.015))leaf(p.x,p.y,{branch:b,t},5.8+rng()*2.5);
  }
  // The whole skeleton keeps its connected growth order at a much faster pace.
  for(const b of branches){b.born/=GROWTH_RATE;b.duration/=GROWTH_RATE;}
  for(const l of leaves){l.born/=GROWTH_RATE;l.duration/=LEAF_UNFURL_RATE;}
  leaves.sort((a,b)=>a.depth-b.depth);
  for(const b of branches)for(const p of[b.a,b.b,b.c,b.d])p.y*=stretch;
  for(const l of leaves)l.y*=stretch;
  const crown=hull.map(p=>({x:p.x,y:p.y*stretch}));
  return{branches,leaves,crown,maxBloom:Math.max(...leaves.map(l=>l.born+l.duration))};
}

export function layout(width,height,time=Infinity){
  const wide=width/height>1.2,p=ease((time-COMPOSE_AT)/COMPOSE_DURATION);
  const finalX=wide?width*.285:width*.5,finalGround=height*(wide?.855:.575);
  const scale=Math.max(.08,Math.min((wide?width*.43:width-38)/500,height*(wide?.75:.49)/700,1.25));
  return{width,height,wide,scale,compose:p,x:mix(width*.5,finalX,p),ground:mix(height*.79,finalGround,p),
    groundWidth:mix(width*.84,wide?width*.48:width*.82,p)};
}

export function leafLandingTime(leaf,ground=0){
  const terminal=23+leaf.depth*12,drag=.85,distance=Math.max(0,ground-3-leaf.y);
  let t=distance/terminal+1/drag;
  for(let i=0;i<4;i++)t=Math.max(.001,t-(terminal*(t-(1-Math.exp(-drag*t))/drag)-distance)/Math.max(.001,terminal*(1-Math.exp(-drag*t))));
  return t;
}
export function driftingLeaf(age,leaf,ground=0){
  const terminal=23+leaf.depth*12,drag=.85,landingAge=leaf.landingTime??leafLandingTime(leaf,ground);
  const t=Math.min(Math.max(0,age),landingAge),envelope=ease(t/1.25),phase=leaf.phase;
  const fall=terminal*(t-(1-Math.exp(-drag*t))/drag),windTime=t-(1-Math.exp(-t*.65))/.65;
  const x=leaf.x+windTime*(5+leaf.depth*5)+(Math.sin(t*1.45+phase)-Math.sin(phase))*10*envelope;
  const landing=ease((age-landingAge+.2)/.9),rotation=leaf.angle+(Math.sin(t*1.7+phase)-Math.sin(phase))*.65*envelope+t*.1;
  const flip=.22+.78*Math.sqrt((Math.cos(t*1.3+phase)**2+.015)/1.015);
  return{x,y:Math.min(ground-3,leaf.y+fall),rotation:mix(rotation,.6,landing),
    squash:mix(mix(1,flip,envelope),.62,landing),settled:age>=landingAge,alpha:1-ease((age-landingAge-4)/3)};
}
