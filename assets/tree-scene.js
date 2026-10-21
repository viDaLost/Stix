import { clamp, mix, ease, HEART_PATH, FALL, GROW_AT, MATURE_AT, createTree, pointOn, layout, driftingLeaf } from './tree-model.js';

const BUFFER = {width:600,height:770,x:300,y:740};
export function createScene(canvas) {
  const ctx = canvas.getContext('2d',{alpha:true});
  if(!ctx) throw new Error('Canvas is unavailable');
  const heart = new Path2D(HEART_PATH), tree = createTree();
  const wood = document.createElement('canvas'), crown = document.createElement('canvas');
  const wc = wood.getContext('2d'), lc = crown.getContext('2d');
  let box, ratio=1, cacheRatio=1, woodAt=-Infinity, crownAt=-Infinity, finishedWood=false;
  let seedSize=76/2.4;

  function resize(width,height,dpr=1) {
    box=layout(width,height); ratio=Math.min(dpr,2);
    canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio);
    cacheRatio=Math.max(.5,box.scale*ratio);
    for(const buffer of [wood,crown]) {buffer.width=Math.ceil(BUFFER.width*cacheRatio);buffer.height=Math.ceil(BUFFER.height*cacheRatio);}
    woodAt=crownAt=-Infinity; finishedWood=false;
    ctx.setTransform(ratio,0,0,ratio,0,0);
  }
  function clearBuffer(c,buffer) {
    c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,buffer.width,buffer.height);
    c.setTransform(cacheRatio,0,0,cacheRatio,BUFFER.x*cacheRatio,BUFFER.y*cacheRatio);
  }
  function paintHeart(c,x,y,size,angle,color,alpha=1,squash=1) {
    if(alpha<=0 || size<.01) return;
    c.save(); c.translate(x,y); c.rotate(angle); c.scale(size*squash,size);
    c.globalAlpha=alpha; c.fillStyle=color; c.fill(heart); c.restore();
  }
  function limb(c,b,progress) {
    if(progress<=0) return;
    const count=Math.max(2,Math.ceil(progress*30)), left=[],right=[];
    for(let i=0;i<=count;i++) {
      const t=progress*i/count,p=pointOn(b,t),next=pointOn(b,Math.min(1,t+.002)),prev=pointOn(b,Math.max(0,t-.002));
      const angle=Math.atan2(next.y-prev.y,next.x-prev.x)+Math.PI/2;
      const width=mix(b.width,b.tip,t)*.5;
      left.push({x:p.x+Math.cos(angle)*width,y:p.y+Math.sin(angle)*width});
      right.push({x:p.x-Math.cos(angle)*width,y:p.y-Math.sin(angle)*width});
    }
    c.beginPath(); c.moveTo(left[0].x,left[0].y);
    left.slice(1).forEach(p=>c.lineTo(p.x,p.y));
    right.reverse().forEach(p=>c.lineTo(p.x,p.y)); c.closePath();
    const gradient=c.createLinearGradient(b.a.x-b.width,b.a.y,b.a.x+b.width*1.4,b.a.y-25);
    gradient.addColorStop(0,'#654537');gradient.addColorStop(.38,'#886047');gradient.addColorStop(.72,'#a07b58');gradient.addColorStop(1,'#74503b');
    c.fillStyle=gradient;c.fill();
    // Interrupted, thin bark furrows follow the grain of the larger boughs.
    if(b.width>8) {
      c.save();c.clip();
      for(let j=0;j<3;j++) {
        c.beginPath();
        for(let i=0;i<=20;i++) {
          const t=progress*i/20,p=pointOn(b,t),offset=(j-1)*b.width*.2*(1-t);
          const x=p.x+offset+Math.sin(t*12+j*2)*.7;
          if(!i)c.moveTo(x,p.y);else c.lineTo(x,p.y);
        }
        c.strokeStyle=j===1?'#d4b0873d':'#432e2933';c.lineWidth=j===1?.9:.65;c.stroke();
      }
      c.restore();
    }
  }
  function paintWood(t) {
    clearBuffer(wc,wood);
    const root=ease(t/.9);
    wc.save();wc.scale(root,root);wc.fillStyle='#7c5741';
    wc.beginPath();wc.moveTo(-17,-2);wc.bezierCurveTo(-18,-17,16,-18,17,-2);
    wc.quadraticCurveTo(24,-.4,32,0);wc.quadraticCurveTo(12,3,0,0);
    wc.quadraticCurveTo(-20,4,-34,0);wc.closePath();wc.fill();wc.restore();
    for(const b of tree.branches) limb(wc,b,clamp((t-b.born)/b.duration));
  }
  function fallers(t) {
    const result=[];
    for(let i=0;i<26;i++) {
      const elapsed=t-MATURE_AT-i*1.45;
      if(elapsed<0) continue;
      const cycle=Math.floor(elapsed/40),age=elapsed%40;
      const leaf=tree.leaves[(i*137+cycle*97+41)%1050];
      const state=driftingLeaf(age,leaf);
      if(state.alpha>0) result.push({leaf,age,...state});
    }
    return result;
  }
  function paintCrown(growth,falling) {
    clearBuffer(lc,crown);
    const detached=new Map(falling.map(f=>[f.leaf.id,ease((f.age-2)/2)]));
    for(const l of tree.leaves) {
      const p=ease((growth-l.born)/l.duration);
      if(p<=0)continue;
      const opacity=(.76+l.depth*.24)*p*(detached.get(l.id)??1);
      const size=l.size*p;
      // A tiny attached stem and an off-centre glint keep the leaves tactile.
      if(size>4) {
        lc.globalAlpha=opacity*.32;lc.strokeStyle='#8c6259';lc.lineWidth=.5;
        lc.beginPath();lc.moveTo(l.x,l.y-size*.45);lc.lineTo(l.x-.7,l.y-size*1.15);lc.stroke();lc.globalAlpha=1;
      }
      paintHeart(lc,l.x,l.y,size,l.angle,l.color,opacity);
      if(l.depth>.75 && size>5) {
        lc.save();lc.translate(l.x,l.y);lc.rotate(l.angle);lc.globalAlpha=opacity*.15;
        lc.fillStyle='#fff7ef';lc.beginPath();lc.ellipse(-size*.39,-size*.38,size*.16,size*.26,-.5,0,Math.PI*2);lc.fill();lc.restore();
      }
    }
  }
  function ground(t) {
    const p=ease(t/.65),half=box.width*.42*p,x=box.x,y=box.ground;
    const g=ctx.createLinearGradient(x-half,y,x+half,y);
    g.addColorStop(0,'#b29a7b00');g.addColorStop(.16,'#b29a7b70');g.addColorStop(.5,'#9d806497');g.addColorStop(.84,'#b29a7b70');g.addColorStop(1,'#b29a7b00');
    ctx.strokeStyle=g;ctx.lineWidth=.85;
    ctx.beginPath();ctx.moveTo(x-half,y+.7);ctx.bezierCurveTo(x-half*.5,y-1,x+half*.4,y+1,x+half,y);ctx.stroke();
    const shadow=ease((t-FALL.impact)/1.5);
    if(shadow>0) {
      ctx.save();ctx.translate(x,y+2);ctx.scale(box.scale,box.scale*.1);
      const shade=ctx.createRadialGradient(0,0,0,0,0,76);shade.addColorStop(0,'#79543b17');shade.addColorStop(1,'#79543b00');
      ctx.globalAlpha=shadow;ctx.fillStyle=shade;ctx.beginPath();ctx.arc(0,0,76,0,Math.PI*2);ctx.fill();ctx.restore();
    }
  }
  function seed(t) {
    const state=FALL.at(t),sink=ease((t-FALL.duration)/.44);
    if(sink>=1)return;
    const size=seedSize*(1-sink*.72),distance=box.ground-seedSize*.85-box.height*.5;
    const y=box.height*.5+state.y*distance+sink*seedSize*.52;
    let squash=1;
    if(state.impactAge>=0)squash=1-.2*Math.exp(-state.impactAge*20)*Math.cos(state.impactAge*32);
    ctx.save();ctx.beginPath();ctx.rect(0,0,box.width,box.ground+1);ctx.clip();
    ctx.translate(box.x+Math.sin(t*3)*2*(1-sink),y);ctx.rotate(Math.sin(t*2.4)*.075*(1-sink));ctx.scale(size/squash,size*squash);
    const g=ctx.createLinearGradient(-1,-1,1,1);g.addColorStop(0,'#ed657b');g.addColorStop(.46,'#d83b5b');g.addColorStop(1,'#ae2345');
    ctx.globalAlpha=1-sink;ctx.fillStyle=g;ctx.fill(heart);ctx.restore();
    if(state.impactAge>=0&&state.impactAge<.65) {
      const a=state.impactAge;
      for(let i=0;i<7;i++) {
        ctx.globalAlpha=(1-a/.65)*.35;ctx.fillStyle=i%2?'#c77778':'#b59b7f';
        ctx.beginPath();ctx.ellipse(box.x+(i-3)*a*22,box.ground-a*(25+(i%3)*9)+60*a*a,1.1,.8,i,0,Math.PI*2);ctx.fill();
      }
      ctx.globalAlpha=1;
    }
  }
  function render(t,{still=false}={}) {
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,box.width,box.height);
    if(t<0)return;
    ground(t);
    if(t<GROW_AT)seed(t);
    const growth=t-GROW_AT;
    if(growth<0)return;
    const falling=still?[]:fallers(t);
    if(!finishedWood && t-woodAt>=1/30) {
      paintWood(growth);woodAt=t;
      finishedWood=tree.branches.every(b=>growth>=b.born+b.duration);
    }
    if(t-crownAt>=1/12 || still) {paintCrown(growth,falling);crownAt=t;}
    ctx.save();ctx.translate(box.x,box.ground);
    // The barely perceptible sway is anchored to the roots.
    if(!still)ctx.rotate(Math.sin(t*.61)*.0021*ease(growth/5));
    const s=box.scale;
    ctx.drawImage(wood,-BUFFER.x*s,-BUFFER.y*s,BUFFER.width*s,BUFFER.height*s);
    ctx.drawImage(crown,-BUFFER.x*s,-BUFFER.y*s,BUFFER.width*s,BUFFER.height*s);ctx.restore();
    for(const f of falling) {
      paintHeart(ctx,box.x+f.x*s,box.ground+f.y*s,f.leaf.size*s,f.rotation,f.leaf.color,f.alpha*.9,f.squash);
    }
  }
  return {resize,render,setSeedSize(size){seedSize=size;},invalidate(){woodAt=crownAt=-Infinity;finishedWood=false;}};
}
