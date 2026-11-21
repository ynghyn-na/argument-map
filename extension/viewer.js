import {createArgumentSvg} from "./render.js";
import {demo} from "./demo.js";
import {DEFAULT_SERVER_URL} from "./config.js";
import {loadServerUrl, isLocalServer, getHealth} from "./server-client.js";

const $ = id => document.getElementById(id);
let windowId = null;
let latestRevision = 0;
let currentRequestId = null;
let submittedRequestId = null;
let generation = 0;
let enabled = false;
let busy = false;
let controller = null;
let currentSvg = null;
let currentAnalysis = null;
let transcriptText = "";
let renderedWidth = 0;
let activeServerUrl = DEFAULT_SERVER_URL;
let connectionCheckGeneration = 0;

function message(text, kind = "") {
  $("message").textContent = text;
  $("message").dataset.kind = kind;
}

function setBusy(value) {
  busy = value;
  $("refreshButton").disabled = value || !enabled;
  $("refreshButton").textContent = value ? "화면을 읽고 지도를 만드는 중…" : "현재 화면 다시 분석";
  $("demoButton").disabled = value;
  $("graphContainer").setAttribute("aria-busy", String(value));
}

function cancelAnalysis() {
  generation++;
  controller?.abort();
  controller = null;
}

function setToggle(value) {
  $("toggleButton").setAttribute("aria-checked", String(value));
  $("toggleLabel").textContent = value ? "켜짐" : "꺼짐";
  $("toggleButton").disabled = !value;
}

async function checkConnection({waitForWake = false, signal} = {}) {
  const checkId = ++connectionCheckGeneration;
  const label = $("connectionStatus");
  label.textContent = "서버 확인 중";
  label.dataset.ready = "false";
  try {
    const serverUrl = await loadServerUrl();
    activeServerUrl = serverUrl;
    if (waitForWake && !isLocalServer(serverUrl) && checkId === connectionCheckGeneration) {
      label.textContent = "공용 서버 연결 중 · 절전 해제에 약 1분이 걸릴 수 있어요";
    }
    const state = await getHealth({
      serverUrl, waitForWake: waitForWake && !isLocalServer(serverUrl), signal,
      onWaiting: () => {
        if (checkId === connectionCheckGeneration) label.textContent = "무료 서버를 깨우고 있어요. 잠시 기다려 주세요.";
      },
    });
    if (checkId === connectionCheckGeneration) {
      label.textContent = state.configured
        ? (isLocalServer(serverUrl) ? "로컬 연결됨 · " : "공용 서버 연결됨 · ") + state.model
        : "서버 연결됨 · API 키 설정 필요";
      label.dataset.ready = String(state.configured);
    }
    return state;
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    if (checkId === connectionCheckGeneration) {
      label.textContent = isLocalServer(activeServerUrl)
        ? "서버를 실행해 주세요 · 127.0.0.1:8765" : error.message;
    }
    return null;
  }
}

function clearOutput() {
  currentSvg = null;
  currentAnalysis = null;
  renderedWidth = 0;
  $("graphContainer").replaceChildren();
  $("nodeDetail").hidden = true;
  $("saveSvgButton").disabled = true;
  $("savePngButton").disabled = true;
  $("graphTools").hidden = true;
  $("emptyState").hidden = false;
  $("emptyState").querySelector("p").textContent = "논증지도를 준비하고 있어요.";
  $("outputHeading").textContent = "화면을 읽고 있어요";
  $("counts").textContent = "";
  $("modeLabel").hidden = true;
  $("readingNote").hidden = true;
  transcriptText = "";
  $("transcript").textContent = "분석 후 인식한 원문이 표시됩니다.";
}

function highlightQuote(quote) {
  const normalized = transcriptText.replace(/\s/g, "");
  const normalizedQuote = quote.replace(/\s/g, "");
  const start = normalized.indexOf(normalizedQuote);
  if (!normalizedQuote || start < 0) {
    $("transcript").textContent = transcriptText;
    return;
  }
  const positions = [];
  for (let index = 0; index < transcriptText.length; index++) {
    if (!/\s/.test(transcriptText[index])) positions.push(index);
  }
  const from = positions[start];
  const to = positions[start + normalizedQuote.length - 1] + 1;
  const mark = document.createElement("mark");
  mark.textContent = transcriptText.slice(from, to);
  $("transcript").replaceChildren(transcriptText.slice(0, from), mark, transcriptText.slice(to));
}

function selectNode(node, label) {
  $("nodeDetail").hidden = false;
  $("nodeDetailType").textContent = label;
  $("nodeDetailText").textContent = node.text;
  $("nodeDetailQuote").hidden = node.origin === "ai";
  $("nodeDetailQuote").textContent = node.source_quote;
  highlightQuote(node.source_quote);
  $("transcriptDetails").open = true;
}

function zoom(percent) {
  if (!currentSvg) return;
  const scale = percent / 100;
  currentSvg.style.width = Number(currentSvg.getAttribute("width")) * scale + "px";
  currentSvg.style.height = Number(currentSvg.getAttribute("height")) * scale + "px";
}

function fitGraph() {
  if (!currentAnalysis || currentAnalysis.status !== "ok") return;
  const width = Math.max(280, Math.min(976, $("graphContainer").clientWidth));
  if (!currentSvg || renderedWidth !== width) {
    currentSvg = createArgumentSvg(currentAnalysis, selectNode, width);
    $("graphContainer").replaceChildren(currentSvg);
    renderedWidth = width;
  }
  $("zoomControl").value = "100";
  zoom(100);
}

function showAnalysis(analysis, isDemo = false) {
  clearOutput();
  currentAnalysis = analysis;
  transcriptText = analysis.extracted_text;
  $("transcript").textContent = transcriptText || "인식한 원문이 없습니다.";
  $("outputHeading").textContent = analysis.title || "논증지도";
  $("modeLabel").hidden = false;
  $("modeLabel").dataset.demo = String(isDemo);
  $("modeLabel").textContent = isDemo ? "미리 작성한 예시 데이터" : "현재 보이는 화면의 분석 결과";
  $("readingNote").hidden = !analysis.reading_note;
  $("readingNote").textContent = analysis.reading_note;
  if (analysis.status !== "ok") {
    $("emptyState").querySelector("p").textContent = analysis.status === "unreadable"
      ? "글자를 읽기 어려워요. 원문을 확대하고 현재 화면 다시 분석을 눌러 주세요."
      : "뚜렷한 주장을 찾지 못했어요. 주장하는 글의 본문이 보이도록 스크롤한 뒤 다시 분석해 주세요.";
    return;
  }
  const counts = {claim: 0, reason: 0, objection: 0, review: 0};
  for (const node of analysis.nodes) counts[node.type]++;
  $("counts").textContent = "주장 " + counts.claim + " · 근거 " + counts.reason
    + " · 원문 반박 " + counts.objection + " · AI 검토 " + counts.review;
  $("emptyState").hidden = true;
  $("graphTools").hidden = false;
  $("saveSvgButton").disabled = false;
  $("savePngButton").disabled = false;
  fitGraph();
}

async function fullScreenImage(dataUrl) {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const scale = Math.min(1, 2500 / Math.max(image.naturalWidth, image.naturalHeight));
  if (scale === 1) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.95);
}

async function analyzeCapture(state) {
  const epoch = generation;
  const isCurrent = () => enabled && generation === epoch && currentRequestId === state.requestId;
  controller = new AbortController();
  const requestController = controller;
  setBusy(true);
  message("현재 보이는 화면에서 주장과 근거를 읽고 있어요.", "working");
  $("capturePreview").src = state.imageDataUrl;
  $("capturePreview").hidden = false;
  $("capturePlaceholder").hidden = true;
  // Acknowledgement removes the shared session copy; the preview lives only in this panel.
  chrome.runtime.sendMessage({
    type: "argument-map-consumed", windowId, requestId: state.requestId,
  }).catch(() => {});
  try {
    const connection = await checkConnection({waitForWake: true, signal: requestController.signal});
    if (!isCurrent()) return;
    if (!connection) throw new Error(isLocalServer(activeServerUrl)
      ? "로컬 서버를 실행한 뒤 현재 화면 다시 분석을 눌러 주세요."
      : "공용 서버 연결을 확인하지 못했어요. 서버 연결 설정과 인터넷 연결을 확인한 뒤 다시 분석해 주세요.");
    if (!connection.configured) throw new Error(isLocalServer(connection.serverUrl)
      ? "backend/.env에 전체 API 비밀키를 저장하고 서버를 다시 실행해 주세요."
      : "공용 서버의 API 키 설정이 필요해요. 서버 관리자에게 설정을 요청해 주세요.");
    const imageDataUrl = await fullScreenImage(state.imageDataUrl);
    if (!isCurrent()) return;
    const response = await fetch(connection.serverUrl + "/analyze", {
      method: "POST",
      credentials: "omit",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({image_data_url: imageDataUrl}),
      signal: AbortSignal.any([requestController.signal, AbortSignal.timeout(180000)]),
    });
    const result = await response.json();
    if (!isCurrent()) return;
    if (!response.ok) {
      throw new Error(typeof result.detail === "string" ? result.detail : "서버 설정과 현재 화면을 확인해 주세요.");
    }
    showAnalysis(result);
    message("분석이 끝났어요. 지도의 상자를 누르면 관련 원문을 확인할 수 있어요.");
  } catch (error) {
    if (!isCurrent() || error.name === "AbortError") return;
    $("outputHeading").textContent = "분석을 완료하지 못했어요";
    $("emptyState").querySelector("p").textContent = "위 안내를 확인한 뒤 다시 분석해 주세요.";
    if (error.name === "TypeError") {
      message("서버에 연결하지 못했어요. 서버 연결 설정과 인터넷 연결을 확인해 주세요.", "error");
    } else if (error.name === "TimeoutError") {
      message("분석 시간이 길어졌어요. 잠시 뒤 현재 화면 다시 분석을 눌러 주세요.", "error");
    } else {
      message(error.message, "error");
    }
  } finally {
    if (isCurrent()) {
      controller = null;
      setBusy(false);
    }
  }
}

function acceptState(state) {
  if (!state || (state.revision || 0) <= latestRevision) return;
  latestRevision = state.revision;
  enabled = Boolean(state.enabled);
  setToggle(enabled);
  if (!enabled) {
    cancelAnalysis();
    currentRequestId = null;
    setBusy(false);
    clearOutput();
    $("outputHeading").textContent = "논증지도를 켜 주세요";
    $("captureTitle").textContent = "원문 탭에서 상단 아이콘으로 켜 주세요.";
    $("captureTime").textContent = "";
    $("emptyState").querySelector("p").textContent = "원문 탭에서 Chrome 상단의 논증지도 아이콘을 눌러 주세요.";
    $("capturePreview").removeAttribute("src");
    $("capturePreview").hidden = true;
    $("capturePlaceholder").hidden = false;
    message(state.phase === "idle"
      ? "원문 탭에서 Chrome 상단의 논증지도 아이콘을 누르면 캡처 권한을 받고 자동 분석을 시작해요."
      : "논증지도가 꺼졌어요. 원문 탭에서 상단 아이콘을 누르면 다시 켤 수 있어요.");
    return;
  }
  $("captureTitle").textContent = state.title || "현재 화면";
  $("captureTime").textContent = state.capturedAt
    ? new Date(state.capturedAt).toLocaleTimeString("ko-KR") + " 캡처 · 보이는 영역 기준" : "";
  $("staleNotice").hidden = !state.stale;
  if (state.stale) {
    cancelAnalysis();
    setBusy(false);
    message("탭이나 페이지가 바뀌어 진행 중인 분석 표시를 중단했어요. 현재 화면 다시 분석을 눌러 주세요.");
    if (!currentAnalysis) {
      $("outputHeading").textContent = "새 화면을 분석해 주세요";
      $("emptyState").querySelector("p").textContent = "화면이 바뀌어 이전 분석을 표시하지 않습니다.";
    }
    return;
  }
  if (state.requestId !== currentRequestId) {
    cancelAnalysis();
    currentRequestId = state.requestId;
    submittedRequestId = null;
    clearOutput();
    $("capturePreview").removeAttribute("src");
    $("capturePreview").hidden = true;
    $("capturePlaceholder").hidden = false;
  }
  if (state.phase === "error") {
    setBusy(false);
    $("outputHeading").textContent = "화면을 불러오지 못했어요";
    $("emptyState").querySelector("p").textContent = "현재 탭에서 상단 아이콘을 껐다 켜 주세요.";
    message(state.error, "error");
  } else if (state.phase === "capturing" || state.phase === "starting") {
    setBusy(true);
    message("현재 보이는 웹페이지 전체를 불러오고 있어요.", "working");
  } else if (state.phase === "captured" && state.imageDataUrl && submittedRequestId !== state.requestId) {
    submittedRequestId = state.requestId;
    analyzeCapture(state);
  } else if (state.phase === "captured" && !state.imageDataUrl && !submittedRequestId) {
    setBusy(false);
    $("outputHeading").textContent = "현재 화면을 다시 분석해 주세요";
    message("새로 열린 패널이에요. 현재 화면 다시 분석을 눌러 주세요.");
  }
}

async function refresh() {
  if (busy || !enabled || !Number.isInteger(windowId)) return;
  cancelAnalysis();
  setBusy(true);
  try {
    const result = await chrome.runtime.sendMessage({type: "argument-map-refresh", windowId});
    if (!result?.ok) throw new Error(result?.error || "화면을 불러오지 못했어요.");
  } catch (error) {
    setBusy(false);
    message(error.message, "error");
  }
}

function saveFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function svgBlob() {
  const copy = currentSvg.cloneNode(true);
  copy.removeAttribute("style");
  return new Blob([new XMLSerializer().serializeToString(copy)], {type: "image/svg+xml;charset=utf-8"});
}

async function savePng() {
  if (!currentSvg) return;
  const blob = svgBlob();
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Number(currentSvg.getAttribute("width")) * 2;
    canvas.height = Number(currentSvg.getAttribute("height")) * 2;
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new Error("PNG 이미지를 만들지 못했어요.");
    saveFile(png, "argument-map.png");
  } catch (error) {
    message("이미지를 저장하지 못했어요. " + error.message, "error");
  } finally {
    URL.revokeObjectURL(url);
  }
}


$("refreshButton").addEventListener("click", refresh);
$("checkConnectionButton").addEventListener("click", () => checkConnection({waitForWake: true}));
$("toggleButton").addEventListener("click", async () => {
  if (!Number.isInteger(windowId)) return;
  cancelAnalysis();
  enabled = false;
  setToggle(false);
  setBusy(false);
  try {
    // Called directly from the click handler, preserving Chrome's user gesture.
    await chrome.sidePanel.close({windowId});
  } catch {
    enabled = true;
    setToggle(true);
    message("닫으려면 상단 아이콘이나 패널의 × 버튼을 눌러 주세요.", "error");
  }
});
$("demoButton").addEventListener("click", () => {
  cancelAnalysis();
  setBusy(false);
  showAnalysis(demo, true);
  $("staleNotice").hidden = true;
  message("미리 작성한 예시 지도입니다. API를 호출하지 않습니다.");
});
$("zoomControl").addEventListener("input", event => zoom(Number(event.target.value)));
$("fitButton").addEventListener("click", fitGraph);
$("saveSvgButton").addEventListener("click", () => {
  if (currentSvg) saveFile(svgBlob(), "argument-map.svg");
});
$("savePngButton").addEventListener("click", savePng);
new ResizeObserver(() => {
  const width = Math.max(280, Math.min(976, $("graphContainer").clientWidth));
  if (currentAnalysis && renderedWidth !== width) fitGraph();
}).observe($("graphContainer"));
window.addEventListener("pagehide", cancelAnalysis);

async function initialize() {
  if (globalThis.chrome?.runtime?.getManifest) {
    $("versionLabel").textContent = "v" + chrome.runtime.getManifest().version;
  }
  if (!globalThis.chrome?.storage?.session || !chrome.windows) {
    $("captureTitle").textContent = "원문 탭에서 상단 논증지도 아이콘을 눌러 주세요.";
    $("toggleButton").disabled = true;
    setToggle(false);
    setBusy(false);
    message("예시 지도 보기로 화면을 먼저 확인할 수 있어요.");
    return;
  }
  windowId = (await chrome.windows.getCurrent()).id;
  const key = "argument-map-window-" + windowId;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "session" && changes[key]?.newValue) acceptState(changes[key].newValue);
    if (area === "local" && changes.serverUrl) {
      cancelAnalysis();
      setBusy(false);
      clearOutput();
      message("서버 주소가 바뀌었어요. 현재 화면 다시 분석을 눌러 주세요.");
      checkConnection({waitForWake: true});
    }
  });
  const state = (await chrome.storage.session.get(key))[key];
  if (state) acceptState(state);
  else {
    enabled = false;
    setToggle(false);
    setBusy(false);
    $("outputHeading").textContent = "논증지도를 켜 주세요";
    $("emptyState").querySelector("p").textContent = "원문 탭에서 Chrome 상단의 논증지도 아이콘을 눌러 주세요.";
    message("원문 탭에서 상단 아이콘을 눌러 논증지도를 켜 주세요.");
  }
}
initialize().catch(() => message("패널을 불러오지 못했어요. 확장 프로그램을 새로고침해 주세요.", "error"));
checkConnection();
