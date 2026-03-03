"use client";
// [mk] 개발용 랜딩페이지 — 모든 내부 도구 바로가기
import Link from "next/link";

const tools: {
  category: string;
  items: { href: string; name: string; desc: string; tag: string; color: string }[];
}[] = [
  {
    category: "메인",
    items: [
      { href: "/", name: "TimeGlobe", desc: "CesiumJS 지구본 뷰어 (메인)", tag: "cl", color: "#f5c542" },
    ],
  },
  {
    category: "데이터 관리",
    items: [
      { href: "/tier-review", name: "Tier Review", desc: "국가 엔티티 티어 관리 + 덤프 브라우저 + 지도", tag: "cl", color: "#4a9eff" },
      { href: "/curation", name: "이벤트 큐레이션", desc: "이벤트 큐레이션 카드 + 데이터 현황 대시보드", tag: "cl", color: "#4a9eff" },
      { href: "/dump-review", name: "Dump Review", desc: "Wikidata 덤프 파싱 데이터 큐레이션 (include/exclude)", tag: "mk", color: "#50c878" },
      { href: "/data-check", name: "Data Check", desc: "이벤트 데이터 검증 도구", tag: "cl", color: "#4a9eff" },
    ],
  },
  {
    category: "외부 데이터",
    items: [
      { href: "/namuwiki-viewer", name: "나무위키 뷰어", desc: "나무위키 2021-03 덤프 검색 + 본문 조회", tag: "mk", color: "#50c878" },
    ],
  },
  {
    category: "Ops / 파이프라인",
    items: [
      { href: "/ops", name: "Ops 대시보드", desc: "수집 파이프라인 모니터링 + 워커 상태", tag: "mk", color: "#50c878" },
      { href: "/model-manager", name: "Model Manager", desc: "Meshy 3D 모델 생성 파이프라인 관리", tag: "cl", color: "#4a9eff" },
    ],
  },
];

export default function DevLanding() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto", padding: "40px 20px", background: "#0a0a0a", minHeight: "100vh", color: "#e0e0e0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: "#f5c542" }}>TimeGlobe Dev</h1>
        <span style={{ fontSize: 13, color: "#666" }}>내부 개발 도구 모음</span>
      </div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 32, display: "flex", gap: 16 }}>
        <span><span style={{ color: "#4a9eff" }}>●</span> cl = 민철</span>
        <span><span style={{ color: "#50c878" }}>●</span> mk = 민규</span>
      </div>

      {tools.map((group) => (
        <div key={group.category} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, color: "#888", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, borderBottom: "1px solid #222", paddingBottom: 6 }}>
            {group.category}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {group.items.map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                <div
                  style={{ background: "#141414", border: "1px solid #252525", borderRadius: 10, padding: "16px 18px", cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.background = "#1a1a1a"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#252525"; e.currentTarget.style.background = "#141414"; }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: "#e0e0e0" }}>{item.name}</span>
                    <span style={{ fontSize: 11, color: item.color, background: `${item.color}18`, padding: "2px 8px", borderRadius: 10 }}>{item.tag}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#777", lineHeight: 1.4 }}>{item.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 40, fontSize: 11, color: "#333", textAlign: "center" }}>
        /dev — 이 페이지는 개발 전용입니다
      </div>
    </div>
  );
}
