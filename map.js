(function () {
  const COLORS = ["#e4e2dc", "#f7c8ae", "#efa078", "#df7447", "#a9431e"];
  const CITY_VISITS = new Map([
    ["110000", { count: 1, tripId: "text-roll" }],
    ["140100", { count: 1, tripId: "shanxi" }],
    ["140200", { count: 1, tripId: "shanxi" }],
    ["210200", { count: 1, tripId: "dalian" }],
    ["330100", { count: 1, tripId: "hangzhou" }],
    ["810000", { count: 1, tripId: "hong-kong" }],
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

  const state = {
    initialized: false,
    loading: false,
    controlsBound: false,
    AMap: null,
    map: null,
    countryLayer: null,
    provinceLayer: null,
  };

  const config = window.TRAVEL_ROLLS_CONFIG || {};
  const container = document.querySelector("#amap-container");
  const fallback = document.querySelector("#map-fallback");
  const status = document.querySelector("#map-status");
  const source = document.querySelector("#map-source");
  const provinceSelect = document.querySelector("#province-select");
  const nationwideButton = document.querySelector("#map-nationwide");

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

  function loadScript(src) {
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

  async function loadAMap() {
    if (!config.amapKey || !config.amapServiceHost) throw new Error("map_not_configured");
    window._AMapSecurityConfig = {
      serviceHost: `${config.amapServiceHost.replace(/\/$/, "")}/_AMapService`,
    };
    const params = new URLSearchParams({
      v: "2.0",
      key: config.amapKey,
      plugin: "AMap.DistrictLayer,AMap.DistrictSearch,AMap.Scale,AMap.ToolBar",
    });
    await loadScript(`https://webapi.amap.com/maps?${params}`);
    if (!window.AMap) throw new Error("amap_unavailable");
    return window.AMap;
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

  function searchDistrict(adcode, level, extensions = "base") {
    return new Promise((resolve, reject) => {
      const search = new state.AMap.DistrictSearch({ level, subdistrict: 1, extensions, showbiz: false });
      search.search(adcode, (searchStatus, result) => {
        if (searchStatus !== "complete" || !result?.districtList?.[0]) {
          reject(new Error("district_search_failed"));
          return;
        }
        resolve(result.districtList[0]);
      });
    });
  }

  function renderCityList(province) {
    const cityList = document.querySelector("#city-list");
    cityList.replaceChildren();
    const cities = province.districtList || [];
    cities.forEach((city) => {
      const adcode = normalizeAdcode(city.adcode);
      const visit = cityVisit(adcode);
      const button = document.createElement("button");
      const name = document.createElement("span");
      const center = document.createElement("small");
      const count = document.createElement("b");
      name.textContent = city.name;
      center.textContent = city.center
        ? `${Number(city.center.lat).toFixed(4)}° N, ${Number(city.center.lng).toFixed(4)}° E`
        : "中心坐标待返回";
      count.textContent = visit ? `到访${visit.count}次` : "—";
      button.append(name, center, count);
      if (visit?.tripId) button.dataset.openTrip = visit.tripId;
      else button.disabled = true;
      cityList.append(button);
    });
    if (!cities.length) {
      const empty = document.createElement("p");
      empty.className = "city-list-empty";
      empty.textContent = "该地区暂未返回地级市列表。";
      cityList.append(empty);
    }
  }

  async function selectProvince(name, adcode) {
    if (!state.initialized) return;
    setStatus(`正在载入${name}地级市边界…`);
    try {
      const province = await searchDistrict(adcode, "province");
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
      if (province.center) state.map.setZoomAndCenter(["北京", "天津", "上海", "重庆"].includes(name) ? 7 : 6, province.center);
      document.querySelector("#province-name").textContent = province.name || name;
      document.querySelector("#province-summary").textContent = "按地级市区域显示到访次数；未到访城市保持浅灰色。";
      renderCityList(province);
      provinceSelect.value = adcode;
      nationwideButton.hidden = false;
      setStatus(`已显示${province.name || name}地级市边界`, "ready");
    } catch (error) {
      console.error("province_map_failed", error);
      setStatus(`${name}地图载入失败，请稍后重试`, "error");
    }
  }

  function showNationwide() {
    if (!state.initialized) return;
    if (state.provinceLayer) {
      state.map.remove(state.provinceLayer);
      state.provinceLayer = null;
    }
    state.countryLayer.show();
    state.map.setZoomAndCenter(4.1, [104.2, 35.7]);
    provinceSelect.value = "";
    nationwideButton.hidden = true;
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
        if (entry && state.initialized) selectProvince(entry[0], entry[1]);
      });
    });
  }

  async function initialize() {
    if (state.initialized || state.loading) return;
    state.loading = true;
    bindControls();
    if (!config.amapKey || !config.amapServiceHost) {
      setStatus("地图代码已就绪，等待配置高德 JS Key 与安全代理", "waiting");
      source.textContent = "地图服务待配置；密钥不得提交到公开仓库。";
      state.loading = false;
      return;
    }
    try {
      setStatus("正在安全载入高德地图…");
      state.AMap = await loadAMap();
      state.map = createMap(state.AMap);
      state.initialized = true;
      container.hidden = false;
      fallback.hidden = true;
      source.textContent = "地图服务：高德地图 JS API 2.0；审图号与版权信息由地图服务在画布中展示。";
      showNationwide();
    } catch (error) {
      console.error("china_map_failed", error);
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
  });
})();
