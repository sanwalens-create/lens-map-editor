const canvas = document.getElementById("lensCanvas");
const ctx = canvas.getContext("2d");

const penBtn = document.getElementById("penBtn");
const eraserBtn = document.getElementById("eraserBtn");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");
const backBtn = document.getElementById("backBtn");
const size05Btn = document.getElementById("size05Btn");
const size1Btn  = document.getElementById("size1Btn");
const size2Btn  = document.getElementById("size2Btn");
const size4Btn  = document.getElementById("size4Btn");
const size8Btn  = document.getElementById("size8Btn");
const surfaceBtn = document.getElementById("surfaceBtn");
const insideBtn = document.getElementById("insideBtn");

let tool = "pen";
let penSize = 1;
let penColor = "#111";
let drawing = false;
let lastX = 0;
let lastY = 0;
let history = [];

function resizeCanvas() {
  const size = Math.min(window.innerWidth * 0.92, (window.innerHeight - 126) * 0.92);
  canvas.width = size * window.devicePixelRatio;
  canvas.height = size * window.devicePixelRatio;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  drawBase();
  saveHistory();
}

function drawBase() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.36;

  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#8f8f8f";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#444";
  ctx.font = "bold 28px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText("12", cx, cy - r - 36);
  ctx.fillText("3", cx + r + 36, cy);
  ctx.fillText("6", cx, cy + r + 36);
  ctx.fillText("9", cx - r - 36, cy);

  drawTick(cx, cy - r, cx, cy - r + 22);
  drawTick(cx + r - 22, cy, cx + r + 22, cy);
  drawTick(cx, cy + r - 22, cx, cy + r + 22);
  drawTick(cx - r - 22, cy, cx - r + 22, cy);
}

function drawTick(x1, y1, x2, y2) {
  ctx.strokeStyle = "#8f8f8f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const p = e.touches ? e.touches[0] : e;
  return {
    x: p.clientX - rect.left,
    y: p.clientY - rect.top,
  };
}

function startDraw(e) {
  e.preventDefault();
  drawing = true;
  const pos = getPos(e);
  lastX = pos.x;
  lastY = pos.y;
}

function draw(e) {
  if (!drawing) return;
  e.preventDefault();

  const pos = getPos(e);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (tool === "pen") {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize;
  } else {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 22;
  }

  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();

  lastX = pos.x;
  lastY = pos.y;
}

function endDraw() {
  if (!drawing) return;
  drawing = false;
  ctx.globalCompositeOperation = "source-over";
  saveHistory();
}

function saveHistory() {
  history.push(canvas.toDataURL());
  if (history.length > 20) history.shift();
}

function restoreFromDataUrl(dataUrl) {
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.drawImage(img, 0, 0, canvas.clientWidth, canvas.clientHeight);
  };
  img.src = dataUrl;
}

penBtn.onclick = () => {
  tool = "pen";
  penBtn.classList.add("active");
  eraserBtn.classList.remove("active");
};

eraserBtn.onclick = () => {
  tool = "eraser";
  eraserBtn.classList.add("active");
  penBtn.classList.remove("active");
};

undoBtn.onclick = () => {
  if (history.length <= 1) return;
  history.pop();
  restoreFromDataUrl(history[history.length - 1]);
};

clearBtn.onclick = () => {
  if (!confirm("すべて消しますか？")) return;
  drawBase();
  saveHistory();
};

saveBtn.onclick = () => {
  const link = document.createElement("a");
  link.download = "lens-map.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
};

backBtn.onclick = () => {
  history.back();
};

canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", endDraw);
canvas.addEventListener("mouseleave", endDraw);

canvas.addEventListener("touchstart", startDraw, { passive: false });
canvas.addEventListener("touchmove", draw, { passive: false });
canvas.addEventListener("touchend", endDraw);

window.addEventListener("resize", resizeCanvas);

function setPenSize(size, activeButton) {
  penSize = size;

  size05Btn.classList.remove("active");
  size1Btn.classList.remove("active");
  size2Btn.classList.remove("active");
  size4Btn.classList.remove("active");
  size8Btn.classList.remove("active");

  activeButton.classList.add("active");
}

size05Btn.onclick = () => setPenSize(0.5, size05Btn);
size1Btn.onclick = () => setPenSize(1, size1Btn);
size2Btn.onclick = () => setPenSize(2, size2Btn);
size4Btn.onclick = () => setPenSize(4, size4Btn);
size8Btn.onclick = () => setPenSize(8, size8Btn);
surfaceBtn.onclick = () => {
    penColor = "#111"
    surfaceBtn.classList.add("active");
    insideBtn.classList.remove("active");
};

insideBtn.onclick = () => {
    penColor = "#d32f2f";
    insideBtn.classList.add("active");
    surfaceBtn.classList.remove("active");
};

resizeCanvas();