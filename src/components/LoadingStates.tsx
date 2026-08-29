import { AlertCircle, RefreshCw, Inbox } from "lucide-react";

// ── Skeleton primitives ────────────────────────────────────────────────────────

function Bone({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-muted animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

// ── Article card skeletons ─────────────────────────────────────────────────────

export function ArticleCardSkeleton({ large = false }: { large?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <Bone className={large ? "h-72 md:h-96" : "h-48"} />
      <Bone className="h-3 w-16" />
      <Bone className="h-5 w-full" />
      <Bone className="h-5 w-4/5" />
      <Bone className="h-4 w-2/3" />
      <Bone className="h-3 w-24" />
    </div>
  );
}

export function ArticleCardHorizontalSkeleton() {
  return (
    <div className="flex gap-4 py-4 border-b border-border">
      <Bone className="shrink-0 w-24 h-20" />
      <div className="flex-1 flex flex-col gap-2">
        <Bone className="h-3 w-16" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-3/4" />
        <Bone className="h-3 w-24" />
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative bg-muted animate-pulse">
      <div className="h-[60vh] md:h-[75vh]" />
      <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16 flex flex-col gap-3">
        <Bone className="h-3 w-20 bg-white/20" />
        <Bone className="h-10 w-3/4 bg-white/20" />
        <Bone className="h-10 w-1/2 bg-white/20" />
        <Bone className="h-4 w-48 bg-white/20" />
      </div>
    </div>
  );
}

// ── Feedback states ────────────────────────────────────────────────────────────

interface FeedbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: FeedbackProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-4">
      <AlertCircle size={32} className="text-red-400" />
      <div>
        <p className="font-['Playfair_Display',serif] text-xl font-bold text-foreground">{title}</p>
        {message && (
          <p className="font-['Inter',sans-serif] text-sm text-muted-foreground mt-1 max-w-md">{message}</p>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 border border-border px-4 py-2 font-mono text-[9px] tracking-widest uppercase hover:bg-secondary transition-colors"
        >
          <RefreshCw size={12} /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title = "No articles yet", message }: FeedbackProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-4">
      <Inbox size={32} className="text-muted-foreground" />
      <div>
        <p className="font-['Playfair_Display',serif] text-xl font-bold text-foreground">{title}</p>
        {message && (
          <p className="font-['Inter',sans-serif] text-sm text-muted-foreground mt-1 max-w-md">{message}</p>
        )}
      </div>
    </div>
  );
}

export function NotConfiguredState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-4 max-w-lg mx-auto">
      <AlertCircle size={32} className="text-accent" />
      <div>
        <p className="font-['Playfair_Display',serif] text-xl font-bold text-foreground">
          WordPress not connected
        </p>
        <p className="font-['Inter',sans-serif] text-sm text-muted-foreground mt-2">
          Set <code className="font-mono bg-muted px-1 py-0.5 text-foreground">VITE_WORDPRESS_API</code> in your{" "}
          <code className="font-mono bg-muted px-1 py-0.5 text-foreground">.env</code> file to connect to your
          WordPress installation.
        </p>
        <p className="font-mono text-[10px] text-muted-foreground mt-3 bg-muted px-3 py-2 inline-block">
          VITE_WORDPRESS_API=https://your-site.com/wp-json/wp/v2
        </p>
      </div>
    </div>
  );
}
