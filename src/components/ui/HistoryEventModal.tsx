"use client";

// [cl] 역사 이벤트 상세 콘텐츠 - 다크/라이트 테마 지원
// EventDetailContent: 오빗 카드 내부 인라인용
// HistoryEventModal: 독립 모달 (마커 모드 등에서 사용)
import {
  X,
  ExternalLink,
  Globe,
  Landmark,
  ChevronRight,
  Swords,
  BookOpen,
  Lightbulb,
  Palette,
  User,
  Sparkles,
  ArrowRight,
  Mountain,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { MockEvent } from "@/data/mockEvents";

export type CardTheme = "dark" | "light";

// [cl] 테마별 색상 토큰
const themeTokens = {
  dark: {
    bg: "linear-gradient(180deg, rgba(15,15,25,0.97) 0%, rgba(10,10,20,0.98) 100%)",
    heroGradient: "linear-gradient(to top, rgba(10,10,20,0.95) 0%, rgba(10,10,20,0.5) 40%, rgba(0,0,0,0.15) 100%)",
    closeBtn: "bg-black/40 text-white/80 hover:bg-black/60 hover:text-white",
    title: "text-white",
    year: "text-white/50",
    iconMuted: "text-white/30",
    labelMuted: "text-white/30",
    textSecondary: "text-white/70",
    divider: "bg-white/8",
    description: "text-white/65",
    linkBorder: "border-white/10 text-white/50 hover:bg-white/5 hover:border-white/20 hover:text-white/70",
    relatedLabel: "text-white/30",
    relatedCard: "bg-white/5 hover:bg-white/10",
    relatedTitle: "text-white/80",
    relatedYear: "text-white/35",
    relatedArrow: "text-white/15 group-hover:text-white/40",
    arrowMuted: "text-white/20",
  },
  light: {
    bg: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,248,250,0.99) 100%)",
    heroGradient: "linear-gradient(to top, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.4) 40%, rgba(0,0,0,0.08) 100%)",
    closeBtn: "bg-white/60 text-slate-600 hover:bg-white/80 hover:text-slate-900",
    title: "text-slate-900",
    year: "text-slate-400",
    iconMuted: "text-slate-400",
    labelMuted: "text-slate-400",
    textSecondary: "text-slate-600",
    divider: "bg-slate-200",
    description: "text-gray-900/90",
    linkBorder: "border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700",
    relatedLabel: "text-slate-400",
    relatedCard: "bg-slate-100 hover:bg-slate-200/80",
    relatedTitle: "text-slate-700",
    relatedYear: "text-slate-400",
    relatedArrow: "text-slate-300 group-hover:text-slate-500",
    arrowMuted: "text-slate-300",
  },
};

// [cl] 카테고리별 아이콘 & 테마별 색상
const categoryConfig: Record<
  string,
  { icon: React.ElementType; dark: { color: string; bg: string }; light: { color: string; bg: string } }
> = {
  "정치/전쟁": { icon: Swords, dark: { color: "text-red-400", bg: "bg-red-500/20" }, light: { color: "text-red-600", bg: "bg-red-500/15" } },
  "인물/문화": { icon: User, dark: { color: "text-blue-400", bg: "bg-blue-500/20" }, light: { color: "text-blue-600", bg: "bg-blue-500/15" } },
  "과학/발명": { icon: Lightbulb, dark: { color: "text-emerald-400", bg: "bg-emerald-500/20" }, light: { color: "text-emerald-600", bg: "bg-emerald-500/15" } },
  "건축/유물": { icon: Landmark, dark: { color: "text-amber-400", bg: "bg-amber-500/20" }, light: { color: "text-amber-600", bg: "bg-amber-500/15" } },
  "자연재해/지질": { icon: Mountain, dark: { color: "text-orange-400", bg: "bg-orange-500/20" }, light: { color: "text-orange-600", bg: "bg-orange-500/15" } },
  문화: { icon: Palette, dark: { color: "text-purple-400", bg: "bg-purple-500/20" }, light: { color: "text-purple-600", bg: "bg-purple-500/15" } },
  지적유산: { icon: BookOpen, dark: { color: "text-indigo-400", bg: "bg-indigo-500/20" }, light: { color: "text-indigo-600", bg: "bg-indigo-500/15" } },
};

function CategoryBadge({ category, theme }: { category: string; theme: CardTheme }) {
  const config = categoryConfig[category];
  const fallbackColor = theme === "dark" ? { color: "text-white/60", bg: "bg-white/10" } : { color: "text-slate-500", bg: "bg-slate-200" };
  const colors = config ? config[theme] : fallbackColor;
  const Icon = config?.icon || Sparkles;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full backdrop-blur-md ${colors.bg} ${colors.color}`}
      style={{ fontSize: "12px" }}
    >
      <Icon size={11} />
      {category}
    </span>
  );
}

// [cl] URL에서 소스 라벨 자동 추출
function getSourceLabel(url: string): string {
  if (url.includes("namu.wiki")) return "나무위키";
  if (url.includes("wikipedia.org")) return "위키피디아";
  if (url.includes("britannica.com")) return "브리태니커";
  return "외부 링크";
}

// [cl] 연도 표시 포맷
function formatYear(startYear: number, endYear: number | null): string {
  const fmt = (y: number) => (y < 0 ? `BC ${Math.abs(y)}` : `${y}년`);
  if (endYear && endYear !== startYear) {
    return `${fmt(startYear)} ~ ${fmt(endYear)}`;
  }
  return fmt(startYear);
}

// ─────────────────────────────────────────────
// [cl] EventDetailContent: 오빗 카드 안에 들어가는 인라인 콘텐츠
// ─────────────────────────────────────────────
interface EventDetailContentProps {
  event: MockEvent;
  theme?: CardTheme;
  relatedEvents?: MockEvent[];
  onRelatedClick?: (event: MockEvent) => void;
  onClose?: () => void;
}

export function EventDetailContent({
  event,
  theme = "dark",
  relatedEvents = [],
  onRelatedClick,
  onClose,
}: EventDetailContentProps) {
  const t = themeTokens[theme];

  return (
    <div
      className="flex flex-col w-full h-full"
      style={{ background: t.bg }}
    >
      {/* ── 히어로 이미지 (카드 상단 38%) ── */}
      <div className="relative flex-shrink-0" style={{ height: "38%" }}>
        <img
          src={event.image_url}
          alt={event.title.ko}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: t.heroGradient }} />

        {/* [cl] 닫기 버튼 */}
        {onClose && (
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className={`absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full backdrop-blur-md transition-colors cursor-pointer z-10 ${t.closeBtn}`}
          >
            <X size={15} />
          </button>
        )}

        {/* [cl] 제목 + 연도 */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
          <div className="flex items-end justify-between gap-3">
            <h2
              className={`flex-1 font-semibold ${t.title}`}
              style={{ fontSize: "21px", lineHeight: 1.3 }}
            >
              {event.title.ko}
            </h2>
            <span
              className={`flex-shrink-0 whitespace-nowrap ${t.year}`}
              style={{ fontSize: "13px" }}
            >
              {formatYear(event.start_year, event.end_year)}
            </span>
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 영역 ── */}
      <div className="flex-1 flex flex-col px-5 pt-3 pb-4 gap-2.5 min-h-0">
        {/* [cl] 지역 정보 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Landmark size={12} className={`flex-shrink-0 ${t.iconMuted}`} />
            <span className={t.labelMuted} style={{ fontSize: "11px" }}>과거</span>
            <span className={t.textSecondary} style={{ fontSize: "12px" }}>
              {event.historical_region.ko}
            </span>
          </div>
          <ArrowRight size={10} className={`flex-shrink-0 ${t.arrowMuted}`} />
          <div className="flex items-center gap-1.5">
            <Globe size={12} className={`flex-shrink-0 ${t.iconMuted}`} />
            <span className={t.labelMuted} style={{ fontSize: "11px" }}>현재</span>
            <span className={t.textSecondary} style={{ fontSize: "12px" }}>
              {event.modern_country.ko}
            </span>
          </div>
        </div>

        {/* [cl] 카테고리 뱃지 */}
        <div className="flex gap-1.5">
          <CategoryBadge category={event.category} theme={theme} />
        </div>

        <div className={`h-px ${t.divider}`} />

        {/* [cl] 상세 설명 */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          <p
            className={t.description}
            style={{ fontSize: "13px", lineHeight: 1.75 }}
          >
            {event.description.ko}
          </p>
        </div>

        {/* [cl] 출처 링크 */}
        {event.external_link && (
          <div className="flex gap-1.5 flex-shrink-0">
            <a
              href={event.external_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all ${t.linkBorder}`}
              style={{ fontSize: "12px" }}
            >
              <ExternalLink size={10} />
              {getSourceLabel(event.external_link)}
            </a>
          </div>
        )}

        {/* [cl] 연관 이벤트 */}
        {relatedEvents.length > 0 && (
          <>
            <div className={`h-px flex-shrink-0 ${t.divider}`} />
            <div className="flex-shrink-0">
              <p
                className={`mb-1.5 tracking-wide ${t.relatedLabel}`}
                style={{ fontSize: "11px" }}
              >
                같은 시대 다른 나라에서는?
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {relatedEvents.slice(0, 4).map((related) => (
                  <button
                    key={related.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRelatedClick?.(related);
                    }}
                    className={`group flex items-center gap-2 p-1.5 rounded-lg transition-colors text-left cursor-pointer ${t.relatedCard}`}
                  >
                    <img
                      src={related.image_url}
                      alt={related.title.ko}
                      className="w-7 h-7 rounded-md object-cover flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate ${t.relatedTitle}`} style={{ fontSize: "12px" }}>
                        {related.title.ko}
                      </p>
                      <p className={t.relatedYear} style={{ fontSize: "10px" }}>
                        {formatYear(related.start_year, related.end_year)}
                      </p>
                    </div>
                    <ChevronRight
                      size={11}
                      className={`transition-colors flex-shrink-0 ${t.relatedArrow}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// [cl] HistoryEventModal: 독립 모달 래퍼 (마커 모드 등에서 사용)
// ─────────────────────────────────────────────
interface HistoryEventModalProps {
  event: MockEvent | null;
  isOpen: boolean;
  onClose: () => void;
  theme?: CardTheme;
  relatedEvents?: MockEvent[];
  onRelatedClick?: (event: MockEvent) => void;
}

export default function HistoryEventModal({
  event,
  isOpen,
  onClose,
  theme = "dark",
  relatedEvents = [],
  onRelatedClick,
}: HistoryEventModalProps) {
  if (!event) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-start pl-[20%] p-4"
          style={{ perspective: "1200px" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className={`relative w-[500px] rounded-2xl overflow-hidden shadow-2xl flex flex-col border ${
              theme === "dark" ? "border-white/10" : "border-slate-200"
            }`}
            style={{ height: "680px" }}
            initial={{ opacity: 0, scale: 0.95, y: 20, rotateY: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateY: 10 }}
            exit={{ opacity: 0, scale: 0.95, y: 20, rotateY: 15 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <EventDetailContent
              event={event}
              theme={theme}
              relatedEvents={relatedEvents}
              onRelatedClick={onRelatedClick}
              onClose={onClose}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
