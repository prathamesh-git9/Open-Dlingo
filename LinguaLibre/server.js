// LinguaLibre server — open-source Duolingo-style app. Unlimited. No energy, no ads.
const express = require("express");
const fs = require("fs");
const path = require("path");
const grokRouter = require("./grok");
const { GERMAN_COURSE, ENGLISH_COURSE } = require("./data/courses");

// tiny .env loader (no dependency)
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/courses", (req, res) => {
  res.json([GERMAN_COURSE, ENGLISH_COURSE].map((c) => ({ id: c.id, name: c.name, flag: c.flag, units: c.units.length, lessons: c.units.reduce((a, u) => a + u.lessons.length, 0) })));
});

app.get("/api/course/:id", (req, res) => {
  const course = req.params.id === "de" ? GERMAN_COURSE : req.params.id === "en" ? ENGLISH_COURSE : null;
  if (!course) return res.status(404).json({ error: "course not found" });
  res.json(course);
});

app.use("/api", grokRouter);

app.get("/api/status", (req, res) => {
  res.json({ app: "LinguaLibre", unlimited: true, energy: false, points: false, grokKeyConfigured: !!process.env.XAI_API_KEY });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🦉 LinguaLibre running at http://localhost:${PORT}`);
  console.log(process.env.XAI_API_KEY ? "✅ Grok API key detected — AI tutor enabled (unlimited)" : "⚠️  No XAI_API_KEY in .env — AI tutor disabled, offline courses still work fully");
});
