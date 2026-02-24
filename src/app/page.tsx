// [cl] TimeGlobe 메인 페이지 - Phase 0
import GlobeLoader from "@/components/GlobeLoader";
import Header from "@/components/ui/Header";
import DateDisplay from "@/components/ui/DateDisplay";
import Timeline from "@/components/ui/Timeline";

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <Header />
      <DateDisplay />
      <Timeline />
      <GlobeLoader />
    </main>
  );
}
