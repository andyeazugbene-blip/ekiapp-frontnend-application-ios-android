const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

/**
 * A fresh `npm install` on the EAS Linux builder has occasionally been
 * observed shipping node_modules/react-native/sdks/hermesc/<platform>-bin/hermesc
 * without its execute bit set, which fails the Android release build at
 * `:app:createBundleReleaseJsAndAssets` with "A problem occurred starting
 * process '.../hermesc'". Known upstream issue class:
 * https://github.com/expo/expo/issues/42056, https://github.com/expo/expo/issues/43949
 *
 * This also logs what it actually finds — Gradle's condensed error omits
 * the underlying OS-level cause (permission vs. missing vs. wrong format),
 * so on a build-server run this output is the only way to see it.
 *
 * Defensive and never fatal: any missing platform directory or file is
 * logged and skipped rather than failing the install.
 */
const hermescRoot = path.join(__dirname, "..", "node_modules", "react-native", "sdks", "hermesc");

console.log(`[fix-hermesc-permissions] hermescRoot: ${hermescRoot}`);
console.log(`[fix-hermesc-permissions] hermescRoot exists: ${fs.existsSync(hermescRoot)}`);

if (fs.existsSync(hermescRoot)) {
  for (const platformDir of fs.readdirSync(hermescRoot)) {
    const dirPath = path.join(hermescRoot, platformDir);
    console.log(`[fix-hermesc-permissions] found platform dir: ${platformDir}`);
    let entries = [];
    try {
      entries = fs.readdirSync(dirPath);
    } catch (error) {
      console.log(`[fix-hermesc-permissions] could not list ${dirPath}: ${error}`);
      continue;
    }
    console.log(`[fix-hermesc-permissions] contents of ${platformDir}: ${entries.join(", ")}`);

    const binPath = path.join(dirPath, "hermesc");
    if (!fs.existsSync(binPath)) {
      console.log(`[fix-hermesc-permissions] no 'hermesc' file at ${binPath} — skipping`);
      continue;
    }

    const before = fs.statSync(binPath);
    console.log(`[fix-hermesc-permissions] ${binPath} size=${before.size} mode=${before.mode.toString(8)}`);

    try {
      fs.chmodSync(binPath, 0o755);
      const after = fs.statSync(binPath);
      console.log(`[fix-hermesc-permissions] chmod applied, mode now ${after.mode.toString(8)}`);
    } catch (error) {
      console.log(`[fix-hermesc-permissions] chmod failed on ${binPath}: ${error}`);
    }

    if (platformDir === "linux64-bin" && process.platform === "linux") {
      try {
        const out = execFileSync(binPath, ["-version"], { encoding: "utf8", timeout: 10000 });
        console.log(`[fix-hermesc-permissions] ${binPath} -version output: ${out.trim()}`);
      } catch (error) {
        console.log(`[fix-hermesc-permissions] running ${binPath} -version FAILED: ${error && error.message}`);
        if (error && error.code) console.log(`[fix-hermesc-permissions] error.code: ${error.code}`);
      }
    }
  }
} else {
  console.log("[fix-hermesc-permissions] hermescRoot does not exist — nothing to do");
}
