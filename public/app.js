const state = {
  gameId: null,
  suspects: [],
  current: null,
  chats: {},
  busy: false,
  finished: false,
};

const $ = (id) => document.getElementById(id);

async function api(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Serverfel (${res.status})`);
  return data;
}

async function newGame() {
  const data = await api("/api/game");
  Object.assign(state, {
    gameId: data.gameId,
    suspects: data.suspects,
    current: null,
    chats: Object.fromEntries(data.suspects.map((s) => [s.id, []])),
    finished: false,
  });
  $("intro").textContent = data.intro;
  $("verdict").hidden = true;
  $("accuse").disabled = false;
  $("accuse-select").disabled = false;
  renderSuspects();
  renderChat();
}

function renderSuspects() {
  const list = $("suspect-list");
  list.innerHTML = "";
  for (const s of state.suspects) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "suspect" + (state.current === s.id ? " active" : "");
    btn.innerHTML = `<span class="portrait">${s.portrait}</span>
      <span><strong>${s.name}</strong><br><small>${s.title}</small><br>
      <span class="blurb">${s.blurb}</span></span>`;
    btn.onclick = () => {
      state.current = s.id;
      renderSuspects();
      renderChat();
      $("question").focus();
    };
    li.appendChild(btn);
    list.appendChild(li);
  }

  const select = $("accuse-select");
  select.innerHTML = state.suspects
    .map((s) => `<option value="${s.id}">${s.name}</option>`)
    .join("");
}

function renderChat() {
  const chat = $("chat");
  const suspect = state.suspects.find((s) => s.id === state.current);
  const canAsk = suspect && !state.busy && !state.finished;
  $("question").disabled = !canAsk;
  $("ask").disabled = !canAsk;

  if (!suspect) {
    $("chat-title").textContent = "Förhörsrummet";
    chat.innerHTML = `<p class="empty">Välj en misstänkt för att börja förhöret.</p>`;
    return;
  }

  $("chat-title").textContent = `Förhör med ${suspect.name}`;
  chat.innerHTML = "";
  const log = state.chats[suspect.id];
  if (log.length === 0) {
    chat.innerHTML = `<p class="empty">${suspect.name} sätter sig mittemot dig i skrivrummet.</p>`;
  }
  for (const msg of log) {
    const p = document.createElement("p");
    p.className = `msg ${msg.from}`;
    const who = msg.from === "player" ? "Du" : msg.from === "error" ? "⚠" : suspect.name;
    p.innerHTML = `<b></b> <span></span>`;
    p.querySelector("b").textContent = who + ":";
    p.querySelector("span").textContent = msg.text;
    chat.appendChild(p);
  }
  if (state.busy) {
    const p = document.createElement("p");
    p.className = "msg thinking";
    p.textContent = `${suspect.name} funderar…`;
    chat.appendChild(p);
  }
  chat.scrollTop = chat.scrollHeight;
}

$("ask-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $("question");
  const text = input.value.trim();
  const suspectId = state.current;
  if (!text || !suspectId || state.busy) return;

  input.value = "";
  state.chats[suspectId].push({ from: "player", text });
  state.busy = true;
  renderChat();
  try {
    const { reply } = await api(`/api/game/${state.gameId}/ask`, { suspectId, message: text });
    state.chats[suspectId].push({ from: "suspect", text: reply });
  } catch (err) {
    state.chats[suspectId].push({ from: "error", text: err.message });
  } finally {
    state.busy = false;
    renderChat();
    $("question").focus();
  }
});

$("accuse").addEventListener("click", async () => {
  const suspectId = $("accuse-select").value;
  const name = state.suspects.find((s) => s.id === suspectId)?.name;
  if (!confirm(`Är du säker på att du vill anklaga ${name}?`)) return;

  try {
    const result = await api(`/api/game/${state.gameId}/accuse`, { suspectId });
    state.finished = true;
    $("accuse").disabled = true;
    $("accuse-select").disabled = true;
    const verdict = $("verdict");
    verdict.hidden = false;
    verdict.className = result.correct ? "correct" : "wrong";
    verdict.innerHTML = `<h3></h3><p class="solution"></p>`;
    verdict.querySelector("h3").textContent = result.correct
      ? `Rätt! ${result.culpritName} var mördaren.`
      : `Fel. ${result.accusedName} var oskyldig – mördaren var ${result.culpritName}.`;
    verdict.querySelector(".solution").textContent = result.solution;
    renderChat();
  } catch (err) {
    alert(err.message);
  }
});

$("new-game").addEventListener("click", () => {
  if (confirm("Starta ett nytt spel? Alla förhör nollställs.")) newGame();
});

newGame().catch((err) => {
  $("intro").textContent = `Kunde inte starta spelet: ${err.message}`;
});
