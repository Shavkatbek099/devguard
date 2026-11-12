// Theme toggle + docs search (no dependencies). Loaded on every page.
const root = document.documentElement;
try {
  const t = localStorage.getItem('dg-theme');
  if (t) root.dataset.theme = t;
} catch {
  /* storage unavailable */
}
document.getElementById('theme')?.addEventListener('click', () => {
  const dark = (root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  root.dataset.theme = dark ? 'light' : 'dark';
  try {
    localStorage.setItem('dg-theme', root.dataset.theme);
  } catch {
    /* ignore */
  }
});
const input = document.getElementById('q'),
  box = document.getElementById('results');
let index = null;
async function load() {
  if (!index) index = await (await fetch(input.dataset.index)).json();
  return index;
}
function render(items) {
  box.replaceChildren(
    ...items.map((d) => {
      const a = document.createElement('a');
      a.href = new URL(d.url, new URL(input.dataset.index, location.href)).href;
      a.textContent = d.title;
      const s = document.createElement('small');
      s.textContent = d.snippet;
      a.append(s);
      return a;
    }),
  );
  box.classList.toggle('on', items.length > 0 || input.value.length > 1);
  if (!items.length && input.value.length > 1) box.textContent = 'No results';
}
input?.addEventListener('input', async () => {
  const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return render([]);
  const hits = (await load())
    .map((d) => {
      const t = d.title.toLowerCase(),
        b = d.text.toLowerCase();
      const score = terms.reduce((s, w) => s + (t.includes(w) ? 5 : 0) + Math.min(b.split(w).length - 1, 5), 0);
      const i = Math.max(0, b.indexOf(terms[0]));
      return { ...d, score, snippet: d.text.slice(Math.max(0, i - 30), i + 90) };
    })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  render(hits);
});
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
    e.preventDefault();
    input.focus();
  }
  if (e.key === 'Escape') box.classList.remove('on');
});
