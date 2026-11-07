importScripts(
  "utils/storage.js",
  "scripts/activity-tracker.js",
  "scripts/keep-manager.js",
  "scripts/session-manager.js",
  "scripts/sleep-manager.js"
);

chrome.tabs.onActivated.addListener(({ tabId }) => {
  ActivityTracker.record(tabId).catch(error => console.error("Could not save tab activity:", error));
});
chrome.windows.onFocusChanged.addListener(async windowId => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const [tabs] = await Promise.all([chrome.tabs.query({ active: true, windowId })]);
  if (tabs[0]?.id) await ActivityTracker.record(tabs[0].id);
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.title) {
    KeepManager.updateTab(tabId, tab).catch(error => console.error("Could not update protected tab:", error));
  }
});
chrome.runtime.onStartup.addListener(async () => {
  const activeTabs = await chrome.tabs.query({ active: true });
  await Promise.all(activeTabs.filter(tab => tab.id).map(tab => ActivityTracker.record(tab.id)));
});
chrome.tabs.onRemoved.addListener(tabId => ActivityTracker.remove(tabId));
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  ActivityTracker.replace(addedTabId, removedTabId).catch(error => console.error("Could not migrate tab activity:", error));
  KeepManager.replaceTab(addedTabId, removedTabId).catch(error => console.error("Could not migrate protected tab:", error));
});
chrome.runtime.onInstalled.addListener(async () => {
  await GoblinStorage.get("activity", {});
  await GoblinStorage.get("keep", []);
  await GoblinStorage.get("savedSessions", []);
  const activeTabs = await chrome.tabs.query({ active: true });
  await Promise.all(activeTabs.filter(tab => tab.id).map(tab => ActivityTracker.record(tab.id)));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "sleep":
        return SleepManager.sleep(message);
      case "keep":
        if (message.add) await KeepManager.add(message.tab);
        else await KeepManager.remove(message.url);
        return { ok: true };
      case "save-session":
        return { session: await SessionManager.save(message.name) };
      case "rename-session":
        await SessionManager.update(message.id, message.name);
        return { ok: true };
      case "delete-session":
        await SessionManager.remove(message.id);
        return { ok: true };
      case "restore-session":
        return SessionManager.restore(message.id, message.selections, message.mode);
      default:
        throw new Error(`Unknown request: ${message.type}`);
    }
  })().then(sendResponse).catch(error => {
    console.error("Tab Goblin request failed:", error);
    sendResponse({ error: error.message || "The requested action failed." });
  });
  return true;
});
