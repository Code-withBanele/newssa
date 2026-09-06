import { useState, useEffect, useRef } from "react";
import {
  Search, Menu, X, ChevronDown, ArrowRight,
  Clock, Facebook, Twitter, Linkedin, Mail, ArrowUp, Bookmark,
  MessageSquare, ChevronLeft, ChevronRight, Instagram, Youtube, User, Settings
} from "lucide-react";
import { Article, transformPost } from "../utils/transform";
import { fetchPost } from "../api/posts";
import { usePosts } from "../hooks/usePosts";
import { usePost } from "../hooks/usePost";
import { useCategory } from "../hooks/useCategory";
import { useFeaturedPosts } from "../hooks/useFeaturedPosts";
import { useSearch } from "../hooks/useSearch";
import { SeoHead } from "./SeoHead";
import {
  AccountUser, getCurrentUser, getSavedArticles, login, logout, register,
  requestPasswordReset, resetPassword, resendVerification, saveArticle, unsaveArticle, verifyTwoFactor,
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
  | { type: "search"; query: string }
  | { type: "saved" }
  | { type: "about" }
  | { type: "privacy" }
  | { type: "cookies" };

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

// --- Nav categories ---
const NAV_CATEGORIES = [
  "News", "Technology", "Politics", "Business",
  "Sports", "Science", "Motoring", "Entertainment", "Opinion",
];
const ALL_CATEGORIES = [
  "Home", "Politics", "Business", "Economy", "Africa", "World",
  "Technology", "Sports", "Science", "Entertainment", "Opinion", "Leadership & Ideas", "Contact",
];
const MORE_CATEGORIES = ALL_CATEGORIES.filter(cat => cat !== "Home" && !NAV_CATEGORIES.includes(cat));

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
          <h2 className="font-['Playfair_Display',serif] font-black text-white text-[30px] leading-tight mt-3 max-w-2xl">
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
      <h3 className="font-['Playfair_Display',serif] font-bold text-foreground text-[30px] leading-snug mt-2 group-hover:text-accent transition-colors">
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
        <h4 className="font-['Playfair_Display',serif] font-bold text-foreground text-[30px] leading-snug mt-1 group-hover:text-accent transition-colors line-clamp-3">
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
        <h4 className="font-['Playfair_Display',serif] font-bold text-foreground text-[30px] leading-snug mt-1.5 group-hover:text-accent transition-colors line-clamp-2">
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
        <h4 className="font-['Playfair_Display',serif] font-bold text-[30px] text-foreground leading-snug line-clamp-2 group-hover:text-accent transition-colors">
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

type LatestRead = {
  id: number;
  title: string;
  readAt: string;
};

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local.slice(0, 1)}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
}

// --- Account modal ---
function LoginModal({ onClose, onLogin, initialMode = "login" }: {
  onClose: () => void;
  onLogin: (user: AuthUser) => void;
  initialMode?: "login" | "register";
}) {
  const [mode, setMode] = useState<"login" | "register" | "2fa" | "forgot" | "reset">(initialMode);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState("");
  const [otpAuthUri, setOtpAuthUri] = useState("");
  const [token, setToken] = useState("");
  const [verificationPurpose, setVerificationPurpose] = useState<"registration" | "login">("login");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "success">("idle");
  const [resendError, setResendError] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (mode !== "2fa") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (mode === "2fa") {
      if (!/^\d{6}$/.test(token)) { setError("Enter the 6-digit verification code sent to your email."); return; }
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
    if (mode === "reset") {
      if (!/^\d{6}$/.test(token)) { setError("Enter the 6-digit verification code."); return; }
      if (password.length < 12) { setError("Password must be at least 12 characters."); return; }
      setLoading(true);
      try {
        await resetPassword(challenge, token, password);
        setMode("login");
        setPassword("");
        setToken("");
        setMessage("Your password has been reset. You can now sign in.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to reset password.");
      } finally { setLoading(false); }
      return;
    }
    if (mode === "forgot") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Please enter a valid email address."); return; }
      setLoading(true);
      try {
        const result = await requestPasswordReset(email);
        if (!result.challenge) { setMessage(result.message ?? "If an account exists for that email, a verification code has been sent."); return; }
        setChallenge(result.challenge);
        setToken("");
        setMode("reset");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to process the password reset request.");
      } finally { setLoading(false); }
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
      setVerificationPurpose(mode === "register" ? "registration" : "login");
      setToken("");
      setResendStatus("idle");
      setResendError("");
      setResendAvailableAt(Date.now() + 60000);
      setMode("2fa");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendStatus === "sending" || resendAvailableAt > now) return;
    setResendStatus("sending");
    setResendError("");
    try {
      const result = await resendVerification(challenge);
      setChallenge(result.challenge);
      setResendStatus("success");
      setResendAvailableAt(Date.now() + 60000);
    } catch (err) {
      setResendStatus("idle");
      setResendError(err instanceof Error ? err.message : "We couldn't send a new verification code. Please try again.");
    }
  }

  const resendSeconds = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

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
                {mode === "register" ? "Join NewsSA" : mode === "2fa" || mode === "reset" ? "Secure verification" : mode === "forgot" ? "Account recovery" : "Welcome back"}
              </p>
              <h2 className="font-['Playfair_Display',serif] font-black text-3xl text-foreground leading-none">
                {mode === "register" ? "Create Account" : mode === "2fa" ? "Verify your email" : mode === "forgot" ? "Forgot password" : mode === "reset" ? "Set new password" : "Sign In"}
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
                  Enter the 6-digit verification code sent to <strong className="text-foreground">{maskEmail(email)}</strong> to {verificationPurpose === "registration" ? "finish setting up your account" : "complete your sign in"}.
                </p>
                <input value={token} onChange={e => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoFocus placeholder="000000" className="w-full border border-border bg-transparent px-4 py-3 font-mono text-lg tracking-[0.4em] text-foreground text-center outline-none focus:border-foreground transition-colors" />
                <div className="space-y-2">
                  <button type="button" onClick={handleResend} disabled={resendStatus === "sending" || resendSeconds > 0} className="text-accent font-['Inter',sans-serif] text-sm hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed">
                    {resendStatus === "sending" ? "Sending..." : resendSeconds > 0 ? `Resend OTP in ${resendSeconds}s` : "Resend OTP"}
                  </button>
                  {resendStatus === "success" && <p role="status" className="font-['Inter',sans-serif] text-sm text-green-700">A new verification code has been sent.</p>}
                  {resendError && <p role="alert" className="font-['Inter',sans-serif] text-sm text-red-600">{resendError}</p>}
                  <p className="font-['Inter',sans-serif] text-xs text-muted-foreground">If you still don't receive it, check your spam folder and confirm the address is correct.</p>
                </div>
              </>
            ) : mode === "forgot" ? (
              <>
                <p className="font-['Inter',sans-serif] text-sm text-muted-foreground leading-relaxed">Enter your email address and we will send a verification code if an account is associated with it.</p>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus className="w-full border border-border bg-transparent px-4 py-3 font-['Inter',sans-serif] text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground transition-colors" />
              </>
            ) : mode === "reset" ? (
              <>
                <p className="font-['Inter',sans-serif] text-sm text-muted-foreground leading-relaxed">Enter the 6-digit code sent to <strong className="text-foreground">{maskEmail(email)}</strong>, then choose a new password.</p>
                <input value={token} onChange={e => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoFocus placeholder="000000" className="w-full border border-border bg-transparent px-4 py-3 font-mono text-lg tracking-[0.4em] text-foreground text-center outline-none focus:border-foreground transition-colors" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password (12+ characters)" className="w-full border border-border bg-transparent px-4 py-3 font-['Inter',sans-serif] text-sm text-foreground outline-none focus:border-foreground transition-colors" />
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
              {mode === "login" && <button type="button" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }} className="font-['Inter',sans-serif] text-sm text-accent hover:underline transition-colors">Forgot password?</button>}
            </div>
              </>
            )}

            {message && <p role="status" className="font-['Inter',sans-serif] text-sm text-green-700 bg-green-50 border border-green-100 px-4 py-2.5">{message}</p>}
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
                  {mode === "2fa" ? "Verifying…" : mode === "reset" ? "Resetting…" : mode === "forgot" ? "Sending code…" : "Sending code…"}
                </>
              ) : mode === "register" ? "Create Account" : mode === "2fa" ? "Verify code" : mode === "forgot" ? "Send reset code" : mode === "reset" ? "Reset password" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            {mode === "login" && <p className="font-['Inter',sans-serif] text-sm text-muted-foreground">
              {mode === "login" ? "Not a member yet?" : "Already have an account?"}{" "}
              <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="text-accent hover:underline font-medium">
                {mode === "login" ? "Create an account" : "Sign in"}
              </button>
            </p>}
            {mode === "forgot" || mode === "reset" ? <button type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }} className="mt-4 font-['Inter',sans-serif] text-sm text-accent hover:underline">Back to sign in</button> : null}
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [latestReads, setLatestReads] = useState<LatestRead[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || (!userMenuOpen && !mobileOpen)) return;
    try {
      const stored = JSON.parse(localStorage.getItem(`newssa_latest_reads_${user.id}`) ?? "[]");
      setLatestReads(Array.isArray(stored) ? stored : []);
    } catch {
      setLatestReads([]);
    }
  }, [user, userMenuOpen, mobileOpen]);

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
            <div className="relative border-b border-white/10">
              <span aria-hidden="true" className="absolute inset-0 border border-white/15 bg-black/25 shadow-lg shadow-black/20 backdrop-blur-[2px]" />
              {/* Three-column: [left spacer] [centered logo] [right controls] */}
              <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 flex items-center min-h-20 lg:h-24">

                {/* Left — desktop only spacer that matches right side width */}
                <div className="hidden lg:flex flex-1 items-center" />

                {/* Center — logo lockup, always centered */}
                <button
                  onClick={() => navigate({ type: "home" })}
                  className="relative flex items-center gap-2 lg:gap-3 xl:gap-4 shrink-0 mx-auto px-2 lg:px-3 py-2 max-w-full"
                >
                  <img src={logoImg} alt="News SA" className="w-16 h-16 lg:w-[84px] lg:h-[84px] xl:w-[100px] xl:h-[100px] object-cover shrink-0" />
                  <div className="flex flex-col">
                    <p
                      className="font-['Playfair_Display',serif] text-white font-black tracking-wide leading-none text-[19px] lg:text-[24px] xl:text-[30px] whitespace-nowrap"
                      style={{ textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}
                    >
                      NEWS SOUTH AFRICA
                    </p>
                    <p
                      className="font-mono text-white/55 tracking-[0.12em] lg:tracking-[0.15em] xl:tracking-[0.18em] uppercase text-[8px] lg:text-[11px] xl:text-[16px] mt-1 xl:mt-[5px]"
                    >
                      Independent Digital News
                    </p>
                  </div>
                </button>

                <div className="flex-1" />

                {/* Right — desktop actions */}
                <div className="hidden lg:flex items-center gap-1 xl:gap-2">
                  {/* Search button */}
                  <button
                    onClick={() => setSearchOverlayOpen(true)}
                    className="flex w-40 xl:w-56 items-center gap-2 px-2 xl:px-3 py-2 border border-white/20 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/50 transition-all group"
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
                          className="flex items-center gap-1 xl:gap-2 pl-1 xl:pl-2 pr-2 xl:pr-3 py-1.5 border border-white/25 hover:bg-white/10 hover:border-white/50 transition-all group"
                          aria-label="Open user settings"
                        >
                          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white">
                            <User size={14} />
                          </div>
                          <span className="font-mono text-[8px] tracking-widest uppercase text-white/80 group-hover:text-white transition-colors max-w-[80px] truncate">
                            {user.name.split(" ")[0]}
                          </span>
                          <ChevronDown size={10} className={`text-white/50 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
                        </button>

                        {userMenuOpen && (
                          <div className="absolute right-0 top-full mt-1 w-72 bg-white shadow-xl border border-border z-[100]">
                            <div className="px-4 py-3 border-b border-border">
                              <div className="flex items-center gap-2 mb-2">
                                <Settings size={13} className="text-accent" />
                                <p className="font-mono text-[9px] tracking-widest uppercase font-bold text-foreground">User settings</p>
                              </div>
                              <p className="font-['Inter',sans-serif] text-xs font-bold text-foreground truncate">{user.name}</p>
                              <p className="font-mono text-[8px] text-muted-foreground truncate mt-0.5">{user.email}</p>
                            </div>
                            <div className="px-4 py-3 border-b border-border">
                              <p className="font-mono text-[9px] tracking-widest uppercase font-bold text-foreground mb-2">Latest reads</p>
                              {latestReads.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                  {latestReads.map(read => (
                                    <button
                                      key={read.id}
                                      onClick={() => { setUserMenuOpen(false); navigate({ type: "article", id: read.id }); }}
                                      className="text-left font-['Inter',sans-serif] text-xs font-semibold text-foreground/75 hover:bg-secondary hover:text-accent px-2 py-1.5 transition-colors"
                                    >
                                      {read.title}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="font-['Inter',sans-serif] text-xs text-muted-foreground">Your latest reads will appear here.</p>
                              )}
                            </div>
                            <button onClick={() => { setUserMenuOpen(false); navigate({ type: "saved" }); }} className="w-full text-left px-4 py-2.5 font-mono text-[8px] tracking-widest uppercase text-foreground/70 hover:bg-secondary hover:text-foreground transition-colors flex items-center gap-2">
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
                        className="border border-white/20 px-2 xl:px-4 py-2 font-mono text-[9px] tracking-[0.1em] uppercase text-white/70 hover:bg-white/10 hover:text-white hover:border-white/50 transition-all"
                        title="Log out"
                      >
                        Log Out
                      </button>
                    </div>
                  ) : (
                    /* Logged-out: sign in */
                    <>
                      <button
                        onClick={onLoginClick}
                        className="border border-white/25 px-3 xl:px-5 py-2 font-mono text-[9px] tracking-[0.1em] uppercase text-white/85 hover:bg-white/10 hover:text-white hover:border-white/55 transition-all"
                      >
                        Sign In
                      </button>
                      <button
                        onClick={onRegisterClick}
                        className="border border-white/25 px-3 xl:px-5 py-2 font-mono text-[9px] tracking-[0.1em] uppercase text-white/85 hover:bg-white/10 hover:text-white hover:border-white/55 transition-all"
                      >
                        Sign Up
                      </button>
                    </>
                  )}
                </div>

                {/* Mobile: search + hamburger */}
                <div className="flex lg:hidden items-center gap-1">
                  <button
                    onClick={() => setSearchOverlayOpen(true)}
                    className="p-2 text-white/70 hover:text-white transition-colors"
                    aria-label="Search"
                  >
                    <Search size={18} />
                  </button>
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
            <div className="hidden lg:block border-t border-white/10">
              <div className="max-w-7xl mx-auto px-4 lg:px-8">
                <nav className="flex items-center justify-center gap-0 xl:gap-1">
                  {NAV_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => cat === "News" ? navigate({ type: "home" }) : navigate({ type: "category", name: cat })}
                      className="relative shrink-0 px-2 xl:px-4 py-3.5 font-['Inter',sans-serif] font-bold text-[10px] xl:text-[11px] tracking-[0.06em] xl:tracking-[0.08em] uppercase text-white/75 hover:bg-white/10 hover:text-white transition-all group"
                    >
                      {cat}
                      <span className="absolute bottom-0 left-4 w-0 h-[2px] bg-accent group-hover:w-6 transition-all duration-200" />
                    </button>
                  ))}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setCategoriesOpen(v => !v)}
                      className="flex items-center gap-1 px-2 xl:px-4 py-3.5 font-['Inter',sans-serif] font-bold text-[10px] xl:text-[11px] tracking-[0.06em] xl:tracking-[0.08em] uppercase text-white/75 hover:bg-white/10 hover:text-white transition-all"
                      aria-expanded={categoriesOpen}
                      aria-haspopup="menu"
                    >
                      More <ChevronDown size={11} className={`transition-transform ${categoriesOpen ? "rotate-180" : ""}`} />
                    </button>
                    {categoriesOpen && (
                      <div className="absolute right-0 top-full z-[100] min-w-56 overflow-hidden bg-[#0f1f3d] border border-white/25 shadow-2xl" role="menu">
                        {MORE_CATEGORIES.map(cat => (
                          <button
                            key={cat}
                            onClick={() => {
                              setCategoriesOpen(false);
                              navigate({ type: "category", name: cat });
                            }}
                            className="block w-full text-left px-5 py-3.5 font-['Inter',sans-serif] font-bold text-[11px] tracking-[0.06em] uppercase text-white/85 hover:bg-white/15 hover:text-white transition-colors"
                            role="menuitem"
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </nav>
              </div>
            </div>

          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden bg-[rgba(8,14,28,0.97)] border-b border-white/10">
            {user && (
              <div className="px-4 pt-4 pb-2 border-b border-white/10">
                <p className="font-mono text-[9px] tracking-widest uppercase font-bold text-white">{user.name}</p>
                <p className="font-mono text-[8px] text-white/50 mt-1">{user.email}</p>
                {latestReads.length > 0 && (
                  <div className="mt-3">
                    <p className="font-mono text-[8px] tracking-widest uppercase font-bold text-white/70 mb-1.5">Latest reads</p>
                    {latestReads.slice(0, 3).map(read => (
                      <button
                        key={read.id}
                        onClick={() => { setMobileOpen(false); navigate({ type: "article", id: read.id }); }}
                        className="block w-full text-left py-1.5 font-['Inter',sans-serif] text-xs font-semibold text-white/70 hover:text-accent transition-colors truncate"
                      >
                        {read.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <nav className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
              <button
                onClick={() => user ? setUserMenuOpen(v => !v) : (() => { onLoginClick(); setMobileOpen(false); })()}
                className="flex items-center gap-2 text-left py-3 font-['Inter',sans-serif] font-semibold text-[11px] tracking-[0.06em] uppercase text-white/75 hover:text-accent transition-colors border-b border-white/8"
                aria-expanded={user ? userMenuOpen : undefined}
              >
                <User size={14} /> {user ? "Profile / Account" : "Sign In / Account"}
                {user && <ChevronDown size={12} className={`transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />}
              </button>
              {user && userMenuOpen && (
                <div className="border-b border-white/10 px-2 py-3">
                  <p className="font-mono text-[9px] tracking-widest uppercase font-bold text-white">{user.name}</p>
                  <p className="font-mono text-[8px] text-white/50 mt-1">{user.email}</p>
                </div>
              )}
              {user && (
                <button onClick={() => { setMobileOpen(false); navigate({ type: "saved" }); }} className="flex items-center gap-2 text-left py-3 font-['Inter',sans-serif] font-semibold text-[11px] tracking-[0.06em] uppercase text-white/75 hover:text-accent transition-colors border-b border-white/8">
                  <Bookmark size={14} /> Saved Articles
                </button>
              )}
              {ALL_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    setMobileOpen(false);
                    if (cat === "Home") navigate({ type: "home" });
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
  return (
    <footer className="bg-[#0f1f3d] text-white">
      {/* Links */}
      <div className="relative max-w-7xl mx-auto px-4 lg:px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 overflow-hidden">
        <span aria-hidden="true" className="absolute inset-0 border-y border-white/5 bg-black/10 shadow-inner" />
        <div className="relative z-10">
          <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/40 mb-4">Categories</p>
          {["Politics", "Business", "Technology", "Sports", "Science", "Entertainment", "Opinion", "Africa"].map(cat => (
            <button
              key={cat}
              onClick={() => navigate({ type: "category", name: cat })}
              className="block font-['Inter',sans-serif] text-sm text-white/60 hover:text-white transition-colors mb-2"
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="relative z-10">
          <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/40 mb-4">Company</p>
          <button onClick={() => navigate({ type: "about" })} className="block font-['Inter',sans-serif] text-sm text-white/60 hover:text-white transition-colors mb-2">About Us</button>
          {["Editorial Policy", "Our Team", "Advertise", "Careers", "Contact Us"].map(item => (
            <button key={item} className="block font-['Inter',sans-serif] text-sm text-white/60 hover:text-white transition-colors mb-2">{item}</button>
          ))}
        </div>
        <div className="relative z-10">
          <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/40 mb-4">Legal</p>
          <button onClick={() => navigate({ type: "privacy" })} className="block font-['Inter',sans-serif] text-sm text-white/60 hover:text-white transition-colors mb-2">Privacy Policy</button>
          <button className="block font-['Inter',sans-serif] text-sm text-white/60 hover:text-white transition-colors mb-2">Terms of Service</button>
          <button onClick={() => navigate({ type: "cookies" })} className="block font-['Inter',sans-serif] text-sm text-white/60 hover:text-white transition-colors mb-2">Cookie Policy</button>
          <button className="block font-['Inter',sans-serif] text-sm text-white/60 hover:text-white transition-colors mb-2">POPIA Compliance</button>
        </div>
        <div className="relative z-10">
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
          <div className="flex flex-col items-start gap-3 mb-2">
            <img src={logoImg} alt="News SA" className="w-32 h-32 object-cover" />
            <div>
                <p className="font-['Playfair_Display',serif] text-white text-[18px] font-black">NEWS SOUTH AFRICA</p>
                <p className="font-mono text-[16px] text-white/40 tracking-widest uppercase">Independent Digital News</p>
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
  const seo = <SeoHead title="News South Africa | NewsSA" description="Independent news and events from South Africa, Africa and the world, published by News South Africa." path="/" keywords={["South Africa news", "Africa news", "NewsSA"]} />;
  // WordPress not connected
  if (!import.meta.env.VITE_WORDPRESS_API) return <>{seo}<NotConfiguredState /></>;
  if (error) return <>{seo}<ErrorState title="Could not load articles" message={error} /></>;

  if (loading || !hero) {
    return (
      <>
        {seo}
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
      </>
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
                  className="w-full text-left flex gap-4 items-start px-7 py-5 border-t border-border cursor-pointer hover:bg-secondary/40 transition-all group"
                >
                  <span className="font-['Playfair_Display',serif] font-black text-foreground/10 text-lg shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-['Playfair_Display',serif] font-bold text-foreground text-sm leading-snug group-hover:text-accent transition-colors">
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

    </main>
  );
}

// ============================================================
// ARTICLE PAGE
// ============================================================
function SavedArticlesPage({ navigate, user, onRequireLogin }: { navigate: (p: Page) => void; user: AuthUser | null; onRequireLogin: () => void }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    getSavedArticles()
      .then(result => Promise.all(result.articles.map(item => fetchPost(item.articleId).then(transformPost))))
      .then(loaded => { if (!cancelled) setArticles(loaded); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  const seo = <SeoHead title="Saved Articles | NewsSA" description="Your saved NewsSA articles." path="/saved" robots="noindex, nofollow" />;
  if (!user) return (<>{seo}
    <main className="max-w-7xl mx-auto px-4 lg:px-8 py-24">
      <div className="max-w-md mx-auto text-center">
        <Bookmark size={32} className="mx-auto text-accent" />
        <h1 className="font-['Playfair_Display',serif] font-black text-3xl text-foreground mt-5">Sign in to view saved articles</h1>
        <p className="font-['Inter',sans-serif] text-sm text-muted-foreground mt-3">Your reading list is private and available after you sign in.</p>
        <button onClick={onRequireLogin} className="mt-6 bg-foreground text-white px-5 py-3 font-mono text-[9px] tracking-widest uppercase hover:bg-accent transition-colors">Sign In</button>
      </div>
    </main>
  </>);

  if (loading) return <main className="max-w-7xl mx-auto px-4 lg:px-8 py-16"><div className="grid grid-cols-1 md:grid-cols-2 gap-8">{[1, 2].map(item => <ArticleCardSkeleton key={item} />)}</div></main>;
  if (error) return <ErrorState title="Saved articles unavailable" message="We couldn't load your saved articles. Please try again." onRetry={() => window.location.reload()} />;

  return (
    <>
      {seo}
    <main className="max-w-7xl mx-auto px-4 lg:px-8 py-12">
      <div className="flex items-end justify-between border-b-2 border-foreground pb-4 mb-8">
        <div>
          <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-2">Your reading list</p>
          <h1 className="font-['Playfair_Display',serif] font-black text-4xl text-foreground">Saved Articles</h1>
        </div>
        <Bookmark className="text-accent" size={28} />
      </div>
      {articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
          <Bookmark size={32} className="text-muted-foreground" />
          <div>
            <p className="font-['Playfair_Display',serif] text-xl font-bold text-foreground">No saved articles yet.</p>
            <p className="font-['Inter',sans-serif] text-sm text-muted-foreground mt-1">Keep the stories you want to return to in one place.</p>
          </div>
          <button onClick={() => navigate({ type: "home" })} className="bg-foreground text-white px-5 py-3 font-mono text-[9px] tracking-widest uppercase hover:bg-accent transition-colors">Explore Articles</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
          {articles.map(article => <ArticleCardMedium key={article.id} article={article} onClick={() => navigate({ type: "article", id: article.id })} />)}
        </div>
      )}
    </main>
    </>
  );
}

function ArticlePage({ id, navigate, user, onRequireLogin }: { id: number; navigate: (p: Page) => void; user: AuthUser | null; onRequireLogin: () => void }) {
  const { article, loading, error } = usePost(id);
  const [saved, setSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const { articles: related } = usePosts(
    article ? { categories: [], per_page: 3, orderby: "date" } : {},
    [article?.id]
  );
  const { articles: trending } = usePosts({ per_page: 5, orderby: "date" }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  useEffect(() => {
    if (!user || !article) return;
    const key = `newssa_latest_reads_${user.id}`;
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? "[]") as LatestRead[];
      const next = [
        { id: article.id, title: article.title, readAt: new Date().toISOString() },
        ...stored.filter(read => read.id !== article.id),
      ].slice(0, 5);
      localStorage.setItem(key, JSON.stringify(next));
    } catch { return; }
  }, [article, user]);

  useEffect(() => {
    if (!user) return;
    getSavedArticles().then(result => setSaved(result.articles.some(item => item.articleId === id))).catch(() => setSaved(false));
  }, [id, user]);

  const articlePath = `/article/${id}`;
  const seo = <SeoHead
    title={article ? `${article.title} | NewsSA` : "Article | NewsSA"}
    description={article?.subtitle || "Read the latest independent news from News South Africa."}
    path={articlePath}
    type="article"
    image={article?.image}
    author={article?.authorAvailable ? article.author : undefined}
    section={article?.category}
    publishedTime={article?.publishedAt}
    modifiedTime={article?.modifiedAt}
    breadcrumbs={article ? [{ name: "Home", path: "/" }, { name: article.category, path: `/category/${article.category.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and")}` }, { name: article.title, path: articlePath }] : undefined}
  />;

  async function toggleSaved() {
    if (!user) { onRequireLogin(); return; }
    setSaveLoading(true);
    setSaveError("");
    try {
      if (saved) await unsaveArticle(id);
      else await saveArticle(id);
      setSaved(current => !current);
    } catch { setSaveError("We couldn't update your saved articles. Please try again."); }
    finally { setSaveLoading(false); }
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

  if (!import.meta.env.VITE_WORDPRESS_API) return <>{seo}<NotConfiguredState /></>;
  if (loading) return (
    <><SeoHead title="Article | NewsSA" description="Read the latest independent news from News South Africa." path={articlePath} type="article" /><main className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        {Array.from({ length: 6 }, (_, i) => <ArticleCardSkeleton key={i} />)}
      </div>
    </main></> 
  );
  if (error || !article) return <>{seo}<ErrorState title="Article not found" message={error ?? undefined} onRetry={() => window.location.reload()} /></>;

  const prevArticle: { id: number; title: string } | null = null as { id: number; title: string } | null;
  const nextArticle: { id: number; title: string } | null = null as { id: number; title: string } | null;

  return (
    <>
      {seo}
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
              <button aria-label={saved ? "Remove saved article" : "Save article"} onClick={toggleSaved} disabled={saveLoading} className={`flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase transition-colors disabled:opacity-50 ${saved ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}>
                <Bookmark size={16} fill={saved ? "currentColor" : "none"} /> {saveLoading ? "Saving..." : saved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
          {saveError && <p role="alert" className="mt-2 text-right font-['Inter',sans-serif] text-xs text-red-600">{saveError}</p>}

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
    </>
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
  const categorySlug = name.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and");
  const seo = <SeoHead title={`${displayName} News | NewsSA`} description={`The latest ${displayName} news and updates from News South Africa.`} path={`/category/${categorySlug}`} keywords={[`${displayName} news`, "NewsSA"]} breadcrumbs={[{ name: "Home", path: "/" }, { name: displayName, path: `/category/${categorySlug}` }]} />;

  useEffect(() => { window.scrollTo(0, 0); setPage(1); }, [name]);

  if (!import.meta.env.VITE_WORDPRESS_API) return <>{seo}<NotConfiguredState /></>;
  if (error) return <>{seo}<ErrorState title={`Could not load ${displayName}`} message={error} /></>;
  if (loading) return (
    <>{seo}<main>
      <div className="border-b border-border py-10 max-w-7xl mx-auto px-4 lg:px-8">
        <div className="h-16 bg-muted animate-pulse w-48 mb-2" />
        <div className="h-4 bg-muted animate-pulse w-32" />
      </div>
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }, (_, i) => <ArticleCardSkeleton key={i} />)}
        </div>
      </div>
    </main></>
  );
  if (!loading && articles.length === 0) return (
    <>{seo}<main>
      <div className="border-b border-border py-10 max-w-7xl mx-auto px-4 lg:px-8">
        <h1 className="font-['Playfair_Display',serif] font-black text-5xl md:text-7xl" style={{ color: meta.textColor }}>{displayName}</h1>
      </div>
      <EmptyState title="No articles in this category yet" message="Check back soon — content is published from WordPress." />
    </main></>
  );

  return (
    <>
      {seo}
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
          </aside>
        </div>
      </div>
    </main>
    </>
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

  const seo = <SeoHead title={`Search: ${query} | NewsSA`} description={`Search NewsSA for articles about ${query}.`} path="/" robots="noindex, follow" />;

  return (
    <>
      {seo}
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
    </>
  );
}

// ============================================================
// CONTACT PAGE
// ============================================================
function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  return (
    <>
      <SeoHead title="Contact News South Africa | NewsSA" description="Contact the NewsSA editorial team with tips, corrections, story ideas and feedback." path="/category/contact" keywords={["contact NewsSA", "News South Africa contact"]} />
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
    </>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-6">
      <h2 className="font-['Playfair_Display',serif] font-bold text-2xl text-foreground mb-3">{title}</h2>
      <div className="font-['Inter',sans-serif] text-muted-foreground text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function AboutPage() {
  return (
    <>
      <SeoHead title="About News South Africa | NewsSA" description="Learn about News South Africa, an independent online publication based in Johannesburg." path="/about" keywords={["about NewsSA", "News South Africa"]} />
    <main className="max-w-4xl mx-auto px-4 lg:px-8 py-16">
      <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">About</span>
      <h1 className="font-['Playfair_Display',serif] font-black text-5xl text-foreground mt-2 mb-5">About NEWSSA</h1>
      <p className="font-['Inter',sans-serif] text-muted-foreground text-lg leading-relaxed mb-10">
        News South Africa (NewsSA) is an independent online publication based in Johannesburg, Gauteng Province, South Africa, with a focus on news and events happening in South Africa, the rest of Africa and the World. We are not politically affiliated, hence we accept potential news items from any individual and organisation regardless of their backgrounds. Every news item is judged and accepted on its merit only. The decision of the Editor and the editorial team is final and is based only on the merit of the material sent to them.
      </p>
      <div className="space-y-8">
        <InfoSection title="Who We Are">
          <p>NEWSSA is a digital news publication that brings together reporting and analysis on the developments shaping our communities and the wider world.</p>
        </InfoSection>
      </div>
    </main>
    </>
  );
}

function PrivacyPolicyPage() {
  return (
    <>
      <SeoHead title="Privacy Policy | NewsSA" description="Read the NewsSA privacy policy and learn how the website handles information." path="/privacy-policy" robots="noindex, follow" />
    <main className="max-w-4xl mx-auto px-4 lg:px-8 py-16">
      <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">Legal</span>
      <h1 className="font-['Playfair_Display',serif] font-black text-5xl text-foreground mt-2 mb-5">Privacy Policy</h1>
      <p className="font-['Inter',sans-serif] text-muted-foreground text-sm leading-relaxed mb-10">This policy explains how NEWSSA handles information when you use the website. Last updated: September 2026.</p>
      <div className="space-y-8">
        <InfoSection title="Information You Provide"><p>When you create an account, we receive your name, email address and authentication information needed to verify your account, protect it and manage your session. We do not store your plain-text password.</p></InfoSection>
        <InfoSection title="Saved Articles and Newsletter Subscriptions"><p>If you use these features, we store the articles you save and the email address used for a newsletter subscription. Account-related records may be associated with your user account.</p></InfoSection>
        <InfoSection title="Website Usage and Cookies"><p>We receive technical information needed to operate the site, such as requests and browser interactions with its features. The site uses an essential session cookie for signed-in users and local storage for preferences and cookie-consent status. See the Cookie Policy for details.</p></InfoSection>
        <InfoSection title="Services We Use"><p>Article content is provided through the WordPress REST API. Email delivery uses Resend when account verification, password reset or other account messages are sent. Account and saved-article data is stored in the configured PostgreSQL service. These services process information only as needed to provide their respective functions.</p></InfoSection>
        <InfoSection title="Security"><p>We use measures such as password hashing, protected sessions and encrypted authentication secrets. No internet service can guarantee absolute security, so please use a unique password and contact us if you believe your account has been compromised.</p></InfoSection>
        <InfoSection title="Your Rights"><p>Depending on applicable law, you may request access to, correction of or deletion of personal information, or object to or restrict certain processing. Contact us using the details below so we can review your request.</p></InfoSection>
        <InfoSection title="Contact and Updates"><p>Privacy enquiries: [Add the appropriate privacy contact email address]. We may update this policy when the site or applicable requirements change. The latest version will be published on this page.</p></InfoSection>
      </div>
    </main>
    </>
  );
}

function CookiePolicyPage() {
  return (
    <>
      <SeoHead title="Cookie Policy | NewsSA" description="Read the NewsSA cookie policy and learn about cookies and browser storage used by the site." path="/cookie-policy" robots="noindex, follow" />
    <main className="max-w-4xl mx-auto px-4 lg:px-8 py-16">
      <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">Legal</span>
      <h1 className="font-['Playfair_Display',serif] font-black text-5xl text-foreground mt-2 mb-5">Cookie Policy</h1>
      <p className="font-['Inter',sans-serif] text-muted-foreground text-sm leading-relaxed mb-10">This policy describes the cookies and browser storage currently used by NEWSSA. Last updated: September 2026.</p>
      <div className="space-y-8">
        <InfoSection title="What Cookies Are"><p>Cookies are small values stored by a website in your browser. Similar browser storage, such as local storage, can remember a preference on the same device.</p></InfoSection>
        <InfoSection title="Essential Authentication Cookie"><p>When you sign in, NEWSSA uses the <code className="font-mono text-xs">__Host-newssa_session</code> cookie to maintain your authenticated session. It is HTTP-only and uses secure transport in production. This cookie is required for account features such as saved articles.</p></InfoSection>
        <InfoSection title="Preferences and Consent"><p>The existing interface may use local storage or cookies for preferences such as the sidebar state. NEWSSA also stores your cookie-consent choice locally under <code className="font-mono text-xs">newssa_cookie_consent</code> so the notice does not appear on every visit.</p></InfoSection>
        <InfoSection title="Third-Party Cookies"><p>NEWSSA does not currently add advertising cookies, analytics cookies, tracking pixels or third-party cookies. WordPress provides article content and Resend delivers account email, but this site does not claim that those services place cookies in your browser through NEWSSA.</p></InfoSection>
        <InfoSection title="Managing Cookies"><p>You can manage or delete browser cookies and local storage through your browser settings. Removing essential session storage may sign you out or affect preferences. To ask about cookie use, contact: [Add the appropriate privacy or support contact email address].</p></InfoSection>
      </div>
    </main>
    </>
  );
}

function CookieConsent({ navigate }: { navigate: (p: Page) => void }) {
  const [choice, setChoice] = useState<string | null>(null);

  useEffect(() => {
    setChoice(window.localStorage.getItem("newssa_cookie_consent"));
  }, []);

  function saveChoice(value: "accepted" | "dismissed") {
    window.localStorage.setItem("newssa_cookie_consent", value);
    setChoice(value);
  }

  if (choice) return null;

  return (
    <aside className="fixed bottom-4 left-4 right-4 z-[200] border border-border bg-background p-4 shadow-xl md:left-auto md:max-w-md" role="dialog" aria-label="Cookie consent">
      <p className="font-['Inter',sans-serif] text-sm leading-relaxed text-foreground">
        NEWSSA uses essential cookies and browser storage for sign-in, preferences and consent. Read our <button type="button" onClick={() => navigate({ type: "cookies" })} className="text-accent underline underline-offset-2">Cookie Policy</button>.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={() => saveChoice("accepted")} className="bg-primary px-4 py-2 font-mono text-[9px] tracking-widest uppercase text-primary-foreground hover:bg-accent transition-colors">Accept</button>
        <button type="button" onClick={() => saveChoice("dismissed")} className="border border-border px-4 py-2 font-mono text-[9px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">Dismiss</button>
      </div>
    </aside>
  );
}

// ============================================================
// APP
// ============================================================
function pageFromPath(pathname: string): Page {
  if (pathname === "/about" || pathname === "/about/") return { type: "about" };
  if (pathname === "/privacy-policy" || pathname === "/privacy-policy/") return { type: "privacy" };
  if (pathname === "/cookie-policy" || pathname === "/cookie-policy/") return { type: "cookies" };
  if (pathname === "/saved" || pathname === "/saved/") return { type: "saved" };

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
  if (pathname === "/") {
    const query = new URLSearchParams(window.location.search).get("search")?.trim();
    return query ? { type: "search", query } : { type: "home" };
  }
  return { type: "home" };
}

function pagePath(page: Page): string {
  if (page.type === "home") return "/";
  if (page.type === "category") {
    const slug = page.name.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and");
    return `/category/${slug}`;
  }
  if (page.type === "article") return `/article/${page.id}`;
  if (page.type === "search") return `/?search=${encodeURIComponent(page.query)}`;
  if (page.type === "saved") return "/saved";
  if (page.type === "about") return "/about";
  if (page.type === "privacy") return "/privacy-policy";
  if (page.type === "cookies") return "/cookie-policy";
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
        if (currentPage.name === "Contact") return <ContactPage />;
        return <CategoryPage name={currentPage.name} navigate={navigate} />;
      case "article":
        return <ArticlePage id={currentPage.id} navigate={navigate} user={user} onRequireLogin={() => { setAuthMode("login"); setLoginOpen(true); }} />;
      case "search":
        return <SearchPage query={currentPage.query} navigate={navigate} />;
      case "saved":
        return <SavedArticlesPage navigate={navigate} user={user} onRequireLogin={() => { setAuthMode("login"); setLoginOpen(true); }} />;
      case "about":
        return <AboutPage />;
      case "privacy":
        return <PrivacyPolicyPage />;
      case "cookies":
        return <CookiePolicyPage />;
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
      <CookieConsent navigate={navigate} />
      <ScrollToTop />
    </div>
  );
}
