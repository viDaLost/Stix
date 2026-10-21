import { clamp,mix,ease,HEART_PATH,COLORS,FALL,GROW_AT,MATURE_AT,createFall,createTree,pointOn,branchProgress,layout,driftingLeaf,leafLandingTime } from './tree-model.js?v=2.2.0';

const BUFFER={width:600,height:740,x:300,y:704},SPRITE=32,PERIOD=44,FALL_COUNT=26;
export function createScene(canvas){
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx)throw new Error('Canvas is unavailable');
  const heart=new Path2D(HEART_PATH),tree=createTree();
  const wood=document.createElement('canvas'),crown=document.createElement('canvas'),atlas=document.createElement('canvas');
  const wc=wood.getContext('2d'),lc=crown.getContext('2d'),ac=atlas.getContext('2d');
  let width=1,height=1,ratio=1,cacheRatio=1,finishedWood=false,finishedCrown=false,seedSize=76/2.4;
  let seedFall,generation=0,woodSource=wood,crownSource=crown,atlasSource=atlas;
  function snapshot(buffer,ready,scoped=true){
    if(typeof createImageBitmap!=='function')return;
    const tag=generation;
    createImageBitmap(buffer).then(bitmap=>{if(!scoped||tag===generation)ready(bitmap);else bitmap.close?.();}).catch(()=>{});
  }
  const windAt=t=>Math.sin(t*.51)*.0016*ease((t-GROW_AT)/5);
  const slots=Array.from({length:FALL_COUNT},(_,i)=>({leaf:tree.leaves[Math.floor((i+.37)*tree.leaves.length/FALL_COUNT)],cycle:-1}));
  const animatedIds=new Set(slots.map(s=>s.leaf.id));
  for(const l of tree.leaves){l.cos=Math.cos(l.angle);l.sin=Math.sin(l.angle);}

  // Rasterize ten tiny vector hearts once. Growing leaves use cheap image stamps.
  atlas.width=SPRITE*COLORS.length;atlas.height=SPRITE;
  COLORS.forEach((color,i)=>{
    ac.save();ac.translate((i+.5)*SPRITE,SPRITE*.5);ac.scale(SPRITE/2.4,SPRITE/2.4);
    ac.strokeStyle='#89605166';ac.lineWidth=.035;ac.beginPath();ac.moveTo(0,-.65);ac.lineTo(-.04,-1.03);ac.stroke();
    ac.fillStyle=color;ac.fill(heart);
    ac.fillStyle='#fff5ee24';ac.beginPath();ac.ellipse(-.4,-.41,.14,.22,-.5,0,Math.PI*2);ac.fill();ac.restore();
  });
  snapshot(atlas,bitmap=>{atlasSource=bitmap;},false);
  function outline(b,progress){
    if(progress>=1)return b.path;
    const path=new Path2D(),left=[],right=[],step=1/44;
    const positions=[];for(let t=0;t<progress;t+=step)positions.push(t);positions.push(progress);
    for(const t of positions){
      const p=pointOn(b,t),a=pointOn(b,Math.max(0,t-.001)),z=pointOn(b,Math.min(1,t+.001));
      const angle=Math.atan2(z.y-a.y,z.x-a.x)+Math.PI/2;
      // A slender, rounded growing tip replaces the old flat cut.
      const tipWidth=mix(.08,1,ease((progress-.88)/.12));
      const taper=progress<1?mix(tipWidth,1,ease((progress-t)/.055)):1;
      const half=mix(b.width,b.tip,t)*.5*taper;
      left.push({x:p.x+Math.cos(angle)*half,y:p.y+Math.sin(angle)*half});
      right.push({x:p.x-Math.cos(angle)*half,y:p.y-Math.sin(angle)*half});
    }
    if(!left.length)return path;
    path.moveTo(left[0].x,left[0].y);for(const p of left.slice(1))path.lineTo(p.x,p.y);
    for(const p of right.reverse())path.lineTo(p.x,p.y);path.closePath();return path;
  }
  for(const b of tree.branches){
    // Build the complete outline without a frame-dependent segment count.
    const path=new Path2D(),left=[],right=[];
    for(let i=0;i<=44;i++){
      const t=i/44,p=pointOn(b,t),a=pointOn(b,Math.max(0,t-.001)),z=pointOn(b,Math.min(1,t+.001));
      const angle=Math.atan2(z.y-a.y,z.x-a.x)+Math.PI/2,half=mix(b.width,b.tip,t)*.5;
      left.push({x:p.x+Math.cos(angle)*half,y:p.y+Math.sin(angle)*half});right.push({x:p.x-Math.cos(angle)*half,y:p.y-Math.sin(angle)*half});
    }
    path.moveTo(left[0].x,left[0].y);for(const p of left.slice(1))path.lineTo(p.x,p.y);for(const p of right.reverse())path.lineTo(p.x,p.y);path.closePath();b.path=path;
    b.grain=Array.from({length:3},(_,j)=>{
      const p=new Path2D();for(let i=0;i<=32;i++){
        const t=i/32,q=pointOn(b,t),x=q.x+(j-1)*b.width*.18*(1-t)+Math.sin(t*12+j*2)*.6;
        if(i)p.lineTo(x,q.y);else p.moveTo(x,q.y);
      }return p;
    });
  }
  function updateFall(){
    const distance=Math.max(12,height*.29-seedSize*.85);
    seedFall=createFall(distance,distance*5.6,seedSize*2.18);
  }
  function invalidate(){
    generation++;if(woodSource!==wood)woodSource.close?.();if(crownSource!==crown)crownSource.close?.();
    woodSource=wood;crownSource=crown;finishedWood=finishedCrown=false;for(const slot of slots)slot.cycle=-1;
  }
  function resize(w,h,dpr=1){
    width=w;height=h;ratio=Math.min(dpr,1.75,Math.sqrt(1900000/(w*h)));
    canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
    cacheRatio=Math.max(.4,layout(w,h).scale*ratio);
    for(const buffer of[wood,crown]){buffer.width=Math.ceil(BUFFER.width*cacheRatio);buffer.height=Math.ceil(BUFFER.height*cacheRatio);}
    wc.setTransform(cacheRatio,0,0,cacheRatio,BUFFER.x*cacheRatio,BUFFER.y*cacheRatio);
    for(const b of tree.branches){
      const g=wc.createLinearGradient(b.a.x-b.width,b.a.y,b.a.x+b.width*1.4,b.a.y-25);
      g.addColorStop(0,'#654537');g.addColorStop(.38,'#886047');g.addColorStop(.72,'#a07b58');g.addColorStop(1,'#74503b');b.gradient=g;
    }
    invalidate();updateFall();
  }
  function clearBuffer(c,buffer){c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,buffer.width,buffer.height);c.setTransform(cacheRatio,0,0,cacheRatio,BUFFER.x*cacheRatio,BUFFER.y*cacheRatio);}
  function paintWood(growth){
    clearBuffer(wc,wood);
    const root=ease(growth/.9);wc.save();wc.scale(root,root);wc.fillStyle='#79563f';
    wc.beginPath();wc.moveTo(-24,-2);wc.bezierCurveTo(-23,-17,23,-17,24,-2);wc.quadraticCurveTo(34,0,43,0);wc.quadraticCurveTo(14,3,0,0);wc.quadraticCurveTo(-31,4,-43,0);wc.closePath();wc.fill();wc.restore();
    let complete=true;
    for(const b of tree.branches){
      const p=branchProgress(b,growth);if(p<1)complete=false;if(p<=0)continue;
      const path=outline(b,p);wc.fillStyle=b.gradient;wc.fill(path);
      if(b.width>6){
        wc.save();wc.clip(path);
        for(let j=0;j<3;j++){wc.strokeStyle=j===1?'#d4b08738':'#432e2929';wc.lineWidth=j===1?.8:.6;wc.stroke(b.grain[j]);}
        wc.restore();
      }
    }
    finishedWood=complete;if(complete)snapshot(wood,bitmap=>{woodSource=bitmap;});
  }
  function paintCrown(growth){
    lc.setTransform(1,0,0,1,0,0);lc.clearRect(0,0,crown.width,crown.height);
    for(const l of tree.leaves){
      if(animatedIds.has(l.id))continue;
      const p=ease((growth-l.born)/l.duration);if(p<=0)continue;
      const size=l.size*p;if(size<.3)continue;const k=cacheRatio*size;
      lc.setTransform(k*l.cos,k*l.sin,-k*l.sin,k*l.cos,(BUFFER.x+l.x)*cacheRatio,(BUFFER.y+l.y)*cacheRatio);
      lc.globalAlpha=(.82+l.depth*.18)*p;
      lc.drawImage(atlasSource,l.colorIndex*SPRITE,0,SPRITE,SPRITE,-1.2,-1.2,2.4,2.4);
    }
    lc.globalAlpha=1;finishedCrown=growth>=tree.maxBloom;if(finishedCrown)snapshot(crown,bitmap=>{crownSource=bitmap;});
  }
  function leafSprite(c,l,x,y,size,angle,alpha=1,squash=1){
    if(alpha<=0||size<.25)return;
    c.save();c.translate(x,y);c.rotate(angle);c.scale(size*squash,size);c.globalAlpha=alpha;
    c.drawImage(atlasSource,l.colorIndex*SPRITE,0,SPRITE,SPRITE,-1.2,-1.2,2.4,2.4);c.restore();
  }
  function fallers(t,still){
    return slots.map((slot,i)=>{
      const elapsed=t-MATURE_AT-i*PERIOD/FALL_COUNT;
      if(still||elapsed<0)return{leaf:slot.leaf,attached:1};
      const cycle=Math.floor(elapsed/PERIOD),age=elapsed%PERIOD;
      if(slot.cycle!==cycle){
        const l=slot.leaf,start=MATURE_AT+i*PERIOD/FALL_COUNT+cycle*PERIOD,a=windAt(start);
        slot.origin={...l,x:l.x*Math.cos(a)-l.y*Math.sin(a),y:l.x*Math.sin(a)+l.y*Math.cos(a),angle:l.angle+a};
        slot.origin.landingTime=leafLandingTime(slot.origin);slot.cycle=cycle;
      }
      return{leaf:slot.leaf,attached:ease((age-2)/2.4),...driftingLeaf(age,slot.origin)};
    });
  }
  function ground(box,t){
    const half=box.groundWidth*.5*ease(t/.75),x=box.x,y=box.ground;
    const g=ctx.createLinearGradient(x-half,y,x+half,y);
    g.addColorStop(0,'#b29a7b00');g.addColorStop(.16,'#b29a7b60');g.addColorStop(.5,'#9d80648c');g.addColorStop(.84,'#b29a7b60');g.addColorStop(1,'#b29a7b00');
    ctx.strokeStyle=g;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x-half,y+.5);ctx.bezierCurveTo(x-half*.5,y-1,x+half*.4,y+1,x+half,y);ctx.stroke();
    const p=ease((t-FALL.impact)/1.3);if(!p)return;
    ctx.save();ctx.translate(x,y+2);ctx.scale(box.scale,box.scale*.1);
    const shade=ctx.createRadialGradient(0,0,0,0,0,70);shade.addColorStop(0,'#79543b19');shade.addColorStop(1,'#79543b00');ctx.globalAlpha=p;ctx.fillStyle=shade;ctx.beginPath();ctx.arc(0,0,70,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function fallingSeed(box,t){
    const state=seedFall.at(t),y=height*.5+state.y;
    // The soil masks the heart at its original size: it really passes below the line.
    ctx.save();ctx.beginPath();ctx.rect(0,0,width,box.ground);ctx.clip();
    ctx.translate(width*.5,y);ctx.rotate(Math.sin(t*2.4)*.04);ctx.scale(seedSize,seedSize);
    const g=ctx.createLinearGradient(-1,-1,1,1);g.addColorStop(0,'#ed657b');g.addColorStop(.46,'#d83b5b');g.addColorStop(1,'#ae2345');ctx.fillStyle=g;ctx.fill(heart);ctx.restore();
  }
  function render(t,{still=false}={}){
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);if(t<0)return;
    const box=layout(width,height,t),growth=t-GROW_AT;ground(box,t);
    if(t<GROW_AT)fallingSeed(box,t);
    if(growth<0)return;
    if(!finishedWood)paintWood(growth);
    if(!finishedCrown)paintCrown(growth);
    const falling=fallers(t,still),s=box.scale;
    ctx.save();ctx.translate(box.x,box.ground);if(!still)ctx.rotate(windAt(t));ctx.scale(s,s);
    ctx.drawImage(woodSource,-BUFFER.x,-BUFFER.y,BUFFER.width,BUFFER.height);ctx.drawImage(crownSource,-BUFFER.x,-BUFFER.y,BUFFER.width,BUFFER.height);
    for(const f of falling){const l=f.leaf,p=ease((growth-l.born)/l.duration)*f.attached;leafSprite(ctx,l,l.x,l.y,l.size*p,l.angle,p*(.82+l.depth*.18));}
    ctx.restore();
    for(const f of falling)if(f.alpha>0)leafSprite(ctx,f.leaf,box.x+f.x*s,box.ground+f.y*s,f.leaf.size*s,f.rotation,f.alpha*(.82+f.leaf.depth*.18),f.squash);
  }
  return{resize,render,invalidate,setSeedSize(size){seedSize=size;updateFall();}};
}
