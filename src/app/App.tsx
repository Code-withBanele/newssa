import { useState, useEffect, useRef } from "react";
import {
  Search, Menu, X, ChevronDown, ArrowRight, TrendingUp, TrendingDown,
  Clock, Facebook, Twitter, Linkedin, Mail, ArrowUp, Bookmark,
  MessageSquare, ChevronLeft, ChevronRight, Instagram, Youtube, User
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { Article } from "../utils/transform";
import { usePosts } from "../hooks/usePosts";
import { usePost } from "../hooks/usePost";
import { useCategory } from "../hooks/useCategory";
import { useFeaturedPosts } from "../hooks/useFeaturedPosts";
import { useSearch } from "../hooks/useSearch";
import {
  AccountUser, getCurrentUser, getSavedArticles, login, logout, register,
  saveArticle, subscribeNewsletter, unsaveArticle, verifyTwoFactor,
} from "../services/accountClient";
import {
  ArticleCardSkeleton, ArticleCardHorizontalSkeleton, HeroSkeleton,
  ErrorState, EmptyState, NotConfiguredState,
} from "../components/LoadingStates";

// --- Image imports from Figma design ---
import navVideo from "@/imports/vecteezy_multimedia-screens-recording-translation-broadcast-record-tv_49532703.mp4";
import logoImg from "@/imports/Body/23028179d84c8ac263f16970552b2d9e23bb08f9.png";
import heroImg from "@/imports/Body/39e4919faba4198282e1b875842f8570b475addb.png";
import glacierImg from "@/imports/Body/89bd8856bac3f831a7d919359761c70b84923043.png";
import aiImg from "@/imports/Body/5c8b40ccfbd6b7f29412c693d40841181e813927.png";
import quantumImg from "@/imports/Body/62889c953db3768ed167863ac4610eff744dd298.png";
import springbokImg from "@/imports/Body/b56a65e259bc518fde88094e8f031dbb9d17f352.png";
import cinemaImg from "@/imports/Body/c30441ef42a11b3f9bda5b25898504786c8fa21d.png";
import cabinetImg from "@/imports/Body/ae46fbc1b1362ec2529c543a4dea0d16ec4421f6.png";
import eskomImg from "@/imports/Body/d083de64f925ea12fbaae9cf41057e14efca9cfe.png";
import jumoImg from "@/imports/Body/d00a8dd0ba23d4101393c68a95a4bdfc5466b4f2.png";
import selloImg from "@/imports/Body/e4d6a2e1442cc46c9c05f6851f3a775028e65458.png";
import sowetaImg from "@/imports/Body/cac906114b2abd100defababcde8e853ee603ace.png";
import homePage1Img from "@/imports/Body/ccb9a0a56ff2339b740b103f0edfb47b2de0cdf9.png";

// --- Types ---
type Page =
  | { type: "home" }
  | { type: "category"; name: string }
  | { type: "article"; id: number }
  | { type: "finance" }
  | { type: "search"; query: string };

// --- Category meta ---
const CATEGORY_META: Record<string, { color: string; textColor: string }> = {
  Politics: { color: "rgba(30,58,138,0.08)", textColor: "#1e3a8a" },
  Technology: { color: "rgba(187,77,0,0.3)", textColor: "#4338ca" },
  Business: { color: "#ebd7c5", textColor: "#065f46" },
  Economy: { color: "#e0f2f1", textColor: "#065f46" },
  Climate: { color: "rgba(180,83,9,0.19)", textColor: "#0d9488" },
  Sports: { color: "#e6c3a8", textColor: "#ea580c" },
  Entertainment: { color: "#e6c3a8", textColor: "#7c3aed" },
  Opinion: { color: "#e6c3a8", textColor: "#b45309" },
  Africa: { color: "rgba(234,88,12,0.15)", textColor: "#c2410c" },
  World: { color: "#e0e7ff", textColor: "#3730a3" },
  Finance: { color: "#d1fae5", textColor: "#065f46" },
  Leadership: { color: "#fef3c7", textColor: "#92400e" },
    Science: { color: "rgba(99,102,241,0.15)", textColor: "#4f46e5" },
};

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] || { color: "#ede9e3", textColor: "#6b6880" };
}

// Content is now fetched from WordPress — see src/hooks/ and src/api/

// Highlight utility for search overlay keyword marking
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string): React.ReactNode {
  const terms = query.trim().split(/\s+/).filter(t => t.length > 1);
  if (terms.length === 0) return text;
  const pat = new RegExp(`(${terms.map(escapeRegex).join("|")})`, "gi");
  const parts = text.split(pat);
  const matchPat = new RegExp(`^(${terms.map(escapeRegex).join("|")})$`, "i");
  return (
    <>
      {parts.map((part, i) =>
        matchPat.test(part) ? (
          <mark key={i} className="bg-orange-200/70 text-foreground not-italic rounded-[2px] px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// --- Finance data ---
const MARKET_DATA = [
  { name: "JSE Top 40", value: "78,234", change: "+1.2%", positive: true, category: "Index" },
  { name: "S&P 500", value: "5,832", change: "-0.3%", positive: false, category: "Index" },
  { name: "NASDAQ", value: "19,456", change: "+0.8%", positive: true, category: "Index" },
  { name: "Dow Jones", value: "42,150", change: "-0.1%", positive: false, category: "Index" },
  { name: "FTSE 100", value: "8,234", change: "+0.5%", positive: true, category: "Index" },
  { name: "Bitcoin", value: "$67,420", change: "+3.2%", positive: true, category: "Crypto" },
  { name: "Ethereum", value: "$3,541", change: "+2.1%", positive: true, category: "Crypto" },
  { name: "Gold", value: "$2,156/oz", change: "+0.4%", positive: true, category: "Commodity" },
  { name: "Brent Crude", value: "$81.42/bbl", change: "-0.7%", positive: false, category: "Commodity" },
  { name: "USD/ZAR", value: "18.65", change: "-0.2%", positive: true, category: "Currency" },
  { name: "EUR/ZAR", value: "20.12", change: "+0.3%", positive: false, category: "Currency" },
  { name: "GBP/ZAR", value: "23.45", change: "+0.1%", positive: false, category: "Currency" },
];

function makeSparkData(positive: boolean) {
  const base = 50 + Math.random() * 20;
  const trend = positive ? 1 : -1;
  return Array.from({ length: 12 }, (_, i) => ({
    v: base + trend * i * 1.5 + (Math.random() - 0.5) * 8,
  }));
}

// --- Nav categories ---
const NAV_CATEGORIES = [
  "News", "Technology", "Politics", "Business", "Finance",
  "Sports", "Science", "Motoring", "Entertainment", "Opinion",
];
const ALL_CATEGORIES = [
  "Home", "Politics", "Business", "Economy", "Africa", "World",
  "Technology", "Sports", "Science", "Entertainment", "Opinion", "Leadership & Ideas", "Finance", "Contact",
];

// --- Helpers ---
function CategoryBadge({ category, small }: { category: string; small?: boolean }) {
  const meta = getCategoryMeta(category);
  return (
    <span
      className={`inline-block font-mono tracking-widest uppercase ${small ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-1"}`}
      style={{ backgroundColor: meta.color, color: meta.textColor }}
    >
      {category}
    </span>
  );
}

function ArticleCardLarge({ article, onClick }: { article: Article; onClick: () => void }) {
  return (
    <article
      className="cursor-pointer group transform-gpu overflow-hidden border border-border transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-foreground/30 hover:shadow-lg active:scale-[0.99] motion-reduce:transition-none"
      onClick={onClick}
    >
      <div className="relative overflow-hidden h-[400px] lg:h-[480px]">
        <img
          src={article.image}
          alt={article.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 p-8">
          <CategoryBadge category={article.category} />
          <h2 className="font-['Playfair_Display',serif] font-black text-white text-3xl lg:text-4xl leading-tight mt-3 max-w-2xl">
            {article.title}
          </h2>
          <div className="flex items-center gap-4 mt-4 text-white/60 font-mono text-[9px] tracking-widest uppercase">
            <span>{article.author}</span>
            <span>·</span>
            <span>{article.timeAgo}</span>
            <span>·</span>
            <span>{article.readTime}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function ArticleCardMedium({ article, onClick }: { article: Article; onClick: () => void }) {
  return (
    <article className="cursor-pointer group transform-gpu border-b border-border pb-6 last:border-0 last:pb-0 transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-foreground/30 hover:shadow-md active:scale-[0.99] motion-reduce:transition-none" onClick={onClick}>
      <div className="overflow-hidden mb-3 h-[200px]">
        <img
          src={article.image}
          alt={article.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <CategoryBadge category={article.category} small />
      <h3 className="font-['Playfair_Display',serif] font-bold text-foreground text-lg leading-snug mt-2 group-hover:text-accent transition-colors">
        {article.title}
      </h3>
      <p className="font-['Inter',sans-serif] font-medium text-foreground/75 text-sm leading-relaxed mt-2 line-clamp-2">{article.subtitle}</p>
      <div className="flex items-center gap-2 mt-3 text-foreground/65 font-mono text-[10px] tracking-widest uppercase">
        <span>{article.author}</span>
        <span>·</span>
        <span>{article.timeAgo}</span>
      </div>
    </article>
  );
}

function ArticleCardSmall({ article, onClick, index }: { article: Article; onClick: () => void; index?: number }) {
  return (
    <article
      className="cursor-pointer group transform-gpu flex gap-4 py-4 border-b border-border last:border-0 transition-[transform,background-color] duration-300 ease-out hover:-translate-y-0.5 hover:bg-secondary/20 active:scale-[0.99] motion-reduce:transition-none"
      onClick={onClick}
    >
      {index !== undefined && (
        <span className="font-['Playfair_Display',serif] font-black text-foreground/10 text-2xl leading-none shrink-0 w-6">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <div className="flex-1 min-w-0">
        {index === undefined && <CategoryBadge category={article.category} small />}
        <h4 className="font-['Playfair_Display',serif] font-bold text-foreground text-sm leading-snug mt-1 group-hover:text-accent transition-colors line-clamp-3">
          {article.title}
        </h4>
        <p className="font-mono text-muted-foreground text-[9px] tracking-wider mt-1">{article.timeAgo}</p>
      </div>
    </article>
  );
}

function ArticleCardHorizontal({ article, onClick }: { article: Article; onClick: () => void }) {
  return (
    <article
      className="cursor-pointer group transform-gpu flex gap-4 border-b border-border py-5 last:border-0 transition-[transform,background-color] duration-300 ease-out hover:-translate-y-0.5 hover:bg-secondary/20 active:scale-[0.99] motion-reduce:transition-none"
      onClick={onClick}
    >
      <div className="shrink-0 w-32 h-24 overflow-hidden">
        <img
          src={article.image}
          alt={article.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex-1 min-w-0">
        <CategoryBadge category={article.category} small />
        <h4 className="font-['Playfair_Display',serif] font-bold text-foreground text-sm leading-snug mt-1.5 group-hover:text-accent transition-colors line-clamp-2">
          {article.title}
        </h4>
        <div className="flex items-center gap-2 mt-2 text-foreground/65 font-mono text-[10px] tracking-wider uppercase">
          <span>{article.author}</span>
          <span>·</span>
          <span>{article.readTime}</span>
        </div>
      </div>
    </article>
  );
}

function SectionHeader({ title, color, onViewAll }: { title: string; color?: string; onViewAll?: () => void }) {
  return (
    <div className="relative mb-5">
      <div
        className="absolute bottom-0 left-0 right-0 border-b-2"
        style={{ borderColor: color || "#374151" }}
      />
      <div className="flex items-center justify-between pb-3">
        <span
          className="font-mono text-[11px] tracking-[0.18em] uppercase font-medium"
          style={{ color: color || "#374151" }}
        >
          {title}
        </span>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Section</span>
            <ArrowRight size={9} />
          </button>
        )}
      </div>
    </div>
  );
}

// --- Search overlay ---
function SearchResultCard({ article, query, onClick }: {
  article: Article; query: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex gap-4 p-3 rounded hover:bg-secondary/50 transition-colors group"
    >
      <div className="shrink-0 w-20 h-[56px] overflow-hidden bg-muted">
        <img src={article.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <CategoryBadge category={article.category} small />
          <span className="font-mono text-[8px] text-muted-foreground">{article.timeAgo} · {article.readTime}</span>
        </div>
        <h4 className="font-['Playfair_Display',serif] font-bold text-[13px] text-foreground leading-snug line-clamp-2 group-hover:text-accent transition-colors">
          {highlightText(article.title, query)}
        </h4>
        <p className="font-['Inter',sans-serif] font-medium text-foreground/70 text-[12px] leading-relaxed mt-0.5 line-clamp-1">
          {highlightText(article.subtitle, query)}
        </p>
        <p className="font-mono text-[8px] text-muted-foreground mt-1">{article.author}</p>
      </div>
    </button>
  );
}

const POPULAR_TOPICS = [
  "South Africa", "Ramaphosa", "Eskom", "Elections", "ANC", "Load Shedding",
  "AI", "Bitcoin", "Gold", "Rugby", "Springboks", "Economy", "Cape Town",
  "Johannesburg", "Climate", "Technology",
];

function SearchOverlay({ isOpen, onClose, navigate }: {
  isOpen: boolean; onClose: () => void; navigate: (p: Page) => void;
}) {
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("all");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset and focus when opened
  useEffect(() => {
    if (isOpen) {
      setQuery(""); setCatFilter(null); setAuthorFilter(null); setDateFilter("all");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const { results, loading: searchLoading } = useSearch(query);
  const hasQuery = query.trim().length > 0;
  const categories = Object.keys(CATEGORY_META).sort();
  const { articles: trendingArticles } = usePosts({ per_page: 6, orderby: "date" }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center" role="dialog" aria-modal aria-label="Search">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl mx-4 mt-16 bg-background shadow-2xl flex flex-col max-h-[80vh] border border-border">

        {/* ── Search input row ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search news, topics, authors, or keywords..."
            className="flex-1 bg-transparent text-foreground text-base font-['Inter',sans-serif] outline-none placeholder:text-muted-foreground/55"
            aria-label="Search"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground transition-colors p-1" aria-label="Clear">
              <X size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            className="shrink-0 border border-border px-2.5 py-1 font-mono text-[8px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            ESC
          </button>
        </div>

        {/* ── Filters ── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border overflow-x-auto no-scrollbar bg-secondary/20">
          {/* Category chips */}
          <button
            onClick={() => setCatFilter(null)}
            className={`shrink-0 px-2.5 py-1 font-mono text-[8px] tracking-widest uppercase border transition-colors ${!catFilter ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/50"}`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat === catFilter ? null : cat)}
              className={`shrink-0 px-2.5 py-1 font-mono text-[8px] tracking-widest uppercase border transition-colors ${catFilter === cat ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/50"}`}
            >
              {cat}
            </button>
          ))}

          <div className="shrink-0 h-3 w-px bg-border mx-1" />

          {/* Date */}
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="shrink-0 bg-background border border-border px-2 py-1 font-mono text-[8px] tracking-wider text-muted-foreground outline-none cursor-pointer hover:border-foreground/50 transition-colors"
          >
            <option value="all">Any date</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>

          {/* Author filter omitted — authors fetched from WP per-query */}
        </div>

        {/* ── Scrollable results area ── */}
        <div className="flex-1 overflow-y-auto">
          {!hasQuery ? (
            /* Default state: trending + popular topics */
            <div className="p-5">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                Trending Now
              </p>
              <div className="divide-y divide-border">
                {trendingArticles.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => { onClose(); navigate({ type: "article", id: a.id }); }}
                    className="w-full text-left flex items-center gap-3 py-3 hover:bg-secondary/40 transition-colors group px-2 -mx-2 rounded"
                  >
                    <span className="font-['Playfair_Display',serif] font-black text-foreground/12 text-xl w-7 shrink-0 leading-none">
                      {i + 1}
                    </span>
                    <CategoryBadge category={a.category} small />
                    <span className="font-['Playfair_Display',serif] font-bold text-sm text-foreground group-hover:text-accent transition-colors line-clamp-1 flex-1">
                      {a.title}
                    </span>
                    <span className="font-mono text-[8px] text-muted-foreground shrink-0">{a.timeAgo}</span>
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                  Popular Topics
                </p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_TOPICS.map(topic => (
                    <button
                      key={topic}
                      onClick={() => setQuery(topic)}
                      className="border border-border px-3 py-1.5 font-mono text-[9px] tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          ) : results.length === 0 ? (
            /* No results */
            <div className="p-8 text-center">
              <div className="w-12 h-12 border-2 border-dashed border-border rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={20} className="text-muted-foreground/40" />
              </div>
              <p className="font-['Playfair_Display',serif] font-bold text-xl text-foreground mb-2">
                No articles matched your search.
              </p>
              <p className="font-['Inter',sans-serif] text-muted-foreground text-sm mb-6">
                Try another keyword or browse a category.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {["South Africa", "Politics", "Business", "Technology", "Sports", "Science", "Economy"].map(t => (
                  <button
                    key={t}
                    onClick={() => setQuery(t)}
                    className="border border-border px-3 py-1.5 font-mono text-[9px] tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="mt-8 text-left border-t border-border pt-6">
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                  Suggested Reading
                </p>
                <div className="space-y-1">
                  {trendingArticles.slice(0, 3).map(a => (
                    <SearchResultCard
                      key={a.id}
                      article={a}
                      query=""
                      onClick={() => { onClose(); navigate({ type: "article", id: a.id }); }}
                    />
                  ))}
                </div>
              </div>
            </div>

          ) : (
            /* Results list */
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">
                  <span className="text-foreground font-medium">{results.length}</span> article{results.length !== 1 ? "s" : ""} for{" "}
                  <span className="text-accent">&ldquo;{query}&rdquo;</span>
                </p>
                {(catFilter || authorFilter) && (
                  <button
                    onClick={() => { setCatFilter(null); setAuthorFilter(null); }}
                    className="font-mono text-[8px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <X size={10} /> Clear filters
                  </button>
                )}
              </div>
              <div className="divide-y divide-border">
                {results.map(article => (
                  <SearchResultCard
                    key={article.id}
                    article={article}
                    query={query}
                    onClick={() => { onClose(); navigate({ type: "article", id: article.id }); }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-border px-4 py-2 flex items-center justify-between bg-secondary/10">
          <p className="font-mono text-[8px] text-muted-foreground tracking-wider">
            {searchLoading ? "Searching…" : `${results.length} result${results.length !== 1 ? "s" : ""}`}
          </p>
          <div className="flex items-center gap-3 font-mono text-[8px] text-muted-foreground">
            <span>↵ open article</span>
            <span>esc close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Preloader ---
function Preloader({ visible }: { visible: boolean }) {
  return (
    <div
      className="fixed inset-0 z-[500] flex flex-col items-center justify-center bg-[#0f1f3d] pointer-events-none"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.7s ease",
        visibility: visible ? "visible" : "hidden",
      }}
    >
      <div style={{ animation: visible ? "preloader-pulse 1.6s ease-in-out infinite" : "none" }}>
        <img src={logoImg} alt="News South Africa" className="w-20 h-20 object-cover" />
      </div>
      <p
        className="font-['Playfair_Display',serif] font-black text-white text-base tracking-[0.25em] uppercase mt-5"
        style={{ opacity: 0.85 }}
      >
        News South Africa
      </p>
      <p className="font-mono text-[9px] text-white/40 tracking-[0.18em] uppercase mt-1.5">
        Independent Digital News
      </p>
      <style>{`
        @keyframes preloader-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.06); opacity: 0.75; }
        }
      `}</style>
    </div>
  );
}

// --- Auth types ---
type AuthUser = AccountUser & { name: string };

// --- Account modal ---
function LoginModal({ onClose, onLogin, initialMode = "login" }: {
  onClose: () => void;
  onLogin: (user: AuthUser) => void;
  initialMode?: "login" | "register";
}) {
  const [mode, setMode] = useState<"login" | "register" | "2fa">(initialMode);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState("");
  const [otpAuthUri, setOtpAuthUri] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "2fa") {
      if (!/^\d{6}$/.test(token)) { setError("Enter the 6-digit code from your authenticator app."); return; }
      setLoading(true);
      try {
        const result = await verifyTwoFactor(challenge, token);
        const user = result.user;
        onLogin({ ...user, name: `${user.firstName} ${user.lastName}`.trim() });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verification failed.");
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!email.trim() || !password) { setError("Please enter your email and password."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Please enter a valid email address."); return; }
    if (password.length < 12) { setError("Password must be at least 12 characters."); return; }
    if (mode === "register" && (!firstName.trim() || !lastName.trim())) { setError("Please enter your first and last name."); return; }
    setLoading(true);
    try {
      const result = mode === "register"
        ? await register(firstName, lastName, email, password)
        : await login(email, password);
      setChallenge(result.challenge);
      setOtpAuthUri(result.otpAuthUri ?? "");
      setMode("2fa");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white shadow-2xl overflow-hidden">
        {/* Accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-accent via-orange-400 to-accent" />

        <div className="p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-1">
                {mode === "register" ? "Join NewsSA" : mode === "2fa" ? "Secure verification" : "Welcome back"}
              </p>
              <h2 className="font-['Playfair_Display',serif] font-black text-3xl text-foreground leading-none">
                {mode === "register" ? "Create Account" : mode === "2fa" ? "Verify your identity" : "Sign In"}
              </h2>
            </div>
            <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors mt-1">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" className="w-full border border-border bg-transparent px-4 py-3 font-['Inter',sans-serif] text-sm text-foreground outline-none focus:border-foreground transition-colors" />
                <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" className="w-full border border-border bg-transparent px-4 py-3 font-['Inter',sans-serif] text-sm text-foreground outline-none focus:border-foreground transition-colors" />
              </div>
            )}
            {mode === "2fa" ? (
              <>
                <p className="font-['Inter',sans-serif] text-sm text-muted-foreground leading-relaxed">
                  Enter the 6-digit code from your authenticator app to {otpAuthUri ? "finish setting up your account" : "complete sign in"}.
                </p>
                {otpAuthUri && <code className="block break-all bg-secondary px-3 py-2 font-mono text-[9px] text-foreground">{otpAuthUri}</code>}
                <input value={token} onChange={e => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoFocus placeholder="000000" className="w-full border border-border bg-transparent px-4 py-3 font-mono text-lg tracking-[0.4em] text-foreground text-center outline-none focus:border-foreground transition-colors" />
              </>
            ) : (
              <>
            <div>
              <label className="font-mono text-[9px] tracking-widest uppercase text-foreground/60 block mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                className="w-full border border-border bg-transparent px-4 py-3 font-['Inter',sans-serif] text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground transition-colors"
              />
            </div>

            <div>
              <label className="font-mono text-[9px] tracking-widest uppercase text-foreground/60 block mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-border bg-transparent px-4 py-3 font-['Inter',sans-serif] text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground transition-colors"
              />
            </div>

            <div className="flex items-center justify-between">
              <span />
              <button type="button" className="font-['Inter',sans-serif] text-sm text-accent hover:underline transition-colors">Forgot password?</button>
            </div>
              </>
            )}

            {error && (
              <p className="font-['Inter',sans-serif] text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-foreground text-white py-3.5 font-mono text-[10px] tracking-widest uppercase hover:bg-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in…
                </>
              ) : mode === "register" ? "Create Account" : mode === "2fa" ? "Verify code" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            {mode !== "2fa" && <p className="font-['Inter',sans-serif] text-sm text-muted-foreground">
              {mode === "login" ? "Not a member yet?" : "Already have an account?"}{" "}
              <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="text-accent hover:underline font-medium">
                {mode === "login" ? "Create an account" : "Sign in"}
              </button>
            </p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Navigation ---
function Navbar({
  navigate,
  user,
  onLoginClick,
  onRegisterClick,
  onLogout,
}: {
  navigate: (p: Page) => void;
  user: AuthUser | null;
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onLogout: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Ensure autoplay starts
  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  // Crossfade loop
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    let raf: number;
    function tick() {
      if (!vid || isNaN(vid.duration)) { raf = requestAnimationFrame(tick); return; }
      const remaining = vid.duration - vid.currentTime;
      vid.style.opacity = remaining < 1 ? String(Math.max(0, remaining)) : "1";
      raf = requestAnimationFrame(tick);
    }
    function onEnded() {
      if (!vid) return;
      vid.currentTime = 0;
      vid.play().catch(() => {});
    }
    raf = requestAnimationFrame(tick);
    vid.addEventListener("ended", onEnded);
    return () => { cancelAnimationFrame(raf); vid.removeEventListener("ended", onEnded); };
  }, []);

  return (
    <>
      {/* Search overlay — rendered at root level so it's above everything */}
      <SearchOverlay
        isOpen={searchOverlayOpen}
        onClose={() => setSearchOverlayOpen(false)}
        navigate={navigate}
      />

      <header
        className={`sticky top-0 z-50 transition-shadow ${scrolled ? "shadow-xl shadow-black/40" : ""}`}
      >
        <div className="relative overflow-hidden">

          {/* VIDEO — layer 0 */}
          <video
            ref={videoRef}
            src={navVideo}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ zIndex: 0, willChange: "transform", transform: "translateZ(0)" }}
          />

          {/* OVERLAY — layer 1, subtle dark tint */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 1, background: "linear-gradient(180deg, rgba(5,10,20,0.52) 0%, rgba(10,20,40,0.45) 100%)" }}
          />

          {/* CONTENT — layer 2 */}
          <div className="relative" style={{ zIndex: 2 }}>

            {/* Top bar */}
            <div className="border-b border-white/10">
              {/* Three-column: [left spacer] [centered logo] [right controls] */}
              <div className="max-w-7xl mx-auto px-4 lg:px-8 flex items-center h-16">

                {/* Left — desktop only spacer that matches right side width */}
                <div className="hidden md:flex flex-1 items-center" />

                {/* Center — logo lockup, always centered */}
                <button
                  onClick={() => navigate({ type: "home" })}
                  className="flex items-center gap-4 shrink-0 mx-auto md:mx-0"
                >
                  <img src={logoImg} alt="News SA" className="w-11 h-11 object-cover" />
                  <div className="flex flex-col">
                    <p
                      className="font-['Playfair_Display',serif] text-white font-black tracking-wide leading-none"
                      style={{ fontSize: "15px", textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}
                    >
                      NEWS SOUTH AFRICA
                    </p>
                    <p
                      className="font-mono text-white/55 tracking-[0.18em] uppercase"
                      style={{ fontSize: "8px", marginTop: "5px" }}
                    >
                      Independent Digital News
                    </p>
                  </div>
                </button>

                <div className="flex-1" />

                {/* Right — desktop actions */}
                <div className="hidden md:flex items-center gap-2">
                  {/* Search button */}
                  <button
                    onClick={() => setSearchOverlayOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 border border-white/20 text-white/70 hover:text-white hover:border-white/50 transition-colors group"
                    aria-label="Open search"
                  >
                    <Search size={14} />
                    <span className="font-mono text-[8px] tracking-widest uppercase">Search</span>
                    <kbd className="hidden lg:inline font-mono text-[7px] text-white/30 border border-white/15 px-1 py-0.5 group-hover:border-white/30 transition-colors">
                      /
                    </kbd>
                  </button>

                  {user ? (
                    /* Logged-in: avatar chip + dropdown + visible sign-out */
                    <div className="flex items-center gap-2">
                      <div className="relative" ref={userMenuRef}>
                        <button
                          onClick={() => setUserMenuOpen(v => !v)}
                          className="flex items-center gap-2 pl-1 pr-3 py-1 border border-white/25 hover:border-white/50 transition-colors group"
                          aria-label="Account menu"
                        >
                          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white font-bold text-[11px]">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-mono text-[8px] tracking-widest uppercase text-white/80 group-hover:text-white transition-colors max-w-[80px] truncate">
                            {user.name.split(" ")[0]}
                          </span>
                          <ChevronDown size={10} className={`text-white/50 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
                        </button>

                        {userMenuOpen && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-white shadow-xl border border-border z-[100]">
                            <div className="px-4 py-3 border-b border-border">
                              <p className="font-['Inter',sans-serif] text-xs font-semibold text-foreground truncate">{user.name}</p>
                              <p className="font-mono text-[8px] text-muted-foreground truncate mt-0.5">{user.email}</p>
                            </div>
                            <button className="w-full text-left px-4 py-2.5 font-mono text-[8px] tracking-widest uppercase text-foreground/70 hover:bg-secondary hover:text-foreground transition-colors flex items-center gap-2">
                              <User size={11} /> My Profile
                            </button>
                            <button className="w-full text-left px-4 py-2.5 font-mono text-[8px] tracking-widest uppercase text-foreground/70 hover:bg-secondary hover:text-foreground transition-colors flex items-center gap-2">
                              <Bookmark size={11} /> Saved Articles
                            </button>
                            <div className="border-t border-border">
                              <button
                                onClick={() => { onLogout(); setUserMenuOpen(false); }}
                                className="w-full text-left px-4 py-2.5 font-mono text-[8px] tracking-widest uppercase text-red-500 hover:bg-red-50 transition-colors"
                              >
                                Sign Out
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Always-visible log out button */}
                      <button
                        onClick={onLogout}
                        className="border border-white/20 px-4 py-2 font-mono text-[9px] tracking-[0.1em] uppercase text-white/70 hover:text-white hover:border-white/50 transition-colors"
                        title="Log out"
                      >
                        Log Out
                      </button>
                    </div>
                  ) : (
                    /* Logged-out: sign in + subscribe */
                    <>
                      <button
                        onClick={onLoginClick}
                        className="border border-white/25 px-5 py-2 font-mono text-[9px] tracking-[0.1em] uppercase text-white/85 hover:text-white hover:border-white/55 transition-colors"
                      >
                        Sign In
                      </button>
                      <button
                        onClick={onRegisterClick}
                        className="border border-white/25 px-5 py-2 font-mono text-[9px] tracking-[0.1em] uppercase text-white/85 hover:text-white hover:border-white/55 transition-colors"
                      >
                        Sign Up
                      </button>
                      <button className="bg-accent px-4 py-2 font-mono text-[9px] tracking-[0.1em] uppercase text-white hover:bg-orange-500 transition-colors">
                        Subscribe
                      </button>
                    </>
                  )}
                </div>

                {/* Mobile: search + (avatar or login) + hamburger */}
                <div className="flex md:hidden items-center gap-1">
                  <button
                    onClick={() => setSearchOverlayOpen(true)}
                    className="p-2 text-white/70 hover:text-white transition-colors"
                    aria-label="Search"
                  >
                    <Search size={18} />
                  </button>
                  {user ? (
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold text-[12px] mx-1">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <button
                      onClick={onLoginClick}
                      className="p-2 text-white/70 hover:text-white transition-colors"
                      aria-label="Sign In"
                    >
                      <User size={18} />
                    </button>
                  )}
                  <button
                    className="p-2 text-white"
                    onClick={() => setMobileOpen(v => !v)}
                    aria-label="Menu"
                  >
                    {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Category nav */}
            <div className="hidden md:block border-t border-white/10">
              <div className="max-w-7xl mx-auto px-4 lg:px-8">
                <nav className="flex items-center overflow-x-auto no-scrollbar">
                  {NAV_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() =>
                        cat === "News"
                          ? navigate({ type: "home" })
                          : navigate({ type: "category", name: cat })
                      }
                      className="relative shrink-0 px-5 py-3.5 font-['Inter',sans-serif] font-semibold text-[11px] tracking-[0.08em] uppercase text-white/75 hover:text-white transition-colors group"
                    >
                      {cat}
                      <span className="absolute bottom-0 left-5 w-0 h-[2px] bg-accent group-hover:w-6 transition-all duration-200" />
                    </button>
                  ))}
                  <div className="flex-1" />
                  <button className="shrink-0 flex items-center gap-1.5 px-5 py-3.5 font-['Inter',sans-serif] font-semibold text-[11px] tracking-[0.08em] uppercase text-white/75 hover:text-white transition-colors">
                    More <ChevronDown size={11} />
                  </button>
                </nav>
              </div>
            </div>

          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-[rgba(8,14,28,0.97)] border-b border-white/10">
            <nav className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
              {ALL_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    setMobileOpen(false);
                    if (cat === "Home") navigate({ type: "home" });
                    else if (cat === "Finance") navigate({ type: "finance" });
                    else navigate({ type: "category", name: cat });
                  }}
                  className="text-left py-3 font-['Inter',sans-serif] font-semibold text-[11px] tracking-[0.06em] uppercase text-white/75 hover:text-accent transition-colors border-b border-white/8"
                >
                  {cat}
                </button>
              ))}
              <div className="flex gap-3 pt-4">
                {user ? (
                  <button
                    onClick={() => { onLogout(); setMobileOpen(false); }}
                    className="flex-1 border border-white/25 py-2 font-mono text-[9px] tracking-widest uppercase text-white/70 hover:text-white transition-colors"
                  >
                    Sign Out
                  </button>
                ) : (
                  <>
                    <button onClick={() => { onLoginClick(); setMobileOpen(false); }} className="flex-1 border border-white/25 py-2 font-mono text-[9px] tracking-widest uppercase text-white/70 hover:text-white transition-colors">Sign In</button>
                    <button onClick={() => { onRegisterClick(); setMobileOpen(false); }} className="flex-1 border border-white/25 py-2 font-mono text-[9px] tracking-widest uppercase text-white/70 hover:text-white transition-colors">Sign Up</button>
                  </>
                )}
                <button className="flex-1 bg-accent py-2 font-mono text-[9px] tracking-widest uppercase text-white hover:bg-orange-500 transition-colors">
                  Subscribe
                </button>
              </div>
          </nav>
        </div>
      )}
    </header>
    </>
  );
}

// --- Footer ---
function Footer({ navigate }: { navigate: (p: Page) => void }) {
  const [email, setEmail] = useState("");
  const [newsletterError, setNewsletterError] = useState("");
  const [newsletterLoading, setNewsletterLoading] = useState(false);

  async function handleNewsletterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNewsletterError("");
    setNewsletterLoading(true);
    try {
      await subscribeNewsletter(email);
      setEmail("");
    } catch (err) {
      setNewsletterError(err instanceof Error ? err.message : "Unable to subscribe.");
    } finally {
      setNewsletterLoading(false);
    }
  }

  return (
    <footer className="bg-[#0f1f3d] text-white">
      {/* Newsletter */}
      <div className="border-b border-white/10 py-16">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <h3 className="font-['Playfair_Display',serif] text-2xl font-bold mb-2">
              Stay informed, stay ahead.
            </h3>
            <p className="font-['Inter',sans-serif] text-white/60 text-sm">
              Join 340,000 readers who receive our curated daily briefing.
            </p>
          </div>
          <form
            className="flex w-full md:w-auto gap-0"
            onSubmit={handleNewsletterSubmit}
          >
            <input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-white/10 border border-white/20 px-4 py-3 text-sm font-['Inter',sans-serif] text-white placeholder:text-white/40 outline-none focus:border-accent w-72"
            />
            <button
              type="submit"
              disabled={newsletterLoading}
              className="bg-accent px-6 py-3 font-mono text-[9px] tracking-widest uppercase hover:bg-orange-600 transition-colors shrink-0"
            >
              {newsletterLoading ? "Subscribing..." : "Subscribe"}
            </button>
          </form>
          {newsletterError && <p className="font-['Inter',sans-serif] text-xs text-red-200 mt-2">{newsletterError}</p>}
        </div>
      </div>

      {/* Links */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/40 mb-4">Categories</p>
          {["Politics", "Business", "Technology", "Sports", "Science", "Entertainment", "Opinion", "Finance", "Africa"].map(cat => (
            <button
              key={cat}
              onClick={() => navigate({ type: "category", name: cat })}
              className="block font-['Inter',sans-serif] text-sm text-white/60 hover:text-white transition-colors mb-2"
            >
              {cat}
            </button>
          ))}
        </div>
        <div>
          <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/40 mb-4">Company</p>
          {["About Us", "Editorial Policy", "Our Team", "Advertise", "Careers", "Contact Us"].map(item => (
            <button key={item} className="block font-['Inter',sans-serif] text-sm text-white/60 hover:text-white transition-colors mb-2">
              {item}
            </button>
          ))}
        </div>
        <div>
          <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/40 mb-4">Legal</p>
          {["Privacy Policy", "Terms of Service", "Cookie Policy", "POPIA Compliance"].map(item => (
            <button key={item} className="block font-['Inter',sans-serif] text-sm text-white/60 hover:text-white transition-colors mb-2">
              {item}
            </button>
          ))}
        </div>
        <div>
          <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/40 mb-4">Follow Us</p>
          <div className="flex gap-4 mb-6">
            {[
              { icon: Twitter, label: "Twitter" },
              { icon: Facebook, label: "Facebook" },
              { icon: Instagram, label: "Instagram" },
              { icon: Linkedin, label: "LinkedIn" },
              { icon: Youtube, label: "YouTube" },
            ].map(({ icon: Icon, label }) => (
              <button key={label} aria-label={label} className="text-white/40 hover:text-white transition-colors">
                <Icon size={18} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 mb-2">
            <img src={logoImg} alt="News SA" className="w-8 h-8 object-cover" />
            <div>
              <p className="font-['Playfair_Display',serif] text-white text-xs font-black">NEWS SOUTH AFRICA</p>
              <p className="font-mono text-[8px] text-white/40 tracking-widest uppercase">Independent Digital News</p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-mono text-[9px] text-white/40 tracking-widest uppercase">
            © 2026 News South Africa. All rights reserved.
          </p>
          <p className="font-mono text-[9px] text-white/30">
            Registered in the Republic of South Africa
          </p>
        </div>
      </div>
    </footer>
  );
}

// --- Newsletter inline ---
function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await subscribeNewsletter(email);
      setSubmitted(true);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to subscribe.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-[#0f1f3d] px-8 py-10 my-8">
      {submitted ? (
        <p className="font-['Playfair_Display',serif] text-white text-xl text-center">
          Thank you for subscribing.
        </p>
      ) : (
        <>
          <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/40 mb-2">Newsletter</p>
          <h3 className="font-['Playfair_Display',serif] text-white text-2xl font-bold mb-1">
            The Daily Brief
          </h3>
          <p className="font-['Inter',sans-serif] text-white/60 text-sm mb-6">
            South Africa's essential morning read. Stories that matter, analysis that goes deeper.
          </p>
          <form
            className="flex flex-col gap-2"
            onSubmit={handleSubmit}
          >
            <input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full min-w-0 bg-white/10 border border-white/20 px-4 py-2.5 text-sm font-['Inter',sans-serif] text-white placeholder:text-white/40 outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent px-5 py-2.5 font-mono text-[9px] tracking-widest uppercase hover:bg-orange-600 transition-colors"
            >
              {loading ? "Subscribing..." : "Subscribe"}
            </button>
          </form>
          {error && <p className="font-['Inter',sans-serif] text-xs text-red-200 mt-2">{error}</p>}
        </>
      )}
    </div>
  );
}

// --- Scroll to top ---
function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);
  if (!visible) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-8 right-8 bg-primary text-primary-foreground p-3 shadow-lg hover:bg-accent transition-colors z-40"
      aria-label="Scroll to top"
    >
      <ArrowUp size={18} />
    </button>
  );
}

// ============================================================
// HOME PAGE
// ============================================================
function HomePage({ navigate }: { navigate: (p: Page) => void }) {
  const { featured: hero, secondary, loading, error } = useFeaturedPosts(20);
  const heroSidebar = secondary.slice(0, 3);
  const featuredTwo = secondary.slice(3, 5);
  const latestGrid = secondary.slice(5, 9);
  const latestList = secondary.slice(9, 13);
  const politicsFeature = secondary[13] ?? null;
  const trending = secondary.slice(0, 6);
  const mostRead = secondary.slice(4, 10);
  // WordPress not connected
  if (!import.meta.env.VITE_WORDPRESS_API) return <NotConfiguredState />;
  if (error) return <ErrorState title="Could not load articles" message={error} />;

  if (loading || !hero) {
    return (
      <main>
        <section className="max-w-7xl mx-auto px-4 lg:px-8 pt-8 pb-4">
          <HeroSkeleton />
        </section>
        <section className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }, (_, i) => <ArticleCardSkeleton key={i} />)}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      {/* Hero section */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pt-8 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] border border-border">
          {/* Main hero */}
          <div
            className="relative cursor-pointer group overflow-hidden min-h-[480px]"
            onClick={() => navigate({ type: "article", id: hero.id })}
          >
            <img src={hero.image} alt={hero.title} className="w-full h-full object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 p-8 md:p-10">
              <div className="bg-[rgba(30,58,138,0.08)] inline-block mb-3">
                <span className="font-mono text-[#1e3a8a] text-[10px] tracking-widest uppercase px-2 py-1">
                  {hero.category}
                </span>
              </div>
              <h1 className="font-['Playfair_Display',serif] font-black text-white text-2xl md:text-4xl leading-tight max-w-2xl">
                {hero.title}
              </h1>
              <div className="flex items-center gap-4 mt-4 font-mono text-[9px] text-white/60 tracking-widest uppercase">
                <span>{hero.author}</span>
                <span>·</span>
                <span>{hero.timeAgo}</span>
                <span>·</span>
                <span>{hero.readTime}</span>
              </div>
            </div>
          </div>
          {/* Sidebar */}
          <div className="border-l border-border flex flex-col">
            <div className="flex flex-col justify-center p-7">
              <p className="font-['Inter',sans-serif] text-sm text-foreground/80 leading-relaxed">
                From Johannesburg to Nairobi, a new generation of leaders is rewriting the rules of democratic governance — with consequences that will be felt for decades.
              </p>
              <button
                onClick={() => navigate({ type: "article", id: hero.id })}
                className="flex items-center gap-2 mt-5 font-mono text-[9px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                Read Full Story <ArrowRight size={9} />
              </button>
            </div>
            <div className="border-t border-border">
              <div className="px-7 py-3 bg-secondary/30">
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
                  Also in Politics
                </p>
              </div>
              {heroSidebar.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => navigate({ type: "article", id: a.id })}
                  className="w-full text-left flex gap-4 items-start px-7 py-5 border-t border-border hover:bg-secondary/20 transition-colors"
                >
                  <span className="font-['Playfair_Display',serif] font-black text-foreground/10 text-lg shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-['Playfair_Display',serif] font-bold text-foreground text-sm leading-snug">
                      {a.title}
                    </p>
                    <p className="font-mono text-[9px] text-muted-foreground mt-1">{a.timeAgo}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Two featured articles */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 border border-t-0 border-border">
          {featuredTwo.map((article, i) => (
            <div
              key={article.id}
              className={`cursor-pointer group ${i === 0 ? "md:border-r border-border" : ""}`}
              onClick={() => navigate({ type: "article", id: article.id })}
            >
              <div className="overflow-hidden h-[280px]">
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-7">
                <CategoryBadge category={article.category} small />
                <h2 className="font-['Playfair_Display',serif] font-bold text-foreground text-xl leading-snug mt-2 group-hover:text-accent transition-colors">
                  {article.title}
                </h2>
                <p className="font-['Inter',sans-serif] text-muted-foreground text-sm mt-2 line-clamp-2">
                  {article.subtitle}
                </p>
                <div className="flex items-center justify-between mt-5 pt-5 border-t border-border">
                  <span className="font-mono text-[9px] text-muted-foreground">{article.author}</span>
                  <span className="font-mono text-[9px] text-muted-foreground">{article.timeAgo} · {article.readTime}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Latest News */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
        <SectionHeader
          title="Latest News"
          onViewAll={() => navigate({ type: "category", name: "News" })}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {latestGrid.map(article => (
            <div
              key={article.id}
              className="cursor-pointer group"
              onClick={() => navigate({ type: "article", id: article.id })}
            >
              <div className="overflow-hidden h-[180px] mb-3">
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <CategoryBadge category={article.category} small />
              <h3 className="font-['Playfair_Display',serif] font-bold text-foreground text-sm leading-snug mt-2 group-hover:text-accent transition-colors">
                {article.title}
              </h3>
              <p className="font-mono text-[9px] text-muted-foreground mt-2">{article.author} · {article.timeAgo}</p>
            </div>
          ))}
        </div>

        {/* List below grid */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 border-t border-border pt-4">
          {latestList.map(article => (
            <ArticleCardSmall
              key={article.id}
              article={article}
              onClick={() => navigate({ type: "article", id: article.id })}
            />
          ))}
        </div>
      </section>

      {/* Politics + Business sections */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Politics */}
          <div>
            <SectionHeader
              title="Politics"
              color="#1e3a8a"
              onViewAll={() => navigate({ type: "category", name: "Politics" })}
            />
            <div className="grid grid-cols-[1fr_180px] gap-6 items-start">
              <div
                className="cursor-pointer group"
                onClick={() => navigate({ type: "article", id: politicsFeature.id })}
              >
                <div className="overflow-hidden h-[200px] mb-3">
                  <img
                    src={politicsFeature.image}
                    alt={politicsFeature.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <CategoryBadge category="Politics" small />
                <h3 className="font-['Playfair_Display',serif] font-black text-foreground text-lg leading-snug mt-2 group-hover:text-accent transition-colors">
                  {politicsFeature.title}
                </h3>
                <div className="flex items-center gap-2 mt-2 font-mono text-[9px] text-muted-foreground">
                  <span>{politicsFeature.author}</span>
                  <span>·</span>
                  <span>{politicsFeature.timeAgo}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {secondary.slice(14, 17).map(a => (
                  <button
                    key={a.id}
                    onClick={() => navigate({ type: "article", id: a.id })}
                    className="text-left border-b border-border pb-4 mb-1 hover:text-accent transition-colors"
                  >
                    <CategoryBadge category={a.category} small />
                    <p className="font-['Playfair_Display',serif] font-bold text-foreground text-sm leading-snug mt-1.5 hover:text-accent transition-colors">
                      {a.title}
                    </p>
                    <p className="font-mono text-[9px] text-muted-foreground mt-1">{a.author} · {a.timeAgo}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Business */}
          <div>
            <SectionHeader
              title="Business"
              color="#065f46"
              onViewAll={() => navigate({ type: "category", name: "Business" })}
            />
            <div className="grid grid-cols-[1fr_180px] gap-6 items-start">
              {secondary[17] && (
              <div
                className="cursor-pointer group"
                onClick={() => navigate({ type: "article", id: secondary[17].id })}
              >
                <div className="overflow-hidden h-[200px] mb-3">
                  <img
                    src={secondary[17].image}
                    alt={secondary[17].title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <CategoryBadge category={secondary[17].category} small />
                <h3 className="font-['Playfair_Display',serif] font-black text-foreground text-lg leading-snug mt-2 group-hover:text-accent transition-colors">
                  {secondary[17].title}
                </h3>
                <div className="flex items-center gap-2 mt-2 font-mono text-[9px] text-muted-foreground">
                  <span>{secondary[17].author}</span>
                  <span>·</span>
                  <span>{secondary[17].timeAgo}</span>
                </div>
              </div>
              )}
              <div className="flex flex-col gap-1">
                {secondary.slice(18, 20).map(a => (
                  <button
                    key={a.id}
                    onClick={() => navigate({ type: "article", id: a.id })}
                    className="text-left border-b border-border pb-4 mb-1"
                  >
                    <CategoryBadge category={a.category} small />
                    <p className="font-['Playfair_Display',serif] font-bold text-foreground text-sm leading-snug mt-1.5 hover:text-accent transition-colors">
                      {a.title}
                    </p>
                    <p className="font-mono text-[9px] text-muted-foreground mt-1">{a.author} · {a.timeAgo}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending + Most Read */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-8 border-t border-border">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12">
          <div>
            <SectionHeader title="Trending Stories" color="#ea580c" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
              {trending.slice(0, 6).map((a, i) => (
                <ArticleCardSmall
                  key={a.id}
                  article={a}
                  onClick={() => navigate({ type: "article", id: a.id })}
                  index={i}
                />
              ))}
            </div>
          </div>
          <div>
            <SectionHeader title="Most Read" />
            {mostRead.map((a, i) => (
              <ArticleCardSmall
                key={a.id}
                article={a}
                onClick={() => navigate({ type: "article", id: a.id })}
                index={i}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Finance snapshot */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-8 border-t border-border">
        <div className="flex items-center justify-between mb-5">
          <SectionHeader title="Markets" color="#065f46" />
          <button
            onClick={() => navigate({ type: "finance" })}
            className="font-mono text-[9px] tracking-widest uppercase text-accent hover:text-foreground transition-colors flex items-center gap-1 mb-5"
          >
            Full Markets <ArrowRight size={9} />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {MARKET_DATA.slice(0, 6).map(m => {
            const sparkData = makeSparkData(m.positive);
            return (
              <div
                key={m.name}
                className="border border-border p-3 hover:border-foreground/20 transition-colors cursor-pointer"
                onClick={() => navigate({ type: "finance" })}
              >
                <p className="font-mono text-[9px] text-muted-foreground tracking-wider uppercase">{m.name}</p>
                <p className="font-['Playfair_Display',serif] font-bold text-foreground text-sm mt-1">{m.value}</p>
                <div className="flex items-center gap-1 mt-1">
                  {m.positive ? (
                    <TrendingUp size={10} className="text-green-600" />
                  ) : (
                    <TrendingDown size={10} className="text-red-500" />
                  )}
                  <span className={`font-mono text-[9px] ${m.positive ? "text-green-600" : "text-red-500"}`}>
                    {m.change}
                  </span>
                </div>
                <div className="h-8 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparkData}>
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={m.positive ? "#16a34a" : "#ef4444"}
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Newsletter */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <NewsletterSection />
      </div>
    </main>
  );
}

// ============================================================
// ARTICLE PAGE
// ============================================================
function ArticlePage({ id, navigate, user }: { id: number; navigate: (p: Page) => void; user: AuthUser | null }) {
  const { article, loading, error } = usePost(id);
  const guestKey = "newssa_guest_saved_articles";
  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(localStorage.getItem(guestKey) ?? "[]").includes(id); } catch { return false; }
  });
  const { articles: related } = usePosts(
    article ? { categories: [], per_page: 3, orderby: "date" } : {},
    [article?.id]
  );
  const { articles: trending } = usePosts({ per_page: 5, orderby: "date" }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  useEffect(() => {
    if (!user) return;
    getSavedArticles().then(result => setSaved(result.articles.some(item => item.articleId === id))).catch(() => setSaved(false));
  }, [id, user]);

  async function toggleSaved() {
    if (user) {
      try {
        if (saved) await unsaveArticle(id);
        else await saveArticle(id);
        setSaved(!saved);
      } catch { return; }
      return;
    }
    try {
      const ids = JSON.parse(localStorage.getItem(guestKey) ?? "[]") as number[];
      const next = saved ? ids.filter(articleId => articleId !== id) : [...new Set([...ids, id])];
      localStorage.setItem(guestKey, JSON.stringify(next));
      setSaved(!saved);
    } catch { return; }
  }

  const shareArticle = (platform: "twitter" | "facebook" | "linkedin" | "email") => {
    if (!article) return;
    const url = window.location.href;
    const title = article.title;
    const destinations = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
    };
    if (platform === "email") {
      window.location.assign(destinations.email);
      return;
    }
    window.open(destinations[platform], "_blank", "noopener,noreferrer,width=640,height=640");
  };

  if (!import.meta.env.VITE_WORDPRESS_API) return <NotConfiguredState />;
  if (loading) return (
    <main className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        {Array.from({ length: 6 }, (_, i) => <ArticleCardSkeleton key={i} />)}
      </div>
    </main>
  );
  if (error || !article) return <ErrorState title="Article not found" message={error ?? undefined} onRetry={() => window.location.reload()} />;

  const prevArticle: { id: number; title: string } | null = null as { id: number; title: string } | null;
  const nextArticle: { id: number; title: string } | null = null as { id: number; title: string } | null;

  return (
    <main className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12">
        {/* Main content */}
        <article>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-6">
            <button onClick={() => navigate({ type: "home" })} className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">
              Home
            </button>
            <span className="text-border font-mono text-xs">/</span>
            <button
              onClick={() => navigate({ type: "category", name: article.category })}
              className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
            >
              {article.category}
            </button>
          </div>

          {/* Category + headline */}
          <CategoryBadge category={article.category} />
          <h1 className="font-['Playfair_Display',serif] font-black text-foreground text-3xl md:text-4xl leading-tight mt-4">
            {article.title}
          </h1>
              <p className="font-['Inter',sans-serif] font-medium text-foreground/75 text-lg mt-4 leading-8">
            {article.subtitle}
          </p>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 py-5 border-y border-border mt-5">
            <div>
              <p className="font-mono text-[9px] tracking-widest uppercase text-foreground">{article.author}</p>
            </div>
            <span className="text-border">·</span>
            <div className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
              <Clock size={10} />
              <span>{article.date}</span>
            </div>
            <span className="text-border">·</span>
            <span className="font-mono text-[10px] text-foreground/70 tracking-widest">{article.readTime}</span>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              {[
                { icon: Twitter, label: "Share on Twitter" },
                { icon: Facebook, label: "Share on Facebook" },
                { icon: Linkedin, label: "Share on LinkedIn" },
                { icon: Mail, label: "Share via email" },
              ].map(({ icon: Icon, label }, index) => (
                <button
                  key={label}
                  aria-label={label}
                  onClick={() => shareArticle((["twitter", "facebook", "linkedin", "email"] as const)[index])}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon size={16} />
                </button>
              ))}
              <button aria-label={saved ? "Remove saved article" : "Save article"} onClick={toggleSaved} className={`transition-colors ${saved ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}>
                <Bookmark size={16} />
              </button>
            </div>
          </div>

          {/* Hero image */}
          <div className="mt-8 mb-8 overflow-hidden">
            <img src={article.image} alt={article.title} className="w-full h-[400px] object-cover" />
            <p className="font-mono text-[8px] text-muted-foreground/60 mt-2 tracking-wider">
              Image: News South Africa / Associated Press
            </p>
          </div>

          {/* Body */}
          <div className="prose-custom max-w-none">
            {article.body.map((para, i) => (
              <div key={i}>
                {article.pullQuote && i === Math.floor(article.body.length / 2) && (
                  <blockquote className="border-l-4 border-accent pl-6 my-8">
                    <p className="font-['Playfair_Display',serif] text-xl text-foreground leading-relaxed italic">
                      {article.pullQuote}
                    </p>
                  </blockquote>
                )}
                <p className="font-['Inter',sans-serif] font-medium text-foreground/90 text-base leading-8 mb-5">
                  {para}
                </p>
              </div>
            ))}
          </div>

          {/* Share footer */}
          <div className="mt-10 pt-6 border-t border-border">
            <p className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground mb-3">Share this article</p>
            <div className="flex gap-3">
              {[
                { icon: Twitter, label: "Twitter", bg: "bg-sky-500" },
                { icon: Facebook, label: "Facebook", bg: "bg-blue-600" },
                { icon: Linkedin, label: "LinkedIn", bg: "bg-blue-700" },
                { icon: Mail, label: "Email", bg: "bg-secondary" },
              ].map(({ icon: Icon, label, bg }, index) => (
                <button
                  key={label}
                  onClick={() => shareArticle((["twitter", "facebook", "linkedin", "email"] as const)[index])}
                  className={`${bg} text-white px-4 py-2 flex items-center gap-2 font-mono text-[9px] tracking-widest uppercase hover:opacity-90 transition-opacity`}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Prev / next */}
          <div className="mt-10 grid grid-cols-2 gap-4 border-t border-border pt-6">
            {prevArticle && (
              <button
                onClick={() => navigate({ type: "article", id: prevArticle.id })}
                className="text-left border border-border p-4 hover:border-foreground/30 transition-colors group"
              >
                <div className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground tracking-widest uppercase mb-2">
                  <ChevronLeft size={10} /> Previous
                </div>
                <p className="font-['Playfair_Display',serif] font-bold text-sm text-foreground group-hover:text-accent transition-colors line-clamp-2">
                  {prevArticle.title}
                </p>
              </button>
            )}
            {!prevArticle && <div />}
            {nextArticle && (
              <button
                onClick={() => navigate({ type: "article", id: nextArticle.id })}
                className="text-right border border-border p-4 hover:border-foreground/30 transition-colors group"
              >
                <div className="flex items-center justify-end gap-1 font-mono text-[9px] text-muted-foreground tracking-widest uppercase mb-2">
                  Next <ChevronRight size={10} />
                </div>
                <p className="font-['Playfair_Display',serif] font-bold text-sm text-foreground group-hover:text-accent transition-colors line-clamp-2">
                  {nextArticle.title}
                </p>
              </button>
            )}
            {!nextArticle && <div />}
          </div>

          {/* Comment section placeholder */}
          <div className="mt-10 border-t border-border pt-8">
            <div className="flex items-center gap-2 mb-6">
              <MessageSquare size={16} className="text-muted-foreground" />
              <h3 className="font-mono text-[11px] tracking-widest uppercase text-foreground">Comments</h3>
            </div>
            <div className="bg-secondary/30 border border-border p-6 text-center">
              <p className="font-['Inter',sans-serif] text-muted-foreground text-sm">
                Sign in to join the conversation.
              </p>
              <button className="mt-3 bg-primary text-primary-foreground px-6 py-2 font-mono text-[9px] tracking-widest uppercase hover:bg-accent transition-colors">
                Sign In
              </button>
            </div>
          </div>
        </article>

        {/* Sidebar */}
        <aside>
          {/* Newsletter */}
          <NewsletterSection />

          {/* Related articles */}
          {related.length > 0 && (
            <div className="mt-0">
              <SectionHeader title={`More in ${article.category}`} color={getCategoryMeta(article.category).textColor} />
              {related.map(a => (
                <ArticleCardHorizontal
                  key={a.id}
                  article={a}
                  onClick={() => navigate({ type: "article", id: a.id })}
                />
              ))}
            </div>
          )}

          {/* Trending */}
          <div className="mt-8">
            <SectionHeader title="Trending Now" color="#ea580c" />
            {trending.slice(0, 5).map((a, i) => (
              <ArticleCardSmall
                key={a.id}
                article={a}
                onClick={() => navigate({ type: "article", id: a.id })}
                index={i}
              />
            ))}
          </div>

        </aside>
      </div>
    </main>
  );
}

// ============================================================
// CATEGORY PAGE
// ============================================================
function CategoryPage({ name, navigate }: { name: string; navigate: (p: Page) => void }) {
  const [page, setPage] = useState(1);
  const perPage = 7;
  const { category, articles, loading, error, total, totalPages } = useCategory(name, page, perPage);
  const { articles: sidebarArticles } = usePosts({ per_page: 5, orderby: "date" }, []);

  const featured = articles[0] ?? null;
  const grid = articles.slice(1);
  const sidebar = sidebarArticles;
  const displayName = category?.name ?? name;
  const meta = getCategoryMeta(displayName);

  useEffect(() => { window.scrollTo(0, 0); setPage(1); }, [name]);

  if (!import.meta.env.VITE_WORDPRESS_API) return <NotConfiguredState />;
  if (error) return <ErrorState title={`Could not load ${displayName}`} message={error} />;
  if (loading) return (
    <main>
      <div className="border-b border-border py-10 max-w-7xl mx-auto px-4 lg:px-8">
        <div className="h-16 bg-muted animate-pulse w-48 mb-2" />
        <div className="h-4 bg-muted animate-pulse w-32" />
      </div>
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }, (_, i) => <ArticleCardSkeleton key={i} />)}
        </div>
      </div>
    </main>
  );
  if (!loading && articles.length === 0) return (
    <main>
      <div className="border-b border-border py-10 max-w-7xl mx-auto px-4 lg:px-8">
        <h1 className="font-['Playfair_Display',serif] font-black text-5xl md:text-7xl" style={{ color: meta.textColor }}>{displayName}</h1>
      </div>
      <EmptyState title="No articles in this category yet" message="Check back soon — content is published from WordPress." />
    </main>
  );

  return (
    <main>
      {/* Category hero */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <div className="flex items-end gap-4">
            <div>
              <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">Category</span>
              <h1
                className="font-['Playfair_Display',serif] font-black text-5xl md:text-7xl leading-none mt-1"
                style={{ color: meta.textColor }}
              >
                {displayName}
              </h1>
            </div>
            <div className="hidden md:block flex-1 border-b-2 mb-2" style={{ borderColor: meta.textColor }} />
          </div>
          <p className="font-['Inter',sans-serif] text-muted-foreground text-base mt-4 max-w-2xl">
            {total} article{total !== 1 ? "s" : ""} · Updated {featured?.timeAgo ?? ""}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12">
          <div>
            {/* Featured */}
            {featured && (
              <div className="mb-10">
                <SectionHeader title="Featured" color={meta.textColor} />
                <div
                  className="cursor-pointer group border border-border overflow-hidden"
                  onClick={() => navigate({ type: "article", id: featured.id })}
                >
                  <div className="overflow-hidden h-[320px]">
                    <img
                      src={featured.image}
                      alt={featured.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-6">
                    <CategoryBadge category={featured.category} small />
                    <h2 className="font-['Playfair_Display',serif] font-black text-foreground text-2xl leading-snug mt-2 group-hover:text-accent transition-colors">
                      {featured.title}
                    </h2>
                    <p className="font-['Inter',sans-serif] text-muted-foreground text-sm mt-2">{featured.subtitle}</p>
                    <div className="flex items-center gap-3 mt-4 font-mono text-[9px] text-muted-foreground">
                      <span>{featured.author}</span>
                      <span>·</span>
                      <span>{featured.timeAgo}</span>
                      <span>·</span>
                      <span>{featured.readTime}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Latest */}
            <SectionHeader title="Latest Articles" color={meta.textColor} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {grid.map(article => (
                <ArticleCardMedium
                  key={article.id}
                  article={article}
                  onClick={() => navigate({ type: "article", id: article.id })}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2 mt-10 pt-6 border-t border-border">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border border-border px-4 py-2 font-mono text-[9px] tracking-widest uppercase disabled:opacity-30 hover:bg-secondary transition-colors"
                >
                  <ChevronLeft size={12} />
                </button>
                {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 font-mono text-[10px] transition-colors ${p === page ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="border border-border px-4 py-2 font-mono text-[9px] tracking-widest uppercase disabled:opacity-30 hover:bg-secondary transition-colors"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside>
            <SectionHeader title="Popular Stories" />
            {sidebar.map((a, i) => (
              <ArticleCardSmall
                key={a.id}
                article={a}
                onClick={() => navigate({ type: "article", id: a.id })}
                index={i}
              />
            ))}
            <NewsletterSection />
          </aside>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// FINANCE PAGE
// ============================================================
function FinancePage({ navigate }: { navigate: (p: Page) => void }) {
  const [activeTab, setActiveTab] = useState<"all" | "indices" | "crypto" | "commodities" | "currencies">("all");
  const { articles: financeArticles } = usePosts({ per_page: 13, orderby: "date" }, []);

  const filtered = activeTab === "all"
    ? MARKET_DATA
    : MARKET_DATA.filter(m => {
        if (activeTab === "indices") return m.category === "Index";
        if (activeTab === "crypto") return m.category === "Crypto";
        if (activeTab === "commodities") return m.category === "Commodity";
        if (activeTab === "currencies") return m.category === "Currency";
        return true;
      });

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <main>
      {/* Hero */}
      <div className="bg-[#0f1f3d] text-white">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12">
          <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/40">Section</span>
          <h1 className="font-['Playfair_Display',serif] font-black text-5xl md:text-7xl leading-none mt-1 text-[#d4af37]">
            Finance
          </h1>
          <p className="font-['Inter',sans-serif] text-white/60 mt-3 text-sm">
            Live markets, economic analysis, and business intelligence — updated continuously.
          </p>
          <p className="font-mono text-[8px] text-white/30 mt-2 tracking-widest uppercase">
            All data is illustrative mock data for demonstration purposes
          </p>
        </div>
      </div>

      {/* Market overview */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <SectionHeader title="Market Overview" color="#065f46" />
          <div className="flex gap-2 mb-5">
            {(["all", "indices", "crypto", "commodities", "currencies"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`font-mono text-[9px] tracking-widest uppercase px-3 py-1.5 transition-colors ${
                  activeTab === tab ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"
                }`}
              >
                {tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(m => {
            const sparkData = makeSparkData(m.positive);
            return (
              <div
                key={m.name}
                className="border border-border p-4 hover:border-foreground/30 transition-all hover:shadow-sm cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-mono text-[8px] text-muted-foreground tracking-wider uppercase">{m.category}</p>
                  <div className="flex items-center gap-1">
                    {m.positive ? (
                      <TrendingUp size={10} className="text-green-600" />
                    ) : (
                      <TrendingDown size={10} className="text-red-500" />
                    )}
                    <span className={`font-mono text-[9px] font-medium ${m.positive ? "text-green-600" : "text-red-500"}`}>
                      {m.change}
                    </span>
                  </div>
                </div>
                <p className="font-mono text-[9px] text-foreground font-medium">{m.name}</p>
                <p className="font-['Playfair_Display',serif] font-bold text-foreground text-xl mt-1">{m.value}</p>
                <div className="h-12 mt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparkData}>
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={m.positive ? "#16a34a" : "#ef4444"}
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Finance news sections */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-8 border-t border-border">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12">
          <div>
            <SectionHeader title="Business News" color="#065f46" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              {financeArticles.slice(0, 4).map(a => (
                <ArticleCardMedium
                  key={a.id}
                  article={a}
                  onClick={() => navigate({ type: "article", id: a.id })}
                />
              ))}
            </div>

            <SectionHeader title="Economic Analysis" color="#065f46" />
            {financeArticles.slice(4, 8).map(a => (
              <ArticleCardHorizontal
                key={a.id}
                article={a}
                onClick={() => navigate({ type: "article", id: a.id })}
              />
            ))}

            <div className="mt-10">
              <SectionHeader title="Investment Insights" color="#065f46" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {financeArticles.slice(8, 11).map(a => (
                  <div
                    key={a.id}
                    className="cursor-pointer group"
                    onClick={() => navigate({ type: "article", id: a.id })}
                  >
                    <div className="overflow-hidden h-36 mb-3">
                      <img src={a.image} alt={a.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    </div>
                    <CategoryBadge category={a.category} small />
                    <h4 className="font-['Playfair_Display',serif] font-bold text-sm text-foreground mt-2 leading-snug group-hover:text-accent transition-colors">
                      {a.title}
                    </h4>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside>
            <div className="border border-border p-6 mb-8">
              <h3 className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-4">Trending Stocks</h3>
              {[
                { ticker: "NPN", name: "Naspers", price: "R3,420.00", change: "+2.4%", positive: true },
                { ticker: "SOL", name: "Sasol", price: "R189.50", change: "-1.1%", positive: false },
                { ticker: "MTN", name: "MTN Group", price: "R147.30", change: "+0.8%", positive: true },
                { ticker: "SBK", name: "Standard Bank", price: "R234.10", change: "+1.3%", positive: true },
                { ticker: "BHP", name: "BHP Group", price: "R521.40", change: "-0.5%", positive: false },
              ].map(stock => (
                <div key={stock.ticker} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                  <div className="w-10 h-10 bg-secondary flex items-center justify-center shrink-0">
                    <span className="font-mono text-[9px] font-medium text-foreground">{stock.ticker}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-['Inter',sans-serif] text-foreground text-xs font-medium">{stock.name}</p>
                    <p className="font-mono text-[9px] text-muted-foreground">{stock.price}</p>
                  </div>
                  <span className={`font-mono text-[10px] font-medium ${stock.positive ? "text-green-600" : "text-red-500"}`}>
                    {stock.change}
                  </span>
                </div>
              ))}
            </div>

            <SectionHeader title="Company News" />
            {financeArticles.slice(0, 5).map(a => (
              <ArticleCardSmall
                key={a.id}
                article={a}
                onClick={() => navigate({ type: "article", id: a.id })}
              />
            ))}
          </aside>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <NewsletterSection />
      </div>
    </main>
  );
}

// ============================================================
// SEARCH PAGE
// ============================================================
function SearchPage({ query, navigate }: { query: string; navigate: (p: Page) => void }) {
  const [searchInput, setSearchInput] = useState(query);
  const { results, loading: searchLoading, total } = useSearch(query);
  const { articles: trendingSidebar } = usePosts({ per_page: 5, orderby: "date" }, []);

  useEffect(() => { window.scrollTo(0, 0); setSearchInput(query); }, [query]);

  return (
    <main className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
      <div className="max-w-2xl mb-10">
        <h1 className="font-['Playfair_Display',serif] font-black text-3xl text-foreground mb-6">
          Search Results
        </h1>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (searchInput.trim()) navigate({ type: "search", query: searchInput.trim() });
          }}
          className="flex gap-0 border border-border"
        >
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search articles, topics, authors..."
            className="flex-1 bg-transparent px-4 py-3 font-['Inter',sans-serif] text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button
            type="submit"
            className="bg-primary text-primary-foreground px-5 py-3 hover:bg-accent transition-colors"
          >
            <Search size={16} />
          </button>
        </form>
        <p className="font-mono text-[9px] text-muted-foreground tracking-widest uppercase mt-4">
          {searchLoading ? "Searching…" : `${total} result${total !== 1 ? "s" : ""} for "${query}"`}
        </p>
      </div>

      {searchLoading ? (
        <div className="grid grid-cols-1 gap-4 max-w-2xl">
          {Array.from({ length: 4 }, (_, i) => <ArticleCardHorizontalSkeleton key={i} />)}
        </div>
      ) : results.length === 0 ? (
        <EmptyState title="No results found" message={`Nothing matched "${query}". Try a different keyword or browse our categories.`} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12">
          <div>
            {results.map(article => (
              <div
                key={article.id}
                className="cursor-pointer group flex gap-5 border-b border-border py-6 last:border-0"
                onClick={() => navigate({ type: "article", id: article.id })}
              >
                <div className="shrink-0 w-32 h-24 overflow-hidden hidden md:block">
                  <img
                    src={article.image}
                    alt={article.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <CategoryBadge category={article.category} small />
                  <h3 className="font-['Playfair_Display',serif] font-bold text-foreground text-lg leading-snug mt-2 group-hover:text-accent transition-colors">
                    {article.title}
                  </h3>
                  <p className="font-['Inter',sans-serif] text-muted-foreground text-sm mt-1 line-clamp-2">
                    {article.subtitle}
                  </p>
                  <div className="flex items-center gap-3 mt-3 font-mono text-[9px] text-muted-foreground">
                    <span>{article.author}</span>
                    <span>·</span>
                    <span>{article.timeAgo}</span>
                    <span>·</span>
                    <span>{article.readTime}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside>
            <SectionHeader title="Browse Categories" />
            <div className="flex flex-wrap gap-2 mb-8">
              {Object.keys(CATEGORY_META).map(cat => (
                <button
                  key={cat}
                  onClick={() => navigate({ type: "category", name: cat })}
                  className="border border-border px-3 py-1.5 font-mono text-[9px] tracking-widest uppercase hover:bg-secondary transition-colors"
                >
                  {cat}
                </button>
              ))}
            </div>
            <SectionHeader title="Trending Now" color="#ea580c" />
            {trendingSidebar.map((a, i) => (
              <ArticleCardSmall
                key={a.id}
                article={a}
                onClick={() => navigate({ type: "article", id: a.id })}
                index={i}
              />
            ))}
          </aside>
        </div>
      )}
    </main>
  );
}

// ============================================================
// CONTACT PAGE
// ============================================================
function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  return (
    <main className="max-w-7xl mx-auto px-4 lg:px-8 py-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        <div>
          <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">Get in touch</span>
          <h1 className="font-['Playfair_Display',serif] font-black text-5xl text-foreground mt-2 mb-4">Contact Us</h1>
          <p className="font-['Inter',sans-serif] text-muted-foreground text-base leading-relaxed mb-8">
            We welcome tips, corrections, story ideas, and general feedback from our readers. Our editorial team reads every message.
          </p>
          <div className="space-y-6">
            {[
              { label: "Editorial", email: "editorial@newssa.co.za", desc: "Story tips, corrections, and editorial feedback" },
              { label: "Advertising", email: "advertising@newssa.co.za", desc: "Commercial and advertising enquiries" },
              { label: "Press", email: "press@newssa.co.za", desc: "Media relations and interview requests" },
            ].map(item => (
              <div key={item.label} className="border-l-2 border-accent pl-5">
                <p className="font-mono text-[9px] tracking-widest uppercase text-accent mb-1">{item.label}</p>
                <p className="font-['Inter',sans-serif] text-foreground font-medium">{item.email}</p>
                <p className="font-['Inter',sans-serif] text-muted-foreground text-sm mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          {sent ? (
            <div className="bg-[#0f1f3d] p-10 text-center">
              <p className="font-['Playfair_Display',serif] text-white text-2xl font-bold mb-2">Message received.</p>
              <p className="font-['Inter',sans-serif] text-white/60 text-sm">We aim to respond within 2 business days.</p>
            </div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={e => { e.preventDefault(); setSent(true); }}
            >
              {[
                { key: "name", label: "Full name", type: "text", placeholder: "Your full name" },
                { key: "email", label: "Email address", type: "email", placeholder: "you@example.com" },
                { key: "subject", label: "Subject", type: "text", placeholder: "What is your message about?" },
              ].map(f => (
                <div key={f.key}>
                  <label className="font-mono text-[9px] tracking-widest uppercase text-foreground/60 block mb-1.5">
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={(form as Record<string, string>)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full border border-border bg-transparent px-4 py-2.5 font-['Inter',sans-serif] text-sm text-foreground outline-none focus:border-foreground transition-colors"
                  />
                </div>
              ))}
              <div>
                <label className="font-mono text-[9px] tracking-widest uppercase text-foreground/60 block mb-1.5">
                  Message
                </label>
                <textarea
                  rows={6}
                  placeholder="Your message..."
                  value={form.message}
                  onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full border border-border bg-transparent px-4 py-2.5 font-['Inter',sans-serif] text-sm text-foreground outline-none focus:border-foreground transition-colors resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-primary-foreground py-3 font-mono text-[10px] tracking-widest uppercase hover:bg-accent transition-colors"
              >
                Send Message
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

// ============================================================
// APP
// ============================================================
function pageFromPath(pathname: string): Page {
  if (pathname === "/finance" || pathname === "/category/finance") return { type: "finance" };

  const categoryMatch = pathname.match(/^\/category\/([^/]+)\/?$/);
  if (categoryMatch) {
    const slug = decodeURIComponent(categoryMatch[1]);
    const knownNames: Record<string, string> = {
      "leadership-and-ideas": "Leadership & Ideas",
    };
    return { type: "category", name: knownNames[slug] ?? slug };
  }

  const articleMatch = pathname.match(/^\/article\/(\d+)\/?$/);
  if (articleMatch) return { type: "article", id: Number(articleMatch[1]) };
  if (pathname === "/") return { type: "home" };
  return { type: "home" };
}

function pagePath(page: Page): string {
  if (page.type === "home") return "/";
  if (page.type === "category") {
    const slug = page.name.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and");
    return `/category/${slug}`;
  }
  if (page.type === "article") return `/article/${page.id}`;
  if (page.type === "finance") return "/finance";
  if (page.type === "search") return `/?search=${encodeURIComponent(page.query)}`;
  return "/";
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>(() => pageFromPath(window.location.pathname));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [preloading, setPreloading] = useState(true);

  useEffect(() => {
    const tid = setTimeout(() => setPreloading(false), 1600);
    return () => clearTimeout(tid);
  }, []);

  useEffect(() => {
    getCurrentUser().then(result => {
      const account = result.user;
      setUser({ ...account, name: `${account.firstName} ${account.lastName}`.trim() });
    }).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const handlePopState = () => setCurrentPage(pageFromPath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(page: Page) {
    setCurrentPage(page);
    window.history.pushState(null, "", pagePath(page));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleLogin(u: AuthUser) {
    setUser(u);
    setLoginOpen(false);
  }

  async function handleLogout() {
    await logout().catch(() => {});
    setUser(null);
  }

  function renderPage() {
    switch (currentPage.type) {
      case "home":
        return <HomePage navigate={navigate} />;
      case "category":
        if (currentPage.name === "Finance") return <FinancePage navigate={navigate} />;
        if (currentPage.name === "Contact") return <ContactPage />;
        return <CategoryPage name={currentPage.name} navigate={navigate} />;
      case "article":
        return <ArticlePage id={currentPage.id} navigate={navigate} user={user} />;
      case "finance":
        return <FinancePage navigate={navigate} />;
      case "search":
        return <SearchPage query={currentPage.query} navigate={navigate} />;
      default:
        return <HomePage navigate={navigate} />;
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Preloader visible={preloading} />
      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onLogin={handleLogin}
          initialMode={authMode}
        />
      )}
      <Navbar
        navigate={navigate}
        user={user}
        onLoginClick={() => { setAuthMode("login"); setLoginOpen(true); }}
        onRegisterClick={() => { setAuthMode("register"); setLoginOpen(true); }}
        onLogout={handleLogout}
      />
      <div className="flex-1">{renderPage()}</div>
      <Footer navigate={navigate} />
      <ScrollToTop />
    </div>
  );
}
