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
let toastTimer;

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
  document.querySelector("#trip-title").textContent = trip.title;
  document.querySelector("#trip-kicker").textContent = trip.kicker;
  document.querySelector("#trip-date").textContent = trip.date;
  const image = document.querySelector("#trip-hero-image");
  image.src = trip.image;
  image.alt = `${trip.title}旅行封面测试图`;
  route("trip");
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

document.addEventListener("click", (event) => {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) route(routeButton.dataset.route);

  const tripButton = event.target.closest("[data-open-trip]");
  if (tripButton) openTrip(tripButton.dataset.openTrip);
});

document.querySelectorAll("[data-province]").forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.dataset.province;
    document.querySelector("#province-name").textContent = name.endsWith("港") ? name : `${name}省`;
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
