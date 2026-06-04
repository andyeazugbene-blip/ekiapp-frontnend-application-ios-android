const fs = require("fs");
const path = require("path");

const appJsonPath = path.join(__dirname, "..", "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));

const current = Number(appJson.expo?.ios?.buildNumber || 0);
const ciBuildNumber = Number(process.env.CM_BUILD_NUMBER || process.env.BUILD_NUMBER || 0);
const nextBuildNumber = Math.max(current, ciBuildNumber, 8);

appJson.expo.ios = {
  ...appJson.expo.ios,
  buildNumber: String(nextBuildNumber),
};

fs.writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);
console.log(`iOS buildNumber set to ${nextBuildNumber}`);
