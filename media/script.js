const vscode = acquireVsCodeApi();
const assetKeys = ["favicon", "icon", "splash-icon", "adaptive-icon"];

function updateFullPathLabel(key) {
  const dir = document.getElementById(`${key}-dir`)?.value?.trim() || "";
  const name = document.getElementById(`${key}-name`)?.value?.trim() || "";
  const full =
    dir && name ? `${dir.replace(/\/+$/, "")}/${name.replace(/^\/+/, "")}` : "";
  const el = document.getElementById(`${key}-fullpath`);
  if (el) el.textContent = full || "—";
}

function readAssetDestinations() {
  const out = {};
  assetKeys.forEach((k) => {
    out[k] = {
      dir: document.getElementById(`${k}-dir`)?.value?.trim() || "",
      filename: document.getElementById(`${k}-name`)?.value?.trim() || "",
    };
  });
  return out;
}

window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "initialize") {
    const [major, minor, patch] = String(message.appVersion || "0.0.0")
      .split(".")
      .map(Number);
    setVersionPart("major-version", major);
    setVersionPart("minor-version", minor);
    setVersionPart("patch-version", patch);
    if (message.sourcePath) {
      setSourcePath(message.sourcePath);
    }
    if (message.currentPaths) {
      Object.entries(message.currentPaths).forEach(([k, v]) =>
        setPathText(k, v)
      );
    }

    if (message.destinations) {
      assetKeys.forEach((k) => {
        const cfg = message.destinations[k] || {};
        const d = document.getElementById(`${k}-dir`);
        const n = document.getElementById(`${k}-name`);
        if (d && cfg.dir) {
          d.value = cfg.dir;
        }
        if (n && cfg.filename) {
          n.value = cfg.filename;
        }
        updateFullPathLabel(k);
      });
    }
  }
  if (message.type === "asset-dir-chosen") {
    const { key, dir } = message;
    const input = document.getElementById(`${key}-dir`);
    if (input) {
      input.value = dir || "";
      updateFullPathLabel(key);
    }
  }
  if (message.type === "sourcePathUpdated") {
    setSourcePath(message.sourcePath || "Not set");
    // Ask host to refresh all previews/paths/version
    vscode.postMessage({ type: "refresh" });
  }

  if (message.type === "updated-previews") {
    const previews = message.previews;

    // Update the preview images dynamically
    Object.keys(previews).forEach((key) => {
      const imgElement = document.getElementById(`${key}-preview`);
      if (imgElement) {
        console.log(`Updating ${key}-preview with new src`);
        imgElement.src = `${previews[key]}?${new Date().getTime()}`; // Cache-busting
      } else {
        console.error(`Image element for ${key}-preview not found`);
      }
    });
  }

  // if (message.type === "updated-previews") {
  //   const previews = message.previews || {};
  //   Object.keys(previews).forEach((key) => {
  //     const imgElement = document.getElementById(`${key}-preview`);
  //     if (imgElement && previews[key])
  //       imgElement.src = `${previews[key]}?${Date.now()}`;
  //   });

  //   // If host sends resolved current paths:
  //   if (message.paths)
  //     Object.entries(message.paths).forEach(([k, v]) => setPathText(k, v));
  //   document.getElementById("loading").style.display = "none";
  //   // If you show per-asset paths in the UI, update them here.
  //   // Example (only if you have <div id="{key}-path"> elements):
  //   // Object.entries(message.paths).forEach(([k, v]) => setPathText(k, v));
  // }
  if (message.type === "error") {
    document.getElementById("loading").style.display = "none";
    document.getElementById(
      "error-message"
    ).textContent = `Error: ${message.message}`;
    document.getElementById("error-message").style.display = "block";
  }
  if (message.type === "sourcePathUpdated") {
    setSourcePath(message.sourcePath || "Not set");
  }
  if (message.type === "dropped-files-ready") {
    (message.files || []).forEach((f) =>
      injectDataUrlIntoSlot(f.slot, f.name, f.dataUrl, f.path)
    );
  }
});

function setVersionPart(id, value) {
  const input = document.getElementById(id);
  input.value = Number.isFinite(value) ? value : 0;
}

function updateVersionPart(id, increment) {
  const input = document.getElementById(id);
  let value = parseInt(input.value, 10) || 0;
  value = increment ? value + 1 : Math.max(0, value - 1);
  input.value = value;
}

document
  .getElementById("major-increment")
  .addEventListener("click", () => updateVersionPart("major-version", true));
document
  .getElementById("major-decrement")
  .addEventListener("click", () => updateVersionPart("major-version", false));
document
  .getElementById("minor-increment")
  .addEventListener("click", () => updateVersionPart("minor-version", true));
document
  .getElementById("minor-decrement")
  .addEventListener("click", () => updateVersionPart("minor-version", false));
document
  .getElementById("patch-increment")
  .addEventListener("click", () => updateVersionPart("patch-version", true));
document
  .getElementById("patch-decrement")
  .addEventListener("click", () => updateVersionPart("patch-version", false));

function setPathText(idBase, text) {
  const el = document.getElementById(`${idBase}-path`);
  if (el) el.textContent = text || "No file chosen";
}

function setSourcePath(path) {
  const pill = document.getElementById("source-path-pill");
  pill.textContent = path || "Not set";
  pill.title = path || "Not set";
}

function hookPlusButtons() {
  document.querySelectorAll(".plus[data-for]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-for");
      const input = document.getElementById(target);
      if (input) input.click();
    });
  });
}

function hookFileInputs() {
  const ids = ["favicon", "icon", "splash-icon", "adaptive-icon"];
  ids.forEach((id) => {
    const input = document.getElementById(`${id}-preview`);
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) setPreviewFromBlob(id, file);
    });
  });
}

function setPreviewFromBlob(slot, file) {
  setPathText(slot, file.name);
  const reader = new FileReader();
  reader.onload = () => {
    const img = document.getElementById(`${slot}-preview`);
    if (img) {
      img.src = reader.result;
    }
    const input = document.getElementById(slot);
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    assetKeys.forEach((k) => {
      document
        .getElementById(`${k}-dir`)
        ?.addEventListener("input", () => updateFullPathLabel(k));
      document
        .getElementById(`${k}-name`)
        ?.addEventListener("input", () => updateFullPathLabel(k));
      // initial label
      updateFullPathLabel(k);
    });

    document.querySelectorAll(".choose-dir").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const key = e.currentTarget.getAttribute("data-asset");
        vscode.postMessage({ type: "choose-asset-dir", key });
      });
    });
  };
  reader.readAsDataURL(file);
}

function injectDataUrlIntoSlot(slot, name, dataUrl, shownPath) {
  setPathText(slot, shownPath || name);
  const img = document.getElementById(`${slot}-preview`);
  if (img) img.src = dataUrl;
  fetch(dataUrl)
    .then((r) => r.blob())
    .then((blob) => {
      const file = new File([blob], name, { type: blob.type });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById(slot);
      input.files = dt.files;
    });
}

function inferKeyFromName(name) {
  const n = name.toLowerCase();
  if (n.includes("favicon")) return "favicon";
  if (n.includes("adaptive")) return "adaptive-icon";
  if (n.includes("splash")) return "splash-icon";
  if (n.includes("icon")) return "icon";
  return null;
}

function attachDnD() {
  const zones = document.querySelectorAll(".dropzone");
  zones.forEach((zone) => {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", async (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");

      const targetSlot = zone.getAttribute("data-accept");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        const inferred = targetSlot || inferKeyFromName(file.name) || "icon";
        setPreviewFromBlob(inferred, file);
        return;
      }
      const uriList = e.dataTransfer.getData("text/uri-list");
      if (uriList) {
        const uris = uriList.split("\n").filter(Boolean);
        vscode.postMessage({ type: "dropped-uris", uris, targetSlot });
      }
    });
  });

  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => {
    if (e.target.closest && e.target.closest(".dropzone")) return;
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const inferred = inferKeyFromName(file.name) || "icon";
      setPreviewFromBlob(inferred, file);
    } else {
      const uriList = e.dataTransfer.getData("text/uri-list");
      if (uriList)
        vscode.postMessage({
          type: "dropped-uris",
          uris: uriList.split("\n").filter(Boolean),
          targetSlot: null,
        });
    }
  });
}

function wireSourceBar() {
  document
    .getElementById("choose-source")
    .addEventListener("click", () =>
      vscode.postMessage({ type: "choose-source-path" })
    );
  document
    .getElementById("reveal-source")
    .addEventListener("click", () =>
      vscode.postMessage({ type: "reveal-source-path" })
    );

  document.getElementById("refresh")?.addEventListener("click", () => {
    vscode.postMessage({ type: "refresh" });
  });
}

async function serializeFiles() {
  const files = {};
  const keys = ["favicon", "icon", "splash-icon", "adaptive-icon"];
  await Promise.all(
    keys.map(
      (key) =>
        new Promise((resolve, reject) => {
          const input = document.getElementById(key);
          const f = input.files?.[0];
          if (!f) {
            return resolve();
          }
          const reader = new FileReader();
          reader.onload = () => {
            files[key] = {
              name: f.name,
              content: String(reader.result).split(",")[1],
            };

            assetKeys.forEach((k) => {
              document
                .getElementById(`${k}-dir`)
                ?.addEventListener("input", () => updateFullPathLabel(k));
              document
                .getElementById(`${k}-name`)
                ?.addEventListener("input", () => updateFullPathLabel(k));
              // initial label
              updateFullPathLabel(k);
            });

            document.querySelectorAll(".choose-dir").forEach((btn) => {
              btn.addEventListener("click", (e) => {
                const key = e.currentTarget.getAttribute("data-asset");
                vscode.postMessage({ type: "choose-asset-dir", key });
              });
            });

            resolve();
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(f);
        })
    )
  );
  return files;
}

async function validateAndSubmit(event) {
  event.preventDefault();
  const appVersion = [
    document.getElementById("major-version").value || 0,
    document.getElementById("minor-version").value || 0,
    document.getElementById("patch-version").value || 0,
  ].join(".");

  document.getElementById("loading").style.display = "block";
  document.getElementById("error-message").style.display = "none";

  try {
    const serializedFiles = await serializeFiles();
    const destinations = readAssetDestinations();
    vscode.postMessage({
      type: "update-assets",
      data: { files: serializedFiles, appVersion, destinations },
    });
  } catch (error) {
    document.getElementById("loading").style.display = "none";
    document.getElementById(
      "error-message"
    ).textContent = `Error: ${error.message}`;
    document.getElementById("error-message").style.display = "block";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  hookPlusButtons();
  hookFileInputs();
  wireSourceBar();
  attachDnD();
  document
    .getElementById("assetForm")
    .addEventListener("submit", validateAndSubmit);
  vscode.postMessage({ type: "ready" });
});

function setSourcePath(path) {
  const el = document.getElementById("source-path");
  if (el) el.textContent = path || "Not set";
}
