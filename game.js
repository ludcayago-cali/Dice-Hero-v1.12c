const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = 10, H = 8;
const tile = 68;
const ox = 80, oy = 80;

let phase = "select";
let selected = null;
let dice = 0;
let path = [];
let actionTarget = null;
let message = "Select a hero.";

const terrain = [
  "..........",
  "..#...#...",
  ".....#....",
  ".#..#.....",
  ".....#..#.",
  "...#......",
  "......#...",
  "..........",
];

const heroes = [
  { id:"fighter", name:"Fighter", team:"player", type:"melee", x:1, y:6, hp:15, maxHp:15, dmg:2, skill:"Block", blocked:false, color:"#3e8cff" },
  { id:"mage", name:"White Mage", team:"player", type:"ranged", x:1, y:5, hp:10, maxHp:10, dmg:2, skill:"Heal", color:"#9b7bff" },
];

const enemies = [
  { id:"slime", name:"Melee Slime", team:"enemy", type:"melee", x:7, y:2, hp:8, maxHp:8, dmg:2, color:"#ff5b55" },
  { id:"goblin", name:"Ranged Goblin", team:"enemy", type:"ranged", x:8, y:5, hp:6, maxHp:6, dmg:2, color:"#ff8a3d" },
  { id:"ogre", name:"Brute Ogre", team:"enemy", type:"melee", x:6, y:6, hp:12, maxHp:12, dmg:3, color:"#b36854" },
];

function allUnits() { return [...heroes, ...enemies].filter(u => u.hp > 0); }
function inBounds(x,y) { return x >= 0 && y >= 0 && x < W && y < H; }
function blocked(x,y) {
  return !inBounds(x,y) || terrain[y][x] === "#" || allUnits().some(u => u.x === x && u.y === y);
}
function tileCenter(x,y) { return [ox + x*tile + tile/2, oy + y*tile + tile/2]; }
function manhattan(a,b) { return Math.abs(a.x-b.x)+Math.abs(a.y-b.y); }
function straightTwo(a,b) {
  return ((Math.abs(a.x-b.x) === 2 && a.y === b.y) || (Math.abs(a.y-b.y) === 2 && a.x === b.x));
}
function lineBlocked(a,b) {
  const mx = (a.x + b.x)/2;
  const my = (a.y + b.y)/2;
  return terrain[my][mx] === "#";
}
function validAttackTargets(unit) {
  const targets = enemies.filter(e => e.hp > 0);
  if (unit.team === "enemy") return heroes.filter(h => h.hp > 0);
  if (unit.type === "melee") return targets.filter(t => manhattan(unit,t) === 1);
  return targets.filter(t => straightTwo(unit,t) && !lineBlocked(unit,t));
}
function availableMoves(unit, steps) {
  const results = new Set();
  function walk(x,y,n,visitedPath) {
    if (n === 0) { results.add(`${x},${y}`); return; }
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx, ny=y+dy;
      const occupiedByStart = nx === unit.x && ny === unit.y;
      if (inBounds(nx,ny) && terrain[ny][nx] !== "#" && (!blocked(nx,ny) || occupiedByStart)) {
        walk(nx,ny,n-1,[...visitedPath,[nx,ny]]);
      }
    }
  }
  walk(unit.x, unit.y, steps, []);
  return [...results].map(s => {
    const [x,y] = s.split(",").map(Number);
    return {x,y};
  }).filter(p => !(p.x === unit.x && p.y === unit.y));
}

function drawBoard() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // tabletop
  ctx.fillStyle = "#5b5260";
  roundRect(35,35,W*tile+90,H*tile+90,26,true);

  // tiles
  for (let y=0;y<H;y++) {
    for (let x=0;x<W;x++) {
      const px = ox+x*tile, py = oy+y*tile;
      ctx.fillStyle = terrain[y][x] === "#" ? "#2d3448" : ((x+y)%2 ? "#e8f1ef" : "#dbe9e7");
      ctx.fillRect(px,py,tile-2,tile-2);
      ctx.strokeStyle = "#b5c7c5";
      ctx.strokeRect(px,py,tile-2,tile-2);

      if (terrain[y][x] === "#") {
        ctx.fillStyle = "#22283a";
        ctx.fillRect(px+12,py+12,tile-26,tile-26);
      }
    }
  }

  // movement options
  if (selected && dice > 0 && phase === "move") {
    for (const m of availableMoves(selected, dice)) {
      const [cx,cy] = tileCenter(m.x,m.y);
      const ghost = {...selected, x:m.x, y:m.y};
      const triggers = validAttackTargets(ghost).length > 0;
      ctx.fillStyle = triggers ? "rgba(255,80,80,.42)" : "rgba(70,170,255,.34)";
      ctx.beginPath(); ctx.arc(cx,cy,22,0,Math.PI*2); ctx.fill();
    }
  }

  // units
  for (const u of allUnits()) drawUnit(u);

  // current path
  if (path.length) {
    ctx.strokeStyle = "#f2c84b";
    ctx.lineWidth = 7;
    ctx.beginPath();
    const [sx,sy] = tileCenter(selected.x, selected.y);
    ctx.moveTo(sx,sy);
    for (const p of path) {
      const [cx,cy] = tileCenter(p.x,p.y);
      ctx.lineTo(cx,cy);
    }
    ctx.stroke();
  }

  // message
  ctx.fillStyle = "rgba(0,0,0,.55)";
  roundRect(70, 640, 780, 44, 14, true);
  ctx.fillStyle = "#fff";
  ctx.font = "700 20px system-ui";
  ctx.fillText(message, 90, 669);
}

function drawUnit(u) {
  const [cx,cy] = tileCenter(u.x,u.y);
  ctx.fillStyle = "rgba(0,0,0,.22)";
  ctx.beginPath(); ctx.ellipse(cx,cy+20,24,10,0,0,Math.PI*2); ctx.fill();

  ctx.fillStyle = u.color;
  ctx.beginPath(); ctx.arc(cx,cy,24,0,Math.PI*2); ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = "900 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(u.name.split(" ")[0], cx, cy+4);

  // HP bar
  ctx.fillStyle = "#111";
  ctx.fillRect(cx-26, cy-38, 52, 7);
  ctx.fillStyle = "#4cff7a";
  ctx.fillRect(cx-26, cy-38, 52*(u.hp/u.maxHp), 7);

  if (u === selected) {
    ctx.strokeStyle = "#ffe66d";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx,cy,31,0,Math.PI*2); ctx.stroke();
  }
  ctx.textAlign = "left";
}

function roundRect(x,y,w,h,r,fill) {
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  if (fill) ctx.fill();
}

function canvasTile(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * sx;
  const my = (e.clientY - rect.top) * sy;
  return {
    x: Math.floor((mx-ox)/tile),
    y: Math.floor((my-oy)/tile)
  };
}

canvas.addEventListener("click", e => {
  const p = canvasTile(e);
  if (!inBounds(p.x,p.y)) return;

  if (phase === "select") {
    const h = heroes.find(u => u.hp > 0 && u.x === p.x && u.y === p.y);
    if (h) {
      selected = h;
      message = `${h.name} selected. Roll dice.`;
      updateUI();
      drawBoard();
    }
    return;
  }

  if (phase === "move" && selected && dice > 0) {
    const moves = availableMoves(selected, dice);
    if (moves.some(m => m.x === p.x && m.y === p.y)) {
      selected.x = p.x; selected.y = p.y;
      const targets = validAttackTargets(selected);
      if (targets.length) {
        actionTarget = targets[0];
        phase = "action";
        message = `Attack trigger active on ${actionTarget.name}. Choose action.`;
      } else {
        phase = "done";
        message = "No attack trigger. End turn.";
      }
      updateUI();
      drawBoard();
    } else {
      message = `Invalid tile. You must land exactly ${dice} steps away.`;
      drawBoard();
    }
  }
});

document.getElementById("rollBtn").onclick = () => {
  if (!selected) { message = "Select a hero first."; drawBoard(); return; }
  dice = Math.floor(Math.random()*6)+1;
  phase = "move";
  message = `Rolled ${dice}. Move exactly ${dice} steps. Red tiles trigger combat.`;
  updateUI(); drawBoard();
};

document.getElementById("attackBtn").onclick = () => {
  if (!actionTarget) return;
  actionTarget.hp -= selected.dmg;
  message = `${selected.name} attacks ${actionTarget.name} for ${selected.dmg}.`;
  cleanupAfterAction();
};

document.getElementById("skillBtn").onclick = () => {
  if (!selected) return;
  if (selected.id === "mage") {
    const lowest = heroes.filter(h=>h.hp>0).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    lowest.hp = Math.min(lowest.maxHp, lowest.hp + 3);
    message = `White Mage heals ${lowest.name} for 3.`;
  } else if (selected.id === "fighter") {
    selected.blocked = true;
    message = "Fighter prepares Block. Next damage becomes 0.";
  } else {
    if (actionTarget) actionTarget.hp -= selected.dmg + 1;
  }
  cleanupAfterAction();
};

document.getElementById("endBtn").onclick = () => {
  enemyTurn();
};

document.getElementById("resetBtn").onclick = () => location.reload();

function cleanupAfterAction() {
  actionTarget = null;
  phase = "done";
  checkWinLose();
  updateUI(); drawBoard();
}

function enemyTurn() {
  phase = "enemy";
  selected = null; dice = 0; actionTarget = null;
  message = "Enemy turn...";
  updateUI(); drawBoard();

  setTimeout(() => {
    for (const e of enemies.filter(e=>e.hp>0)) {
      const target = heroes.filter(h=>h.hp>0).sort((a,b)=>manhattan(e,a)-manhattan(e,b))[0];
      if (!target) break;

      if ((e.type === "melee" && manhattan(e,target) === 1) ||
          (e.type === "ranged" && straightTwo(e,target) && !lineBlocked(e,target))) {
        let dmg = e.dmg;
        if (target.blocked) { dmg = 0; target.blocked = false; }
        target.hp -= dmg;
        message = `${e.name} hits ${target.name} for ${dmg}.`;
      } else {
        stepToward(e, target);
        message = `${e.name} moves.`;
      }
    }
    phase = "select";
    message += " Player turn.";
    checkWinLose();
    updateUI(); drawBoard();
  }, 450);
}

function stepToward(unit,target) {
  const options = [[1,0],[-1,0],[0,1],[0,-1]]
    .map(([dx,dy])=>({x:unit.x+dx,y:unit.y+dy}))
    .filter(p=>inBounds(p.x,p.y) && terrain[p.y][p.x] !== "#" && !allUnits().some(u=>u.x===p.x&&u.y===p.y));
  options.sort((a,b)=>(Math.abs(a.x-target.x)+Math.abs(a.y-target.y))-(Math.abs(b.x-target.x)+Math.abs(b.y-target.y)));
  if (options[0]) { unit.x = options[0].x; unit.y = options[0].y; }
}

function checkWinLose() {
  if (enemies.every(e=>e.hp<=0)) {
    message = "Victory. Prototype battle cleared.";
    phase = "over";
  }
  if (heroes.every(h=>h.hp<=0)) {
    message = "Defeat. All heroes are down.";
    phase = "over";
  }
}

function updateUI() {
  document.getElementById("turnInfo").textContent =
    phase === "enemy" ? "Enemy Turn" : phase === "over" ? "Battle Over" : "Player Turn";
  document.getElementById("diceValue").textContent = dice || "-";
  document.getElementById("selectedInfo").innerHTML = selected
    ? `<b>${selected.name}</b><br>HP: ${selected.hp}/${selected.maxHp}<br>Type: ${selected.type}<br>Skill: ${selected.skill}`
    : "Choose a hero.";
  document.getElementById("rollBtn").disabled = !selected || phase !== "select";
  document.getElementById("attackBtn").disabled = phase !== "action";
  document.getElementById("skillBtn").disabled = phase !== "action";
}

updateUI();
drawBoard();
