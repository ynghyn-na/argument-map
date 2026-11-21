import {normalizeServerUrl, loadServerUrl, isLocalServer, LOCAL_SERVER_URL, getHealth} from "./server-client.js";

const input = document.getElementById("serverUrl");
const status = document.getElementById("status");
const saveButton = document.getElementById("saveButton");
const localButton = document.getElementById("localButton");

function show(text, error = false) {
  status.textContent = text;
  status.dataset.error = String(error);
}

async function save(raw) {
  try {
    const serverUrl = normalizeServerUrl(raw);
    saveButton.disabled = true;
    localButton.disabled = true;
    // Request the exact selected origin inside this submit/click user gesture.
    const permission = isLocalServer(serverUrl) ? true
      : await chrome.permissions.request({origins: [serverUrl + "/*"]});
    if (!permission) throw new Error("이 서버에 연결하려면 서버 주소의 접근 권한을 허용해 주세요.");
    await chrome.storage.local.set({serverUrl});
    input.value = serverUrl;
    show("주소를 저장했어요. 서버 연결을 확인하고 있어요.");
    const health = await getHealth({
      serverUrl, waitForWake: !isLocalServer(serverUrl),
      onWaiting: () => show("주소를 저장했어요. 무료 서버를 깨우고 있어요. 잠시 기다려 주세요."),
    });
    show(health.configured
      ? "연결됐어요. 원문 탭에서 상단 논증지도 아이콘을 눌러 주세요."
      : "서버에 연결됐지만 API 키 설정이 필요해요. 공용 서버 관리자에게 설정을 요청해 주세요.");
  } catch (error) {
    show(error.message, true);
  } finally {
    saveButton.disabled = false;
    localButton.disabled = false;
  }
}

document.getElementById("settingsForm").addEventListener("submit", event => {
  event.preventDefault();
  save(input.value);
});
localButton.addEventListener("click", () => save(LOCAL_SERVER_URL));
loadServerUrl().then(url => { input.value = url; }).catch(error => show(error.message, true));
