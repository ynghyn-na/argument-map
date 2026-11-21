// Window-scoped state survives service-worker suspension. Screenshots only use
// temporary session storage, never local/sync storage or disk.
const windowQueues = new Map();
const closedWindows = new Set();
const actionTransitions = new Set();
const stateKey = windowId => "argument-map-window-" + windowId;

function transact(windowId, change) {
  const previousTask = windowQueues.get(windowId) || Promise.resolve();
  const task = previousTask.catch(() => {}).then(async () => {
    if (closedWindows.has(windowId)) return {};
    const key = stateKey(windowId);
    const previous = (await chrome.storage.session.get(key))[key] || {};
    const next = change(previous);
    if (!next) return previous;
    next.revision = Math.max(Date.now(), (previous.revision || 0) + 1);
    await chrome.storage.session.set({[key]: next});
    if (previous.tabId && previous.tabId !== next.tabId) {
      await chrome.action.setBadgeText({tabId: previous.tabId, text: ""}).catch(() => {});
    }
    if (next.tabId) {
      await chrome.action.setBadgeBackgroundColor({tabId: next.tabId, color: "#177a63"}).catch(() => {});
      await chrome.action.setBadgeText({tabId: next.tabId, text: next.enabled ? "ON" : ""}).catch(() => {});
    }
    return next;
  });
  windowQueues.set(windowId, task);
  task.finally(() => {
    if (windowQueues.get(windowId) === task) windowQueues.delete(windowId);
  }).catch(() => {});
  return task;
}

async function captureCurrent(windowId, sourceTab = null, activationId = null) {
  const requestId = crypto.randomUUID();
  const initial = await transact(windowId, state => {
    if (!state.enabled || (activationId && state.activationId !== activationId)) return null;
    return {
      enabled: true, activationId: state.activationId, requestId, phase: "capturing",
      tabId: sourceTab?.id || null, title: sourceTab?.title || "현재 화면", stale: false, capturedAt: null,
    };
  });
  if (initial.requestId !== requestId) return;
  try {
    const [tab] = await chrome.tabs.query({active: true, windowId});
    if (!tab || !Number.isInteger(tab.id)) throw new Error("읽을 글이 있는 탭을 먼저 열어 주세요.");
    if (sourceTab && (sourceTab.id !== tab.id || (sourceTab.url && tab.url && sourceTab.url !== tab.url))) {
      throw new Error("아이콘을 누른 뒤 탭이나 페이지가 바뀌었어요. 원문 탭에서 다시 켜 주세요.");
    }
    const active = await transact(windowId, state => {
      if (!state.enabled || state.requestId !== requestId) return null;
      return {...state, tabId: tab.id, title: tab.title || "현재 화면"};
    });
    if (!active.enabled || active.requestId !== requestId || active.stale) return;
    // Freeze the source tab first; switching tabs during the animation must
    // never silently analyze a different page.
    await new Promise(resolve => setTimeout(resolve, 280));
    const [before] = await chrome.tabs.query({active: true, windowId});
    if (!before || before.id !== tab.id || (tab.url && before.url && tab.url !== before.url)) {
      throw new Error("캡처 중 탭이나 페이지가 바뀌었어요. 현재 화면 다시 분석을 눌러 주세요.");
    }
    const stillActive = await transact(windowId, () => null);
    if (!stillActive.enabled || stillActive.requestId !== requestId || stillActive.stale) return;
    const imageDataUrl = await chrome.tabs.captureVisibleTab(windowId, {format: "jpeg", quality: 95});
    const [after] = await chrome.tabs.query({active: true, windowId});
    if (!after || after.id !== tab.id || (tab.url && after.url && tab.url !== after.url)) {
      throw new Error("캡처 중 탭이나 페이지가 바뀌었어요. 현재 화면 다시 분석을 눌러 주세요.");
    }
    await transact(windowId, state => {
      if (!state.enabled || state.requestId !== requestId || state.stale) return null;
      return {...state, phase: "captured", imageDataUrl, capturedAt: Date.now()};
    });
  } catch (error) {
    await transact(windowId, state => {
      if (!state.enabled || state.requestId !== requestId || state.stale) return null;
      return {
        ...state, phase: "error",
        error: /activeTab|<all_urls>|permission/i.test(error.message)
          ? "이 탭의 캡처 권한이 없어요. 원문 탭에서 Chrome 상단의 논증지도 아이콘을 껐다 켜 주세요. 로컬 파일은 확장 프로그램의 파일 URL 접근 허용도 확인해 주세요."
          : "화면을 캡처하지 못했어요. 원문 탭에서 다시 켜 주세요.\n" + error.message,
      };
    });
  }
}

async function closePanelState(windowId) {
  await transact(windowId, state => ({
    enabled: false, phase: "closed", requestId: crypto.randomUUID(), tabId: state.tabId || null,
  }));
}

async function markStale(windowId, tabId, navigation = false) {
  await transact(windowId, state => {
    if (!state.enabled || !state.tabId) return null;
    if (!navigation && state.tabId === tabId) return null;
    if (navigation && state.tabId !== tabId) return null;
    const {imageDataUrl, ...withoutImage} = state;
    return {...withoutImage, stale: true};
  });
}

function configurePanel() {
  // The native panel toggle alone does not grant activeTab. Handle the actual
  // extension action so Chrome grants temporary capture access to that tab.
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: false}).catch(console.error);
}
configurePanel();
chrome.runtime.onInstalled.addListener(configurePanel);
chrome.runtime.onStartup.addListener(configurePanel);

async function handleAction(tab, opening) {
  const activationId = crypto.randomUUID();
  const decision = await transact(tab.windowId, state => {
    if (state.enabled && state.activationId) {
      return {enabled: false, phase: "closed", requestId: activationId, tabId: state.tabId || null};
    }
    return {
      enabled: true, activationId, requestId: activationId, phase: "starting",
      tabId: tab.id, title: tab.title || "현재 화면", stale: false, capturedAt: null,
    };
  });
  const opened = await opening;
  if (!decision.enabled) {
    await chrome.sidePanel.close({windowId: tab.windowId});
    return;
  }
  if (!opened.ok) {
    await transact(tab.windowId, state => {
      if (!state.enabled || state.activationId !== activationId) return null;
      return {...state, phase: "error", error: "패널을 열지 못했어요. 원문 탭에서 상단 아이콘을 다시 눌러 주세요.\n" + opened.error};
    });
    return;
  }
  // This token keeps an earlier opening from capturing after OFF -> ON clicks.
  captureCurrent(tab.windowId, tab, activationId).catch(console.error);
}

chrome.action.onClicked.addListener(tab => {
  if (!Number.isInteger(tab.windowId) || !Number.isInteger(tab.id)) return;
  // Ignore repeated clicks during the native open/close transition, while
  // still allowing OFF as soon as the panel has opened and capture begins.
  if (actionTransitions.has(tab.windowId)) return;
  actionTransitions.add(tab.windowId);
  // Invoke open directly in the action callback, before any await, to retain
  // Chrome's user gesture. Opening an already-open panel is harmless; the
  // serialized decision below closes it when this click toggles OFF.
  const opening = chrome.sidePanel.open({windowId: tab.windowId}).then(
    () => ({ok: true}), error => ({ok: false, error: error.message}),
  );
  handleAction(tab, opening).catch(console.error).finally(() => actionTransitions.delete(tab.windowId));
});

chrome.sidePanel.onOpened.addListener(({windowId}) => {
  // Opening from Chrome's side-panel selector is not an activeTab invocation.
  // Show the toolbar instruction instead of attempting a capture without consent.
  transact(windowId, state => state.enabled ? null : {
    enabled: false, phase: "idle", requestId: crypto.randomUUID(), tabId: null,
  }).catch(console.error);
});
chrome.sidePanel.onClosed.addListener(({windowId}) => {
  closePanelState(windowId).catch(console.error);
});
chrome.tabs.onActivated.addListener(({windowId, tabId}) => {
  markStale(windowId, tabId).catch(console.error);
});
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status === "loading" || change.url) {
    markStale(tab.windowId, tabId, true).catch(console.error);
  }
});
chrome.tabs.onRemoved.addListener((tabId, {windowId}) => {
  markStale(windowId, tabId, true).catch(console.error);
});
chrome.windows.onRemoved.addListener(windowId => {
  closedWindows.add(windowId);
  const previousTask = windowQueues.get(windowId) || Promise.resolve();
  previousTask.catch(() => {}).then(() => chrome.storage.session.remove(stateKey(windowId))).catch(console.error);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL("viewer.html"))
      || !Number.isInteger(message.windowId)) return false;
  if (message.type === "argument-map-refresh") {
    captureCurrent(message.windowId).then(() => sendResponse({ok: true}),
      () => sendResponse({ok: false, error: "화면을 불러오지 못했어요. 아이콘을 껐다 켜 주세요."}));
    return true;
  }
  if (message.type === "argument-map-consumed") {
    transact(message.windowId, state => {
      if (state.requestId !== message.requestId || !state.imageDataUrl) return null;
      const {imageDataUrl, ...withoutImage} = state;
      return withoutImage;
    }).then(() => sendResponse({ok: true}), () => sendResponse({ok: false}));
    return true;
  }
  return false;
});
