const apiKeyInput = document.querySelector("#apiKey");
const sgIdInput = document.querySelector("#sgIdInput");
const apiStatus = document.querySelector("#apiStatus");
const saveKeyButton = document.querySelector("#saveKey");
const clearKeyButton = document.querySelector("#clearKey");

apiKeyInput.value = localStorage.getItem("publicfitApiKey") || "";
sgIdInput.value = localStorage.getItem("publicfitSgId") || "20260603";

if (apiKeyInput.value) {
  apiStatus.textContent = "저장된 ServiceKey가 있습니다.";
  apiStatus.className = "api-status success";
}

saveKeyButton.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  const sgId = sgIdInput.value.trim() || "20260603";
  if (!key) {
    apiStatus.textContent = "ServiceKey를 입력하세요.";
    apiStatus.className = "api-status error";
    return;
  }
  localStorage.setItem("publicfitApiKey", key);
  localStorage.setItem("publicfitSgId", sgId);
  apiStatus.textContent = `저장했습니다. 선거ID: ${sgId}`;
  apiStatus.className = "api-status success";
});

clearKeyButton.addEventListener("click", () => {
  localStorage.removeItem("publicfitApiKey");
  localStorage.removeItem("publicfitSgId");
  apiKeyInput.value = "";
  sgIdInput.value = "20260603";
  apiStatus.textContent = "저장된 키를 삭제했습니다.";
  apiStatus.className = "api-status";
});
