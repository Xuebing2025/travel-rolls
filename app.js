const trips = {
  "hong-kong": {
    title: "香港",
    kicker: "ROLL 01 · HONG KONG",
    date: "2026.03.08—03.12",
    image: "./assets/travel/hong-kong.webp",
  },
  shanxi: {
    title: "大同—太原",
    kicker: "ROLL 02 · SHANXI",
    date: "2025.08.16—08.22",
    image: "./assets/travel/datong.webp",
  },
  hangzhou: {
    title: "杭州",
    kicker: "ROLL 03 · HANGZHOU",
    date: "2025.04.03—04.06",
    image: "./assets/travel/hangzhou.webp",
  },
  dalian: {
    title: "大连",
    kicker: "ROLL 04 · DALIAN",
    date: "2024.09.12—09.16",
    image: "./assets/travel/dalian.webp",
  },
  "text-roll": {
    title: "北京",
    kicker: "ROLL 05 · TEXT ROLL",
    date: "2024.02.01—02.04",
    image: "./assets/travel/taiyuan.webp",
  },
};

const views = [...document.querySelectorAll("[data-view]")];
const toast = document.querySelector("#toast");
const storageKeys = {
  captionColors: "travel-rolls.caption-colors",
  tagColors: "travel-rolls.tag-colors",
  tripTags: "travel-rolls.trip-tags",
};
const defaultTagColors = { 古建: "#d66f3e", 街景: "#55715e", 精选: "#9a6749", 游记: "#b44b34" };
const defaultTripTags = {
  "hong-kong": ["街景", "精选"],
  shanxi: ["古建", "街景", "精选"],
  hangzhou: ["风景", "精选"],
  dalian: ["海岸", "街景"],
  "text-roll": ["游记"],
};
let activeTripId = "shanxi";
let toastTimer;

function readStoredObject(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === "object" && !Array.isArray(value) ? value : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

const captionColors = readStoredObject(storageKeys.captionColors, { hangzhou: "black", dalian: "black" });
const tagColors = { ...defaultTagColors, ...readStoredObject(storageKeys.tagColors, {}) };
const tripTags = { ...defaultTripTags, ...readStoredObject(storageKeys.tripTags, {}) };

function persist(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function route(name, push = true) {
  const target = views.find((view) => view.dataset.view === name) || views[0];
  views.forEach((view) => view.classList.toggle("active", view === target));
  document.querySelectorAll("nav button").forEach((button) => {
    button.setAttribute("aria-current", button.dataset.route === name ? "page" : "false");
  });
  if (push) history.pushState({ route: name }, "", `#${name}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openTrip(id) {
  const trip = trips[id] || trips.shanxi;
  activeTripId = trips[id] ? id : "shanxi";
  document.querySelector("#trip-title").textContent = trip.title;
  document.querySelector("#trip-kicker").textContent = trip.kicker;
  document.querySelector("#trip-date").textContent = trip.date;
  const image = document.querySelector("#trip-hero-image");
  image.src = trip.image;
  image.alt = `${trip.title}旅行封面测试图`;
  renderTripTags();
  route("trip");
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function renderTripTags() {
  const tagRow = document.querySelector("#trip-tags");
  const editorList = document.querySelector("#tag-editor-list");
  const names = tripTags[activeTripId] || [];
  tagRow.replaceChildren();
  editorList.replaceChildren();

  names.forEach((name) => {
    const chip = document.createElement("span");
    chip.textContent = name;
    chip.style.setProperty("--tag-color", tagColors[name] || "#db7a5c");
    tagRow.append(chip);

    const item = document.createElement("div");
    item.className = "tag-edit-item";
    const color = document.createElement("input");
    color.type = "color";
    color.value = tagColors[name] || "#db7a5c";
    color.setAttribute("aria-label", `更改${name}标签颜色`);
    color.addEventListener("input", () => {
      tagColors[name] = color.value;
      persist(storageKeys.tagColors, tagColors);
      renderTripTags();
    });
    const label = document.createElement("span");
    label.textContent = name;
    const remove = document.createElement("button");
    remove.type = "button";
    const isSystemTag = name === "游记";
    remove.textContent = isSystemTag ? "系统标签" : "移除";
    remove.disabled = isSystemTag;
    if (!isSystemTag) {
      remove.addEventListener("click", () => {
        tripTags[activeTripId] = names.filter((tag) => tag !== name);
        persist(storageKeys.tripTags, tripTags);
        renderTripTags();
        showToast(`已从本次旅行移除“${name}”`);
      });
    }
    item.append(color, label, remove);
    editorList.append(item);
  });
}

const captionModes = ["auto", "white", "black"];
const captionModeLabels = { auto: "自动", white: "白", black: "黑" };

function applyCaptionColors() {
  document.querySelectorAll("[data-caption-color]").forEach((button) => {
    const strip = button.closest(".film-strip");
    const caption = strip.querySelector("p");
    const mode = captionColors[button.dataset.captionColor] || (caption.classList.contains("dark") ? "black" : "auto");
    caption.classList.remove("caption-white", "caption-black");
    if (mode !== "auto") caption.classList.add(`caption-${mode}`);
    button.textContent = `字色 · ${captionModeLabels[mode]}`;
  });
}

document.addEventListener("click", (event) => {
  const colorButton = event.target.closest("[data-caption-color]");
  if (colorButton) {
    event.stopPropagation();
    const id = colorButton.dataset.captionColor;
    const stripCaption = colorButton.closest(".film-strip").querySelector("p");
    const current = captionColors[id] || (stripCaption.classList.contains("dark") ? "black" : "auto");
    captionColors[id] = captionModes[(captionModes.indexOf(current) + 1) % captionModes.length];
    persist(storageKeys.captionColors, captionColors);
    applyCaptionColors();
    showToast(`横幅字色：${captionModeLabels[captionColors[id]]}`);
    return;
  }

  const routeButton = event.target.closest("[data-route]");
  if (routeButton) route(routeButton.dataset.route);

  const tripButton = event.target.closest("[data-open-trip]");
  if (tripButton) openTrip(tripButton.dataset.openTrip);
});

document.querySelector("#tag-editor-toggle").addEventListener("click", () => {
  const editor = document.querySelector("#tag-editor");
  const willOpen = editor.hidden;
  editor.hidden = !willOpen;
  document.querySelector("#tag-editor-toggle").setAttribute("aria-expanded", String(willOpen));
  if (willOpen) document.querySelector("#tag-name").focus();
});

document.querySelector("#tag-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const nameInput = document.querySelector("#tag-name");
  const colorInput = document.querySelector("#tag-color");
  const name = nameInput.value.trim();
  if (!name) return;
  const names = tripTags[activeTripId] || [];
  if (names.includes(name)) {
    showToast(`“${name}”已经在本次旅行中`);
    return;
  }
  tagColors[name] = tagColors[name] || colorInput.value;
  tripTags[activeTripId] = [...names, name];
  persist(storageKeys.tagColors, tagColors);
  persist(storageKeys.tripTags, tripTags);
  nameInput.value = "";
  renderTripTags();
  showToast(`已添加标签“${name}”`);
});

document.querySelectorAll("[data-province]").forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.dataset.province;
    const provinceDisplayNames = {
      北京: "北京市", 天津: "天津市", 上海: "上海市", 重庆: "重庆市",
      香港: "香港特别行政区", 澳门: "澳门特别行政区",
      内蒙古: "内蒙古自治区", 广西: "广西壮族自治区", 西藏: "西藏自治区",
      宁夏: "宁夏回族自治区", 新疆: "新疆维吾尔自治区", 台湾: "台湾省",
    };
    document.querySelector("#province-name").textContent = provinceDisplayNames[name] || `${name}省`;
    document.querySelector("#province-summary").textContent =
      name === "山西"
        ? "一段穿过古建、石窟与雨后红墙的夏末行程。"
        : `${name}的旅行档案将在此处按访问权限展示。`;
    showToast(`已切换到${name}省级视图原型`);
  });
});

const searchInput = document.querySelector("#search-input");
searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim();
  const results = document.querySelector("#search-results");
  if (!query) {
    results.innerHTML = "<span>⌕</span><p>输入关键词，检索你有权查看的内容。</p><small>私密旅行不会通过搜索结果泄露。</small>";
    return;
  }
  const match = Object.values(trips).find((trip) => trip.title.includes(query));
  results.innerHTML = match
    ? `<span>01</span><p>找到旅行：${match.title}</p><small>${match.date} · 权限校验通过的测试结果</small>`
    : `<span>00</span><p>暂未找到“${query}”</p><small>可尝试城市、标签或日期</small>`;
});

document.querySelector("#mock-upload").addEventListener("click", () => {
  showToast("上传后端尚未连接；视觉原型不会读取你的本地文件");
});

window.addEventListener("popstate", (event) => route(event.state?.route || location.hash.slice(1) || "home", false));

const initialRoute = location.hash.slice(1);
if (initialRoute && views.some((view) => view.dataset.view === initialRoute)) route(initialRoute, false);
applyCaptionColors();
renderTripTags();
