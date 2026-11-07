const KeepManager = {
  async all() { return GoblinStorage.get("keep", []); },
  async contains(tab) {
    const keep = await this.all();
    return keep.some(item => item.url === tab.url);
  },
  async add(tab) {
    if (!tab.url) throw new Error("This tab does not have a protectable URL.");
    const keep = await this.all();
    if (!keep.some(item => item.url === tab.url)) {
      keep.push({ url: tab.url, title: tab.title || tab.url, tabId: tab.id, addedAt: Date.now() });
      await GoblinStorage.set("keep", keep);
    }
  },
  async updateTab(tabId, tab) {
    const keep = await this.all();
    const item = keep.find(entry => entry.tabId === tabId);
    if (!item) return;
    if (/^https?:|^file:/i.test(tab.url || "")) item.url = tab.url;
    if (tab.title) item.title = tab.title;
    await GoblinStorage.set("keep", keep);
  },
  async replaceTab(addedTabId, removedTabId) {
    const keep = await this.all();
    const item = keep.find(entry => entry.tabId === removedTabId);
    if (!item) return;
    item.tabId = addedTabId;
    await GoblinStorage.set("keep", keep);
  },
  async remove(url) {
    await GoblinStorage.set("keep", (await this.all()).filter(item => item.url !== url));
  }
};
