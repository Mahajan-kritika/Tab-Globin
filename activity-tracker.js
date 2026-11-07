const ActivityTracker = {
  async record(tabId, time = Date.now()) {
    const activity = await GoblinStorage.get("activity", {});
    activity[String(tabId)] = time;
    await GoblinStorage.set("activity", activity);
  },
  async remove(tabId) {
    const activity = await GoblinStorage.get("activity", {});
    delete activity[String(tabId)];
    await GoblinStorage.set("activity", activity);
  },
  async replace(addedTabId, removedTabId) {
    const activity = await GoblinStorage.get("activity", {});
    if (activity[String(removedTabId)]) activity[String(addedTabId)] = activity[String(removedTabId)];
    delete activity[String(removedTabId)];
    await GoblinStorage.set("activity", activity);
  }
};
