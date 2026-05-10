const text = {
  dataMissing: "데이터 없음",
  fitScore: "정책 적합도",
  publicRecord: "공공기록 점수",
  candidateDetail: "후보 상세",
  sponsored: "조례/의안 발의",
  cosponsored: "공동발의",
  enacted: "가결/공포",
  successRate: "성사율",
  committeePassed: "위원회 통과",
  floorVotes: "본회의 표결",
  bipartisan: "초당적 공동발의",
  notableBills: "의정활동/공약 데이터",
  scoreReasons: "데이터 상태",
};

const criteria = [
  { id: "economy", label: "지역경제/일자리", value: 22 },
  { id: "health", label: "복지/돌봄", value: 18 },
  { id: "climate", label: "기후/재난안전", value: 14 },
  { id: "ethics", label: "윤리/투명성", value: 20 },
  { id: "housing", label: "주거/교통", value: 14 },
  { id: "education", label: "교육/청년", value: 12 },
];

const localElectionOffices = [
  {
    id: "governor",
    title: "시·도지사",
    detail: "특별시장, 광역시장, 도지사, 특별자치시장, 특별자치도지사를 뽑습니다.",
    regions: ["general", "sejong", "jeju"],
  },
  {
    id: "education-superintendent",
    title: "교육감",
    detail: "각 시·도의 교육행정을 책임지는 교육감을 뽑습니다.",
    regions: ["general", "sejong", "jeju"],
  },
  {
    id: "mayor-county-chief",
    title: "자치구·시·군의 장",
    detail: "구청장, 시장, 군수를 뽑습니다. 세종과 제주는 이 선거가 따로 없습니다.",
    regions: ["general"],
  },
  {
    id: "metro-district-council",
    title: "지역구 시·도의원",
    detail: "광역의회 지역구 의원을 뽑습니다.",
    regions: ["general", "sejong", "jeju"],
  },
  {
    id: "metro-pr-council",
    title: "비례대표 시·도의원",
    detail: "정당 득표율에 따라 광역의회 비례대표 의원을 뽑습니다.",
    regions: ["general", "sejong", "jeju"],
  },
  {
    id: "local-district-council",
    title: "지역구 자치구·시·군의원",
    detail: "기초의회 지역구 의원을 뽑습니다. 세종과 제주는 제외됩니다.",
    regions: ["general"],
  },
  {
    id: "local-pr-council",
    title: "비례대표 자치구·시·군의원",
    detail: "정당 득표율에 따라 기초의회 비례대표 의원을 뽑습니다. 세종과 제주는 제외됩니다.",
    regions: ["general"],
  },
  {
    id: "jeju-education-council",
    title: "제주 교육의원",
    detail: "제주에서는 교육의원 선거가 추가됩니다.",
    regions: ["jeju"],
    special: true,
  },
];

const regionLabels = {
  all: "전체 기준",
  general: "일반 지역",
  sejong: "세종",
  jeju: "제주",
};

const subregionOptions = {
  all: [
    { value: "seoul", label: "서울특별시" },
    { value: "gyeonggi", label: "경기도" },
    { value: "busan", label: "부산광역시" },
    { value: "sejong-city", label: "세종특별자치시" },
    { value: "jeju-city", label: "제주특별자치도" },
  ],
  general: [
    { value: "seoul", label: "서울특별시" },
    { value: "gyeonggi", label: "경기도" },
    { value: "busan", label: "부산광역시" },
  ],
  sejong: [{ value: "sejong-city", label: "세종특별자치시" }],
  jeju: [{ value: "jeju-city", label: "제주특별자치도" }],
};

const sgTypeCodes = {
  governor: "3",
  "mayor-county-chief": "4",
  "metro-district-council": "5",
  "local-district-council": "6",
  "metro-pr-council": "7",
  "local-pr-council": "8",
  "jeju-education-council": "10",
  "education-superintendent": "11",
};

const sdNameBySubregion = {
  seoul: "서울특별시",
  gyeonggi: "경기도",
  busan: "부산광역시",
  "sejong-city": "세종특별자치시",
  "jeju-city": "제주특별자치도",
};

const defaultSgId = "20260603";
const realCandidateCache = {};

let selectedRegion = "all";
let selectedOfficeId = "governor";
let selectedSubregion = "seoul";
let selectedCandidateId = "";
let useRealApi = false;

const weightRoot = document.querySelector("#weights");
const officeList = document.querySelector("#officeList");
const regionFilter = document.querySelector("#regionFilter");
const candidateExplorer = document.querySelector("#candidateExplorer");
const candidateGrid = document.querySelector("#candidateGrid");
const detailPanel = document.querySelector("#detailPanel");
const resetButton = document.querySelector("#resetWeights");
const apiKeyInput = document.querySelector("#apiKey");
const sgIdInput = document.querySelector("#sgIdInput");
const loadApiCandidatesButton = document.querySelector("#loadApiCandidates");
const useDemoCandidatesButton = document.querySelector("#useDemoCandidates");
const apiStatus = document.querySelector("#apiStatus");

function currentCandidates() {
  if (!useRealApi) return [];
  return realCandidateCache[realCacheKey()] || [];
}

function realCacheKey() {
  return `${selectedOfficeId}:${selectedSubregion}`;
}

function subregionLabel(value) {
  return (
    Object.values(subregionOptions)
      .flat()
      .find((option) => option.value === value)?.label || value
  );
}

function renderWeights() {
  weightRoot.innerHTML = criteria
    .map(
      (item) => `
        <div class="weight-control">
          <div class="weight-top">
            <label for="${item.id}">${item.label}</label>
            <output id="${item.id}-output">${item.value}</output>
          </div>
          <input id="${item.id}" type="range" min="0" max="40" value="${item.value}" disabled />
        </div>
      `,
    )
    .join("");
}

function activeOfficesForRegion() {
  return localElectionOffices.filter(
    (office) => selectedRegion === "all" || office.regions.includes(selectedRegion),
  );
}

function subregionsForSelection() {
  const selectedOffice = localElectionOffices.find((office) => office.id === selectedOfficeId);
  const options = subregionOptions[selectedRegion] || subregionOptions.all;
  if (!selectedOffice) return options;
  return options.filter((option) => {
    const generalValues = ["seoul", "gyeonggi", "busan"];
    if (selectedOffice.regions.includes("general") && generalValues.includes(option.value)) return true;
    if (selectedOffice.regions.includes("sejong") && option.value === "sejong-city") return true;
    if (selectedOffice.regions.includes("jeju") && option.value === "jeju-city") return true;
    return false;
  });
}

function ensureOfficeAndSubregion() {
  const activeOfficeIds = activeOfficesForRegion().map((office) => office.id);
  if (!activeOfficeIds.includes(selectedOfficeId)) {
    selectedOfficeId = activeOfficeIds[0] || "governor";
  }

  const options = subregionsForSelection();
  if (!options.some((option) => option.value === selectedSubregion)) {
    selectedSubregion = options[0]?.value || "seoul";
  }
}

function ensureSelectedCandidate() {
  const candidates = currentCandidates();
  if (!candidates.some((candidate) => candidate.id === selectedCandidateId)) {
    selectedCandidateId = candidates[0]?.id || "";
  }
}

function renderOffices() {
  officeList.innerHTML = localElectionOffices
    .map((office, index) => {
      const isActive = selectedRegion === "all" || office.regions.includes(selectedRegion);
      const className = [
        "office-card",
        office.special ? "special" : "",
        isActive ? "" : "disabled",
        office.id === selectedOfficeId ? "active" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const availability = isActive
        ? selectedRegion === "all"
          ? office.regions.map((region) => regionLabels[region]).join(" · ")
          : `${regionLabels[selectedRegion]} 해당`
        : `${regionLabels[selectedRegion]} 해당 없음`;

      return `
        <article class="${className}" data-office-id="${office.id}" tabindex="${isActive ? "0" : "-1"}">
          <span class="office-number">${index + 1}</span>
          <h3>${office.title}</h3>
          <p>${office.detail}</p>
          <span class="availability">${availability}</span>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".office-card").forEach((card) => {
    card.addEventListener("click", () => selectOffice(card.dataset.officeId));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectOffice(card.dataset.officeId);
      }
    });
  });
}

function selectOffice(officeId) {
  const office = localElectionOffices.find((item) => item.id === officeId);
  if (!office) return;
  const isActive = selectedRegion === "all" || office.regions.includes(selectedRegion);
  if (!isActive) return;
  selectedOfficeId = officeId;
  ensureOfficeAndSubregion();
  ensureSelectedCandidate();
  renderAll();
  autoFetchIfReady("선출직이 바뀌어 실제 데이터를 다시 조회합니다.");
}

function renderCandidateExplorer() {
  ensureOfficeAndSubregion();
  const office = localElectionOffices.find((item) => item.id === selectedOfficeId);
  const options = subregionsForSelection();
  const candidates = currentCandidates();

  candidateExplorer.innerHTML = `
    <div class="explorer-head">
      <div>
        <h3>${office.title} 후보 리스트</h3>
        <p class="muted">선출직과 세부지역을 고른 뒤 API 조회를 누르면 실제 후보자가 표시됩니다.</p>
      </div>
      <div class="subregion-picker">
        <label for="subregionFilter">세부지역</label>
        <select id="subregionFilter">
          ${options
            .map(
              (option) =>
                `<option value="${option.value}" ${option.value === selectedSubregion ? "selected" : ""}>${option.label}</option>`,
            )
            .join("")}
        </select>
      </div>
    </div>
    <div class="local-candidate-grid">
      ${
        candidates.length
          ? candidates.map(renderLocalCandidate).join("")
          : `<article class="local-candidate"><h4>실제 후보 데이터 없음</h4><p class="muted">상단 ServiceKey를 입력하고 API 조회를 눌러주세요. 조회 전에는 후보를 표시하지 않습니다.</p></article>`
      }
    </div>
  `;

  document.querySelector("#subregionFilter").addEventListener("change", (event) => {
    selectedSubregion = event.target.value;
    ensureSelectedCandidate();
    renderAll();
    autoFetchIfReady("세부지역이 바뀌어 실제 데이터를 다시 조회합니다.");
  });
}

function renderLocalCandidate(candidate) {
  return `
    <article class="local-candidate">
      <h4>${candidate.name}</h4>
      <p class="muted">${candidate.party} · ${candidate.job || "후보자"}</p>
      ${renderMiniInfo(candidate.rawInfo)}
      <div class="candidate-stats">
        <span>${candidate.rawInfo?.등록상태 || "등록상태 확인"}</span>
        <span>${candidate.source}</span>
      </div>
    </article>
  `;
}

function renderMiniInfo(rawInfo) {
  const fields = ["선거구", "성별", "연령", "등록상태"];
  return `
    <dl class="mini-info">
      ${fields
        .filter((field) => rawInfo?.[field])
        .map((field) => `<div><dt>${field}</dt><dd>${rawInfo[field]}</dd></div>`)
        .join("")}
    </dl>
  `;
}

function renderCandidates() {
  ensureSelectedCandidate();
  const candidates = [...currentCandidates()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  if (!candidates.length) {
    candidateGrid.innerHTML = `
      <article class="candidate-card empty-card">
        <h3>실제 후보 데이터 없음</h3>
        <p class="muted">상단에서 ServiceKey와 선거ID를 확인한 뒤 API 조회를 눌러주세요. 이 영역에는 조회된 실제 후보만 표시합니다.</p>
      </article>
    `;
    return;
  }

  candidateGrid.innerHTML = candidates
    .map(
      (candidate) => `
        <article class="candidate-card ${candidate.id === selectedCandidateId ? "active" : ""}" data-id="${candidate.id}" tabindex="0">
          <div class="candidate-head">
            <div>
              <h3>${candidate.name}</h3>
              <p class="muted">${candidate.job || "후보자"} - ${candidate.district}</p>
            </div>
            <span class="party ${partyClass(candidate.party)}">${candidate.party}</span>
          </div>
          <p class="muted">${candidate.profile}</p>
          <div class="score-row">
            <div class="score-box">
              <span>정책 적합도</span>
              <strong>연결 필요</strong>
            </div>
            <div class="score-box">
              <span>공공기록 점수</span>
              <strong>${candidate.publicRecordScore}</strong>
              <div class="meter" style="--value: ${candidate.publicRecordScore}%"><i></i></div>
            </div>
          </div>
          ${renderMiniInfo(candidate.rawInfo)}
          <div class="legis-line">
            <span class="pill">정책 적합도 연결 필요</span>
            <span class="pill">공공기록 ${candidate.publicRecordScore}</span>
            <span class="pill">${candidate.rawInfo?.등록상태 || "등록상태 확인"}</span>
          </div>
        </article>
      `,
    )
    .join("");

  document.querySelectorAll(".candidate-card").forEach((card) => {
    card.addEventListener("click", () => selectCandidate(card.dataset.id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectCandidate(card.dataset.id);
      }
    });
  });
}

function partyClass(party) {
  if (party.includes("더불어") || party.includes("민주")) return "dem";
  if (party.includes("국민의힘")) return "rep";
  return "ind";
}

function selectCandidate(id) {
  selectedCandidateId = id;
  renderCandidates();
  renderDetail();
}

function renderRawInfo(rawInfo) {
  if (!rawInfo) return "";
  const rows = Object.entries(rawInfo).filter(([, value]) => value && value !== "-");
  if (!rows.length) return "";
  return `
    <h3>후보자 기본정보</h3>
    <div class="metric-list real-info">
      ${rows
        .map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`)
        .join("")}
    </div>
  `;
}

function renderPublicRecordBreakdown(breakdown) {
  if (!breakdown?.length) return "";
  return `
    <h3>공공기록 점수 근거</h3>
    <div class="record-breakdown">
      ${breakdown
        .map(
          (item) => `
            <div class="${item.present ? "present" : "missing"}">
              <span>${item.label}</span>
              <strong>${item.present ? "공개" : "미제공"}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderDetail() {
  ensureSelectedCandidate();
  const candidate = currentCandidates().find((item) => item.id === selectedCandidateId);
  if (!candidate) {
    detailPanel.innerHTML = `
      <p class="eyebrow">${text.candidateDetail}</p>
      <h2>실제 후보 데이터 없음</h2>
      <p class="muted">API 조회가 성공하면 선택한 후보의 선관위 원자료가 여기에 표시됩니다.</p>
    `;
    return;
  }

  detailPanel.innerHTML = `
    <p class="eyebrow">${text.candidateDetail}</p>
    <h2>${candidate.name}</h2>
    <p class="muted">${candidate.profile}</p>
    <div class="data-note">
      선관위 실제 후보자 기본정보입니다. 공공기록 점수는 후보자 정보 API의 공개 필드 완성도 기준이며, 정책 적합도와 조례/의안 성과는 별도 공약·회의록·조례 데이터 연결 후 계산합니다.
    </div>
    <div class="large-score">
      <div class="score-box">
        <span>정책 적합도</span>
        <strong>연결 필요</strong>
      </div>
      <div class="score-box">
        <span>공공기록 점수</span>
        <strong>${candidate.publicRecordScore}</strong>
      </div>
    </div>
    ${renderPublicRecordBreakdown(candidate.publicRecordBreakdown)}
    ${renderRawInfo(candidate.rawInfo)}

    <h3>${text.notableBills}</h3>
    <div class="metric-list">
      <div class="metric"><span>${text.sponsored}</span><strong>연결 필요</strong></div>
      <div class="metric"><span>${text.cosponsored}</span><strong>연결 필요</strong></div>
      <div class="metric"><span>${text.enacted}</span><strong>연결 필요</strong></div>
      <div class="metric"><span>${text.successRate}</span><strong>연결 필요</strong></div>
      <div class="metric"><span>${text.committeePassed}</span><strong>연결 필요</strong></div>
      <div class="metric"><span>${text.floorVotes}</span><strong>연결 필요</strong></div>
      <div class="metric"><span>${text.bipartisan}</span><strong>연결 필요</strong></div>
    </div>

    <h3>${text.scoreReasons}</h3>
    <ul class="reason-list">
      <li>현재 적용된 실제 데이터: 중앙선관위 후보자 정보 API</li>
      <li>공공기록 점수는 이름, 정당, 성별, 연령, 주소, 직업, 학력, 경력, 등록상태 등 실제 응답 필드의 공개 여부를 기준으로 계산합니다.</li>
      <li>아직 미연결 데이터: 공약, 조례/의안, 회의록, 정치자금, 재산/병역/납세 상세 데이터</li>
      <li>미연결 데이터는 임의 점수로 대체하지 않습니다.</li>
    </ul>
  `;
}

function setApiStatus(message, kind = "") {
  apiStatus.textContent = message;
  apiStatus.className = `api-status ${kind}`.trim();
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

async function fetchNecCandidates() {
  const serviceKey = apiKeyInput.value.trim();
  if (!serviceKey) {
    setApiStatus("공공데이터포털 ServiceKey를 입력해야 실제 API를 조회할 수 있습니다.", "error");
    return;
  }
  await fetchNecCandidatesWithKey(serviceKey);
}

async function fetchNecCandidatesWithKey(serviceKey, statusMessage = "중앙선관위 후보자 정보 API를 조회 중입니다...") {
  if (!serviceKey) return;

  const sgTypecode = sgTypeCodes[selectedOfficeId];
  const sdName = sdNameBySubregion[selectedSubregion] || "";
  if (!sgTypecode || !sdName) {
    setApiStatus("현재 선택 조합은 API 조회 파라미터를 만들 수 없습니다.", "error");
    return;
  }

  localStorage.setItem("publicfitApiKey", serviceKey);
  setApiStatus(statusMessage);

  const sgId = sgIdInput.value.trim() || defaultSgId;
  const urls = buildNecCandidateUrls(serviceKey, {
    pageNo: "1",
    numOfRows: "100",
    sgId,
    sgTypecode,
    sdName,
    _type: "json",
  });

  try {
    const raw = await fetchFirstWorkingNecUrl(urls);
    let items = [];

    try {
      const json = JSON.parse(raw);
      const body = json?.response?.body || json?.body || {};
      const header = json?.response?.header || json?.header || {};
      if (header.resultCode && header.resultCode !== "INFO-00" && header.resultCode !== "00") {
        throw new Error(header.resultMsg || "API 오류");
      }
      items = normalizeItems(body.items);
    } catch (jsonError) {
      items = xmlToItems(raw);
      if (!items.length && raw.includes("SERVICE_KEY")) {
        throw new Error("인증키 오류 또는 URL 인코딩 문제");
      }
    }

    const converted = items.map(apiCandidateToLocal);
    realCandidateCache[realCacheKey()] = converted;
    useRealApi = true;
    ensureSelectedCandidate();
    renderAll();

    setApiStatus(
      converted.length
        ? `실제 API 후보 ${converted.length}명을 불러왔습니다. 기준: ${sgId}, ${sdName}, 선거종류코드 ${sgTypecode}`
        : `API 호출은 성공했지만 후보가 없습니다. 후보 공개 기간/선거종류코드/지역명을 확인하세요. 기준: ${sgId}, ${sdName}, 코드 ${sgTypecode}`,
      converted.length ? "success" : "",
    );
  } catch (error) {
    setApiStatus(
      `API 조회 실패: ${error.message}. 승인된 키인데도 전부 401이면 공공데이터포털 마이페이지에서 후보자 정보 API의 일반 인증키를 다시 복사해 붙여넣어 보세요.`,
      "error",
    );
  }
}

function autoFetchIfReady(message) {
  const serviceKey = apiKeyInput.value.trim() || localStorage.getItem("publicfitApiKey") || "";
  if (!serviceKey) {
    useRealApi = false;
    ensureSelectedCandidate();
    renderAll();
    setApiStatus("ServiceKey가 없어서 자동 조회를 건너뛰었습니다. 키를 한 번 입력하고 API 조회를 누르면 이후 선택 변경 시 자동 조회합니다.");
    return;
  }
  apiKeyInput.value = serviceKey;
  fetchNecCandidatesWithKey(serviceKey, message);
}

function buildNecCandidateUrls(serviceKey, query) {
  const endpoint =
    "http://apis.data.go.kr/9760000/PofelcddInfoInqireService/getPoelpcddRegistSttusInfoInqire";
  const queryWithoutKey = new URLSearchParams(query).toString();
  const trimmedKey = serviceKey.trim();
  const urls = [];

  try {
    const decodedKey = decodeURIComponent(trimmedKey);
    const params = new URLSearchParams({ ServiceKey: decodedKey, ...query });
    urls.push({
      label: "Decoding 키를 URLSearchParams로 인코딩",
      url: `${endpoint}?${params.toString()}`,
    });
  } catch {
    const params = new URLSearchParams({ ServiceKey: trimmedKey, ...query });
    urls.push({
      label: "입력 키를 URLSearchParams로 인코딩",
      url: `${endpoint}?${params.toString()}`,
    });
  }

  urls.push({
    label: "입력 키 원문 그대로",
    url: `${endpoint}?ServiceKey=${trimmedKey}&${queryWithoutKey}`,
  });
  urls.push({
    label: "입력 키를 encodeURIComponent",
    url: `${endpoint}?ServiceKey=${encodeURIComponent(trimmedKey)}&${queryWithoutKey}`,
  });

  const seen = new Set();
  return urls.filter((candidate) => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

async function fetchFirstWorkingNecUrl(urls) {
  const errors = [];
  for (const candidate of urls) {
    try {
      const response = await fetch(candidate.url);
      const raw = await response.text();
      if (response.ok) return raw;
      errors.push(`${candidate.label}: HTTP ${response.status}`);
    } catch (error) {
      errors.push(`${candidate.label}: ${error.message}`);
    }
  }
  throw new Error(errors.join(" / "));
}

function apiCandidateToLocal(item, index) {
  const safe = Object.fromEntries(
    Object.entries(item).map(([key, value]) => [key, escapeHtml(String(value || ""))]),
  );
  const rawInfo = {
    후보자ID: safe.huboid,
    선거구: safe.sggName,
    시도: safe.sdName,
    구시군: safe.wiwName,
    정당: safe.jdName || safe.partyName,
    성명: safe.name || safe.krName,
    성별: safe.gender,
    연령: safe.age,
    주소: safe.addr,
    직업: safe.job,
    학력: safe.edu,
    경력1: safe.career1,
    경력2: safe.career2,
    등록일: formatDate8(safe.regdate),
    등록상태: safe.status,
  };
  const publicRecord = computePublicRecordScore(rawInfo);

  return {
    id: safe.huboid || `${selectedOfficeId}-${selectedSubregion}-${index}`,
    name: safe.name || safe.krName || "이름 미상",
    party: safe.jdName || safe.partyName || "정당 미상",
    job: safe.job,
    district: safe.sggName || subregionLabel(selectedSubregion),
    profile: [
      safe.jdName || safe.partyName || "정당 미상",
      safe.sggName ? `선거구 ${safe.sggName}` : "",
      safe.age ? `${safe.age}세` : "",
      safe.job || "",
    ]
      .filter(Boolean)
      .join(" · "),
    rawInfo,
    publicRecordScore: publicRecord.score,
    publicRecordBreakdown: publicRecord.breakdown,
    source: "중앙선관위 후보자 정보 API",
  };
}

function computePublicRecordScore(rawInfo) {
  const fields = [
    ["성명", 12],
    ["정당", 10],
    ["선거구", 10],
    ["성별", 6],
    ["연령", 8],
    ["주소", 8],
    ["직업", 10],
    ["학력", 12],
    ["경력1", 10],
    ["등록일", 6],
    ["등록상태", 8],
  ];
  const breakdown = fields.map(([label, weight]) => ({
    label,
    weight,
    present: Boolean(rawInfo[label] && rawInfo[label] !== "-"),
  }));
  const total = fields.reduce((sum, [, weight]) => sum + weight, 0);
  const earned = breakdown.reduce((sum, item) => sum + (item.present ? item.weight : 0), 0);
  return {
    score: Math.round((earned / total) * 100),
    breakdown,
  };
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

function formatDate8(value) {
  if (!/^\d{8}$/.test(value)) return value;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function renderAll() {
  renderOffices();
  renderCandidateExplorer();
  renderCandidates();
  renderDetail();
}

resetButton.addEventListener("click", () => {
  renderWeights();
});

regionFilter.addEventListener("change", (event) => {
  selectedRegion = event.target.value;
  ensureOfficeAndSubregion();
  ensureSelectedCandidate();
  renderAll();
  autoFetchIfReady("지역 필터가 바뀌어 실제 데이터를 다시 조회합니다.");
});

loadApiCandidatesButton.addEventListener("click", () => {
  fetchNecCandidates();
});

apiKeyInput.value = localStorage.getItem("publicfitApiKey") || "";
sgIdInput.value = localStorage.getItem("publicfitSgId") || sgIdInput.value || defaultSgId;
ensureOfficeAndSubregion();
renderWeights();
renderAll();
if (apiKeyInput.value.trim()) {
  autoFetchIfReady("저장된 ServiceKey로 실제 데이터를 자동 조회합니다.");
} else {
  setApiStatus("홈에서 ServiceKey를 먼저 저장하세요. 저장 후 이 페이지에서 자동 조회됩니다.", "error");
}
