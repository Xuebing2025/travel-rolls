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
  storyMarkdown: "travel-rolls.story-markdown",
  storyVersions: "travel-rolls.story-versions",
};
const defaultTagColors = { 古建: "#d66f3e", 街景: "#55715e", 精选: "#9a6749", 游记: "#b44b34" };
const defaultTripTags = {
  "hong-kong": ["街景", "精选"],
  shanxi: ["古建", "街景", "精选"],
  hangzhou: ["风景", "精选"],
  dalian: ["海岸", "街景"],
  "text-roll": ["游记"],
};
const defaultStories = {
  "hong-kong": "# 香港蓝调时刻\n\n海港的风把城市灯光吹进水面。这是一篇可直接编辑的 Markdown 测试游记。\n\n> 照片替我们记住抵达之前和离开之后的光。\n\n- 维多利亚港\n- 中环街景\n- 夜间渡轮",
  shanxi: "# 从云冈的石壁，到雨后的红墙\n\n这是一篇用于验证排版的测试游记。编辑器支持标题、列表、引用、代码块与安全链接；原始 HTML 只会作为文字显示。\n\n> 旅行不是抵达一处地名，而是让时间在照片里重新获得形状。\n\n## 路线\n\n1. 大同 · 云冈与古建\n2. 太原 · 雨后红墙\n\n```text\n40.0768° N, 113.3001° E\n37.8706° N, 112.5489° E\n```",
  hangzhou: "# 春日杭州\n\n薄雾落在湖面，旅行从一段缓慢的步行开始。",
  dalian: "# 大连海岸\n\n沿海风景与城市街道构成这一卷的两条线索。",
  "text-roll": "# 北京 · TEXT ROLL\n\n这次旅行暂时没有公开照片，但文字仍然可以成为一卷完整的记录。",
};
let activeTripId = "shanxi";
let toastTimer;
let authUser = null;

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
const storyMarkdown = { ...defaultStories, ...readStoredObject(storageKeys.storyMarkdown, {}) };
const storyVersions = readStoredObject(storageKeys.storyVersions, {});
const appConfig = { ...(window.TRAVEL_ROLLS_CONFIG || {}) };
const apiBase = String(appConfig.apiBase || "").replace(/\/$/, "");

function persist(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function route(name, push = true) {
  if (name === "admin" && !authUser) {
    name = "login";
    showToast("请先使用受邀邮箱登录");
  }
  const target = views.find((view) => view.dataset.view === name) || views[0];
  views.forEach((view) => view.classList.toggle("active", view === target));
  document.querySelectorAll("nav button").forEach((button) => {
    button.setAttribute("aria-current", button.dataset.route === name ? "page" : "false");
  });
  if (push) history.pushState({ route: name }, "", `#${name}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "map") window.TravelRollsMap?.activate();
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
  renderStory(storyMarkdown[activeTripId] || "");
  closeStoryEditor();
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

function appendInlineMarkdown(parent, source) {
  const tokenPattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;
  let cursor = 0;
  for (const match of source.matchAll(tokenPattern)) {
    parent.append(document.createTextNode(source.slice(cursor, match.index)));
    const token = match[0];
    let element;
    if (token.startsWith("`")) {
      element = document.createElement("code");
      element.textContent = token.slice(1, -1);
    } else if (token.startsWith("**")) {
      element = document.createElement("strong");
      element.textContent = token.slice(2, -2);
    } else if (token.startsWith("*")) {
      element = document.createElement("em");
      element.textContent = token.slice(1, -1);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      element = document.createElement("a");
      element.textContent = linkMatch[1];
      element.href = linkMatch[2];
      element.target = "_blank";
      element.rel = "noopener noreferrer";
    }
    parent.append(element);
    cursor = match.index + token.length;
  }
  parent.append(document.createTextNode(source.slice(cursor)));
}

function renderMarkdown(source) {
  const fragment = document.createDocumentFragment();
  const lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      if (language) code.dataset.language = language;
      code.textContent = codeLines.join("\n");
      pre.append(code);
      fragment.append(pre);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const element = document.createElement(`h${heading[1].length}`);
      appendInlineMarkdown(element, heading[2]);
      fragment.append(element);
      index += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote = document.createElement("blockquote");
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      appendInlineMarkdown(quote, quoteLines.join("\n"));
      fragment.append(quote);
      continue;
    }
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[2]);
      const list = document.createElement(ordered ? "ol" : "ul");
      while (index < lines.length) {
        const itemMatch = lines[index].match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
        if (!itemMatch || /\d+\./.test(itemMatch[2]) !== ordered) break;
        const item = document.createElement("li");
        appendInlineMarkdown(item, itemMatch[3]);
        list.append(item);
        index += 1;
      }
      fragment.append(list);
      continue;
    }
    const paragraphLines = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,3})\s+|^>\s?|^```|^(\s*)([-*+]|\d+\.)\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    const paragraph = document.createElement("p");
    appendInlineMarkdown(paragraph, paragraphLines.join(" "));
    fragment.append(paragraph);
  }
  return fragment;
}

function renderStory(markdown) {
  const rendered = document.querySelector("#story-rendered");
  rendered.replaceChildren(renderMarkdown(markdown));
}

function closeStoryEditor() {
  const editor = document.querySelector("#story-editor");
  editor.hidden = true;
  document.querySelector("#story-edit-toggle").setAttribute("aria-expanded", "false");
}

function openStoryEditor() {
  const editor = document.querySelector("#story-editor");
  editor.hidden = false;
  document.querySelector("#story-edit-toggle").setAttribute("aria-expanded", "true");
  const textarea = document.querySelector("#story-markdown");
  textarea.value = storyMarkdown[activeTripId] || "";
  textarea.focus();
}

function setAuthStatus(message, kind = "") {
  const status = document.querySelector("#auth-status");
  status.textContent = message;
  status.dataset.kind = kind;
}

function updateAccountUI() {
  const accountButton = document.querySelector("#account-button");
  const label = document.querySelector("#account-label");
  const avatar = document.querySelector("#account-avatar");
  const signedIn = document.querySelector("#signed-in-user");
  if (authUser) {
    accountButton.dataset.route = "admin";
    label.textContent = authUser.nickname || "管理中心";
    avatar.textContent = (authUser.nickname || authUser.email || "R").slice(0, 1).toUpperCase();
    signedIn.textContent = `${authUser.email} · ${authUser.role}`;
  } else {
    accountButton.dataset.route = "login";
    label.textContent = "登录";
    avatar.textContent = "R";
    signedIn.textContent = "";
  }
}

async function apiRequest(path, options = {}) {
  if (!apiBase) throw new Error("service_not_configured");
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "request_failed");
    error.details = body;
    throw error;
  }
  return body;
}

const authMessages = {
  service_not_configured: "认证后端尚未部署；界面已完成，暂时无法发送真实验证码。",
  invalid_email: "请输入有效的邮箱地址。",
  rate_limited: "请求过于频繁，请稍后再试。",
  invalid_code: "验证码不正确、已过期或尝试次数已用尽。",
  invitation_required: "该邮箱尚未受到邀请。",
  account_frozen: "账户已被冻结，请联系管理员。",
  email_unavailable: "验证码邮件暂时无法发送，请稍后再试。",
  request_failed: "认证服务请求失败，请稍后再试。",
};

async function refreshSession() {
  if (!apiBase) {
    setAuthStatus(authMessages.service_not_configured, "notice");
    updateAccountUI();
    return;
  }
  try {
    const body = await apiRequest("/api/me", { method: "GET", headers: {} });
    authUser = body.user || null;
    setAuthStatus(authUser ? "登录状态有效。" : "请输入受邀邮箱获取验证码。", "ready");
  } catch {
    authUser = null;
    setAuthStatus("暂时无法连接认证服务。", "error");
  }
  updateAccountUI();
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

document.querySelector("#story-edit-toggle").addEventListener("click", () => {
  const editor = document.querySelector("#story-editor");
  if (editor.hidden) openStoryEditor();
  else closeStoryEditor();
});

document.querySelector("#story-preview").addEventListener("click", () => {
  renderStory(document.querySelector("#story-markdown").value);
  document.querySelector("#story-editor-status").textContent = "正在预览未保存内容。";
  showToast("已刷新 Markdown 预览");
});

document.querySelector("#story-cancel").addEventListener("click", () => {
  renderStory(storyMarkdown[activeTripId] || "");
  closeStoryEditor();
});

document.querySelector("#story-save").addEventListener("click", () => {
  const markdown = document.querySelector("#story-markdown").value.trim();
  if (!markdown) {
    showToast("游记正文不能为空");
    return;
  }
  storyMarkdown[activeTripId] = markdown;
  const versions = Array.isArray(storyVersions[activeTripId]) ? storyVersions[activeTripId] : [];
  storyVersions[activeTripId] = [{ savedAt: new Date().toISOString(), markdown }, ...versions].slice(0, 5);
  persist(storageKeys.storyMarkdown, storyMarkdown);
  persist(storageKeys.storyVersions, storyVersions);
  renderStory(markdown);
  closeStoryEditor();
  showToast(`游记已保存；本浏览器保留最近 ${storyVersions[activeTripId].length} 个版本`);
});

document.querySelector("#request-code-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.querySelector("#login-email").value.trim().toLowerCase();
  setAuthStatus("正在请求验证码…");
  try {
    await apiRequest("/api/auth/request-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    document.querySelector("#request-code-form").hidden = true;
    document.querySelector("#verify-code-form").hidden = false;
    document.querySelector("#verification-email").textContent = email;
    document.querySelector("#login-code").focus();
    setAuthStatus("若邮箱已受邀请，验证码已发送。", "ready");
  } catch (error) {
    setAuthStatus(authMessages[error.message] || authMessages.request_failed, "error");
  }
});

document.querySelector("#verify-code-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.querySelector("#verification-email").textContent;
  const code = document.querySelector("#login-code").value.trim();
  setAuthStatus("正在验证…");
  try {
    const body = await apiRequest("/api/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
    authUser = body.user;
    updateAccountUI();
    setAuthStatus("验证成功。", "ready");
    route("admin");
  } catch (error) {
    const suffix = Number.isInteger(error.details?.attemptsRemaining)
      ? `还可尝试 ${error.details.attemptsRemaining} 次。`
      : "";
    setAuthStatus(`${authMessages[error.message] || authMessages.request_failed}${suffix}`, "error");
  }
});

document.querySelector("#change-login-email").addEventListener("click", () => {
  document.querySelector("#verify-code-form").hidden = true;
  document.querySelector("#request-code-form").hidden = false;
  document.querySelector("#login-code").value = "";
  document.querySelector("#login-email").focus();
  setAuthStatus(apiBase ? "请输入受邀邮箱获取验证码。" : authMessages.service_not_configured, apiBase ? "" : "notice");
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await apiRequest("/api/auth/logout", { method: "POST", body: "{}" });
  } catch (error) {
    if (error.message !== "service_not_configured") {
      showToast("退出请求失败，请稍后重试");
      return;
    }
  }
  authUser = null;
  updateAccountUI();
  route("home");
  showToast("已退出登录");
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
  results.replaceChildren();
  const index = document.createElement("span");
  const message = document.createElement("p");
  const hint = document.createElement("small");
  if (!query) {
    index.textContent = "⌕";
    message.textContent = "输入关键词，检索你有权查看的内容。";
    hint.textContent = "私密旅行不会通过搜索结果泄露。";
    results.append(index, message, hint);
    return;
  }
  const match = Object.values(trips).find((trip) => trip.title.includes(query));
  index.textContent = match ? "01" : "00";
  message.textContent = match ? `找到旅行：${match.title}` : `暂未找到“${query}”`;
  hint.textContent = match ? `${match.date} · 权限校验通过的测试结果` : "可尝试城市、标签或日期";
  results.append(index, message, hint);
});

document.querySelector("#mock-upload").addEventListener("click", () => {
  showToast("上传后端尚未连接；视觉原型不会读取你的本地文件");
});

window.addEventListener("popstate", (event) => route(event.state?.route || location.hash.slice(1) || "home", false));

const initialRoute = location.hash.slice(1);
if (initialRoute && views.some((view) => view.dataset.view === initialRoute)) route(initialRoute, false);
applyCaptionColors();
renderTripTags();
renderStory(storyMarkdown[activeTripId]);
refreshSession();
