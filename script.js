// ========================================
// Lens Map Editor
// Version 3.0.0
// ========================================

const APP_VERSION = "v3.0.0";
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycby27SYVZL79QHnLXPVa0Sd6NrNwWR9R23iM9yMsxv4XUOlwVKGZlxv10-LSdwFNiNcVkQ/exec";

const baseCanvas = document.getElementById("baseCanvas");
const drawCanvas = document.getElementById("drawCanvas");
const canvasWrap = document.getElementById("canvasWrap");

const baseCtx = baseCanvas.getContext("2d");
const drawCtx = drawCanvas.getContext("2d");

const penBtn = document.getElementById("penBtn");
const eraserBtn = document.getElementById("eraserBtn");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");

const size1Btn = document.getElementById("size1Btn");
const size2Btn = document.getElementById("size2Btn");
const size4Btn = document.getElementById("size4Btn");
const size8Btn = document.getElementById("size8Btn");

const surfaceBtn = document.getElementById("surfaceBtn");
const insideBtn = document.getElementById("insideBtn");
const title = document.getElementById("title");
const sideIndicator = document.getElementById("sideLabel");

let tool = "pen";
let penSize = 1;
let penColor = "#111";

let drawing = false;
let lastX = 0;
let lastY = 0;
let isSaving = false;
let canvasOffsetX = 0;
let canvasOffsetY = 0;
let canvasSize = 0;

// ---------- View controls (finger pan / pinch zoom) ----------
const MIN_VIEW_SCALE = 1;
const MAX_VIEW_SCALE = 4;

let viewScale = 1;
let viewX = 0;
let viewY = 0;

let activePenPointerId = null;
const touchPointers = new Map();
let panPointerId = null;
let panLastX = 0;
let panLastY = 0;

let pinchStartDistance = 0;
let pinchStartScale = 1;
let pinchBaseCenterX = 0;
let pinchBaseCenterY = 0;
let pinchLocalX = 0;
let pinchLocalY = 0;

let history = [];
let hasSavedImage = false;

// ---------- Lens information from AppSheet ----------
const params = new URLSearchParams(window.location.search);

console.log("search =", window.location.search);

const lensId = params.get("id") || "";
const lensName = params.get("lens") || "";

const serialNo = params.get("serial") || "";
const receivedDate = params.get("received") || "";
const requestedSide = (params.get("side") || "front").toLowerCase();
const currentSide = requestedSide === "rear" ? "rear" : "front";
const returnUrl = params.get("returnUrl") || params.get("return") || "";

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

console.log("Lens Map Editor", APP_VERSION);
console.log({
  lensId,
  lensName,
  serialNo,
  receivedDate,
  currentSide,
  returnUrl
});

function updateTitle() {

  title.textContent = lensName;

  document.getElementById("sideLabel").textContent =
      currentSide === "front" ? "FRONT" : "REAR";

}
// ========================================
// 現在の面の保存済み画像をGASから取得して履歴へ登録
// ========================================
async function fetchSavedImage() {
  if (!lensId) {
    console.log("レンズIDがないため、保存済み画像を読み込みません。");
    return;
  }

  try {
    const requestUrl =
      `${GAS_WEB_APP_URL}?id=${encodeURIComponent(lensId)}&t=${Date.now()}`;

    const response = await fetch(requestUrl, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`画像取得APIの応答エラー: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "保存済み画像の取得に失敗しました。");
    }

    const savedImage = currentSide === "front"
      ? result.frontImage || ""
      : result.rearImage || "";

    const drawingDataUrl = await savedMapToDrawingDataUrl(savedImage);

    if (drawingDataUrl) {
      history = [drawingDataUrl];
      hasSavedImage = true;
      loadCurrentDrawing();
    }

    console.log(
      `${currentSide === "front" ? "Front" : "Rear"}画像:`,
      drawingDataUrl ? "読込完了" : "なし"
    );
  } catch (error) {
    console.error("保存済み画像の読込みに失敗しました。", error);
  }
}

// ========================================
// 保存画像（1200×1400）からマップ部分（1000×1000）を取り出す
// ========================================
async function savedMapToDrawingDataUrl(dataUrl) {
  if (!dataUrl) return "";

  const img = await loadImage(dataUrl);
  if (!img) return "";

  const cropCanvas = document.createElement("canvas");
  const cropCtx = cropCanvas.getContext("2d");

  if (!cropCtx) {
    throw new Error("読込み用キャンバスを作成できませんでした。");
  }

  cropCanvas.width = 1000;
  cropCanvas.height = 1000;

  if (img.naturalWidth === 1200 && img.naturalHeight === 1400) {
    cropCtx.drawImage(img, 100, 260, 1000, 1000, 0, 0, 1000, 1000);
  } else {
    cropCtx.drawImage(
      img,
      0,
      0,
      img.naturalWidth,
      img.naturalHeight,
      0,
      0,
      1000,
      1000
    );
  }

  return cropCanvas.toDataURL("image/png");
}

function resizeCanvas() {
const leftBarWidth =
    document.getElementById("infoPanel").offsetWidth;

const rightBarWidth =
    document.getElementById("rightBar").offsetWidth;

const availableWidth =
    window.innerWidth - leftBarWidth - rightBarWidth;

const availableHeight =
    window.innerHeight;

canvasSize = Math.min(
    availableWidth - 12,
    availableHeight - 12
);

  canvasOffsetX = (availableWidth - canvasSize) / 2;
  canvasOffsetY = (availableHeight - canvasSize) / 2;

  const ratio = window.devicePixelRatio || 1;

  baseCanvas.width = drawCanvas.width = Math.round(canvasSize * ratio);
  baseCanvas.height = drawCanvas.height = Math.round(canvasSize * ratio);

  canvasWrap.style.width = `${canvasSize}px`;
  canvasWrap.style.height = `${canvasSize}px`;
  canvasWrap.style.transformOrigin = "center center";
  canvasWrap.style.willChange = "transform";
  canvasWrap.style.touchAction = "none";

  baseCanvas.style.width = "100%";
  baseCanvas.style.height = "100%";
  drawCanvas.style.width = "100%";
  drawCanvas.style.height = "100%";
  drawCanvas.style.touchAction = "none";

  baseCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawCtx.setTransform(ratio, 0, 0, ratio, 0, 0);

drawBase();
loadCurrentDrawing();

updateTitle();

applyViewTransform();
}

function drawBase() {
  const width = baseCanvas.clientWidth;
  const height = baseCanvas.clientHeight;
  const size = Math.min(width, height);
  const x = (width - size) / 2;
  const y = (height - size) / 2;

  drawLensBase(baseCtx, x, y, size, true);
}

function drawLensBase(ctx, x, y, size, clearFirst = false) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.42;
  const fontSize = size * 0.040;
  const labelOffset = size * 0.048;
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyViewTransform() {
  canvasWrap.style.transform =
    `translate3d(${viewX}px, ${viewY}px, 0) scale(${viewScale})`;
}

function getPos(e) {
  const rect = drawCanvas.getBoundingClientRect();

  if (!rect.width || !rect.height) {
    return { x: 0, y: 0 };
  }

  return {
    x: (e.clientX - rect.left) * (drawCanvas.clientWidth / rect.width),
    y: (e.clientY - rect.top) * (drawCanvas.clientHeight / rect.height)
  };
}

function getFirstTwoTouches() {
  return Array.from(touchPointers.values()).slice(0, 2);
}

function getTouchDistance(a, b) {
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

function getTouchCenter(a, b) {
  return {
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2
  };
}

function beginPan(pointer) {
  if (viewScale <= 1) return;

  panPointerId = pointer.pointerId;
  panLastX = pointer.clientX;
  panLastY = pointer.clientY;
}

function beginPinch() {
  const [a, b] = getFirstTwoTouches();
  if (!a || !b) return;

  const center = getTouchCenter(a, b);
  const rect = canvasWrap.getBoundingClientRect();

  pinchStartDistance = Math.max(1, getTouchDistance(a, b));
  pinchStartScale = viewScale;

  // CSS transformの基準となる、移動前のキャンバス中心
  pinchBaseCenterX = rect.left + rect.width / 2 - viewX;
  pinchBaseCenterY = rect.top + rect.height / 2 - viewY;

  // ピンチ開始位置がキャンバス上のどこだったかを保持
  pinchLocalX = (center.x - pinchBaseCenterX - viewX) / viewScale;
  pinchLocalY = (center.y - pinchBaseCenterY - viewY) / viewScale;

  panPointerId = null;
}

function startDraw(e) {
  if (isSaving || e.pointerType !== "pen") return;

  e.preventDefault();

  // Pencilで描き始めたら、手のひら等のタッチ操作を解除
  touchPointers.clear();
  panPointerId = null;
  pinchStartDistance = 0;

  drawing = true;
  activePenPointerId = e.pointerId;
  drawCanvas.setPointerCapture(e.pointerId);

  const pos = getPos(e);
  lastX = pos.x;
  lastY = pos.y;
}

function draw(e) {
  if (
    !drawing ||
    isSaving ||
    e.pointerType !== "pen" ||
    e.pointerId !== activePenPointerId
  ) {
    return;
  }

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
    drawCtx.lineWidth = penSize;
  }

  drawCtx.beginPath();
  drawCtx.moveTo(lastX, lastY);
  drawCtx.lineTo(pos.x, pos.y);
  drawCtx.stroke();

  lastX = pos.x;
  lastY = pos.y;
}

function endDraw(e) {
  if (
    !drawing ||
    e.pointerType !== "pen" ||
    e.pointerId !== activePenPointerId
  ) {
    return;
  }

  drawing = false;
  activePenPointerId = null;

  if (
    drawCanvas.hasPointerCapture &&
    drawCanvas.hasPointerCapture(e.pointerId)
  ) {
    drawCanvas.releasePointerCapture(e.pointerId);
  }

  drawCtx.globalCompositeOperation = "source-over";
  saveHistory();
}

function startTouchGesture(e) {
  if (isSaving || drawing || e.pointerType !== "touch") return;

  e.preventDefault();
  touchPointers.set(e.pointerId, {
    pointerId: e.pointerId,
    clientX: e.clientX,
    clientY: e.clientY
  });

  drawCanvas.setPointerCapture(e.pointerId);

  if (touchPointers.size === 1) {
    beginPan(touchPointers.get(e.pointerId));
  } else if (touchPointers.size >= 2) {
    beginPinch();
  }
}

function moveTouchGesture(e) {
  if (
    isSaving ||
    drawing ||
    e.pointerType !== "touch" ||
    !touchPointers.has(e.pointerId)
  ) {
    return;
  }

  e.preventDefault();

  touchPointers.set(e.pointerId, {
    pointerId: e.pointerId,
    clientX: e.clientX,
    clientY: e.clientY
  });

  if (touchPointers.size >= 2) {
    const [a, b] = getFirstTwoTouches();
    const center = getTouchCenter(a, b);
    const distance = Math.max(1, getTouchDistance(a, b));
    const nextScale = clamp(
      pinchStartScale * (distance / pinchStartDistance),
      MIN_VIEW_SCALE,
      MAX_VIEW_SCALE
    );

    viewScale = nextScale;
    viewX = center.x - pinchBaseCenterX - viewScale * pinchLocalX;
    viewY = center.y - pinchBaseCenterY - viewScale * pinchLocalY;

    if (viewScale <= 1.01) {
      viewScale = 1;
      viewX = 0;
      viewY = 0;
    }

    applyViewTransform();
    return;
  }

  if (
    viewScale > 1 &&
    touchPointers.size === 1 &&
    panPointerId === e.pointerId
  ) {
    viewX += e.clientX - panLastX;
    viewY += e.clientY - panLastY;
    panLastX = e.clientX;
    panLastY = e.clientY;
    applyViewTransform();
  }
}

function endTouchGesture(e) {
  if (e.pointerType !== "touch") return;

  touchPointers.delete(e.pointerId);

  if (
    drawCanvas.hasPointerCapture &&
    drawCanvas.hasPointerCapture(e.pointerId)
  ) {
    drawCanvas.releasePointerCapture(e.pointerId);
  }

  if (touchPointers.size >= 2) {
    beginPinch();
  } else if (touchPointers.size === 1) {
    const remaining = Array.from(touchPointers.values())[0];
    beginPan(remaining);
    pinchStartDistance = 0;
  } else {
    panPointerId = null;
    pinchStartDistance = 0;
  }
}

function handlePointerDown(e) {
  if (e.pointerType === "pen") {
    startDraw(e);
  } else if (e.pointerType === "touch") {
    startTouchGesture(e);
  }
}

function handlePointerMove(e) {
  if (e.pointerType === "pen") {
    draw(e);
  } else if (e.pointerType === "touch") {
    moveTouchGesture(e);
  }
}

function handlePointerEnd(e) {
  if (e.pointerType === "pen") {
    endDraw(e);
  } else if (e.pointerType === "touch") {
    endTouchGesture(e);
  }
}

function saveHistory() {
  history.push(drawCanvas.toDataURL("image/png"));

  if (history.length > 20) {
    history.shift();
  }
}

function restoreFromDataUrl(dataUrl) {
  const img = new Image();

  img.onload = () => {
    drawCtx.clearRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
    drawCtx.drawImage(
      img,
      0,
      0,
      drawCanvas.clientWidth,
      drawCanvas.clientHeight
    );
  };

  img.onerror = () => {
    console.error("描画履歴の読み込みに失敗しました。");
  };

  img.src = dataUrl;
}

function loadCurrentDrawing() {
  if (history.length === 0) {
    drawCtx.clearRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
    return;
  }

  restoreFromDataUrl(history[history.length - 1]);
}

function getLatestImage() {
  return history.length > 0 ? history[history.length - 1] : "";
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

async function makeSingleLensMapImage(sideLabel, drawingDataUrl) {
  const imgCanvas = document.createElement("canvas");
  const imgCtx = imgCanvas.getContext("2d");

  if (!imgCtx) {
    throw new Error("保存用キャンバスを作成できませんでした。");
  }

  imgCanvas.width = 1200;
  imgCanvas.height = 1400;

  imgCtx.fillStyle = "#ffffff";
  imgCtx.fillRect(0, 0, imgCanvas.width, imgCanvas.height);

  imgCtx.fillStyle = "#111";
  imgCtx.textAlign = "center";
  imgCtx.textBaseline = "middle";
  imgCtx.font = "bold 52px system-ui";
  imgCtx.fillText(`${lensName || "Lens"} ${sideLabel}`, imgCanvas.width / 2, 80);

  imgCtx.textAlign = "left";
  imgCtx.font = "28px system-ui";
  imgCtx.fillText(`Serial: ${serialNo}`, 80, 145);
  imgCtx.fillText(`Received: ${receivedDate}`, 80, 190);

  const size = 1000;
  const x = 100;
  const y = 260;

  drawLensBase(imgCtx, x, y, size, false);

  const drawingImage = await loadImage(drawingDataUrl);
  if (drawingImage) {
    imgCtx.drawImage(drawingImage, x, y, size, size);
  }

  imgCtx.strokeStyle = "#dddddd";
  imgCtx.lineWidth = 3;
  imgCtx.strokeRect(x, y, size, size);

  imgCtx.font = "24px system-ui";
  imgCtx.fillStyle = "#111";
  imgCtx.fillText("● Surface", 100, 1330);

  imgCtx.fillStyle = "#d32f2f";
  imgCtx.fillText("● Internal", 330, 1330);

  return imgCanvas.toDataURL("image/png");
}

async function exportLensMap() {
  if (isSaving) return;

  if (!lensId) {
    alert("IDがありません。AppSheetから開き直してください。");
    return;
  }

  isSaving = true;
  const originalLabel = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = "保存中...";

  try {
    const sideLabel = currentSide === "front" ? "Front" : "Rear";
    const image = await makeSingleLensMapImage(sideLabel, getLatestImage());

    const payload = {
      id: lensId,
      lens: lensName,
      serial: serialNo,
      received: receivedDate,
      frontImage: currentSide === "front" ? image : "",
      rearImage: currentSide === "rear" ? image : ""
    };

    const response = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "保存に失敗しました。");
    }

    const msg = document.createElement("div");
    msg.style.position = "fixed";
    msg.style.left = "50%";
    msg.style.top = "50%";
    msg.style.transform = "translate(-50%, -50%)";
    msg.style.padding = "20px 30px";
    msg.style.background = "rgba(0,0,0,0.85)";
    msg.style.color = "#fff";
    msg.style.borderRadius = "12px";
    msg.style.fontSize = "18px";
    msg.style.textAlign = "center";
    msg.style.zIndex = "9999";
    msg.innerHTML = "保存が完了しました。<br><br>画面を閉じてAppSheetに戻ってください。";
    document.body.appendChild(msg);
  } catch (error) {
    console.error(error);
    alert(`保存に失敗しました。\n${error.message || error}`);
  } finally {
    isSaving = false;
    saveBtn.disabled = false;
    saveBtn.textContent = originalLabel || "保存";
  }
}

function setPenSize(size, activeButton) {
  penSize = size;

  size1Btn.classList.remove("active");
  size2Btn.classList.remove("active");
  size4Btn.classList.remove("active");
  size8Btn.classList.remove("active");

  activeButton.classList.add("active");
}

// ---------- Controls ----------
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
  if (history.length === 0) return;

  if (history.length === 1 && hasSavedImage) return;

  if (history.length === 1) {
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

saveBtn.onclick = exportLensMap;

size1Btn.onclick = () => setPenSize(1, size1Btn);
size2Btn.onclick = () => setPenSize(2, size2Btn);
size4Btn.onclick = () => setPenSize(4, size4Btn);
size8Btn.onclick = () => setPenSize(8, size8Btn);

surfaceBtn.onclick = () => {
  penColor = "#111";
  surfaceBtn.classList.add("active");
  insideBtn.classList.remove("active");
  updatePenIcons();
};

insideBtn.onclick = () => {
  penColor = "#d32f2f";
  insideBtn.classList.add("active");
  surfaceBtn.classList.remove("active");
  updatePenIcons();
};

function updatePenIcons() {
  const color = penColor === "#111" ? "#111" : "#d32f2f";

  document.querySelectorAll(".penIcon").forEach((icon) => {
    icon.style.color = color;
  });
}

// ---------- Pointer Events ----------
drawCanvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
drawCanvas.addEventListener("pointermove", handlePointerMove, { passive: false });
drawCanvas.addEventListener("pointerup", handlePointerEnd, { passive: false });
drawCanvas.addEventListener("pointercancel", handlePointerEnd, { passive: false });

window.addEventListener("resize", resizeCanvas);

// ---------- Start ----------
(async () => {
  setPenSize(1, size1Btn);

  penBtn.classList.add("active");
  eraserBtn.classList.remove("active");

  updatePenIcons();
  resizeCanvas();

  await fetchSavedImage();
})();
