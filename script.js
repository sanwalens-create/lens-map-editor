// ========================================
// Lens Map Editor
// Version
// ========================================

const APP_VERSION = "v2.4.2";

const baseCanvas = document.getElementById("baseCanvas");
const drawCanvas = document.getElementById("drawCanvas");

const baseCtx = baseCanvas.getContext("2d");
const drawCtx = drawCanvas.getContext("2d");

const eraserBtn = document.getElementById("eraserBtn");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");
const backBtn = document.getElementById("backBtn");

const size05Btn = document.getElementById("size05Btn");
const size1Btn = document.getElementById("size1Btn");
const size2Btn = document.getElementById("size2Btn");
const size4Btn = document.getElementById("size4Btn");
const size8Btn = document.getElementById("size8Btn");

const surfaceBtn = document.getElementById("surfaceBtn");
const insideBtn = document.getElementById("insideBtn");
const title = document.getElementById("title");
const frontBtn = document.getElementById("frontBtn");
const rearBtn = document.getElementById("rearBtn");

let tool = "pen";
let penSize = 1;
let penColor = "#111";
let drawing = false;
let lastX = 0;
let lastY = 0;

let frontHistory = [];
let rearHistory = [];

let currentSide = "front";
// ---------- Lens Information ----------
let lensName = "";
let serialNo = "";
let receivedDate = "";
// -------- URL Parameters --------
const params = new URLSearchParams(window.location.search);

lensName = params.get("lens") || "";
serialNo = params.get("serial") || "";
receivedDate = params.get("received") || "";

console.log("Lens:", lensName);
console.log("Serial:", serialNo);
console.log("Received:", receivedDate);
// タイトルを更新
if (lensName) {
  title.textContent = lensName;
}

function resizeCanvas() {
  const size = Math.min(
    window.innerWidth * 0.92,
    (window.innerHeight - 126) * 0.92
  );

  const ratio = window.devicePixelRatio || 1;

  baseCanvas.width = drawCanvas.width = size * ratio;
  baseCanvas.height = drawCanvas.height = size * ratio;

  baseCanvas.style.width = drawCanvas.style.width = `${size}px`;
  baseCanvas.style.height = drawCanvas.style.height = `${size}px`;

  baseCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawCtx.setTransform(ratio, 0, 0, ratio, 0, 0);

  drawBase();
  loadCurrentSide();
}

function drawBase() {
  const size = Math.min(baseCanvas.clientWidth, baseCanvas.clientHeight);
  drawLensBase(baseCtx, 0, 0, size, true);
}

function drawLensBase(ctx, x, y, size, clearFirst = false) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.36;
  const fontSize = size * 0.056;
  const labelOffset = size * 0.092;
  const tick = size * 0.021;

  if (clearFirst) {
    ctx.clearRect(x, y, size, size);
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, size, size);

  ctx.strokeStyle = "#8f8f8f";
  ctx.lineWidth = Math.max(2, size * 0.004);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#444";
  ctx.font = `bold ${fontSize}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText("12", cx, cy - r - labelOffset);
  ctx.fillText("3", cx + r + labelOffset, cy);
  ctx.fillText("6", cx, cy + r + labelOffset);
  ctx.fillText("9", cx - r - labelOffset, cy);

  drawTick(ctx, cx, cy - r - tick, cx, cy - r, size);
  drawTick(ctx, cx + r, cy, cx + r + tick, cy, size);
  drawTick(ctx, cx, cy + r, cx, cy + r + tick, size);
  drawTick(ctx, cx - r - tick, cy, cx - r, cy, size);
}

function drawTick(ctx, x1, y1, x2, y2, size = baseCanvas.clientWidth) {
  ctx.strokeStyle = "#8f8f8f";
  ctx.lineWidth = Math.max(2, size * 0.004);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function getPos(e) {
  const rect = drawCanvas.getBoundingClientRect();
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

  drawCtx.lineCap = "round";
  drawCtx.lineJoin = "round";

  if (tool === "pen") {
    drawCtx.globalCompositeOperation = "source-over";
    drawCtx.strokeStyle = penColor;
    drawCtx.lineWidth = penSize;
  } else {
    drawCtx.globalCompositeOperation = "destination-out";
    drawCtx.lineWidth = 22;
  }

  drawCtx.beginPath();
  drawCtx.moveTo(lastX, lastY);
  drawCtx.lineTo(pos.x, pos.y);
  drawCtx.stroke();

  lastX = pos.x;
  lastY = pos.y;
}

function endDraw() {
  if (!drawing) return;

  drawing = false;
  drawCtx.globalCompositeOperation = "source-over";

  saveHistory();
}

function saveHistory() {
  const history = currentSide === "front" ? frontHistory : rearHistory;

  history.push(drawCanvas.toDataURL("image/png"));

  if (history.length > 20) {
    history.shift();
  }
}

function restoreFromDataUrl(dataUrl) {
  const img = new Image();

  img.onload = () => {
    drawCtx.clearRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
    drawCtx.drawImage(img, 0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
  };

  img.src = dataUrl;
}

function loadCurrentSide() {
  const history = currentSide === "front" ? frontHistory : rearHistory;

  if (history.length === 0) {
    drawCtx.clearRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
    return;
  }

  restoreFromDataUrl(history[history.length - 1]);
}

eraserBtn.onclick = () => {
  tool = "eraser";
  eraserBtn.classList.add("active");
};

undoBtn.onclick = () => {
  const history = currentSide === "front" ? frontHistory : rearHistory;

  if (history.length <= 1) {
    history.length = 0;
    drawCtx.clearRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
    return;
  }

  history.pop();
  restoreFromDataUrl(history[history.length - 1]);
};

clearBtn.onclick = () => {
  if (!confirm("描いた線をすべて消しますか？")) return;

  drawCtx.clearRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
  saveHistory();
};

saveBtn.onclick = () => {

    lensName = prompt("Lens Name", lensName) || lensName;
    serialNo = prompt("Serial No", serialNo) || serialNo;
    receivedDate = prompt("Received", receivedDate) || receivedDate;

    exportLensMap();

};

backBtn.onclick = () => {
  history.back();
};

drawCanvas.addEventListener("mousedown", startDraw);
drawCanvas.addEventListener("mousemove", draw);
drawCanvas.addEventListener("mouseup", endDraw);
drawCanvas.addEventListener("mouseleave", endDraw);

drawCanvas.addEventListener("touchstart", startDraw, { passive: false });
drawCanvas.addEventListener("touchmove", draw, { passive: false });
drawCanvas.addEventListener("touchend", endDraw, { passive: false });
drawCanvas.addEventListener("touchcancel", endDraw, { passive: false });

window.addEventListener("resize", resizeCanvas);

function setPenSize(size, activeButton) {
  penSize = size;
  tool = "pen";

  eraserBtn.classList.remove("active");

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
  penColor = "#111";
  tool = "pen";

  eraserBtn.classList.remove("active");
  surfaceBtn.classList.add("active");
  insideBtn.classList.remove("active");

  updatePenIcons();
};

insideBtn.onclick = () => {
  penColor = "#d32f2f";
  tool = "pen";

  eraserBtn.classList.remove("active");
  insideBtn.classList.add("active");
  surfaceBtn.classList.remove("active");

  updatePenIcons();
};

frontBtn.onclick = () => {
  currentSide = "front";

  frontBtn.classList.add("active");
  rearBtn.classList.remove("active");

  title.textContent = "フロントレンズ";

  loadCurrentSide();
};

rearBtn.onclick = () => {
  currentSide = "rear";

  rearBtn.classList.add("active");
  frontBtn.classList.remove("active");

  title.textContent = "リアレンズ";

  loadCurrentSide();
};

function updatePenIcons() {
  const color = penColor === "#111" ? "#111" : "#d32f2f";

  document.querySelectorAll(".penIcon").forEach((icon) => {
    icon.style.color = color;
  });
}

function getTodayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function sanitizeFileName(text) {
  return text
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_");
}

function getLatestImage(history) {
  return history.length > 0 ? history[history.length - 1] : null;
}

function loadImage(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve(null);
      return;
    }

    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function exportLensMap() {

  const receivedText = receivedDate;

  const frontData = getLatestImage(frontHistory);
  const rearData = getLatestImage(rearHistory);

  const [frontImg, rearImg] = await Promise.all([
    loadImage(frontData),
    loadImage(rearData),
  ]);

  const exportCanvas = document.createElement("canvas");
  const exportCtx = exportCanvas.getContext("2d");

  exportCanvas.width = 2048;
  exportCanvas.height = 1200;

  const W = exportCanvas.width;

  exportCtx.fillStyle = "#ffffff";
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  // ===== Title =====
  exportCtx.fillStyle = "#111";
  exportCtx.textAlign = "center";
  exportCtx.textBaseline = "middle";
  exportCtx.font = "bold 56px system-ui";
  exportCtx.fillText("Lens Map", W / 2, 70);

  // ===== Header =====
  exportCtx.textAlign = "left";
  exportCtx.fillStyle = "#111";
  exportCtx.font = "30px system-ui";

  const labelX = 120;
  const colonX = 270;
  const valueX = 300;

  exportCtx.fillText("Lens", labelX, 145);
  exportCtx.fillText(":", colonX, 145);
  exportCtx.fillText(lensName, valueX, 145);

  exportCtx.fillText("Serial", labelX, 195);
  exportCtx.fillText(":", colonX, 195);
  exportCtx.fillText(serialNo, valueX, 195);

  exportCtx.fillText("Received", labelX, 245);
  exportCtx.fillText(":", colonX, 245);
  exportCtx.fillText(receivedText, valueX, 245);

  exportCtx.strokeStyle = "#dddddd";
  exportCtx.lineWidth = 2;
  exportCtx.beginPath();
  exportCtx.moveTo(120, 285);
  exportCtx.lineTo(W - 120, 285);
  exportCtx.stroke();

  // ===== Lens =====
  const lensSize = 620;
  const leftX = 210;
  const rightX = W - leftX - lensSize;
  const lensY = 405;

  exportCtx.fillStyle = "#111";
  exportCtx.textAlign = "center";
  exportCtx.font = "bold 34px system-ui";
  exportCtx.fillText("Front", leftX + lensSize / 2, 355);
  exportCtx.fillText("Rear", rightX + lensSize / 2, 355);

  drawExportLens(exportCtx, leftX, lensY, lensSize, frontImg);
  drawExportLens(exportCtx, rightX, lensY, lensSize, rearImg);

  // ===== Legend =====
  exportCtx.strokeStyle = "#dddddd";
  exportCtx.lineWidth = 2;
  exportCtx.beginPath();
  exportCtx.moveTo(120, 1080);
  exportCtx.lineTo(W - 120, 1080);
  exportCtx.stroke();

  exportCtx.fillStyle = "#111";
  exportCtx.textAlign = "left";
  exportCtx.font = "bold 28px system-ui";
  exportCtx.fillText("Legend", 120, 1125);

  exportCtx.font = "26px system-ui";

  exportCtx.fillStyle = "#111";
  exportCtx.beginPath();
  exportCtx.arc(150, 1168, 8, 0, Math.PI * 2);
  exportCtx.fill();
  exportCtx.fillText("Surface", 170, 1168);

  exportCtx.fillStyle = "#d32f2f";
  exportCtx.beginPath();
  exportCtx.arc(420, 1168, 8, 0, Math.PI * 2);
  exportCtx.fill();

  exportCtx.fillStyle = "#111";
  exportCtx.fillText("Internal", 440, 1168);

  // ===== Center Line =====
  exportCtx.strokeStyle = "#e2e2e2";
  exportCtx.lineWidth = 2;
  exportCtx.beginPath();
  exportCtx.moveTo(W / 2, 340);
  exportCtx.lineTo(W / 2, 1100);
  exportCtx.stroke();

  // ===== File Name =====
  const nameParts = [
    sanitizeFileName(lensName),
    sanitizeFileName(serialNo),
    sanitizeFileName(receivedText),
  ].filter(Boolean);

  const fileName =
    nameParts.length > 0
      ? `${nameParts.join("_")}_LensMap.png`
      : `LensMap.png`;

  const link = document.createElement("a");
  link.download = fileName;
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
}

function drawExportLens(ctx, x, y, size, drawingImage) {
  ctx.save();

  drawLensBase(ctx, x, y, size, false);

  if (drawingImage) {
    ctx.drawImage(drawingImage, x, y, size, size);
  }

  ctx.strokeStyle = "#dddddd";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, size, size);

  ctx.restore();
}

setPenSize(0.5, size05Btn);
updatePenIcons();
resizeCanvas();
