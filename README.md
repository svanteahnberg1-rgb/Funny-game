# Mordet på Värdshuset Ripan

Ett textbaserat deckarspel i webbläsaren. Värden på ett värdshus i Jämtlandsfjällen har mördats under en snöstorm, och du förhör de fyra misstänkta en i taget. Varje misstänkt spelas av Claude med en egen systemprompt som innehåller personlighet, alibi och hemlighet. När du tror att du vet vem som gjorde det gör du en anklagelse, och spelet visar om du hade rätt.

## Kör lokalt

Kräver Node 18 eller senare och en API-nyckel från Anthropic.

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

Öppna sedan http://localhost:3000.

## Struktur

- `server.js`: Express-server. Håller varje spel och förhörshistorik i minnet och anropar Claude (`claude-opus-5-5`) med den misstänktas systemprompt.
- `case.js`: Fallet, de misstänkta och lösningen. **Spoilers!**
- `public/`: Frontend i vanlig HTML, CSS och JavaScript.

Mördaren och lösningen skickas aldrig till webbläsaren förrän du har gjort din anklagelse.
