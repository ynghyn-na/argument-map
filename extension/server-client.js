import {DEFAULT_SERVER_URL} from "./config.js";

export const LOCAL_SERVER_URL = "http://127.0.0.1:8765";

export function normalizeServerUrl(raw) {
  let url;
  try { url = new URL(String(raw).trim()); }
  catch { throw new Error("올바른 서버 주소를 입력해 주세요."); }
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== "/")) {
    throw new Error("서버의 기본 주소만 입력해 주세요.");
  }
  const local = url.origin === LOCAL_SERVER_URL;
  const render = url.protocol === "https:" && url.hostname.endsWith(".onrender.com") && !url.port;
  if (!local && !render) throw new Error("Render의 HTTPS 서버 주소 또는 로컬 서버 주소를 입력해 주세요.");
  return url.origin;
}

export function isLocalServer(serverUrl) {
  return serverUrl === LOCAL_SERVER_URL;
}

export async function loadServerUrl() {
  const state = globalThis.chrome?.storage?.local
    ? await chrome.storage.local.get("serverUrl") : {};
  return normalizeServerUrl(state.serverUrl || DEFAULT_SERVER_URL);
}

export async function hasServerPermission(serverUrl) {
  if (isLocalServer(serverUrl)) return true;
  if (!globalThis.chrome?.permissions?.contains) return false;
  return chrome.permissions.contains({origins: [serverUrl + "/*"]});
}

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, {once: true});
  });
}

// Only this GET may retry while a free service wakes up. POST /analyze never
// retries automatically, so one user action cannot duplicate a paid request.
export async function getHealth({
  serverUrl, waitForWake = false, signal, onWaiting = () => {},
  timeoutMs = waitForWake ? 105000 : 4000, retryDelayMs = 1500,
} = {}) {
  serverUrl = normalizeServerUrl(serverUrl || await loadServerUrl());
  if (!await hasServerPermission(serverUrl)) {
    throw new Error("서버 연결 설정에서 이 공용 서버 주소를 저장하고 연결 권한을 허용해 주세요.");
  }
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  do {
    signal?.throwIfAborted();
    const remaining = Math.max(1, deadline - Date.now());
    try {
      const timeout = AbortSignal.timeout(Math.min(remaining, waitForWake ? 65000 : 4000));
      const response = await fetch(serverUrl + "/health", {
        credentials: "omit",
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if ([401, 403, 404].includes(response.status)) {
        const error = new Error("서버 주소와 접근 설정을 확인해 주세요. HTTP " + response.status);
        error.permanent = true;
        throw error;
      }
      if (response.ok) {
        const state = await response.json();
        if (state?.ok === true && typeof state.configured === "boolean") return {...state, serverUrl};
      }
      lastError = new Error("서버가 아직 응답할 준비가 되지 않았어요.");
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      if (error.permanent || !waitForWake) throw error;
      lastError = error;
    }
    if (!waitForWake || Date.now() >= deadline) break;
    onWaiting();
    await pause(Math.min(retryDelayMs, Math.max(1, deadline - Date.now())), signal);
  } while (Date.now() < deadline);
  const error = new Error(isLocalServer(serverUrl)
    ? "로컬 서버를 실행한 뒤 다시 분석해 주세요."
    : "공용 서버가 아직 응답하지 않아요. 잠시 뒤 다시 분석하거나 서버 연결 설정을 확인해 주세요.");
  error.cause = lastError;
  throw error;
}
