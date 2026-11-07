const SessionManager = {
  async all() { return GoblinStorage.get("savedSessions", []); },
  async save(name) {
    const tabs = await chrome.tabs.query({});
    const windows = new Map();
    tabs.forEach(tab => {
      if (!windows.has(tab.windowId)) windows.set(tab.windowId, []);
      windows.get(tab.windowId).push({
        url: tab.url, title: tab.title, pinned: Boolean(tab.pinned), index: tab.index
      });
    });
    const session = {
      id: crypto.randomUUID(),
      name: name.trim(),
      savedAt: Date.now(),
      windows: Array.from(windows.values()).map(group => group.sort((a, b) => a.index - b.index))
    };
    const sessions = await this.all();
    sessions.unshift(session);
    await GoblinStorage.set("savedSessions", sessions);
    return session;
  },
  async update(id, name) {
    const sessions = await this.all();
    const session = sessions.find(item => item.id === id);
    if (!session) throw new Error("Saved session not found.");
    session.name = name.trim();
    await GoblinStorage.set("savedSessions", sessions);
  },
  async remove(id) {
    await GoblinStorage.set("savedSessions", (await this.all()).filter(item => item.id !== id));
  },
  async restore(sessionId, selections, mode) {
    const session = (await this.all()).find(item => item.id === sessionId);
    if (!session) throw new Error("Saved session not found.");
    const savedTabs = session.windows.flatMap((group, windowIndex) =>
      group.map(tab => ({ ...tab, windowIndex })));
    const chosen = selections?.length
      ? savedTabs.filter(tab => selections.includes(`${tab.windowIndex}:${tab.index}`))
      : savedTabs;
    const currentTabs = await chrome.tabs.query({});
    const existingUrls = new Set(currentTabs.map(tab => tab.url));
    const restoreTabs = chosen.filter(tab => {
      if (mode === "skip-existing" && existingUrls.has(tab.url)) return false;
      existingUrls.add(tab.url);
      return true;
    });
    let restored = 0;
    let failed = 0;
    for (let windowIndex = 0; windowIndex < session.windows.length; windowIndex += 1) {
      const group = restoreTabs.filter(tab => tab.windowIndex === windowIndex).sort((a, b) => a.index - b.index);
      if (!group.length) continue;
      let targetWindow = currentTabs.find(tab => tab.windowId && tab.windowId === session.windows[windowIndex]?.windowId);
      if (!targetWindow) targetWindow = currentTabs[0];
      for (const savedTab of group) {
        try {
          const created = await chrome.tabs.create({
            url: savedTab.url,
            active: false,
            pinned: savedTab.pinned,
            ...(targetWindow ? { windowId: targetWindow.windowId } : {})
          });
          restored += 1;
        } catch (error) {
          console.warn(`Could not restore ${savedTab.url}:`, error);
          failed += 1;
        }
      }
    }
    return { restored, skipped: chosen.length - restoreTabs.length, failed };
  }
};
