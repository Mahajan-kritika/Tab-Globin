const $ = selector => document.querySelector(selector);
let currentTabs = [];
let currentKeep = [];
let currentSessions = [];
let selectedTabIds = new Set();
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const send = async message => {
  const result = await chrome.runtime.sendMessage(message);
  if (result?.error) throw new Error(result.error);
  return result;
};
const notice = (message, error = false) => {
  $("#notice").textContent = message;
  $("#notice").classList.toggle("error", error);
};
const getKeepSet = () => new Set(currentKeep.map(item => item.url));
function renderTabs() {
  const activity = window.activity || {};
  const keepSet = getKeepSet();
  const sorted = [...currentTabs].sort((a, b) => {
    const aTime = activity[String(a.id)] || 0, bTime = activity[String(b.id)] || 0;
    return aTime - bTime;
  });
  $("#tab-list").innerHTML = sorted.map(tab => {
    const protectedTab = keepSet.has(tab.url);
    const sleeping = Boolean(tab.discarded);
    const title = tab.title || tab.url || "New tab";
    const favicon = tab.favIconUrl || "icons/goblin.svg";
    const status = protectedTab ? "Protected" : sleeping ? "Sleeping" : tab.active ? "Active" : "Awake";
    return `<article class="tab-row">
      <input type="checkbox" class="tab-select" data-id="${tab.id}" aria-label="Select ${escapeHtml(title)}" ${selectedTabIds.has(tab.id) ? "checked" : ""}>
      <img class="favicon" src="${escapeHtml(favicon)}" alt="">
      <div class="tab-info"><span class="tab-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
      <div class="tab-meta">${escapeHtml(TimeFormat.domain(tab.url))} · ${escapeHtml(TimeFormat.age(activity[String(tab.id)]))}</div></div>
      <span class="status ${protectedTab ? "protected" : sleeping ? "sleeping" : ""}">${status}</span>
      <button class="row-action" data-action="${protectedTab ? "unkeep" : "keep"}" data-id="${tab.id}" title="${protectedTab ? "Remove from Keep" : "Keep protected"}">${protectedTab ? "Unkeep" : "Keep"}</button>
      ${!protectedTab && !sleeping ? `<button class="row-action" data-action="sleep" data-id="${tab.id}" title="Sleep tab">Sleep</button>` : ""}
    </article>`;
  }).join("") || '<p class="fine-print">No tabs found.</p>';
  $("#tab-list").querySelectorAll(".tab-select").forEach(input => input.addEventListener("change", () => {
    const id = Number(input.dataset.id);
    if (input.checked) selectedTabIds.add(id); else selectedTabIds.delete(id);
  }));
  $("#tab-list").querySelectorAll(".favicon").forEach(image => image.addEventListener("error", () => {
    image.src = "icons/goblin.svg";
  }, { once: true }));
  $("#tab-list").querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", async () => {
    const tab = currentTabs.find(item => item.id === Number(button.dataset.id));
    try {
      if (button.dataset.action === "keep") await send({ type: "keep", add: true, tab });
      if (button.dataset.action === "unkeep") await send({ type: "keep", add: false, url: tab.url });
      if (button.dataset.action === "sleep") await sleep([tab.id]);
      await refresh();
    } catch (error) { notice(error.message, true); }
  }));
}
function renderKeep() {
  $("#keep-list").innerHTML = currentKeep.map(item => `<article class="tab-row">
    <img class="favicon" src="${escapeHtml(item.favicon || "icons/goblin.svg")}" alt="">
    <div class="tab-info"><span class="tab-title">${escapeHtml(item.title)}</span><div class="tab-meta">${escapeHtml(TimeFormat.domain(item.url))}</div></div>
    <span class="status protected">Protected</span><button class="row-action" data-unkeep="${escapeHtml(item.url)}">Remove</button>
  </article>`).join("") || '<p class="fine-print">Keep a tab to protect it from the goblin.</p>';
  $("#keep-list").querySelectorAll("[data-unkeep]").forEach(button => button.addEventListener("click", async () => {
    try { await send({ type: "keep", add: false, url: button.dataset.unkeep }); await refresh(); }
    catch (error) { notice(error.message, true); }
  }));
}
function renderSessions() {
  $("#session-list").innerHTML = currentSessions.map(session => {
    const flattened = session.windows.flatMap((group, windowIndex) =>
      group.map(tab => ({ ...tab, key: `${windowIndex}:${tab.index}` })));
    return `<article class="session-card" data-session="${session.id}">
      <div class="session-head"><strong>${escapeHtml(session.name)}</strong><small>${flattened.length} tabs</small></div>
      <div class="session-actions"><button class="small-button" data-session-action="preview">Preview</button><button class="small-button" data-session-action="restore">Restore</button><button class="small-button" data-session-action="rename">Rename</button><button class="small-button" data-session-action="delete">Delete</button></div>
      <div class="session-preview">${flattened.map(tab => `<label><input type="checkbox" class="restore-select" value="${escapeHtml(tab.key)}" checked> ${escapeHtml(tab.title || tab.url)}</label>`).join("")}</div>
    </article>`;
  }).join("") || '<p class="fine-print">Saved sessions will appear here.</p>';
  $("#session-list").querySelectorAll("[data-session-action]").forEach(button => button.addEventListener("click", async () => {
    const card = button.closest(".session-card");
    const session = currentSessions.find(item => item.id === card.dataset.session);
    try {
      switch (button.dataset.sessionAction) {
        case "preview": card.querySelector(".session-preview").classList.toggle("open"); break;
        case "rename": {
          const name = prompt("Rename this session:", session.name);
          if (name?.trim()) await send({ type: "rename-session", id: session.id, name: name.trim() });
          break;
        }
        case "delete":
          if (confirm(`Delete saved session “${session.name}”?`)) await send({ type: "delete-session", id: session.id });
          break;
        case "restore": {
          const checks = [...card.querySelectorAll(".restore-select")];
          const selected = checks.filter(input => input.checked).map(input => input.value);
          if (!selected.length) { notice("Select at least one tab to restore.", true); return; }
          if (selected.length > 10 && !confirm(`Restore ${selected.length} tabs? This opens URLs and does not restore page state.`)) return;
          const mode = confirm("Skip URLs that are already open? Choose OK to avoid duplicates; Cancel to restore all selected tabs.")
            ? "skip-existing" : "all";
          const result = await send({ type: "restore-session", id: session.id, selections: selected, mode });
          notice(`${result.restored} restored${result.failed ? `; ${result.failed} could not be opened` : ""}${result.skipped ? `; ${result.skipped} duplicates skipped` : ""}.`);
          break;
        }
      }
      await refresh();
    } catch (error) { notice(error.message, true); }
  }));
}
async function sleep(tabIds, thresholdMs = 0) {
  const granted = await chrome.permissions.request({ origins: ["<all_urls>"] });
  if (!granted) { notice("Site access is required to check for unsaved form data.", true); return; }
  if (!confirm("Tab Goblin checks for common unsaved form input before sleeping tabs. Some site state cannot be detected or recovered. Continue?")) return;
  const result = await send({ type: "sleep", tabIds, thresholdMs, warnOnForms: true });
  notice(result.message, Boolean(result.error));
}
async function refresh() {
  const [tabs, activity, keep, savedSessions] = await Promise.all([
    chrome.tabs.query({}), GoblinStorage.get("activity", {}), GoblinStorage.get("keep", []),
    GoblinStorage.get("savedSessions", [])
  ]);
  currentTabs = tabs;
  currentKeep = keep;
  currentSessions = savedSessions;
  window.activity = activity;
  const mood = GoblinMood.forCount(tabs.length);
  $("#goblin").textContent = mood.face;
  $("#mood-name").textContent = mood.name;
  $("#mood-message").textContent = mood.message;
  $("#mood-card").className = `mood-card ${mood.className}`;
  $("#tab-count").textContent = `${tabs.length} ${tabs.length === 1 ? "tab" : "tabs"} open`;
  $("#sleeping-count").textContent = tabs.filter(tab => tab.discarded).length;
  $("#active-count").textContent = tabs.filter(tab => !tab.discarded).length;
  $("#protected-count").textContent = tabs.filter(tab => keep.some(item => item.url === tab.url)).length;
  renderTabs(); renderKeep(); renderSessions();
}
$("#feed").addEventListener("click", async () => {
  $("#feed").disabled = true;
  try { await sleep(null, 0); await refresh(); }
  catch (error) { notice(error.message, true); }
  finally { $("#feed").disabled = false; }
});
$("#sleep-threshold").addEventListener("click", async () => {
  try { await sleep(selectedTabIds.size ? [...selectedTabIds] : null, Number($("#threshold").value)); selectedTabIds.clear(); await refresh(); }
  catch (error) { notice(error.message, true); }
});
$("#save-form").addEventListener("submit", async event => {
  event.preventDefault();
  const name = $("#session-name").value.trim();
  if (!name) return;
  try { await send({ type: "save-session", name }); $("#session-name").value = ""; notice("Session saved."); await refresh(); }
  catch (error) { notice(error.message, true); }
});
document.querySelectorAll(".nav-button").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".nav-button").forEach(item => item.classList.toggle("selected", item === button));
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("active-view", view.id === `${button.dataset.view}-view`));
}));
$("#refresh").addEventListener("click", () => refresh().catch(error => notice(error.message, true)));
chrome.tabs.onCreated.addListener(refresh);
chrome.tabs.onRemoved.addListener(refresh);
chrome.tabs.onUpdated.addListener(refresh);
chrome.tabs.onActivated.addListener(refresh);
chrome.storage.onChanged.addListener(refresh);
refresh().catch(error => notice(error.message, true));
