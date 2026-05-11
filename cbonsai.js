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
  probe.textContent = "x".repeat(120);
  document.body.appendChild(probe);
  const charWidth = probe.getBoundingClientRect().width / 120;
  document.body.removeChild(probe);

  const availWidth = element.getBoundingClientRect().width;
  const autoCols = Math.min(
    120,
    Math.max(50, Math.floor(availWidth / charWidth)),
  );

  const config = {
    lifeStart: 50,
    leaves: ["&", "%", "#", "@", "*"],
    cols: autoCols,
    rows: 40,
    seed: null,
    msPerStep: 3,
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

  const WOOD_LIGHT = "#8D6E63";
  const WOOD_DARK = "#4E342E";
  const LEAF_LIGHT = "#66BB6A";
  const LEAF_DARK = "#2E7D32";
  const MOSS_COLOR = "#8B9B6A";

  const events = [];
  function setCell(y, x, char, color) {
    if (y >= 0 && y < config.rows && x >= 0 && x < config.cols)
      events.push({ y, x, char, color });
  }

  // Height ceiling scales with width so the tree keeps a sane aspect ratio
  // when cols shrinks on mobile. Set inside generateOak() once splitY is known.
  let minBranchY = 0;

  function generateOak() {
    const startY = config.rows - 2;
    const startX = Math.floor(config.cols / 2);
    const maxCanopyHeight = Math.floor(config.cols * 0.45);

    const minGrassX = Math.floor(config.cols * 0.25);
    const maxGrassX = Math.floor(config.cols * 0.75);

    for (let x = minGrassX; x <= maxGrassX; x++) {
      // Skip grass tufts directly under the trunk so the base connects solidly
      const isUnderTrunk = x >= startX - 3 && x <= startX + 3;
      const g1 = rand(4) === 0 && !isUnderTrunk ? '"' : "_";
      const g2 = rand(3) === 0 ? "~" : "-";

      setCell(config.rows - 2, x, g1, LEAF_DARK);
      setCell(config.rows - 1, x, g2, LEAF_DARK);
    }

    const trunkHeight = 4 + rand(4);
    for (let i = 0; i < trunkHeight; i++) {
      const width = i === 0 ? 3 : i < 2 ? 2 : 1;
      for (let w = -width; w <= width; w++) {
        let char = "|";
        if (i === 0) {
          if (w === -width) char = "/";
          else if (w === width) char = "\\";
          else char = "_";
        }
        setCell(
          startY - i,
          startX + w,
          char,
          rand(3) === 0 ? WOOD_LIGHT : WOOD_DARK,
        );
      }
    }

    const splitY = startY - trunkHeight;
    minBranchY = splitY - maxCanopyHeight;

    growLimb(splitY, startX - 2, -1.8, config.lifeStart, 0);
    growLimb(splitY + 1, startX - 1, -1.2, config.lifeStart * 0.85, 0.2);

    growLimb(splitY, startX + 2, 1.8, config.lifeStart, 0);
    growLimb(splitY + 1, startX + 1, 1.2, config.lifeStart * 0.85, 0.2);

    growLimb(splitY, startX, (rand(3) - 1) * 0.5, config.lifeStart * 0.5, 0.6);
    growLimb(splitY, startX - 1, -0.5, config.lifeStart * 0.45, 0.5);
    growLimb(splitY, startX + 1, 0.5, config.lifeStart * 0.45, 0.5);
  }

  function growLimb(y, x, dirX, life, verticality) {
    let currentX = x;
    let currentY = y;
    let currentLife = life;

    while (currentLife > 0) {
      currentLife--;

      let dx = 0;
      let dy = 0;
      const agePhase = life - currentLife;

      if (dirX < -1) dx = rand(10) > 2 ? -1 : 0;
      else if (dirX > 1) dx = rand(10) > 2 ? 1 : 0;
      else if (dirX < 0) dx = rand(10) > 4 ? -1 : 0;
      else if (dirX > 0) dx = rand(10) > 4 ? 1 : 0;
      else dx = rand(3) - 1;

      // Boundary Repulsion: Prevent flat edges by curling branches inward
      if (currentX < 6) {
        dx = rand(3) === 0 ? 0 : 1;
      } else if (currentX > config.cols - 7) {
        dx = rand(3) === 0 ? 0 : -1;
      }

      if (verticality < 0.5) {
        if (agePhase < life * 0.3) {
          dy = rand(5) === 0 ? -1 : 0;
        } else if (agePhase < life * 0.6) {
          dy = rand(6) === 0 ? 1 : 0;
        } else {
          dy = rand(4) === 0 ? -1 : 0;
        }
      } else {
        dy = rand(10) > (verticality > 0.8 ? 2 : 5) ? -1 : 0;
      }

      // Cap canopy height: once at the ceiling, spread sideways instead of up
      if (dy < 0 && currentY <= minBranchY) {
        dy = 0;
        if (dx === 0) dx = rand(2) === 0 ? -1 : 1;
      }

      currentX += dx;
      currentY += dy;

      let char = dx < 0 ? "\\" : dx > 0 ? "/" : "|";
      if (dy === 0 && dx !== 0) char = "_";
      setCell(currentY, currentX, char, rand(3) === 0 ? WOOD_LIGHT : WOOD_DARK);

      if (currentLife > 10 && rand(12) === 0) {
        const newDirX = dirX + (rand(3) - 1) * 0.5;
        const newVert = verticality + 0.3;
        growLimb(
          currentY,
          currentX,
          newDirX,
          currentLife * (0.5 + rand(3) * 0.1),
          newVert,
        );
      }

      if (dy === 0 && dx !== 0 && rand(12) === 0 && currentLife > 5) {
        const mossLength = 3 + rand(6);
        for (let m = 0; m < mossLength; m++) {
          const mChar = m === mossLength - 1 ? "." : rand(2) === 0 ? "|" : ":";
          setCell(currentY + 1 + m, currentX, mChar, MOSS_COLOR);
        }
      }

      if (currentLife < 8) {
        for (let i = 0; i < 4; i++) {
          const fy = currentY + (rand(5) - 2);
          const fx = currentX + (rand(7) - 3);
          const leafChar = config.leaves[rand(config.leaves.length)];
          setCell(fy, fx, leafChar, rand(2) === 0 ? LEAF_LIGHT : LEAF_DARK);
        }
      }
    }
  }

  generateOak();

  const firstRow = events.reduce(
    (min, e) => Math.min(min, e.y),
    config.rows - 1,
  );
  const usedRows = config.rows - firstRow;

  element.style.display = "flex";
  element.style.justifyContent = "flex-start";
  element.style.alignItems = "flex-end";
  element.style.overflow = "hidden";

  const inner = document.createElement("div");
  inner.style.flexShrink = "0";
  inner.style.width = `${Math.round(config.cols * charWidth)}px`;
  element.appendChild(inner);

  const cellEls = Array.from(
    { length: usedRows },
    () => new Array(config.cols),
  );
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
