const vscode = acquireVsCodeApi();

const assets = [
  { key: "favicon", title: "Favicon", size: "32 x 32", fileName: "favicon.png", config: "expo.web.favicon" },
  { key: "icon", title: "App Icon", size: "1024 x 1024", fileName: "icon.png", config: "expo.icon" },
  { key: "splash-icon", title: "Splash Image", size: "1280 x 720", fileName: "splash-icon.png", config: "expo.splash.image or expo-splash-screen" },
  { key: "adaptive-icon", title: "Adaptive Icon", size: "1080 x 1080", fileName: "adaptive-icon.png", config: "expo.android.adaptiveIcon.foregroundImage" },
];

const state = {
  files: {},
  destinations: Object.fromEntries(assets.map((asset) => [asset.key, { folder: "assets/images", fileName: asset.fileName }])),
};

window.addEventListener("DOMContentLoaded", () => {
  renderAssets();
  wireChrome();
  vscode.postMessage({ type: "ready" });
});

window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "initialize") {
    setVersion(message.appVersion || "1.0.0");
    setSourcePath(message.sourcePath || "");
    state.destinations = { ...state.destinations, ...(message.destinations || {}) };
    updateDestinationInputs();
    updateCurrentPaths(message.currentPaths || {});
    updatePreviews(message.previews || {});
    setStatus("");
  }

  if (message.type === "asset-dir-chosen") {
    const destination = state.destinations[message.key];
    if (destination) {
      destination.folder = message.folder || destination.folder;
      updateDestinationInputs();
    }
  }

  if (message.type === "sourcePathUpdated") {
    setSourcePath(message.sourcePath || "");
  }

  if (message.type === "dropped-files-ready") {
    (message.files || []).forEach((file) => injectDataUrl(file.slot, file.name, file.dataUrl, file.path));
  }

  if (message.type === "error") {
    setStatus(message.message || "Something went wrong.", true);
  }
});

function renderAssets() {
  const grid = document.getElementById("asset-grid");
  grid.innerHTML = assets.map((asset) => `
    <article class="asset" data-key="${asset.key}">
      <div class="asset-head">
        <div>
          <h2>${asset.title}</h2>
          <p class="meta">${asset.size}</p>
        </div>
        <button class="icon-button" type="button" data-pick="${asset.key}" title="Choose image">+</button>
      </div>
      <div class="preview empty" data-drop="${asset.key}">
        <img id="${asset.key}-preview" alt="${asset.title} preview">
      </div>
      <div class="path" id="${asset.key}-path" title="No image selected">No image selected</div>
      <div class="path-grid">
        <div class="field">
          <label for="${asset.key}-folder">Output folder</label>
          <input id="${asset.key}-folder" data-folder="${asset.key}" value="assets/images">
        </div>
        <div class="field">
          <label for="${asset.key}-filename">File name</label>
          <input id="${asset.key}-filename" data-filename="${asset.key}" value="${asset.fileName}">
        </div>
        <button type="button" data-folder-pick="${asset.key}" title="Choose output folder">Browse</button>
      </div>
      <p class="hint" id="${asset.key}-config">${asset.config}</p>
      <input id="${asset.key}-input" type="file" accept="image/*">
    </article>
  `).join("");

  assets.forEach((asset) => {
    document.querySelector(`[data-pick="${asset.key}"]`).addEventListener("click", () => {
      document.getElementById(`${asset.key}-input`).click();
    });

    document.getElementById(`${asset.key}-input`).addEventListener("change", (event) => {
      const file = event.currentTarget.files?.[0];
      if (file) {
        setFile(asset.key, file, file.name);
      }
    });

    document.querySelector(`[data-folder="${asset.key}"]`).addEventListener("input", (event) => {
      state.destinations[asset.key].folder = event.currentTarget.value.trim();
      updateOutputPath(asset.key);
    });

    document.querySelector(`[data-filename="${asset.key}"]`).addEventListener("input", (event) => {
      state.destinations[asset.key].fileName = event.currentTarget.value.trim();
      updateOutputPath(asset.key);
    });

    document.querySelector(`[data-folder-pick="${asset.key}"]`).addEventListener("click", () => {
      vscode.postMessage({ type: "choose-asset-dir", key: asset.key });
    });

    wireDropzone(document.querySelector(`[data-drop="${asset.key}"]`), asset.key);
  });
}

function wireChrome() {
  document.getElementById("refresh").addEventListener("click", () => vscode.postMessage({ type: "refresh" }));
  document.getElementById("save").addEventListener("click", submit);
  document.getElementById("choose-source").addEventListener("click", () => vscode.postMessage({ type: "choose-source-path" }));
  document.getElementById("reveal-source").addEventListener("click", () => vscode.postMessage({ type: "reveal-source-path" }));

  document.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(`${button.dataset.step}-version`);
      const value = Number.parseInt(input.value, 10) || 0;
      input.value = String(Math.max(0, value + Number(button.dataset.delta)));
    });
  });

  document.addEventListener("dragover", (event) => event.preventDefault());
  document.addEventListener("drop", (event) => {
    if (event.target.closest("[data-drop]")) {
      return;
    }
    event.preventDefault();
    handleDrop(event, null);
  });
}

function wireDropzone(zone, key) {
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("dragover");
    handleDrop(event, key);
  });
}

function handleDrop(event, targetSlot) {
  const file = event.dataTransfer.files?.[0];
  if (file) {
    setFile(targetSlot || inferSlot(file.name), file, file.name);
    return;
  }

  const uriList = event.dataTransfer.getData("text/uri-list");
  if (uriList) {
    vscode.postMessage({
      type: "dropped-uris",
      uris: uriList.split("\n").filter(Boolean),
      targetSlot,
    });
  }
}

function setVersion(version) {
  const [major = 0, minor = 0, patch = 0] = String(version).split(".").map((part) => Number.parseInt(part, 10) || 0);
  document.getElementById("major-version").value = String(major);
  document.getElementById("minor-version").value = String(minor);
  document.getElementById("patch-version").value = String(patch);
}

function getVersion() {
  return ["major", "minor", "patch"]
    .map((part) => Math.max(0, Number.parseInt(document.getElementById(`${part}-version`).value, 10) || 0))
    .join(".");
}

function setSourcePath(sourcePath) {
  const element = document.getElementById("source-path");
  element.textContent = sourcePath || "No source folder set";
  element.title = sourcePath || "No source folder set";
}

function updateDestinationInputs() {
  assets.forEach((asset) => {
    const destination = state.destinations[asset.key];
    document.getElementById(`${asset.key}-folder`).value = destination.folder || "assets/images";
    document.getElementById(`${asset.key}-filename`).value = destination.fileName || asset.fileName;
    updateOutputPath(asset.key);
  });
}

function updateOutputPath(key) {
  const destination = state.destinations[key];
  const folder = (destination.folder || "assets/images").replace(/\/+$/g, "");
  const fileName = (destination.fileName || `${key}.png`).replace(/^\/+/g, "");
  const label = document.getElementById(`${key}-config`);
  label.title = `./${folder}/${fileName}`;
}

function updateCurrentPaths(paths) {
  assets.forEach((asset) => {
    const value = paths[asset.key];
    if (value && !state.files[asset.key]) {
      setPath(asset.key, value);
    }
  });
}

function updatePreviews(previews) {
  Object.entries(previews).forEach(([key, source]) => {
    const img = document.getElementById(`${key}-preview`);
    if (!img || !source) {
      return;
    }
    img.src = source;
    img.parentElement.classList.remove("empty");
  });
}

function setPath(key, path) {
  const element = document.getElementById(`${key}-path`);
  element.textContent = path || "No image selected";
  element.title = path || "No image selected";
}

function setFile(key, file, shownPath) {
  state.files[key] = file;
  setPath(key, shownPath);
  const img = document.getElementById(`${key}-preview`);
  img.src = URL.createObjectURL(file);
  img.parentElement.classList.remove("empty");
}

function injectDataUrl(slot, name, dataUrl, shownPath) {
  fetch(dataUrl)
    .then((response) => response.blob())
    .then((blob) => setFile(slot, new File([blob], name, { type: blob.type }), shownPath || name))
    .catch((error) => setStatus(error.message, true));
}

async function submit() {
  setStatus("Updating assets...");
  try {
    const files = {};
    await Promise.all(Object.entries(state.files).map(([key, file]) => readFile(file).then((content) => {
      files[key] = { name: file.name, content };
    })));

    vscode.postMessage({
      type: "update-assets",
      data: {
        appVersion: getVersion(),
        files,
        destinations: state.destinations,
      },
    });
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function setStatus(message, isError = false) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.classList.toggle("show", Boolean(message));
  status.classList.toggle("error", isError);
}

function inferSlot(name) {
  const normalized = name.toLowerCase();
  if (normalized.includes("favicon")) return "favicon";
  if (normalized.includes("adaptive")) return "adaptive-icon";
  if (normalized.includes("splash")) return "splash-icon";
  if (normalized.includes("icon")) return "icon";
  return "icon";
}
