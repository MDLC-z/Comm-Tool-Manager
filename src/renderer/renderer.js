// =============================================
// GLOBAL APPLICATION STATE
// =============================================

//const { app } = require("electron");

// =============================================
let appState = {
  currentUser: "User",
  theme: "light",
  primaryColor: "#3b82f6",
  comms: [],
  currentEditingComm: null,
  currentImages: [],
  currentImageIndex: 0,
  currentReferences: [],
  backgroundImage: null,
  backgroundAllPages: false,
  language: "en",
  zoomLevel: "100",
  sortBy: "newest",
  pinnedComms: [],
};

// =============================================
// TOAST SYSTEM
// =============================================
function showToast(title, message, type = "info", duration = 5000) {
  const toastContainer = document.getElementById("toast-container");
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icons = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };

  toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

  toastContainer.appendChild(toast);

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add("hiding");
        setTimeout(() => {
          if (toast.parentElement) {
            toast.remove();
          }
        }, 300);
      }
    }, duration);
  }

  return toast;
}

// Toast helpers
function showSuccessToast(message, title = "Success") {
  return showToast(title, message, "success");
}

function showErrorToast(message, title = "Error") {
  return showToast(title, message, "error");
}

function showWarningToast(message, title = "Warning") {
  return showToast(title, message, "warning");
}

function showInfoToast(message, title = "Info") {
  return showToast(title, message, "info");
}

// =============================================
// SPA VIEW SYSTEM
// =============================================
async function showView(viewName) {
  console.log("Showing view:", viewName);

  // Si estamos saliendo de la configuración, guardar automáticamente
  const currentView = document.querySelector(".view.active");
  if (
    currentView &&
    currentView.id === "view-config" &&
    viewName !== "config"
  ) {
    await autoSaveConfig();
  }

  document.querySelectorAll(".view").forEach((view) => {
    view.classList.remove("active");
  });

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.add("active");
  }

  // Actualizar clase del body para la vista actual
  document.body.classList.remove("view-welcome", "view-comms", "view-config");
  document.body.classList.add(`view-${viewName}`);

  loadViewContent(viewName);

  // Si tenemos imagen en cache y está configurado para todas las páginas, aplicarla
  if (
    appState.backgroundAllPages &&
    appState.backgroundImage &&
    imageCache.has(appState.backgroundImage)
  ) {
    applyBackgroundImage(imageCache.get(appState.backgroundImage), true);
  }
}

function loadViewContent(viewName) {
  switch (viewName) {
    case "welcome":
      loadWelcomePage();
      break;
    case "comms":
      loadCommsPage();
      break;
    case "config":
      loadConfigPage();
      break;
  }
}

// =============================================
// PAGE LOAD INITIALIZATION
// =============================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM Content Loaded - Renderer starting...");
  console.log("electronAPI available:", !!window.electronAPI);

  // Test connection
  if (window.electronAPI && window.electronAPI.testConnection) {
    try {
      const connected = await window.electronAPI.testConnection();
      console.log("IPC connection test:", connected);
    } catch (error) {
      console.error("IPC connection failed:", error);
    }
  }

  if (window.i18n && window.i18n.init) {
    console.log("Initializing i18n...");
    await window.i18n.init();
  }

  await initializeApp();
  setupEventListeners();
  showView("welcome");
});

async function initializeApp() {
  console.log("Initializing application...");

  try {
    if (!window.electronAPI) {
      throw new Error("electronAPI is not available");
    }

    console.log("Loading configuration...");
    const config = await window.electronAPI.loadConfig();
    console.log("Configuration loaded:", config);

    // Actualizar appState (PERO NO EL IDIOMA)
    appState.currentUser = config.username || "User";
    appState.theme = config.theme || "light";
    appState.primaryColor = config.primaryColor || "#3b82f6";
    appState.backgroundImage = config.backgroundImage || null;
    appState.backgroundAllPages = config.backgroundAllPages || false;
    // NO actualizar appState.language aquí - i18n maneja esto por separado
    appState.zoomLevel = config.zoomLevel || "100";

    console.log("Loading comms...");
    appState.comms = await window.electronAPI.loadComms();
    console.log("Comms loaded:", appState.comms.length);

    applyConfigToUI();

    await loadBackgroundSettings();

    console.log("Application initialized successfully");
  } catch (error) {
    console.error("Error initializing application:", error);
    applyConfigToUI();
    applyDefaultBackground();
    // Asegurar zoom por defecto incluso en caso de error
    changeZoom("100");
  }
}

function applyConfigToUI() {
  console.log("Applying config to UI");
  document.body.setAttribute("data-theme", appState.theme);
  document.documentElement.style.setProperty(
    "--primary-color",
    appState.primaryColor
  );

  const usernameDisplay = document.getElementById("username-display");
  if (usernameDisplay) {
    usernameDisplay.textContent = appState.currentUser;
  }
}

// =============================================
// WELCOME PAGE
// =============================================
function loadWelcomePage() {
  const usernameDisplay = document.getElementById("username-display");
  if (usernameDisplay) {
    usernameDisplay.textContent = appState.currentUser;
  }
}

// =============================================
// COMMS PAGE
// =============================================
function loadCommsPage() {
  renderCommsGrid();
  setupCommsFilters();
}

function renderCommsGrid() {
  const commsGrid = document.getElementById("comms-grid");
  if (!commsGrid) return;

  const sortedComms = sortComms(appState.comms, appState.sortBy);

  if (sortedComms.length === 0) {
    const noCommsText = window.t ? window.t("comms.no_comms") : "No comms yet";
    const noCommsDesc = window.t
      ? window.t("comms.no_comms_desc")
      : 'Create your first comm by clicking the "+" button';

    commsGrid.innerHTML = `
            <div class="empty-state">
                <h3>${noCommsText}</h3>
                <p>${noCommsDesc}</p>
            </div>
        `;
    return;
  }

  commsGrid.innerHTML = sortedComms
    .map((comm) => {
      const isFree = comm.price === 0;
      const priceClass = isFree ? "free-comm" : "";
      const formattedPrice = formatPrice(comm.price, comm.currency);
      const pinnedClass = comm.pinned ? "pinned-comm" : "";
      const forText = window.t ? window.t("comms.for") : "for";

      return `
            <div class="comm-card ${pinnedClass}" onclick="openCommEditor('${
        comm.id
      }')">
                <div class="comm-header">
                    <div class="comm-title">
                        ${comm.pinned ? "📌 " : ""}"${comm.title}"
                    </div>
                    <div class="comm-actions">
                        <button class="pin-btn" onclick="togglePinComm('${
                          comm.id
                        }', event)">
                            ${comm.pinned ? "📌" : "📍"}
                        </button>
                        <div class="comm-price ${priceClass}">${formattedPrice}</div>
                    </div>
                </div>
                <div class="comm-commissioner">${forText}: "${
        comm.commissioner
      }"</div>
                <div class="comm-meta">
                    <span class="status-badge ${comm.status}">${getStatusText(
        comm.status
      )}</span>
                    <span class="priority-badge ${
                      comm.priority
                    }">${getPriorityText(comm.priority)}</span>
                    <span class="comm-date">${formatDate(comm.deadline)}</span>
                </div>
            </div>
        `;
    })
    .join("");
}

function formatPrice(price, currency) {
  if (price === 0 || price === "0") {
    return window.t ? window.t("comms.request") : "Request";
  }
  return `${price} ${currency}`;
}

function getStatusText(status) {
  const statusTranslationMap = {
    pending: "pending",
    progress: "progress",
    completed: "completed",
  };

  const translationKey = statusTranslationMap[status] || status;

  if (window.t) {
    return window.t(`filters.${translationKey}`) || status;
  }

  const statusMap = {
    pending: "Pending",
    progress: "In Progress",
    completed: "Completed",
  };
  return statusMap[status] || status;
}

function getPriorityText(priority) {
  if (window.t) {
    return window.t(`filters.${priority}`) || priority;
  }

  const priorityMap = {
    high: "High",
    medium: "Medium",
    low: "Low",
  };
  return priorityMap[priority] || priority;
}

function formatDate(dateString) {
  if (!dateString) return "DD/MM/YY";
  return new Date(dateString).toLocaleDateString();
}

function setupCommsFilters() {
  const searchInput = document.getElementById("search-input");
  const statusFilter = document.getElementById("status-filter");
  const priorityFilter = document.getElementById("priority-filter");
  const typeFilter = document.getElementById("type-filter");

  if (searchInput) searchInput.addEventListener("input", filterComms);
  if (statusFilter) statusFilter.addEventListener("change", filterComms);
  if (priorityFilter) priorityFilter.addEventListener("change", filterComms);
  if (typeFilter) typeFilter.addEventListener("change", filterComms);
}

function filterComms() {
  const searchInput = document.getElementById("search-input");
  const statusFilter = document.getElementById("status-filter");
  const priorityFilter = document.getElementById("priority-filter");
  const typeFilter = document.getElementById("type-filter");

  const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
  const statusValue = statusFilter ? statusFilter.value : "";
  const priorityValue = priorityFilter ? priorityFilter.value : "";
  const typeValue = typeFilter ? typeFilter.value : "";

  let filteredComms = appState.comms.filter((comm) => {
    const matchesSearch =
      !searchTerm ||
      comm.title.toLowerCase().includes(searchTerm) ||
      comm.commissioner.toLowerCase().includes(searchTerm) ||
      comm.description?.toLowerCase().includes(searchTerm);

    const matchesStatus = !statusValue || comm.status === statusValue;
    const matchesPriority = !priorityValue || comm.priority === priorityValue;
    const matchesType = !typeValue || comm.type === typeValue;

    return matchesSearch && matchesStatus && matchesPriority && matchesType;
  });

  renderFilteredComms(filteredComms);
}

function renderFilteredComms(comms) {
  const commsGrid = document.getElementById("comms-grid");
  if (!commsGrid) return;

  const sortedComms = sortComms(comms, appState.sortBy);

  if (sortedComms.length === 0) {
    const noResultsText = window.t
      ? window.t("comms.no_results")
      : "No comms found";
    const noResultsDesc = window.t
      ? window.t("comms.no_results_desc")
      : "Try different search filters";

    commsGrid.innerHTML = `
            <div class="empty-state">
                <h3>${noResultsText}</h3>
                <p>${noResultsDesc}</p>
            </div>
        `;
    return;
  }

  commsGrid.innerHTML = sortedComms
    .map((comm) => {
      const isFree = comm.price === 0;
      const priceClass = isFree ? "free-comm" : "";
      const formattedPrice = formatPrice(comm.price, comm.currency);
      const pinnedClass = comm.pinned ? "pinned-comm" : "";
      const forText = window.t ? window.t("comms.for") : "for";

      return `
            <div class="comm-card ${pinnedClass}" onclick="openCommEditor('${
        comm.id
      }')">
                <div class="comm-header">
                    <div class="comm-title">
                        ${comm.pinned ? "📌 " : ""}"${comm.title}"
                    </div>
                    <div class="comm-actions">
                        <button class="pin-btn" onclick="togglePinComm('${
                          comm.id
                        }', event)">
                            ${comm.pinned ? "📌" : "📍"}
                        </button>
                        <div class="comm-price ${priceClass}">${formattedPrice}</div>
                    </div>
                </div>
                <div class="comm-commissioner">${forText}: "${
        comm.commissioner
      }"</div>
                <div class="comm-meta">
                    <span class="status-badge ${comm.status}">${getStatusText(
        comm.status
      )}</span>
                    <span class="priority-badge ${
                      comm.priority
                    }">${getPriorityText(comm.priority)}</span>
                    <span class="comm-date">${formatDate(comm.deadline)}</span>
                </div>
            </div>
        `;
    })
    .join("");
}

// =============================================
// PIN/UNPIN COMMS
// =============================================
async function togglePinComm(commId, event) {
  event.stopPropagation(); // Prevenir que se abra el editor

  const commIndex = appState.comms.findIndex((c) => c.id === commId);
  if (commIndex === -1) return;

  // Toggle pinned status
  appState.comms[commIndex].pinned = !appState.comms[commIndex].pinned;
  appState.comms[commIndex].updatedAt = new Date().toISOString();

  try {
    await window.electronAPI.saveComms(appState.comms);
    renderCommsGrid();
  } catch (error) {
    console.error("Error toggling pin:", error);
    showErrorToast(error.message, "Pin Error");
  }
}

// =============================================
// CONFIGURATION PAGE
// =============================================
function loadConfigPage() {
  console.log("Loading config page");

  const userLabelInput = document.getElementById("user-label");
  const themeSelect = document.getElementById("theme-select");
  const colorInput = document.getElementById("primary-color");
  const colorValue = document.getElementById("color-value");
  const languageSelect = document.getElementById("language-select");
  const zoomSelect = document.getElementById("zoom-level");

  if (userLabelInput) {
    userLabelInput.value = appState.currentUser || "User";
  }
  if (themeSelect) {
    themeSelect.value = appState.theme || "light";
  }
  if (colorInput) {
    colorInput.value = appState.primaryColor || "#3b82f6";
  }
  if (colorValue) {
    colorValue.textContent = appState.primaryColor || "#3b82f6";
  }
  if (languageSelect) {
    // USAR i18n COMO FUENTE DE VERDAD PARA EL IDIOMA
    const currentLang = window.i18n ? window.i18n.getCurrentLanguage() : "en";
    languageSelect.value = currentLang;
    console.log("Language select set to:", currentLang);
  }
  if (zoomSelect) {
    zoomSelect.value = appState.zoomLevel || "100";
  }

  const allPagesCheckbox = document.getElementById("background-all-pages");
  if (allPagesCheckbox) {
    allPagesCheckbox.checked = appState.backgroundAllPages || false;
    allPagesCheckbox.onchange = toggleBackgroundForAllPages;
  }

  updateBackgroundPreview();
  setupConfigListeners();
}

function setupConfigListeners() {
  const colorInput = document.getElementById("primary-color");
  if (colorInput) {
    colorInput.addEventListener("input", function () {
      const colorValue = document.getElementById("color-value");
      if (colorValue) {
        colorValue.textContent = this.value;
      }
      document.documentElement.style.setProperty("--primary-color", this.value);
    });
  }

  const themeSelect = document.getElementById("theme-select");
  if (themeSelect) {
    themeSelect.addEventListener("change", function () {
      document.body.setAttribute("data-theme", this.value);
    });
  }

  const userLabelInput = document.getElementById("user-label");
  if (userLabelInput) {
    userLabelInput.addEventListener("input", function () {
      const usernameDisplay = document.getElementById("username-display");
      if (usernameDisplay) {
        usernameDisplay.textContent = this.value || "User";
      }
    });
  }

  const languageSelect = document.getElementById("language-select");
  if (languageSelect) {
    languageSelect.addEventListener("change", function () {
      // Cambiar idioma inmediatamente usando i18n
      changeLanguage(this.value);
    });
  }
}

// =============================================
// CONFIGURATION - AUTOSAVE (MUTED)
// =============================================
async function autoSaveConfig() {
  console.log("Auto-saving configuration silently!...");

  try {
    // OBTENER EL IDIOMA ACTUAL DE i18n
    const currentLanguage = window.i18n
      ? window.i18n.getCurrentLanguage()
      : "en";

    const newConfig = {
      username: document.getElementById("user-label").value.trim() || "User",
      theme: document.getElementById("theme-select").value,
      primaryColor: document.getElementById("primary-color").value,
      backgroundImage: appState.backgroundImage,
      backgroundAllPages: appState.backgroundAllPages,
      language: currentLanguage,
    };

    await window.electronAPI.saveConfig(newConfig);

    // Actualizar appState
    appState.currentUser = newConfig.username;
    appState.theme = newConfig.theme;
    appState.primaryColor = newConfig.primaryColor;
    appState.language = currentLanguage;

    applyConfigToUI();

    console.log(
      "Configuration auto-saved successfully. Language:",
      currentLanguage
    );
  } catch (error) {
    console.error("Error during auto-saving:", error);
  }
}

// =============================================
// CONFIGURATION - SAVE
// =============================================
async function saveConfig() {
  const saveBtn = document.querySelector(".save-config-btn");
  const saveStatus = document.getElementById("save-status");

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = window.t ? window.t("alerts.saving") : "Saving...";
    }
    if (saveStatus) {
      saveStatus.textContent = window.t
        ? window.t("alerts.saving")
        : "Saving changes...";
      saveStatus.className = "save-status saving show";
    }

    // OBTENER EL IDIOMA ACTUAL DE i18n
    const currentLanguage = window.i18n
      ? window.i18n.getCurrentLanguage()
      : "en";

    const newConfig = {
      username: document.getElementById("user-label").value.trim() || "User",
      theme: document.getElementById("theme-select").value,
      primaryColor: document.getElementById("primary-color").value,
      backgroundImage: appState.backgroundImage,
      backgroundAllPages: appState.backgroundAllPages,
      language: currentLanguage,
    };

    await window.electronAPI.saveConfig(newConfig);

    appState.currentUser = newConfig.username;
    appState.theme = newConfig.theme;
    appState.primaryColor = newConfig.primaryColor;
    appState.language = currentLanguage;

    applyConfigToUI();

    if (saveStatus) {
      saveStatus.textContent = window.t
        ? window.t("alerts.saved")
        : "Settings saved";
      saveStatus.className = "save-status show";
    }

    setTimeout(() => {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = window.t
          ? window.t("settings.save_changes")
          : "Save Changes";
      }
      if (saveStatus) {
        saveStatus.className = "save-status";
      }
    }, 2000);
  } catch (error) {
    console.error("Error saving configuration:", error);
    if (saveStatus) {
      saveStatus.textContent =
        (window.t ? window.t("alerts.error") : "Error") + ": " + error.message;
      saveStatus.className = "save-status error show";
    }

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = window.t
        ? window.t("settings.save_changes")
        : "Save Changes";
    }

    setTimeout(() => {
      if (saveStatus) {
        saveStatus.className = "save-status";
      }
    }, 3000);
  }
}

// =============================================
// CACHE FOR BACKGROUND IMAGES
// ============================================
let imageCache = new Map();

// =============================================
// CUSTOM BACKGROUND SYSTEM
// =============================================
async function loadBackgroundSettings() {
  try {
    if (appState.backgroundImage) {
      // Verificar si ya tenemos la imagen en cache
      if (imageCache.has(appState.backgroundImage)) {
        console.log("Background image loaded from cache");
        applyBackgroundImage(
          imageCache.get(appState.backgroundImage),
          appState.backgroundAllPages
        );
      } else {
        console.log("Loading background image from file system");
        const imageData = await window.electronAPI.loadBackgroundImage(
          appState.backgroundImage
        );
        // Guardar en cache para futuros usos
        imageCache.set(appState.backgroundImage, imageData);
        applyBackgroundImage(imageData, appState.backgroundAllPages);
      }
    } else {
      applyDefaultBackground();
    }
  } catch (error) {
    console.error("Error loading background settings:", error);
    applyDefaultBackground();
  }
}

function applyBackgroundImage(imageData, allPages = false) {
  const appBackground = document.getElementById("app-background");

  if (!appBackground) return;

  // Remover clases anteriores
  document.body.classList.remove(
    "background-all-pages",
    "background-welcome-only",
    "has-background-image"
  );

  if (imageData) {
    // Aplicar la imagen - importante: usar !important en CSS
    appBackground.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.2)), url('${imageData}')`;
    document.body.classList.add("has-background-image");

    if (allPages) {
      document.body.classList.add("background-all-pages");
    } else {
      document.body.classList.add("background-welcome-only");
    }
  } else {
    // Sin imagen - usar degradado
    appBackground.style.backgroundImage = "";
    appBackground.style.background =
      "linear-gradient(135deg, var(--primary-color) -500%, var(--bg-color) 100%)";
  }

  // Forzar reflow para asegurar que el fondo se renderice correctamente
  appBackground.offsetHeight;
}

function applyDefaultBackground() {
  const appBackground = document.getElementById("app-background");
  if (appBackground) {
    appBackground.style.backgroundImage = "";
    appBackground.style.background =
      "linear-gradient(135deg, var(--primary-color) -500%, var(--bg-color) 100%)";
    document.body.classList.remove(
      "background-all-pages",
      "background-welcome-only",
      "has-background-image"
    );
  }
}

async function changeBackgroundImage() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tamaño de archivo (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showErrorToast(
        window.t
          ? window.t("alerts.image_too_large", { name: file.name })
          : `The image ${file.name} is too large (max 10MB)`,
        "File Too Large"
      );
      return;
    }

    try {
      const saveStatus = document.getElementById("save-status");
      if (saveStatus) {
        saveStatus.textContent = window.t
          ? window.t("alerts.saving")
          : "Processing image...";
        saveStatus.className = "save-status saving show";
      }

      // Convertir archivo a base64
      const base64 = await fileToBase64(file);
      const fileExtension = file.name.split(".").pop();
      const filename = `background_${Date.now()}.${fileExtension}`;

      // Guardar imagen en el sistema de archivos
      await window.electronAPI.saveBackgroundImage(base64, filename);

      // Limpiar cache anterior si existe
      if (appState.backgroundImage) {
        imageCache.delete(appState.backgroundImage);

        // Intentar eliminar la imagen anterior del sistema de archivos
        try {
          await window.electronAPI.deleteBackgroundImage(
            appState.backgroundImage
          );
        } catch (error) {
          console.warn("Could not delete previous image:", error);
        }
      }

      // Actualizar estado de la aplicación
      appState.backgroundImage = filename;

      // Guardar configuración
      await window.electronAPI.saveConfig({
        username: appState.currentUser,
        theme: appState.theme,
        primaryColor: appState.primaryColor,
        backgroundImage: appState.backgroundImage,
        backgroundAllPages: appState.backgroundAllPages,
        language: appState.language,
      });

      // Guardar nueva imagen en cache
      imageCache.set(filename, base64);

      // Aplicar el nuevo fondo
      applyBackgroundImage(base64, appState.backgroundAllPages);

      // Actualizar preview en configuración
      updateBackgroundPreview();

      // Mostrar mensaje de éxito
      if (saveStatus) {
        saveStatus.textContent = window.t
          ? window.t("alerts.background_changed")
          : "Background changed successfully";
        saveStatus.className = "save-status show";
        setTimeout(() => {
          saveStatus.className = "save-status";
        }, 3000);
      } else {
        showSuccessToast(
          window.t
            ? window.t("alerts.background_changed")
            : "Background changed successfully"
        );
      }
    } catch (error) {
      console.error("Error changing background:", error);
      const saveStatus = document.getElementById("save-status");
      if (saveStatus) {
        saveStatus.textContent = window.t
          ? window.t("alerts.background_error")
          : "Error changing background";
        saveStatus.className = "save-status error show";
        setTimeout(() => {
          saveStatus.className = "save-status";
        }, 3000);
      } else {
        showErrorToast(
          (window.t
            ? window.t("alerts.background_error")
            : "Error changing background") +
            ": " +
            error.message,
          "Background Error"
        );
      }
    }
  };

  input.click();
}

async function removeBackgroundImage() {
  if (!appState.backgroundImage) return;

  const confirmed = await showDeleteConfirm(
    window.t
      ? window.t("alerts.confirm_delete_image")
      : "Are you sure you want to delete this image?",
    "Delete Background Image"
  );

  if (confirmed) {
    try {
      // Eliminar del sistema de archivos
      await window.electronAPI.deleteBackgroundImage(appState.backgroundImage);

      // Limpiar del cache
      imageCache.delete(appState.backgroundImage);

      // Actualizar estado
      appState.backgroundImage = null;

      // Guardar configuración
      await window.electronAPI.saveConfig({
        username: appState.currentUser,
        theme: appState.theme,
        primaryColor: appState.primaryColor,
        backgroundImage: null,
        backgroundAllPages: appState.backgroundAllPages,
        language: appState.language,
      });

      // Aplicar fondo por defecto
      applyDefaultBackground();

      // Actualizar preview
      updateBackgroundPreview();

      showSuccessToast(
        window.t
          ? window.t("alerts.background_removed")
          : "Custom background removed"
      );
    } catch (error) {
      console.error("Error removing background:", error);
      showErrorToast(error.message, "Background Error");
    }
  }
}

function toggleBackgroundForAllPages() {
  const allPagesCheckbox = document.getElementById("background-all-pages");
  if (!allPagesCheckbox) return;

  appState.backgroundAllPages = allPagesCheckbox.checked;

  window.electronAPI
    .saveConfig({
      username: appState.currentUser,
      theme: appState.theme,
      primaryColor: appState.primaryColor,
      backgroundImage: appState.backgroundImage,
      backgroundAllPages: appState.backgroundAllPages,
      language: appState.language,
    })
    .then(() => {
      if (appState.backgroundImage) {
        // Usar cache si está disponible
        if (imageCache.has(appState.backgroundImage)) {
          applyBackgroundImage(
            imageCache.get(appState.backgroundImage),
            appState.backgroundAllPages
          );
        } else {
          // Fallback: cargar desde archivo
          window.electronAPI
            .loadBackgroundImage(appState.backgroundImage)
            .then((imageData) => {
              imageCache.set(appState.backgroundImage, imageData);
              applyBackgroundImage(imageData, appState.backgroundAllPages);
            })
            .catch((error) => {
              console.error("Error loading background image:", error);
              applyDefaultBackground();
            });
        }
      } else {
        applyDefaultBackground();
      }
    })
    .catch((error) => {
      console.error("Error saving background settings:", error);
      allPagesCheckbox.checked = !allPagesCheckbox.checked;
      appState.backgroundAllPages = allPagesCheckbox.checked;
      showErrorToast(error.message, "Background Error");
    });
}

function updateBackgroundPreview() {
  const preview = document.getElementById("background-preview");
  const placeholder = document.getElementById("background-placeholder");
  const removeBtn = document.getElementById("remove-background-btn");

  if (!preview || !placeholder || !removeBtn) return;

  if (appState.backgroundImage) {
    window.electronAPI
      .loadBackgroundImage(appState.backgroundImage)
      .then((imageData) => {
        preview.style.backgroundImage = `url('${imageData}')`;
        preview.classList.add("has-image");
        placeholder.style.display = "none";
        removeBtn.style.display = "flex";
      })
      .catch((error) => {
        console.error("Error loading background preview:", error);
        preview.style.backgroundImage = "none";
        preview.classList.remove("has-image");
        placeholder.style.display = "flex";
        removeBtn.style.display = "none";
      });
  } else {
    preview.style.backgroundImage = "none";
    preview.classList.remove("has-image");
    placeholder.style.display = "flex";
    removeBtn.style.display = "none";
  }
}

// =============================================
// SORTING SYSTEM
// =============================================
function sortComms(comms, sortBy) {
  // Separar pinned comms
  const pinnedComms = comms.filter((comm) => comm.pinned);
  const unpinnedComms = comms.filter((comm) => !comm.pinned);

  // Ordenar unpinned comms según el criterio
  let sortedUnpinned = [...unpinnedComms];

  switch (sortBy) {
    case "newest":
      sortedUnpinned.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      break;
    case "oldest":
      sortedUnpinned.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
      break;
    case "deadline_asc": // Más cercano primero
      sortedUnpinned.sort((a, b) => {
        const dateA = a.deadline
          ? new Date(a.deadline)
          : new Date("9999-12-31");
        const dateB = b.deadline
          ? new Date(b.deadline)
          : new Date("9999-12-31");
        return dateA - dateB;
      });
      break;
    case "deadline_desc": // Más lejano primero
      sortedUnpinned.sort((a, b) => {
        const dateA = a.deadline
          ? new Date(a.deadline)
          : new Date("9999-12-31");
        const dateB = b.deadline
          ? new Date(b.deadline)
          : new Date("9999-12-31");
        return dateB - dateA;
      });
      break;
    case "price_asc": // Más barato primero
      sortedUnpinned.sort((a, b) => a.price - b.price);
      break;
    case "price_desc": // Más caro primero
      sortedUnpinned.sort((a, b) => b.price - a.price);
      break;
    case "title_asc": // A-Z
      sortedUnpinned.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "title_desc": // Z-A
      sortedUnpinned.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case "priority": // Por prioridad (High > Medium > Low)
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      sortedUnpinned.sort(
        (a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]
      );
      break;
    default:
      sortedUnpinned.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
  }

  // Pinned comms siempre van primero, luego las ordenadas
  return [...pinnedComms, ...sortedUnpinned];
}

function changeSort(sortBy) {
  appState.sortBy = sortBy;
  renderCommsGrid();
  updateSortButton();
}

function updateSortButton() {
  const sortBtn = document.getElementById("sort-btn");
  if (!sortBtn) return;

  const sortLabels = {
    newest: window.t ? window.t("sort.newest") : "Newest First",
    oldest: window.t ? window.t("sort.oldest") : "Oldest First",
    deadline_asc: window.t
      ? window.t("sort.deadline_closest")
      : "Deadline (Closest)",
    deadline_desc: window.t
      ? window.t("sort.deadline_farthest")
      : "Deadline (Farthest)",
    price_asc: window.t
      ? window.t("sort.price_low_high")
      : "Price (Low to High)",
    price_desc: window.t
      ? window.t("sort.price_high_low")
      : "Price (High to Low)",
    title_asc: window.t ? window.t("sort.title_az") : "Title (A-Z)",
    title_desc: window.t ? window.t("sort.title_za") : "Title (Z-A)",
    priority: window.t ? window.t("sort.priority") : "By Priority",
  };

  const sortByText = window.t ? window.t("sort.sort_by") : "Sort by";
  const currentSort = sortLabels[appState.sortBy] || sortLabels["newest"];

  sortBtn.innerHTML = `
        <span>📊 <span class="sort-label">${sortByText}:</span> ${currentSort}</span>
        <span class="dropdown-arrow">▼</span>
    `;
}

// =============================================
// COMMS EDITOR (MODAL)
// =============================================
function openCommEditor(commId = null) {
  appState.currentEditingComm = commId;

  const modal = document.getElementById("editor-modal");
  if (!modal) return;

  loadCommEditorContent(commId);
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeEditor() {
  const modal = document.getElementById("editor-modal");
  if (modal) {
    modal.classList.add("hidden");
    document.body.style.overflow = "auto";
    appState.currentEditingComm = null;
    appState.currentImages = [];
    appState.currentImageIndex = 0;
  }
}

function loadCommEditorContent(commId) {
  const modalContent = document.getElementById("editor-modal-content");
  if (!modalContent) return;

  modalContent.innerHTML = getCommEditorHTML();

  if (commId) {
    loadCommData(commId);
  } else {
    resetCommForm();
  }

  setupCommEditorListeners();
}

function getCommEditorHTML() {
  const backText = window.t ? window.t("navigation.back") : "Back";
  const newCommText = window.t ? window.t("editor.new_comm") : "New Comm";
  const saveText = window.t ? window.t("editor.save") : "Save";
  const deleteText = window.t ? window.t("editor.delete") : "Delete";
  const titleText = window.t ? window.t("editor.title") : "Title";
  const titlePlaceholder = window.t
    ? window.t("editor.title_placeholder")
    : "Comm title";
  const commissionerText = window.t
    ? window.t("editor.commissioner")
    : "Commissioner";
  const commissionerPlaceholder = window.t
    ? window.t("editor.commissioner_placeholder")
    : "Commissioner name";
  const priceText = window.t ? window.t("editor.price") : "Price (USD)";
  const pricePlaceholder = window.t
    ? window.t("editor.price_placeholder")
    : "0 for free request";
  const deadlineText = window.t ? window.t("editor.deadline") : "Deadline";
  const statusText = window.t ? window.t("filters.status") : "Status";
  const priorityText = window.t ? window.t("filters.priority") : "Priority";
  const typeText = window.t ? window.t("filters.type") : "Type";
  const descriptionText = window.t
    ? window.t("editor.description")
    : "Description";
  const descriptionPlaceholder = window.t
    ? window.t("editor.description_placeholder")
    : "Detailed work description...";
  const referencesText = window.t
    ? window.t("editor.references")
    : "References";
  const addImagesText = window.t
    ? window.t("editor.add_images")
    : "+ Add Images";
  const openFolderText = window.t
    ? window.t("editor.open_folder_btn")
    : "Open Folder";
  const noImagesText = window.t
    ? window.t("editor.no_images")
    : "No images yet. Add some references.";

  return `
        <div class="container">
            <header class="detail-header">
                <button class="back-btn" onclick="closeEditor()">← ${backText}</button>
                <h1 id="editor-title">${newCommText}</h1>
                <div class="header-actions">
                    <button class="save-btn" onclick="saveComm()">${saveText}</button>
                    <button class="delete-btn" onclick="deleteComm()">${deleteText}</button>
                </div>
            </header>

            <main class="detail-content">
                <div class="form-section">
                    <div class="form-group">
                        <label>${titleText}</label>
                        <input type="text" id="comm-title" placeholder="${titlePlaceholder}">
                    </div>
                    
                    <div class="form-group">
                        <label>${commissionerText}</label>
                        <input type="text" id="comm-commissioner" placeholder="${commissionerPlaceholder}">
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>${priceText}</label>
                            <input type="number" id="comm-price" placeholder="${pricePlaceholder}" min="0"> <!-- ACTUALIZADO -->
                        </div>
                        
                        <div class="form-group">
                            <label>${deadlineText}</label>
                            <input type="date" id="comm-deadline">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>${statusText}</label>
                            <select id="comm-status">
                                <option value="pending">${getStatusText(
                                  "pending"
                                )}</option>
                                <option value="progress">${getStatusText(
                                  "progress"
                                )}</option>
                                <option value="completed">${getStatusText(
                                  "completed"
                                )}</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>${priorityText}</label>
                            <select id="comm-priority">
                                <option value="high">${getPriorityText(
                                  "high"
                                )}</option>
                                <option value="medium">${getPriorityText(
                                  "medium"
                                )}</option>
                                <option value="low">${getPriorityText(
                                  "low"
                                )}</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>${typeText}</label>
                            <select id="comm-type">
                                <option value="2d">2D</option>
                                <option value="3d">3D</option>
                                <option value="translation">${getTranslationText(
                                  "translation"
                                )}</option>
                                <option value="web">${getTranslationText(
                                  "web_design"
                                )}</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>${descriptionText}</label>
                        <textarea id="comm-description" placeholder="${descriptionPlaceholder}" rows="5"></textarea>
                    </div>
                </div>

                <div class="gallery-section">
                    <h3>${referencesText}</h3>
                    <div class="gallery-actions">
                        <button class="add-image-btn" onclick="addReferenceImage()">${addImagesText}</button>
                        <button class="open-folder-btn" onclick="openCommFolder()">${openFolderText}</button>
                    </div>
                    
                    <div class="image-gallery" id="image-gallery">
                        <div class="empty-gallery">
                            <p>${noImagesText}</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    `;
}

function getTranslationText(key) {
  return window.t ? window.t(`filters.${key}`) : key;
}

function loadCommData(commId) {
  const comm = appState.comms.find((c) => c.id === commId);
  if (!comm) return;

  const editText = window.t
    ? window.t("editor.edit_comm", { title: comm.title })
    : `Editing: ${comm.title}`;
  document.getElementById("editor-title").textContent = editText;
  document.getElementById("comm-title").value = comm.title;
  document.getElementById("comm-commissioner").value = comm.commissioner;
  document.getElementById("comm-price").value = comm.price;
  document.getElementById("comm-deadline").value = comm.deadline;
  document.getElementById("comm-status").value = comm.status;
  document.getElementById("comm-priority").value = comm.priority;
  document.getElementById("comm-type").value = comm.type;
  document.getElementById("comm-description").value = comm.description || "";

  // Cargar referencias desde el sistema de archivos
  loadCommReferences(commId);
}

// Y en resetCommForm, limpiar las referencias
function resetCommForm() {
  const newCommText = window.t ? window.t("editor.new_comm") : "New Comm";
  document.getElementById("editor-title").textContent = newCommText;
  document.getElementById("comm-title").value = "";
  document.getElementById("comm-commissioner").value = "";
  document.getElementById("comm-price").value = "";
  document.getElementById("comm-deadline").value = "";
  document.getElementById("comm-status").value = "pending";
  document.getElementById("comm-priority").value = "medium";
  document.getElementById("comm-type").value = "2d";
  document.getElementById("comm-description").value = "";

  appState.currentReferences = [];
  updateReferenceGallery();
}

function setupCommEditorListeners() {
  const titleInput = document.getElementById("comm-title");
  const priceInput = document.getElementById("comm-price");

  if (titleInput) {
    titleInput.addEventListener("input", function () {
      /*
            if (this.value.length > 100) {
                this.value = this.value.substring(0, 100);
            }
            */
    });
  }

  if (priceInput) {
    priceInput.addEventListener("input", function () {
      if (this.value < 0) this.value = 0;
      // if (this.value > 10000) this.value = 10000; // No limite superior
    });
  }
}

async function saveComm() {
  const title = document.getElementById("comm-title").value.trim();
  const commissioner = document
    .getElementById("comm-commissioner")
    .value.trim();
  const price = parseInt(document.getElementById("comm-price").value) || 0;
  const deadline = document.getElementById("comm-deadline").value;

  const validationTitle = window.t
    ? window.t("alerts.validation_title")
    : "Title is required";
  const validationCommissioner = window.t
    ? window.t("alerts.validation_commissioner")
    : "Commissioner name is required";
  //const validationPrice = window.t ? window.t('alerts.validation_price') : 'Price must be greater than 0';
  const validationDeadline = window.t
    ? window.t("alerts.validation_deadline")
    : "Deadline is required";

  if (!title) {
    showErrorToast(validationTitle, "Validation Error");
    return;
  }

  if (!commissioner) {
    showErrorToast(validationCommissioner, "Validation Error");
    return;
  }

  /*
    if (price <= 0) {
        alert(validationPrice);
        return;
    }
    */

  if (!deadline) {
    showErrorToast(validationDeadline, "Validation Error");
    return;
  }

  const commData = {
    id: appState.currentEditingComm || generateId(),
    title: title,
    commissioner: commissioner,
    price: price,
    currency: "USD",
    deadline: deadline,
    status: document.getElementById("comm-status").value,
    priority: document.getElementById("comm-priority").value,
    type: document.getElementById("comm-type").value,
    description: document.getElementById("comm-description").value,
    references: appState.currentImages,
    pinned: appState.currentEditingComm
      ? appState.comms.find((c) => c.id === appState.currentEditingComm)
          ?.pinned || false
      : false,
    createdAt: appState.currentEditingComm
      ? appState.comms.find((c) => c.id === appState.currentEditingComm)
          ?.createdAt || new Date().toISOString()
      : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    if (!appState.currentEditingComm) {
      appState.comms.push(commData);
    } else {
      const index = appState.comms.findIndex(
        (c) => c.id === appState.currentEditingComm
      );
      if (index !== -1) {
        appState.comms[index] = commData;
      }
    }

    await window.electronAPI.saveComms(appState.comms);

    const successMessage = window.t
      ? window.t("alerts.comm_saved")
      : "Comm saved successfully";
    showSuccessToast(successMessage);
    closeEditor();
    renderCommsGrid();
  } catch (error) {
    console.error("Error saving comm:", error);
    showErrorToast(error.message, "Save Error");
  }
}

async function deleteComm() {
  if (!appState.currentEditingComm) {
    closeEditor();
    return;
  }

  const confirmed = await showDeleteConfirm(
    window.t
      ? window.t("alerts.confirm_delete_comm")
      : "Are you sure you want to delete this comm? This action cannot be undone.",
    "Delete Commission"
  );

  if (confirmed) {
    const commId = appState.currentEditingComm;
    const index = appState.comms.findIndex((c) => c.id === commId);

    if (index !== -1) {
      try {
        // 1. Eliminar del array en memoria
        appState.comms.splice(index, 1);

        // 2. Guardar el JSON actualizado
        await window.electronAPI.saveComms(appState.comms);

        // 3. Eliminar la carpeta física con todas las referencias
        await window.electronAPI.deleteCommFolder(commId);

        const successMessage = window.t
          ? window.t("alerts.comm_deleted")
          : "Comm deleted successfully";
        showSuccessToast(successMessage);
        closeEditor();
        renderCommsGrid();
      } catch (error) {
        console.error("Error deleting comm:", error);
        showErrorToast(error.message, "Delete Error");
      }
    }
  }
}

function generateId() {
  return "comm_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

// =============================================
// CLEANUP UTILITIES (para desarrollo)
// =============================================
async function cleanupOrphanedComms() {
  const confirmed = await showWarningConfirm(
    "This will delete all comm folders that are not in the JSON file. Continue?",
    "Cleanup Orphaned Comms"
  );

  if (confirmed) {
    try {
      const deletedCount = await window.electronAPI.cleanupOrphanedComms();
      showSuccessToast(
        `Cleanup completed: ${deletedCount} orphaned folders deleted`
      );
    } catch (error) {
      console.error("Error during cleanup:", error);
      showErrorToast(error.message, "Cleanup Error");
    }
  }
}

// Objeto Global para debbuging
window.cleanupOrphanedComms = cleanupOrphanedComms;

// =============================================
// IMAGE MANAGEMENT
// =============================================
async function addReferenceImage() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*,.pdf,.psd,.zip,.mp4,.avi,.mov,.webm";
  input.multiple = true;

  input.onchange = async (e) => {
    const files = Array.from(e.target.files);
    const currentCommId = appState.currentEditingComm;

    if (!currentCommId) {
      const alertText = window.t
        ? window.t("alerts.save_comm_first")
        : "First you need to save the comm before adding references";
      showWarningToast(alertText, "Save Comm First");
      return;
    }

    for (const file of files) {
      try {
        // NO limit size
        /*
                if (file.size > 100 * 1024 * 1024) {
                    const alertText = window.t ? window.t('alerts.file_too_large', { name: file.name }) : `The file ${file.name} is too large (max 100MB)`;
                    alert(alertText);
                    continue;
                }
                */

        const fileExtension = file.name.split(".").pop();
        const filename = `ref_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}.${fileExtension}`;

        let fileData;
        let fileType = "file";

        if (file.type.startsWith("image/")) {
          fileData = await fileToBase64(file);
          fileType = "image";
        } else if (file.type.startsWith("video/")) {
          // Para videos, usar ArrayBuffer
          const arrayBuffer = await file.arrayBuffer();
          fileData = arrayBuffer;
          fileType = "video";
        } else {
          // Para otros archivos
          const arrayBuffer = await file.arrayBuffer();
          fileData = arrayBuffer;
          fileType = "file";
        }

        // Guardar referencia
        await window.electronAPI.saveCommReference(
          currentCommId,
          fileData,
          filename,
          fileType
        );

        // Recargar referencias
        await loadCommReferences(currentCommId);
      } catch (error) {
        console.error("Error adding reference:", error);
        const alertText = window.t
          ? window.t("alerts.error_adding_file", { name: file.name })
          : `Error adding ${file.name}`;
        showErrorToast(`${alertText}: ${error.message}`, "File Error");
      }
    }
  };

  input.click();
}

async function loadCommReferences(commId) {
  try {
    const references = await window.electronAPI.getCommReferences(commId);
    appState.currentReferences = references;
    updateReferenceGallery();
  } catch (error) {
    console.error("Error loading references:", error);
    appState.currentReferences = [];
    updateReferenceGallery();
  }
}

// =============================================
// REFERENCE VIEWER SYSTEM - MEJORADO
// =============================================
function updateReferenceGallery() {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;

  if (!appState.currentReferences || appState.currentReferences.length === 0) {
    const noRefsText = window.t
      ? window.t("editor.no_images")
      : "No references yet. Add images, videos or files.";
    gallery.innerHTML = `
            <div class="empty-gallery">
                <p>${noRefsText}</p>
            </div>
        `;
    return;
  }

  gallery.innerHTML = appState.currentReferences
    .map((ref, index) => {
      if (ref.type === "image" && ref.data) {
        return `
                <div class="gallery-item" data-type="image">
                    <img src="${ref.data}" alt="${ref.name}" onclick="openReferenceViewer(${index})">
                    <button class="remove-image-btn" onclick="removeReference('${ref.name}')">×</button>
                    <div class="file-info">${ref.name}</div>
                </div>
            `;
      } else if (ref.type === "video") {
        return `
                <div class="gallery-item" data-type="video">
                    <div class="video-icon" onclick="openReferenceFile('${ref.name}')">
                        🎥
                        <span class="play-button">▶</span>
                        <span class="file-type">Video</span>
                    </div>
                    <button class="remove-image-btn" onclick="removeReference('${ref.name}')">×</button>
                    <div class="file-info">${ref.name}</div>
                </div>
            `;
      } else {
        return `
                <div class="gallery-item" data-type="file">
                    <div class="file-icon" onclick="openReferenceFile('${
                      ref.name
                    }')">
                        ${getFileIcon(ref.name)}
                        <span class="file-type">${getFileType(ref.name)}</span>
                    </div>
                    <button class="remove-image-btn" onclick="removeReference('${
                      ref.name
                    }')">×</button>
                    <div class="file-info">${ref.name}</div>
                </div>
            `;
      }
    })
    .join("");
}

function getFileType(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const typeMap = {
    // Videos
    mp4: "MP4",
    avi: "AVI",
    mov: "MOV",
    wmv: "WMV",
    webm: "WEBM",
    mkv: "MKV",
    // Documentos
    pdf: "PDF",
    doc: "DOC",
    docx: "DOCX",
    txt: "TXT",
    // Diseño
    psd: "PSD",
    ai: "AI",
    afdesign: "Affinity",
    // Archivos comprimidos
    zip: "ZIP",
    rar: "RAR",
    "7z": "7Z",
    tar: "TAR",
    // Ejecutables
    exe: "EXE",
    msi: "MSI",
  };
  return typeMap[ext] || "File";
}

async function removeReference(filename) {
  const confirmed = await showDeleteConfirm(
    window.t
      ? window.t("alerts.confirm_delete_image")
      : "Are you sure you want to delete this reference?",
    "Delete Reference"
  );

  if (confirmed) {
    try {
      const currentCommId = appState.currentEditingComm;
      await window.electronAPI.deleteCommReference(currentCommId, filename);
      await loadCommReferences(currentCommId);
    } catch (error) {
      console.error("Error removing reference:", error);
      showErrorToast(error.message, "Delete Error");
    }
  }
}

// =============================================
// OPEN REFERENCE FILE - MEJORADO
// =============================================
async function openReferenceFile(filename) {
  try {
    const currentCommId = appState.currentEditingComm;
    if (!currentCommId) {
      showErrorToast("No comm selected");
      return;
    }

    const filePath = await window.electronAPI.getReferenceFilePath(
      currentCommId,
      filename
    );
    await window.electronAPI.openFile(filePath);
  } catch (error) {
    console.error("Error opening file:", error);
    const errorText = window.t
      ? window.t("alerts.error_opening_file")
      : "Error opening file";
    showErrorToast(`${errorText}: ${error.message}`, "File Error");
  }
}

// =============================================
// GET FILE ICON - MEJORADO
// =============================================
function getFileIcon(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const icons = {
    // Videos
    mp4: "🎥",
    avi: "🎥",
    mov: "🎥",
    wmv: "🎥",
    webm: "🎥",
    mkv: "🎥",
    // Documentos
    pdf: "📄",
    doc: "📄",
    docx: "📄",
    txt: "📄",
    // Imágenes (aunque ya se manejan aparte)
    psd: "🎨",
    ai: "🎨",
    afdesign: "🎨",
    // Archivos comprimidos
    zip: "📦",
    rar: "📦",
    "7z": "📦",
    tar: "📦",
    // Otros
    exe: "⚙️",
    msi: "⚙️",
  };
  return icons[ext] || "📁";
}

// =============================================
// REFERENCE VIEWER - MEJORADO PARA VIDEOS
// =============================================
function openReferenceViewer(index) {
  const ref = appState.currentReferences[index];

  if (!ref) return;

  if (ref.type === "image" && ref.data) {
    // Usar el visor de imágenes existente para imágenes
    const imageRefs = appState.currentReferences.filter(
      (r) => r.type === "image" && r.data
    );
    const imageIndex = imageRefs.findIndex((img) => img.name === ref.name);

    if (imageIndex !== -1) {
      appState.currentImages = imageRefs.map((img) => ({
        data: img.data,
        name: img.name,
      }));
      appState.currentImageIndex = imageIndex;
      openImageViewer(appState.currentImageIndex);
    }
  } else {
    // Para videos y otros archivos, abrir con programa externo
    openReferenceFile(ref.name);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function updateImageGallery() {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;

  if (appState.currentImages.length === 0) {
    const noImagesText = window.t
      ? window.t("editor.no_images")
      : "No images yet. Add some references.";
    gallery.innerHTML = `<div class="empty-gallery"><p>${noImagesText}</p></div>`;
    return;
  }

  gallery.innerHTML = appState.currentImages
    .map(
      (img, index) => `
        <div class="gallery-item">
            <img src="${img.data}" alt="${img.name}" onclick="openImageViewer(${index})">
            <button class="remove-image-btn" onclick="removeImage(${index})">×</button>
        </div>
    `
    )
    .join("");
}

function removeImage(index) {
  appState.currentImages.splice(index, 1);
  updateImageGallery();
}

// =============================================
// IMAGE VIEWER
// =============================================
function openImageViewer(index) {
  appState.currentImageIndex = index;
  const viewer = document.getElementById("image-viewer");
  const viewerImage = document.getElementById("viewer-image");
  const imageCounter = document.getElementById("image-counter");

  if (viewer && viewerImage && imageCounter) {
    viewerImage.src = appState.currentImages[index].data;
    imageCounter.textContent = `${index + 1}/${appState.currentImages.length}`;
    viewer.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
}

function closeImageViewer() {
  const viewer = document.getElementById("image-viewer");
  if (viewer) {
    viewer.classList.add("hidden");
    document.body.style.overflow = "auto";
  }
}

function nextImage() {
  if (appState.currentImages.length === 0) return;
  appState.currentImageIndex =
    (appState.currentImageIndex + 1) % appState.currentImages.length;
  openImageViewer(appState.currentImageIndex);
}

function previousImage() {
  if (appState.currentImages.length === 0) return;
  appState.currentImageIndex =
    appState.currentImageIndex === 0
      ? appState.currentImages.length - 1
      : appState.currentImageIndex - 1;
  openImageViewer(appState.currentImageIndex);
}

function deleteCurrentImage() {
  if (appState.currentImages.length === 0) return;

  showDeleteConfirm(
    window.t
      ? window.t("alerts.confirm_delete_image")
      : "Are you sure you want to delete this image?",
    "Delete Image"
  ).then((confirmed) => {
    if (confirmed) {
      removeImage(appState.currentImageIndex);

      if (appState.currentImages.length === 0) {
        closeImageViewer();
      } else {
        appState.currentImageIndex = Math.min(
          appState.currentImageIndex,
          appState.currentImages.length - 1
        );
        openImageViewer(appState.currentImageIndex);
      }
    }
  });
}

// =============================================
// ZOOM SYSTEM
// =============================================
function toggleZoom() {
  const viewerImage = document.getElementById("viewer-image");
  if (viewerImage) {
    const currentScale = viewerImage.style.transform.includes("scale(2)")
      ? 1
      : 2;
    viewerImage.style.transform = `scale(${currentScale})`;
    viewerImage.style.cursor = currentScale === 2 ? "zoom-out" : "zoom-in";
  }
}

// =============================================
// UTILITIES
// =============================================
function openSaveFolder() {
  window.electronAPI.openSaveFolder();
}

function confirmDeleteAll() {
  showDeleteConfirm(
    window.t
      ? window.t("alerts.confirm_delete_all")
      : "Are you sure you want to delete ALL data? This action cannot be undone.",
    "Delete All Data"
  ).then((confirmed) => {
    if (confirmed) {
      window.electronAPI
        .deleteAllData()
        .then(() => {
          const successMessage = window.t
            ? window.t("alerts.all_data_deleted")
            : "All data has been deleted";
          showSuccessToast(successMessage);
          location.reload();
        })
        .catch((error) => {
          console.error("Error deleting data:", error);
          showErrorToast(error.message, "Delete Error");
        });
    }
  });
}

async function openCommFolder() {
  const currentCommId = appState.currentEditingComm;

  if (!currentCommId) {
    showWarningToast("You need to save the comm first", "Save Comm First");
    return;
  }

  try {
    // Obtener la ruta de la carpeta de referencias
    const referencesFolder = await window.electronAPI.getReferenceFolderPath(
      currentCommId
    );
    await window.electronAPI.openFile(referencesFolder);
  } catch (error) {
    console.error("Error opening references folder:", error);
    // Fallback: abrir la carpeta general de comms
    await window.electronAPI.openSaveFolder();
  }
}

function changeLanguage(lang) {
  if (window.i18n && window.i18n.changeLanguage) {
    window.i18n
      .changeLanguage(lang)
      .then((success) => {
        if (success) {
          console.log("Language changed to:", lang);
          // NO actualizar appState.language aquí - i18n es la fuente de verdad

          // Recargar la vista actual para aplicar traducciones
          const activeView = document.querySelector(".view.active");
          if (activeView) {
            const viewName = activeView.id.replace("view-", "");
            loadViewContent(viewName);
          }

          // El autoSaveConfig se encargará de guardar el idioma correcto
        } else {
          console.error("Failed to change language");
          showErrorToast("Failed to change language", "Language Error");
        }
      })
      .catch((error) => {
        console.error("Error changing language:", error);
        showErrorToast(error.message, "Language Error");
      });
  }
}

// =============================================
// GLOBAL EVENT LISTENERS
// =============================================
function setupEventListeners() {
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      const configView = document.getElementById("view-config");
      if (configView && configView.classList.contains("active")) {
        saveConfig();
      }
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      const imageViewer = document.getElementById("image-viewer");
      if (imageViewer && !imageViewer.classList.contains("hidden")) {
        closeImageViewer();
        return;
      }

      const editorModal = document.getElementById("editor-modal");
      if (editorModal && !editorModal.classList.contains("hidden")) {
        closeEditor();
      }
    }
  });
}

// =============================================
// GLOBAL INITIALIZATION
// =============================================
window.showView = showView;
window.openCommEditor = openCommEditor;
window.closeEditor = closeEditor;
window.saveConfig = saveConfig;
window.openSaveFolder = openSaveFolder;
window.confirmDeleteAll = confirmDeleteAll;
window.openCommFolder = openCommFolder;
window.addReferenceImage = addReferenceImage;
window.openImageViewer = openImageViewer;
window.closeImageViewer = closeImageViewer;
window.nextImage = nextImage;
window.previousImage = previousImage;
window.deleteCurrentImage = deleteCurrentImage;
window.toggleZoom = toggleZoom;
window.saveComm = saveComm;
window.deleteComm = deleteComm;
window.removeImage = removeImage;
window.changeLanguage = changeLanguage;
window.changeBackgroundImage = changeBackgroundImage;
window.removeBackgroundImage = removeBackgroundImage;
window.toggleBackgroundForAllPages = toggleBackgroundForAllPages;

// Toast functions
window.showToast = showToast;
window.showSuccessToast = showSuccessToast;
window.showErrorToast = showErrorToast;
window.showWarningToast = showWarningToast;
window.showInfoToast = showInfoToast;

// Confirmation functions
window.showConfirm = showConfirm;
window.showDeleteConfirm = showDeleteConfirm;
window.showWarningConfirm = showWarningConfirm;
window.showSuccessConfirm = showSuccessConfirm;
window.showInfoConfirm = showInfoConfirm;

// Reference functions
window.openReferenceViewer = openReferenceViewer;
window.openReferenceFile = openReferenceFile;
window.removeReference = removeReference;

// Cleanup function
window.cleanupOrphanedComms = cleanupOrphanedComms;

console.log("Renderer script loaded - Global functions exposed");

// ============================================
// SISTEMA DE VIDEOS DE FONDO
// ============================================
async function changeBackgroundVideo() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "video/*";
  input.multiple = false;

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tamaño (máx 500MB)
    if (file.size > 500 * 1024 * 1024) {
      showErrorToast(
        window.t
          ? window.t("alerts.video_too_large")
          : "The selected video is too large. Maximum size is 500MB.",
        "File Too Large"
      );
      return;
    }

    try {
      const saveStatus = document.getElementById("save-status");
      if (saveStatus) {
        saveStatus.textContent = window.t
          ? window.t("alerts.saving_video")
          : "Saving video...";
        saveStatus.className = "save-status show";
      }

      // Convertir a base64
      const fileExtension = file.name.split(".").pop();
      const filename = "background_video_${Date.now()}.".$[fileExtension];

      // Guardar video en el sistema de archivos
      const arraybuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arraybuffer);
      await window.electronAPI.saveBackgroundVideo(filename, buffer);

      //Limpiar fondo de imagen si existe
      if (appState.backgroundImage) {
        await removeBackgroundImage();
      }
      if (appState.backgroundVideo) {
        await removeBackgroundVideo();
      }

      // Actualizar estado
      appState.backgroundVideo = filename;
      appState.backgroundType = "video";

      await window.electronAPI.saveConfig(appState);

      // Aplicar video de fondo
      applyBackgroundVideo(filename, appState.backgroundAllPages);

      if (saveStatus) {
        saveStatus.textContent = "Video saved successfully";
        saveStatus.className = "save-status success show";
        setTimeout(() => {
          saveStatus.className = "save-status";
        }, 3000);
      }
    } catch (error) {
      console.error("Error changing background video:", error);
      showErrorToast(error.message, "Background Error");
    }
  };

  input.click();
}

async function applyBackgroundVideo(filename, allPages = false) {
  const appBackground = document.getElementById("app-background");
  if (!appBackground) return;

  // Limpiar fondo previo
  appBackground.innerHTML = "";
  appBackground.style.backgroundImage = "";

  // Crear elemento de video
  const video = document.createElement("video");
  video.autoplay = true;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;

  try {
    // Cargar video desde el sistema de archivos
    const videoPath = await window.electronAPI.getBackgroundVideoPath(filename);
    video.src = videoPath;

    video.onloadeddata = () => {
      appBackground.appendChild(video);
      document.body.classList.add("background-video");

      // Actualizar clases de body
      document.body.classList.remove(
        "background-all-pages",
        "background-welcome-only"
      );
      if (allPages) {
        document.body.classList.add("background-all-pages");
      } else {
        document.body.classList.add("background-welcome-only");
      }
    };
  } catch (error) {
    console.error("Error applying background video:", error);
    applyDefaultBackground();
  }
}

async function removeBackgroundVideo() {
  if (!appState.backgroundVideo) return;

  try {
    await window.electronAPI.deleteBackgroundVideo(appState.backgroundVideo);
    appState.backgroundVideo = null;
    appState.backgroundType = null;
    await window.electronAPI.saveConfig(appState);

    // Limpiar fondo de video
    const appBackground = document.getElementById("app-background");
    if (appBackground) {
      appBackground.innerHTML = "";
    }
    document.body.classList.remove("background-video");
    applyDefaultBackground();
  } catch (error) {
    console.error("Error removing background video:", error);
    showErrorToast(error.message, "Background Error");
  }
}

// =============================================
// CONFIRMATION MODAL SYSTEM
// =============================================
function showConfirm(title, message, type = "warning") {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    const icon = document.getElementById("confirm-icon");
    const titleEl = document.getElementById("confirm-title");
    const messageEl = document.getElementById("confirm-message");
    const cancelBtn = document.getElementById("confirm-cancel");
    const okBtn = document.getElementById("confirm-ok");

    if (!modal) {
      resolve(false);
      return;
    }

    // Configurar iconos según el tipo
    const icons = {
      warning: "⚠️",
      danger: "❌",
      success: "✅",
      info: "ℹ️",
      question: "❓",
    };

    // Configurar estilos del botón según el tipo
    const buttonClasses = {
      warning: "warning",
      danger: "confirm",
      success: "success",
      info: "confirm",
      question: "confirm",
    };

    // Actualizar contenido
    icon.textContent = icons[type] || icons.warning;
    titleEl.textContent = title;
    messageEl.textContent = message;

    // Actualizar clases del botón OK
    okBtn.className = `confirm-btn ${buttonClasses[type] || "confirm"}`;

    // Configurar event listeners
    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const handleKeydown = (e) => {
      if (e.key === "Escape") {
        handleCancel();
      } else if (e.key === "Enter") {
        handleConfirm();
      }
    };

    const cleanup = () => {
      modal.classList.add("hidden");
      document.removeEventListener("keydown", handleKeydown);
      okBtn.removeEventListener("click", handleConfirm);
      cancelBtn.removeEventListener("click", handleCancel);
    };

    // Agregar event listeners
    okBtn.addEventListener("click", handleConfirm);
    cancelBtn.addEventListener("click", handleCancel);
    document.addEventListener("keydown", handleKeydown);

    // Mostrar modal
    modal.classList.remove("hidden");
  });
}

// Helper functions para diferentes tipos de confirmación
async function showDeleteConfirm(message, title = "Confirm Delete") {
  return await showConfirm(title, message, "danger");
}

async function showWarningConfirm(message, title = "Warning") {
  return await showConfirm(title, message, "warning");
}

async function showSuccessConfirm(message, title = "Confirm Action") {
  return await showConfirm(title, message, "success");
}

async function showInfoConfirm(message, title = "Please Confirm") {
  return await showConfirm(title, message, "info");
}
