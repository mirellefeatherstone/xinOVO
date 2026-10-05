(() => {
    const groupedSettingKeys = ['globalSettings', 'theaterData'];

    function unwrapGroupedSettings(source) {
        if (!source || typeof source !== 'object' || Array.isArray(source)) {
            return { data: source, groups: [], restoredKeys: [] };
        }

        const data = { ...source };
        const groups = [];
        const restoredKeys = new Set();
        groupedSettingKeys.forEach(groupKey => {
            const group = data[groupKey];
            if (!group || typeof group !== 'object' || Array.isArray(group)) return;
            groups.push(groupKey);
            Object.entries(group).forEach(([key, value]) => {
                if (value === undefined) return;
                // Legacy partial backups stored settings in wrapper objects; those values are the source data.
                data[key] = value;
                restoredKeys.add(key);
            });
            delete data[groupKey];
        });

        return { data, groups, restoredKeys: Array.from(restoredKeys) };
    }

    window.UwUBackupCompat = { unwrapGroupedSettings };
})();
