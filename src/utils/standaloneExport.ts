import { LEVEL_CONFIGS } from '../game/levels';
import { createZipArchive, type ZipEntryInput } from './zipBuilder';

export function buildStandaloneWebpageEntries(): ZipEntryInput[] {
  const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Shadows &amp; Gears — 10-Level Heist Edition</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div id="shell">
    <canvas id="stage" width="1000" height="620"></canvas>
    <div id="hud">
      <div class="hud-top">
        <div class="hud-block">
          <div class="kicker" id="hud-level">LEVEL 1 / 10</div>
          <div class="headline" id="hud-title">The Wife</div>
          <div class="sub" id="hud-objective">Follow Shasha unseen.</div>
        </div>
        <div class="hud-right">
          <div class="metric" id="hud-spots">SPOTTED: 0 / 3</div>
          <div class="metric" id="hud-timer" hidden>TIME: 45s</div>
          <button id="btn-pause" type="button">Pause</button>
          <button id="btn-restart" type="button">Restart</button>
        </div>
      </div>
      <div class="comms" id="hud-comms">
        <strong id="comms-speaker">STATIC</strong>
        <span id="comms-text"></span>
      </div>
    </div>

    <div id="overlay" class="overlay">
      <div class="modal" id="modal-card">
        <div class="kicker">TACTICAL HEIST CAMPAIGN</div>
        <h1 id="modal-title">SHADOWS &amp; GEARS</h1>
        <p id="modal-body">
          Crew: Roman (P1), Brock (P2), John (P3), Randy (P4). Handler: Static.
          Targets: Mr. Malhotra &amp; Shasha. Villains: Inspector Shamus &amp; Pablo.
        </p>
        <div id="role-box" hidden>
          <label>Plate A: <select id="role-a"><option value="Roman">Roman</option><option value="Brock">Brock</option><option value="John">John</option></select></label>
          <label>Plate B: <select id="role-b"><option value="Brock" selected>Brock</option><option value="Roman">Roman</option><option value="John">John</option></select></label>
          <label>Driver: <select id="role-d"><option value="Randy" selected>Randy</option><option value="John">John</option></select></label>
        </div>
        <div class="actions">
          <button id="btn-primary" type="button">Start Heist</button>
          <button id="btn-secondary" type="button" hidden>Restart</button>
          <a class="char-link" href="characters.html">3D Characters</a>
        </div>
      </div>
    </div>
  </div>
  <script src="game.js"></script>
</body>
</html>
`;

  const styleCss = `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: #090b10;
  color: #f1f5f9;
  font-family: system-ui, -apple-system, sans-serif;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}
#shell {
  position: relative;
  width: min(100vw, 1100px);
  aspect-ratio: 1000 / 620;
  background: #0d121a;
  border: 1px solid rgba(148, 163, 184, 0.2);
}
canvas {
  width: 100%;
  height: 100%;
  display: block;
}
#hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px;
}
.hud-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.hud-block, .hud-right, .comms {
  background: rgba(9, 11, 16, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.22);
  padding: 10px 14px;
  border-radius: 6px;
}
.hud-right {
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
}
.kicker {
  font-size: 11px;
  letter-spacing: 0.12em;
  color: #e5a93b;
  font-weight: 700;
}
.headline {
  font-size: 20px;
  font-weight: 700;
  margin: 2px 0;
}
.sub {
  font-size: 13px;
  color: #cbd5e1;
  max-width: 440px;
}
.metric {
  font-family: monospace;
  font-size: 13px;
  font-weight: 600;
}
button {
  background: #e5a93b;
  color: #090b10;
  border: none;
  padding: 8px 16px;
  border-radius: 5px;
  font-weight: 700;
  cursor: pointer;
}
button:hover { background: #f5ba4a; }
.comms {
  max-width: 620px;
  font-size: 13px;
  line-height: 1.45;
}
.comms strong {
  color: #e5a93b;
  margin-right: 8px;
}
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(9, 11, 16, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.overlay[hidden] { display: none; }
.modal {
  background: #121722;
  border: 1px solid rgba(229, 169, 59, 0.35);
  border-radius: 8px;
  padding: 28px;
  max-width: 520px;
  width: 100%;
}
.modal h1 {
  font-size: 28px;
  margin: 6px 0 12px;
}
.modal p {
  color: #cbd5e1;
  line-height: 1.55;
  font-size: 14px;
  margin-bottom: 18px;
}
#role-box {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}
#role-box label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
select {
  background: #090b10;
  color: #f1f5f9;
  border: 1px solid #334155;
  padding: 4px 8px;
  border-radius: 4px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.char-link {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 5px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: #171f2e;
  color: #f1f5f9;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.char-link:hover { background: #1f293d; }
`;

  const levelsJson = JSON.stringify(
    LEVEL_CONFIGS.map((l) => ({
      id: l.id,
      title: l.title,
      objective: l.objectiveSummary,
      timeLimit: l.timeLimit,
      dialogue: l.dialogue,
    })),
    null,
    2
  );

  const gameJs = `(() => {
  const LEVELS = ${levelsJson};
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const btnPrimary = document.getElementById('btn-primary');
  const btnSecondary = document.getElementById('btn-secondary');
  const roleBox = document.getElementById('role-box');
  const hudLevel = document.getElementById('hud-level');
  const hudTitle = document.getElementById('hud-title');
  const hudObjective = document.getElementById('hud-objective');
  const hudSpots = document.getElementById('hud-spots');
  const hudTimer = document.getElementById('hud-timer');
  const commsSpeaker = document.getElementById('comms-speaker');
  const commsText = document.getElementById('comms-text');

  let state = 'title';
  let currentLevel = 1;
  let spotted = 0;
  let spotCd = 0;
  let timer = 0;
  let hold = 0;
  let phase = 0;
  let bags = [];
  let walls = [];
  let guards = [];
  let players = [];
  let activePlayer = 0;
  let vaultOpen = false;
  let highwayDist = 0;
  let carX = 500;
  let traffic = [];
  let bullets = [];
  let gaps = [];
  let dashTimer = 0;
  let roles = { a: 'Roman', b: 'Brock', d: 'Randy' };
  const keys = {};

  function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
  function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

  function inCone(px, py, g) {
    const d = dist(g.x, g.y, px, py);
    if (d > g.range) return false;
    const ang = Math.atan2(py - g.y, px - g.x);
    let diff = ang - g.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > g.fov * 0.5) return false;
    for (const w of walls) {
      if (w.pass) continue;
      for (let t = 0.2; t <= 0.9; t += 0.2) {
        const rx = g.x + (px - g.x) * t;
        const ry = g.y + (py - g.y) * t;
        if (rx >= w.x && rx <= w.x + w.w && ry >= w.y && ry <= w.y + w.h) return false;
      }
    }
    return true;
  }

  function loadLevel(id) {
    currentLevel = id;
    const cfg = LEVELS[id - 1];
    spotted = 0; spotCd = 0; hold = 0; phase = 0; vaultOpen = false;
    timer = cfg.timeLimit || 0;
    highwayDist = 0; carX = 500; dashTimer = 0;
    walls = []; guards = []; bags = []; traffic = []; bullets = []; gaps = [];
    players = [{ name: 'Roman', x: 95, y: 510, angle: 0, speed: 215, hp: 120 }];
    activePlayer = 0;
    roleBox.hidden = true;

    if (id === 1) {
      walls = [
        { x: 170, y: 120, w: 170, h: 170 },
        { x: 170, y: 370, w: 170, h: 160 },
        { x: 430, y: 90, w: 160, h: 180 },
        { x: 430, y: 340, w: 150, h: 190 }
      ];
      guards = [{ name: 'Shasha', x: 220, y: 325, angle: 0, speed: 78, fov: 1.3, range: 185, color: '#f472b6', hp: 100,
        pts: [{x:380,y:325},{x:380,y:160},{x:640,y:160},{x:640,y:310},{x:840,y:310},{x:840,y:240},{x:640,y:240}], wi: 0 }];
    } else if (id === 2) {
      walls = [
        { x: 350, y: 165, w: 320, h: 175 },
        { x: 255, y: 400, w: 120, h: 75, pass: true }
      ];
      guards = [{ name: 'Estate Guard', x: 270, y: 365, angle: 0, speed: 92, fov: 1.4, range: 205, color: '#f59e0b', hp: 100,
        pts: [{x:270,y:365},{x:705,y:365},{x:705,y:525},{x:435,y:525}], wi: 1 }];
    } else if (id === 3) {
      walls = [
        { x: 350, y: 210, w: 120, h: 90 },
        { x: 350, y: 360, w: 120, h: 80 }
      ];
      guards = [{ name: 'Vault Guard', x: 545, y: 165, angle: 1.57, speed: 105, fov: 1.4, range: 190, color: '#22c55e', hp: 100,
        pts: [{x:545,y:165},{x:545,y:455},{x:265,y:455},{x:265,y:165}], wi: 1 }];
      roleBox.hidden = false;
      modalTitle.textContent = 'LEVEL 3: THE BLUEPRINT';
      modalBody.textContent = 'Guard route is shown in green. Assign Plate A, Plate B, and Driver roles.';
      btnPrimary.textContent = 'Confirm Plan';
      btnSecondary.hidden = true;
      overlay.hidden = false;
      state = 'plan';
    } else if (id === 4) {
      players = [
        { name: roles.a, x: 115, y: 250, angle: 0, speed: 210, hp: 100 },
        { name: roles.b, x: 115, y: 370, angle: 0, speed: 205, hp: 100 }
      ];
      walls = [
        { x: 340, y: 195, w: 120, h: 85 },
        { x: 340, y: 345, w: 120, h: 85 },
        { x: 645, y: 244, w: 24, h: 132, vault: true }
      ];
      guards = [{ name: 'Crown Guard', x: 545, y: 155, angle: 1.57, speed: 100, fov: 1.4, range: 195, color: '#22c55e', hp: 100,
        pts: [{x:545,y:155},{x:545,y:465},{x:265,y:465},{x:265,y:155}], wi: 1 }];
      bags = [{ x: 750, y: 245, got: false }, { x: 750, y: 375, got: false }];
    } else if (id === 5) {
      players = [{ name: 'Roman', x: 210, y: 310, angle: 0, speed: 215, hp: 100 }];
      walls = [{ x: 520, y: 230, w: 100, h: 160 }];
      guards = [
        { name: 'Inspector Shamus', x: 680, y: 155, angle: 3.14, speed: 105, fov: 1.45, range: 200, color: '#ef4444', hp: 100,
          pts: [{x:680,y:155},{x:430,y:155},{x:430,y:465},{x:680,y:465}], wi: 1 }
      ];
      bags = [{ x: 255, y: 145, got: false, del: false }, { x: 660, y: 310, got: false, del: false }, { x: 455, y: 470, got: false, del: false }];
    } else if (id === 6) {
      traffic = [
        { x: 340, y: 120, vy: 140, police: false },
        { x: 500, y: -120, vy: 185, police: true },
        { x: 650, y: -320, vy: 155, police: true }
      ];
    } else if (id === 7) {
      players = [{ name: 'Brock', x: 95, y: 520, angle: 0, speed: 205, hp: 100 }];
      walls = [{ x: 180, y: 110, w: 180, h: 120 }, { x: 470, y: 150, w: 170, h: 130 }];
      guards = [
        { name: "Pablo's Guard", x: 410, y: 140, angle: 1.57, speed: 98, fov: 1.35, range: 195, color: '#a855f7', hp: 100,
          pts: [{x:410,y:140},{x:410,y:500},{x:130,y:500}], wi: 1 },
        { name: "Pablo's Lookout", x: 695, y: 160, angle: 1.57, speed: 104, fov: 1.4, range: 195, color: '#a855f7', hp: 100,
          pts: [{x:695,y:160},{x:695,y:495},{x:895,y:495},{x:895,y:260}], wi: 1 }
      ];
    } else if (id === 8) {
      players = [{ name: 'Randy', x: 100, y: 310, angle: 0, speed: 210, hp: 100 }];
      walls = [{ x: 460, y: 220, w: 120, h: 180 }];
      guards = [{ name: 'Cartel Enforcer', x: 615, y: 165, angle: 1.57, speed: 110, fov: 1.35, range: 190, color: '#a855f7', hp: 100,
        pts: [{x:615,y:165},{x:615,y:455},{x:390,y:455},{x:390,y:165}], wi: 1 }];
      bags = [{ x: 140, y: 145, got: false, del: false }, { x: 140, y: 475, got: false, del: false }, { x: 380, y: 310, got: false, del: false }];
    } else if (id === 9) {
      players = [{ name: 'Roman', x: 95, y: 310, angle: 0, speed: 215, hp: 140 }];
      walls = [{ x: 240, y: 110, w: 90, h: 120 }, { x: 470, y: 245, w: 80, h: 130 }];
      guards = [
        { name: 'Cartel Bruiser', x: 410, y: 165, angle: 3.14, speed: 95, fov: 1.6, range: 240, color: '#a855f7', hp: 70, cd: 1.0, pts: [{x:410,y:165},{x:410,y:455}], wi: 1 },
        { name: 'Pablo', x: 855, y: 310, angle: 3.14, speed: 120, fov: 6.28, range: 420, color: '#dc2626', hp: 240, cd: 1.2, pts: [{x:855,y:170},{x:855,y:450}], wi: 0 }
      ];
    } else if (id === 10) {
      players = [{ name: 'Roman', x: 75, y: 310, angle: 0, speed: 220, hp: 100 }];
      gaps = [{ x: 295, w: 46 }, { x: 575, w: 48 }, { x: 810, w: 46 }];
      guards = [{ name: 'Chopper Searchlight', x: 360, y: 180, angle: 1.57, speed: 95, fov: 1.5, range: 205, color: '#3b82f6', hp: 999,
        pts: [{x:360,y:160},{x:360,y:460}], wi: 1 }];
    }

    hudLevel.textContent = 'LEVEL ' + id + ' / 10';
    hudTitle.textContent = cfg.title;
    hudObjective.textContent = cfg.objective;
    hudSpots.textContent = 'SPOTTED: 0 / 3';
    hudTimer.hidden = !cfg.timeLimit;
    commsSpeaker.textContent = cfg.dialogue[0].speaker;
    commsText.textContent = cfg.dialogue[0].text;
  }

  function showResult(title, body, btnText, nextFn) {
    state = 'result';
    roleBox.hidden = true;
    modalTitle.textContent = title;
    modalBody.textContent = body;
    btnPrimary.textContent = btnText;
    btnSecondary.hidden = false;
    btnSecondary.textContent = 'Retry Level';
    btnPrimary.onclick = nextFn;
    btnSecondary.onclick = () => { overlay.hidden = true; state = 'play'; loadLevel(currentLevel); };
    overlay.hidden = false;
  }

  btnPrimary.onclick = () => {
    if (state === 'title') {
      overlay.hidden = true;
      state = 'play';
      loadLevel(1);
    } else if (state === 'plan') {
      roles = {
        a: document.getElementById('role-a').value,
        b: document.getElementById('role-b').value,
        d: document.getElementById('role-d').value
      };
      overlay.hidden = true;
      state = 'play';
      loadLevel(4);
    }
  };
  document.getElementById('btn-pause').onclick = () => {
    if (state === 'play') {
      state = 'paused';
      modalTitle.textContent = 'MISSION PAUSED';
      modalBody.textContent = 'Resume or restart the current operation.';
      btnPrimary.textContent = 'Resume';
      btnSecondary.hidden = false;
      btnSecondary.textContent = 'Restart';
      btnPrimary.onclick = () => { overlay.hidden = true; state = 'play'; };
      btnSecondary.onclick = () => { overlay.hidden = true; state = 'play'; loadLevel(currentLevel); };
      overlay.hidden = false;
    }
  };
  document.getElementById('btn-restart').onclick = () => { overlay.hidden = true; state = 'play'; loadLevel(currentLevel); };

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Tab' && state === 'play' && players.length > 1) {
      e.preventDefault();
      activePlayer = (activePlayer + 1) % players.length;
    }
    if (e.code === 'Space' && state === 'play') {
      if (currentLevel === 9) {
        const p = players[0];
        bullets.push({ x: p.x, y: p.y, vx: Math.cos(p.angle) * 520, vy: Math.sin(p.angle) * 520, friendly: true });
      } else if (currentLevel === 10 && dashTimer <= 0) {
        dashTimer = 0.35;
      }
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (state === 'play') {
      if (spotCd > 0) spotCd -= dt;
      if (dashTimer > 0) dashTimer -= dt;
      if (LEVELS[currentLevel - 1].timeLimit > 0) {
        timer = Math.max(0, timer - dt);
        hudTimer.textContent = 'TIME: ' + Math.ceil(timer) + 's';
        if (timer <= 0) showResult('BUSTED', 'Time ran out before extraction.', 'Retry', () => { overlay.hidden = true; state = 'play'; loadLevel(currentLevel); });
      }

      if (currentLevel === 6) {
        const sx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
        carX = clamp(carX + sx * 300 * dt, 240, 760);
        highwayDist += 440 * dt;
        for (const c of traffic) {
          c.y += (440 - c.vy) * dt;
          if (c.y > 700) { c.y = -120; c.x = 280 + ((c.x * 13) % 450); }
          if (Math.abs(c.x - carX) < 38 && Math.abs(c.y - 500) < 62) {
            c.y = -180;
            if (spotCd <= 0) { spotted++; spotCd = 1.1; hudSpots.textContent = 'SPOTTED: ' + spotted + ' / 3'; }
            if (spotted >= 3) showResult('CRASHED', 'Van disabled before reaching the roadblock.', 'Retry', () => { overlay.hidden = true; state = 'play'; loadLevel(6); });
          }
        }
        if (highwayDist >= 3000) {
          showResult('THE MISTAKE', 'John broke through Shamus’s roadblock—his family was inside that car. "You took everything from me."', 'Level 7', () => { overlay.hidden = true; state = 'play'; loadLevel(7); });
        }
      } else {
        const p = players[activePlayer];
        const mx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
        const my = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
        if (mx || my) {
          const len = Math.hypot(mx, my);
          const spd = dashTimer > 0 ? p.speed * 1.9 : p.speed;
          const nx = clamp(p.x + (mx / len) * spd * dt, 20, 980);
          const ny = clamp(p.y + (my / len) * spd * dt, 20, 600);
          let blocked = false;
          for (const w of walls) {
            if (!w.pass && nx + 12 > w.x && nx - 12 < w.x + w.w && ny + 12 > w.y && ny - 12 < w.y + w.h) blocked = true;
          }
          if (!blocked) { p.x = nx; p.y = ny; }
          p.angle = Math.atan2(my, mx);
        }

        for (const g of guards) {
          if (g.hp <= 0) continue;
          const tgt = g.pts[g.wi];
          const d = dist(g.x, g.y, tgt.x, tgt.y);
          if (d < 4) g.wi = (g.wi + 1) % g.pts.length;
          else {
            g.angle = Math.atan2(tgt.y - g.y, tgt.x - g.x);
            g.x += ((tgt.x - g.x) / d) * g.speed * dt;
            g.y += ((tgt.y - g.y) / d) * g.speed * dt;
          }
          if (currentLevel !== 9 && inCone(p.x, p.y, g) && spotCd <= 0) {
            spotted++; spotCd = 1.2;
            hudSpots.textContent = 'SPOTTED: ' + spotted + ' / 3';
            if (spotted >= 3) showResult('BUSTED', 'Spotted by ' + g.name + '.', 'Retry', () => { overlay.hidden = true; state = 'play'; loadLevel(currentLevel); });
          }
          if (currentLevel === 9) {
            g.cd = (g.cd || 1) - dt;
            if (g.cd <= 0) {
              g.cd = 1.5;
              const a = Math.atan2(p.y - g.y, p.x - g.x);
              bullets.push({ x: g.x, y: g.y, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, friendly: false });
            }
          }
        }

        if (currentLevel === 1) {
          if (dist(p.x, p.y, 745, 385) < 36 && !mx && !my) hold += dt;
          if (hold >= 3) showResult('LEVEL 1 CLEAR', 'Secret meeting photographed.', 'Level 2', () => { overlay.hidden = true; state = 'play'; loadLevel(2); });
        } else if (currentLevel === 2) {
          if (phase === 0 && dist(p.x, p.y, 490, 530) < 34) { phase = 1; commsSpeaker.textContent = 'SHASHA (note)'; commsText.textContent = '"Take it. Never contact me again."'; }
          else if (phase === 1 && dist(p.x, p.y, 210, 445) < 34) { hold += dt; if (hold >= 2.5) phase = 2; }
          else if (phase === 2 && dist(p.x, p.y, 490, 365) < 32) showResult('LEVEL 2 CLEAR', 'Vault blueprint retrieved.', 'Level 3', () => { overlay.hidden = true; state = 'play'; loadLevel(3); });
        } else if (currentLevel === 4) {
          if (!vaultOpen && dist(players[0].x, players[0].y, 590, 170) < 30 && dist(players[1].x, players[1].y, 590, 450) < 30) {
            vaultOpen = true; walls = walls.filter(w => !w.vault);
          }
          if (vaultOpen) {
            bags.forEach(b => { if (dist(p.x, p.y, b.x, b.y) < 28) b.got = true; });
            if (bags.every(b => b.got) && dist(p.x, p.y, 85, 310) < 42) showResult('LEVEL 4 CLEAR', 'Crown Vault emptied!', 'Level 5', () => { overlay.hidden = true; state = 'play'; loadLevel(5); });
          }
        } else if (currentLevel === 5 || currentLevel === 8) {
          const dropX = currentLevel === 5 ? 75 : 885;
          bags.forEach(b => { if (!b.got && dist(p.x, p.y, b.x, b.y) < 28) b.got = true; });
          if (dist(p.x, p.y, dropX, 310) < 46) bags.forEach(b => { if (b.got) b.del = true; });
          if (bags.every(b => b.del)) showResult('LEVEL ' + currentLevel + ' CLEAR', 'All cash secured!', 'Next Level', () => { overlay.hidden = true; state = 'play'; loadLevel(currentLevel + 1); });
        } else if (currentLevel === 7) {
          if (phase === 0 && dist(p.x, p.y, 840, 340) < 40) { hold += dt; if (hold >= 5) { phase = 1; commsSpeaker.textContent = 'SHAMUS'; commsText.textContent = '"I want Roman, Brock, John, Randy. All four."'; } }
          if (phase === 1 && dist(p.x, p.y, 95, 120) < 36) showResult('LEVEL 7 CLEAR', 'Wiretap complete.', 'Level 8', () => { overlay.hidden = true; state = 'play'; loadLevel(8); });
        } else if (currentLevel === 9) {
          for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.x += b.vx * dt; b.y += b.vy * dt;
            if (b.x < 0 || b.x > 1000 || b.y < 0 || b.y > 620) { bullets.splice(i, 1); continue; }
            if (b.friendly) {
              for (const g of guards) {
                if (g.hp > 0 && dist(b.x, b.y, g.x, g.y) < 18) { g.hp -= 25; bullets.splice(i, 1); break; }
              }
            } else if (dist(b.x, b.y, p.x, p.y) < 16) {
              p.hp -= 15; bullets.splice(i, 1);
              if (p.hp <= 0) showResult('DOWN', 'Overwhelmed in Pablo’s warehouse.', 'Retry', () => { overlay.hidden = true; state = 'play'; loadLevel(9); });
            }
          }
          if (guards.every(g => g.hp <= 0)) showResult('PABLO DEFEATED', 'Now only Shamus remains.', 'Level 10', () => { overlay.hidden = true; state = 'play'; loadLevel(10); });
        } else if (currentLevel === 10) {
          if (dashTimer <= 0) {
            for (const gp of gaps) {
              if (p.x > gp.x + 4 && p.x < gp.x + gp.w - 4) { p.x = gp.x - 14; }
            }
          }
          if (dist(p.x, p.y, 920, 310) < 40) {
            showResult('TO BE CONTINUED...', 'Shamus leaps across the rooftops and disappears. "This isn’t over, Roman. I’ll be waiting."', 'Play Again', () => { overlay.hidden = true; state = 'play'; loadLevel(1); });
          }
        }
      }
    }

    // Draw frame
    ctx.fillStyle = '#090b10';
    ctx.fillRect(0, 0, 1000, 620);
    if (currentLevel === 6) {
      ctx.fillStyle = '#181c26'; ctx.fillRect(210, 0, 580, 620);
      ctx.fillStyle = '#e5a93b'; ctx.fillRect(carX - 22, 460, 44, 80);
      for (const c of traffic) { ctx.fillStyle = c.police ? '#ef4444' : '#64748b'; ctx.fillRect(c.x - 22, c.y - 40, 44, 80); }
    } else {
      for (const gp of gaps) { ctx.fillStyle = '#030407'; ctx.fillRect(gp.x, 40, gp.w, 540); }
      for (const w of walls) { ctx.fillStyle = w.vault ? '#78350f' : '#1e293b'; ctx.fillRect(w.x, w.y, w.w, w.h); }
      for (const b of bags) { if (!b.got) { ctx.fillStyle = '#22c55e'; ctx.fillRect(b.x - 10, b.y - 7, 20, 14); } }
      for (const g of guards) {
        if (g.hp <= 0) continue;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
        ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.arc(g.x, g.y, g.range, g.angle - g.fov/2, g.angle + g.fov/2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = g.color; ctx.beginPath(); ctx.arc(g.x, g.y, 12, 0, Math.PI * 2); ctx.fill();
      }
      for (const p of players) {
        ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
      }
      for (const b of bullets) { ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill(); }
    }

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
`;

  const charactersHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Shadows &amp; Gears — 3D Character Roster</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { margin: 0; overflow: hidden; background: #14181e; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; }
    #header { position: fixed; top: 18px; left: 18px; z-index: 10; display: flex; gap: 10px; align-items: flex-start; }
    .card { background: rgba(11, 15, 23, 0.9); border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 6px; padding: 10px 14px; max-width: 360px; }
    .back { display: inline-block; background: rgba(11, 15, 23, 0.9); border: 1px solid rgba(148, 163, 184, 0.28); color: #e2e8f0; text-decoration: none; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; }
    .back:hover { background: #1a2232; }
    .kicker { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #e5a93b; font-weight: 700; }
    h1 { font-size: 20px; margin: 2px 0 4px; }
    p { font-size: 12px; color: #cbd5e1; line-height: 1.45; }
    #dock { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 10; display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; background: rgba(11, 15, 23, 0.92); border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 6px; }
    .btn { background: #171f2e; color: #e2e8f0; border: 1px solid #334155; padding: 7px 12px; border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn.active { background: #e5a93b; color: #090b10; border-color: #e5a93b; }
  </style>
  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
      }
    }
  </script>
</head>
<body>
  <div id="header">
    <a class="back" href="index.html">Back to Game</a>
    <div class="card">
      <div class="kicker" id="char-meta">5'5" · P3 · The Muscle</div>
      <h1 id="char-name">John</h1>
      <p id="char-desc">Red-and-navy checkered shirt with rolled sleeves, bowl cut, skinny jeans, and sneakers.</p>
    </div>
  </div>
  <div id="dock"></div>

  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

    const SPECS = [
      { id: 'roman', name: 'Roman', meta: "5'10\\" · P1 · Street Bruiser", desc: 'Boxy dark-brown leather zip jacket over fitted matte-black crewneck tee, dark curls with beard, silver accents, street trousers, and boots.', targetY: 0.98, cam: [0, 1.32, 3.55], bg: 0x181c20 },
      { id: 'john', name: 'John', meta: "5'5\\" · P3 · The Muscle", desc: 'Red-and-navy checkered shirt with rolled sleeves, bowl cut, skinny jeans, and sneakers.', targetY: 0.9, cam: [0, 1.3, 3.6], bg: 0x161c22 },
      { id: 'brock', name: 'Brock', meta: "5'10\\" · P2 · Hacker / Heavy", desc: 'V-taper frame in olive tank top and dark denim vest, French beard, utility pouches, and combat boots.', targetY: 1.0, cam: [0, 1.35, 3.6], bg: 0x14181e },
      { id: 'randy', name: 'Randy', meta: "7'0\\" · P4 · Agile Striker & Driver", desc: 'Lean 7-foot frame with charcoal compression top, slate open jacket with amber trim, crossbody sling, and fade.', targetY: 1.15, cam: [0, 1.5, 4.1], bg: 0x14181e },
      { id: 'shasha', name: 'Shasha', meta: "5'6\\" · Target · Precision Infiltrator", desc: 'Tailored crimson-plum trench coat over obsidian turtleneck, leather gloves, and sleek dark bob.', targetY: 0.92, cam: [0, 1.28, 3.5], bg: 0x17141d },
      { id: 'pablo', name: 'Pablo', meta: "6'0\\" · Villain · Syndicate Boss", desc: 'Weathered espresso leather coat over dark linen shirt, rugged beard, hip holster, gold watch, and signet ring.', targetY: 1.02, cam: [0, 1.38, 3.7], bg: 0x181512 },
      { id: 'shamus', name: 'Officer Shamus', meta: "5'11\\" · Villain · Tactical Vanguard", desc: 'Matte black ballistic vest with silver police badge over navy uniform, textured dark curls, handcuffs, and duty holster.', targetY: 1.0, cam: [0, 1.36, 3.6], bg: 0x181c20 },
    ];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SPECS[0].bg);
    scene.fog = new THREE.Fog(SPECS[0].bg, 6, 18);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(...SPECS[0].cam);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, SPECS[0].targetY, 0);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;

    scene.add(new THREE.HemisphereLight(0xddeeff, 0x22242a, 0.95));
    const dir = new THREE.DirectionalLight(0xfff1e0, 1.9);
    dir.position.set(2.5, 4.8, 3.2);
    dir.castShadow = true;
    scene.add(dir);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 48),
      new THREE.MeshStandardMaterial({ color: 0x20252d, roughness: 0.85 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    scene.add(new THREE.GridHelper(6.4, 24, 0x3b4252, 0x2a303c));

    function makeCheckTex() {
      const c = document.createElement('canvas'); c.width = 256; c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#8b2635'; g.fillRect(0, 0, 256, 256);
      g.fillStyle = 'rgba(24,34,64,0.65)';
      for (let i = 0; i < 256; i += 32) { g.fillRect(i, 0, 16, 256); g.fillRect(0, i, 256, 16); }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(3, 3);
      return t;
    }

    function buildFigure(id) {
      const root = new THREE.Group();
      const s = id === 'randy' ? 1.18 : id === 'pablo' ? 1.04 : id === 'brock' || id === 'shamus' || id === 'roman' ? 1.02 : id === 'shasha' ? 0.95 : 0.94;
      const skinHex = id === 'john' ? 0xf1c27d : id === 'brock' ? 0xe0ac69 : id === 'randy' ? 0xc68642 : id === 'shasha' ? 0xefc396 : id === 'shamus' ? 0xa46c43 : id === 'roman' ? 0x935d37 : 0xd2996c;
      const coatHex = id === 'john' ? 0xffffff : id === 'brock' ? 0x1e293b : id === 'randy' ? 0x2c3e50 : id === 'shasha' ? 0x6b1d3a : id === 'shamus' ? 0x16191e : id === 'roman' ? 0x382216 : 0x3b2416;
      const pantHex = id === 'john' ? 0x1d3557 : id === 'shasha' ? 0x14161f : id === 'shamus' ? 0x1c2536 : id === 'roman' ? 0x1a1c20 : 0x181c24;
      const skin = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.58 });
      const topMat = id === 'john'
        ? new THREE.MeshStandardMaterial({ color: 0xffffff, map: makeCheckTex(), roughness: 0.75 })
        : new THREE.MeshStandardMaterial({ color: coatHex, roughness: id === 'pablo' || id === 'roman' ? 0.55 : 0.7 });
      const pantMat = new THREE.MeshStandardMaterial({ color: pantHex, roughness: 0.8 });
      const hairMat = new THREE.MeshStandardMaterial({ color: 0x1b1512, roughness: 0.85 });

      const chest = new THREE.Mesh(new THREE.CylinderGeometry(id === 'brock' || id === 'shamus' || id === 'roman' ? 0.22 : 0.18, 0.16, 0.44 * s, 20), topMat);
      chest.position.y = 1.1 * s;
      chest.castShadow = true;
      root.add(chest);

      if (id === 'roman') {
        const tee = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42 * s, 0.23), new THREE.MeshStandardMaterial({ color: 0x16171a, roughness: 0.8 }));
        tee.position.set(0, 1.1 * s, 0.04);
        root.add(tee);
      }

      if (id === 'shamus') {
        const silver = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });
        const badge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.02), silver);
        badge.position.set(-0.09, 1.18 * s, 0.19);
        root.add(badge);
      }

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 24), skin);
      head.position.y = 1.48 * s;
      head.castShadow = true;
      root.add(head);

      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.145, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
      hair.position.set(0, 1.49 * s, -0.005);
      root.add(hair);

      [-1, 1].forEach((side) => {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.48 * s, 16), topMat);
        arm.position.set(side * 0.23, 1.05 * s, 0);
        arm.rotation.z = side * -0.1;
        arm.castShadow = true;
        root.add(arm);

        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.055, 0.74 * s, 16), pantMat);
        leg.position.set(side * 0.095, 0.41 * s, 0);
        leg.castShadow = true;
        root.add(leg);

        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.22), hairMat);
        shoe.position.set(side * 0.095, 0.035, 0.035);
        root.add(shoe);
      });
      return root;
    }

    let currentGroup = buildFigure(SPECS[0].id);
    scene.add(currentGroup);

    const dock = document.getElementById('dock');
    const buttons = [];
    function selectChar(spec) {
      scene.remove(currentGroup);
      currentGroup = buildFigure(spec.id);
      scene.add(currentGroup);
      scene.background = new THREE.Color(spec.bg);
      scene.fog.color.setHex(spec.bg);
      camera.position.set(...spec.cam);
      controls.target.set(0, spec.targetY, 0);
      controls.update();
      document.getElementById('char-meta').textContent = spec.meta;
      document.getElementById('char-name').textContent = spec.name;
      document.getElementById('char-desc').textContent = spec.desc;
      buttons.forEach((b) => b.classList.toggle('active', b.dataset.id === spec.id));
    }

    SPECS.forEach((spec, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn' + (idx === 0 ? ' active' : '');
      btn.dataset.id = spec.id;
      btn.textContent = spec.name;
      btn.onclick = () => selectChar(spec);
      dock.appendChild(btn);
      buttons.push(btn);
    });

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      currentGroup.rotation.y = Math.sin(clock.getElapsedTime() * 0.4) * 0.25;
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
  </script>
</body>
</html>
`;

  const readme = `SHADOWS & GEARS — 10-LEVEL STANDALONE WEBPAGE
==============================================

CREW
- Roman (P1, infiltrator)
- Brock (P2, hacker)
- John (P3, muscle)
- Randy (P4, driver)
- Static (handler)

TARGETS & VILLAINS
- Mr. Malhotra (bank manager) & Shasha (his wife)
- Inspector Shamus & Pablo

HOW TO PLAY
1. Extract this ZIP folder.
2. Open index.html in any modern browser to play all 10 levels.
3. Open characters.html (or click "3D Characters" on the title card) to inspect Roman, John, Brock, Randy, Shasha, Pablo, and Officer Shamus in 3D.
4. Move with WASD / Arrow keys, Space to shoot/leap, Tab to switch crew in Level 4.
`;

  return [
    { path: 'shadows-and-gears/index.html', content: indexHtml },
    { path: 'shadows-and-gears/style.css', content: styleCss },
    { path: 'shadows-and-gears/game.js', content: gameJs },
    { path: 'shadows-and-gears/characters.html', content: charactersHtml },
    { path: 'shadows-and-gears/README.txt', content: readme },
  ];
}

export function buildStandaloneWebpageZip(): Uint8Array {
  return createZipArchive(buildStandaloneWebpageEntries());
}
