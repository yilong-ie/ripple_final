const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  const outDir = path.resolve(__dirname, "recordings");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
    recordVideo: { dir: outDir, size: { width: 1440, height: 900 } }
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      console.log(`[browser ${msg.type()}]`, msg.text());
    }
  });
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));

  await page.goto("http://localhost:3020", { waitUntil: "load" });

  // capture the bottle entrance (~3.5s) with a small tail
  await page.waitForTimeout(5000);

  await page.close();
  await context.close();
  await browser.close();

  // rename the generated video to something predictable
  const files = fs.readdirSync(outDir).filter(f => f.endsWith(".webm"));
  if (files.length) {
    const src = path.join(outDir, files[files.length - 1]);
    const dst = path.join(outDir, "vineledger-intro.webm");
    if (src !== dst) {
      if (fs.existsSync(dst)) fs.unlinkSync(dst);
      fs.renameSync(src, dst);
    }
    console.log("Saved:", dst);
  } else {
    console.log("No video produced in", outDir);
  }
})();
