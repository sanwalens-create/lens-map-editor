const FRONT_FOLDER_ID = "1EyR1rf8yZVt4Pv2bn2Ye7lMsR6FxdEt3";
const REAR_FOLDER_ID = "180Q23jc_VroUR4PpT5OVpIW9HOkn3XcJ";

// ========================================
// 保存（Front/Rearの片側のみ）
// ========================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    const id = String(data.id || "").trim();
    const lens = data.lens || "";
    const serial = data.serial || "";
    const received = data.received || "";
    const side = normalizeSide(data.side);
    const image = data.image || "";

    if (!id) throw new Error("IDがありません");
    if (!image) throw new Error("画像データがありません");

    const folderId = side === "rear" ? REAR_FOLDER_ID : FRONT_FOLDER_ID;
    const sideLabel = side === "rear" ? "Rear" : "Front";
    const fileName = makeFileName(id, lens, serial, received, sideLabel);
    const saved = saveImage(image, folderId, fileName);

    return jsonResponse({
      success: true,
      id: id,
      side: side,
      fileId: saved.fileId,
      imageUrl: saved.imageUrl
    });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: String(err)
    });
  }
}

// ========================================
// 保存済み画像取得API
// 例：.../exec?id=レコードID&side=front
// v3.0.0では次版の自動読込用として準備済み
// ========================================
function doGet(e) {
  try {
    const id = String((e.parameter && e.parameter.id) || "").trim();
    const side = normalizeSide((e.parameter && e.parameter.side) || "front");

    if (!id) {
      return jsonResponse({
        success: true,
        message: "LensMap API OK",
        version: "3.0.0"
      });
    }

    const folderId = side === "rear" ? REAR_FOLDER_ID : FRONT_FOLDER_ID;
    const file = findLatestImageFile(folderId, id);

    if (!file) {
      return jsonResponse({
        success: true,
        id: id,
        side: side,
        exists: false,
        imageDataUrl: ""
      });
    }

    return jsonResponse({
      success: true,
      id: id,
      side: side,
      exists: true,
      fileName: file.getName(),
      updatedAt: file.getLastUpdated().toISOString(),
      imageDataUrl: fileToDataUrl(file)
    });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: String(err)
    });
  }
}

function normalizeSide(value) {
  return String(value || "").toLowerCase() === "rear" ? "rear" : "front";
}

function saveImage(dataUrl, folderId, fileName) {
  const match = String(dataUrl).match(/^data:image\/png;base64,(.+)$/);
  if (!match) throw new Error("PNG形式の画像データではありません");

  const bytes = Utilities.base64Decode(match[1]);
  const blob = Utilities.newBlob(bytes, "image/png", fileName);
  const folder = DriveApp.getFolderById(folderId);
  const file = folder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    fileId: file.getId(),
    imageUrl: "https://drive.google.com/uc?export=view&id=" + file.getId()
  };
}

function findLatestImageFile(folderId, id) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  const prefix = id + "_";
  let latest = null;
  let latestTime = 0;

  while (files.hasNext()) {
    const file = files.next();
    if (!file.getName().startsWith(prefix)) continue;

    const updatedTime = file.getLastUpdated().getTime();
    if (!latest || updatedTime > latestTime) {
      latest = file;
      latestTime = updatedTime;
    }
  }

  return latest;
}

function fileToDataUrl(file) {
  const blob = file.getBlob();
  const mimeType = blob.getContentType() || "image/png";
  const base64 = Utilities.base64Encode(blob.getBytes());
  return "data:" + mimeType + ";base64," + base64;
}

function makeFileName(id, lens, serial, received, sideLabel) {
  const parts = [id, lens, serial, received, sideLabel]
    .filter(Boolean)
    .map(sanitizeFileName);

  return parts.join("_") + ".png";
}

function sanitizeFileName(text) {
  return String(text)
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_");
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
