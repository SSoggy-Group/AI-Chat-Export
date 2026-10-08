(async () => {
    try {
        await import(chrome.runtime.getURL('content/main.js'));
    } catch {
        // Module load failure handled silently
    }
})();
