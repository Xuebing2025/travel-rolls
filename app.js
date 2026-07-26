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
const serverTripDetails = new Map();
const adminState = {
  loaded: false,
  loading: null,
  places: [],
  tags: [],
  trips: [],
  users: [],
  invitations: [],
  media: [],
  uploadQueue: [],
  activeMediaTripId: "",
  activeMediaPlaces: [],
  trash: { trips: [], media: [] },
};

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
  if (["admin", "favorites"].includes(name) && !authUser) {
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
  if (name === "favorites" && authUser) loadFavorites().catch((error) => showToast(apiErrorMessage(error)));
  if (name === "admin" && authUser) {
    loadAdminWorkspace().catch((error) => showToast(apiErrorMessage(error)));
  }
}

async function openTrip(id) {
  let trip = trips[id];
  if (!trip && apiBase) {
    try {
      const direct = new URLSearchParams(location.search);
      const share = direct.get("trip") === id ? direct.get("share") : "";
      const body = await apiRequest(`/api/trips/${encodeURIComponent(id)}${share ? `?share=${encodeURIComponent(share)}` : ""}`, { method: "GET", headers: {} });
      const record = body.trip;
      serverTripDetails.set(record.id, record);
      trip = {
        title: record.title,
        kicker: `TRAVEL ROLL · ${(record.places || []).map((place) => place.display_name).join(" — ") || "TEXT ROLL"}`,
        date: formatTripRange(record.start_date, record.end_date),
        image: record.cover_media_id ? `${apiBase}/api/media/${encodeURIComponent(record.cover_media_id)}/content` : "./assets/travel/taiyuan.webp",
      };
      trips[record.id] = trip;
      storyMarkdown[record.id] = record.markdown || "";
      tripTags[record.id] = (record.tags || []).map((tag) => tag.name);
      (record.tags || []).forEach((tag) => { tagColors[tag.name] = tag.color; });
    } catch (error) {
      showToast(apiErrorMessage(error));
      return;
    }
  }
  trip = trip || trips.shanxi;
  activeTripId = trips[id] ? id : "shanxi";
  document.querySelector("#trip-title").textContent = trip.title;
  document.querySelector("#trip-kicker").textContent = trip.kicker;
  document.querySelector("#trip-date").textContent = trip.date;
  const image = document.querySelector("#trip-hero-image");
  image.src = trip.image;
  image.alt = `${trip.title}旅行封面测试图`;
  const detail = serverTripDetails.get(activeTripId);
  document.querySelector("#story-edit-toggle").hidden = Boolean(detail && !detail.can_edit);
  document.querySelector("#tag-editor-toggle").hidden = Boolean(detail && !detail.can_edit);
  renderTripTags();
  renderStory(storyMarkdown[activeTripId] || "");
  if (detail) {
    renderTripCoordinates(detail.places || []);
    loadPublicGallery(detail.id).catch((error) => showToast(apiErrorMessage(error)));
  }
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
    const serverDetail = serverTripDetails.get(activeTripId);
    color.disabled = Boolean(serverDetail && authUser?.role !== "admin");
    color.setAttribute("aria-label", `更改${name}标签颜色`);
    color.addEventListener("change", async () => {
      tagColors[name] = color.value;
      persist(storageKeys.tagColors, tagColors);
      const detail = serverTripDetails.get(activeTripId);
      const tag = detail?.tags?.find((entry) => entry.name === name);
      if (tag && authUser?.role === "admin") {
        try {
          await apiRequest(`/api/tags/${encodeURIComponent(tag.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ color: color.value }),
          });
          tag.color = color.value;
        } catch (error) {
          showToast(apiErrorMessage(error));
        }
      }
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
      remove.addEventListener("click", async () => {
        const detail = serverTripDetails.get(activeTripId);
        if (detail) {
          try {
            const tagIds = detail.tags.filter((tag) => tag.name !== name).map((tag) => tag.id);
            const body = await apiRequest(`/api/trips/${encodeURIComponent(activeTripId)}`, {
              method: "PATCH",
              body: JSON.stringify({ tagIds }),
            });
            serverTripDetails.set(activeTripId, body.trip);
            tripTags[activeTripId] = body.trip.tags.map((tag) => tag.name);
          } catch (error) {
            showToast(apiErrorMessage(error));
            return;
          }
        } else {
          tripTags[activeTripId] = names.filter((tag) => tag !== name);
          persist(storageKeys.tripTags, tripTags);
        }
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
    const mediaImage = line.trim().match(/^!\[([^\]]*)\]\(media:([0-9a-z-]{8,80})\)$/i);
    if (mediaImage) {
      const figure = document.createElement("figure");
      figure.className = "story-media";
      const image = document.createElement("img");
      const direct = new URLSearchParams(location.search);
      const share = direct.get("trip") === activeTripId ? direct.get("share") : "";
      image.src = `${apiBase}/api/media/${encodeURIComponent(mediaImage[2])}/content${share ? `?share=${encodeURIComponent(share)}` : ""}`;
      image.alt = mediaImage[1] || "游记引用照片";
      image.loading = "lazy";
      figure.append(image);
      if (mediaImage[1]) {
        const caption = document.createElement("figcaption");
        caption.textContent = mediaImage[1];
        figure.append(caption);
      }
      fragment.append(figure);
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
  document.querySelector("#favorites-nav").hidden = !authUser;
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

const businessMessages = {
  authentication_required: "登录状态已失效，请重新登录。",
  forbidden: "当前账号无权执行此操作。",
  title_required: "请输入旅行名称。",
  invalid_date: "旅行日期格式不正确。",
  invalid_date_range: "结束日期不能早于开始日期。",
  invalid_place: "所选城市已失效，请刷新后重试。",
  invalid_tag: "所选标签已失效，请刷新后重试。",
  invalid_tag_update: "标签名称或颜色不正确。",
  invalid_invitation: "请输入有效邮箱并选择角色。",
  invitation_not_found: "邀请记录不存在。",
  invitation_already_accepted: "已接受的邀请不能撤销。",
  user_already_exists: "该邮箱已经注册。",
  cannot_disable_self: "不能冻结自己或移除自己的管理员角色。",
  last_admin_required: "系统至少需要保留一名有效管理员。",
  trip_not_found: "旅行不存在或已进入回收站。",
  version_not_found: "该游记版本已不存在。",
  tag_exists: "已有同名标签。",
  system_tag_immutable: "系统标签不可删除或改名。",
  tag_in_use: "该标签仍被旅行或照片使用，不能删除。",
  unsupported_media: "仅支持 JPG、PNG 与 MP4，或文件超过大小限制。",
  city_limit_reached: "该城市全站已达到 500 张媒体上限。",
  storage_limit_reached: "对象存储已达到 9GB 硬上限，已停止上传。",
  exact_duplicate: "检测到你已经上传过内容完全相同的文件。",
  upload_not_found: "续传记录已过期，请移除该项目后重新选择文件。",
  size_mismatch: "上传后的文件大小校验失败，请重试。",
  resume_target_changed: "续传文件原先属于另一旅行或城市，请清空队列后重新选择。",
  media_not_found: "媒体不存在或已被永久删除。",
  media_referenced_by_story: "该图片被游记引用，删除前需要再次确认。",
  place_not_in_trip: "目标城市尚未加入本次旅行。",
  privacy_safe_download_pending: "他人上传的原图需先生成隐私脱敏副本，当前暂不能下载。",
  preview_processing: "网页预览文件仍在处理中。",
  video_watermark_unsupported: "视频水印暂不支持；可直接下载视频。",
};

function apiErrorMessage(error) {
  return businessMessages[error?.message] || authMessages[error?.message] || "操作失败，请稍后重试。";
}

async function loadFavorites() {
  const body = await apiRequest("/api/favorites", { method: "GET", headers: {} });
  const container = document.querySelector("#favorite-library");
  container.replaceChildren();
  if (!body.media?.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "还没有收藏照片。你可以在任意照片下点击“收藏”。";
    container.append(empty);
    return;
  }
  body.media.forEach((media) => {
    const card = document.createElement("article");
    const image = document.createElement(media.kind === "video" ? "video" : "img");
    image.src = `${apiBase}${media.content_url}`;
    image.alt = media.description || media.original_filename;
    image.loading = "lazy";
    if (media.kind === "video") image.controls = true;
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = media.description || media.original_filename;
    const meta = document.createElement("small");
    meta.textContent = `${media.trip_title} · ${media.place_name} · ${media.captured_at?.slice(0, 10) || "时间待完善"}`;
    const open = document.createElement("button");
    open.type = "button";
    open.className = "text-button";
    open.dataset.openTrip = media.trip_id;
    open.textContent = "打开旅行";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button";
    remove.dataset.favoriteMedia = media.id;
    remove.textContent = "取消收藏";
    copy.append(title, meta, open, remove);
    card.append(image, copy);
    container.append(card);
  });
}

function renderTripCoordinates(places) {
  const list = document.querySelector(".trip-body > aside dl");
  list.replaceChildren();
  places.forEach((place) => {
    const row = document.createElement("div");
    const name = document.createElement("dt");
    name.textContent = place.display_name || place.official_name;
    const center = document.createElement("dd");
    center.append(
      document.createTextNode(`${Number(place.center_lat).toFixed(4)}° N`),
      document.createElement("br"),
      document.createTextNode(`${Number(place.center_lng).toFixed(4)}° E`)
    );
    row.append(name, center);
    list.append(row);
  });
}

async function loadPublicGallery(tripId, sort = "manual") {
  const direct = new URLSearchParams(location.search);
  const share = direct.get("trip") === tripId ? direct.get("share") : "";
  const params = new URLSearchParams({ sort });
  if (share) params.set("share", share);
  const body = await apiRequest(`/api/trips/${encodeURIComponent(tripId)}/media?${params}`, {
    method: "GET",
    headers: {},
  });
  renderPublicGallery(body.media || []);
}

function renderPublicGallery(mediaItems) {
  const gallery = document.querySelector("#trip-gallery");
  gallery.replaceChildren();
  document.querySelector("#gallery-count").textContent = `${mediaItems.length} FRAMES`;
  if (!mediaItems.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "本卷暂未公开照片。";
    gallery.append(empty);
    return;
  }
  mediaItems.forEach((media, position) => {
    const figure = document.createElement("figure");
    figure.dataset.publicMedia = media.id;
    if (position % 7 === 0) figure.className = "wide";
    const visual = document.createElement(media.kind === "video" ? "video" : "img");
    const direct = new URLSearchParams(location.search);
    const share = direct.get("trip") === activeTripId ? direct.get("share") : "";
    visual.src = `${apiBase}${media.content_url}${share ? `?share=${encodeURIComponent(share)}` : ""}`;
    visual.alt = media.description || `${media.place_name}旅行照片`;
    visual.loading = "lazy";
    if (media.kind === "video") visual.controls = true;
    const caption = document.createElement("figcaption");
    const copy = document.createElement("span");
    copy.textContent = media.description || `${media.place_name} · ${media.captured_at?.slice(0, 10) || "时间待完善"}`;
    const actions = document.createElement("span");
    const like = document.createElement("button");
    like.type = "button";
    like.dataset.likeMedia = media.id;
    like.textContent = `${media.liked ? "♥" : "♡"} ${media.like_count || 0}`;
    like.disabled = !authUser;
    like.title = authUser ? "点赞这张照片" : "登录后可以点赞";
    const favorite = document.createElement("button");
    favorite.type = "button";
    favorite.dataset.favoriteMedia = media.id;
    favorite.textContent = media.favorited ? "★ 已收藏" : "☆ 收藏";
    favorite.disabled = !authUser;
    favorite.title = authUser ? "加入私人收藏" : "登录后可以收藏";
    actions.append(like, favorite);
    if (authUser) {
      const download = document.createElement("button");
      download.type = "button";
      download.dataset.downloadMedia = media.id;
      download.dataset.mediaKind = media.kind;
      download.textContent = "↓ 下载";
      const watermark = document.createElement("button");
      watermark.type = "button";
      watermark.dataset.downloadMedia = media.id;
      watermark.dataset.mediaKind = media.kind;
      watermark.dataset.watermark = "1";
      watermark.textContent = "↓ 水印";
      actions.append(download, watermark);
    }
    caption.append(copy, actions);
    figure.append(visual, caption);
    gallery.append(figure);
  });
}

async function downloadMedia(mediaId, withWatermark, kind) {
  if (withWatermark && kind !== "image") throw new Error("video_watermark_unsupported");
  const direct = new URLSearchParams(location.search);
  const share = direct.get("trip") === activeTripId ? direct.get("share") : "";
  const params = new URLSearchParams({ download: "1" });
  if (share) params.set("share", share);
  const response = await fetch(`${apiBase}/api/media/${encodeURIComponent(mediaId)}/content?${params}`, {
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "request_failed");
  }
  let blob = await response.blob();
  let extension = kind === "video" ? "mp4" : "jpg";
  if (withWatermark) {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const fontSize = Math.max(18, Math.round(Math.min(canvas.width, canvas.height) * 0.025));
    context.font = `600 ${fontSize}px sans-serif`;
    context.textAlign = "right";
    context.textBaseline = "bottom";
    context.fillStyle = "rgba(0,0,0,.55)";
    context.fillRect(0, canvas.height - fontSize * 2.4, canvas.width, fontSize * 2.4);
    context.fillStyle = "rgba(255,255,255,.9)";
    context.fillText("TRAVEL ROLLS", canvas.width - fontSize, canvas.height - fontSize * 0.65);
    blob = await new Promise((resolve, reject) =>
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("watermark_failed")), "image/jpeg", 0.92)
    );
    extension = "watermarked.jpg";
  }
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `travel-rolls-${mediaId}.${extension}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function formatTripRange(start, end) {
  if (!start && !end) return "DATE TO BE LOGGED";
  if (!end || start === end) return start || end;
  return `${start}—${end}`;
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = -1;
  do {
    size /= 1024;
    unit += 1;
  } while (size >= 1024 && unit < units.length - 1);
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unit]}`;
}

function formatMoment(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(Number(value)));
}

function setAdminTab(name) {
  if (name === "people" && authUser?.role !== "admin") name = "trips";
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTab === name);
  });
  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    const active = panel.dataset.adminPanel === name;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}

function setFormStatus(selector, message, kind = "") {
  const element = document.querySelector(selector);
  if (!element) return;
  element.textContent = message;
  element.dataset.kind = kind;
}

async function loadAdminWorkspace(force = false) {
  if (!authUser || !["editor", "admin"].includes(authUser.role)) {
    setAdminTab("overview");
    document.querySelector("#new-trip-button").hidden = true;
    document.querySelectorAll("[data-admin-only]").forEach((element) => { element.hidden = true; });
    throw new Error("forbidden");
  }
  document.querySelector("#new-trip-button").hidden = false;
  document.querySelectorAll("[data-admin-only]").forEach((element) => {
    element.hidden = authUser.role !== "admin";
  });
  if (adminState.loaded && !force) return;
  if (adminState.loading) return adminState.loading;
  adminState.loading = (async () => {
    const common = await Promise.all([
      apiRequest("/api/places", { method: "GET", headers: {} }),
      apiRequest("/api/tags", { method: "GET", headers: {} }),
      apiRequest("/api/trips?scope=manage", { method: "GET", headers: {} }),
      apiRequest("/api/trash", { method: "GET", headers: {} }),
    ]);
    adminState.places = common[0].places || [];
    adminState.tags = common[1].tags || [];
    adminState.trips = common[2].trips || [];
    adminState.trash = common[3] || { trips: [], media: [] };
    renderPlaceOptions();
    renderGlobalTags();
    renderTripTagChoices();
    renderManagedTrips();
    renderMediaTripOptions();
    renderTrash();
    if (authUser.role === "admin") {
      const admin = await Promise.all([
        apiRequest("/api/admin/overview", { method: "GET", headers: {} }),
        apiRequest("/api/admin/users", { method: "GET", headers: {} }),
        apiRequest("/api/admin/invitations", { method: "GET", headers: {} }),
        apiRequest("/api/admin/audit", { method: "GET", headers: {} }),
      ]);
      renderAdminOverview(admin[0].overview || {});
      adminState.users = admin[1].users || [];
      adminState.invitations = admin[2].invitations || [];
      renderUsers();
      renderInvitations();
      renderAudit(admin[3].logs || []);
    } else {
      setAdminTab("trips");
    }
    adminState.loaded = true;
  })().finally(() => { adminState.loading = null; });
  return adminState.loading;
}

function renderAdminOverview(overview) {
  const softLimit = Number(overview.storageSoftLimitBytes || 1);
  const storageBytes = Number(overview.storageBytes || 0);
  document.querySelector("#storage-usage").textContent = formatBytes(storageBytes);
  document.querySelector("#storage-usage-bar").style.width = `${Math.min(100, storageBytes / softLimit * 100)}%`;
  document.querySelector("#storage-usage-note").textContent =
    `建议上限 ${formatBytes(softLimit)} · 上传预占 ${formatBytes(overview.storageReservedBytes || 0)} · 更新 ${formatMoment(overview.storageUpdatedAt)}`;
  document.querySelector("#content-count").textContent = `${overview.trips || 0} 卷 / ${overview.media || 0} 张`;
  document.querySelector("#content-count-bar").style.width =
    `${Math.min(100, Number(overview.media || 0) / 5000 * 100)}%`;
  document.querySelector("#content-count-note").textContent =
    `${overview.users || 0} 个账户 · ${overview.pendingInvitations || 0} 个待接受邀请`;
  document.querySelector("#pending-count").textContent = String(overview.pendingMedia || 0);
  document.querySelector("#pending-count-bar").style.width =
    `${Math.min(100, Number(overview.pendingMedia || 0) / 20 * 100)}%`;
  document.querySelector("#pending-count-note").textContent =
    overview.pendingMedia ? "含处理失败或拍摄时间待完善的媒体" : "当前没有待完善媒体";
}

function renderPlaceOptions(selectedIds = []) {
  const select = document.querySelector("#trip-form-places");
  const selected = new Set(selectedIds);
  select.replaceChildren();
  adminState.places.forEach((place) => {
    const option = document.createElement("option");
    option.value = place.id;
    option.textContent = `${place.display_name || place.official_name} · ${place.city_code}`;
    option.selected = selected.has(place.id);
    select.append(option);
  });
}

function renderTripTagChoices(selectedIds = []) {
  const container = document.querySelector("#trip-form-tags");
  const selected = new Set(selectedIds);
  container.replaceChildren();
  if (!adminState.tags.length) {
    const empty = document.createElement("small");
    empty.textContent = "尚无全站标签，可先在“全站标签”中新建。";
    container.append(empty);
    return;
  }
  adminState.tags.forEach((tag) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = tag.id;
    input.checked = selected.has(tag.id);
    const chip = document.createElement("span");
    chip.textContent = tag.name;
    chip.style.setProperty("--tag-color", tag.color);
    label.append(input, chip);
    container.append(label);
  });
}

function renderManagedTrips() {
  const list = document.querySelector("#admin-trip-list");
  const head = list.querySelector(".table-head");
  list.replaceChildren(head);
  if (!adminState.trips.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "尚未创建旅行。";
    list.append(empty);
    return;
  }
  adminState.trips.forEach((trip) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "table-row";
    button.dataset.editTrip = trip.id;
    [
      trip.title,
      trip.status === "published" ? "已发布" : "草稿",
      { public: "公开", link: "持链接", private: "私密" }[trip.visibility] || trip.visibility,
      String(trip.media_count || 0),
      formatMoment(trip.updated_at),
    ].forEach((text) => {
      const span = document.createElement("span");
      span.textContent = text;
      button.append(span);
    });
    list.append(button);
  });
}

function renderMediaTripOptions() {
  const select = document.querySelector("#media-trip");
  const current = select.value || adminState.activeMediaTripId;
  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "请选择旅行";
  select.append(placeholder);
  adminState.trips.forEach((trip) => {
    const option = document.createElement("option");
    option.value = trip.id;
    option.textContent = trip.title;
    option.selected = trip.id === current;
    select.append(option);
  });
}

function resetTripForm() {
  document.querySelector("#trip-form").reset();
  document.querySelector("#trip-form-id").value = "";
  document.querySelector("#trip-form-title").textContent = "新建旅行";
  document.querySelector("#trip-form-visibility").value = "private";
  document.querySelector("#trip-form-status").value = "draft";
  document.querySelector("#trip-delete-button").hidden = true;
  document.querySelector("#trip-share-button").hidden = true;
  document.querySelector("#trip-form-cover").replaceChildren(new Option("创建旅行并上传照片后再选择", ""));
  document.querySelector("#trip-version-list").replaceChildren();
  renderPlaceOptions();
  renderTripTagChoices();
  setFormStatus("#trip-form-status-message", "");
}

async function editManagedTrip(id) {
  setAdminTab("trips");
  setFormStatus("#trip-form-status-message", "正在读取旅行…");
  try {
    const body = await apiRequest(`/api/trips/${encodeURIComponent(id)}`, { method: "GET", headers: {} });
    const trip = body.trip;
    document.querySelector("#trip-form-id").value = trip.id;
    document.querySelector("#trip-form-title").textContent = `编辑 · ${trip.title}`;
    document.querySelector("#trip-form-name").value = trip.title || "";
    document.querySelector("#trip-form-subtitle").value = trip.subtitle || "";
    document.querySelector("#trip-form-start").value = trip.start_date || "";
    document.querySelector("#trip-form-end").value = trip.end_date || "";
    document.querySelector("#trip-form-visibility").value = trip.visibility;
    document.querySelector("#trip-form-status").value = trip.status;
    document.querySelector("#trip-form-date-source").value = trip.date_source || "auto";
    document.querySelector("#trip-form-markdown").value = trip.markdown || "";
    document.querySelector("#trip-form-cover-side").value = trip.cover_text_side || "right";
    document.querySelector("#trip-form-cover-tone").value = trip.cover_text_tone || "";
    document.querySelector("#trip-form-focus-x").value = trip.cover_focus_x ?? 0.5;
    document.querySelector("#trip-form-focus-y").value = trip.cover_focus_y ?? 0.5;
    document.querySelector("#trip-delete-button").hidden = false;
    document.querySelector("#trip-share-button").hidden = trip.visibility !== "link";
    renderPlaceOptions((trip.places || []).map((place) => place.id));
    renderTripTagChoices((trip.tags || []).map((tag) => tag.id));
    setFormStatus("#trip-form-status-message", `作者：${trip.author_name} · 最近更新 ${formatMoment(trip.updated_at)}`, "ready");
    await Promise.all([loadTripVersions(trip.id), loadTripCoverOptions(trip.id, trip.cover_media_id)]);
    document.querySelector("#trip-form-name").focus();
  } catch (error) {
    setFormStatus("#trip-form-status-message", apiErrorMessage(error), "error");
  }
}

async function loadTripCoverOptions(tripId, selectedId = "") {
  const select = document.querySelector("#trip-form-cover");
  select.replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "黑色 TEXT ROLL 占位";
  select.append(empty);
  const body = await apiRequest(`/api/trips/${encodeURIComponent(tripId)}/media`, { method: "GET", headers: {} });
  body.media.filter((media) => media.kind === "image" && media.status === "ready").forEach((media) => {
    const option = document.createElement("option");
    option.value = media.id;
    option.textContent = `${media.original_filename} · ${media.place_name}`;
    option.selected = media.id === selectedId;
    select.append(option);
  });
}

async function loadTripVersions(id) {
  const container = document.querySelector("#trip-version-list");
  const body = await apiRequest(`/api/trips/${encodeURIComponent(id)}/versions`, { method: "GET", headers: {} });
  container.replaceChildren();
  if (!body.versions?.length) {
    const empty = document.createElement("small");
    empty.textContent = "修改标题或正文后，系统会在这里保留最近 5 个旧版本。";
    container.append(empty);
    return;
  }
  const heading = document.createElement("strong");
  heading.textContent = "最近版本";
  container.append(heading);
  body.versions.forEach((version) => {
    const row = document.createElement("div");
    const text = document.createElement("span");
    text.textContent = `${version.title} · ${formatMoment(version.created_at)} · ${version.created_by_name}`;
    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "text-button";
    restore.dataset.restoreVersion = version.id;
    restore.textContent = "恢复";
    row.append(text, restore);
    container.append(row);
  });
}

async function refreshSession() {
  if (!apiBase) {
    setAuthStatus(authMessages.service_not_configured, "notice");
    updateAccountUI();
    return;
  }
  try {
    const body = await apiRequest("/api/me", { method: "GET", headers: {} });
    authUser = body.user || null;
    adminState.loaded = false;
    setAuthStatus(authUser ? "登录状态有效。" : "请输入受邀邮箱获取验证码。", "ready");
  } catch {
    authUser = null;
    setAuthStatus("暂时无法连接认证服务。", "error");
  }
  updateAccountUI();
  loadPublicContent().catch(() => {});
  if (authUser && location.hash === "#admin") route("admin", false);
  const direct = new URLSearchParams(location.search);
  if (direct.get("trip")) openTrip(direct.get("trip"));
}

async function loadPublicContent() {
  if (!apiBase) return;
  const [body, settingsBody] = await Promise.all([
    apiRequest("/api/trips", { method: "GET", headers: {} }),
    apiRequest("/api/settings", { method: "GET", headers: {} }),
  ]);
  const records = body.trips || [];
  if (settingsBody.settings?.subtitle) {
    document.querySelector(".home-copy .subtitle").textContent = settingsBody.settings.subtitle;
    document.querySelector("#site-subtitle").value = settingsBody.settings.subtitle;
  }
  renderArchiveRecords(records);
  renderHomeRecords(records.slice(0, 5));
}

function renderArchiveRecords(records) {
  const list = document.querySelector(".archive-list");
  list.replaceChildren();
  if (!records.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "当前访问权限下暂无已发布旅行。";
    list.append(empty);
    return;
  }
  records.forEach((trip) => {
    const button = document.createElement("button");
    button.dataset.openTrip = trip.id;
    const year = document.createElement("time");
    year.textContent = trip.start_date?.slice(0, 4) || "—";
    const dates = document.createElement("span");
    dates.textContent = formatTripRange(trip.start_date, trip.end_date).replace(/^\d{4}-/g, "");
    const title = document.createElement("strong");
    title.textContent = trip.title;
    const count = document.createElement("em");
    count.textContent = trip.media_count ? `${trip.media_count} FRAMES` : "TEXT ROLL";
    button.append(year, dates, title, count);
    list.append(button);
  });
}

function renderHomeRecords(records) {
  const index = document.querySelector(".roll-index");
  const head = index.querySelector(".index-head");
  index.replaceChildren(head);
  const stage = document.querySelector(".roll-stage");
  const stageMeta = stage.querySelector(".stage-meta");
  const stageFooter = stage.querySelector(".stage-footer");
  stage.querySelectorAll(".film-strip").forEach((strip) => strip.remove());
  for (let position = 0; position < 5; position += 1) {
    const trip = records[position];
    const row = document.createElement("button");
    if (trip) row.dataset.openTrip = trip.id;
    else row.disabled = true;
    const number = document.createElement("span");
    number.textContent = String(position + 1).padStart(2, "0");
    const time = document.createElement("time");
    time.textContent = trip?.start_date?.slice(0, 7).replace("-", ".") || "—";
    const title = document.createElement("strong");
    title.textContent = trip?.title || "ROLL NOT EXPOSED";
    row.append(number, time, title);
    index.append(row);

    const strip = document.createElement("article");
    strip.className = `film-strip${trip?.cover_media_id ? "" : " text-roll"}`;
    strip.style.setProperty("--i", position);
    if (trip) strip.dataset.openTrip = trip.id;
    const caption = document.createElement("p");
    if (trip?.cover_text_side === "left") caption.classList.add("caption-left");
    if (trip?.cover_text_tone === "light") caption.classList.add("caption-white");
    if (trip?.cover_text_tone === "dark") caption.classList.add("caption-black");
    const name = document.createElement("strong");
    name.textContent = trip?.title || "ROLL NOT EXPOSED";
    const date = document.createElement("time");
    date.textContent = trip ? formatTripRange(trip.start_date, trip.end_date) : "COORDS TO BE LOGGED";
    const emptyLabel = document.createElement("em");
    emptyLabel.textContent = trip ? `TEXT ROLL · NO. ${String(position + 1).padStart(3, "0")}` : "ROLL NOT EXPOSED";
    caption.append(name, date, emptyLabel);
    if (trip?.cover_media_id) {
      const image = document.createElement("img");
      image.src = `${apiBase}/api/media/${encodeURIComponent(trip.cover_media_id)}/content`;
      image.alt = `${trip.title}旅行封面`;
      image.style.objectPosition = `${Number(trip.cover_focus_x ?? 0.5) * 100}% ${Number(trip.cover_focus_y ?? 0.5) * 100}%`;
      const shade = document.createElement("span");
      shade.className = "shade";
      strip.append(image, shade);
    }
    strip.append(caption);
    if (trip && authUser && ["editor", "admin"].includes(authUser.role)) {
      captionColors[trip.id] = trip.cover_text_tone === "light" ? "white" : trip.cover_text_tone === "dark" ? "black" : "auto";
      const control = document.createElement("button");
      control.type = "button";
      control.className = "caption-color-control";
      control.dataset.captionColor = trip.id;
      control.dataset.serverCaption = trip.id;
      control.textContent = "字色 · 自动";
      strip.append(control);
    }
    stage.insertBefore(strip, stageFooter);
  }
  const tripsCount = document.querySelector(".stats dd");
  if (tripsCount) tripsCount.textContent = String(records.length).padStart(2, "0");
  stageMeta.firstElementChild.textContent = "ROLLS 01—05";
  stageFooter.firstElementChild.textContent = `${records.length} ROLLS`;
  applyCaptionColors();
}

function renderGlobalTags() {
  const list = document.querySelector("#global-tag-list");
  list.replaceChildren();
  if (!adminState.tags.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "尚无标签。标签颜色会在所有城市和旅行中通用。";
    list.append(empty);
    return;
  }
  adminState.tags.forEach((tag) => {
    const row = document.createElement("div");
    row.className = "management-item";
    const color = document.createElement("input");
    color.type = "color";
    color.value = tag.color;
    color.disabled = authUser?.role !== "admin" || Boolean(tag.is_system);
    color.setAttribute("aria-label", `${tag.name}标签颜色`);
    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = tag.name;
    const meta = document.createElement("small");
    meta.textContent = `${tag.is_system ? "系统标签 · " : ""}${tag.trip_count || 0} 次旅行 · ${tag.media_count || 0} 张照片`;
    details.append(name, meta);
    const actions = document.createElement("div");
    if (authUser?.role === "admin" && !tag.is_system) {
      const save = document.createElement("button");
      save.type = "button";
      save.className = "text-button";
      save.dataset.saveTag = tag.id;
      save.textContent = "保存颜色";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "text-button danger";
      remove.dataset.deleteTag = tag.id;
      remove.textContent = "删除";
      actions.append(save, remove);
    }
    row.dataset.tagId = tag.id;
    row.append(color, details, actions);
    list.append(row);
  });
}

function renderUsers() {
  const list = document.querySelector("#user-list");
  list.replaceChildren();
  adminState.users.forEach((user) => {
    const row = document.createElement("div");
    row.className = "management-item stacked";
    row.dataset.userId = user.id;
    const identity = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = user.nickname;
    const email = document.createElement("small");
    email.textContent = `${user.email} · ${user.trip_count || 0} 次旅行`;
    identity.append(name, email);
    const controls = document.createElement("div");
    const role = document.createElement("select");
    role.dataset.userRole = "";
    [["visitor", "访客"], ["editor", "编辑者"], ["admin", "管理员"]].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = user.role === value;
      role.append(option);
    });
    const status = document.createElement("select");
    status.dataset.userStatus = "";
    [["active", "正常"], ["frozen", "冻结"]].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = user.status === value;
      status.append(option);
    });
    const save = document.createElement("button");
    save.type = "button";
    save.className = "outline-button";
    save.dataset.saveUser = user.id;
    save.textContent = "保存";
    if (user.id === authUser?.id) {
      role.disabled = true;
      status.disabled = true;
      save.disabled = true;
      save.title = "当前登录账号不能修改自己的角色或状态";
    }
    controls.append(role, status, save);
    row.append(identity, controls);
    list.append(row);
  });
}

function renderInvitations() {
  const list = document.querySelector("#invitation-list");
  list.replaceChildren();
  if (!adminState.invitations.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "尚无邀请记录。";
    list.append(empty);
    return;
  }
  adminState.invitations.forEach((invitation) => {
    const row = document.createElement("div");
    row.className = "management-item";
    const details = document.createElement("div");
    const email = document.createElement("strong");
    email.textContent = invitation.email;
    const state = invitation.accepted_at ? "已接受" : invitation.revoked_at ? "已撤销" : "待接受";
    const meta = document.createElement("small");
    meta.textContent = `${invitation.role} · ${state} · ${formatMoment(invitation.created_at)}`;
    details.append(email, meta);
    const action = document.createElement("button");
    action.type = "button";
    action.className = "text-button";
    action.dataset.revokeInvitation = invitation.id;
    action.textContent = "撤销";
    action.disabled = Boolean(invitation.accepted_at || invitation.revoked_at);
    row.append(details, action);
    list.append(row);
  });
}

function renderAudit(logs) {
  const list = document.querySelector("#audit-list");
  list.replaceChildren();
  if (!logs.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "尚无操作记录。";
    list.append(empty);
    return;
  }
  logs.forEach((log) => {
    const row = document.createElement("div");
    row.className = "management-item";
    const action = document.createElement("strong");
    action.textContent = log.action;
    const target = document.createElement("span");
    target.textContent = `${log.target_type}${log.target_id ? ` · ${log.target_id}` : ""}`;
    const actor = document.createElement("small");
    actor.textContent = `${log.actor_name || "系统"} · ${formatMoment(log.created_at)}`;
    row.append(action, target, actor);
    list.append(row);
  });
}

function renderTrash() {
  const list = document.querySelector("#trash-list");
  list.replaceChildren();
  const entries = [
    ...(adminState.trash.trips || []).map((entry) => ({ ...entry, type: "trip", label: entry.title })),
    ...(adminState.trash.media || []).map((entry) => ({ ...entry, type: "media", label: entry.original_filename })),
  ];
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "回收站为空。";
    list.append(empty);
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "management-item";
    const label = document.createElement("strong");
    label.textContent = entry.label;
    const meta = document.createElement("small");
    meta.textContent = `${entry.type === "trip" ? "旅行" : `媒体 · ${entry.trip_title}`} · 将于 ${formatMoment(entry.purge_after)} 永久删除`;
    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "outline-button";
    restore.dataset.restoreTrash = entry.id;
    restore.dataset.trashType = entry.type;
    restore.textContent = "恢复";
    row.append(label, meta, restore);
    list.append(row);
  });
}

async function reloadTrash() {
  adminState.trash = await apiRequest("/api/trash", { method: "GET", headers: {} });
  renderTrash();
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
    if (colorButton.dataset.serverCaption) {
      const tone = captionColors[id] === "white" ? "light" : captionColors[id] === "black" ? "dark" : null;
      apiRequest(`/api/trips/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ coverTextTone: tone }),
      }).catch((error) => showToast(apiErrorMessage(error)));
    }
    return;
  }

  const routeButton = event.target.closest("[data-route]");
  if (routeButton) route(routeButton.dataset.route);

  const tripButton = event.target.closest("[data-open-trip]");
  if (tripButton) openTrip(tripButton.dataset.openTrip);
});

document.addEventListener("click", async (event) => {
  const tab = event.target.closest("[data-admin-tab]");
  if (tab) {
    setAdminTab(tab.dataset.adminTab);
    return;
  }
  const editTrip = event.target.closest("[data-edit-trip]");
  if (editTrip) {
    await editManagedTrip(editTrip.dataset.editTrip);
    return;
  }
  const restore = event.target.closest("[data-restore-version]");
  if (restore) {
    const tripId = document.querySelector("#trip-form-id").value;
    if (!tripId || !confirm("恢复这个版本？当前标题和正文会先作为一个旧版本保留。")) return;
    restore.disabled = true;
    try {
      await apiRequest(`/api/trips/${encodeURIComponent(tripId)}/versions/${encodeURIComponent(restore.dataset.restoreVersion)}/restore`, {
        method: "POST",
        body: "{}",
      });
      await Promise.all([editManagedTrip(tripId), reloadManagedTrips()]);
      showToast("已恢复所选游记版本");
    } catch (error) {
      showToast(apiErrorMessage(error));
    } finally {
      restore.disabled = false;
    }
    return;
  }
  const revoke = event.target.closest("[data-revoke-invitation]");
  if (revoke) {
    if (!confirm("撤销这份邀请？该邮箱之后将无法用它注册。")) return;
    try {
      await apiRequest(`/api/admin/invitations/${encodeURIComponent(revoke.dataset.revokeInvitation)}`, {
        method: "DELETE",
      });
      await reloadPeople();
      showToast("邀请已撤销");
    } catch (error) {
      showToast(apiErrorMessage(error));
    }
    return;
  }
  const saveUser = event.target.closest("[data-save-user]");
  if (saveUser) {
    const row = saveUser.closest("[data-user-id]");
    saveUser.disabled = true;
    try {
      await apiRequest(`/api/admin/users/${encodeURIComponent(saveUser.dataset.saveUser)}`, {
        method: "PATCH",
        body: JSON.stringify({
          role: row.querySelector("[data-user-role]").value,
          status: row.querySelector("[data-user-status]").value,
        }),
      });
      await reloadPeople();
      showToast("账户权限已更新");
    } catch (error) {
      showToast(apiErrorMessage(error));
    } finally {
      saveUser.disabled = false;
    }
    return;
  }
  const saveTag = event.target.closest("[data-save-tag]");
  if (saveTag) {
    const row = saveTag.closest("[data-tag-id]");
    saveTag.disabled = true;
    try {
      await apiRequest(`/api/tags/${encodeURIComponent(saveTag.dataset.saveTag)}`, {
        method: "PATCH",
        body: JSON.stringify({ color: row.querySelector('input[type="color"]').value }),
      });
      await reloadTags();
      showToast("标签颜色已在全站更新");
    } catch (error) {
      showToast(apiErrorMessage(error));
    } finally {
      saveTag.disabled = false;
    }
    return;
  }
  const deleteTag = event.target.closest("[data-delete-tag]");
  if (deleteTag) {
    if (!confirm("删除这个全站标签？已被使用的标签不会被允许删除。")) return;
    try {
      await apiRequest(`/api/tags/${encodeURIComponent(deleteTag.dataset.deleteTag)}`, { method: "DELETE" });
      await reloadTags();
      showToast("标签已删除");
    } catch (error) {
      showToast(apiErrorMessage(error));
    }
    return;
  }
  const removeUpload = event.target.closest("[data-remove-upload]");
  if (removeUpload) {
    adminState.uploadQueue = adminState.uploadQueue.filter((item) => item.id !== removeUpload.dataset.removeUpload);
    renderUploadQueue();
    return;
  }
  const saveMedia = event.target.closest("[data-save-media]");
  if (saveMedia) {
    const card = saveMedia.closest("[data-media-id]");
    const localTime = card.querySelector("[data-media-captured]").value;
    saveMedia.disabled = true;
    try {
      await apiRequest(`/api/media/${encodeURIComponent(saveMedia.dataset.saveMedia)}`, {
        method: "PATCH",
        body: JSON.stringify({
          description: card.querySelector("[data-media-description]").value,
          capturedAt: localTime ? new Date(localTime).toISOString() : null,
          dateStatus: localTime ? "corrected" : "pending",
          placeId: card.querySelector("[data-media-place]").value,
          tagIds: [...card.querySelectorAll(".media-tag-choices input:checked")].map((input) => input.value),
        }),
      });
      await Promise.all([reloadMediaLibrary(), reloadManagedTrips()]);
      showToast("媒体说明与拍摄时间已保存");
    } catch (error) {
      showToast(apiErrorMessage(error));
    } finally {
      saveMedia.disabled = false;
    }
    return;
  }
  const copyMediaReference = event.target.closest("[data-copy-media-reference]");
  if (copyMediaReference) {
    const syntax = `![${copyMediaReference.dataset.mediaAlt}](${`media:${copyMediaReference.dataset.copyMediaReference}`})`;
    try {
      await navigator.clipboard.writeText(syntax);
      showToast("Markdown 图片引用已复制；保存游记后会自动添加“游记”标签");
    } catch {
      showToast(syntax);
    }
    return;
  }
  const viewLikes = event.target.closest("[data-view-likes]");
  if (viewLikes) {
    try {
      const body = await apiRequest(`/api/media/${encodeURIComponent(viewLikes.dataset.viewLikes)}/likes`, {
        method: "GET",
        headers: {},
      });
      const dialog = document.createElement("dialog");
      dialog.className = "likes-dialog";
      const title = document.createElement("h3");
      title.textContent = "点赞者名单";
      const list = document.createElement("div");
      if (!body.users.length) list.textContent = "尚无人点赞。";
      body.users.forEach((user) => {
        const row = document.createElement("p");
        row.textContent = `${user.nickname} · ${user.email} · ${formatMoment(user.created_at)}`;
        list.append(row);
      });
      const close = document.createElement("button");
      close.type = "button";
      close.className = "solid-button";
      close.textContent = "关闭";
      close.addEventListener("click", () => dialog.close());
      dialog.addEventListener("close", () => dialog.remove());
      dialog.append(title, list, close);
      document.body.append(dialog);
      dialog.showModal();
    } catch (error) {
      showToast(apiErrorMessage(error));
    }
    return;
  }
  const trashMediaButton = event.target.closest("[data-trash-media]");
  if (trashMediaButton) {
    const media = adminState.media.find((item) => item.id === trashMediaButton.dataset.trashMedia);
    if (!media) return;
    try {
      if (media.status === "trash") {
        await apiRequest(`/api/media/${encodeURIComponent(media.id)}/restore`, { method: "POST", body: "{}" });
        showToast("媒体已从回收站恢复");
      } else {
        const referenced = trashMediaButton.dataset.referenced === "true";
        const prompt = referenced
          ? "该图片被游记引用。仍要移入 30 天回收站吗？游记中的引用会失效。"
          : "将该媒体移入 30 天回收站？";
        if (!confirm(prompt)) return;
        await apiRequest(`/api/media/${encodeURIComponent(media.id)}${referenced ? "?force=1" : ""}`, { method: "DELETE" });
        showToast("媒体已移入 30 天回收站");
      }
      await reloadMediaLibrary();
    } catch (error) {
      showToast(apiErrorMessage(error));
    }
    return;
  }
  const reaction = event.target.closest("[data-like-media],[data-favorite-media]");
  if (reaction) {
    if (!authUser) {
      route("login");
      return;
    }
    const mediaId = reaction.dataset.likeMedia || reaction.dataset.favoriteMedia;
    const kind = reaction.dataset.likeMedia ? "like" : "favorite";
    reaction.disabled = true;
    try {
      const direct = new URLSearchParams(location.search);
      const share = direct.get("trip") === activeTripId ? direct.get("share") : "";
      await apiRequest(`/api/media/${encodeURIComponent(mediaId)}/${kind}${share ? `?share=${encodeURIComponent(share)}` : ""}`, { method: "POST", body: "{}" });
      if (document.querySelector('[data-view="favorites"]').classList.contains("active")) {
        await loadFavorites();
      } else {
        await loadPublicGallery(activeTripId, document.querySelector("[data-gallery-sort].active")?.dataset.gallerySort || "manual");
      }
    } catch (error) {
      showToast(apiErrorMessage(error));
    } finally {
      reaction.disabled = false;
    }
    return;
  }
  const downloadButton = event.target.closest("[data-download-media]");
  if (downloadButton) {
    downloadButton.disabled = true;
    try {
      await downloadMedia(
        downloadButton.dataset.downloadMedia,
        downloadButton.dataset.watermark === "1",
        downloadButton.dataset.mediaKind
      );
      showToast(downloadButton.dataset.watermark === "1" ? "水印照片已生成" : "下载已开始");
    } catch (error) {
      showToast(apiErrorMessage(error));
    } finally {
      downloadButton.disabled = false;
    }
    return;
  }
  const gallerySort = event.target.closest("[data-gallery-sort]");
  if (gallerySort) {
    document.querySelectorAll("[data-gallery-sort]").forEach((button) => button.classList.toggle("active", button === gallerySort));
    if (serverTripDetails.has(activeTripId)) {
      await loadPublicGallery(activeTripId, gallerySort.dataset.gallerySort);
    }
    return;
  }
  const galleryLayout = event.target.closest("[data-gallery-layout]");
  if (galleryLayout) {
    document.querySelectorAll("[data-gallery-layout]").forEach((button) => button.classList.toggle("active", button === galleryLayout));
    document.querySelector("#trip-gallery").classList.toggle("masonry", galleryLayout.dataset.galleryLayout === "masonry");
    return;
  }
  const exportButton = event.target.closest("[data-export-format]");
  if (exportButton) {
    exportButton.disabled = true;
    try {
      const format = exportButton.dataset.exportFormat;
      const response = await fetch(`${apiBase}/api/export?format=${encodeURIComponent(format)}`, { credentials: "include" });
      const body = response.ok ? await response.blob() : await response.json();
      if (!response.ok) throw new Error(body.error || "request_failed");
      const href = URL.createObjectURL(body);
      const link = document.createElement("a");
      link.href = href;
      link.download = `travel-rolls.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      showToast(`已导出 ${format.toUpperCase()}，不含原图`);
    } catch (error) {
      showToast(apiErrorMessage(error));
    } finally {
      exportButton.disabled = false;
    }
    return;
  }
  const restoreTrash = event.target.closest("[data-restore-trash]");
  if (restoreTrash) {
    restoreTrash.disabled = true;
    const type = restoreTrash.dataset.trashType;
    try {
      await apiRequest(
        type === "trip"
          ? `/api/trips/${encodeURIComponent(restoreTrash.dataset.restoreTrash)}/restore`
          : `/api/media/${encodeURIComponent(restoreTrash.dataset.restoreTrash)}/restore`,
        { method: "POST", body: "{}" }
      );
      await Promise.all([reloadTrash(), reloadManagedTrips()]);
      showToast(type === "trip" ? "旅行及同批媒体已恢复" : "媒体已恢复");
    } catch (error) {
      showToast(apiErrorMessage(error));
    } finally {
      restoreTrash.disabled = false;
    }
  }
});

async function reloadManagedTrips() {
  const body = await apiRequest("/api/trips?scope=manage", { method: "GET", headers: {} });
  adminState.trips = body.trips || [];
  renderManagedTrips();
  renderMediaTripOptions();
}

const uploadResumeKey = "travel-rolls.upload-resume.v1";

function readUploadResume() {
  try {
    return JSON.parse(localStorage.getItem(uploadResumeKey) || "{}");
  } catch {
    return {};
  }
}

function writeUploadResume(value) {
  localStorage.setItem(uploadResumeKey, JSON.stringify(value));
}

function fileFingerprint(file) {
  return `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
}

async function parseCaptureTime(file) {
  if (file.type !== "image/jpeg") return null;
  try {
    const buffer = await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer();
    const view = new DataView(buffer);
    if (view.getUint16(0, false) !== 0xffd8) return null;
    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset, false);
      const length = view.getUint16(offset + 2, false);
      if (marker === 0xffe1 && length >= 10) {
        const exif = String.fromCharCode(...new Uint8Array(buffer, offset + 4, 4));
        if (exif !== "Exif") return null;
        const tiff = offset + 10;
        const little = view.getUint16(tiff, false) === 0x4949;
        const u16 = (at) => view.getUint16(at, little);
        const u32 = (at) => view.getUint32(at, little);
        const readAscii = (at, lengthValue) => {
          const bytes = new Uint8Array(buffer, at, Math.max(0, lengthValue - 1));
          return new TextDecoder("ascii").decode(bytes);
        };
        const findTag = (ifdOffset, wanted) => {
          const base = tiff + ifdOffset;
          const count = u16(base);
          for (let index = 0; index < count; index += 1) {
            const entry = base + 2 + index * 12;
            const tag = u16(entry);
            if (wanted.includes(tag)) {
              const countValue = u32(entry + 4);
              const valueOffset = countValue <= 4 ? entry + 8 : tiff + u32(entry + 8);
              return { tag, text: readAscii(valueOffset, countValue), offset: u32(entry + 8) };
            }
          }
          return null;
        };
        const ifd0 = u32(tiff + 4);
        const exifPointer = findTag(ifd0, [0x8769]);
        if (!exifPointer) return null;
        const captured = findTag(exifPointer.offset, [0x9003, 0x9004]);
        const match = captured?.text.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
        if (!match) return null;
        const [, year, month, day, hour, minute, second] = match;
        const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
      }
      if (length < 2) break;
      offset += 2 + length;
    }
  } catch {
    return null;
  }
  return null;
}

async function parseJpegGps(file) {
  if (file.type !== "image/jpeg") return null;
  try {
    const buffer = await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer();
    const view = new DataView(buffer);
    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset, false);
      const length = view.getUint16(offset + 2, false);
      if (marker === 0xffe1 && length >= 10) {
        const exif = new TextDecoder("ascii").decode(new Uint8Array(buffer, offset + 4, 4));
        if (exif !== "Exif") return null;
        const tiff = offset + 10;
        const little = view.getUint16(tiff, false) === 0x4949;
        const u16 = (at) => view.getUint16(at, little);
        const u32 = (at) => view.getUint32(at, little);
        const entryFor = (ifdOffset, wanted) => {
          const base = tiff + ifdOffset;
          const count = u16(base);
          for (let index = 0; index < count; index += 1) {
            const entry = base + 2 + index * 12;
            if (u16(entry) === wanted) return entry;
          }
          return -1;
        };
        const ifd0 = u32(tiff + 4);
        const gpsPointer = entryFor(ifd0, 0x8825);
        if (gpsPointer < 0) return null;
        const gpsIfd = u32(gpsPointer + 8);
        const readRef = (tag) => {
          const entry = entryFor(gpsIfd, tag);
          return entry < 0 ? "" : String.fromCharCode(view.getUint8(entry + 8));
        };
        const readDms = (tag) => {
          const entry = entryFor(gpsIfd, tag);
          if (entry < 0 || u32(entry + 4) !== 3) return null;
          const at = tiff + u32(entry + 8);
          const values = [0, 1, 2].map((index) => {
            const numerator = u32(at + index * 8);
            const denominator = u32(at + index * 8 + 4);
            return denominator ? numerator / denominator : 0;
          });
          return values[0] + values[1] / 60 + values[2] / 3600;
        };
        let lat = readDms(2);
        let lng = readDms(4);
        if (lat === null || lng === null) return null;
        if (readRef(1) === "S") lat *= -1;
        if (readRef(3) === "W") lng *= -1;
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
        return { lat, lng };
      }
      if (length < 2) break;
      offset += 2 + length;
    }
  } catch {
    return null;
  }
  return null;
}

let amapBrowserKeyPromise;
async function resolveGpsDistrict(gps) {
  if (!gps || !appConfig.amapServiceHost) return null;
  try {
    if (!amapBrowserKeyPromise) {
      amapBrowserKeyPromise = fetch(`${String(appConfig.amapServiceHost).replace(/\/$/, "")}/config`)
        .then((response) => response.ok ? response.json() : Promise.reject(new Error("map_config_unavailable")))
        .then((body) => body.amapKey);
    }
    const key = await amapBrowserKeyPromise;
    const endpoint = new URL(`${String(appConfig.amapServiceHost).replace(/\/$/, "")}/_AMapService/v3/geocode/regeo`);
    endpoint.searchParams.set("key", key);
    endpoint.searchParams.set("location", `${gps.lng},${gps.lat}`);
    endpoint.searchParams.set("extensions", "base");
    endpoint.searchParams.set("radius", "1000");
    const response = await fetch(endpoint);
    const body = await response.json();
    const adcode = String(body.regeocode?.addressComponent?.adcode || "");
    return /^\d{6}$/.test(adcode) ? adcode : null;
  } catch {
    return null;
  }
}

async function hashFile(file) {
  if (!crypto.subtle || file.size > 120 * 1024 * 1024) return null;
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function visualFingerprint(file) {
  if (!["image/jpeg", "image/png"].includes(file.type)) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = 9;
    canvas.height = 8;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, 9, 8);
    bitmap.close();
    const pixels = context.getImageData(0, 0, 9, 8).data;
    let hash = 0n;
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 9; x += 1) {
        const at = (y * 9 + x) * 4;
        red += pixels[at];
        green += pixels[at + 1];
        blue += pixels[at + 2];
        if (x < 8) {
          const next = at + 4;
          const gray = pixels[at] * 0.299 + pixels[at + 1] * 0.587 + pixels[at + 2] * 0.114;
          const nextGray = pixels[next] * 0.299 + pixels[next + 1] * 0.587 + pixels[next + 2] * 0.114;
          hash = (hash << 1n) | (gray > nextGray ? 1n : 0n);
        }
      }
    }
    const count = 72;
    const r = red / count / 255;
    const g = green / count / 255;
    const b = blue / count / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let hue = 0;
    if (max !== min) {
      const delta = max - min;
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
    }
    if (hue < 0) hue += 360;
    return JSON.stringify({ v: 1, d: hash.toString(16).padStart(16, "0"), h: Math.round(hue) });
  } catch {
    return null;
  }
}

async function prepareMediaFiles(files) {
  const allowed = new Set(["image/jpeg", "image/png", "video/mp4"]);
  const limits = { "image/jpeg": 100 * 1024 * 1024, "image/png": 100 * 1024 * 1024, "video/mp4": 500 * 1024 * 1024 };
  const accepted = [...files].filter((file) => allowed.has(file.type) && file.size > 0 && file.size <= limits[file.type]);
  const rejected = files.length - accepted.length;
  setFormStatus("#media-upload-status", `正在解析 ${accepted.length} 个文件…${rejected ? ` 已忽略 ${rejected} 个不支持或超限文件。` : ""}`);
  for (const file of accepted) {
    const gps = await parseJpegGps(file);
    const item = {
      id: crypto.randomUUID(),
      file,
      fingerprint: fileFingerprint(file),
      capturedAt: await parseCaptureTime(file),
      districtCode: await resolveGpsDistrict(gps),
      contentHash: await hashFile(file),
      visualFingerprint: await visualFingerprint(file),
      status: "ready",
      progress: 0,
      error: "",
    };
    adminState.uploadQueue.push(item);
    renderUploadQueue();
  }
  setFormStatus(
    "#media-upload-status",
    `${adminState.uploadQueue.length} 个文件待确认；PNG/视频或无 EXIF 时间的文件会进入“待完善”。`,
    "ready"
  );
}

function renderUploadQueue() {
  const container = document.querySelector("#media-upload-queue");
  container.replaceChildren();
  if (!adminState.uploadQueue.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "选择文件后会先读取类型、大小、哈希和可用的拍摄时间；确认城市后才上传。";
    container.append(empty);
    return;
  }
  adminState.uploadQueue.forEach((item, index) => {
    const row = document.createElement("article");
    row.className = "upload-item";
    const indexLabel = document.createElement("span");
    indexLabel.textContent = String(index + 1).padStart(2, "0");
    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.file.name;
    const meta = document.createElement("small");
    const time = item.capturedAt ? new Date(item.capturedAt).toLocaleString("zh-CN") : "拍摄时间待完善";
    meta.textContent = `${formatBytes(item.file.size)} · ${item.file.type} · ${time}${item.districtCode ? ` · GPS仅保留区县码 ${item.districtCode}` : ""}`;
    const bar = document.createElement("div");
    bar.className = "upload-progress";
    const fill = document.createElement("i");
    fill.style.width = `${item.progress}%`;
    bar.append(fill);
    details.append(name, meta, bar);
    const state = document.createElement("span");
    state.className = `upload-state ${item.status}`;
    state.textContent = item.error || ({ ready: "待上传", uploading: `${item.progress}%`, complete: "完成" }[item.status] || item.status);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button";
    remove.dataset.removeUpload = item.id;
    remove.textContent = "移除";
    remove.disabled = item.status === "uploading";
    row.append(indexLabel, details, state, remove);
    container.append(row);
  });
}

async function uploadJson(path, options = {}) {
  return apiRequest(path, options);
}

async function uploadPartWithRetry(uploadId, partNumber, blob) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${apiBase}/api/uploads/${encodeURIComponent(uploadId)}/parts/${partNumber}`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/octet-stream" },
        body: blob,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "part_upload_failed");
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

async function createImageVariant(file, maxEdge, quality) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#f5eee3";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("variant_failed")), "image/jpeg", quality);
  });
}

async function uploadVariant(mediaId, variant, blob) {
  const response = await fetch(`${apiBase}/api/media/${encodeURIComponent(mediaId)}/variants/${variant}`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": blob.type },
    body: blob,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "variant_failed");
  return body;
}

async function uploadQueueItem(item, tripId, placeId) {
  const resume = readUploadResume();
  let record = resume[item.fingerprint];
  if (!record) {
    const initiated = await uploadJson("/api/uploads/initiate", {
      method: "POST",
      body: JSON.stringify({
        tripId,
        placeId,
        filename: item.file.name,
        mimeType: item.file.type,
        byteSize: item.file.size,
        capturedAt: item.capturedAt,
        districtCode: item.districtCode,
        contentHash: item.contentHash,
        visualFingerprint: item.visualFingerprint,
      }),
    });
    record = { uploadId: initiated.uploadId, partSize: initiated.partSize, parts: [], tripId, placeId };
    resume[item.fingerprint] = record;
    writeUploadResume(resume);
  } else if (record.tripId !== tripId || record.placeId !== placeId) {
    throw new Error("resume_target_changed");
  }
  if (!record.completedMediaId) {
    const partSize = record.partSize;
    const partCount = Math.ceil(item.file.size / partSize);
    for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
      if (!record.parts.some((part) => part.partNumber === partNumber)) {
        const start = (partNumber - 1) * partSize;
        const result = await uploadPartWithRetry(record.uploadId, partNumber, item.file.slice(start, Math.min(item.file.size, start + partSize)));
        record.parts.push({ partNumber: result.partNumber, etag: result.etag });
        record.parts.sort((a, b) => a.partNumber - b.partNumber);
        resume[item.fingerprint] = record;
        writeUploadResume(resume);
      }
      item.progress = Math.round(record.parts.length / partCount * 82);
      renderUploadQueue();
    }
    const completed = await uploadJson(`/api/uploads/${encodeURIComponent(record.uploadId)}/complete`, {
      method: "POST",
      body: JSON.stringify({ parts: record.parts }),
    });
    record.completedMediaId = completed.mediaId;
    resume[item.fingerprint] = record;
    writeUploadResume(resume);
  }
  if (item.file.type === "image/jpeg" || item.file.type === "image/png") {
    item.progress = 86;
    renderUploadQueue();
    const safe = await createImageVariant(item.file, Infinity, 0.95);
    await uploadVariant(record.completedMediaId, "safe", safe);
    item.progress = 91;
    renderUploadQueue();
    const web = await createImageVariant(item.file, 2400, 0.88);
    await uploadVariant(record.completedMediaId, "web", web);
    item.progress = 96;
    renderUploadQueue();
    const thumb = await createImageVariant(item.file, 520, 0.78);
    await uploadVariant(record.completedMediaId, "thumb", thumb);
  }
  delete resume[item.fingerprint];
  writeUploadResume(resume);
  item.progress = 100;
  item.status = "complete";
  renderUploadQueue();
}

async function loadMediaTrip(id) {
  adminState.activeMediaTripId = id;
  const placeSelect = document.querySelector("#media-place");
  placeSelect.replaceChildren();
  if (!id) {
    adminState.media = [];
    renderMediaLibrary();
    return;
  }
  const tripBody = await apiRequest(`/api/trips/${encodeURIComponent(id)}`, { method: "GET", headers: {} });
  adminState.activeMediaPlaces = tripBody.trip.places || [];
  adminState.activeMediaPlaces.forEach((place) => {
    const option = document.createElement("option");
    option.value = place.id;
    option.textContent = place.display_name || place.official_name;
    placeSelect.append(option);
  });
  await reloadMediaLibrary();
}

async function reloadMediaLibrary() {
  const id = adminState.activeMediaTripId;
  if (!id) return;
  const sort = document.querySelector("#media-sort").value;
  const body = await apiRequest(`/api/trips/${encodeURIComponent(id)}/media?sort=${encodeURIComponent(sort)}`, {
    method: "GET",
    headers: {},
  });
  adminState.media = body.media || [];
  renderMediaLibrary();
}

function renderMediaLibrary() {
  const container = document.querySelector("#media-library");
  container.replaceChildren();
  if (!adminState.media.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = adminState.activeMediaTripId ? "本次旅行尚无媒体。" : "选择旅行以查看媒体。";
    container.append(empty);
    return;
  }
  adminState.media.forEach((media) => {
    const card = document.createElement("article");
    card.className = "media-admin-card";
    card.dataset.mediaId = media.id;
    card.draggable = true;
    card.title = "拖动可调整手动顺序";
    const visual = document.createElement(media.kind === "video" ? "video" : "img");
    visual.src = `${apiBase}${media.content_url}`;
    visual.alt = media.description || media.original_filename;
    visual.loading = "lazy";
    if (media.kind === "video") visual.controls = true;
    const form = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = media.original_filename;
    const meta = document.createElement("small");
    meta.textContent = `${media.place_name} · ${formatBytes(media.byte_size)} · ${media.status}${media.story_referenced ? " · 被游记引用" : ""}`;
    const description = document.createElement("textarea");
    description.dataset.mediaDescription = "";
    description.rows = 2;
    description.placeholder = "照片说明";
    description.value = media.description || "";
    const captured = document.createElement("input");
    captured.type = "datetime-local";
    captured.dataset.mediaCaptured = "";
    captured.value = media.captured_at ? media.captured_at.slice(0, 16) : "";
    const place = document.createElement("select");
    place.dataset.mediaPlace = "";
    adminState.activeMediaPlaces.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.display_name || entry.official_name;
      option.selected = entry.id === media.place_id;
      place.append(option);
    });
    const tags = document.createElement("div");
    tags.className = "media-tag-choices";
    adminState.tags.forEach((tag) => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = tag.id;
      checkbox.checked = media.tags.some((entry) => entry.id === tag.id);
      checkbox.disabled = Boolean(tag.is_system);
      const text = document.createElement("span");
      text.textContent = tag.name;
      text.style.setProperty("--tag-color", tag.color);
      label.append(checkbox, text);
      tags.append(label);
    });
    const actions = document.createElement("div");
    const save = document.createElement("button");
    save.type = "button";
    save.className = "outline-button";
    save.dataset.saveMedia = media.id;
    save.textContent = "保存说明与时间";
    const copyReference = document.createElement("button");
    copyReference.type = "button";
    copyReference.className = "text-button";
    copyReference.dataset.copyMediaReference = media.id;
    copyReference.dataset.mediaAlt = media.description || media.place_name || "旅行照片";
    copyReference.textContent = "复制游记引用";
    const viewLikes = document.createElement("button");
    viewLikes.type = "button";
    viewLikes.className = "text-button";
    viewLikes.dataset.viewLikes = media.id;
    viewLikes.textContent = `点赞名单 ${media.like_count || 0}`;
    viewLikes.hidden = authUser?.role !== "admin";
    const trash = document.createElement("button");
    trash.type = "button";
    trash.className = "text-button danger";
    trash.dataset.trashMedia = media.id;
    trash.dataset.referenced = String(media.story_referenced);
    trash.textContent = media.status === "trash" ? "恢复" : "移入回收站";
    actions.append(viewLikes, copyReference, save, trash);
    form.append(title, meta, description, captured, place, tags, actions);
    card.append(visual, form);
    container.append(card);
  });
}

async function reloadTags() {
  const body = await apiRequest("/api/tags", { method: "GET", headers: {} });
  adminState.tags = body.tags || [];
  renderGlobalTags();
  renderTripTagChoices();
}

async function reloadPeople() {
  if (authUser?.role !== "admin") return;
  const [users, invitations] = await Promise.all([
    apiRequest("/api/admin/users", { method: "GET", headers: {} }),
    apiRequest("/api/admin/invitations", { method: "GET", headers: {} }),
  ]);
  adminState.users = users.users || [];
  adminState.invitations = invitations.invitations || [];
  renderUsers();
  renderInvitations();
}

document.querySelector("#new-trip-button").addEventListener("click", () => {
  setAdminTab("trips");
  resetTripForm();
  document.querySelector("#trip-form-name").focus();
});

document.querySelector("#trip-form-reset").addEventListener("click", resetTripForm);

document.querySelector("#trip-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.querySelector("#trip-form-id").value;
  const placeIds = [...document.querySelector("#trip-form-places").selectedOptions].map((option) => option.value);
  const tagIds = [...document.querySelectorAll("#trip-form-tags input:checked")].map((input) => input.value);
  const payload = {
    title: document.querySelector("#trip-form-name").value.trim(),
    subtitle: document.querySelector("#trip-form-subtitle").value.trim(),
    startDate: document.querySelector("#trip-form-start").value || null,
    endDate: document.querySelector("#trip-form-end").value || null,
    visibility: document.querySelector("#trip-form-visibility").value,
    status: document.querySelector("#trip-form-status").value,
    dateSource: document.querySelector("#trip-form-date-source").value,
    markdown: document.querySelector("#trip-form-markdown").value,
    placeIds,
    tagIds,
    coverMediaId: document.querySelector("#trip-form-cover").value || null,
    coverTextSide: document.querySelector("#trip-form-cover-side").value,
    coverTextTone: document.querySelector("#trip-form-cover-tone").value || null,
    coverFocusX: Number(document.querySelector("#trip-form-focus-x").value),
    coverFocusY: Number(document.querySelector("#trip-form-focus-y").value),
  };
  const submit = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
  submit.disabled = true;
  setFormStatus("#trip-form-status-message", "正在保存…");
  try {
    const body = await apiRequest(id ? `/api/trips/${encodeURIComponent(id)}` : "/api/trips", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    const saved = body.trip;
    document.querySelector("#trip-form-id").value = saved.id;
    document.querySelector("#trip-form-title").textContent = `编辑 · ${saved.title}`;
    document.querySelector("#trip-delete-button").hidden = false;
    document.querySelector("#trip-share-button").hidden = saved.visibility !== "link";
    setFormStatus(
      "#trip-form-status-message",
      body.shareToken
        ? `已保存。新的持链接访问令牌：${body.shareToken}（仅显示一次，请妥善保存）`
        : "已保存。",
      "ready"
    );
    await reloadManagedTrips();
    await loadTripVersions(saved.id);
    showToast(id ? "旅行与 Markdown 游记已更新" : "旅行已创建");
  } catch (error) {
    setFormStatus("#trip-form-status-message", apiErrorMessage(error), "error");
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#trip-delete-button").addEventListener("click", async () => {
  const id = document.querySelector("#trip-form-id").value;
  if (!id || !confirm("将本次旅行移入 30 天回收站？未被其他记录引用的媒体也会一起进入回收站。")) return;
  const button = document.querySelector("#trip-delete-button");
  button.disabled = true;
  try {
    await apiRequest(`/api/trips/${encodeURIComponent(id)}`, { method: "DELETE" });
    resetTripForm();
    await Promise.all([reloadManagedTrips(), reloadTrash()]);
    showToast("旅行已移入 30 天回收站");
  } catch (error) {
    showToast(apiErrorMessage(error));
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#trip-share-button").addEventListener("click", async () => {
  const id = document.querySelector("#trip-form-id").value;
  if (!id || !confirm("生成新分享链接会立即令旧链接失效，是否继续？")) return;
  const button = document.querySelector("#trip-share-button");
  button.disabled = true;
  try {
    const body = await apiRequest(`/api/trips/${encodeURIComponent(id)}/share-token`, { method: "POST", body: "{}" });
    const url = new URL(location.origin + location.pathname);
    url.searchParams.set("trip", id);
    url.searchParams.set("share", body.shareToken);
    url.hash = "trip";
    await navigator.clipboard.writeText(url.toString());
    setFormStatus("#trip-form-status-message", "新的分享链接已复制；旧链接已失效。", "ready");
    showToast("分享链接已复制");
  } catch (error) {
    showToast(apiErrorMessage(error));
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#invitation-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const submit = event.submitter;
  submit.disabled = true;
  setFormStatus("#invitation-status", "正在创建邀请…");
  try {
    const body = await apiRequest("/api/admin/invitations", {
      method: "POST",
      body: JSON.stringify({
        email: document.querySelector("#invitation-email").value.trim(),
        role: document.querySelector("#invitation-role").value,
      }),
    });
    form.reset();
    await reloadPeople();
    setFormStatus(
      "#invitation-status",
      body.emailSent
        ? "邀请已创建并发送邮件。对方现在可以请求登录验证码。"
        : "邀请已创建；邮件未发送，但对方已可使用该邮箱请求验证码。",
      "ready"
    );
  } catch (error) {
    setFormStatus("#invitation-status", apiErrorMessage(error), "error");
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#global-tag-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const submit = event.submitter;
  submit.disabled = true;
  try {
    await apiRequest("/api/tags", {
      method: "POST",
      body: JSON.stringify({
        name: document.querySelector("#global-tag-name").value.trim(),
        color: document.querySelector("#global-tag-color").value,
      }),
    });
    form.reset();
    document.querySelector("#global-tag-color").value = "#db7a5c";
    await reloadTags();
    showToast("全站标签已新增");
  } catch (error) {
    showToast(apiErrorMessage(error));
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#site-settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = event.submitter;
  submit.disabled = true;
  try {
    const body = await apiRequest("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ subtitle: document.querySelector("#site-subtitle").value.trim() }),
    });
    document.querySelector(".home-copy .subtitle").textContent = body.settings.subtitle;
    showToast("站点副标题已更新");
  } catch (error) {
    showToast(apiErrorMessage(error));
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#media-trip").addEventListener("change", (event) => {
  loadMediaTrip(event.target.value).catch((error) => showToast(apiErrorMessage(error)));
});

document.querySelector("#media-sort").addEventListener("change", () => {
  reloadMediaLibrary().catch((error) => showToast(apiErrorMessage(error)));
});

document.querySelector("#media-smart-sort").addEventListener("click", async () => {
  if (!adminState.activeMediaTripId) {
    showToast("请先选择旅行");
    return;
  }
  const button = document.querySelector("#media-smart-sort");
  button.disabled = true;
  try {
    const body = await apiRequest(`/api/trips/${encodeURIComponent(adminState.activeMediaTripId)}/smart-sort`, {
      method: "POST",
      body: "{}",
    });
    document.querySelector("#media-sort").value = "smart";
      await reloadMediaLibrary();
      await reloadTrash();
    showToast(`已按内容结构为主、色彩为辅重排 ${body.count} 个媒体；未使用人脸身份识别`);
  } catch (error) {
    showToast(apiErrorMessage(error));
  } finally {
    button.disabled = false;
  }
});

let draggedMediaId = "";
document.querySelector("#media-library").addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-media-id]");
  if (!card || document.querySelector("#media-sort").value !== "manual") {
    event.preventDefault();
    return;
  }
  draggedMediaId = card.dataset.mediaId;
  event.dataTransfer.effectAllowed = "move";
});
document.querySelector("#media-library").addEventListener("dragover", (event) => {
  if (draggedMediaId) event.preventDefault();
});
document.querySelector("#media-library").addEventListener("drop", async (event) => {
  event.preventDefault();
  const target = event.target.closest("[data-media-id]");
  if (!target || !draggedMediaId || target.dataset.mediaId === draggedMediaId) return;
  const from = adminState.media.findIndex((item) => item.id === draggedMediaId);
  const to = adminState.media.findIndex((item) => item.id === target.dataset.mediaId);
  const [moved] = adminState.media.splice(from, 1);
  adminState.media.splice(to, 0, moved);
  draggedMediaId = "";
  renderMediaLibrary();
  try {
    await apiRequest(`/api/trips/${encodeURIComponent(adminState.activeMediaTripId)}/media-order`, {
      method: "POST",
      body: JSON.stringify({ mediaIds: adminState.media.map((item) => item.id) }),
    });
    showToast("手动顺序已保存");
  } catch (error) {
    showToast(apiErrorMessage(error));
    await reloadMediaLibrary();
  }
});
document.querySelector("#media-library").addEventListener("dragend", () => { draggedMediaId = ""; });

document.querySelector("#media-files").addEventListener("change", (event) => {
  prepareMediaFiles(event.target.files).catch(() => setFormStatus("#media-upload-status", "文件解析失败，请重新选择。", "error"));
  event.target.value = "";
});

document.querySelector("#media-clear-queue").addEventListener("click", () => {
  if (adminState.uploadQueue.some((item) => item.status === "uploading")) {
    showToast("上传进行中，暂时不能清空队列");
    return;
  }
  adminState.uploadQueue = [];
  renderUploadQueue();
});

document.querySelector("#media-upload-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const tripId = document.querySelector("#media-trip").value;
  const placeId = document.querySelector("#media-place").value;
  if (!tripId || !placeId || !adminState.uploadQueue.length) {
    setFormStatus("#media-upload-status", "请选择旅行、城市并添加文件。", "error");
    return;
  }
  const submit = event.submitter;
  submit.disabled = true;
  let completed = 0;
  for (const item of adminState.uploadQueue.filter((entry) => entry.status !== "complete")) {
    item.status = "uploading";
    item.error = "";
    renderUploadQueue();
    try {
      await uploadQueueItem(item, tripId, placeId);
      completed += 1;
    } catch (error) {
      item.status = "failed";
      item.error = apiErrorMessage(error);
      renderUploadQueue();
    }
  }
  submit.disabled = false;
  setFormStatus(
    "#media-upload-status",
    completed ? `本次完成 ${completed} 个文件；失败项目可直接再次确认上传。` : "没有文件成功上传，请检查错误后重试。",
    completed ? "ready" : "error"
  );
  await Promise.all([reloadMediaLibrary(), reloadManagedTrips()]);
});

document.querySelector("#tag-editor-toggle").addEventListener("click", () => {
  const editor = document.querySelector("#tag-editor");
  const willOpen = editor.hidden;
  editor.hidden = !willOpen;
  document.querySelector("#tag-editor-toggle").setAttribute("aria-expanded", String(willOpen));
  if (willOpen) document.querySelector("#tag-name").focus();
});

document.querySelector("#tag-form").addEventListener("submit", async (event) => {
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
  const detail = serverTripDetails.get(activeTripId);
  if (detail) {
    try {
      const tagsBody = await apiRequest("/api/tags", { method: "GET", headers: {} });
      let tag = tagsBody.tags.find((entry) => entry.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (!tag) {
        const created = await apiRequest("/api/tags", {
          method: "POST",
          body: JSON.stringify({ name, color: colorInput.value }),
        });
        tag = created.tag;
      }
      const body = await apiRequest(`/api/trips/${encodeURIComponent(activeTripId)}`, {
        method: "PATCH",
        body: JSON.stringify({ tagIds: [...detail.tags.map((entry) => entry.id), tag.id] }),
      });
      serverTripDetails.set(activeTripId, body.trip);
      tripTags[activeTripId] = body.trip.tags.map((entry) => entry.name);
      body.trip.tags.forEach((entry) => { tagColors[entry.name] = entry.color; });
      nameInput.value = "";
      renderTripTags();
      showToast(`已添加全站标签“${name}”`);
    } catch (error) {
      showToast(apiErrorMessage(error));
    }
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

document.querySelector("#story-save").addEventListener("click", async () => {
  const markdown = document.querySelector("#story-markdown").value.trim();
  if (!markdown) {
    showToast("游记正文不能为空");
    return;
  }
  const detail = serverTripDetails.get(activeTripId);
  if (detail) {
    const button = document.querySelector("#story-save");
    button.disabled = true;
    document.querySelector("#story-editor-status").textContent = "正在保存到服务器…";
    try {
      const body = await apiRequest(`/api/trips/${encodeURIComponent(activeTripId)}`, {
        method: "PATCH",
        body: JSON.stringify({ markdown }),
      });
      serverTripDetails.set(activeTripId, body.trip);
      storyMarkdown[activeTripId] = body.trip.markdown;
      renderStory(body.trip.markdown);
      closeStoryEditor();
      showToast(`游记已保存；服务器保留最近 ${Math.min(5, Number(body.trip.version_count || 0))} 个旧版本`);
    } catch (error) {
      document.querySelector("#story-editor-status").textContent = apiErrorMessage(error);
    } finally {
      button.disabled = false;
    }
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
let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
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
  index.textContent = "…";
  message.textContent = "正在检索有权查看的旅行、城市、标签、照片说明与 Markdown 全文…";
  hint.textContent = "代码块正文也会参与检索。";
  results.append(index, message, hint);
  searchTimer = setTimeout(async () => {
    try {
      const body = await apiRequest(`/api/search?q=${encodeURIComponent(query)}`, { method: "GET", headers: {} });
      if (searchInput.value.trim() !== query) return;
      results.replaceChildren();
      if (!body.results?.length) {
        index.textContent = "00";
        message.textContent = `暂未找到“${query}”`;
        hint.textContent = "可尝试旅行名称、城市、标签、日期或游记正文";
        results.append(index, message, hint);
        return;
      }
      body.results.forEach((trip, position) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "search-result";
        button.dataset.openTrip = trip.id;
        const number = document.createElement("span");
        number.textContent = String(position + 1).padStart(2, "0");
        const copy = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = trip.title;
        const meta = document.createElement("small");
        meta.textContent = formatTripRange(trip.start_date, trip.end_date);
        const excerpt = document.createElement("p");
        excerpt.textContent = String(trip.excerpt || trip.subtitle || "").replace(/\s+/g, " ").slice(0, 180);
        copy.append(title, meta, excerpt);
        button.append(number, copy);
        results.append(button);
      });
    } catch (error) {
      results.replaceChildren();
      index.textContent = "!";
      message.textContent = apiErrorMessage(error);
      results.append(index, message);
    }
  }, 280);
});

document.querySelector("#mock-upload").addEventListener("click", () => {
  setAdminTab("media");
  document.querySelector("#media-files").click();
});

window.addEventListener("popstate", (event) => route(event.state?.route || location.hash.slice(1) || "home", false));

const initialRoute = location.hash.slice(1);
if (initialRoute && views.some((view) => view.dataset.view === initialRoute)) route(initialRoute, false);
applyCaptionColors();
renderTripTags();
renderStory(storyMarkdown[activeTripId]);
refreshSession();
