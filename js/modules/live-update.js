(() => {
    const releasesUrl = 'https://api.github.com/repos/mirellefeatherstone/xinOVO/releases?per_page=10';
    const bundleAssetName = 'xinovo-live-update.zip';
    const checkInterval = 30 * 60 * 1000;
    const lastCheckKey = 'xinovo_live_update_last_check';
    let readyPromise;

    function getPlugin() {
        if (window.Capacitor?.getPlatform?.() === 'web') return null;
        return window.Capacitor?.Plugins?.LiveUpdate || null;
    }

    function ensureReady(plugin) {
        readyPromise ||= plugin.ready();
        return readyPromise;
    }

    async function getLatestRelease() {
        const response = await fetch(`${releasesUrl}&t=${Date.now()}`, {
            cache: 'no-store',
            headers: { Accept: 'application/vnd.github+json' },
        });
        if (!response.ok) throw new Error(`GitHub release request failed: ${response.status}`);
        const releases = await response.json();
        return releases.find(release => release.tag_name?.startsWith('live-')
            && release.assets?.some(asset => asset.name === bundleAssetName)) || null;
    }

    function getChecksum(release, asset) {
        if (asset.digest?.startsWith('sha256:')) return asset.digest.slice(7);
        return release.body?.match(/^bundle-sha256:\s*([a-f0-9]{64})$/mi)?.[1] || undefined;
    }

    async function checkNow(force = true) {
        const plugin = getPlugin();
        if (!plugin) return false;

        const lastCheck = Number(localStorage.getItem(lastCheckKey)) || 0;
        if (!force && Date.now() - lastCheck < checkInterval) return false;
        localStorage.setItem(lastCheckKey, String(Date.now()));

        await ensureReady(plugin);
        const release = await getLatestRelease();
        if (!release) return false;

        const bundleId = release.tag_name;
        const current = await plugin.getCurrentBundle();
        if (current.bundleId === bundleId) return false;

        const asset = release.assets.find(item => item.name === bundleAssetName);
        const downloaded = await plugin.getDownloadedBundles();
        if (!downloaded.bundleIds.includes(bundleId)) {
            await plugin.downloadBundle({
                url: asset.browser_download_url,
                bundleId,
                checksum: getChecksum(release, asset),
            });
        }
        await plugin.setNextBundle({ bundleId });
        await plugin.reload();
        return true;
    }

    window.UwULiveUpdate = { checkNow: () => checkNow(true) };

    const plugin = getPlugin();
    if (plugin) {
        ensureReady(plugin)
            .then(() => setTimeout(() => checkNow(false).catch(error => console.warn('[UwU Live Update]', error)), 4000))
            .catch(error => console.warn('[UwU Live Update]', error));
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                checkNow(false).catch(error => console.warn('[UwU Live Update]', error));
            }
        });
    }
})();
