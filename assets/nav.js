const cache = new Map();
const inflight = new Set();

async function navigate(url, push = true) {
  if (inflight.has(url)) return;
  inflight.add(url);
  try {
    let text = cache.get(url);
    if (!text) {
      const res = await fetch(url);
      if (!res.ok) return;
      text = await res.text();
      cache.set(url, text);
    }
    const doc = new DOMParser().parseFromString(text, "text/html");
    const main = doc.querySelector("main");
    if (!main) return;
    document.querySelector("main").replaceWith(main);
    document.title = doc.title;
    if (push) history.pushState(null, "", url);
  } finally {
    inflight.delete(url);
  }
}

if (location.protocol !== "file:") {
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a || !a.href) return;
    const url = new URL(a.href);
    if (url.origin !== location.origin) return;
    e.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  });

  window.addEventListener("popstate", () =>
    navigate(location.pathname + location.search, false),
  );
}
