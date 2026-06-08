# Susceptibilitat

Peça audiovisual interactiva sobre el loop de detecció privativa, acompanyant el TFG _Sensibilitat i intel·ligència_ (Martí Recalde Tarrón, Filosofia UB, 2025–2026).

## Què és

Un camp de mini-agents amb susceptibilitat selectiva. Cada agent té una afinitat (a què és susceptible) i un to (estat tònic actual). Els estímuls de l'entorn provoquen suscitació, modificació tònica i resposta. La resposta inclou una modulació de la pròpia afinitat — el camp es sintonitza per la seva història. És el _loop de detecció privativa_ fet imatge.

## Com executar localment

Els `<script type="module">` requereixen ser servits per HTTP. Des de l'arrel del projecte:

```bash
python3 -m http.server 8000
```

I obre <http://localhost:8000>.

## Estructura

- `index.html` — pàgina amb la peça i el text de reflexió en català.
- `embed.html` — només el canvas, preparat per ser carregat en un `<iframe>`.
- `src/` — codi font del sketch (p5.js, modules).
  - `agent.js` — la unitat: MiniAgent.
  - `camp.js` — el conjunt: orquestra els tres moments.
  - `estimul.js` — les pertorbacions de l'entorn.
  - `sketch.js` — entry point i auto-muntatge.
  - `style.css` — estils compartits.
- `text/reflexio.md` — text que acompanya la peça.
- `docs/notes.md` — bitàcola d'iteració.

## Per embeber en una web aliena

La via més robusta és l'`<iframe>` (sense conflictes de CSS o JS):

```html
<iframe
  src="https://el-teu-host/embed.html"
  style="width: 100%; height: 600px; border: 0; display: block;"
  loading="lazy"
></iframe>
```
