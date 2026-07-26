(function () {
  const COLORS = ["#e4e2dc", "#f7c8ae", "#efa078", "#df7447", "#a9431e"];
  const CITY_VISITS = new Map([
    ["110000", { count: 1, tripId: "text-roll", name: "北京市", center: [116.4074, 39.9042] }],
    ["140100", { count: 1, tripId: "shanxi", name: "太原市", center: [112.5489, 37.8706] }],
    ["140200", { count: 1, tripId: "shanxi", name: "大同市", center: [113.3001, 40.0768] }],
    ["210200", { count: 1, tripId: "dalian", name: "大连市", center: [121.6147, 38.914] }],
    ["330100", { count: 1, tripId: "hangzhou", name: "杭州市", center: [120.1551, 30.2741] }],
    ["810000", { count: 1, tripId: "hong-kong", name: "香港特别行政区", center: [114.1694, 22.3193] }],
  ]);
  const PROVINCES = [
    ["新疆", "650000"], ["西藏", "540000"], ["青海", "630000"], ["甘肃", "620000"],
    ["内蒙古", "150000"], ["黑龙江", "230000"], ["吉林", "220000"], ["辽宁", "210000"],
    ["宁夏", "640000"], ["山西", "140000"], ["河北", "130000"], ["北京", "110000"],
    ["天津", "120000"], ["山东", "370000"], ["陕西", "610000"], ["河南", "410000"],
    ["江苏", "320000"], ["安徽", "340000"], ["四川", "510000"], ["重庆", "500000"],
    ["湖北", "420000"], ["浙江", "330000"], ["上海", "310000"], ["云南", "530000"],
    ["贵州", "520000"], ["湖南", "430000"], ["江西", "360000"], ["福建", "350000"],
    ["广西", "450000"], ["广东", "440000"], ["海南", "460000"], ["香港", "810000"],
    ["澳门", "820000"], ["台湾", "710000"],
  ];
  const PROVINCE_CENTERS = {
    110000: [116.4074, 39.9042], 120000: [117.2008, 39.0842], 130000: [114.5149, 38.0428],
    140000: [112.5492, 37.857], 150000: [111.7492, 40.8426], 210000: [123.4315, 41.8057],
    220000: [125.3235, 43.8171], 230000: [126.6424, 45.756], 310000: [121.4737, 31.2304],
    320000: [118.7969, 32.0603], 330000: [120.1551, 30.2741], 340000: [117.2272, 31.8206],
    350000: [119.2965, 26.0745], 360000: [115.8582, 28.6829], 370000: [117.1201, 36.6512],
    410000: [113.6254, 34.7466], 420000: [114.3054, 30.5931], 430000: [112.9388, 28.2282],
    440000: [113.2644, 23.1291], 450000: [108.3669, 22.817], 460000: [110.1983, 20.044],
    500000: [106.5516, 29.563], 510000: [104.0665, 30.5723], 520000: [106.6302, 26.6477],
    530000: [102.8329, 24.8801], 540000: [91.1409, 29.6456], 610000: [108.9398, 34.3416],
    620000: [103.8343, 36.0611], 630000: [101.7782, 36.6171], 640000: [106.2309, 38.4872],
    650000: [87.6168, 43.8256], 710000: [121.5654, 25.033], 810000: [114.1694, 22.3193],
    820000: [113.5439, 22.1987],
  };
  const PROVINCE_DISPLAY_NAMES = {
    北京: "北京市", 天津: "天津市", 上海: "上海市", 重庆: "重庆市",
    香港: "香港特别行政区", 澳门: "澳门特别行政区",
    内蒙古: "内蒙古自治区", 广西: "广西壮族自治区", 西藏: "西藏自治区",
    宁夏: "宁夏回族自治区", 新疆: "新疆维吾尔自治区", 台湾: "台湾省",
  };
  const PROVINCE_TRIPS = new Map([
    ["110000", { tripId: "text-roll", label: "查看北京旅行卷宗" }],
    ["140000", { tripId: "shanxi", label: "查看山西旅行卷宗" }],
    ["210000", { tripId: "dalian", label: "查看辽宁旅行卷宗" }],
    ["330000", { tripId: "hangzhou", label: "查看浙江旅行卷宗" }],
    ["810000", { tripId: "hong-kong", label: "查看香港旅行卷宗" }],
  ]);

  const state = {
    initialized: false,
    loading: false,
    controlsBound: false,
    AMap: null,
    map: null,
    countryLayer: null,
    provinceLayer: null,
    amapPromise: null,
  };

  const config = { ...(window.TRAVEL_ROLLS_CONFIG || {}) };
  const container = document.querySelector("#amap-container");
  const fallback = document.querySelector("#map-fallback");
  const loadingPoster = document.querySelector("#map-loading-poster");
  const status = document.querySelector("#map-status");
  const source = document.querySelector("#map-source");
  const provinceSelect = document.querySelector("#province-select");
  const nationwideButton = document.querySelector("#map-nationwide");
  const provinceTripButton = document.querySelector("#province-trip-button");

  function normalizeAdcode(value) {
    return String(value || "").padStart(6, "0").slice(0, 6);
  }

  function cityVisit(adcode) {
    const normalized = normalizeAdcode(adcode);
    const directMunicipality = {
      110100: "110000",
      120100: "120000",
      310100: "310000",
      500100: "500000",
      500200: "500000",
    };
    return CITY_VISITS.get(normalized) || CITY_VISITS.get(directMunicipality[normalized]);
  }

  function fillFor(properties) {
    const visit = cityVisit(properties.adcode_cit || properties.adcode);
    return COLORS[Math.min(4, visit?.count || 0)];
  }

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  async function loadVisitData() {
    if (!config.apiBase) return;
    const response = await fetch(`${String(config.apiBase).replace(/\/$/, "")}/api/map`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("map_data_unavailable");
    const body = await response.json();
    if (!Array.isArray(body.cities)) return;
    CITY_VISITS.clear();
    PROVINCE_TRIPS.clear();
    const provinceCounts = new Map();
    body.cities.forEach((city) => {
      const cityCode = normalizeAdcode(city.city_code);
      const provinceCode = normalizeAdcode(city.province_code || `${cityCode.slice(0, 2)}0000`);
      CITY_VISITS.set(cityCode, {
        count: Number(city.visit_count || 0),
        tripId: city.trip_id,
        name: city.display_name || city.official_name,
        center: [Number(city.center_lng), Number(city.center_lat)],
        mediaCount: Number(city.media_count || 0),
      });
      provinceCounts.set(provinceCode, Math.max(provinceCounts.get(provinceCode) || 0, Number(city.visit_count || 0)));
      if (!PROVINCE_TRIPS.has(provinceCode) && city.trip_id) {
        const provinceName = PROVINCES.find(([, code]) => code === provinceCode)?.[0] || city.display_name;
        PROVINCE_TRIPS.set(provinceCode, { tripId: city.trip_id, label: `查看${provinceName}旅行卷宗` });
      }
    });
    document.querySelectorAll("[data-province]").forEach((button) => {
      const adcode = PROVINCES.find(([name]) => name === button.dataset.province)?.[1];
      const count = provinceCounts.get(adcode) || 0;
      button.classList.remove("visited-1", "visited-2", "visited-3", "visited-4");
      const oldCount = button.querySelector("small");
      if (oldCount) oldCount.remove();
      if (count) {
        button.classList.add(`visited-${Math.min(4, count)}`);
        const label = document.createElement("small");
        label.textContent = `${count}次`;
        button.append(label);
      }
    });
  }

  function loadScript(src) {
    if (window.AMap) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-amap-loader="true"]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.amapLoader = "true";
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error("amap_script_failed")), { once: true });
      document.head.append(script);
    });
  }

  async function resolvePublicMapConfig() {
    if (config.amapKey || !config.amapServiceHost) return;
    const endpoint = `${config.amapServiceHost.replace(/\/$/, "")}/config`;
    const response = await fetch(endpoint, { credentials: "omit" });
    if (!response.ok) throw new Error("map_config_unavailable");
    const remoteConfig = await response.json();
    if (typeof remoteConfig.amapKey === "string") config.amapKey = remoteConfig.amapKey.trim();
  }

  async function loadAMap() {
    if (state.AMap) return state.AMap;
    if (state.amapPromise) return state.amapPromise;
    state.amapPromise = (async () => {
    if (!config.amapKey || !config.amapServiceHost) throw new Error("map_not_configured");
    window._AMapSecurityConfig = {
      serviceHost: `${config.amapServiceHost.replace(/\/$/, "")}/_AMapService`,
    };
    const params = new URLSearchParams({
      v: "2.0",
      key: config.amapKey,
      plugin: "AMap.DistrictLayer,AMap.Scale,AMap.ToolBar",
    });
    await loadScript(`https://webapi.amap.com/maps?${params}`);
    if (!window.AMap) throw new Error("amap_unavailable");
    state.AMap = window.AMap;
    return state.AMap;
    })().catch((error) => {
      state.amapPromise = null;
      throw error;
    });
    return state.amapPromise;
  }

  function loadAmapPlugin(name) {
    return new Promise((resolve, reject) => {
      state.AMap.plugin(name, () => {
        if (state.AMap.DistrictSearch) resolve();
        else reject(new Error("amap_district_search_unavailable"));
      });
    });
  }

  function districtSearch(options, keyword) {
    return new Promise((resolve, reject) => {
      const search = new state.AMap.DistrictSearch(options);
      search.search(keyword, (statusCode, result) => {
        if (statusCode === "complete" && result?.districtList?.[0]) resolve(result.districtList[0]);
        else reject(new Error("amap_district_search_failed"));
      });
    });
  }

  async function listProvinceCities(provinceAdcode) {
    const entry = PROVINCES.find(([, code]) => code === String(provinceAdcode));
    if (!entry) throw new Error("invalid_province");
    await resolvePublicMapConfig();
    await loadAMap();
    await loadAmapPlugin("AMap.DistrictSearch");
    const [provinceName, provinceCode] = entry;
    const center = PROVINCE_CENTERS[provinceCode] || [104.2, 35.7];
    const directRegions = new Set(["11", "12", "31", "50", "71", "81", "82"]);
    if (directRegions.has(provinceCode.slice(0, 2))) {
      return [{
        provinceCode,
        cityCode: provinceCode,
        officialName: PROVINCE_DISPLAY_NAMES[provinceName] || `${provinceName}省`,
        displayName: provinceName,
        centerLng: center[0],
        centerLat: center[1],
      }];
    }
    const district = await districtSearch({ level: "province", subdistrict: 1, extensions: "base" }, provinceCode);
    return (district.districtList || [])
      .filter((city) => /^\d{6}$/.test(String(city.adcode || "")))
      .map((city) => {
        const cityCenter = Array.isArray(city.center)
          ? city.center
          : [Number(city.center?.lng), Number(city.center?.lat)];
        return {
          provinceCode,
          cityCode: String(city.adcode),
          officialName: String(city.name || ""),
          displayName: String(city.name || "").replace(/市$/u, "") || String(city.name || ""),
          centerLng: Number(cityCenter[0]),
          centerLat: Number(cityCenter[1]),
        };
      })
      .filter((city) => city.officialName && Number.isFinite(city.centerLng) && Number.isFinite(city.centerLat));
  }

  function createCountryLayer(AMap) {
    return new AMap.DistrictLayer.Country({
      SOC: "CHN",
      depth: 2,
      zIndex: 12,
      styles: {
        "stroke-width": 0.8,
        "nation-stroke": "#4f4b45",
        "coastline-stroke": "#7f7971",
        "province-stroke": "#fffaf2",
        "city-stroke": "rgba(255,250,242,.72)",
        fill: fillFor,
      },
    });
  }

  function createMap(AMap) {
    const map = new AMap.Map(container, {
      center: [104.2, 35.7],
      zoom: 4.1,
      viewMode: "2D",
      mapStyle: "amap://styles/whitesmoke",
      features: ["bg", "road", "point"],
      resizeEnable: true,
      dragEnable: true,
      zoomEnable: true,
      pitchEnable: false,
    });
    state.countryLayer = createCountryLayer(AMap);
    map.add(state.countryLayer);
    map.addControl(new AMap.Scale({ position: "LB" }));
    map.addControl(new AMap.ToolBar({ position: "RB", liteStyle: true }));
    return map;
  }

  function waitForMapComplete(map) {
    return new Promise((resolve) => {
      if (typeof map?.on !== "function") {
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      map.on("complete", finish);
      setTimeout(finish, 5000);
    });
  }

  function renderVisitedCityList(provinceAdcode) {
    const cityList = document.querySelector("#city-list");
    cityList.replaceChildren();
    const provincePrefix = String(provinceAdcode).slice(0, 2);
    const cities = [...CITY_VISITS.entries()].filter(([adcode]) => adcode.startsWith(provincePrefix));
    cities.forEach(([, visit]) => {
      const button = document.createElement("button");
      const name = document.createElement("span");
      const center = document.createElement("small");
      const count = document.createElement("b");
      name.textContent = visit.name;
      center.textContent = `${visit.center[1].toFixed(4)}° N, ${visit.center[0].toFixed(4)}° E`;
      count.textContent = `${visit.mediaCount || 0}张 · 到访${visit.count}次`;
      button.append(name, center, count);
      button.dataset.openTrip = visit.tripId;
      cityList.append(button);
    });
    if (!cities.length) {
      const empty = document.createElement("p");
      empty.className = "city-list-empty";
      empty.textContent = "该地区暂无已发布的旅行城市。";
      cityList.append(empty);
    }
  }

  function updateProvincePanel(name, adcode) {
    const displayName = PROVINCE_DISPLAY_NAMES[name] || `${name}省`;
    document.querySelector("#province-name").textContent = displayName;
    document.querySelector("#province-summary").textContent =
      name === "山西"
        ? "一段穿过古建、石窟与雨后红墙的夏末行程。"
        : "按地级市区域显示到访次数；未到访城市保持浅灰色。";
    renderVisitedCityList(adcode);

    const provinceTrip = PROVINCE_TRIPS.get(String(adcode));
    provinceTripButton.hidden = !provinceTrip;
    if (!provinceTrip) {
      provinceTripButton.removeAttribute("data-open-trip");
      provinceTripButton.replaceChildren();
      return;
    }
    provinceTripButton.dataset.openTrip = provinceTrip.tripId;
    const arrow = document.createElement("span");
    arrow.textContent = "↗";
    provinceTripButton.replaceChildren(document.createTextNode(`${provinceTrip.label} `), arrow);
  }

  function selectProvince(name, adcode) {
    updateProvincePanel(name, adcode);
    provinceSelect.value = adcode;
    nationwideButton.hidden = false;
    if (!state.initialized) return;
    setStatus(`正在载入${name}地级市边界…`);
    try {
      if (state.countryLayer) state.countryLayer.hide();
      if (state.provinceLayer) state.map.remove(state.provinceLayer);
      state.provinceLayer = new state.AMap.DistrictLayer.Province({
        adcode,
        depth: 1,
        zIndex: 13,
        styles: {
          "stroke-width": 1,
          "province-stroke": "#4f4b45",
          "city-stroke": "#fffaf2",
          fill: fillFor,
        },
      });
      state.map.add(state.provinceLayer);
      const center = PROVINCE_CENTERS[adcode] || [104.2, 35.7];
      state.map.setZoomAndCenter(["北京", "天津", "上海", "重庆", "香港", "澳门"].includes(name) ? 7 : 6, center);
      setStatus(`已显示${PROVINCE_DISPLAY_NAMES[name] || `${name}省`}地级市边界`, "ready");
    } catch (error) {
      console.error("province_map_failed", error);
      setStatus(`${name}地图载入失败，请稍后重试`, "error");
    }
  }

  function showNationwide() {
    if (state.initialized && state.provinceLayer) {
      state.map.remove(state.provinceLayer);
      state.provinceLayer = null;
    }
    if (state.initialized) {
      state.countryLayer.show();
      state.map.setZoomAndCenter(4.1, [104.2, 35.7]);
    }
    provinceSelect.value = "";
    nationwideButton.hidden = true;
    provinceTripButton.hidden = true;
    provinceTripButton.removeAttribute("data-open-trip");
    provinceTripButton.replaceChildren();
    document.querySelector("#province-name").textContent = "中国";
    document.querySelector("#province-summary").textContent = "选择一个省级行政区，查看地级市边界与旅行记录。";
    document.querySelector("#city-list").replaceChildren();
    setStatus("全国地级市访问图已载入", "ready");
  }

  function bindControls() {
    if (state.controlsBound) return;
    state.controlsBound = true;
    provinceSelect.replaceChildren(new Option("选择省级行政区", ""));
    PROVINCES.forEach(([name, adcode]) => provinceSelect.add(new Option(name, adcode)));
    provinceSelect.addEventListener("change", () => {
      const entry = PROVINCES.find(([, adcode]) => adcode === provinceSelect.value);
      if (entry) selectProvince(entry[0], entry[1]);
    });
    nationwideButton.addEventListener("click", showNationwide);
    document.querySelectorAll("[data-province]").forEach((button) => {
      button.addEventListener("click", () => {
        const entry = PROVINCES.find(([name]) => name === button.dataset.province);
        if (entry) selectProvince(entry[0], entry[1]);
      });
    });
  }

  async function initialize() {
    if (state.initialized || state.loading) return;
    state.loading = true;
    bindControls();
    try {
      await loadVisitData().catch((error) => console.warn("map_data_fallback", error));
      await resolvePublicMapConfig();
      if (!config.amapKey || !config.amapServiceHost) throw new Error("map_not_configured");
      setStatus("正在安全载入高德地图…");
      state.AMap = await loadAMap();
      container.hidden = false;
      state.map = createMap(state.AMap);
      state.initialized = true;
      await waitForMapComplete(state.map);
      requestAnimationFrame(() => container.classList.add("ready"));
      loadingPoster.hidden = true;
      fallback.hidden = true;
      source.textContent = "地图服务：高德地图 JS API 2.0；审图号与版权信息由地图服务在画布中展示。";
      showNationwide();
    } catch (error) {
      console.error("china_map_failed", error);
      loadingPoster.hidden = true;
      container.hidden = true;
      fallback.hidden = false;
      setStatus("地图服务载入失败，已切换至行政区导航", "error");
      source.textContent = "地图服务暂不可用；当前未展示任何未经确认的行政区边界。";
    } finally {
      state.loading = false;
    }
  }

  window.TravelRollsMap = Object.freeze({
    activate() {
      initialize();
      if (state.map) setTimeout(() => state.map.resize(), 0);
    },
    selectProvince,
    showNationwide,
    provinces: PROVINCES.map(([name, adcode]) => ({ name, adcode })),
    listProvinceCities,
  });
})();
