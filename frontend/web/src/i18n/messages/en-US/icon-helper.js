export default {
  iconHelper: {
    consentTitle: "Install icon helper app",
    consentBody:
      "A tiny helper app must be installed on the device to extract app names and icons. Icons are stored in the helper app’s own directory and read over ADB.",
    allow: "Allow install",
    deny: "Not now",
    deniedHint:
      "Icon helper install is turned off; package names only. Enable it under Settings → App icon helper.",
    installing: "Installing / updating icon helper…",
    extracting: "Extracting app icons and names…",
    extractingProgress: "Extracting ({done}/{total})",
    loadingPackageNames: "Loading package names…",
    searchApps: "Search apps",
    loadingApps: "Loading apps…",
    loadFailed: "Failed to load apps",
    noMatch: "No matching apps",
    emptyApps: "No apps available",
    appKind: "App",
  },
};
