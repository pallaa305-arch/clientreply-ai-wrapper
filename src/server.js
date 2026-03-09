import express from "express";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.static(path.resolve("public")));

app.get("/", (_, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

app.get("/health", (_, res) => res.json({ ok: true }));
app.post("/api/generate", (req, res) => res.json({ success: true, echo: req.body }));

app.listen(process.env.PORT || 8787, () => console.log("running"));
