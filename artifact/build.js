// Bygger en fristående spelsida (artifact/ripan.html) från fallet i case.js.
// Sidan låter Claude spela de misstänkta via claude.ai:s "sample"-funktion,
// så den behöver varken server eller API-nyckel.
import { readFileSync, writeFileSync } from "node:fs";
import { SUSPECTS, SOLUTION, systemPromptFor, publicCase } from "../case.js";

const facts = publicCase()
  .intro.split("\n")
  .filter((line) => line.startsWith("- "))
  .map((line) => line.slice(2));

const data = {
  facts,
  suspects: SUSPECTS.map((s) => ({
    id: s.id,
    name: s.name,
    title: s.title,
    blurb: s.blurb,
    prompt: systemPromptFor(s),
  })),
  culpritId: SUSPECTS.find((s) => s.culprit).id,
  solution: SOLUTION,
};

const encoded = Buffer.from(JSON.stringify(data), "utf8").toString("base64");
const template = readFileSync(new URL("./template.html", import.meta.url), "utf8");
writeFileSync(new URL("./ripan.html", import.meta.url), template.replace("__CASE_DATA__", encoded));
console.log("Skrev artifact/ripan.html");
