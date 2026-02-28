#!/usr/bin/env python3
"""
[cl] HB 메타데이터에서 국가별 존속기간 추출 → Gemini 검증용 JSON 생성

사용법:
  python3 scripts/geo/extractEntityLifespans.py

출력:
  scripts/geo/validation/  폴더에 500년 단위 JSON 파일 생성
  → 이 파일들을 Gemini 웹 UI에 붙여넣어 검증
"""

import json
import os
import glob
from collections import defaultdict

META_DIR = os.path.join(os.path.dirname(__file__), "../../public/geo/borders/metadata")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "validation")

# CShapes (1886~2015)는 근현대 정확 데이터이므로 HB 검증 범위에서 제외
# HB 범위: BC 123000 ~ AD 1880
# 실질적 검증 대상: BC 3000 ~ AD 1880 (문명 시작 이후)
HB_MIN_YEAR = -3000
HB_MAX_YEAR = 1880


def extract_lifespans():
    """메타데이터 파일들에서 각 엔티티의 등장 연도 목록을 추출"""
    entity_years = defaultdict(list)  # entity_key → [year1, year2, ...]
    entity_info = {}  # entity_key → {display_name_en, display_name_ko, tier, confidence}

    meta_files = sorted(glob.glob(os.path.join(META_DIR, "*.json")))
    print(f"메타데이터 파일 수: {len(meta_files)}")

    for fpath in meta_files:
        year = int(os.path.basename(fpath).replace(".json", ""))
        if year < HB_MIN_YEAR or year > HB_MAX_YEAR:
            continue

        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)

        for key, meta in data.items():
            entity_years[key].append(year)
            # 가장 최신 메타데이터 정보 유지
            entity_info[key] = {
                "en": meta.get("display_name_en", key),
                "ko": meta.get("display_name_ko", ""),
                "tier": meta.get("tier", 0),
                "confidence": meta.get("confidence", "unknown"),
            }

    # 존속 기간 계산
    lifespans = {}
    for key, years in entity_years.items():
        years_sorted = sorted(years)
        lifespans[key] = {
            "en": entity_info[key]["en"],
            "ko": entity_info[key]["ko"],
            "tier": entity_info[key]["tier"],
            "confidence": entity_info[key]["confidence"],
            "first_appearance": years_sorted[0],
            "last_appearance": years_sorted[-1],
            "snapshot_count": len(years_sorted),
            "snapshots": years_sorted,
        }

    return lifespans


def split_by_period(lifespans, period=500):
    """존속기간을 500년 단위로 분할"""
    periods = {}

    # BC 3000 ~ AD 1880 범위를 500년씩
    start = HB_MIN_YEAR
    while start < HB_MAX_YEAR:
        end = min(start + period, HB_MAX_YEAR)
        period_key = f"{start}_to_{end}"

        # 이 기간에 존재한 엔티티 필터링
        entities_in_period = {}
        for key, info in lifespans.items():
            if info["first_appearance"] <= end and info["last_appearance"] >= start:
                # 이 기간 내 스냅샷만 추출
                period_snapshots = [y for y in info["snapshots"] if start <= y <= end]
                if period_snapshots:
                    entities_in_period[key] = {
                        "name_en": info["en"],
                        "name_ko": info["ko"],
                        "tier": info["tier"],
                        "in_data_from": info["first_appearance"],
                        "in_data_until": info["last_appearance"],
                        "snapshots_in_period": period_snapshots,
                    }

        if entities_in_period:
            # tier 순, 알파벳 순 정렬
            sorted_entities = dict(
                sorted(entities_in_period.items(),
                       key=lambda x: (x[1]["tier"], x[1]["name_en"]))
            )
            periods[period_key] = {
                "period": f"{_fmt_year(start)} ~ {_fmt_year(end)}",
                "entity_count": len(sorted_entities),
                "entities": sorted_entities,
            }

        start = end
        if start == end and end < HB_MAX_YEAR:
            start += 1

    return periods


def _fmt_year(y):
    """연도를 읽기 좋게 포맷"""
    if y < 0:
        return f"BC {abs(y)}"
    return f"AD {y}"


def generate_gemini_prompt(period_data, period_key):
    """Gemini에 붙여넣을 프롬프트 텍스트 생성"""
    info = period_data
    lines = []
    lines.append(f"## 기간: {info['period']} (총 {info['entity_count']}개 엔티티)")
    lines.append("")
    lines.append("아래는 historical-basemaps 프로젝트의 역사 지도 데이터에서 추출한")
    lines.append("국가/제국/부족 목록과 데이터상의 존속기간입니다.")
    lines.append("")
    lines.append("**각 엔티티에 대해 다음을 검증해 주세요:**")
    lines.append("1. 해당 국가/제국이 실제 역사에서 존재한 기간 (위키피디아 기준)")
    lines.append("2. 데이터상의 존속기간과 실제 기간의 차이")
    lines.append("3. 이 기간에 존재했어야 하는데 목록에 빠진 주요 국가/제국")
    lines.append("")
    lines.append("**결과를 다음 JSON 형식으로 알려주세요:**")
    lines.append("```json")
    lines.append('[')
    lines.append('  {')
    lines.append('    "entity": "엔티티 이름",')
    lines.append('    "data_period": "데이터상 기간",')
    lines.append('    "actual_period": "실제 역사 기간",')
    lines.append('    "status": "correct | wrong_start | wrong_end | missing_gap | should_not_exist",')
    lines.append('    "note": "설명"')
    lines.append('  }')
    lines.append(']')
    lines.append("```")
    lines.append("")
    lines.append("---")
    lines.append("")

    for key, ent in info["entities"].items():
        tier_label = {1: "★제국/왕국", 2: "일반국가", 3: "부족/문화"}.get(ent["tier"], "?")
        year_from = _fmt_year(ent["in_data_from"])
        year_until = _fmt_year(ent["in_data_until"])
        lines.append(f"- **{ent['name_en']}** ({ent['name_ko']}) [{tier_label}]")
        lines.append(f"  데이터 존속: {year_from} ~ {year_until}")
        lines.append(f"  스냅샷: {ent['snapshots_in_period']}")
        lines.append("")

    return "\n".join(lines)


def generate_tier12_prompt(lifespans):
    """Tier 1+2만 추출하여 1000년 단위 Gemini 프롬프트 생성 (핵심 검증용)"""
    # Tier 1+2만 필터
    important = {k: v for k, v in lifespans.items() if v["tier"] in (1, 2)}
    print(f"\n[Tier 1+2 핵심 검증] 총 {len(important)}개 엔티티")

    # 1000년 단위로 분할 (Tier1+2는 수가 적으므로 더 넓은 범위)
    start = HB_MIN_YEAR
    chunk_idx = 1
    while start < HB_MAX_YEAR:
        end = min(start + 1000, HB_MAX_YEAR)

        entities_here = {}
        for key, info in important.items():
            if info["first_appearance"] <= end and info["last_appearance"] >= start:
                period_snaps = [y for y in info["snapshots"] if start <= y <= end]
                if period_snaps:
                    entities_here[key] = info

        if entities_here:
            # tier→이름 순 정렬
            sorted_ents = dict(sorted(entities_here.items(),
                                       key=lambda x: (x[1]["tier"], x[1]["en"])))

            lines = []
            period_str = f"{_fmt_year(start)} ~ {_fmt_year(end)}"
            lines.append(f"# [{chunk_idx}] 역사 데이터 검증 요청: {period_str}")
            lines.append(f"# 대상: Tier 1(제국/왕국) + Tier 2(일반국가) — {len(sorted_ents)}개")
            lines.append("")
            lines.append("아래는 historical-basemaps 프로젝트의 역사 지도 데이터입니다.")
            lines.append("각 국가/제국의 '데이터상 존속기간'이 역사적 사실과 맞는지 검증해 주세요.")
            lines.append("")
            lines.append("**검증 항목:**")
            lines.append("1. 데이터상 존속기간 vs 실제 역사 기간 (위키피디아 기준)")
            lines.append("2. 이 기간에 존재했어야 하는데 목록에 없는 주요 국가")
            lines.append("3. 데이터에서 중간에 갑자기 사라지는 국가 (gap)")
            lines.append("")
            lines.append("**결과 형식:**")
            lines.append("| 엔티티 | 데이터 기간 | 실제 기간 | 판정 | 비고 |")
            lines.append("|--------|------------|----------|------|------|")
            lines.append("| Rome | BC500~AD476 | BC753~AD476 | wrong_start | 시작이 늦음 |")
            lines.append("")
            lines.append("판정: `correct`, `wrong_start`, `wrong_end`, `gap`(중간 누락), `missing`(아예 없음), `extra`(존재하지 않는 국가)")
            lines.append("")
            lines.append("---")
            lines.append("")

            for key, info in sorted_ents.items():
                tier_mark = "★" if info["tier"] == 1 else "  "
                snaps_here = [y for y in info["snapshots"] if start <= y <= end]
                lines.append(f"{tier_mark} **{info['en']}** ({info['ko']})")
                lines.append(f"   데이터: {_fmt_year(info['first_appearance'])} ~ {_fmt_year(info['last_appearance'])}")
                lines.append(f"   이 기간 스냅샷: {snaps_here}")

                # gap 감지: 스냅샷 간 간격이 크면 표시
                all_snaps = info["snapshots"]
                gaps = []
                for i in range(len(all_snaps) - 1):
                    gap_size = all_snaps[i + 1] - all_snaps[i]
                    if gap_size > 400:  # 400년 이상 갭
                        gaps.append(f"{_fmt_year(all_snaps[i])}→{_fmt_year(all_snaps[i+1])} ({gap_size}년 공백)")
                if gaps:
                    lines.append(f"   ⚠️ 의심 gap: {', '.join(gaps)}")
                lines.append("")

            fname = os.path.join(OUTPUT_DIR, f"gemini_tier12_{chunk_idx}_{start}_to_{end}.md")
            with open(fname, "w", encoding="utf-8") as f:
                f.write("\n".join(lines))
            print(f"  [{chunk_idx}] {period_str}: {len(sorted_ents)}개 → {os.path.basename(fname)}")
            chunk_idx += 1

        start = end
        if start == end and end < HB_MAX_YEAR:
            start += 1


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 60)
    print("[cl] HB 국가 존속기간 추출 시작")
    print("=" * 60)

    # Step 1: 존속기간 추출
    lifespans = extract_lifespans()
    print(f"\n총 엔티티 수: {len(lifespans)}")

    # 전체 데이터 저장 (참고용)
    full_path = os.path.join(OUTPUT_DIR, "all_entity_lifespans.json")
    with open(full_path, "w", encoding="utf-8") as f:
        json.dump(lifespans, f, ensure_ascii=False, indent=2)
    print(f"전체 데이터 저장: {full_path}")

    # Step 2: 500년 단위 전체 분할 (참고용)
    periods = split_by_period(lifespans, period=500)
    print(f"\n기간 분할 수: {len(periods)}")

    for period_key, period_data in periods.items():
        json_path = os.path.join(OUTPUT_DIR, f"period_{period_key}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(period_data, f, ensure_ascii=False, indent=2)

        prompt_text = generate_gemini_prompt(period_data, period_key)
        prompt_path = os.path.join(OUTPUT_DIR, f"gemini_prompt_{period_key}.md")
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(prompt_text)

        print(f"  {period_data['period']}: {period_data['entity_count']}개 엔티티 → {os.path.basename(json_path)}")

    # Step 3: ★★★ 핵심 — Tier 1+2만 따로 Gemini 프롬프트 생성 ★★★
    generate_tier12_prompt(lifespans)

    # Step 4: 요약 통계
    print("\n" + "=" * 60)
    print("[요약]")
    tier_counts = {1: 0, 2: 0, 3: 0}
    for info in lifespans.values():
        t = info["tier"]
        if t in tier_counts:
            tier_counts[t] += 1
    print(f"  Tier 1 (제국/왕국): {tier_counts[1]}개")
    print(f"  Tier 2 (일반국가): {tier_counts[2]}개")
    print(f"  Tier 3 (부족/문화): {tier_counts[3]}개")
    print(f"\n  📂 출력 폴더: {OUTPUT_DIR}")
    print(f"  📋 전체 프롬프트: gemini_prompt_*.md (500년 단위, Tier 1+2+3)")
    print(f"  ⭐ 핵심 프롬프트: gemini_tier12_*.md (1000년 단위, Tier 1+2만)")
    print(f"\n  💡 추천 순서: gemini_tier12_*.md 파일부터 Gemini에 넣어서 검증!")
    print("=" * 60)


if __name__ == "__main__":
    main()
