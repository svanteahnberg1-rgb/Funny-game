import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { SUSPECTS, SOLUTION, systemPromptFor, publicCase } from "./case.js";

const PORT = process.env.PORT || 3000;
const MODEL = "claude-opus-5-5";
const MAX_MESSAGE_LENGTH = 1000;
const MAX_TURNS_PER_SUSPECT = 40;

const client = new Anthropic();
const app = express();
app.use(express.json());
app.use(express.static("public"));

// Spelen hålls i minnet. Historiken ligger på servern så att spelaren inte kan
// skriva om vad de misstänkta har sagt, och så att mördaren aldrig skickas till webbläsaren.
const games = new Map();

function getGame(req, res) {
  const game = games.get(req.params.id);
  if (!game) res.status(404).json({ error: "Spelet finns inte. Starta ett nytt." });
  return game;
}

app.post("/api/game", (req, res) => {
  const id = randomUUID();
  games.set(id, {
    histories: Object.fromEntries(SUSPECTS.map((s) => [s.id, []])),
    finished: false,
  });
  res.json({ gameId: id, ...publicCase() });
});

app.post("/api/game/:id/ask", async (req, res) => {
  const game = getGame(req, res);
  if (!game) return;
  if (game.finished) return res.status(400).json({ error: "Fallet är redan avslutat." });

  const suspect = SUSPECTS.find((s) => s.id === req.body.suspectId);
  if (!suspect) return res.status(400).json({ error: "Okänd misstänkt." });

  const text = String(req.body.message ?? "").trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text) return res.status(400).json({ error: "Skriv en fråga." });

  const history = game.histories[suspect.id];
  if (history.length / 2 >= MAX_TURNS_PER_SUSPECT) {
    return res.status(400).json({ error: `${suspect.name} orkar inte svara på fler frågor.` });
  }

  const messages = [...history, { role: "user", content: text }];
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: systemPromptFor(suspect),
      messages,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (response.stop_reason === "refusal") {
      return res.status(502).json({ error: `${suspect.name} vägrar svara på det. Försök formulera om frågan.` });
    }

    const reply = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    // Spara hela svaret (inklusive tankeblock) så att historiken skickas tillbaka oförändrad.
    history.push({ role: "user", content: text }, { role: "assistant", content: response.content });
    res.json({ reply: reply || "*tiger*" });
  } catch (err) {
    console.error(err);
    let message = "Något gick fel när den misstänkta skulle svara.";
    if (err instanceof Anthropic.AuthenticationError) {
      message = "Ogiltig eller saknad API-nyckel. Sätt ANTHROPIC_API_KEY och starta om servern.";
    } else if (err instanceof Anthropic.RateLimitError) {
      message = "För många förfrågningar just nu. Vänta en stund och försök igen.";
    } else if (err instanceof Anthropic.APIConnectionError) {
      message = "Kunde inte nå Claude API:t. Kontrollera nätverket.";
    }
    res.status(502).json({ error: message });
  }
});

app.post("/api/game/:id/accuse", (req, res) => {
  const game = getGame(req, res);
  if (!game) return;

  const accused = SUSPECTS.find((s) => s.id === req.body.suspectId);
  if (!accused) return res.status(400).json({ error: "Okänd misstänkt." });

  const culprit = SUSPECTS.find((s) => s.culprit);
  game.finished = true;
  res.json({
    correct: accused.id === culprit.id,
    accusedName: accused.name,
    culpritName: culprit.name,
    solution: SOLUTION,
  });
});

app.listen(PORT, () => {
  console.log(`Deckarspelet körs på http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.warn("Varning: ANTHROPIC_API_KEY är inte satt. Förhören kommer inte att fungera.");
  }
});
