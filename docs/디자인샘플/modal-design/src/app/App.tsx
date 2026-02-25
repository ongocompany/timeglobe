import { useState } from "react";
import { HistoryEventModal, sampleEvent } from "./components/HistoryEventModal";

export default function App() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="size-full flex items-center justify-center bg-slate-100">
      <button
        onClick={() => setIsOpen(true)}
        className="px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
      >
        역사 이벤트 모달 열기
      </button>

      <HistoryEventModal
        event={sampleEvent}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
}
