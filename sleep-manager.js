const SleepManager = {
  async checkFormData(tabIds) {
    const granted = await chrome.permissions.contains({ origins: ["<all_urls>"] });
    if (!granted) return { granted: false, riskyIds: [] };
    const results = await chrome.scripting.executeScript({
      target: { tabIds },
      func: () => {
        const changedInput = [...document.querySelectorAll("input, textarea, select")].some(element => {
          if (element instanceof HTMLInputElement && ["password", "file"].includes(element.type)) return true;
          if (element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)) {
            return element.checked !== element.defaultChecked;
          }
          return element.value !== element.defaultValue;
        });
        const editedContent = [...document.querySelectorAll("[contenteditable=true]")].some(element =>
          element.textContent.trim().length > 0);
        return changedInput || editedContent;
      }
    });
    return { granted: true, riskyIds: results.filter(result => result.result).map(result => result.tabId) };
  },
  async sleep({ tabIds, thresholdMs = 0, warnOnForms = false } = {}) {
    const [tabs, activity, keep] = await Promise.all([
      chrome.tabs.query({}), GoblinStorage.get("activity", {}), KeepManager.all()
    ]);
    const protectedTabIds = new Set(keep.flatMap(item => item.tabId ? [item.tabId] : []));
    const protectedUrls = new Set(keep.map(item => item.url));
    const wanted = tabIds ? new Set(tabIds) : null;
    const candidates = tabs.filter(tab =>
      (!wanted || wanted.has(tab.id)) &&
      TabFilter.eligible(tab, protectedTabIds, protectedUrls, activity, thresholdMs)
    ).sort((a, b) => activity[String(a.id)] - activity[String(b.id)]);
    if (!candidates.length) return { discarded: 0, message: "No eligible inactive tabs to sleep." };
    if (!await chrome.permissions.contains({ origins: ["<all_urls>"] })) {
      return { permissionRequired: true, message: "Grant optional site access to check for unsaved form data before sleeping tabs." };
    }
    const formCheck = await this.checkFormData(candidates.map(tab => tab.id));
    const safeCandidates = candidates.filter(tab => !formCheck.riskyIds.includes(tab.id));
    const skippedForms = candidates.length - safeCandidates.length;
    let discarded = 0;
    for (const tab of safeCandidates) {
      try {
        const result = await chrome.tabs.discard(tab.id);
        if (result?.discarded) discarded += 1;
      } catch (error) {
        console.warn(`Could not sleep tab ${tab.id}:`, error);
      }
    }
    const message = skippedForms
      ? `${discarded} tab${discarded === 1 ? "" : "s"} slept; ${skippedForms} skipped because form data may be present.`
      : discarded ? `${discarded} tab${discarded === 1 ? "" : "s"} slept.`
        : "Chrome could not sleep any of the eligible tabs.";
    return { discarded, skippedForms, message, warning: Boolean(warnOnForms && skippedForms) };
  }
};
