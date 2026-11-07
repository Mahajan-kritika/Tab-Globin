# Tab Goblin

Tab Goblin is a local-only Manifest V3 Chrome extension for organizing tabs, protecting important pages, discarding inactive tabs without closing them, and saving URL-based browsing sessions.

## Install

1. Open `chrome://extensions/` in Chrome.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this project folder.
4. Pin the Tab Goblin toolbar icon if desired.

## Use

- The popup dashboard shows open, sleeping, awake, and protected tab counts. It refreshes on tab and storage changes.
- **Feed the Goblin** sorts eligible tabs by tracked inactivity and calls Chrome's native `tabs.discard()`. It never closes tabs. Active, pinned, protected, already discarded, unsupported-scheme, and Chrome-ineligible tabs are excluded.
- The inactivity selector can be combined with selected tabs using **Sleep eligible**. No selection means no tabs are slept by that button.
- **Keep** protects every open tab with that exact URL, including matching duplicates, and persists across browser restarts. Remove it from the tab row or Keep list.
- **Sessions** save URL/title/order/pinned metadata locally, and support preview, selected/all restore, duplicate skipping, rename, and deletion. Restored tabs are opened in the current window where possible.

## Form safety and permissions

Before sleeping tabs, the extension asks for optional access to websites so it can inspect common form controls and contenteditable fields for data that appears populated or changed. Granting access is optional and is requested only when the user asks to sleep tabs. If denied, sleeping is cancelled. Tabs with detected form data are skipped. The popup also shows a confirmation warning before each sleep operation. File URLs are excluded because they may require a separate Chrome file-access setting.

This is a best-effort safeguard, not a guarantee: a page can keep state in custom widgets, scripts, editors, or other controls that cannot be reliably detected. Sleeping/discarding or restoring a URL does not guarantee recovery of unsaved form contents, JavaScript state, or media state. Review important pages before sleeping them and use Keep for anything important. `chrome://` pages and other unsupported URLs are not slept.

## Activity tracking

Last active times are stored locally from extension installation onward, including activation and focused-window changes. Existing tabs without an observed activation have **Activity unknown** and are not eligible for inactivity-based sleeping. Activity is attached to tab IDs; a newly created/replaced tab gets tracking when Chrome reports relevant events.

## Testing notes and limitations

This project workspace does not provide a running Chrome instance or extension test harness. Manifest parsing and automated Chrome integration tests (including the requested 30-tab workflow) therefore cannot be truthfully claimed here. After loading, verify with a disposable set of tabs first. The extension requires Chrome support for the Manifest V3 Tabs, Storage, Scripting, and optional permissions APIs.

The extension does not use a backend, network API, or remote assets. Saved sessions store URLs, titles, pinning and order, not the live contents of pages. Tab grouping metadata is represented as saved window groups, but restore places the saved groups into the current window rather than recreating exact browser windows/groups.
