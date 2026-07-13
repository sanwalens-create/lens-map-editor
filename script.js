// ========================================
// Lens Map Editor
// Version 3.0.0
// ========================================

"use strict";

const APP_VERSION = "v3.0.0";
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycby27SYVZL79QHnLXPVa0Sd6NrNwWR9R23iM9yMsxv4XUOlwVKGZlxv10-LSdwFNiNcVkQ/exec";

const baseCanvas = document.getElementById("baseCanvas");
const drawCanvas = document.getElementById("drawCanvas");
const canvasWrap = document.getElementById("canvasWrap");
const baseCtx = baseCanvas.getContext("2d");
const drawCtx = drawCanvas.getContext("2d");

const title = document.getElementById("title");
const serialLabel = document.getElementById("serialLabel");
const versionLabel = document.getElementById("versionLabel");
const backBtn = document.getElementById("backBtn");
const saveBtn = document.getElementById("saveBtn");
const penBtn = document.getElementById("penBtn");
const eraserBtn = document.getElementById("eraserBtn");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const surfaceBtn = document.getElementById("surfaceBtn");
const insideBtn = document.getElementById("insideBtn");
const size05Btn = document.getElementById("size05Btn");
const size1Btn = document.getElementById("size1Btn");
const size2Btn = document.getElementById("size2Btn");
const size4Btn = document.getElementById("size4Btn");
const size8Btn = document.getElementById("size8Btn");

const params = new URLSearchParams(window.location.search);
const lensId = params.get("id") || "";
const lensName = params.get("lens") || "";
const serialNo = params.get("serial") || "";
const receivedDate = params.get("received") || "";
const requestedSide = (params.get("side") || "front").toLowerCase();
const currentSide = requestedSide === "rear" ? "rear" : "front";
const returnUrl = params.get("returnUrl") || params.get("return") || "";

let tool = "pen";
let penSize = 0.5;
let penColor = "#111";
let drawing = false;
let lastX = 0;
let lastY = 0;
let isSaving = false;
let canvasSize = 0;
let history = [];
let resizeTimer = null;

console.log("search =", window.location.search);
console.log("Lens Map Editor", APP_VERSION, {
  lensId,
  lensName,
  serialNo,
  receivedDate,
  currentSide,
  returnUrl
});

function sideLabel() {
  return currentSide === "rear" ? "Rear" : "Front";
}

function updateHeader() {
  title.textContent = `${lensName || "Lens Map"} ${sideLabel()}`;
  serialLabel.textContent = serialNo ? `S/N ${serialNo}` : "";
  versionLabel.textContent = APP_VERSION;
}

function isSafeReturnUrl(url) {
  if (!url) return false;

  try {
    const parsed = new URL(url, window.location.href);
    return ["https:", "http:", "appsheet:"].includes(parsed.protocol);
  } catch (error) {
    console.warn("Invalid return URL:", url, error);
    return false;
  }
}

function returnToAppSheet() {
  if (isSafeReturnUrl(returnUrl)) {
    window.location.replace(returnUrl);
    return;
  }

  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  alert("AppSheetへ戻れませんでした。画面を閉じてAppSheetを開いてください。");
}

function resizeCanvas() {
  const previousSnapshot = history.length > 0
    ? history[history.length - 1]
    : drawCanvas.toDataURL("image/png");

  const headerHeight = document.querySelector("header").offsetHeight;
  const footerHeight = document.querySelector("footer").offsetHeight;
  const availableWidth = window.innerWidth - 24;
  const availableHeight = window.innerHeight - headerHeight - footerHeight - 24;
  const nextSize = Math.max(240, Math.min(availableWidth, availableHeight, 900));
  const ratio = window.devicePixelRatio || 1;

  canvasSize = nextSize;
  canvasWrap.style.width = `${canvasSize}px`;
  canvasWrap.style.height = `${canvasSize}px`;

  baseCanvas.width = Math.round(canvasSize * ratio);
  baseCanvas.height = Math.round(canvasSize * ratio);
  drawCanvas.width = Math.round(canvasSize * ratio);
  drawCanvas.height = Math.round(canvasSize * ratio);

  baseCanvas.style.width = `${canvasSize}px`;
  baseCanvas.style.height = `${canvasSize}px`;
  drawCanvas.style.width = `${canvasSize}px`;
  drawCanvas.style.height = `${canvasSize}px`;

  baseCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawCtx.setTransform(ratio, 0, 0, ratio, 0, 0);

  drawBase();
  restoreSnapshot(previousSnapshot, false);
}

function drawBase() {
  drawLensBase(baseCtx, 0, 0, canvasSize, true);
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

  ctx.fillStyle = "#fff";
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

function drawTick(ctx, x1, y1, x2, y2, size) {
  ctx.strokeStyle = "#8f8f8f";
  ctx.lineWidth = Math.max(2, size * 0.004);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function getPos(event) {
  const rect = drawCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function startDraw(event) {
  if (isSaving || event.button === 2) return;
  event.preventDefault();
  drawCanvas.setPointerCapture?.(event.pointerId);
  const pos = getPos(event);
  drawing = true;
  lastX = pos.x;
  lastY = pos.y;
}

function draw(event) {
  if (!drawing || isSaving) return;
  event.preventDefault();
  const pos = getPos(event);

  drawCtx.lineCap = "round";
  drawCtx.lineJoin = "round";

  if (tool === "eraser") {
    drawCtx.globalCompositeOperation = "destination-out";
    drawCtx.lineWidth = penSize;
  } else {
    drawCtx.globalCompositeOperation = "source-over";
    drawCtx.strokeStyle = penColor;
    drawCtx.lineWidth = penSize;
  }

  drawCtx.beginPath();
  drawCtx.moveTo(lastX, lastY);
  drawCtx.lineTo(pos.x, pos.y);
  drawCtx.stroke();
  lastX = pos.x;
  lastY = pos.y;
}

function endDraw(event) {
  if (!drawing) return;
  drawing = false;
  drawCtx.globalCompositeOperation = "source-over";
  drawCanvas.releasePointerCapture?.(event.pointerId);
  saveHistory();
}

function snapshot() {
  return drawCanvas.toDataURL("image/png");
}

function saveHistory() {
  history.push(snapshot());
  if (history.length > 30) history.shift();
}

function restoreSnapshot(dataUrl, updateHistory = false) {
  drawCtx.clearRect(0, 0, canvasSize, canvasSize);
  if (!dataUrl) {
    if (updateHistory) saveHistory();
    return;
  }

  const img = new Image();
  img.onload = () => {
    drawCtx.clearRect(0, 0, canvasSize, canvasSize);
    drawCtx.drawImage(img, 0, 0, canvasSize, canvasSize);
    if (updateHistory) saveHistory();
  };
  img.onerror = () => console.error("描画履歴の読み込みに失敗しました。");
  img.src = dataUrl;
}

function undo() {
  if (history.length <= 1) return;
  history.pop();
  restoreSnapshot(history[history.length - 1], false);
}

function clearDrawing() {
  if (!confirm("描いた線をすべて消しますか？")) return;
  drawCtx.clearRect(0, 0, canvasSize, canvasSize);
  saveHistory();
}

function setTool(nextTool) {
  tool = nextTool;
  penBtn.classList.toggle("active", tool === "pen");
  eraserBtn.classList.toggle("active", tool === "eraser");
}

function setPenSize(size, activeButton) {
  penSize = size;
  [size05Btn, size1Btn, size2Btn, size4Btn, size8Btn]
    .forEach((button) => button.classList.remove("active"));
  activeButton.classList.add("active");
}

function setPenColor(color) {
  penColor = color;
  surfaceBtn.classList.toggle("active", color === "#111");
  insideBtn.classList.toggle("active", color === "#d32f2f");
  document.querySelectorAll(".penIcon").forEach((icon) => {
    icon.style.color = color;
  });
  setTool("pen");
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    if (!dataUrl) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("描画画像の読み込みに失敗しました。"));
    img.src = dataUrl;
  });
}

async function makeExportImage() {
  const output = document.createElement("canvas");
  const ctx = output.getContext("2d");
  if (!ctx) throw new Error("保存用キャンバスを作成できませんでした。");

  output.width = 1200;
  output.height = 1400;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, output.width, output.height);

  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 52px system-ui";
  ctx.fillText(`${lensName || "Lens"} ${sideLabel()}`, 600, 80);

  ctx.textAlign = "left";
  ctx.font = "28px system-ui";
  ctx.fillText(`Serial: ${serialNo}`, 80, 145);
  ctx.fillText(`Received: ${receivedDate}`, 80, 190);

  const mapSize = 1000;
  const mapX = 100;
  const mapY = 260;
  drawLensBase(ctx, mapX, mapY, mapSize, false);

  const drawingImage = await loadImage(snapshot());
  if (drawingImage) {
    ctx.drawImage(drawingImage, mapX, mapY, mapSize, mapSize);
  }

  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 3;
  ctx.strokeRect(mapX, mapY, mapSize, mapSize);

  ctx.font = "24px system-ui";
  ctx.fillStyle = "#111";
  ctx.fillText("● Surface", 100, 1330);
  ctx.fillStyle = "#d32f2f";
  ctx.fillText("● Internal", 330, 1330);

  return output.toDataURL("image/png");
}

function showSavedMessage() {
  const overlay = document.createElement("div");
  overlay.className = "saveMessage";
  Object.assign(overlay.style, {
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    padding: "20px 30px",
    background: "rgba(0,0,0,0.85)",
    color: "#fff",
    borderRadius: "12px",
    fontSize: "18px",
    textAlign: "center",
    zIndex: "9999"
  });
  overlay.textContent = "保存が完了しました。";

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "AppSheetへ戻る";
  Object.assign(button.style, {
    display: "block",
    margin: "16px auto 0",
    padding: "10px 18px",
    border: "none",
    borderRadius: "10px",
    background: "#0a66ff",
    color: "#fff",
    fontSize: "16px",
    fontWeight: "700"
  });
  button.onclick = returnToAppSheet;
  overlay.appendChild(button);
  document.body.appendChild(overlay);
}

async function exportLensMap() {
  if (isSaving) return;
  if (!lensId) {
    alert("IDがありません。AppSheetから開き直してください。");
    return;
  }

  isSaving = true;
  saveBtn.disabled = true;
  const originalLabel = saveBtn.textContent;
  saveBtn.textContent = "保存中...";

  try {
    const image = await makeExportImage();
    const payload = {
      id: lensId,
      lens: lensName,
      serial: serialNo,
      received: receivedDate,
      side: currentSide,
      image
    };

    const response = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "保存に失敗しました。");
    }

    console.log("保存成功:", result);
    showSavedMessage();
  } catch (error) {
    console.error(error);
    alert(`保存に失敗しました。\n${error.message || error}`);
  } finally {
    isSaving = false;
    saveBtn.disabled = false;
    saveBtn.textContent = originalLabel || "保存";
  }
}

penBtn.onclick = () => setTool("pen");
eraserBtn.onclick = () => setTool("eraser");
undoBtn.onclick = undo;
clearBtn.onclick = clearDrawing;
saveBtn.onclick = exportLensMap;
backBtn.onclick = returnToAppSheet;

size05Btn.onclick = () => setPenSize(0.5, size05Btn);
size1Btn.onclick = () => setPenSize(1, size1Btn);
size2Btn.onclick = () => setPenSize(2, size2Btn);
size4Btn.onclick = () => setPenSize(4, size4Btn);
size8Btn.onclick = () => setPenSize(8, size8Btn);

surfaceBtn.onclick = () => setPenColor("#111");
insideBtn.onclick = () => setPenColor("#d32f2f");

drawCanvas.addEventListener("pointerdown", startDraw);
drawCanvas.addEventListener("pointermove", draw);
drawCanvas.addEventListener("pointerup", endDraw);
drawCanvas.addEventListener("pointercancel", endDraw);

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resizeCanvas, 150);
});

updateHeader();
setPenSize(0.5, size05Btn);
setPenColor("#111");
resizeCanvas();
history = [snapshot()];
