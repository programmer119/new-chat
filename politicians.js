const officeQueries = [
  { id: "governor", label: "시·도지사", sgTypecode: "3", regions: ["서울특별시", "경기도", "부산광역시", "세종특별자치시", "제주특별자치도"] },
  { id: "education", label: "교육감", sgTypecode: "11", regions: ["서울특별시", "경기도", "부산광역시", "세종특별자치시", "제주특별자치도"] },
  { id: "chief", label: "자치구·시·군의 장", sgTypecode: "4", regions: ["서울특별시", "경기도", "부산광역시"] },
  { id: "metroDistrict", label: "지역구 시·도의원", sgTypecode: "5", regions: ["서울특별시", "경기도", "부산광역시", "세종특별자치시", "제주특별자치도"] },
  { id: "metroPr", label: "비례대표 시·도의원", sgTypecode: "7", regions: ["서울특별시", "경기도", "부산광역시", "세종특별자치시", "제주특별자치도"] },
  { id: "localDistrict", label: "지역구 자치구·시·군의원", sgTypecode: "6", regions: ["서울특별시", "경기도", "부산광역시"] },
  { id: "localPr", label: "비례대표 자치구·시·군의원", sgTypecode: "8", regions: ["서울특별시", "경기도", "부산광역시"] },
  { id: "jejuEdu", label: "제주 교육의원", sgTypecode: "10", regions: ["제주특별자치도"] },
];

const apiStatus = document.querySelector("#apiStatus");
const politicianList = document.querySelector("#politicianList");
const loadAllButton = document.querySelector("#loadAll");
const sgIdInput = document.querySelector("#sgIdInput");
const sortButtons = document.querySelectorAll("[data-sort]");

let politicians = [];
let sortMode = "name";

sgIdInput.value = localStorage.getItem("publicfitSgId") || "20260603";

function setStatus(message, kind = "") {
  apiStatus.textContent = message;
  apiStatus.className = `api-status ${kind}`.trim();
}

function renderList() {
  const sorted = [...politicians].sort((a, b) => {
    if (sortMode === "office") return a.office.localeCompare(b.office, "ko") || a.name.localeCompare(b.name, "ko");
    if (sortMode === "record") return b.publicRecordScore - a.publicRecordScore;
    if (sortMode === "bills") return compareNullable(b.billCount, a.billCount) || a.name.localeCompare(b.name, "ko");
    if (sortMode === "passed") return compareNullable(b.passedBillCount, a.passedBillCount) || a.name.localeCompare(b.name, "ko");
    return a.name.localeCompare(b.name, "ko");
  });

  politicianList.innerHTML = sorted.length
    ? sorted.map(renderPolitician).join("")
    : `<article class="candidate-card empty-card"><h3>조회된 정치인 없음</h3><p class="muted">홈에서 키를 저장하고 전체 조회를 눌러주세요.</p></article>`;
}

function compareNullable(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

function renderPolitician(item) {
  return `
    <article class="candidate-card politician-card">
      <div class="candidate-head">
        <div>
          <h3>${item.name}</h3>
          <p class="muted">${item.office} · ${item.region} · ${item.district || "선거구 미상"}</p>
        </div>
        <span class="party ${partyClass(item.party)}">${item.party}</span>
      </div>
      <p class="muted">${item.job || "직업 미상"} · ${item.age ? `${item.age}세` : "연령 미상"} · ${item.status || "등록상태 미상"}</p>
      <div class="score-row">
        <div class="score-box">
          <span>지방선거 출마</span>
          <strong>출마</strong>
        </div>
        <div class="score-box">
          <span>공공기록 점수</span>
          <strong>${item.publicRecordScore}</strong>
          <div class="meter" style="--value: ${item.publicRecordScore}%"><i></i></div>
        </div>
      </div>
      <div class="legis-line">
        <span class="pill">발의수 ${item.billCount ?? "연결 필요"}</span>
        <span class="pill">발의성공수 ${item.passedBillCount ?? "연결 필요"}</span>
        <span class="pill">${item.source}</span>
      </div>
    </article>
  `;
}

function partyClass(party) {
  if (party.includes("더불어") || party.includes("민주")) return "dem";
  if (party.includes("국민의힘")) return "rep";
  return "ind";
}

async function loadAllPoliticians() {
  const serviceKey = localStorage.getItem("publicfitApiKey") || "";
  const sgId = sgIdInput.value.trim() || "20260603";
  localStorage.setItem("publicfitSgId", sgId);

  if (!serviceKey) {
    setStatus("홈에서 ServiceKey를 먼저 저장하세요.", "error");
    return;
  }

  politicians = [];
  renderList();
  setStatus("실제 후보자 정보를 조회 중입니다...");

  const results = [];
  let completed = 0;
  const total = officeQueries.reduce((sum, query) => sum + query.regions.length, 0);

  for (const query of officeQueries) {
    for (const region of query.regions) {
      completed += 1;
      setStatus(`조회 중 ${completed}/${total}: ${query.label}, ${region}`);
      try {
        const items = await fetchNecCandidates(serviceKey, {
          sgId,
          sgTypecode: query.sgTypecode,
          sdName: region,
        });
        items.forEach((item, index) => results.push(apiCandidateToPolitician(item, query, region, index)));
      } catch (error) {
        console.warn(error);
      }
    }
  }

  politicians = dedupePoliticians(results);
  renderList();
  setStatus(`실제 후보자 ${politicians.length}명을 불러왔습니다.`, politicians.length ? "success" : "");
}

async function fetchNecCandidates(serviceKey, query) {
  const urls = buildNecCandidateUrls(serviceKey, {
    pageNo: "1",
    numOfRows: "100",
    ...query,
    _type: "json",
  });
  const raw = await fetchFirstWorkingNecUrl(urls);
  try {
    const json = JSON.parse(raw);
    const body = json?.response?.body || json?.body || {};
    const header = json?.response?.header || json?.header || {};
    if (header.resultCode && header.resultCode !== "INFO-00" && header.resultCode !== "00") {
      throw new Error(header.resultMsg || "API 오류");
    }
    return normalizeItems(body.items);
  } catch {
    return xmlToItems(raw);
  }
}

function buildNecCandidateUrls(serviceKey, query) {
  const endpoint = "http://apis.data.go.kr/9760000/PofelcddInfoInqireService/getPoelpcddRegistSttusInfoInqire";
  const queryWithoutKey = new URLSearchParams(query).toString();
  const trimmedKey = serviceKey.trim();
  const urls = [];
  try {
    const decodedKey = decodeURIComponent(trimmedKey);
    urls.push(`${endpoint}?${new URLSearchParams({ ServiceKey: decodedKey, ...query }).toString()}`);
  } catch {
    urls.push(`${endpoint}?${new URLSearchParams({ ServiceKey: trimmedKey, ...query }).toString()}`);
  }
  urls.push(`${endpoint}?ServiceKey=${trimmedKey}&${queryWithoutKey}`);
  urls.push(`${endpoint}?ServiceKey=${encodeURIComponent(trimmedKey)}&${queryWithoutKey}`);
  return [...new Set(urls)];
}

async function fetchFirstWorkingNecUrl(urls) {
  const errors = [];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      const raw = await response.text();
      if (response.ok) return raw;
      errors.push(`HTTP ${response.status}`);
    } catch (error) {
      errors.push(error.message);
    }
  }
  throw new Error(errors.join(" / "));
}

function normalizeItems(items) {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (Array.isArray(items.item)) return items.item;
  if (items.item) return [items.item];
  return [];
}

function xmlToItems(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) return [];
  return [...doc.querySelectorAll("item")].map((item) => {
    const result = {};
    [...item.children].forEach((child) => {
      result[child.tagName] = child.textContent || "";
    });
    return result;
  });
}

function apiCandidateToPolitician(item, query, region, index) {
  const safe = Object.fromEntries(
    Object.entries(item).map(([key, value]) => [key, escapeHtml(String(value || ""))]),
  );
  const rawInfo = {
    성명: safe.name || safe.krName,
    정당: safe.jdName || safe.partyName,
    선거구: safe.sggName,
    성별: safe.gender,
    연령: safe.age,
    주소: safe.addr,
    직업: safe.job,
    학력: safe.edu,
    경력1: safe.career1,
    등록일: safe.regdate,
    등록상태: safe.status,
  };
  return {
    id: safe.huboid || `${query.id}-${region}-${index}`,
    name: safe.name || safe.krName || "이름 미상",
    party: safe.jdName || safe.partyName || "정당 미상",
    age: safe.age,
    job: safe.job,
    status: safe.status,
    office: query.label,
    region,
    district: safe.sggName,
    publicRecordScore: computePublicRecordScore(rawInfo),
    billCount: null,
    passedBillCount: null,
    source: "중앙선관위 후보자 정보 API",
  };
}

function computePublicRecordScore(rawInfo) {
  const fields = ["성명", "정당", "선거구", "성별", "연령", "주소", "직업", "학력", "경력1", "등록일", "등록상태"];
  const present = fields.filter((field) => rawInfo[field] && rawInfo[field] !== "-").length;
  return Math.round((present / fields.length) * 100);
}

function dedupePoliticians(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = item.id || `${item.name}:${item.office}:${item.region}:${item.district}`;
    if (!map.has(key)) map.set(key, item);
  });
  return [...map.values()];
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

loadAllButton.addEventListener("click", loadAllPoliticians);
sortButtons.forEach((button) => {
  button.addEventListener("click", () => {
    sortMode = button.dataset.sort;
    sortButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderList();
  });
});

renderList();
if (localStorage.getItem("publicfitApiKey")) {
  loadAllPoliticians();
}
