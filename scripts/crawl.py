"""Crawl trustayurved.com and snapshot its exact copy + images.

Writes:
  src/data/crawl.json        every page's Elementor widgets, in document order,
                             as typed text blocks (h1-h6 / p / li) + images + links
  src/data/posts.json        blog posts from the WordPress REST API
  src/assets/wp/...          original-resolution images referenced by the site

Copy on the new site is rendered from these files only, never retyped.
Stdlib only. Run:  python3 -I scripts/crawl.py
"""
import html, json, os, re, sys, urllib.request
from html.parser import HTMLParser

BASE = "https://trustayurved.com"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data")
ASSETS = os.path.join(ROOT, "src", "assets", "wp")

PAGES = {
    "home": "/",
    "about": "/about/",
    "vd-sohan-pathak": "/vd-sohan-pathak/",
    "vd-ashwini-pathak": "/vd-ashwini-pathak/",
    "tadvit-counselling-center": "/tadvit-counselling-center/",
    "general-lifestyle-disorders": "/general-lifestyle-disorders/",
    "specialized-treatments": "/specialized-treatments/",
    "organ-specific-disorders": "/organ-specific-disorders/",
    "panchakarma-therapies": "/panchakarma-therapies/",
    "mental-health": "/mental-health/",
    "blog": "/blog/",
    "gallery": "/gallery/",
    "contact": "/contact/",
    "compare": "/compare/",
    "faq": "/faq/",
    "privacy-policy": "/privacy-policy/",
    "terms-condition": "/terms-condition/",
}

# Extra images that live only in theme/header markup
EXTRA_IMAGES = [
    "/wp-content/uploads/2026/05/Gemini_Generated_Image_jc5d9zjc5d9zjc5d__1_-removebg-preview-1.png",  # logo
    "/wp-content/uploads/2026/05/New-Project-83.png",  # site icon
]

UA = {"User-Agent": "Mozilla/5.0 (site-snapshot)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


VOID = {"img", "br", "hr", "input", "meta", "link", "source", "area", "base", "col", "embed", "param", "track", "wbr"}
BLOCKS = {"h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "summary", "figcaption", "blockquote"}
SKIP = {"script", "style", "noscript", "svg", "form", "template"}


class Widgets(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.loc, self.out = [], [], []
        self.w = None  # current widget
        self.wdepth = 0
        self.skip = 0
        self.buf, self.btag = "", None

    # -- helpers
    def flush(self, tag=None):
        t = re.sub(r"\s+", " ", self.buf.replace(" ", " ")).strip()
        if self.w is not None and t:
            self.w["blocks"].append({"t": tag or self.btag or "p", "text": t})
        self.buf = ""

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get("class") or ""
        mark = None
        if "elementor-location-header" in cls:
            mark = "header"
        elif "elementor-location-footer" in cls:
            mark = "footer"
        if mark:
            self.loc.append(mark)
        if tag in SKIP:
            self.skip += 1
        wt = a.get("data-widget_type")
        if wt and self.w is None and not self.skip:
            self.w = {"type": wt.replace(".default", ""), "loc": self.loc[-1] if self.loc else "main",
                      "blocks": [], "imgs": [], "links": []}
            self.wdepth = len(self.stack)
        if self.w is not None and not self.skip:
            item = tag == "span" and "wd-marquee-item" in cls
            if item or tag in BLOCKS or tag == "br" or (tag == "div" and self.buf.strip()):
                self.flush()
            if item:
                self.btag = "li"
            if tag in BLOCKS:
                self.btag = "li" if tag == "summary" else tag
            if tag == "summary":
                self.btag = "q"
            if tag == "img":
                src = a.get("data-lazy-src") or a.get("data-src") or a.get("src")
                if src and not src.startswith("data:"):
                    self.w["imgs"].append({"src": src, "alt": a.get("alt", "")})
            if tag == "a" and a.get("href"):
                self.w["links"].append(a["href"])
        if tag not in VOID:
            self.stack.append((tag, mark, tag in SKIP, tag == "span" and "wd-marquee-item" in cls))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        closed_item = False
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                for t, m, sk, it in self.stack[i:]:
                    closed_item = closed_item or it
                    if sk:
                        self.skip -= 1
                    if m and self.loc:
                        self.loc.pop()
                del self.stack[i:]
                break
        if self.w is not None:
            if tag in BLOCKS or closed_item:
                self.flush()
                self.btag = None
            if len(self.stack) <= self.wdepth:
                self.flush()
                self.out.append(self.w)
                self.w = None

    def handle_data(self, d):
        if self.w is not None and not self.skip:
            self.buf += d


def page_meta(raw):
    t = re.search(r"<title>(.*?)</title>", raw, re.S)
    d = re.search(r'<meta name="description" content="([^"]*)"', raw)
    return {"title": html.unescape(t.group(1)).strip() if t else "",
            "description": html.unescape(d.group(1)) if d else ""}


SIZE_SUFFIX = re.compile(r"-\d+x\d+(?=\.(png|jpe?g|webp|gif)$)", re.I)


def original(url):
    return SIZE_SUFFIX.sub("", url)


def local_path(url):
    path = url.split("/wp-content/uploads/", 1)[1]
    return os.path.join(ASSETS, path)


def main():
    os.makedirs(DATA, exist_ok=True)
    crawl, images = {}, set(BASE + p for p in EXTRA_IMAGES)
    for key, path in PAGES.items():
        raw = get(BASE + path).decode("utf-8")
        p = Widgets()
        p.feed(raw)
        widgets = []
        for w in p.out:
            w["imgs"] = [{"src": original(i["src"]), "alt": i["alt"]} for i in w["imgs"]]
            w["links"] = list(dict.fromkeys(w["links"]))
            widgets.append(w)
            for i in w["imgs"]:
                if "/wp-content/uploads/" in i["src"]:
                    images.add(i["src"])
            if w["type"] == "gallery":
                for l in w["links"]:
                    if "/wp-content/uploads/" in l:
                        images.add(l)
        # google maps iframes
        maps = [html.unescape(m) for m in re.findall(r'<iframe[^>]*src="(https://maps\.google\.com[^"]+)"', raw)]
        crawl[key] = {"path": path, **page_meta(raw), "widgets": widgets, "maps": maps}
        print(f"page {key}: {len(widgets)} widgets", file=sys.stderr)

    posts = json.loads(get(BASE + "/wp-json/wp/v2/posts?per_page=50&_embed=1"))
    post_out = []
    for po in posts:
        content = po["content"]["rendered"]
        for src in re.findall(r'src="([^"]+/wp-content/uploads/[^"]+)"', content):
            images.add(original(src))
        fm = (po.get("_embedded", {}).get("wp:featuredmedia") or [{}])[0].get("source_url")
        if fm:
            images.add(fm)
        post_out.append({
            "slug": po["slug"], "date": po["date"], "link": po["link"],
            "title": html.unescape(po["title"]["rendered"]),
            "excerpt": html.unescape(re.sub(r"<[^>]+>", "", po["excerpt"]["rendered"])).strip(),
            "content": content, "featured": fm,
        })

    with open(os.path.join(DATA, "crawl.json"), "w", encoding="utf-8") as f:
        json.dump(crawl, f, ensure_ascii=False, indent=1)
    with open(os.path.join(DATA, "posts.json"), "w", encoding="utf-8") as f:
        json.dump(post_out, f, ensure_ascii=False, indent=1)

    for url in sorted(images):
        dest = local_path(url)
        if os.path.exists(dest):
            continue
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        try:
            data = get(url)
        except Exception as e:  # fall back to the sized variant if original 404s
            print(f"  ! {url}: {e}", file=sys.stderr)
            continue
        with open(dest, "wb") as f:
            f.write(data)
        print(f"img {url} ({len(data)//1024} KB)", file=sys.stderr)


if __name__ == "__main__":
    main()
