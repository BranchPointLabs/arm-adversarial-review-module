const canvas = document.getElementById("reviewCanvas");
const ctx = canvas.getContext("2d");

const labels = [
  "artifact",
  "critic",
  "product",
  "technical",
  "quality",
  "security",
  "decision",
];

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw(time) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);

  const centerX = width * 0.5;
  const centerY = height * 0.46;
  const radius = Math.min(width, height) * 0.31;
  const pulse = (Math.sin(time / 800) + 1) / 2;

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(23, 32, 27, 0.12)";
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * (0.35 + i * 0.11), 0, Math.PI * 2);
    ctx.stroke();
  }

  const nodes = labels.map((label, index) => {
    const angle = -Math.PI / 2 + (index / labels.length) * Math.PI * 2;
    const nodeRadius = label === "artifact" || label === "decision" ? radius * 0.78 : radius;
    return {
      label,
      x: centerX + Math.cos(angle) * nodeRadius,
      y: centerY + Math.sin(angle) * nodeRadius,
      size: label === "artifact" || label === "decision" ? 56 : 46,
    };
  });

  const artifact = nodes[0];
  const decision = nodes[nodes.length - 1];

  nodes.slice(1, -1).forEach((node, index) => {
    const alpha = 0.28 + 0.18 * Math.sin(time / 620 + index);
    ctx.strokeStyle = `rgba(15, 118, 110, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(artifact.x, artifact.y);
    ctx.lineTo(node.x, node.y);
    ctx.lineTo(decision.x, decision.y);
    ctx.stroke();
  });

  nodes.forEach((node, index) => {
    const active = (time / 900 + index) % labels.length < 1;
    ctx.fillStyle = active ? "#0f766e" : "#ffffff";
    ctx.strokeStyle = active ? "#0b5751" : "rgba(23, 32, 27, 0.22)";
    ctx.lineWidth = active ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(node.x - node.size / 2, node.y - 24, node.size, 48, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = active ? "#ffffff" : "#17201b";
    ctx.font = "700 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.label, node.x, node.y);
  });

  const orbitAngle = time / 1200;
  ctx.fillStyle = `rgba(180, 83, 9, ${0.55 + pulse * 0.35})`;
  ctx.beginPath();
  ctx.arc(
    centerX + Math.cos(orbitAngle) * radius * 0.55,
    centerY + Math.sin(orbitAngle) * radius * 0.55,
    6,
    0,
    Math.PI * 2
  );
  ctx.fill();

  requestAnimationFrame(draw);
}

if ("ResizeObserver" in window) {
  new ResizeObserver(resizeCanvas).observe(canvas);
} else {
  window.addEventListener("resize", resizeCanvas);
}

resizeCanvas();
requestAnimationFrame(draw);
