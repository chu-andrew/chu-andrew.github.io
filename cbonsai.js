window.growBonsai = function (element, options = {}) {
  if (!element) return;

  // Set font before measuring so the probe uses the same face
  element.style.fontFamily = '"Courier New", monospace';
  element.style.fontSize = "16px";
  element.style.fontWeight = "bold";
  element.style.lineHeight = "1.2";

  const probe = document.createElement("span");
  probe.style.cssText =
    "position:absolute;visibility:hidden;white-space:pre;" +
    'font-family:"Courier New",monospace;font-size:16px;font-weight:bold';
  probe.textContent = "x".repeat(80);
  document.body.appendChild(probe);
  const charWidth = probe.getBoundingClientRect().width / 80;
  document.body.removeChild(probe);

  const availWidth = element.getBoundingClientRect().width;
  const autoCols = Math.min(
    80,
    Math.max(30, Math.floor(availWidth / charWidth)),
  );

  const config = {
    lifeStart: 32,
    multiplier: 5,
    leaves: ["&"],
    cols: autoCols,
    rows: 24,
    seed: null,
    msPerStep: 4,
    ...options,
  };

  // xorshift32 seeded RNG
  let rng =
    (config.seed != null
      ? config.seed
      : Math.floor(Math.random() * 0xffffffff)) >>> 0;
  if (rng === 0) rng = 1;
  function rand(n) {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    rng = rng >>> 0;
    return rng % n;
  }

  const TRUNK = 0,
    SHOOT_LEFT = 1,
    SHOOT_RIGHT = 2,
    DYING = 3,
    DEAD = 4;

  const WOOD_BRIGHT = "#CD853F",
    WOOD_DARK = "#8B4513",
    LEAF_BRIGHT = "#66BB6A",
    LEAF_DARK = "#2E7D32";

  // Phase 1: collect draw events without touching the DOM
  const events = [];
  function setCell(y, x, char, color) {
    if (y >= 0 && y < config.rows && x >= 0 && x < config.cols)
      events.push({ y, x, char, color });
  }

  function getColor(type) {
    switch (type) {
      case TRUNK:
      case SHOOT_LEFT:
      case SHOOT_RIGHT:
        return rand(2) === 0 ? WOOD_BRIGHT : WOOD_DARK;
      case DYING:
        return LEAF_BRIGHT;
      case DEAD:
        return rand(3) === 0 ? LEAF_BRIGHT : LEAF_DARK;
    }
  }

  // Lookup tables for weighted dx/dy distributions (replaces nested ternaries)
  const TRUNK_DX_MID = [-2, -1, -1, -1, -1, 0, 0, 1, 1, 2];
  const SHOOT_DY = [-1, -1, 0, 0, 0, 0, 0, 0, 1, 1];
  const SHOOT_DX_MAG = [2, 2, 1, 1, 1, 1, 0, 0, 0, -1];
  const DYING_DY = [-1, -1, 0, 0, 0, 0, 0, 0, 0, 1];
  const DYING_DX = [-3, -2, -2, -1, -1, -1, 0, 0, 0, 1, 1, 1, 2, 2, 3];
  const DEAD_DY = [-1, -1, -1, 0, 0, 0, 0, 1, 1, 1];

  function setDeltas(type, life) {
    const mult = config.multiplier;
    const age = config.lifeStart - life;
    let dx = 0,
      dy = 0;
    switch (type) {
      case TRUNK:
        if (age <= 2 || life < 4) {
          dx = rand(3) - 1;
        } else if (age < mult * 3) {
          dy = age % Math.max(1, Math.floor(mult * 0.5)) === 0 ? -1 : 0;
          dx = TRUNK_DX_MID[rand(10)];
        } else {
          dy = rand(10) > 2 ? -1 : 0;
          dx = rand(3) - 1;
        }
        break;
      case SHOOT_LEFT:
      case SHOOT_RIGHT: {
        const sign = type === SHOOT_LEFT ? -1 : 1;
        dy = SHOOT_DY[rand(10)];
        dx = sign * SHOOT_DX_MAG[rand(10)];
        break;
      }
      case DYING:
        dy = DYING_DY[rand(10)];
        dx = DYING_DX[rand(15)];
        break;
      case DEAD:
        dy = DEAD_DY[rand(10)];
        dx = rand(3) - 1;
        break;
    }
    return { dx, dy };
  }

  function chooseString(type, life, dx, dy) {
    const t = life < 4 ? DYING : type;
    if (t === TRUNK) {
      if (dy === 0) return "/~";
      if (dx < 0) return "\\|";
      if (dx === 0) return "/|\\";
      return "|/";
    }
    if (t === SHOOT_LEFT || t === SHOOT_RIGHT) {
      const horiz = t === SHOOT_LEFT ? "\\_" : "_/";
      const fall = t === SHOOT_LEFT ? "\\" : "/";
      if (dy > 0) return fall;
      if (dy === 0) return horiz;
      if (dx < 0) return "\\|";
      if (dx === 0) return "/|";
      return "/";
    }
    return config.leaves[rand(config.leaves.length)];
  }

  let shootCounter = rand(2);

  function branch(y, x, type, life) {
    let shootCooldown = config.multiplier;

    while (life > 0) {
      life--;

      const { dx, dy: rawDy } = setDeltas(type, life);
      let dy = rawDy;
      if (dy > 0 && y > config.rows - 2) dy--;

      if (life < 3) {
        branch(y, x, DEAD, life);
      } else if (
        (type === TRUNK || type === SHOOT_LEFT || type === SHOOT_RIGHT) &&
        life < config.multiplier + 2
      ) {
        branch(y, x, DYING, life);
      } else if (
        type === TRUNK &&
        (rand(3) === 0 || life % config.multiplier === 0)
      ) {
        if (rand(8) === 0 && life > 7) {
          shootCooldown = config.multiplier * 2;
          branch(y, x, TRUNK, life + (rand(5) - 2));
        } else if (shootCooldown <= 0) {
          shootCooldown = config.multiplier * 2;
          shootCounter++;
          branch(y, x, (shootCounter % 2) + 1, life + config.multiplier);
        }
      }
      shootCooldown--;

      x += dx;
      y += dy;

      const color = getColor(type);
      const str = chooseString(type, life, dx, dy);
      for (let i = 0; i < str.length; i++) setCell(y, x + i, str[i], color);
    }
  }

  branch(config.rows - 1, Math.floor(config.cols / 2), TRUNK, config.lifeStart);

  // Trim empty rows from the top so the container height matches the actual tree
  const firstRow = events.reduce(
    (min, e) => Math.min(min, e.y),
    config.rows - 1,
  );
  const usedRows = config.rows - firstRow;

  // Phase 2: build DOM (per-cell spans created once, mutated in place during animation)
  element.style.display = "flex";
  element.style.justifyContent = "flex-start";
  element.style.alignItems = "flex-end";
  element.style.overflow = "hidden";

  const inner = document.createElement("div");
  inner.style.flexShrink = "0";
  inner.style.width = `${Math.round(config.cols * charWidth)}px`;
  element.appendChild(inner);

  const cellEls = Array.from({ length: usedRows }, () => new Array(config.cols));
  for (let r = 0; r < usedRows; r++) {
    const div = document.createElement("div");
    div.style.whiteSpace = "pre";
    for (let x = 0; x < config.cols; x++) {
      const span = document.createElement("span");
      span.textContent = " ";
      div.appendChild(span);
      cellEls[r][x] = span;
    }
    inner.appendChild(div);
  }

  const baseLines = [
    ":___________./~~~\\.___________.:",
    " \\                            / ",
    "  \\__________________________/  ",
    "  (_)                      (_)  ",
  ];
  const baseX = Math.max(0, Math.floor((config.cols - baseLines[0].length) / 2));
  const baseEl = document.createElement("div");
  baseEl.style.whiteSpace = "pre";
  baseEl.style.color = WOOD_DARK;
  baseEl.textContent = baseLines.map((l) => " ".repeat(baseX) + l).join("\n");
  inner.appendChild(baseEl);

  let ei = 0;
  let lastTimestamp = null;
  let animFrame = null;
  let cancelled = false;

  function animate(timestamp) {
    if (cancelled) return;
    if (lastTimestamp === null) lastTimestamp = timestamp;

    const elapsed = Math.min(timestamp - lastTimestamp, 100);
    const steps = Math.max(1, Math.floor(elapsed / config.msPerStep));
    lastTimestamp = timestamp;

    for (let i = 0; i < steps && ei < events.length; i++) {
      const ev = events[ei++];
      const span = cellEls[ev.y - firstRow]?.[ev.x];
      if (span) {
        span.textContent = ev.char;
        span.style.color = ev.color;
      }
    }

    if (ei < events.length) {
      animFrame = requestAnimationFrame(animate);
    }
  }

  animFrame = requestAnimationFrame(animate);

  return function cancel() {
    cancelled = true;
    if (animFrame != null) cancelAnimationFrame(animFrame);
  };
};
