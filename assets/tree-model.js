export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const mix = (a, b, t) => a + (b - a) * t;
export const ease = t => { const p = clamp(t); return p * p * (3 - 2 * p); };
export const HEART_PATH = 'M0 .85C-.18 .69-1 .13-1-.36C-1-.96-.25-1.04 0-.48C.25-1.04 1-.96 1-.36C1 .13.18 .69 0 .85Z';
export function random(seed = 2811) {
  let n = seed >>> 0;
  return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
}

// Closed-form free fall and dissipating rebounds, independent of frame rate.
export function createFall(distance = 1, gravity = 5.6, restitution = .2) {
  if (!(distance > 0 && gravity > 0 && restitution >= 0 && restitution < 1)) throw new RangeError('Invalid fall parameters');
  const impact = Math.sqrt(2 * distance / gravity), speed = gravity * impact;
  const bounceDuration = 2 * speed * restitution / gravity;
  const duration = impact + bounceDuration * (1 + restitution);
  function at(seconds) {
    const t = Math.max(0, seconds);
    if (t < impact) return { y: .5 * gravity * t * t, velocity: gravity * t, landed: false, impactAge: -1 };
    let age = t - impact, v = speed * restitution;
    for (let i = 0; i < 2; i++) {
      const flight = 2 * v / gravity;
      if (age < flight) return { y: distance - v * age + .5 * gravity * age * age, velocity: -v + gravity * age, landed: false, impactAge: t - impact };
      age -= flight; v *= restitution;
    }
    return { y: distance, velocity: 0, landed: true, impactAge: t - impact };
  }
  return { impact, duration, at };
}
export const FALL = createFall();
export const GROW_AT = FALL.duration + .42;
export const MATURE_AT = GROW_AT + 14;

export function pointOn(branch, t) {
  const u = 1 - t;
  return { x: u ** 3 * branch.a.x + 3 * u * u * t * branch.b.x + 3 * u * t * t * branch.c.x + t ** 3 * branch.d.x,
    y: u ** 3 * branch.a.y + 3 * u * u * t * branch.b.y + 3 * u * t * t * branch.c.y + t ** 3 * branch.d.y };
}
function inside(x, y, polygon) {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) yes = !yes;
  }
  return yes;
}

export function createTree(seed = 2811) {
  const rng = random(seed), branches = [], leaves = [];
  const add = (a, b, c, d, width, tip, born, duration, parent = null, attach = 0) => {
    const branch = { id: branches.length, a, b, c, d, width, tip, born, duration, parent, attach };
    branches.push(branch); return branch;
  };
  const trunk = add({x:0,y:0}, {x:17,y:-82}, {x:-26,y:-177}, {x:-8,y:-259}, 34, 13, 0, 3.65);
  const specs = [
    [.36,-196,-282,15,2.6], [.5,197,-293,15,2.8], [.69,-140,-432,16,3.1],
    [.82,137,-438,12,3.05], [1,-22,-437,12.5,2.8], [.64,-213,-346,8,2.9], [.76,216,-359,8,3]
  ];
  const leaders = [];
  for (const [attach,x,y,width,duration] of specs) {
    const a = pointOn(trunk,attach), dx = x - a.x, dy = y - a.y;
    leaders.push(add(a,{x:a.x+dx*.14,y:a.y+dy*.5},{x:a.x+dx*.79,y:a.y+dy*.61},
      {x,y},width,1.55,trunk.born+attach*trunk.duration,duration,trunk.id,attach));
  }
  // Lateral boughs join their parent's actual curve; every fork tapers.
  function ramify(parent,depth) {
    if (!depth) return;
    const slots = depth === 2 ? [.38,.58,.77,.95] : [.57,.88];
    slots.forEach((attach,i) => {
      const a = pointOn(parent,attach), next = pointOn(parent,Math.min(1,attach+.035));
      const heading = Math.atan2(next.y-a.y,next.x-a.x), side = i%2 ? 1 : -1;
      const angle = clamp(heading+(.42+rng()*.45)*side,-Math.PI+.13,-.13);
      const length = (depth===2?60:30)*(.65+rng()*.65)*(1.12-attach*.28);
      const d = {x:clamp(a.x+Math.cos(angle)*length,-224,224),y:clamp(a.y+Math.sin(angle)*length,-485,-180)};
      const b = {x:clamp(a.x+Math.cos(heading)*length*.35,-224,224),y:a.y+Math.sin(heading)*length*.35};
      const c = {x:clamp(d.x-Math.cos(angle+.15*side)*length*.3,-224,224),y:d.y-Math.sin(angle+.15*side)*length*.3};
      const width=mix(parent.width,parent.tip,attach)*.63;
      const child = add(a,b,c,d,width,Math.min(.4,width*.25),
        parent.born+parent.duration*attach,1.15+rng()*.7,parent.id,attach);
      ramify(child,depth-1);
    });
  }
  leaders.forEach(b=>ramify(b,2));
  const samples = branches.flatMap(b=>Array.from({length:15},(_,i)=>({...pointOn(b,i/14),branch:b,t:i/14})));
  const hull = Array.from({length:140},(_,i)=> {
    const a = i/140*Math.PI*2;
    return {x:16*Math.sin(a)**3*13.7,y:-352-(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))*10.3};
  });
  const colors = ['#bd3156','#d74464','#e65d79','#ed7f94','#ee9aa9','#cf4c69','#b94560','#f1afba','#db6a85','#e88c9f'];
  let attempts = 0;
  while (leaves.length<1050 && attempts++<18000) {
    const x = (rng()*2-1)*225, y = -500+rng()*340;
    if (!inside(x,y,hull) || rng()>.8+Math.sin(x*.042+Math.sin(y*.039))*.12) continue;
    let nearest, min = Infinity;
    for (const p of samples) { const d=(p.x-x)**2+(p.y-y)**2; if(d<min) {min=d;nearest=p;} }
    const base = nearest.branch.born+nearest.branch.duration*nearest.t;
    leaves.push({id:leaves.length,x,y,size:4.6+rng()*5.1,angle:(rng()-.5)*1.5,
      color:colors[Math.floor(rng()*colors.length)],born:base+.35+rng()*1.6+Math.sqrt(min)*.008,
      phase:rng()*Math.PI*2,depth:rng(),duration:.8+rng()*.7});
  }
  // Small hearts also unfurl directly on the trunk.
  for(let i=0;i<17;i++) {
    const t=.16+i*.043,p=pointOn(trunk,t),side=i%2?1:-1;
    leaves.push({id:leaves.length,x:p.x+side*(13+rng()*9),y:p.y-5,size:4+rng()*2.8,angle:side*.6,
      color:colors[i%colors.length],born:t*trunk.duration+1.5,phase:rng()*6.28,depth:.9,duration:1.1});
  }
  leaves.sort((a,b)=>a.depth-b.depth);
  // A taller botanical silhouette leaves breathing room on portrait screens.
  for(const branch of branches)for(const p of [branch.a,branch.b,branch.c,branch.d])p.y*=1.35;
  for(const leaf of leaves)leaf.y*=1.35;
  return {branches,leaves,maxBloom:Math.max(...leaves.map(l=>l.born+l.duration))};
}

export function layout(width,height) {
  return {width,height,x:width*.5,ground:height*.79,
    scale:Math.max(.1,Math.min((width-40)/500,(height*.7)/700,1.18))};
}

// Drag limits the speed; light leaves flutter and settle on the ground.
export function driftingLeaf(age,leaf,ground=0) {
  const phase=leaf.phase,terminal=21+leaf.depth*13,drag=.9;
  const floor=ground-3,distance=Math.max(0,floor-leaf.y);
  let landingAge=distance/terminal+1/drag;
  for(let i=0;i<4;i++) {
    const error=terminal*(landingAge-(1-Math.exp(-drag*landingAge))/drag)-distance;
    landingAge=Math.max(.001,landingAge-error/Math.max(.001,terminal*(1-Math.exp(-drag*landingAge))));
  }
  const t=Math.min(Math.max(0,age),landingAge),settled=age>=landingAge;
  const fall=terminal*(t-(1-Math.exp(-drag*t))/drag);
  const x=leaf.x+t*(5+leaf.depth*6)+Math.sin(t*1.8+phase)*11-Math.sin(phase)*11;
  const landing=ease((age-landingAge+.25)/.4);
  return {x,y:Math.min(floor,leaf.y+fall),rotation:mix(leaf.angle+Math.sin(t*2.1+phase)*.7+t*.17,.6,landing),
    squash:mix(.38+.62*Math.abs(Math.cos(t*1.7+phase)),.62,landing),settled,alpha:1-ease((age-landingAge-4)/3)};
}
