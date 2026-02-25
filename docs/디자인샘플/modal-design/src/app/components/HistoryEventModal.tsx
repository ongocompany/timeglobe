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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface RelatedEvent {
  id: string;
  title: string;
  year: string;
  imageUrl: string;
}

interface SourceLink {
  label: string;
  url: string;
}

interface HistoryEvent {
  imageUrl: string;
  title: string;
  period: string;
  categories: string[];
  historicalRegion: string;
  modernRegion: string;
  description: string;
  sources: SourceLink[];
  relatedEvents: RelatedEvent[];
}

const categoryConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  전쟁: { icon: Swords, color: "text-red-600", bg: "bg-red-500/15" },
  인물: { icon: User, color: "text-blue-600", bg: "bg-blue-500/15" },
  문화: { icon: Palette, color: "text-purple-600", bg: "bg-purple-500/15" },
  원더: { icon: Landmark, color: "text-amber-600", bg: "bg-amber-500/15" },
  "발명/발견": { icon: Lightbulb, color: "text-emerald-600", bg: "bg-emerald-500/15" },
  지적유산: { icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-500/15" },
};

function CategoryBadge({ category }: { category: string }) {
  const config = categoryConfig[category] || {
    icon: Sparkles,
    color: "text-gray-600",
    bg: "bg-gray-500/15",
  };
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full backdrop-blur-md ${config.bg} ${config.color}`}
      style={{ fontSize: "10px" }}
    >
      <Icon size={10} />
      {category}
    </span>
  );
}

export function HistoryEventModal({
  event,
  isOpen,
  onClose,
}: {
  event: HistoryEvent;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative w-[500px] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            style={{ height: "667px" }}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Hero Image Section */}
            <div className="relative h-[280px] flex-shrink-0 overflow-hidden">
              <img
                src={event.imageUrl}
                alt={event.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md text-white/90 hover:bg-black/50 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>

              {/* Title + Period overlay */}
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                <div className="flex items-end justify-between gap-3">
                  <h2 className="text-white flex-1" style={{ fontSize: "20px", lineHeight: 1.3 }}>
                    {event.title}
                  </h2>
                  <span
                    className="text-white/70 flex-shrink-0 whitespace-nowrap"
                    style={{ fontSize: "13px" }}
                  >
                    {event.period}
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col px-4 pt-3 pb-4 gap-2.5 min-h-0">
              {/* Region Row - Historical & Modern in one line */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Landmark size={13} className="text-slate-400 flex-shrink-0" />
                  <span className="text-slate-400" style={{ fontSize: "11px" }}>과거</span>
                  <span className="text-slate-600" style={{ fontSize: "12px" }}>
                    {event.historicalRegion}
                  </span>
                </div>
                <ArrowRight size={11} className="text-slate-300 flex-shrink-0" />
                <div className="flex items-center gap-1.5">
                  <Globe size={13} className="text-slate-400 flex-shrink-0" />
                  <span className="text-slate-400" style={{ fontSize: "11px" }}>현재</span>
                  <span className="text-slate-600" style={{ fontSize: "12px" }}>
                    {event.modernRegion}
                  </span>
                </div>
              </div>

              {/* Category badges */}
              <div className="flex gap-1.5">
                {event.categories.map((cat) => (
                  <CategoryBadge key={cat} category={cat} />
                ))}
              </div>

              {/* Divider */}
              <div className="h-px bg-slate-100" />

              {/* Description */}
              <div className="flex-1 min-h-0">
                <p
                  className="text-slate-600"
                  style={{
                    fontSize: "13px",
                    lineHeight: 1.7,
                    display: "-webkit-box",
                    WebkitLineClamp: 7,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {event.description}
                </p>
              </div>

              {/* Source Links - compact buttons only */}
              <div className="flex gap-1.5">
                {event.sources.map((source) => (
                  <a
                    key={source.label}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all"
                    style={{ fontSize: "11px" }}
                  >
                    <ExternalLink size={10} />
                    {source.label}
                  </a>
                ))}
              </div>

              {/* Divider */}
              <div className="h-px bg-slate-100" />

              {/* Related Events */}
              <div>
                <p
                  className="text-slate-400 mb-2"
                  style={{ fontSize: "10px", letterSpacing: "0.06em" }}
                >
                  연관 이벤트
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {event.relatedEvents.map((related) => (
                    <button
                      key={related.id}
                      className="group flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-left cursor-pointer"
                    >
                      <img
                        src={related.imageUrl}
                        alt={related.title}
                        className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-slate-700 truncate"
                          style={{ fontSize: "12px" }}
                        >
                          {related.title}
                        </p>
                        <p className="text-slate-400" style={{ fontSize: "10px" }}>
                          {related.year}
                        </p>
                      </div>
                      <ChevronRight
                        size={12}
                        className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Sample data
export const sampleEvent: HistoryEvent = {
  imageUrl:
    "https://images.unsplash.com/photo-1759239877151-a6f2306ec759?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxKb2FuJTIwb2YlMjBBcmMlMjBtZWRpZXZhbCUyMHdhcnJpb3IlMjBwYWludGluZ3xlbnwxfHx8fDE3NzE5ODkyNzF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  title: "잔다르크의 오를레앙 해방",
  period: "1429년 5월 8일",
  categories: ["전쟁", "인물"],
  historicalRegion: "프랑스 왕국",
  modernRegion: "프랑스 오를레앙",
  description:
    "백년전쟁 중 프랑스가 잉글랜드에 밀려 위기에 처한 시기, 17세의 소녀 잔 다르크가 신의 계시를 받았다고 주장하며 프랑스군을 이끌었다. 그녀는 오를레앙 포위전에서 잉글랜드군을 격퇴하고 도시를 해방시켰으며, 이 승리는 백년전쟁의 전환점이 되었다. 이후 샤를 7세의 대관식을 이끌어내며 프랑스의 국가적 정체성을 확립하는 데 기여했으나, 1431년 이단 혐의로 화형당했다. 사후 1456년 복권되었고, 1920년 로마 가톨릭 교회에 의해 시성되었다.",
  sources: [
    { label: "위키피디아", url: "https://ko.wikipedia.org/wiki/잔_다르크" },
    { label: "나무위키", url: "https://namu.wiki/w/잔%20다르크" },
  ],
  relatedEvents: [
    {
      id: "1",
      title: "백년전쟁",
      year: "1337~1453",
      imageUrl:
        "https://images.unsplash.com/photo-1759239877151-a6f2306ec759?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxKb2FuJTIwb2YlMjBBcmMlMjBtZWRpZXZhbCUyMHdhcnJpb3IlMjBwYWludGluZ3xlbnwxfHx8fDE3NzE5ODkyNzF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    },
    {
      id: "2",
      title: "콜로세움 건설",
      year: "70~80",
      imageUrl:
        "https://images.unsplash.com/photo-1706884027668-4b2a1a9701ed?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxDb2xvc3NldW0lMjBSb21lJTIwYW5jaWVudCUyMGFyY2hpdGVjdHVyZXxlbnwxfHx8fDE3NzE5ODkyNzJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    },
    {
      id: "3",
      title: "훈민정음 창제",
      year: "1443",
      imageUrl:
        "https://images.unsplash.com/photo-1647700189611-f2b33d5a8fe1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxLb3JlYW4lMjB0cmFkaXRpb25hbCUyMHBhbGFjZSUyMEd5ZW9uZ2Jva2d1bmd8ZW58MXx8fHwxNzcxOTg5MjcyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    },
    {
      id: "4",
      title: "만리장성 축조",
      year: "기원전 7세기~",
      imageUrl:
        "https://images.unsplash.com/photo-1558507564-c573429b9ceb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxHcmVhdCUyMFdhbGwlMjBDaGluYSUyMGFuY2llbnR8ZW58MXx8fHwxNzcxOTU0NTY4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    },
  ],
};