const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Some dependencies (e.g. zustand) ship an ESM build that uses `import.meta`,
// which Metro's web bundle does not execute as a module — forcing package
// resolution back to the CJS/main entry avoids that crash on web.
config.resolver.unstable_enablePackageExports = false;

module.exports = withNativeWind(config, { input: "./global.css" });
