#!/usr/bin/env python3
# [cl] 역사 국경 메타데이터 일괄 생성 스크립트
# 원본 뼈대: 지훈(Gemini), 규칙 확충: 민철(Claude)
# 사용법: python3 scripts/geo/generateBorderMetadata.py

import json
import os

# ── 문명권 기반 색상 팔레트 (v2: 세분화) ──
# [cl] v1은 문명권 단위가 너무 넓어서 인접 경쟁국이 같은 색 → 구분 불가
# v2: 동아시아 4분할, 이슬람 3분할, 유럽 세분화, 아프리카 2분할
PALETTES = {
    # ── 동아시아 (4분할) ──
    "EastAsia":      "#F4D03F",  # 중국 본토 왕조 (골드) — 상/주/진/한/수/당/송/명/청
    "Mongol":        "#A93226",  # 몽골/유목 제국 (짙은 적갈) — 몽골/흉노/돌궐
    "Tibet":         "#AF7AC5",  # 티베트 (라벤더) — 토번/티베트
    "Manchuria":     "#D68910",  # 만주/여진 계열 (진한 앰버) — 요/금/서하
    "Korea":         "#45B39D",  # 한국: 통일신라/고려/조선 (청자색)
    "Korea_Koguryo": "#884EA0",  # 고구려 (보라) — 북방 강국
    "Korea_Paekche": "#E59866",  # 백제 (살구색) — 서남방 문화국
    "Korea_Gaya":    "#F0B27A",  # 가야 (연한 앰버) — 남부 연맹
    "Japan":         "#E74C3C",  # 일본 (적색)
    # ── 동남아 ──
    "SoutheastAsia": "#27AE60",  # 동남아 대륙부 (녹색) — 크메르/참파/바간
    "Maritime_SEA":  "#1D8348",  # 동남아 해양부 (짙은 녹색) — 스리비자야/마자파힛
    # ── 남아시아 ──
    "SouthAsia":     "#E67E22",  # 남아시아 (오렌지)
    # ── 서아시아/이슬람 (3분할) ──
    "Persian":       "#1ABC9C",  # 페르시아 (터콰이즈) — 아케메네스/파르티아/사산/사파비
    "Islamic_Arab":  "#58D68D",  # 아랍 칼리프국 (녹색) — 우마이야/아바스/파티마
    "Islamic_Turk":  "#2ECC71",  # 투르크-몽골 이슬람 (에메랄드) — 오스만/셀주크/티무르
    # ── 고대 근동 ──
    "AncientNE":     "#F7DC6F",  # 고대 근동 (연한 골드) — 아시리아/바빌론/히타이트
    # ── 유럽 ──
    "British":       "#F5B7B1",  # 대영제국 (핑크)
    "French":        "#5DADE2",  # 프랑스 (블루)
    "Spanish_Port":  "#EB984E",  # 스페인/포르투갈 (테라코타)
    "Roman_Italy":   "#8E44AD",  # 로마 공화국/제국/이탈리아 (보라)
    "Byzantine":     "#2E86C1",  # 동로마/비잔틴 제국 (파란색) — 그리스정교 계열
    "Roman_West":    "#C39BD3",  # 서로마 제국 (연보라) — 쇠퇴하는 서방
    "Germanic":      "#CD6155",  # 독일/오스트리아 (다크 레드)
    "Russian":       "#7FB3D8",  # 러시아 (라이트 블루)
    "Nordic":        "#85C1E9",  # 북유럽 스칸디나비아 (스카이)
    "EastEurope":    "#5499C7",  # 동유럽/발칸 (미디엄 블루) — 폴란드/헝가리/불가리아
    "Greek":         "#76D7C4",  # 그리스 문화권 (민트그린) — 그리스/알렉산더/비잔틴 영향
    # ── 아메리카 ──
    "US":            "#34495E",  # 미국 (네이비)
    "LatinAmerica":  "#F5B041",  # 라틴아메리카 (옐로우)
    # ── 아프리카 (2분할) ──
    "Africa_West":   "#D4AC0D",  # 서아프리카 (골드) — 가나/말리/송가이
    "Africa_East":   "#B7950B",  # 동아프리카 (올리브) — 짐바브웨/악숨/메리나
    # ── 기타 ──
    "Oceania":       "#48C9B0",  # 오세아니아 (민트)
    "Default":       "#D5D8DC",  # 미분류 (회색)
    # [cl] 하위호환: 기존 키 유지 (Africa→Africa_West, Islamic→Islamic_Arab)
    "Africa":        "#D4AC0D",
    "Islamic":       "#58D68D",
}

# ── 핵심 매핑 규칙 (original GeoJSON NAME → 메타데이터) ──
# colony=True인 경우 피지배국 이름을 우선 (자기결정권 원칙)
ENTITY_RULES = {
    # ━━━ 동아시아: 중국 ━━━
    "Manchu Empire":    {"name_local": "大清帝國", "name_en": "Qing Dynasty", "palette": "EastAsia"},
    "Qing Empire":      {"name_local": "大清帝國", "name_en": "Qing Dynasty", "palette": "EastAsia"},
    "China":            {"name_local": "中国", "name_en": "China", "palette": "EastAsia"},
    "Chinese Warlords": {"name_local": "中国 (军阀时期)", "name_en": "China (Warlord Era)", "palette": "EastAsia"},
    "Chinese warlords": {"name_local": "中国 (军阀时期)", "name_en": "China (Warlord Era)", "palette": "EastAsia"},
    "Post-Ming Warlords": {"name_local": "中国 (明末混乱期)", "name_en": "Post-Ming Warlords", "palette": "EastAsia"},
    "Manchuria":        {"name_local": "满洲", "name_en": "Manchuria", "palette": "EastAsia"},
    "Xinjiang":         {"name_local": "新疆", "name_en": "Xinjiang", "palette": "EastAsia"},
    "Taiwan":           {"name_local": "臺灣", "name_en": "Taiwan", "palette": "EastAsia"},
    "Hong Kong":        {"name_local": "香港", "name_en": "Hong Kong", "colony": True, "ruler": "British Empire", "palette": "EastAsia"},
    "Tibet":            {"name_local": "བོད", "name_en": "Tibet", "palette": "Tibet"},
    "Tibetan Empire":   {"name_local": "བོད", "name_en": "Tibetan Empire", "palette": "Tibet"},
    "Tibetans":         {"name_local": "བོད", "name_en": "Tibetans", "palette": "Tibet"},
    "Mongolia":         {"name_local": "Монгол Улс", "name_en": "Mongolia", "palette": "Mongol"},
    "Mongol Empire":    {"name_local": "Монгол Улс", "name_en": "Mongol Empire", "palette": "Mongol"},
    "Mongols":          {"name_local": "Монгол", "name_en": "Mongols", "palette": "Mongol"},
    # [cl] 고대 중국 왕조 (HB)
    "Sinic":            {"name_local": "商", "name_en": "Shang Dynasty", "palette": "EastAsia"},
    "Zhou states":      {"name_local": "周", "name_en": "Zhou Dynasty", "palette": "EastAsia"},
    "Zhoa":             {"name_local": "周", "name_en": "Zhou Dynasty", "palette": "EastAsia"},
    "Qin":              {"name_local": "秦", "name_en": "Qin Dynasty", "palette": "EastAsia"},
    "Han Empire":       {"name_local": "漢", "name_en": "Han Dynasty", "palette": "EastAsia"},
    "Han":              {"name_local": "漢", "name_en": "Han Dynasty", "palette": "EastAsia"},
    "Han Zhao":         {"name_local": "漢趙", "name_en": "Han Zhao", "palette": "EastAsia"},
    "Toba Wei":         {"name_local": "北魏", "name_en": "Northern Wei", "palette": "EastAsia"},
    "Sui Empire":       {"name_local": "隋", "name_en": "Sui Dynasty", "palette": "EastAsia"},
    "Tang Empire":      {"name_local": "唐", "name_en": "Tang Dynasty", "palette": "EastAsia"},
    "Song Empire":      {"name_local": "宋", "name_en": "Song Dynasty", "palette": "EastAsia"},
    "Liao":             {"name_local": "遼", "name_en": "Liao Dynasty", "palette": "Manchuria"},
    # [cl] Jin Empire: 기본=진(晉) EastAsia, 여진 금(1115~)은 YEAR_RANGE_OVERRIDES로 Manchuria
    "Jin Empire":       {"name_local": "晉", "name_en": "Jin Dynasty (Sima)", "palette": "EastAsia"},
    "Xixia":            {"name_local": "西夏", "name_en": "Western Xia", "palette": "Manchuria"},
    # [cl] 위진남북조 시대 (265~589)
    "Jin":              {"name_local": "晉", "name_en": "Jin Dynasty", "palette": "EastAsia"},
    "Northern Liang":   {"name_local": "北涼", "name_en": "Northern Liang", "palette": "EastAsia"},
    "Sixteen Kingdoms": {"name_local": "五胡十六國", "name_en": "Sixteen Kingdoms", "palette": "EastAsia"},
    "Ruanruan":         {"name_local": "柔然", "name_en": "Rouran Khaganate", "palette": "Mongol"},
    "Göktürks":         {"name_local": "突厥", "name_en": "Göktürk Khaganate", "palette": "Mongol"},
    "Yamato":           {"name_local": "大和", "name_en": "Yamato", "palette": "Japan"},
    "Ming Chinese Empire": {"name_local": "明", "name_en": "Ming Dynasty", "palette": "EastAsia"},
    "Ming Empire":      {"name_local": "明", "name_en": "Ming Dynasty", "palette": "EastAsia"},
    "Wu":               {"name_local": "吳", "name_en": "Wu", "palette": "EastAsia"},
    "Yue":              {"name_local": "越", "name_en": "Yue", "palette": "EastAsia"},
    "Nan-Yue":          {"name_local": "南越", "name_en": "Nanyue", "palette": "EastAsia"},
    "Min-Yue":          {"name_local": "閩越", "name_en": "Minyue", "palette": "EastAsia"},
    "Nan Chao":         {"name_local": "南詔", "name_en": "Nanzhao", "palette": "EastAsia"},
    "Hainan":           {"name_local": "海南", "name_en": "Hainan", "palette": "EastAsia"},
    "Yuezhi":           {"name_local": "月氏", "name_en": "Yuezhi", "palette": "Mongol"},
    "Yueban":           {"name_local": "悅般", "name_en": "Yueban", "palette": "Mongol"},
    "Xiongnu":          {"name_local": "匈奴", "name_en": "Xiongnu", "palette": "Mongol"},
    "Southern Xiongnu":  {"name_local": "南匈奴", "name_en": "Southern Xiongnu", "palette": "Mongol"},
    "Shan states":      {"name_local": "掸邦", "name_en": "Shan States", "palette": "SoutheastAsia"},

    # ━━━ 동아시아: 한국 ━━━
    "Korea":            {"name_local": "조선", "name_en": "Joseon", "palette": "Korea"},
    "Korea (USA)":      {"name_local": "한국 (미군정)", "name_en": "Korea (US Zone)", "colony": True, "ruler": "United States", "palette": "Korea"},
    "Korea (USSR)":     {"name_local": "한국 (소군정)", "name_en": "Korea (Soviet Zone)", "colony": True, "ruler": "USSR", "palette": "Korea"},
    "Korea, Republic of":                       {"name_local": "대한민국", "name_en": "Republic of Korea", "palette": "Korea"},
    "Korea, Democratic People's Republic of":    {"name_local": "조선민주주의인민공화국", "name_en": "DPRK", "palette": "Korea"},

    # [cl] 고대 한국 (HB) — 삼국 색상 분리
    "Paleo-Koreans":    {"name_local": "고조선", "name_en": "Proto-Koreans", "palette": "Korea"},
    "Koreans":          {"name_local": "한국인", "name_en": "Koreans", "palette": "Korea"},
    "Koguryo":          {"name_local": "고구려", "name_en": "Goguryeo", "palette": "Korea_Koguryo"},
    "Paekche":          {"name_local": "백제", "name_en": "Baekje", "palette": "Korea_Paekche"},
    "Silla":            {"name_local": "신라", "name_en": "Silla", "palette": "Korea"},
    "Gaya":             {"name_local": "가야", "name_en": "Gaya", "palette": "Korea_Gaya"},
    "Parhae":           {"name_local": "발해", "name_en": "Balhae", "palette": "Korea_Koguryo"},
    "Balhae":           {"name_local": "발해", "name_en": "Balhae", "palette": "Korea_Koguryo"},
    "Goryeo":           {"name_local": "고려", "name_en": "Goryeo", "palette": "Korea"},

    # ━━━ 동아시아: 일본 ━━━
    "Imperial Japan":   {"name_local": "大日本帝国", "name_en": "Empire of Japan", "palette": "Japan"},
    "Imperial Japan (Fujiwara)": {"name_local": "日本 (藤原)", "name_en": "Japan (Fujiwara)", "palette": "Japan"},
    "Empire of Japan":  {"name_local": "大日本帝国", "name_en": "Empire of Japan", "palette": "Japan"},
    "Japan":            {"name_local": "日本", "name_en": "Japan", "palette": "Japan"},
    "Japan (USA)":      {"name_local": "日本 (連合国占領)", "name_en": "Japan (Allied Occupation)", "colony": True, "ruler": "United States", "palette": "Japan"},
    "Japan (Warring States)": {"name_local": "日本 (戦国時代)", "name_en": "Japan (Warring States)", "palette": "Japan"},
    "Shogun Japan (Kamakura)": {"name_local": "日本 (鎌倉)", "name_en": "Japan (Kamakura)", "palette": "Japan"},
    "Jōmon":            {"name_local": "縄文", "name_en": "Jomon", "palette": "Japan"},
    "Yayoi":            {"name_local": "弥生", "name_en": "Yayoi", "palette": "Japan"},
    "Ainu":             {"name_local": "アイヌ", "name_en": "Ainu", "palette": "Japan"},
    "Ainus":            {"name_local": "アイヌ", "name_en": "Ainu", "palette": "Japan"},

    # ━━━ 동남아시아 ━━━
    "Rattanakosin Kingdom": {"name_local": "สยาม", "name_en": "Siam", "palette": "SoutheastAsia"},
    "Siam":                 {"name_local": "สยาม", "name_en": "Siam", "palette": "SoutheastAsia"},
    "Thailand":             {"name_local": "ประเทศไทย", "name_en": "Thailand", "palette": "SoutheastAsia"},
    "French Indochina":     {"name_local": "Việt Nam", "name_en": "Vietnam", "colony": True, "ruler": "France", "palette": "SoutheastAsia"},
    "French Indo-China":    {"name_local": "Việt Nam", "name_en": "Vietnam", "colony": True, "ruler": "France", "palette": "SoutheastAsia"},
    "Annam":                {"name_local": "Việt Nam (An Nam)", "name_en": "Vietnam (Annam)", "colony": True, "ruler": "France", "palette": "SoutheastAsia"},
    "Cochin China":         {"name_local": "Việt Nam (Nam Kỳ)", "name_en": "Vietnam (Cochinchina)", "colony": True, "ruler": "France", "palette": "SoutheastAsia"},
    "Tonkin":               {"name_local": "Việt Nam (Bắc Kỳ)", "name_en": "Vietnam (Tonkin)", "colony": True, "ruler": "France", "palette": "SoutheastAsia"},
    "Vietnam":              {"name_local": "Việt Nam", "name_en": "Vietnam", "palette": "SoutheastAsia"},
    "Đại Việt":             {"name_local": "Đại Việt", "name_en": "Dai Viet", "palette": "SoutheastAsia"},
    "Cambodia":             {"name_local": "កម្ពុជា", "name_en": "Cambodia", "palette": "SoutheastAsia"},
    "Khmer Empire":         {"name_local": "កម្ពុជា", "name_en": "Khmer Empire", "palette": "SoutheastAsia"},
    "Chen-La":              {"name_local": "ចេនឡា", "name_en": "Chenla", "palette": "SoutheastAsia"},
    "Laos":                 {"name_local": "ລາວ", "name_en": "Laos", "palette": "SoutheastAsia"},
    "Burma":                {"name_local": "မြန်မာ", "name_en": "Myanmar (Burma)", "colony": True, "ruler": "British Empire", "palette": "SoutheastAsia"},
    "Burmese kingdoms":     {"name_local": "မြန်မာ", "name_en": "Burmese Kingdoms", "palette": "SoutheastAsia"},
    "Pyu state":            {"name_local": "ပျူ", "name_en": "Pyu", "palette": "SoutheastAsia"},
    "Mon state":            {"name_local": "မွန်", "name_en": "Mon", "palette": "SoutheastAsia"},
    "Bagan":                {"name_local": "ပုဂံ", "name_en": "Bagan", "palette": "SoutheastAsia"},
    "Pegu":                 {"name_local": "ပဲခူး", "name_en": "Pegu", "palette": "SoutheastAsia"},
    "Arakan":               {"name_local": "ရခိုင်", "name_en": "Arakan", "palette": "SoutheastAsia"},
    "Champa":               {"name_local": "Chăm Pa", "name_en": "Champa", "palette": "SoutheastAsia"},
    "Champa City States":   {"name_local": "Chăm Pa", "name_en": "Champa", "palette": "SoutheastAsia"},
    "Srivijaya Empire":     {"name_local": "Srivijaya", "name_en": "Srivijaya", "palette": "Maritime_SEA"},
    "Mataram":              {"name_local": "Mataram", "name_en": "Mataram", "palette": "Maritime_SEA"},
    "Ayutthaya":            {"name_local": "อยุธยา", "name_en": "Ayutthaya", "palette": "SoutheastAsia"},
    "Dvaravati":            {"name_local": "ทวารวดี", "name_en": "Dvaravati", "palette": "SoutheastAsia"},
    "Aceh":                 {"name_local": "Aceh", "name_en": "Aceh", "palette": "Maritime_SEA"},
    "Malacca":              {"name_local": "Melaka", "name_en": "Malacca", "palette": "Maritime_SEA"},
    "Philippines":          {"name_local": "Pilipinas", "name_en": "Philippines", "palette": "Maritime_SEA"},
    "Dutch East Indies":    {"name_local": "Indonesia", "name_en": "Indonesia (1945)", "colony": True, "ruler": "Netherlands", "independence": 1945, "palette": "Maritime_SEA"},
    "Netherlands Indies":   {"name_local": "Indonesia", "name_en": "Indonesia (1945)", "colony": True, "ruler": "Netherlands", "independence": 1945, "palette": "Maritime_SEA"},
    "Indonesia":            {"name_local": "Indonesia", "name_en": "Indonesia", "palette": "Maritime_SEA"},
    "Malaya":               {"name_local": "Tanah Melayu", "name_en": "Malaya", "colony": True, "ruler": "British Empire", "palette": "Maritime_SEA"},
    "Malaysia":             {"name_local": "Malaysia", "name_en": "Malaysia", "palette": "Maritime_SEA"},
    "Malaysian Islamic states": {"name_local": "Malaysia", "name_en": "Malay Islamic States", "palette": "Maritime_SEA"},
    "Brunei":               {"name_local": "Brunei", "name_en": "Brunei", "palette": "Maritime_SEA"},
    "Minang":               {"name_local": "Minangkabau", "name_en": "Minangkabau", "palette": "Maritime_SEA"},
    "East Java":            {"name_local": "Jawa Timur", "name_en": "East Java", "palette": "Maritime_SEA"},

    # ━━━ 남아시아 ━━━
    "British Raj":  {"name_local": "भारत", "name_en": "India", "colony": True, "ruler": "British Empire", "palette": "SouthAsia"},
    "British East India Company": {"name_local": "भारत", "name_en": "British East India Company", "colony": True, "ruler": "British Empire", "palette": "SouthAsia"},
    "India":        {"name_local": "भारत", "name_en": "India", "palette": "SouthAsia"},
    "Pakistan":     {"name_local": "پاکستان", "name_en": "Pakistan", "palette": "SouthAsia"},
    "Bangladesh":   {"name_local": "বাংলাদেশ", "name_en": "Bangladesh", "palette": "SouthAsia"},
    "Nepal":        {"name_local": "नेपाल", "name_en": "Nepal", "palette": "SouthAsia"},
    "Bhutan":       {"name_local": "འབྲུག", "name_en": "Bhutan", "palette": "SouthAsia"},
    "Sri Lanka":    {"name_local": "ශ්‍රී ලංකා", "name_en": "Sri Lanka", "palette": "SouthAsia"},
    "Ceylon":       {"name_local": "ශ්‍රී ලංකා", "name_en": "Sri Lanka (Ceylon)", "colony": True, "ruler": "British Empire", "palette": "SouthAsia"},
    "Ceylon (Dutch)": {"name_local": "ශ්‍රී ලංකා", "name_en": "Sri Lanka (Ceylon)", "colony": True, "ruler": "Netherlands", "palette": "SouthAsia"},
    "Simhala":      {"name_local": "ශ්‍රී ලංකා", "name_en": "Sinhalese", "palette": "SouthAsia"},
    "Sinhalese kingdoms": {"name_local": "ශ්‍රී ලංකා", "name_en": "Sinhalese Kingdoms", "palette": "SouthAsia"},
    # [cl] 고대 인도
    "Mauryan Empire":  {"name_local": "मौर्य", "name_en": "Maurya Empire", "palette": "SouthAsia"},
    "Gupta Empire":    {"name_local": "गुप्त", "name_en": "Gupta Empire", "palette": "SouthAsia"},
    "Kushan Empire":   {"name_local": "कुषाण", "name_en": "Kushan Empire", "palette": "SouthAsia"},
    "Kushan Principalities": {"name_local": "कुषाण", "name_en": "Kushan Principalities", "palette": "SouthAsia"},
    "Mughal Empire":   {"name_local": "مغل", "name_en": "Mughal Empire", "palette": "SouthAsia"},
    "Mughal empire":   {"name_local": "مغل", "name_en": "Mughal Empire", "palette": "SouthAsia"},
    "Sultanate of Delhi": {"name_local": "سلطنت دهلی", "name_en": "Delhi Sultanate", "palette": "SouthAsia"},
    "Maratha":         {"name_local": "मराठा", "name_en": "Maratha", "palette": "SouthAsia"},
    "Maratha Confederacy": {"name_local": "मराठा", "name_en": "Maratha Confederacy", "palette": "SouthAsia"},
    "Chola":           {"name_local": "சோழர்", "name_en": "Chola", "palette": "SouthAsia"},
    "Chola state":     {"name_local": "சோழர்", "name_en": "Chola", "palette": "SouthAsia"},
    "Cholas":          {"name_local": "சோழர்", "name_en": "Chola", "palette": "SouthAsia"},
    "Pallava":         {"name_local": "பல்லவர்", "name_en": "Pallava", "palette": "SouthAsia"},
    "Pallava state":   {"name_local": "பல்லவர்", "name_en": "Pallava", "palette": "SouthAsia"},
    "Pallavas":        {"name_local": "பல்லவர்", "name_en": "Pallava", "palette": "SouthAsia"},
    "Palas":           {"name_local": "পাল", "name_en": "Pala", "palette": "SouthAsia"},
    "Vijayanagara":    {"name_local": "విజయనగర", "name_en": "Vijayanagara", "palette": "SouthAsia"},
    "Chalukya Empire": {"name_local": "चालुक्य", "name_en": "Chalukya", "palette": "SouthAsia"},
    "Rashtrakuta state": {"name_local": "राष्ट्रकूट", "name_en": "Rashtrakuta", "palette": "SouthAsia"},
    "Hindu kingdoms":  {"name_local": "हिन्दू", "name_en": "Hindu Kingdoms", "palette": "SouthAsia"},
    "Hindu states":    {"name_local": "हिन्दू", "name_en": "Hindu States", "palette": "SouthAsia"},
    "Rajput Kingdoms": {"name_local": "राजपूत", "name_en": "Rajput Kingdoms", "palette": "SouthAsia"},
    "Rajput kingdoms": {"name_local": "राजपूत", "name_en": "Rajput Kingdoms", "palette": "SouthAsia"},
    "Rajput Clans and Small States": {"name_local": "राजपूत", "name_en": "Rajput States", "palette": "SouthAsia"},
    "Rajputana":       {"name_local": "राजपूत", "name_en": "Rajputana", "palette": "SouthAsia"},
    "Rajputs":         {"name_local": "राजपूत", "name_en": "Rajputs", "palette": "SouthAsia"},
    "Rajastan":        {"name_local": "राजस्थान", "name_en": "Rajasthan", "palette": "SouthAsia"},
    "Bengal":          {"name_local": "বাংলা", "name_en": "Bengal", "palette": "SouthAsia"},
    "Mysore":          {"name_local": "ಮೈಸೂರು", "name_en": "Mysore", "palette": "SouthAsia"},
    "Orissa":          {"name_local": "ଓଡ଼ିଶା", "name_en": "Orissa", "palette": "SouthAsia"},
    "Vedic Aryans":    {"name_local": "वैदिक", "name_en": "Vedic Aryans", "palette": "SouthAsia"},
    "Dravidians":      {"name_local": "திராவிடர்", "name_en": "Dravidians", "palette": "SouthAsia"},
    "Indus valley civilization": {"name_local": "सिंधु", "name_en": "Indus Valley", "palette": "SouthAsia"},

    # ━━━ 중동 / 서아시아 ━━━
    "Ottoman Empire":    {"name_local": "دولت عثمانیه", "name_en": "Ottoman Empire", "palette": "Islamic_Turk"},
    "Ottoman Sultanate": {"name_local": "دولت عثمانیه", "name_en": "Ottoman Sultanate", "palette": "Islamic_Turk"},
    # [cl] 고대 중동/이슬람
    "Achaemenid Empire": {"name_local": "هخامنشیان", "name_en": "Achaemenid Empire", "palette": "Persian"},
    "Parthia":           {"name_local": "اشکانیان", "name_en": "Parthia", "palette": "Persian"},
    "Parthian Empire":   {"name_local": "اشکانیان", "name_en": "Parthian Empire", "palette": "Persian"},
    "Sassanid Empire":   {"name_local": "ساسانیان", "name_en": "Sassanid Empire", "palette": "Persian"},
    "Sassanian Empire":  {"name_local": "ساسانیان", "name_en": "Sassanid Empire", "palette": "Persian"},
    "Seleucid Kingdom":  {"name_local": "سلوکیان", "name_en": "Seleucid Kingdom", "palette": "Persian"},
    "Safavid Empire":    {"name_local": "صفویان", "name_en": "Safavid Empire", "palette": "Persian"},
    "Timurid Empire":    {"name_local": "تیموریان", "name_en": "Timurid Empire", "palette": "Islamic_Turk"},
    "Timurid Emirates":  {"name_local": "تیموریان", "name_en": "Timurid Emirates", "palette": "Islamic_Turk"},
    "Abbasid Caliphate": {"name_local": "خلافة عباسية", "name_en": "Abbasid Caliphate", "palette": "Islamic_Arab"},
    "Umayyad Caliphate": {"name_local": "خلافة أموية", "name_en": "Umayyad Caliphate", "palette": "Islamic_Arab"},
    "Fatimid Caliphate": {"name_local": "خلافة فاطمية", "name_en": "Fatimid Caliphate", "palette": "Islamic_Arab"},
    "Seljuk Caliphate":  {"name_local": "سلجوقیان", "name_en": "Seljuk Empire", "palette": "Islamic_Turk"},
    "Seljuk Empire":     {"name_local": "سلجوقیان", "name_en": "Seljuk Empire", "palette": "Islamic_Turk"},
    "Ayyubid Caliphate": {"name_local": "أيوبيون", "name_en": "Ayyubid Caliphate", "palette": "Islamic_Arab"},
    "Mamluke Sultanate": {"name_local": "مماليك", "name_en": "Mamluk Sultanate", "palette": "Islamic_Arab"},
    "Caliphate of Córdoba": {"name_local": "خلافة قرطبة", "name_en": "Caliphate of Cordoba", "palette": "Islamic_Arab"},
    "Emirate of Córdoba": {"name_local": "إمارة قرطبة", "name_en": "Emirate of Cordoba", "palette": "Islamic_Arab"},
    "Almohad Caliphate": {"name_local": "الموحدون", "name_en": "Almohad Caliphate", "palette": "Islamic_Arab"},
    "Almoravid dynasty": {"name_local": "المرابطون", "name_en": "Almoravid Dynasty", "palette": "Islamic_Arab"},
    "Hafsid Caliphate":  {"name_local": "حفصيون", "name_en": "Hafsid Caliphate", "palette": "Islamic_Arab"},
    "Idrisid Caliphate": {"name_local": "أدارسة", "name_en": "Idrisid Caliphate", "palette": "Islamic_Arab"},
    "Wattasid Caliphate": {"name_local": "وطاسيون", "name_en": "Wattasid Caliphate", "palette": "Islamic_Arab"},
    "Zayyanid Caliphate": {"name_local": "زيانيون", "name_en": "Zayyanid Caliphate", "palette": "Islamic_Arab"},
    "Golden Horde":      {"name_local": "Золотая Орда", "name_en": "Golden Horde", "palette": "Mongol"},
    "Crimean Khanate":   {"name_local": "Kırım Hanlığı", "name_en": "Crimean Khanate", "palette": "Islamic_Turk"},
    "Chagatai Khanate":  {"name_local": "چغتای", "name_en": "Chagatai Khanate", "palette": "Mongol"},
    "Kara Khitai Khaganate": {"name_local": "西遼", "name_en": "Kara Khitai", "palette": "Manchuria"},
    "Oirat Confederation": {"name_local": "Ойрат", "name_en": "Oirat Confederation", "palette": "Mongol"},
    "Ghaznavid Emirate": {"name_local": "غزنویان", "name_en": "Ghaznavid Emirate", "palette": "Islamic_Turk"},
    # 고대 중동 (성서/고대)
    "Assyria":           {"name_local": "آشور", "name_en": "Assyria", "palette": "AncientNE"},
    "Babylonia":         {"name_local": "بابل", "name_en": "Babylonia", "palette": "AncientNE"},
    "Elam":              {"name_local": "عیلام", "name_en": "Elam", "palette": "AncientNE"},
    "Ur":                {"name_local": "أور", "name_en": "Ur", "palette": "AncientNE"},
    "Urartu":            {"name_local": "אורארטו", "name_en": "Urartu", "palette": "AncientNE"},
    "Hittites":          {"name_local": "ḪAT-TI", "name_en": "Hittites", "palette": "AncientNE"},
    "Meroe":             {"name_local": "Meroë", "name_en": "Meroe", "palette": "Africa_East"},
    "Kush":              {"name_local": "Kush", "name_en": "Kush", "palette": "Africa_East"},
    "Kerma":             {"name_local": "Kerma", "name_en": "Kerma", "palette": "Africa_East"},
    "Axum":              {"name_local": "አክሱም", "name_en": "Axum", "palette": "Africa_East"},
    "Nabatean Kingdom":  {"name_local": "النبطية", "name_en": "Nabataean Kingdom", "palette": "AncientNE"},
    "Ptolemaic Kingdom": {"name_local": "بطلمي", "name_en": "Ptolemaic Kingdom", "palette": "Greek"},
    "Kingdom of David and Solomon": {"name_local": "ישראל", "name_en": "Kingdom of Israel", "palette": "AncientNE"},
    "Hadramaut":         {"name_local": "حضرموت", "name_en": "Hadramaut", "palette": "AncientNE"},
    "Saba":              {"name_local": "سبأ", "name_en": "Saba", "palette": "AncientNE"},
    "Himyarite Kingdom": {"name_local": "حمير", "name_en": "Himyarite Kingdom", "palette": "AncientNE"},
    "Scythians":         {"name_local": "Σκύθαι", "name_en": "Scythians", "palette": "Mongol"},
    "Turkey":            {"name_local": "Türkiye", "name_en": "Turkey", "palette": "Islamic_Turk"},
    "Persia":            {"name_local": "ایران", "name_en": "Persia", "palette": "Persian"},
    "Iran":              {"name_local": "ایران", "name_en": "Iran", "palette": "Persian"},
    "Iraq":              {"name_local": "العراق", "name_en": "Iraq", "palette": "Islamic_Arab"},
    "Mesopotamia (GB)":  {"name_local": "العراق", "name_en": "Iraq", "colony": True, "ruler": "British Empire", "palette": "Islamic_Arab"},
    "Saudi Arabia":      {"name_local": "المملكة العربية السعودية", "name_en": "Saudi Arabia", "palette": "Islamic_Arab"},
    "Arabia":            {"name_local": "العرب", "name_en": "Arabia", "palette": "Islamic_Arab"},
    "Arabia (Nejd)":     {"name_local": "نجد", "name_en": "Nejd", "palette": "Islamic_Arab"},
    "Hejaz":             {"name_local": "الحجاز", "name_en": "Hejaz", "palette": "Islamic_Arab"},
    "Hail":              {"name_local": "حائل", "name_en": "Ha'il Emirate", "palette": "Islamic_Arab"},
    "Emirate of Bin Shal'an": {"name_local": "إمارة", "name_en": "Rashidi Emirate", "palette": "Islamic_Arab"},
    "Yemen":             {"name_local": "اليمن", "name_en": "Yemen", "palette": "Islamic_Arab"},
    "Yemen (UK)":        {"name_local": "اليمن", "name_en": "Yemen (Aden)", "colony": True, "ruler": "British Empire", "palette": "Islamic_Arab"},
    "Oman":              {"name_local": "عُمان", "name_en": "Oman", "palette": "Islamic_Arab"},
    "Muscat and Oman":   {"name_local": "عُمان", "name_en": "Oman (Muscat)", "palette": "Islamic_Arab"},
    "Oman (British Raj)":{"name_local": "عُمان", "name_en": "Oman", "colony": True, "ruler": "British Empire", "palette": "Islamic_Arab"},
    "Trucial Oman":      {"name_local": "الإمارات", "name_en": "Trucial States", "colony": True, "ruler": "British Empire", "palette": "Islamic_Arab"},
    "United Arab Emirates":{"name_local": "الإمارات", "name_en": "UAE", "palette": "Islamic_Arab"},
    "Qatar":             {"name_local": "قطر", "name_en": "Qatar", "palette": "Islamic_Arab"},
    "Kuwait":            {"name_local": "الكويت", "name_en": "Kuwait", "palette": "Islamic_Arab"},
    "Jordan":            {"name_local": "الأردن", "name_en": "Jordan", "palette": "Islamic_Arab"},
    "Israel":            {"name_local": "ישראל / فلسطين", "name_en": "Israel/Palestine", "palette": "Islamic_Arab"},
    "Lebanon":           {"name_local": "لبنان", "name_en": "Lebanon", "palette": "Islamic_Arab"},
    "Syria":             {"name_local": "سوريا", "name_en": "Syria", "palette": "Islamic_Arab"},
    "Syria (France)":    {"name_local": "سوريا", "name_en": "Syria", "colony": True, "ruler": "France", "palette": "Islamic_Arab"},
    "Mandatory Palestine (GB)": {"name_local": "فلسطين", "name_en": "Palestine", "colony": True, "ruler": "British Empire", "palette": "Islamic_Arab"},
    "Afghanistan":       {"name_local": "افغانستان", "name_en": "Afghanistan", "palette": "Persian"},
    "Egypt":             {"name_local": "مصر", "name_en": "Egypt", "palette": "Islamic_Arab"},
    "central Asian khanates": {"name_local": "وسط آسیا", "name_en": "Central Asian Khanates", "palette": "Islamic_Turk"},
    "Bokhara Khanate":   {"name_local": "بخارا", "name_en": "Bukhara Khanate", "palette": "Islamic_Turk"},

    # ━━━ 유럽: 로마 ━━━
    "Roman Republic":    {"name_local": "SPQR", "name_en": "Roman Republic", "palette": "Roman_Italy"},
    "Roman Empire":      {"name_local": "SPQR", "name_en": "Roman Empire", "palette": "Roman_Italy"},
    "Rome":              {"name_local": "SPQR", "name_en": "Rome", "palette": "Roman_Italy"},
    # [cl] 300년 사분통치 (Tetrarchy) — 4개 분할 통치 영역
    "Rome (Constantinus)":  {"name_local": "SPQR", "name_en": "Roman Empire (Constantine)", "palette": "Roman_Italy"},
    "Rome (Diocletianus)":  {"name_local": "SPQR", "name_en": "Roman Empire (Diocletian)", "palette": "Roman_Italy"},
    "Rome (Galerius)":      {"name_local": "SPQR", "name_en": "Roman Empire (Galerius)", "palette": "Roman_Italy"},
    "Rome (Maximian)":      {"name_local": "SPQR", "name_en": "Roman Empire (Maximian)", "palette": "Roman_Italy"},
    # [cl] 동로마/서로마 분리 — 색상 구분
    "Byzantine Empire":  {"name_local": "Βασιλεία Ῥωμαίων", "name_en": "Byzantine Empire", "palette": "Byzantine"},
    "Eastern Roman Empire": {"name_local": "Βασιλεία Ῥωμαίων", "name_en": "Eastern Roman Empire", "palette": "Byzantine"},
    "Western Roman Empire": {"name_local": "SPQR", "name_en": "Western Roman Empire", "palette": "Roman_West"},
    # [cl] 게르만 민족 대이동기 (400-600)
    "Franks":            {"name_local": "Franci", "name_en": "Franks", "palette": "French"},
    "Ostrogoths":        {"name_local": "Ostrogothi", "name_en": "Ostrogothic Kingdom", "palette": "Germanic"},
    "Visigoths":         {"name_local": "Visigothi", "name_en": "Visigothic Kingdom", "palette": "Spanish_Port"},
    "Vandals":           {"name_local": "Vandali", "name_en": "Vandal Kingdom", "palette": "Africa_West"},
    "Lombard principalities": {"name_local": "Longobardi", "name_en": "Lombard Principalities", "palette": "Germanic"},
    # [cl] BC 미매핑 보완
    "Carthage":          {"name_local": "Qart-ḥadašt", "name_en": "Carthage", "palette": "Africa_West"},
    "Macedon and Hellenic League": {"name_local": "Μακεδονία", "name_en": "Macedon", "palette": "Greek"},
    # ━━━ 유럽: 중세 ━━━
    "Visigothic Kingdom": {"name_local": "Regnum Visigothorum", "name_en": "Visigothic Kingdom", "palette": "Spanish_Port"},
    "Hunnic Empire":     {"name_local": "Hún", "name_en": "Hunnic Empire", "palette": "Mongol"},
    "Sasanian Empire":   {"name_local": "ساسانیان", "name_en": "Sasanian Empire", "palette": "Persian"},
    "Carolingian Empire":{"name_local": "Karolinger", "name_en": "Carolingian Empire", "palette": "French"},
    "Frankish Kingdom":  {"name_local": "Francia", "name_en": "Frankish Kingdom", "palette": "French"},
    "Holy Roman Empire": {"name_local": "Heiliges Römisches Reich", "name_en": "Holy Roman Empire", "palette": "Germanic"},
    "Papal States":      {"name_local": "Stato Pontificio", "name_en": "Papal States", "palette": "AncientNE"},
    "Venice":            {"name_local": "Venezia", "name_en": "Venice", "palette": "EastEurope"},
    "Carthaginian Empire": {"name_local": "Carthago", "name_en": "Carthage", "palette": "Africa_West"},
    "Greek city-states": {"name_local": "Ελληνικές πόλεις", "name_en": "Greek City-States", "palette": "Greek"},
    "Greek colonies":    {"name_local": "Ελληνικές αποικίες", "name_en": "Greek Colonies", "palette": "Greek"},
    "Empire of Alexander": {"name_local": "Αλέξανδρος", "name_en": "Empire of Alexander", "palette": "Greek"},
    # [cl] 중세 유럽 국가
    "England":           {"name_local": "England", "name_en": "England", "palette": "British"},
    "England and Ireland": {"name_local": "England", "name_en": "England and Ireland", "palette": "British"},
    "Scotland":          {"name_local": "Scotland", "name_en": "Scotland", "palette": "British"},
    "Scottland":         {"name_local": "Scotland", "name_en": "Scotland", "palette": "British"},
    "Wales":             {"name_local": "Cymru", "name_en": "Wales", "palette": "British"},
    "Irlanda":           {"name_local": "Éire", "name_en": "Ireland", "palette": "British"},
    "Wessex":            {"name_local": "Wessex", "name_en": "Wessex", "palette": "British"},
    "Mercia":            {"name_local": "Mercia", "name_en": "Mercia", "palette": "British"},
    "Kent":              {"name_local": "Kent", "name_en": "Kent", "palette": "British"},
    "Essex":             {"name_local": "Essex", "name_en": "Essex", "palette": "British"},
    "Nothumbria":        {"name_local": "Northumbria", "name_en": "Northumbria", "palette": "British"},
    "Picts":             {"name_local": "Picts", "name_en": "Picts", "palette": "British"},
    "Scots":             {"name_local": "Scots", "name_en": "Scots", "palette": "British"},
    "Welsh":             {"name_local": "Cymry", "name_en": "Welsh", "palette": "British"},
    "Celtic kingdoms":   {"name_local": "Celtic", "name_en": "Celtic Kingdoms", "palette": "British"},
    "Britany":           {"name_local": "Breizh", "name_en": "Brittany", "palette": "French"},
    "Kingdom of France": {"name_local": "France", "name_en": "Kingdom of France", "palette": "French"},
    "Angevin Empire":    {"name_local": "Angevin", "name_en": "Angevin Empire", "palette": "British"},
    "Castille":          {"name_local": "Castilla", "name_en": "Castile", "palette": "Spanish_Port"},
    "Castile":           {"name_local": "Castilla", "name_en": "Castile", "palette": "Spanish_Port"},
    "Castilla":          {"name_local": "Castilla", "name_en": "Castile", "palette": "Spanish_Port"},
    "Aragón":            {"name_local": "Aragón", "name_en": "Aragon", "palette": "Spanish_Port"},
    "León":              {"name_local": "León", "name_en": "Leon", "palette": "Spanish_Port"},
    "Navarre":           {"name_local": "Navarra", "name_en": "Navarre", "palette": "Spanish_Port"},
    "Asturias":          {"name_local": "Asturias", "name_en": "Asturias", "palette": "Spanish_Port"},
    "Sardinia":          {"name_local": "Sardegna", "name_en": "Sardinia", "palette": "Roman_Italy"},
    "Sicily":            {"name_local": "Sicilia", "name_en": "Sicily", "palette": "Roman_Italy"},
    "Corsica":           {"name_local": "Corse", "name_en": "Corsica", "palette": "French"},
    "Bulgar Khanate":    {"name_local": "България", "name_en": "Bulgarian Khanate", "palette": "EastEurope"},
    "Bulgars":           {"name_local": "България", "name_en": "Bulgars", "palette": "EastEurope"},
    "Avars":             {"name_local": "Avars", "name_en": "Avars", "palette": "Mongol"},
    "Magyars":           {"name_local": "Magyarok", "name_en": "Magyars", "palette": "EastEurope"},
    "Khazars":           {"name_local": "Хазар", "name_en": "Khazars", "palette": "Mongol"},
    "Volga Bulgars":     {"name_local": "Волжская Булгария", "name_en": "Volga Bulgars", "palette": "Russian"},
    "Rus' Khaganate":    {"name_local": "Русь", "name_en": "Kievan Rus", "palette": "Russian"},
    "Principality of Kyiv": {"name_local": "Київ", "name_en": "Principality of Kyiv", "palette": "Russian"},
    "Principality of Novgorod": {"name_local": "Новгород", "name_en": "Principality of Novgorod", "palette": "Russian"},
    "Principality of Vladimir-Suzdal": {"name_local": "Владимир", "name_en": "Principality of Vladimir", "palette": "Russian"},
    "Principality of Galicia-Volhynia": {"name_local": "Галич", "name_en": "Principality of Galicia", "palette": "Russian"},
    "Other Rus Principalities": {"name_local": "Русь", "name_en": "Rus Principalities", "palette": "Russian"},
    "Grand Duchy of Moscow": {"name_local": "Москва", "name_en": "Grand Duchy of Moscow", "palette": "Russian"},
    "Novgorod-Seversky": {"name_local": "Новгород-Сіверський", "name_en": "Novgorod-Seversky", "palette": "Russian"},
    "Pskov":             {"name_local": "Псков", "name_en": "Pskov", "palette": "Russian"},
    "Ryazan":            {"name_local": "Рязань", "name_en": "Ryazan", "palette": "Russian"},
    "Northmen":          {"name_local": "Norrman", "name_en": "Norsemen", "palette": "Nordic"},
    "Danes":             {"name_local": "Dansk", "name_en": "Danes", "palette": "Nordic"},
    "Swedes and Goths":  {"name_local": "Sverige", "name_en": "Sweden", "palette": "Nordic"},
    "Danish kingdoms":   {"name_local": "Danmark", "name_en": "Danish Kingdoms", "palette": "Nordic"},
    "Denmark-Norway":    {"name_local": "Danmark-Norge", "name_en": "Denmark-Norway", "palette": "Nordic"},
    "Kalmar Union":      {"name_local": "Kalmarunionen", "name_en": "Kalmar Union", "palette": "Nordic"},
    "Polish-Lithuanian Commonwealth": {"name_local": "Rzeczpospolita", "name_en": "Polish-Lithuanian Commonwealth", "palette": "EastEurope"},
    "Poland-Lithuania":  {"name_local": "Rzeczpospolita", "name_en": "Poland-Lithuania", "palette": "EastEurope"},
    "Prussia":           {"name_local": "Preußen", "name_en": "Prussia", "palette": "Germanic"},
    "Austrian Empire":   {"name_local": "Österreich", "name_en": "Austrian Empire", "palette": "Germanic"},
    "Austrian Netherlands": {"name_local": "Pays-Bas autrichiens", "name_en": "Austrian Netherlands", "palette": "Germanic"},
    "Habsburg Netherlands": {"name_local": "Habsburg Nederland", "name_en": "Habsburg Netherlands", "palette": "Germanic"},
    "Dutch Republic":    {"name_local": "Republiek", "name_en": "Dutch Republic", "palette": "Nordic"},
    "Swiss Confederation": {"name_local": "Schweiz", "name_en": "Swiss Confederation", "palette": "Nordic"},
    "Teutonic Knights":  {"name_local": "Deutscher Orden", "name_en": "Teutonic Knights", "palette": "Germanic"},
    "Imperial Hungary":  {"name_local": "Magyarország", "name_en": "Imperial Hungary", "palette": "Germanic"},
    "Kingdom of Hungary": {"name_local": "Magyarország", "name_en": "Kingdom of Hungary", "palette": "EastEurope"},
    "Kingdom of Ireland": {"name_local": "Éire", "name_en": "Kingdom of Ireland", "palette": "British"},
    "Croatian kingdom":  {"name_local": "Hrvatska", "name_en": "Croatian Kingdom", "palette": "EastEurope"},
    "Lombard duchies":   {"name_local": "Longobardi", "name_en": "Lombard Duchies", "palette": "Germanic"},

    # ━━━ 유럽: 주요 열강 ━━━
    "United Kingdom":    {"name_local": "United Kingdom", "name_en": "United Kingdom", "palette": "British"},
    "United Kingdom of Great Britain and Ireland": {"name_local": "United Kingdom", "name_en": "United Kingdom", "palette": "British"},
    "France":            {"name_local": "France", "name_en": "France", "palette": "French"},
    "Germany":           {"name_local": "Deutschland", "name_en": "Germany", "palette": "Germanic"},
    "German Empire":     {"name_local": "Deutsches Reich", "name_en": "German Empire", "palette": "Germanic"},
    "East Germany":      {"name_local": "DDR", "name_en": "East Germany", "palette": "Germanic"},
    "West Germany":      {"name_local": "BRD", "name_en": "West Germany", "palette": "Germanic"},
    "East Prussia":      {"name_local": "Ostpreußen", "name_en": "East Prussia", "palette": "Germanic"},
    "Danzig":            {"name_local": "Gdańsk", "name_en": "Free City of Danzig", "palette": "Germanic"},
    "Austria":           {"name_local": "Österreich", "name_en": "Austria", "palette": "Germanic"},
    "Austria Hungary":   {"name_local": "Österreich-Ungarn", "name_en": "Austria-Hungary", "palette": "Germanic"},
    "Austria-Hungary":   {"name_local": "Österreich-Ungarn", "name_en": "Austria-Hungary", "palette": "Germanic"},
    "Austro-Hungarian Empire": {"name_local": "Österreich-Ungarn", "name_en": "Austria-Hungary", "palette": "Germanic"},
    "Germany (Prussia)": {"name_local": "Preußen", "name_en": "German Empire (Prussia)", "palette": "Germanic"},
    "Russia":            {"name_local": "Россия", "name_en": "Russia", "palette": "Russian"},
    "Russian Empire":    {"name_local": "Российская империя", "name_en": "Russian Empire", "palette": "Russian"},
    "USSR":              {"name_local": "СССР", "name_en": "Soviet Union", "palette": "Russian"},
    "Italy":             {"name_local": "Italia", "name_en": "Italy", "palette": "Roman_Italy"},
    "Kingfom of Italy":  {"name_local": "Italia", "name_en": "Kingdom of Italy", "palette": "Roman_Italy"},
    "Spain":             {"name_local": "España", "name_en": "Spain", "palette": "Spanish_Port"},
    "Portugal":          {"name_local": "Portugal", "name_en": "Portugal", "palette": "Spanish_Port"},

    # ━━━ 유럽: 기타 ━━━
    "Netherlands":       {"name_local": "Nederland", "name_en": "Netherlands", "palette": "Nordic"},
    "Belgium":           {"name_local": "België", "name_en": "Belgium", "palette": "Nordic"},
    "Luxembourg":        {"name_local": "Luxembourg", "name_en": "Luxembourg", "palette": "Nordic"},
    "Switzerland":       {"name_local": "Schweiz", "name_en": "Switzerland", "palette": "Nordic"},
    "Sweden":            {"name_local": "Sverige", "name_en": "Sweden", "palette": "Nordic"},
    "Sweden–Norway":     {"name_local": "Sverige-Norge", "name_en": "Sweden-Norway", "palette": "Nordic"},
    "Norway":            {"name_local": "Norge", "name_en": "Norway", "palette": "Nordic"},
    "Denmark":           {"name_local": "Danmark", "name_en": "Denmark", "palette": "Nordic"},
    "Iceland":           {"name_local": "Ísland", "name_en": "Iceland", "palette": "Nordic"},
    "Finland":           {"name_local": "Suomi", "name_en": "Finland", "palette": "Nordic"},
    "Ireland":           {"name_local": "Éire", "name_en": "Ireland", "palette": "Nordic"},
    "Greece":            {"name_local": "Ελλάδα", "name_en": "Greece", "palette": "Greek"},
    "Poland":            {"name_local": "Polska", "name_en": "Poland", "palette": "EastEurope"},
    "Hungary":           {"name_local": "Magyarország", "name_en": "Hungary", "palette": "EastEurope"},
    "Romania":           {"name_local": "România", "name_en": "Romania", "palette": "EastEurope"},
    "Rumania":           {"name_local": "România", "name_en": "Romania", "palette": "EastEurope"},
    "Bulgaria":          {"name_local": "България", "name_en": "Bulgaria", "palette": "EastEurope"},
    "Serbia":            {"name_local": "Србија", "name_en": "Serbia", "palette": "EastEurope"},
    "Montenegro":        {"name_local": "Crna Gora", "name_en": "Montenegro", "palette": "EastEurope"},
    "Albania":           {"name_local": "Shqipëria", "name_en": "Albania", "palette": "EastEurope"},
    "Croatia":           {"name_local": "Hrvatska", "name_en": "Croatia", "palette": "EastEurope"},
    "Slovenia":          {"name_local": "Slovenija", "name_en": "Slovenia", "palette": "EastEurope"},
    "Bosnia and Herzegovina": {"name_local": "Bosna i Hercegovina", "name_en": "Bosnia and Herzegovina", "palette": "EastEurope"},
    "Bosnia-Herzegovina":{"name_local": "Bosna i Hercegovina", "name_en": "Bosnia-Herzegovina", "palette": "EastEurope"},
    "Yugoslavia":        {"name_local": "Jugoslavija", "name_en": "Yugoslavia", "palette": "EastEurope"},
    "Czechoslovakia":    {"name_local": "Československo", "name_en": "Czechoslovakia", "palette": "EastEurope"},
    "Czech Republic":    {"name_local": "Česko", "name_en": "Czech Republic", "palette": "EastEurope"},
    "Slovakia":          {"name_local": "Slovensko", "name_en": "Slovakia", "palette": "EastEurope"},
    "Estonia":           {"name_local": "Eesti", "name_en": "Estonia", "palette": "EastEurope"},
    "Latvia":            {"name_local": "Latvija", "name_en": "Latvia", "palette": "EastEurope"},
    "Lithuania":         {"name_local": "Lietuva", "name_en": "Lithuania", "palette": "EastEurope"},
    "Moldova":           {"name_local": "Moldova", "name_en": "Moldova", "palette": "EastEurope"},
    "Ukraine":           {"name_local": "Україна", "name_en": "Ukraine", "palette": "EastEurope"},
    "Byelarus":          {"name_local": "Беларусь", "name_en": "Belarus", "palette": "Nordic"},
    "White Russia":      {"name_local": "Беларусь", "name_en": "Belarus (SSR)", "palette": "Russian"},
    "Georgia":           {"name_local": "საქართველო", "name_en": "Georgia", "palette": "EastEurope"},
    "Armenia":           {"name_local": "Հայաստան", "name_en": "Armenia", "palette": "EastEurope"},
    "Azerbaijan":        {"name_local": "Azərbaycan", "name_en": "Azerbaijan", "palette": "EastEurope"},
    "Kazakhstan":        {"name_local": "Қазақстан", "name_en": "Kazakhstan", "palette": "Islamic_Turk"},
    "Uzbekistan":        {"name_local": "Oʻzbekiston", "name_en": "Uzbekistan", "palette": "Islamic_Turk"},
    "Turkmenistan":      {"name_local": "Türkmenistan", "name_en": "Turkmenistan", "palette": "Islamic_Turk"},
    "Kyrgyzstan":        {"name_local": "Кыргызстан", "name_en": "Kyrgyzstan", "palette": "Islamic_Turk"},
    "Tajikistan":        {"name_local": "Тоҷикистон", "name_en": "Tajikistan", "palette": "Islamic_Turk"},
    "Far Eastern SSR":   {"name_local": "ДВР", "name_en": "Far Eastern Republic", "palette": "Russian"},
    "South Russia":      {"name_local": "Россия", "name_en": "South Russia", "palette": "Russian"},
    "Andorra":           {"name_local": "Andorra", "name_en": "Andorra", "palette": "Nordic"},
    "Liechtenstein":     {"name_local": "Liechtenstein", "name_en": "Liechtenstein", "palette": "Nordic"},
    "Malta":             {"name_local": "Malta", "name_en": "Malta", "palette": "Nordic"},
    "Macedonia":         {"name_local": "Македонија", "name_en": "North Macedonia", "palette": "Nordic"},
    "Cyprus":            {"name_local": "Κύπρος", "name_en": "Cyprus", "palette": "Greek"},
    "Turkish Cypriot-administered area": {"name_local": "Kuzey Kıbrıs", "name_en": "Northern Cyprus", "palette": "Islamic_Arab"},
    "Greenland":         {"name_local": "Kalaallit Nunaat", "name_en": "Greenland", "palette": "Nordic"},
    "Saar Protectorate": {"name_local": "Saarland", "name_en": "Saar Protectorate", "colony": True, "ruler": "France", "palette": "French"},
    "Dominion of Newfoundland": {"name_local": "Newfoundland", "name_en": "Newfoundland", "palette": "British"},
    "Germany (France)":  {"name_local": "Deutschland", "name_en": "Germany (French Zone)", "colony": True, "ruler": "France", "palette": "Germanic"},
    "Germany (Soviet)":  {"name_local": "Deutschland", "name_en": "Germany (Soviet Zone)", "colony": True, "ruler": "USSR", "palette": "Germanic"},
    "Germany (UK)":      {"name_local": "Deutschland", "name_en": "Germany (British Zone)", "colony": True, "ruler": "British Empire", "palette": "Germanic"},
    "Germany (USA)":     {"name_local": "Deutschland", "name_en": "Germany (US Zone)", "colony": True, "ruler": "United States", "palette": "Germanic"},

    # [cl] 아메리카 고대 문명
    "Aztec Empire":         {"name_local": "Azteca", "name_en": "Aztec Empire", "palette": "LatinAmerica"},
    "Inca Empire":          {"name_local": "Tawantinsuyu", "name_en": "Inca Empire", "palette": "LatinAmerica"},
    "Maya city-states":     {"name_local": "Maya", "name_en": "Maya City-States", "palette": "LatinAmerica"},
    "Maya chiefdoms and states": {"name_local": "Maya", "name_en": "Maya States", "palette": "LatinAmerica"},
    "Maya states":          {"name_local": "Maya", "name_en": "Maya States", "palette": "LatinAmerica"},
    "Maya":                 {"name_local": "Maya", "name_en": "Maya", "palette": "LatinAmerica"},
    "Mayas":                {"name_local": "Maya", "name_en": "Maya", "palette": "LatinAmerica"},
    "Olmec":                {"name_local": "Olmeca", "name_en": "Olmec", "palette": "LatinAmerica"},
    "Toltec Empire":        {"name_local": "Tolteca", "name_en": "Toltec Empire", "palette": "LatinAmerica"},
    "Chimú Empire":         {"name_local": "Chimú", "name_en": "Chimu Empire", "palette": "LatinAmerica"},
    "Huari Empire":         {"name_local": "Wari", "name_en": "Wari Empire", "palette": "LatinAmerica"},
    "Tiahuanaco Empire":    {"name_local": "Tiwanaku", "name_en": "Tiwanaku Empire", "palette": "LatinAmerica"},
    "Nazca":                {"name_local": "Nazca", "name_en": "Nazca", "palette": "LatinAmerica"},
    "Moche":                {"name_local": "Moche", "name_en": "Moche", "palette": "LatinAmerica"},
    "Teotihuacán":          {"name_local": "Teotihuacán", "name_en": "Teotihuacan", "palette": "LatinAmerica"},
    "Monte Albán":          {"name_local": "Monte Albán", "name_en": "Monte Alban", "palette": "LatinAmerica"},
    "Mixtec Empire":        {"name_local": "Mixteca", "name_en": "Mixtec Empire", "palette": "LatinAmerica"},
    "Mixtecs":              {"name_local": "Mixteca", "name_en": "Mixtecs", "palette": "LatinAmerica"},
    "Mesoamerican city-states and chiefdoms": {"name_local": "Mesoamérica", "name_en": "Mesoamerican States", "palette": "LatinAmerica"},
    "Kingdom of Brazil":    {"name_local": "Brasil", "name_en": "Empire of Brazil", "palette": "LatinAmerica"},
    "Tuʻi Tonga Empire":   {"name_local": "Tuʻi Tonga", "name_en": "Tongan Empire", "palette": "Oceania"},
    # [cl] 아프리카 고대/중세 왕국
    "Songhai":              {"name_local": "Songhai", "name_en": "Songhai", "palette": "Africa_West"},
    "Empire of Ghana":      {"name_local": "Ghana", "name_en": "Ghana Empire", "palette": "Africa_West"},
    "Great Zimbabwe":       {"name_local": "Zimbabwe", "name_en": "Great Zimbabwe", "palette": "Africa_East"},
    "Kanem":                {"name_local": "Kanem", "name_en": "Kanem", "palette": "Africa_West"},
    "Bornu-Kanem":          {"name_local": "Bornu-Kanem", "name_en": "Bornu-Kanem", "palette": "Africa_West"},
    "Hausa States":         {"name_local": "Hausa", "name_en": "Hausa States", "palette": "Africa_West"},
    "Bantou":               {"name_local": "Bantu", "name_en": "Bantu", "palette": "Africa_West"},
    "Alwa":                 {"name_local": "Alwa", "name_en": "Alwa", "palette": "Africa_East"},
    "Makkura":              {"name_local": "Makuria", "name_en": "Makuria", "palette": "Africa_East"},
    "Expansionist Kingdom of Merina": {"name_local": "Merina", "name_en": "Kingdom of Merina", "palette": "Africa_East"},
    "Khoiasan":             {"name_local": "Khoisan", "name_en": "Khoisan", "palette": "Africa_East"},
    "Guanches":             {"name_local": "Guanche", "name_en": "Guanches", "palette": "Africa_West"},
    # [cl] 아프리카 중요 미매핑 보완
    "Islamic city-states":  {"name_local": "مدن إسلامية", "name_en": "Islamic City-States", "palette": "Islamic_Arab"},
    "Wadai":                {"name_local": "Wadai", "name_en": "Wadai Sultanate", "palette": "Africa_West"},
    "Darfur":               {"name_local": "Darfur", "name_en": "Darfur Sultanate", "palette": "Africa_West"},
    "Algiers":              {"name_local": "الجزائر", "name_en": "Regency of Algiers", "palette": "Islamic_Arab"},
    "Tunis":                {"name_local": "تونس", "name_en": "Regency of Tunis", "palette": "Islamic_Arab"},
    "Funj":                 {"name_local": "Funj", "name_en": "Funj Sultanate", "palette": "Africa_East"},
    "Akan":                 {"name_local": "Akan", "name_en": "Akan States", "palette": "Africa_West"},
    "Rozwi":                {"name_local": "Rozwi", "name_en": "Rozwi Empire", "palette": "Africa_East"},
    "Bagirmi":              {"name_local": "Bagirmi", "name_en": "Bagirmi Sultanate", "palette": "Africa_West"},
    "Oromo":                {"name_local": "Oromo", "name_en": "Oromo", "palette": "Africa_East"},

    # ━━━ 아메리카 ━━━
    "United States":        {"name_local": "United States", "name_en": "United States", "palette": "US"},
    "United States of America": {"name_local": "United States", "name_en": "United States", "palette": "US"},
    "United States Virgin Islands": {"name_local": "US Virgin Islands", "name_en": "US Virgin Islands", "palette": "US"},
    "Canada":               {"name_local": "Canada", "name_en": "Canada", "palette": "US"},
    "Puerto Rico":          {"name_local": "Puerto Rico", "name_en": "Puerto Rico", "colony": True, "ruler": "United States", "palette": "US"},
    "Guam":                 {"name_local": "Guam", "name_en": "Guam", "colony": True, "ruler": "United States", "palette": "US"},
    "Mexico":               {"name_local": "México", "name_en": "Mexico", "palette": "LatinAmerica"},
    "Guatemala":            {"name_local": "Guatemala", "name_en": "Guatemala", "palette": "LatinAmerica"},
    "Honduras":             {"name_local": "Honduras", "name_en": "Honduras", "palette": "LatinAmerica"},
    "El Salvador":          {"name_local": "El Salvador", "name_en": "El Salvador", "palette": "LatinAmerica"},
    "Nicaragua":            {"name_local": "Nicaragua", "name_en": "Nicaragua", "palette": "LatinAmerica"},
    "Costa Rica":           {"name_local": "Costa Rica", "name_en": "Costa Rica", "palette": "LatinAmerica"},
    "Panama":               {"name_local": "Panamá", "name_en": "Panama", "palette": "LatinAmerica"},
    "Cuba":                 {"name_local": "Cuba", "name_en": "Cuba", "palette": "LatinAmerica"},
    "Haiti":                {"name_local": "Haïti", "name_en": "Haiti", "palette": "LatinAmerica"},
    "Dominican Republic":   {"name_local": "República Dominicana", "name_en": "Dominican Republic", "palette": "LatinAmerica"},
    "Jamaica":              {"name_local": "Jamaica", "name_en": "Jamaica", "palette": "LatinAmerica"},
    "Jamaica (UK)":         {"name_local": "Jamaica", "name_en": "Jamaica", "colony": True, "ruler": "British Empire", "palette": "LatinAmerica"},
    "Colombia":             {"name_local": "Colombia", "name_en": "Colombia", "palette": "LatinAmerica"},
    "Venezuela":            {"name_local": "Venezuela", "name_en": "Venezuela", "palette": "LatinAmerica"},
    "Ecuador":              {"name_local": "Ecuador", "name_en": "Ecuador", "palette": "LatinAmerica"},
    "Peru":                 {"name_local": "Perú", "name_en": "Peru", "palette": "LatinAmerica"},
    "Bolivia":              {"name_local": "Bolivia", "name_en": "Bolivia", "palette": "LatinAmerica"},
    "Brazil":               {"name_local": "Brasil", "name_en": "Brazil", "palette": "LatinAmerica"},
    "Kingdom of Brazil":    {"name_local": "Brasil", "name_en": "Empire of Brazil", "palette": "LatinAmerica"},
    "Argentina":            {"name_local": "Argentina", "name_en": "Argentina", "palette": "LatinAmerica"},
    "Uruguay":              {"name_local": "Uruguay", "name_en": "Uruguay", "palette": "LatinAmerica"},
    "Paraguay":             {"name_local": "Paraguay", "name_en": "Paraguay", "palette": "LatinAmerica"},
    "Chile":                {"name_local": "Chile", "name_en": "Chile", "palette": "LatinAmerica"},
    "Belize":               {"name_local": "Belize", "name_en": "Belize", "colony": True, "ruler": "British Empire", "palette": "LatinAmerica"},
    "Guyana":               {"name_local": "Guyana", "name_en": "Guyana", "palette": "LatinAmerica"},
    "British Guiana":       {"name_local": "Guyana", "name_en": "Guyana (1966)", "colony": True, "ruler": "British Empire", "independence": 1966, "palette": "LatinAmerica"},
    "Dutch Guiana":         {"name_local": "Suriname", "name_en": "Suriname (1975)", "colony": True, "ruler": "Netherlands", "independence": 1975, "palette": "LatinAmerica"},
    "Dutch Guinea":         {"name_local": "Suriname", "name_en": "Suriname", "colony": True, "ruler": "Netherlands", "palette": "LatinAmerica"},
    "Suriname":             {"name_local": "Suriname", "name_en": "Suriname", "palette": "LatinAmerica"},
    "French Guiana":        {"name_local": "Guyane", "name_en": "French Guiana", "colony": True, "ruler": "France", "palette": "French"},
    "French Guyana":        {"name_local": "Guyane", "name_en": "French Guiana", "colony": True, "ruler": "France", "palette": "French"},
    "Trinidad":             {"name_local": "Trinidad and Tobago", "name_en": "Trinidad and Tobago", "colony": True, "ruler": "British Empire", "palette": "LatinAmerica"},

    # ━━━ 카리브해 소도서 ━━━
    "Anguilla":             {"name_local": "Anguilla", "name_en": "Anguilla", "colony": True, "ruler": "British Empire", "palette": "British"},
    "Antigua and Barbuda":  {"name_local": "Antigua and Barbuda", "name_en": "Antigua and Barbuda", "palette": "British"},
    "Barbados":             {"name_local": "Barbados", "name_en": "Barbados", "palette": "British"},
    "Bahamas":              {"name_local": "Bahamas", "name_en": "Bahamas", "palette": "British"},
    "Dominica":             {"name_local": "Dominica", "name_en": "Dominica", "palette": "British"},
    "Grenada":              {"name_local": "Grenada", "name_en": "Grenada", "palette": "British"},
    "Guadeloupe":           {"name_local": "Guadeloupe", "name_en": "Guadeloupe", "colony": True, "ruler": "France", "palette": "French"},
    "Martinique":           {"name_local": "Martinique", "name_en": "Martinique", "colony": True, "ruler": "France", "palette": "French"},
    "Martinique (France)":  {"name_local": "Martinique", "name_en": "Martinique", "colony": True, "ruler": "France", "palette": "French"},
    "Montserrat":           {"name_local": "Montserrat", "name_en": "Montserrat", "colony": True, "ruler": "British Empire", "palette": "British"},
    "Saint Barthelemy":     {"name_local": "Saint-Barthélemy", "name_en": "Saint Barthélemy", "palette": "French"},
    "Saint Kitts and Nevis":{"name_local": "Saint Kitts and Nevis", "name_en": "Saint Kitts and Nevis", "palette": "British"},
    "Saint Lucia":          {"name_local": "Saint Lucia", "name_en": "Saint Lucia", "palette": "British"},
    "Saint Martin":         {"name_local": "Saint-Martin", "name_en": "Saint Martin", "palette": "French"},
    "Saint Vincent and the Grenadines": {"name_local": "Saint Vincent", "name_en": "Saint Vincent and the Grenadines", "palette": "British"},
    "Netherlands Antilles": {"name_local": "Nederlandse Antillen", "name_en": "Netherlands Antilles", "palette": "Nordic"},
    "Turks and Caicos Islands": {"name_local": "Turks and Caicos", "name_en": "Turks and Caicos", "colony": True, "ruler": "British Empire", "palette": "British"},
    "Wallis and Futuna Islands": {"name_local": "Wallis-et-Futuna", "name_en": "Wallis and Futuna", "colony": True, "ruler": "France", "palette": "French"},

    # ━━━ 아프리카: 북부 ━━━
    "Algeria":              {"name_local": "الجزائر", "name_en": "Algeria", "colony": True, "ruler": "France", "palette": "Islamic_Arab"},
    "Algeria (FR)":         {"name_local": "الجزائر", "name_en": "Algeria", "colony": True, "ruler": "France", "palette": "Islamic_Arab"},
    "Algeria (France)":     {"name_local": "الجزائر", "name_en": "Algeria", "colony": True, "ruler": "France", "palette": "Islamic_Arab"},
    "Morocco":              {"name_local": "المغرب", "name_en": "Morocco", "palette": "Islamic_Arab"},
    "Morocco (France)":     {"name_local": "المغرب", "name_en": "Morocco", "colony": True, "ruler": "France", "palette": "Islamic_Arab"},
    "Spanish Morocco":      {"name_local": "المغرب", "name_en": "Morocco (Spanish Zone)", "colony": True, "ruler": "Spain", "palette": "Spanish_Port"},
    "Tunisia":              {"name_local": "تونس", "name_en": "Tunisia", "colony": True, "ruler": "France", "palette": "Islamic_Arab"},
    "Libya":                {"name_local": "ليبيا", "name_en": "Libya", "palette": "Islamic_Arab"},
    "Libya (IT)":           {"name_local": "ليبيا", "name_en": "Libya", "colony": True, "ruler": "Italy", "palette": "Islamic_Arab"},
    "Cyraneica (UK Lybia)": {"name_local": "ليبيا", "name_en": "Libya (Cyrenaica)", "colony": True, "ruler": "British Empire", "palette": "Islamic_Arab"},
    "Tripolitana (UK Lybia)":{"name_local": "ليبيا", "name_en": "Libya (Tripolitania)", "colony": True, "ruler": "British Empire", "palette": "Islamic_Arab"},
    "Fezzan (Frech Lybia)": {"name_local": "ليبيا", "name_en": "Libya (Fezzan)", "colony": True, "ruler": "France", "palette": "French"},
    "Rio De Oro":           {"name_local": "الصحراء الغربية", "name_en": "Western Sahara", "colony": True, "ruler": "Spain", "palette": "Spanish_Port"},
    "Western Sahara":       {"name_local": "الصحراء الغربية", "name_en": "Western Sahara", "palette": "Islamic_Arab"},
    "Spanish Sahara":       {"name_local": "الصحراء الغربية", "name_en": "Western Sahara", "colony": True, "ruler": "Spain", "palette": "Spanish_Port"},
    "Sudan":                {"name_local": "السودان", "name_en": "Sudan", "palette": "Africa_East"},
    "Anglo-Egyption Sudan": {"name_local": "السودان", "name_en": "Sudan", "colony": True, "ruler": "British Empire", "palette": "Africa_East"},

    # ━━━ 아프리카: 동부 ━━━
    "Ethiopia":             {"name_local": "ኢትዮጵያ", "name_en": "Ethiopia", "palette": "Africa_East"},
    "Abyssinia":            {"name_local": "ኢትዮጵያ", "name_en": "Ethiopia (Abyssinia)", "palette": "Africa_East"},
    "Ethiopia (Italy)":     {"name_local": "ኢትዮጵያ", "name_en": "Ethiopia", "colony": True, "ruler": "Italy", "palette": "Africa_East"},
    "Eritrea":              {"name_local": "ኤርትራ", "name_en": "Eritrea", "colony": True, "ruler": "Italy", "palette": "Africa_East"},
    "Eritrea (Italy)":      {"name_local": "ኤርትራ", "name_en": "Eritrea", "colony": True, "ruler": "Italy", "palette": "Africa_East"},
    "Somalia":              {"name_local": "Soomaaliya", "name_en": "Somalia", "palette": "Africa_East"},
    "British Somaliland":   {"name_local": "Soomaaliya", "name_en": "Somalia (1960)", "colony": True, "ruler": "British Empire", "independence": 1960, "palette": "Africa_East"},
    "Italian Somaliland":   {"name_local": "Soomaaliya", "name_en": "Somalia (1960)", "colony": True, "ruler": "Italy", "independence": 1960, "palette": "Africa_East"},
    "French Somaliland":    {"name_local": "Djibouti", "name_en": "Djibouti (1977)", "colony": True, "ruler": "France", "independence": 1977, "palette": "Africa_East"},
    "Djibouti":             {"name_local": "Djibouti", "name_en": "Djibouti", "palette": "Africa_East"},
    "Kenya":                {"name_local": "Kenya", "name_en": "Kenya", "palette": "Africa_East"},
    "British East Africa":  {"name_local": "Kenya", "name_en": "Kenya (1963)", "colony": True, "ruler": "British Empire", "independence": 1963, "palette": "Africa_East"},
    "Uganda":               {"name_local": "Uganda", "name_en": "Uganda", "palette": "Africa_East"},
    "Tanzania, United Republic of": {"name_local": "Tanzania", "name_en": "Tanzania", "palette": "Africa_East"},
    "German E. Africa (Tanganyika)": {"name_local": "Tanzania", "name_en": "Tanzania (1961)", "colony": True, "ruler": "Germany", "independence": 1961, "palette": "Africa_East"},
    "Rwanda":               {"name_local": "Rwanda", "name_en": "Rwanda", "palette": "Africa_East"},
    "Rwanda (Belgium)":     {"name_local": "Rwanda", "name_en": "Rwanda", "colony": True, "ruler": "Belgium", "palette": "Africa_East"},
    "Burundi":              {"name_local": "Burundi", "name_en": "Burundi", "palette": "Africa_East"},
    "Madagascar":           {"name_local": "Madagasikara", "name_en": "Madagascar", "palette": "Africa_East"},
    "Madagascar (France)":  {"name_local": "Madagasikara", "name_en": "Madagascar", "colony": True, "ruler": "France", "palette": "Africa_East"},
    "Imerina":              {"name_local": "Madagasikara", "name_en": "Madagascar (Merina)", "palette": "Africa_East"},

    # ━━━ 아프리카: 서부 ━━━
    "Nigeria":              {"name_local": "Nigeria", "name_en": "Nigeria", "palette": "Africa_West"},
    "Ghana":                {"name_local": "Ghana", "name_en": "Ghana", "palette": "Africa_West"},
    "Gold Coast":           {"name_local": "Ghana", "name_en": "Ghana (1957)", "colony": True, "ruler": "British Empire", "independence": 1957, "palette": "Africa_West"},
    "Gold Coast (GB)":      {"name_local": "Ghana", "name_en": "Ghana (1957)", "colony": True, "ruler": "British Empire", "independence": 1957, "palette": "Africa_West"},
    "Sierra Leone":         {"name_local": "Sierra Leone", "name_en": "Sierra Leone", "palette": "Africa_West"},
    "Liberia":              {"name_local": "Liberia", "name_en": "Liberia", "palette": "Africa_West"},
    "Senegal":              {"name_local": "Sénégal", "name_en": "Senegal", "palette": "Africa_West"},
    "Senegal (FR)":         {"name_local": "Sénégal", "name_en": "Senegal", "colony": True, "ruler": "France", "palette": "Africa_West"},
    "Gambia":               {"name_local": "Gambia", "name_en": "Gambia", "palette": "Africa_West"},
    "Gambia, The":          {"name_local": "Gambia", "name_en": "Gambia", "palette": "Africa_West"},
    "Guinea":               {"name_local": "Guinée", "name_en": "Guinea", "palette": "Africa_West"},
    "Guinea-Bissau":        {"name_local": "Guiné-Bissau", "name_en": "Guinea-Bissau", "palette": "Africa_West"},
    "Guinea-Bissau (Portugal)": {"name_local": "Guiné-Bissau", "name_en": "Guinea-Bissau", "colony": True, "ruler": "Portugal", "palette": "Africa_West"},
    "Portuguese Guinea":    {"name_local": "Guiné-Bissau", "name_en": "Guinea-Bissau (1974)", "colony": True, "ruler": "Portugal", "independence": 1974, "palette": "Africa_West"},
    "Portuguese East Africa":{"name_local": "Moçambique", "name_en": "Mozambique (1975)", "colony": True, "ruler": "Portugal", "independence": 1975, "palette": "Africa_East"},
    "Ivory Coast":          {"name_local": "Côte d'Ivoire", "name_en": "Côte d'Ivoire", "palette": "Africa_West"},
    "Burkina Faso":         {"name_local": "Burkina Faso", "name_en": "Burkina Faso", "palette": "Africa_West"},
    "Mali":                 {"name_local": "Mali", "name_en": "Mali", "palette": "Africa_West"},
    "Niger":                {"name_local": "Niger", "name_en": "Niger", "palette": "Africa_West"},
    "Chad":                 {"name_local": "Tchad", "name_en": "Chad", "palette": "Africa_West"},
    "Mauritania":           {"name_local": "موريتانيا", "name_en": "Mauritania", "palette": "Africa_West"},
    "Benin":                {"name_local": "Bénin", "name_en": "Benin", "palette": "Africa_West"},
    "Dahomey":              {"name_local": "Bénin", "name_en": "Benin (Dahomey)", "palette": "Africa_West"},
    "Togo":                 {"name_local": "Togo", "name_en": "Togo", "palette": "Africa_West"},
    "Togoland":             {"name_local": "Togo", "name_en": "Togo (Togoland)", "colony": True, "ruler": "Germany", "palette": "Africa_West"},
    "Cameroon":             {"name_local": "Cameroun", "name_en": "Cameroon", "palette": "Africa_West"},
    "Kamerun":              {"name_local": "Cameroun", "name_en": "Cameroon (Kamerun)", "colony": True, "ruler": "Germany", "palette": "Africa_West"},
    "French Cameroons":     {"name_local": "Cameroun", "name_en": "Cameroon", "colony": True, "ruler": "France", "palette": "Africa_West"},
    "Southern Cameroon":    {"name_local": "Cameroun", "name_en": "Cameroon (Southern)", "colony": True, "ruler": "British Empire", "palette": "Africa_West"},
    "Gabon":                {"name_local": "Gabon", "name_en": "Gabon", "palette": "Africa_West"},
    "Equatorial Guinea":    {"name_local": "Guinea Ecuatorial", "name_en": "Equatorial Guinea", "palette": "Africa_West"},
    "Spanish Guinea":       {"name_local": "Guinea Ecuatorial", "name_en": "Equatorial Guinea", "colony": True, "ruler": "Spain", "palette": "Africa_West"},
    "Central African Republic": {"name_local": "Centrafrique", "name_en": "Central African Republic", "palette": "Africa_West"},
    "Congo":                {"name_local": "Congo", "name_en": "Congo", "palette": "Africa_West"},
    "Congo (France)":       {"name_local": "Congo", "name_en": "Congo (French)", "colony": True, "ruler": "France", "palette": "Africa_West"},
    "Belgian Congo":        {"name_local": "Congo", "name_en": "DR Congo (1960)", "colony": True, "ruler": "Belgium", "independence": 1960, "palette": "Africa_West"},
    "Zaire":                {"name_local": "Congo", "name_en": "DR Congo", "palette": "Africa_West"},
    "Zaire (Belgium)":      {"name_local": "Congo", "name_en": "DR Congo (1960)", "colony": True, "ruler": "Belgium", "independence": 1960, "palette": "Africa_West"},
    "French West Africa":   {"name_local": "AOF", "name_en": "French West Africa", "colony": True, "ruler": "France", "palette": "French"},
    "French Equatorial Africa": {"name_local": "AEF", "name_en": "French Equatorial Africa", "colony": True, "ruler": "France", "palette": "French"},

    # ━━━ 아프리카: 남부 ━━━
    "South Africa":         {"name_local": "South Africa", "name_en": "South Africa", "palette": "Africa_East"},
    "Union of South Africa":{"name_local": "South Africa", "name_en": "South Africa", "palette": "Africa_East"},
    "Cape Colony":          {"name_local": "South Africa", "name_en": "South Africa (Cape Colony)", "colony": True, "ruler": "British Empire", "palette": "Africa_East"},
    "Natal":                {"name_local": "South Africa", "name_en": "South Africa (Natal)", "colony": True, "ruler": "British Empire", "palette": "Africa_East"},
    "Transvaal":            {"name_local": "South Africa", "name_en": "South Africa (Transvaal)", "palette": "Africa_East"},
    "Orange Free State":    {"name_local": "South Africa", "name_en": "South Africa (Orange Free State)", "palette": "Africa_East"},
    "Griqualand West":      {"name_local": "South Africa", "name_en": "South Africa (Griqualand)", "colony": True, "ruler": "British Empire", "palette": "Africa_East"},
    "Namibia":              {"name_local": "Namibia", "name_en": "Namibia", "palette": "Africa_East"},
    "German South-West Africa": {"name_local": "Namibia", "name_en": "Namibia (1990)", "colony": True, "ruler": "Germany", "independence": 1990, "palette": "Africa_East"},
    "Walbis Bay":           {"name_local": "Walvis Bay", "name_en": "Walvis Bay", "colony": True, "ruler": "British Empire", "palette": "Africa_East"},
    "Botswana":             {"name_local": "Botswana", "name_en": "Botswana", "palette": "Africa_East"},
    "Basutoland":           {"name_local": "Lesotho", "name_en": "Lesotho (1966)", "colony": True, "ruler": "British Empire", "independence": 1966, "palette": "Africa_East"},
    "Lesotho":              {"name_local": "Lesotho", "name_en": "Lesotho", "palette": "Africa_East"},
    "Swaziland":            {"name_local": "eSwatini", "name_en": "Eswatini", "palette": "Africa_East"},
    "Swaziland (Eswatini)": {"name_local": "eSwatini", "name_en": "Eswatini", "palette": "Africa_East"},
    "Zimbabwe":             {"name_local": "Zimbabwe", "name_en": "Zimbabwe", "palette": "Africa_East"},
    "Rhodesia":             {"name_local": "Zimbabwe", "name_en": "Zimbabwe (Rhodesia)", "colony": True, "ruler": "British Empire", "palette": "Africa_East"},
    "Southern Rhodesia":    {"name_local": "Zimbabwe", "name_en": "Zimbabwe (Rhodesia)", "colony": True, "ruler": "British Empire", "palette": "Africa_East"},
    "Northern Rhodesia":    {"name_local": "Zambia", "name_en": "Zambia (1964)", "colony": True, "ruler": "British Empire", "independence": 1964, "palette": "Africa_East"},
    "Zambia":               {"name_local": "Zambia", "name_en": "Zambia", "palette": "Africa_East"},
    "Malawi":               {"name_local": "Malawi", "name_en": "Malawi", "palette": "Africa_East"},
    "Nyasaland":            {"name_local": "Malawi", "name_en": "Malawi (1964)", "colony": True, "ruler": "British Empire", "independence": 1964, "palette": "Africa_East"},
    "Mozambique":           {"name_local": "Moçambique", "name_en": "Mozambique", "palette": "Africa_East"},
    "Mozambique (Portugal)":{"name_local": "Moçambique", "name_en": "Mozambique", "colony": True, "ruler": "Portugal", "palette": "Africa_East"},
    "Angola":               {"name_local": "Angola", "name_en": "Angola", "palette": "Africa_East"},
    "Angola (Portugal)":    {"name_local": "Angola", "name_en": "Angola", "colony": True, "ruler": "Portugal", "palette": "Africa_East"},

    # ━━━ 아프리카: 왕국/소국 ━━━
    "Asante":       {"name_local": "Asante", "name_en": "Ashanti Empire", "palette": "Africa_West"},
    "Sokoto Caliphate": {"name_local": "Sokoto", "name_en": "Sokoto Caliphate", "palette": "Africa_West"},
    "Buganda":      {"name_local": "Buganda", "name_en": "Buganda Kingdom", "palette": "Africa_East"},
    "Bunyoro":      {"name_local": "Bunyoro", "name_en": "Bunyoro Kingdom", "palette": "Africa_East"},
    "Lozi":         {"name_local": "Lozi", "name_en": "Lozi Kingdom", "palette": "Africa_East"},
    "Luba":         {"name_local": "Luba", "name_en": "Luba Kingdom", "palette": "Africa_West"},
    "Lunda":        {"name_local": "Lunda", "name_en": "Lunda Empire", "palette": "Africa_West"},
    "Kuba":         {"name_local": "Kuba", "name_en": "Kuba Kingdom", "palette": "Africa_West"},
    "Ndebele":      {"name_local": "Ndebele", "name_en": "Ndebele Kingdom", "palette": "Africa_East"},
    "Shona":        {"name_local": "Shona", "name_en": "Shona", "palette": "Africa_East"},
    "Nguni":        {"name_local": "Nguni", "name_en": "Nguni", "palette": "Africa_East"},
    "Ngwato":       {"name_local": "Ngwato", "name_en": "Ngwato", "palette": "Africa_East"},
    "Oyo":          {"name_local": "Oyo", "name_en": "Oyo Empire", "palette": "Africa_West"},
    "Ibadan":       {"name_local": "Ibadan", "name_en": "Ibadan", "palette": "Africa_West"},
    "Lagos":        {"name_local": "Lagos", "name_en": "Lagos", "colony": True, "ruler": "British Empire", "palette": "Africa_West"},
    "Kanem-Bornu":  {"name_local": "Kanem-Bornu", "name_en": "Kanem-Bornu", "palette": "Africa_West"},
    "Mossi States": {"name_local": "Mossi", "name_en": "Mossi States", "palette": "Africa_West"},
    "Zululand":     {"name_local": "KwaZulu", "name_en": "Zululand", "palette": "Africa_East"},
    "Sultinate of Zanzibar": {"name_local": "Zanzibar", "name_en": "Zanzibar", "palette": "Africa_East"},
    "Harer (Egypt)":{"name_local": "Harar", "name_en": "Harar (Egyptian)", "colony": True, "ruler": "Egypt", "palette": "Africa_East"},
    "Teke":         {"name_local": "Teke", "name_en": "Teke Kingdom", "palette": "Africa_West"},
    "Yaka":         {"name_local": "Yaka", "name_en": "Yaka Kingdom", "palette": "Africa_West"},
    "Yeke":         {"name_local": "Yeke", "name_en": "Yeke Kingdom", "palette": "Africa_West"},
    "Mbailundu":    {"name_local": "Mbailundu", "name_en": "Mbailundu Kingdom", "palette": "Africa_East"},
    "Ovimbundu":    {"name_local": "Ovimbundu", "name_en": "Ovimbundu", "palette": "Africa_East"},
    "Calabar":      {"name_local": "Calabar", "name_en": "Calabar", "palette": "Africa_West"},
    "Opobo":        {"name_local": "Opobo", "name_en": "Opobo", "palette": "Africa_West"},
    "Barotse":      {"name_local": "Barotse", "name_en": "Barotse", "palette": "Africa_East"},
    "Cotonou":      {"name_local": "Cotonou", "name_en": "Cotonou", "colony": True, "ruler": "France", "palette": "Africa_West"},
    "Borgu States": {"name_local": "Borgu", "name_en": "Borgu States", "palette": "Africa_West"},
    "Dendi Kingdom":{"name_local": "Dendi", "name_en": "Dendi Kingdom", "palette": "Africa_West"},
    "Futa Jalon":   {"name_local": "Futa Jalon", "name_en": "Futa Jalon", "palette": "Africa_West"},
    "Futa Toro":    {"name_local": "Futa Toro", "name_en": "Futa Toro", "palette": "Africa_West"},
    "Kong Empire":  {"name_local": "Kong", "name_en": "Kong Empire", "palette": "Africa_West"},
    "Kong":         {"name_local": "Kong", "name_en": "Kong", "palette": "Africa_West"},
    "First Samori Empire":  {"name_local": "Samori", "name_en": "Samori Empire", "palette": "Africa_West"},
    "Second Samori Empire": {"name_local": "Samori", "name_en": "Samori Empire (2nd)", "palette": "Africa_West"},
    "Wassoulou Empire":     {"name_local": "Wassoulou", "name_en": "Wassoulou Empire", "palette": "Africa_West"},
    "Tukular Caliphate":    {"name_local": "Tukular", "name_en": "Tukular Empire", "palette": "Africa_West"},
    "Wadai Empire":         {"name_local": "Wadai", "name_en": "Wadai Empire", "palette": "Africa_West"},
    "Sultanate of Damagaram": {"name_local": "Damagaram", "name_en": "Damagaram", "palette": "Africa_West"},
    "Sultanate of Utetera":   {"name_local": "Utetera", "name_en": "Utetera", "palette": "Africa_East"},
    "Ato trading confederacy":{"name_local": "Ato", "name_en": "Ato Confederacy", "palette": "Africa_East"},
    "Mirambo Unyanyembe Ukimbu": {"name_local": "Unyanyembe", "name_en": "Mirambo's Empire", "palette": "Africa_East"},
    "Rabih az-Zubayr":      {"name_local": "Rabih", "name_en": "Rabih's Empire", "palette": "Africa_West"},
    "Accra":                {"name_local": "Accra", "name_en": "Accra", "palette": "Africa_West"},
    "British Protectorate": {"name_local": "British Protectorate", "name_en": "British Protectorate", "colony": True, "ruler": "British Empire", "palette": "British"},

    # ━━━ 오세아니아 ━━━
    "Australia":            {"name_local": "Australia", "name_en": "Australia", "palette": "Oceania"},
    "New South Wales (UK)": {"name_local": "Australia", "name_en": "Australia (NSW)", "colony": True, "ruler": "British Empire", "palette": "Oceania"},
    "Queensland (UK)":      {"name_local": "Australia", "name_en": "Australia (QLD)", "colony": True, "ruler": "British Empire", "palette": "Oceania"},
    "Victoria (UK)":        {"name_local": "Australia", "name_en": "Australia (VIC)", "colony": True, "ruler": "British Empire", "palette": "Oceania"},
    "South Australia (UK)": {"name_local": "Australia", "name_en": "Australia (SA)", "colony": True, "ruler": "British Empire", "palette": "Oceania"},
    "Western Australia (UK)":{"name_local": "Australia", "name_en": "Australia (WA)", "colony": True, "ruler": "British Empire", "palette": "Oceania"},
    "Northern Territory (UK)":{"name_local": "Australia", "name_en": "Australia (NT)", "colony": True, "ruler": "British Empire", "palette": "Oceania"},
    "New Zealand":          {"name_local": "Aotearoa", "name_en": "New Zealand", "palette": "Oceania"},
    "M?ori":                {"name_local": "Māori", "name_en": "Māori", "palette": "Oceania"},
    "Polynesians":          {"name_local": "Polynesia", "name_en": "Polynesia", "palette": "Oceania"},
    "Papua New Guinea":     {"name_local": "Papua Niugini", "name_en": "Papua New Guinea", "palette": "Oceania"},
    "Fiji":                 {"name_local": "Fiji", "name_en": "Fiji", "palette": "Oceania"},
    "Samoa":                {"name_local": "Sāmoa", "name_en": "Samoa", "palette": "Oceania"},
    "American Samoa":       {"name_local": "Amerika Sāmoa", "name_en": "American Samoa", "colony": True, "ruler": "United States", "palette": "Oceania"},
    "Tonga":                {"name_local": "Tonga", "name_en": "Tonga", "palette": "Oceania"},
    "Niue":                 {"name_local": "Niue", "name_en": "Niue", "palette": "Oceania"},
    "Kingdom of Hawaii":    {"name_local": "Hawaiʻi", "name_en": "Kingdom of Hawaii", "palette": "Oceania"},
    "Rapa Nui":             {"name_local": "Rapa Nui", "name_en": "Easter Island", "palette": "Oceania"},
    "New Caledonia":        {"name_local": "Nouvelle-Calédonie", "name_en": "New Caledonia", "colony": True, "ruler": "France", "palette": "French"},
    "New Hebrides":         {"name_local": "Vanuatu", "name_en": "Vanuatu (1980)", "colony": True, "ruler": "France", "independence": 1980, "palette": "Oceania"},
    "Gilbert and Elice Islands": {"name_local": "Kiribati", "name_en": "Kiribati/Tuvalu", "colony": True, "ruler": "British Empire", "palette": "Oceania"},
    "Saipan":               {"name_local": "Saipan", "name_en": "Saipan", "colony": True, "ruler": "Japan", "palette": "Oceania"},
    "Sakhalin (RU)":        {"name_local": "Сахалин", "name_en": "Sakhalin", "palette": "Russian"},
    "Antarctica":           {"name_local": "Antarctica", "name_en": "Antarctica", "palette": "Default"},

    # ━━━ [cl] CShapes 철자 변형 + 고빈도 미매핑 보완 ━━━
    "Italy/Sardinia":       {"name_local": "Italia", "name_en": "Italy (Sardinia)", "palette": "Roman_Italy"},
    "Cape Verde":           {"name_local": "Cabo Verde", "name_en": "Cape Verde", "palette": "Africa_West"},
    "Madagascar (Malagasy)":{"name_local": "Madagasikara", "name_en": "Madagascar", "palette": "Africa_East"},
    "Reunion":              {"name_local": "Réunion", "name_en": "Réunion", "colony": True, "ruler": "France", "palette": "French"},
    "Maldives":             {"name_local": "ދިވެހިރާއްޖެ", "name_en": "Maldives", "palette": "SouthAsia"},
    "Mauritius":            {"name_local": "Mauritius", "name_en": "Mauritius", "palette": "Africa_East"},
    "Tanzania (Tanganyika)":{"name_local": "Tanzania", "name_en": "Tanzania", "palette": "Africa_East"},
    "Solomon Islands":      {"name_local": "Solomon Islands", "name_en": "Solomon Islands", "palette": "Oceania"},
    "East Timor":           {"name_local": "Timor-Leste", "name_en": "Timor-Leste", "palette": "SoutheastAsia"},
    "French Polynesia":     {"name_local": "Polynésie française", "name_en": "French Polynesia", "colony": True, "ruler": "France", "palette": "Oceania"},
    "New Caledonia and Dependencies": {"name_local": "Nouvelle-Calédonie", "name_en": "New Caledonia", "colony": True, "ruler": "France", "palette": "French"},
    "Zanzibar":             {"name_local": "Zanzibar", "name_en": "Zanzibar", "palette": "Africa_East"},
    "Sabah (North Borneo)": {"name_local": "Sabah", "name_en": "Sabah (North Borneo)", "colony": True, "ruler": "British Empire", "palette": "SoutheastAsia"},
    "Sarawak":              {"name_local": "Sarawak", "name_en": "Sarawak", "colony": True, "ruler": "British Empire", "palette": "SoutheastAsia"},
    "Alaska":               {"name_local": "Alaska", "name_en": "Alaska", "palette": "US"},
    "Spanish West Africa":  {"name_local": "الصحراء", "name_en": "Spanish West Africa", "colony": True, "ruler": "Spain", "palette": "Spanish_Port"},
    "Vietnam (Annam/Cochin China/Tonkin)": {"name_local": "Việt Nam", "name_en": "French Indochina", "colony": True, "ruler": "France", "palette": "SoutheastAsia"},
    "Newfoundland":         {"name_local": "Newfoundland", "name_en": "Newfoundland", "palette": "British"},
    "Hawaii":               {"name_local": "Hawaiʻi", "name_en": "Hawaii", "palette": "US"},
    "Unfederated Malay States": {"name_local": "Malaya", "name_en": "Unfederated Malay States", "colony": True, "ruler": "British Empire", "palette": "SoutheastAsia"},
    "Federated Malay States":   {"name_local": "Malaya", "name_en": "Federated Malay States", "colony": True, "ruler": "British Empire", "palette": "SoutheastAsia"},
    "Straits Settlements":  {"name_local": "Malaya", "name_en": "Straits Settlements", "colony": True, "ruler": "British Empire", "palette": "SoutheastAsia"},
    "Comoros":              {"name_local": "Komori", "name_en": "Comoros", "palette": "Africa_East"},
    "Singapore":            {"name_local": "新加坡", "name_en": "Singapore", "palette": "SoutheastAsia"},
    "Vietnam, Democratic Republic of": {"name_local": "Việt Nam", "name_en": "Vietnam", "palette": "SoutheastAsia"},
    "British Cameroons":    {"name_local": "Cameroun", "name_en": "British Cameroons", "colony": True, "ruler": "British Empire", "palette": "Africa_West"},
    "Rwanda-Urundi":        {"name_local": "Rwanda-Urundi", "name_en": "Rwanda-Urundi", "colony": True, "ruler": "Belgium", "palette": "Africa_East"},
    "Southern Sakhalin Island": {"name_local": "南樺太", "name_en": "Southern Sakhalin", "colony": True, "ruler": "Japan", "palette": "Japan"},
    "German Togoland":      {"name_local": "Togo", "name_en": "German Togoland", "colony": True, "ruler": "Germany", "palette": "Africa_West"},
    "British Togoland":     {"name_local": "Togo", "name_en": "British Togoland", "colony": True, "ruler": "British Empire", "palette": "Africa_West"},
    "Bahrain":              {"name_local": "البحرين", "name_en": "Bahrain", "palette": "Islamic_Arab"},
    "Palestine":            {"name_local": "فلسطين", "name_en": "Palestine", "palette": "Islamic_Arab"},
    "Bokhara":              {"name_local": "بخارا", "name_en": "Bukhara Emirate", "palette": "Islamic_Turk"},
    "Khiva":                {"name_local": "خوارزم", "name_en": "Khanate of Khiva", "palette": "Islamic_Turk"},
    "Papua":                {"name_local": "Papua", "name_en": "Papua", "colony": True, "ruler": "British Empire", "palette": "Oceania"},
    "New Guinea (German New Guinea) (Kaiser Wilhelmsland)": {"name_local": "Neuguinea", "name_en": "German New Guinea", "colony": True, "ruler": "Germany", "palette": "Oceania"},

    # ━━━ [cl] HB 중요 미매핑 보완 — 유럽/남아시아/동아시아 ━━━
    # 유럽: 이탈리아 도시국가/소국
    "Genoa":                {"name_local": "Genova", "name_en": "Republic of Genoa", "palette": "Roman_Italy"},
    "Naples":               {"name_local": "Napoli", "name_en": "Kingdom of Naples", "palette": "Roman_Italy"},
    "Tuscany":              {"name_local": "Toscana", "name_en": "Grand Duchy of Tuscany", "palette": "Roman_Italy"},
    "Lombardy":             {"name_local": "Lombardia", "name_en": "Lombardy", "palette": "Roman_Italy"},
    "Modena":               {"name_local": "Modena", "name_en": "Duchy of Modena", "palette": "Roman_Italy"},
    "Parma":                {"name_local": "Parma", "name_en": "Duchy of Parma", "palette": "Roman_Italy"},
    "Lucca":                {"name_local": "Lucca", "name_en": "Republic of Lucca", "palette": "Roman_Italy"},
    "Massa":                {"name_local": "Massa", "name_en": "Duchy of Massa", "palette": "Roman_Italy"},
    "Pontremoli":           {"name_local": "Pontremoli", "name_en": "Pontremoli", "palette": "Roman_Italy"},
    "Fivizzano":            {"name_local": "Fivizzano", "name_en": "Fivizzano", "palette": "Roman_Italy"},
    # 유럽: 스위스/기타
    "Republic of the Seven Zenden": {"name_local": "Zenden", "name_en": "Republic of the Seven Zenden", "palette": "Nordic"},
    # 유럽: 러시아 관련
    "Novgorod":             {"name_local": "Новгород", "name_en": "Novgorod Republic", "palette": "Russian"},
    "Kyivan Rus":           {"name_local": "Київська Русь", "name_en": "Kievan Rus", "palette": "Russian"},
    "Tsardom of Muscovy":   {"name_local": "Москва", "name_en": "Tsardom of Muscovy", "palette": "Russian"},
    "Nogai Horde":          {"name_local": "Ногайская Орда", "name_en": "Nogai Horde", "palette": "Mongol"},
    "Khanate of the Golden Horde": {"name_local": "Золотая Орда", "name_en": "Golden Horde", "palette": "Mongol"},
    "Principality of Wallachia": {"name_local": "Valahia", "name_en": "Wallachia", "palette": "EastEurope"},
    # 동아시아: 미매핑 보완
    "Empire of Japan":      {"name_local": "大日本帝国", "name_en": "Empire of Japan", "palette": "Japan"},
    "Tokugawa Shogunate":   {"name_local": "徳川幕府", "name_en": "Tokugawa Shogunate", "palette": "Japan"},
    "Great Khanate":        {"name_local": "大元", "name_en": "Yuan Dynasty (Great Khanate)", "palette": "Mongol"},
    "Annam":                {"name_local": "安南", "name_en": "Annam", "colony": True, "ruler": "France", "palette": "SoutheastAsia"},
    "Cochin China":         {"name_local": "交趾支那", "name_en": "Cochinchina", "colony": True, "ruler": "France", "palette": "SoutheastAsia"},
    "French Indochina":     {"name_local": "Đông Dương", "name_en": "French Indochina", "colony": True, "ruler": "France", "palette": "SoutheastAsia"},
    "French Indo-China":    {"name_local": "Đông Dương", "name_en": "French Indochina", "colony": True, "ruler": "France", "palette": "SoutheastAsia"},
    "Dutch Formosa":        {"name_local": "福爾摩沙", "name_en": "Dutch Formosa", "colony": True, "ruler": "Netherlands", "palette": "EastAsia"},
    "Middag Kingdom":       {"name_local": "大肚", "name_en": "Middag Kingdom", "palette": "SoutheastAsia"},
    "Rattanakosin Kingdom": {"name_local": "รัตนโกสินทร์", "name_en": "Rattanakosin (Siam)", "palette": "SoutheastAsia"},
    "Pagan":                {"name_local": "ပုဂံ", "name_en": "Pagan Kingdom", "palette": "SoutheastAsia"},
    "Sukhothai":            {"name_local": "สุโขทัย", "name_en": "Sukhothai Kingdom", "palette": "SoutheastAsia"},
    "Lan Na":               {"name_local": "ล้านนา", "name_en": "Lan Na Kingdom", "palette": "SoutheastAsia"},
    "Kediri":               {"name_local": "Kediri", "name_en": "Kingdom of Kediri", "palette": "Maritime_SEA"},
    "Vietnam":              {"name_local": "Việt Nam", "name_en": "Vietnam", "palette": "SoutheastAsia"},
    "Malaysia":             {"name_local": "Malaysia", "name_en": "Malaysia", "palette": "SoutheastAsia"},
    # 남아시아: 주요 왕국/제국
    "British Raj":          {"name_local": "ब्रिटिश राज", "name_en": "British India", "colony": True, "ruler": "British Empire", "palette": "SouthAsia"},
    "Ceylon":               {"name_local": "ශ්‍රී ලංකා", "name_en": "Ceylon", "colony": True, "ruler": "British Empire", "palette": "SouthAsia"},
    "Magadha":              {"name_local": "मगध", "name_en": "Magadha", "palette": "SouthAsia"},
    "Kalinga":              {"name_local": "कलिंग", "name_en": "Kalinga", "palette": "SouthAsia"},
    "Kandy":                {"name_local": "මහනුවර", "name_en": "Kingdom of Kandy", "palette": "SouthAsia"},
    # 서아시아/중앙아시아
    "Bosporan Kingdom":     {"name_local": "Βόσπορος", "name_en": "Bosporan Kingdom", "palette": "Greek"},
    "Bosporian Kingdom":    {"name_local": "Βόσπορος", "name_en": "Bosporan Kingdom", "palette": "Greek"},
    "Trebizond":            {"name_local": "Τραπεζούς", "name_en": "Empire of Trebizond", "palette": "Byzantine"},
    "Khiva Khanate":        {"name_local": "خوارزم", "name_en": "Khanate of Khiva", "palette": "Islamic_Turk"},
    "Quazaq Khanate":       {"name_local": "Қазақ", "name_en": "Kazakh Khanate", "palette": "Islamic_Turk"},
    "Kuwait":               {"name_local": "الكويت", "name_en": "Kuwait", "palette": "Islamic_Arab"},
    "Trucial Oman":         {"name_local": "عمان", "name_en": "Trucial States (UAE)", "palette": "Islamic_Arab"},
    "Mahra":                {"name_local": "المهرة", "name_en": "Mahra Sultanate", "palette": "Islamic_Arab"},
}

# ── 한국어 국명 매핑 (name_en → Korean) ──
# [cl] 1차 오픈이 한국어 서비스이므로, 모든 국명을 한국어(영어) 형식으로 표시
# 기존 name_local(자국어), name_en(영어) 데이터는 100% 보존 (향후 영문 서비스용)
KOREAN_NAMES = {
    # ━━━ 동아시아: 중국 ━━━
    "Qing Dynasty": "청나라",
    "China": "중국",
    "China (Warlord Era)": "중국 (군벌시대)",
    "Post-Ming Warlords": "명말 군벌",
    "Manchuria": "만주",
    "Xinjiang": "신장",
    "Taiwan": "대만",
    "Hong Kong": "홍콩",
    "Tibet": "티베트",
    "Tibetan Empire": "토번 제국",
    "Tibetans": "티베트인",
    "Mongolia": "몽골",
    "Mongol Empire": "몽골 제국",
    "Mongols": "몽골인",
    "Republic of China": "중화민국",
    # [cl] 고대 중국 왕조
    "Shang Dynasty": "상나라 (은나라)",
    "Zhou Dynasty": "주나라",
    "Qin Dynasty": "진나라",
    "Han Dynasty": "한나라",
    "Han Zhao": "한조",
    "Northern Wei": "북위",
    "Sui Dynasty": "수나라",
    "Tang Dynasty": "당나라",
    "Song Dynasty": "송나라",
    "Liao Dynasty": "요나라",
    "Jin Dynasty": "진나라",
    "Jin Dynasty (Sima)": "진나라",
    "Jin Dynasty (Jurchen)": "금나라",
    "Western Jin": "서진",
    "Eastern Jin": "동진",
    "Western Xia": "서하",
    "Ming Dynasty": "명나라",
    "Wu": "오나라",
    "Yue": "월나라",
    "Nanyue": "남월",
    "Minyue": "민월",
    "Nanzhao": "남조",
    "Hainan": "하이난",
    "Yuezhi": "월지",
    "Yueban": "열반",
    "Xiongnu": "흉노",
    "Southern Xiongnu": "남흉노",
    "Shan States": "샨족",
    "Cochinchina": "코친차이나",
    "Kara Khitai": "서요",
    "Oirat Confederation": "오이라트",
    "Sixteen Kingdoms": "오호십육국",
    "Northern Liang": "북량",
    "Rouran Khaganate": "유연",
    "Göktürk Khaganate": "돌궐",
    "Yamato": "야마토",
    # ━━━ 동아시아: 한국 ━━━
    "Joseon": "조선",
    "Korea": "한국",
    "Korean Empire": "대한제국",
    "Korea (US Zone)": "한국 (미군정)",
    "Korea (Soviet Zone)": "한국 (소군정)",
    "Republic of Korea": "대한민국",
    "DPRK": "북한",
    # [cl] 고대 한국
    "Proto-Koreans": "고조선",
    "Koreans": "한국인",
    "Goguryeo": "고구려",
    "Baekje": "백제",
    "Silla": "신라",
    "Gaya": "가야",
    "Balhae": "발해",
    "Goryeo": "고려",
    # ━━━ 동아시아: 일본 ━━━
    "Empire of Japan": "대일본제국",
    "Japan": "일본",
    "Japan (Fujiwara)": "일본 (후지와라)",
    "Japan (Warring States)": "일본 (전국시대)",
    "Japan (Kamakura)": "일본 (가마쿠라)",
    "Japan (Allied Occupation)": "일본 (연합국 점령)",
    "Jomon": "조몬",
    "Yayoi": "야요이",
    "Ainu": "아이누",
    # ━━━ 동남아시아 ━━━
    "Siam": "시암",
    "Thailand": "태국",
    "Vietnam": "베트남",
    "Vietnam (Annam)": "베트남 (안남)",
    "Vietnam (Cochinchina)": "베트남 (남기)",
    "Vietnam (Tonkin)": "베트남 (북기)",
    "Dai Viet": "대월",
    "Cambodia": "캄보디아",
    "Khmer Empire": "크메르 제국",
    "Chenla": "진랍",
    "Laos": "라오스",
    "Myanmar (Burma)": "미얀마",
    "Burmese Kingdoms": "미얀마 왕국",
    "Pyu": "퓨",
    "Mon": "몬",
    "Bagan": "바간",
    "Pegu": "페구",
    "Arakan": "아라칸",
    "Champa": "참파",
    "Srivijaya": "스리비자야",
    "Mataram": "마타람",
    "Ayutthaya": "아유타야",
    "Dvaravati": "드바라바티",
    "Aceh": "아체",
    "Malacca": "말라카",
    "Malay Islamic States": "말레이 이슬람 국가",
    "Minangkabau": "미낭카바우",
    "East Java": "동자바",
    "Philippines": "필리핀",
    "Indonesia": "인도네시아",
    "Indonesia (1945)": "인도네시아",
    "Malaya": "말라야",
    "Malaysia": "말레이시아",
    "Brunei": "브루나이",
    # ━━━ 남아시아 ━━━
    "India": "인도",
    "British East India Company": "영국 동인도회사",
    "Pakistan": "파키스탄",
    "Bangladesh": "방글라데시",
    "Nepal": "네팔",
    "Bhutan": "부탄",
    "Sri Lanka": "스리랑카",
    "Sri Lanka (Ceylon)": "스리랑카 (실론)",
    "Sinhalese": "싱할라",
    "Sinhalese Kingdoms": "싱할라 왕국",
    # [cl] 고대 인도
    "Maurya Empire": "마우리아 제국",
    "Gupta Empire": "굽타 제국",
    "Kushan Empire": "쿠샨 제국",
    "Kushan Principalities": "쿠샨 소국",
    "Mughal Empire": "무굴 제국",
    "Delhi Sultanate": "델리 술탄국",
    "Maratha": "마라타",
    "Maratha Confederacy": "마라타 연맹",
    "Chola": "촐라",
    "Pallava": "팔라바",
    "Pala": "팔라",
    "Vijayanagara": "비자야나가라",
    "Chalukya": "찰루키아",
    "Rashtrakuta": "라슈트라쿠타",
    "Hindu Kingdoms": "힌두 왕국",
    "Hindu States": "힌두 국가",
    "Rajput Kingdoms": "라지푸트 왕국",
    "Rajput States": "라지푸트 국가",
    "Rajputana": "라지푸타나",
    "Rajputs": "라지푸트",
    "Rajasthan": "라자스탄",
    "Bengal": "벵골",
    "Mysore": "마이소르",
    "Orissa": "오리사",
    "Vedic Aryans": "베다 아리아",
    "Dravidians": "드라비다",
    "Indus Valley": "인더스 문명",
    # ━━━ 중동 / 서아시아 ━━━
    "Ottoman Empire": "오스만 제국",
    "Ottoman Sultanate": "오스만 술탄국",
    # [cl] 고대 중동/이슬람
    "Achaemenid Empire": "아케메네스 제국",
    "Parthia": "파르티아",
    "Parthian Empire": "파르티아 제국",
    "Sassanid Empire": "사산 제국",
    "Seleucid Kingdom": "셀레우코스 왕국",
    "Safavid Empire": "사파비 제국",
    "Timurid Empire": "티무르 제국",
    "Timurid Emirates": "티무르 토후국",
    "Abbasid Caliphate": "아바스 칼리프국",
    "Umayyad Caliphate": "우마이야 칼리프국",
    "Fatimid Caliphate": "파티마 칼리프국",
    "Seljuk Empire": "셀주크 제국",
    "Ayyubid Caliphate": "아이유브 왕조",
    "Mamluk Sultanate": "맘루크 술탄국",
    "Caliphate of Cordoba": "코르도바 칼리프국",
    "Emirate of Cordoba": "코르도바 토후국",
    "Almohad Caliphate": "알모하드 왕조",
    "Almoravid Dynasty": "알모라비드 왕조",
    "Hafsid Caliphate": "하프스 왕조",
    "Idrisid Caliphate": "이드리스 왕조",
    "Wattasid Caliphate": "와타스 왕조",
    "Zayyanid Caliphate": "자이얀 왕조",
    "Golden Horde": "킵차크 칸국",
    "Crimean Khanate": "크림 칸국",
    "Chagatai Khanate": "차가타이 칸국",
    "Ghaznavid Emirate": "가즈나 왕조",
    # 고대 중동 (성서/고대)
    "Assyria": "아시리아",
    "Babylonia": "바빌로니아",
    "Elam": "엘람",
    "Ur": "우르",
    "Urartu": "우라르투",
    "Hittites": "히타이트",
    "Meroe": "메로에",
    "Kush": "쿠시",
    "Kerma": "케르마",
    "Axum": "악숨",
    "Nabataean Kingdom": "나바테아",
    "Ptolemaic Kingdom": "프톨레마이오스 왕국",
    "Kingdom of Israel": "이스라엘 왕국",
    "Hadramaut": "하드라마우트",
    "Saba": "사바",
    "Himyarite Kingdom": "힘야르 왕국",
    "Scythians": "스키타이",
    "Turkey": "튀르키예",
    "Persia": "페르시아",
    "Iran": "이란",
    "Iraq": "이라크",
    "Saudi Arabia": "사우디아라비아",
    "Arabia": "아라비아",
    "Nejd": "네지드",
    "Hejaz": "헤자즈",
    "Ha'il Emirate": "하일 토후국",
    "Rashidi Emirate": "라시드 토후국",
    "Yemen": "예멘",
    "Yemen (Aden)": "예멘 (아덴)",
    "Oman": "오만",
    "Oman (Muscat)": "오만 (무스카트)",
    "Trucial States": "트루셜 오만",
    "UAE": "아랍에미리트",
    "Qatar": "카타르",
    "Kuwait": "쿠웨이트",
    "Jordan": "요르단",
    "Israel/Palestine": "이스라엘/팔레스타인",
    "Lebanon": "레바논",
    "Syria": "시리아",
    "Palestine": "팔레스타인",
    "Afghanistan": "아프가니스탄",
    "Egypt": "이집트",
    "Central Asian Khanates": "중앙아시아 칸국",
    "Bukhara Khanate": "부하라 칸국",
    # ━━━ 유럽: 주요 열강 ━━━
    "United Kingdom": "영국",
    "France": "프랑스",
    "Germany": "독일",
    "German Empire": "독일 제국",
    "East Germany": "동독",
    "West Germany": "서독",
    "East Prussia": "동프로이센",
    "Free City of Danzig": "단치히 자유시",
    "Austria": "오스트리아",
    "Austria-Hungary": "오스트리아-헝가리",
    "Russia": "러시아",
    "Russian Empire": "러시아 제국",
    "Soviet Union": "소련",
    "Italy": "이탈리아",
    "Kingdom of Italy": "이탈리아 왕국",
    "Spain": "스페인",
    "Portugal": "포르투갈",
    # [cl] 고대/중세 유럽
    "Roman Republic": "로마 공화국",
    "Roman Empire": "로마 제국",
    "Rome": "로마",
    "Byzantine Empire": "비잔틴 제국",
    "Eastern Roman Empire": "동로마 제국",
    "Western Roman Empire": "서로마 제국",
    "Roman Empire (Constantine)": "로마 제국 (콘스탄티누스)",
    "Roman Empire (Diocletian)": "로마 제국 (디오클레티아누스)",
    "Roman Empire (Galerius)": "로마 제국 (갈레리우스)",
    "Roman Empire (Maximian)": "로마 제국 (막시미아누스)",
    # [cl] 게르만 민족 대이동
    "Franks": "프랑크족",
    "Ostrogothic Kingdom": "동고트 왕국",
    "Visigothic Kingdom": "서고트 왕국",
    "Vandal Kingdom": "반달 왕국",
    "Lombard Principalities": "롬바르드 공국",
    "Macedon": "마케도니아",
    "Carolingian Empire": "카롤링거 제국",
    "Frankish Kingdom": "프랑크 왕국",
    "Holy Roman Empire": "신성 로마 제국",
    "Papal States": "교황령",
    "Venice": "베네치아",
    "Carthage": "카르타고",
    "Greek City-States": "그리스 도시국가",
    "Greek Colonies": "그리스 식민지",
    "Empire of Alexander": "알렉산드로스 제국",
    "England": "잉글랜드",
    "England and Ireland": "잉글랜드-아일랜드",
    "Scotland": "스코틀랜드",
    "Wales": "웨일스",
    "Wessex": "웨섹스",
    "Mercia": "머시아",
    "Kent": "켄트",
    "Essex": "에섹스",
    "Northumbria": "노섬브리아",
    "Picts": "픽트족",
    "Scots": "스코트족",
    "Welsh": "웨일스인",
    "Celtic Kingdoms": "켈트 왕국",
    "Brittany": "브르타뉴",
    "Kingdom of France": "프랑스 왕국",
    "Angevin Empire": "앙주 제국",
    "Castile": "카스티야",
    "Aragon": "아라곤",
    "Leon": "레온",
    "Navarre": "나바라",
    "Asturias": "아스투리아스",
    "Sardinia": "사르데냐",
    "Sicily": "시칠리아",
    "Corsica": "코르시카",
    "Bulgarian Khanate": "불가리아 칸국",
    "Bulgars": "불가르",
    "Avars": "아바르",
    "Magyars": "마자르",
    "Khazars": "하자르",
    "Volga Bulgars": "볼가 불가르",
    "Kievan Rus": "키예프 루스",
    "Principality of Kyiv": "키예프 공국",
    "Principality of Novgorod": "노브고로드 공국",
    "Principality of Vladimir": "블라디미르 공국",
    "Principality of Galicia": "갈리치아 공국",
    "Rus Principalities": "루스 공국",
    "Grand Duchy of Moscow": "모스크바 대공국",
    "Novgorod-Seversky": "노브고로드-세베르스키",
    "Pskov": "프스코프",
    "Ryazan": "랴잔",
    "Norsemen": "노르만",
    "Danes": "덴마크인",
    "Danish Kingdoms": "덴마크 왕국",
    "Denmark-Norway": "덴마크-노르웨이",
    "Kalmar Union": "칼마르 동맹",
    "Polish-Lithuanian Commonwealth": "폴란드-리투아니아",
    "Poland-Lithuania": "폴란드-리투아니아",
    "Prussia": "프로이센",
    "Austrian Empire": "오스트리아 제국",
    "Austrian Netherlands": "오스트리아령 네덜란드",
    "Habsburg Netherlands": "합스부르크 네덜란드",
    "Dutch Republic": "네덜란드 공화국",
    "Swiss Confederation": "스위스 연방",
    "Teutonic Knights": "튜턴 기사단",
    "Imperial Hungary": "헝가리 왕국",
    "Kingdom of Hungary": "헝가리 왕국",
    "Kingdom of Ireland": "아일랜드 왕국",
    "Croatian Kingdom": "크로아티아 왕국",
    "Lombard Duchies": "롬바르드 공국",
    # [cl] 게르만/로마 추가
    "Ostrogothic Kingdom": "동고트 왕국",
    "Vandal Kingdom": "반달 왕국",
    "Lombard Principalities": "롬바르드 공국",
    "Republic of Genoa": "제노바 공화국",
    "Kingdom of Naples": "나폴리 왕국",
    "Grand Duchy of Tuscany": "토스카나 대공국",
    "Duchy of Modena": "모데나 공국",
    "Duchy of Parma": "파르마 공국",
    "Republic of Lucca": "루카 공화국",
    "Novgorod Republic": "노브고로드 공화국",
    "Kievan Rus": "키예프 루스",
    "Tsardom of Muscovy": "모스크바 차르국",
    "Golden Horde": "킵차크 칸국",
    "Wallachia": "왈라키아",
    "Empire of Trebizond": "트라페주스 제국",
    "Bosporan Kingdom": "보스포루스 왕국",
    # [cl] 동아시아/동남아
    "Empire of Japan": "대일본제국",
    "Tokugawa Shogunate": "도쿠가와 막부",
    "Yuan Dynasty (Great Khanate)": "원나라 (대칸국)",
    "Pagan Kingdom": "파간 왕국",
    "Sukhothai Kingdom": "수코타이 왕국",
    "Lan Na Kingdom": "란나 왕국",
    "Rattanakosin (Siam)": "랏따나꼬신 (시암)",
    "Kingdom of Kediri": "크디리 왕국",
    # [cl] 남아시아
    "British India": "영국령 인도",
    "Magadha": "마가다",
    "Kalinga": "칼링가",
    "Kingdom of Kandy": "캔디 왕국",
    # [cl] 서아시아/중동/아프리카
    "Wadai Sultanate": "와다이 술탄국",
    "Darfur Sultanate": "다르푸르 술탄국",
    "Regency of Algiers": "알제리 총독부",
    "Regency of Tunis": "튀니스 총독부",
    "Funj Sultanate": "푼지 술탄국",
    "Islamic City-States": "이슬람 도시국가",
    "Bukhara Emirate": "부하라 토후국",
    "Khanate of Khiva": "히바 칸국",
    "Kazakh Khanate": "카자흐 칸국",
    "Trucial States (UAE)": "트루셜 오만 (UAE)",
    "German Empire (Prussia)": "독일 제국 (프로이센)",
    # ━━━ 유럽: 기타 ━━━
    "Netherlands": "네덜란드",
    "Belgium": "벨기에",
    "Luxembourg": "룩셈부르크",
    "Switzerland": "스위스",
    "Sweden": "스웨덴",
    "Sweden-Norway": "스웨덴-노르웨이",
    "Norway": "노르웨이",
    "Denmark": "덴마크",
    "Iceland": "아이슬란드",
    "Finland": "핀란드",
    "Ireland": "아일랜드",
    "Greece": "그리스",
    "Poland": "폴란드",
    "Hungary": "헝가리",
    "Romania": "루마니아",
    "Bulgaria": "불가리아",
    "Serbia": "세르비아",
    "Montenegro": "몬테네그로",
    "Albania": "알바니아",
    "Croatia": "크로아티아",
    "Slovenia": "슬로베니아",
    "Bosnia and Herzegovina": "보스니아 헤르체고비나",
    "Bosnia-Herzegovina": "보스니아-헤르체고비나",
    "Yugoslavia": "유고슬라비아",
    "Czechoslovakia": "체코슬로바키아",
    "Czech Republic": "체코",
    "Slovakia": "슬로바키아",
    "Estonia": "에스토니아",
    "Latvia": "라트비아",
    "Lithuania": "리투아니아",
    "Moldova": "몰도바",
    "Ukraine": "우크라이나",
    "Belarus": "벨라루스",
    "Belarus (SSR)": "벨라루스 (소비에트)",
    "Georgia": "조지아",
    "Armenia": "아르메니아",
    "Azerbaijan": "아제르바이잔",
    "Kazakhstan": "카자흐스탄",
    "Uzbekistan": "우즈베키스탄",
    "Turkmenistan": "투르크메니스탄",
    "Kyrgyzstan": "키르기스스탄",
    "Tajikistan": "타지키스탄",
    "Far Eastern Republic": "극동공화국",
    "South Russia": "남러시아",
    "Andorra": "안도라",
    "Liechtenstein": "리히텐슈타인",
    "Malta": "몰타",
    "North Macedonia": "북마케도니아",
    "Cyprus": "키프로스",
    "Northern Cyprus": "북키프로스",
    "Greenland": "그린란드",
    "Saar Protectorate": "자르 보호령",
    "Newfoundland": "뉴펀들랜드",
    "Germany (French Zone)": "독일 (프랑스 점령지)",
    "Germany (Soviet Zone)": "독일 (소련 점령지)",
    "Germany (British Zone)": "독일 (영국 점령지)",
    "Germany (US Zone)": "독일 (미국 점령지)",
    # ━━━ 아메리카 ━━━
    "United States": "미국",
    "US Virgin Islands": "미국령 버진아일랜드",
    "Canada": "캐나다",
    "Puerto Rico": "푸에르토리코",
    "Guam": "괌",
    "Mexico": "멕시코",
    "Guatemala": "과테말라",
    "Honduras": "온두라스",
    "El Salvador": "엘살바도르",
    "Nicaragua": "니카라과",
    "Costa Rica": "코스타리카",
    "Panama": "파나마",
    "Cuba": "쿠바",
    "Haiti": "아이티",
    "Dominican Republic": "도미니카 공화국",
    "Jamaica": "자메이카",
    "Colombia": "콜롬비아",
    "Venezuela": "베네수엘라",
    "Ecuador": "에콰도르",
    "Peru": "페루",
    "Bolivia": "볼리비아",
    "Brazil": "브라질",
    "Empire of Brazil": "브라질 제국",
    "Argentina": "아르헨티나",
    "Uruguay": "우루과이",
    "Paraguay": "파라과이",
    "Chile": "칠레",
    "Belize": "벨리즈",
    "Guyana": "가이아나",
    "Guyana (1966)": "가이아나",
    "Suriname": "수리남",
    "Suriname (1975)": "수리남",
    "French Guiana": "프랑스령 기아나",
    "Trinidad and Tobago": "트리니다드 토바고",
    # [cl] 아메리카 고대 문명
    "Aztec Empire": "아즈텍 제국",
    "Inca Empire": "잉카 제국",
    "Maya City-States": "마야 도시국가",
    "Maya States": "마야 국가",
    "Maya": "마야",
    "Olmec": "올멕",
    "Toltec Empire": "톨텍 제국",
    "Chimu Empire": "치무 제국",
    "Wari Empire": "와리 제국",
    "Tiwanaku Empire": "티와나쿠 제국",
    "Nazca": "나스카",
    "Moche": "모체",
    "Teotihuacan": "테오티우아칸",
    "Monte Alban": "몬테알반",
    "Mixtec Empire": "믹스텍 제국",
    "Mixtecs": "믹스텍",
    "Mesoamerican States": "메소아메리카 국가",
    "Empire of Brazil": "브라질 제국",
    "Tongan Empire": "통가 제국",
    # [cl] 추가 미번역 제국/왕국/국가
    "Western Roman Empire": "서로마 제국",
    "Visigothic Kingdom": "서고트 왕국",
    "Hunnic Empire": "훈 제국",
    "Samanid Empire": "사만 제국",
    "Sasanian Empire": "사산 제국",
    "Batavian Republic": "바타비아 공화국",
    "Bosporan Kingdom": "보스포루스 왕국",
    "Fulani Empire": "풀라니 제국",
    "Zapotec Empire": "사포텍 제국",
    "Tufan Empire": "토번 제국",
    "Kingdom of Norway": "노르웨이 왕국",
    "Kingdom of Sardinia": "사르데냐 왕국",
    "Kingdom of the Two Sicilies": "양시칠리아 왕국",
    "Kingdom of Georgia": "조지아 왕국",
    "Kingdom of Pagan": "바간 왕국",
    "Kingdom of Sukhotai": "수코타이 왕국",
    "Saka Kingdom": "사카 왕국",
    "Odrysian Kingdom": "오드리시아 왕국",
    "Vietnam, Democratic Republic of": "베트남 민주공화국",
    "Vietnam, Republic of": "베트남 공화국",
    "Federated Malay States": "말레이 연방주",
    "Thai Kingdoms": "타이 왕국",
    "Georgian Kingdom": "조지아 왕국",
    "Mon States": "몬 국가",
    # [cl] 추가 주요 엔티티
    "Austronesians": "오스트로네시아인",
    "Polynesians": "폴리네시아인",
    "Maori": "마오리",
    "Rapa Nui": "라파누이",
    "Islamic city-states": "이슬람 도시국가",
    "Islamic states": "이슬람 국가",
    "Islamic and Hindu states": "이슬람-힌두 국가",
    "Saami": "사미족",
    "Sámi": "사미족",
    "Thule": "툴레",
    "Dorset": "도르셋",
    "Beothuk": "베오투크",
    "Innu": "이누",
    "Celts": "켈트인",
    "Slavonic tribes": "슬라브 부족",
    "Magyars": "마자르",
    # ━━━ 카리브해 소도서 ━━━
    "Anguilla": "앵귈라",
    "Antigua and Barbuda": "앤티가 바부다",
    "Barbados": "바베이도스",
    "Bahamas": "바하마",
    "Dominica": "도미니카",
    "Grenada": "그레나다",
    "Guadeloupe": "과들루프",
    "Martinique": "마르티니크",
    "Montserrat": "몬트세라트",
    "Saint Barthélemy": "생바르텔레미",
    "Saint Kitts and Nevis": "세인트키츠 네비스",
    "Saint Lucia": "세인트루시아",
    "Saint Martin": "생마르탱",
    "Saint Vincent and the Grenadines": "세인트빈센트 그레나딘",
    "Netherlands Antilles": "네덜란드령 안틸레스",
    "Turks and Caicos": "터크스 케이커스",
    "Wallis and Futuna": "왈리스 푸투나",
    # ━━━ 아프리카: 북부 ━━━
    "Algeria": "알제리",
    "Morocco": "모로코",
    "Morocco (Spanish Zone)": "모로코 (스페인 보호령)",
    "Tunisia": "튀니지",
    "Libya": "리비아",
    "Libya (Cyrenaica)": "리비아 (키레나이카)",
    "Libya (Tripolitania)": "리비아 (트리폴리타니아)",
    "Libya (Fezzan)": "리비아 (페잔)",
    "Western Sahara": "서사하라",
    "Sudan": "수단",
    # ━━━ 아프리카: 동부 ━━━
    "Ethiopia": "에티오피아",
    "Ethiopia (Abyssinia)": "에티오피아",
    "Eritrea": "에리트레아",
    "Somalia": "소말리아",
    "Somalia (1960)": "소말리아",
    "Djibouti": "지부티",
    "Djibouti (1977)": "지부티",
    "Kenya": "케냐",
    "Kenya (1963)": "케냐",
    "Uganda": "우간다",
    "Tanzania": "탄자니아",
    "Tanzania (1961)": "탄자니아",
    "Rwanda": "르완다",
    "Burundi": "부룬디",
    "Madagascar": "마다가스카르",
    "Madagascar (Merina)": "마다가스카르",
    # ━━━ 아프리카: 서부 ━━━
    "Nigeria": "나이지리아",
    "Ghana": "가나",
    "Ghana (1957)": "가나",
    "Sierra Leone": "시에라리온",
    "Liberia": "라이베리아",
    "Senegal": "세네갈",
    "Gambia": "감비아",
    "Guinea": "기니",
    "Guinea-Bissau": "기니비사우",
    "Guinea-Bissau (1974)": "기니비사우",
    "Mozambique (1975)": "모잠비크",
    "Côte d'Ivoire": "코트디부아르",
    "Burkina Faso": "부르키나파소",
    "Mali": "말리",
    "Niger": "니제르",
    "Chad": "차드",
    "Mauritania": "모리타니",
    "Benin": "베냉",
    "Benin (Dahomey)": "베냉",
    "Togo": "토고",
    "Togo (Togoland)": "토고",
    "Cameroon": "카메룬",
    "Cameroon (Kamerun)": "카메룬",
    "Cameroon (Southern)": "카메룬 (남부)",
    "Gabon": "가봉",
    "Equatorial Guinea": "적도 기니",
    "Central African Republic": "중앙아프리카 공화국",
    "Congo": "콩고",
    "Congo (French)": "콩고 (프랑스령)",
    "DR Congo (1960)": "콩고민주공화국",
    "DR Congo": "콩고민주공화국",
    "French West Africa": "프랑스령 서아프리카",
    "French Equatorial Africa": "프랑스령 적도아프리카",
    # ━━━ 아프리카: 남부 ━━━
    "South Africa": "남아프리카 공화국",
    "South Africa (Cape Colony)": "남아프리카 (케이프)",
    "South Africa (Natal)": "남아프리카 (나탈)",
    "South Africa (Transvaal)": "남아프리카 (트란스발)",
    "South Africa (Orange Free State)": "남아프리카 (오렌지 자유국)",
    "South Africa (Griqualand)": "남아프리카 (그리콸란드)",
    "Namibia": "나미비아",
    "Namibia (1990)": "나미비아",
    "Walvis Bay": "월비스베이",
    "Botswana": "보츠와나",
    "Lesotho": "레소토",
    "Lesotho (1966)": "레소토",
    "Eswatini": "에스와티니",
    "Zimbabwe": "짐바브웨",
    "Zimbabwe (Rhodesia)": "짐바브웨",
    "Zambia": "잠비아",
    "Zambia (1964)": "잠비아",
    "Malawi": "말라위",
    "Malawi (1964)": "말라위",
    "Mozambique": "모잠비크",
    "Angola": "앙골라",
    # [cl] 아프리카 고대/중세
    "Songhai": "송가이 제국",
    "Ghana Empire": "가나 제국",
    "Great Zimbabwe": "그레이트 짐바브웨",
    "Kanem": "카넴",
    "Bornu-Kanem": "보르누-카넴",
    "Hausa States": "하우사 국가",
    "Bantu": "반투",
    "Alwa": "알와",
    "Makuria": "마쿠리아",
    "Kingdom of Merina": "메리나 왕국",
    "Khoisan": "코이산",
    "Guanches": "과나체",
    # ━━━ 아프리카: 왕국/소국 ━━━
    "Ashanti Empire": "아샨티 제국",
    "Sokoto Caliphate": "소코토 칼리프국",
    "Buganda Kingdom": "부간다 왕국",
    "Bunyoro Kingdom": "부뇨로 왕국",
    "Lozi Kingdom": "로지 왕국",
    "Luba Kingdom": "루바 왕국",
    "Lunda Empire": "룬다 제국",
    "Kuba Kingdom": "쿠바 왕국",
    "Ndebele Kingdom": "은데벨레 왕국",
    "Shona": "쇼나",
    "Nguni": "응구니",
    "Ngwato": "응와토",
    "Oyo Empire": "오요 제국",
    "Ibadan": "이바단",
    "Lagos": "라고스",
    "Kanem-Bornu": "카넴-보르누",
    "Mossi States": "모시",
    "Zululand": "줄루란트",
    "Zanzibar": "잔지바르",
    "Harar (Egyptian)": "하라르",
    "Teke Kingdom": "테케 왕국",
    "Yaka Kingdom": "야카 왕국",
    "Yeke Kingdom": "예케 왕국",
    "Mbailundu Kingdom": "음바일룬두 왕국",
    "Ovimbundu": "오빔분두",
    "Calabar": "칼라바르",
    "Opobo": "오포보",
    "Barotse": "바로체",
    "Cotonou": "코토누",
    "Borgu States": "보르구",
    "Dendi Kingdom": "덴디 왕국",
    "Futa Jalon": "푸타잘론",
    "Futa Toro": "푸타토로",
    "Kong Empire": "콩 제국",
    "Kong": "콩",
    "Samori Empire": "사모리 제국",
    "Samori Empire (2nd)": "사모리 제국 (2차)",
    "Wassoulou Empire": "와술루 제국",
    "Tukular Empire": "투쿨로르 제국",
    "Wadai Empire": "와다이 제국",
    "Damagaram": "다마가람",
    "Utetera": "우테테라",
    "Ato Confederacy": "아토 연맹",
    "Mirambo's Empire": "미람보 제국",
    "Rabih's Empire": "라비흐 제국",
    "Accra": "아크라",
    "British Protectorate": "영국 보호령",
    # ━━━ 오세아니아 ━━━
    "Australia": "호주",
    "Australia (NSW)": "호주 (뉴사우스웨일스)",
    "Australia (QLD)": "호주 (퀸즐랜드)",
    "Australia (VIC)": "호주 (빅토리아)",
    "Australia (SA)": "호주 (남호주)",
    "Australia (WA)": "호주 (서호주)",
    "Australia (NT)": "호주 (노던준주)",
    "New Zealand": "뉴질랜드",
    "Māori": "마오리",
    "Polynesia": "폴리네시아",
    "Papua New Guinea": "파푸아뉴기니",
    "Fiji": "피지",
    "Samoa": "사모아",
    "American Samoa": "미국령 사모아",
    "Tonga": "통가",
    "Niue": "니우에",
    "Kingdom of Hawaii": "하와이 왕국",
    "Easter Island": "이스터섬",
    "New Caledonia": "누벨칼레도니",
    "Vanuatu (1980)": "바누아투",
    "Kiribati/Tuvalu": "키리바시/투발루",
    "Saipan": "사이판",
    "Sakhalin": "사할린",
    "Antarctica": "남극",
}

# ── 식민지 지배국명 한국어 매핑 ──
# [cl] colonial_ruler 필드에 사용되는 이름 → 한국어
RULER_NAMES_KO = {
    "British Empire": "대영제국",
    "France": "프랑스",
    "United States": "미국",
    "Netherlands": "네덜란드",
    "Spain": "스페인",
    "Italy": "이탈리아",
    "Germany": "독일",
    "Belgium": "벨기에",
    "Portugal": "포르투갈",
    "Japan": "일본",
    "Egypt": "이집트",
    "USSR": "소련",
    "Empire of Japan": "대일본제국",
    "Imperial Japan": "대일본제국",
    "大日本帝国": "대일본제국",
}


def get_korean_name(name_en):
    """[cl] name_en → 한국어 변환. 매칭 없으면 영어 그대로 반환."""
    if name_en in KOREAN_NAMES:
        return KOREAN_NAMES[name_en]
    # "(1960)" 등 연도 접미사 제거 후 재시도
    base = name_en.split(" (")[0]
    return KOREAN_NAMES.get(base, name_en)


# ── 주요 국가 수도/중심 좌표 (라벨 위치 결정용) ──
# [cl] centroid 대신 수도 좌표를 사용하여 정확한 라벨 배치
CAPITAL_COORDS = {
    # ━━━ 동아시아 ━━━
    "Manchu Empire":    [116.40, 39.90],  # 북경
    "China":            [116.40, 39.90],
    "Chinese Warlords": [116.40, 39.90],
    "Chinese warlords": [116.40, 39.90],
    "Manchuria":        [125.32, 43.88],  # 장춘
    "Xinjiang":         [87.62, 43.79],   # 우루무치
    "Taiwan":           [121.56, 25.03],  # 타이베이
    "Tibet":            [91.11, 29.65],   # 라사
    "Mongolia":         [106.91, 47.92],  # 울란바토르
    "Hong Kong":        [114.17, 22.32],
    "Korea":            [126.98, 37.57],  # 서울
    "Korea (USA)":      [126.98, 37.57],
    "Korea (USSR)":     [125.75, 39.02],  # 평양
    "Korea, Republic of":                    [126.98, 37.57],
    "Korea, Democratic People's Republic of":[125.75, 39.02],
    "Imperial Japan":   [139.76, 35.68],  # 도쿄
    "Empire of Japan":  [139.76, 35.68],
    "Japan":            [139.76, 35.68],
    "Japan (USA)":      [139.76, 35.68],
    # ━━━ 동남아시아 ━━━
    "Rattanakosin Kingdom": [100.50, 13.75],  # 방콕
    "Siam":             [100.50, 13.75],
    "Thailand":         [100.50, 13.75],
    "French Indochina": [105.85, 21.03],  # 하노이
    "French Indo-China":[105.85, 21.03],
    "Vietnam":          [105.85, 21.03],
    "Annam":            [106.63, 16.46],  # 후에
    "Cochin China":     [106.63, 10.82],  # 사이공
    "Tonkin":           [105.85, 21.03],  # 하노이
    "Cambodia":         [104.92, 11.56],  # 프놈펜
    "Laos":             [102.63, 17.97],  # 비엔티안
    "Burma":            [96.20, 16.87],   # 양곤
    "Philippines":      [120.98, 14.60],  # 마닐라
    "Dutch East Indies":[106.85, -6.21],  # 자카르타
    "Netherlands Indies":[106.85, -6.21],
    "Indonesia":        [106.85, -6.21],
    "Malaya":           [101.69, 3.14],   # 쿠알라룸푸르
    "Malaysia":         [101.69, 3.14],
    "Brunei":           [114.95, 4.94],
    # ━━━ 남아시아 ━━━
    "British Raj":      [77.21, 28.61],   # 델리
    "India":            [77.21, 28.61],
    "Pakistan":         [73.05, 33.69],   # 이슬라마바드
    "Bangladesh":       [90.41, 23.81],   # 다카
    "Nepal":            [85.32, 27.72],   # 카트만두
    "Bhutan":           [89.64, 27.47],
    "Sri Lanka":        [79.86, 6.93],    # 콜롬보
    "Ceylon":           [79.86, 6.93],
    # ━━━ 중동 / 서아시아 ━━━
    "Ottoman Empire":   [28.98, 41.01],   # 이스탄불
    "Ottoman Sultanate":[28.98, 41.01],
    "Turkey":           [32.87, 39.93],   # 앙카라
    "Persia":           [51.39, 35.69],   # 테헤란
    "Iran":             [51.39, 35.69],
    "Iraq":             [44.37, 33.31],   # 바그다드
    "Mesopotamia (GB)": [44.37, 33.31],
    "Saudi Arabia":     [46.72, 24.71],   # 리야드
    "Arabia":           [46.72, 24.71],
    "Egypt":            [31.24, 30.04],   # 카이로
    "Afghanistan":      [69.17, 34.53],   # 카불
    "Mandatory Palestine (GB)": [35.22, 31.77],  # 예루살렘
    "Syria (France)":   [36.29, 33.51],   # 다마스쿠스
    # ━━━ 유럽 ━━━
    "United Kingdom":   [-0.13, 51.51],   # 런던
    "United Kingdom of Great Britain and Ireland": [-0.13, 51.51],
    "France":           [2.35, 48.86],    # 파리
    "Germany":          [13.40, 52.52],   # 베를린
    "German Empire":    [13.40, 52.52],
    "Russia":           [37.62, 55.75],   # 모스크바
    "Russian Empire":   [37.62, 55.75],
    "USSR":             [37.62, 55.75],
    "Italy":            [12.50, 41.90],   # 로마
    "Kingfom of Italy": [12.50, 41.90],
    "Spain":            [-3.70, 40.42],   # 마드리드
    "Portugal":         [-9.14, 38.74],   # 리스본
    "Austria Hungary":  [16.37, 48.21],   # 빈
    "Austro-Hungarian Empire": [16.37, 48.21],
    "Austria":          [16.37, 48.21],
    "Netherlands":      [4.90, 52.37],    # 암스테르담
    "Belgium":          [4.35, 50.85],    # 브뤼셀
    "Switzerland":      [7.45, 46.95],    # 베른
    "Sweden":           [18.07, 59.33],   # 스톡홀름
    "Sweden–Norway":    [18.07, 59.33],
    "Norway":           [10.75, 59.91],   # 오슬로
    "Denmark":          [12.57, 55.68],   # 코펜하겐
    "Finland":          [24.94, 60.17],   # 헬싱키
    "Greece":           [23.73, 37.97],   # 아테네
    "Poland":           [21.01, 52.23],   # 바르샤바
    "Romania":          [26.10, 44.43],   # 부쿠레슈티
    "Bulgaria":         [23.32, 42.70],   # 소피아
    "Serbia":           [20.46, 44.79],   # 베오그라드
    "Yugoslavia":       [20.46, 44.79],
    "Czechoslovakia":   [14.42, 50.08],   # 프라하
    "Hungary":          [19.04, 47.50],   # 부다페스트
    "Estonia":          [24.75, 59.44],   # 탈린
    "Latvia":           [24.11, 56.95],   # 리가
    "Lithuania":        [25.28, 54.69],   # 빌뉴스
    "Far Eastern SSR":  [131.89, 43.12],  # 블라디보스토크
    "South Russia":     [39.72, 47.24],   # 로스토프
    "White Russia":     [27.57, 53.90],   # 민스크
    "Ukraine":          [30.52, 50.45],   # 키이우
    # ━━━ 아메리카 ━━━
    "United States":    [-77.04, 38.90],  # 워싱턴 DC
    "United States of America": [-77.04, 38.90],
    "Canada":           [-75.70, 45.42],  # 오타와
    "Mexico":           [-99.13, 19.43],  # 멕시코시티
    "Brazil":           [-47.93, -15.78], # 브라질리아
    "Kingdom of Brazil":[-43.17, -22.91], # 리우
    "Argentina":        [-58.38, -34.60], # 부에노스아이레스
    "Colombia":         [-74.07, 4.71],   # 보고타
    "Peru":             [-77.04, -12.05], # 리마
    "Chile":            [-70.67, -33.45], # 산티아고
    "Cuba":             [-82.38, 23.13],  # 하바나
    "Venezuela":        [-66.90, 10.50],  # 카라카스
    # ━━━ 아프리카 ━━━
    "Ethiopia":         [38.75, 9.02],    # 아디스아바바
    "Abyssinia":        [38.75, 9.02],
    "South Africa":     [28.23, -25.75],  # 프리토리아
    "Union of South Africa": [28.23, -25.75],
    "Nigeria":          [7.49, 9.06],     # 아부자
    "Angola":           [13.23, -8.84],   # 루안다
    "Mozambique":       [32.59, -25.97],  # 마푸토
    # ━━━ 오세아니아 ━━━
    "Australia":        [149.13, -35.28], # 캔버라
    "New Zealand":      [174.78, -41.29], # 웰링턴
}

# ── 식민지 가상 엔트리 (피지배국 이름 우선 표기 원칙) ──
# [cl] GeoJSON에 별도 feature가 없지만, 지도상 독립적으로 라벨을 표시해야 하는 영토
# (parent_name, start_year, end_year): [가상 엔트리들]
COLONIAL_OVERLAYS = {
    # 일본 제국 → 한국, 대만 별도 라벨
    ("Empire of Japan", 1910, 1945): [
        {
            "key": "__virtual__Korea_under_Japan",
            "display_name": "한국 (Korea)",
            "display_name_en": "Korea",
            "display_name_local": "한국",
            "is_colony": True,
            "colonial_ruler": "Empire of Japan",
            "colonial_note": "Under Empire of Japan Rule",
            "capital_coords": [126.98, 37.57],
            "fill_color": "#45B39D",
            "confidence": "high",
        },
        {
            "key": "__virtual__Taiwan_under_Japan",
            "display_name": "臺灣 (Taiwan)",
            "display_name_en": "Taiwan",
            "display_name_local": "臺灣",
            "is_colony": True,
            "colonial_ruler": "Empire of Japan",
            "colonial_note": "Under Empire of Japan Rule",
            "capital_coords": [121.56, 25.03],
            "fill_color": "#F4D03F",
            "confidence": "high",
        },
    ],
    ("Imperial Japan", 1910, 1945): [
        {
            "key": "__virtual__Korea_under_Japan",
            "display_name": "한국 (Korea)",
            "display_name_en": "Korea",
            "display_name_local": "한국",
            "is_colony": True,
            "colonial_ruler": "Imperial Japan",
            "colonial_note": "Under Imperial Japan Rule",
            "capital_coords": [126.98, 37.57],
            "fill_color": "#45B39D",
            "confidence": "high",
        },
        {
            "key": "__virtual__Taiwan_under_Japan",
            "display_name": "臺灣 (Taiwan)",
            "display_name_en": "Taiwan",
            "display_name_local": "臺灣",
            "is_colony": True,
            "colonial_ruler": "Imperial Japan",
            "colonial_note": "Under Imperial Japan Rule",
            "capital_coords": [121.56, 25.03],
            "fill_color": "#F4D03F",
            "confidence": "high",
        },
    ],
}

# ── 연도 범위별 오버라이드 (같은 NAME이 시대별로 의미가 다를 때) ──
# [cl] (NAME, start_year, end_year): { 오버라이드 필드 }
# colony=True + ruler 지정 시 식민지 표시 오버라이드 가능
YEAR_RANGE_OVERRIDES = {
    # ━━━ 한국: 신라→통일신라 (668-935, 삼국통일 이후) ━━━
    ("Silla", 668, 935): {
        "name_local": "통일신라", "name_en": "Unified Silla", "name_ko": "통일신라",
    },
    # ━━━ 진(晉): 서진 (265-316) ━━━
    ("Jin", 265, 316): {
        "name_local": "西晉", "name_en": "Western Jin", "name_ko": "서진",
    },
    # ━━━ 진(晉): 동진 (317-420) ━━━
    ("Jin", 317, 420): {
        "name_local": "東晉", "name_en": "Eastern Jin", "name_ko": "동진",
    },
    # ━━━ Jin Empire: 동진/남조 (265-600, HB에서 "Jin Empire"로 표기) ━━━
    ("Jin Empire", 265, 600): {
        "name_local": "東晉", "name_en": "Eastern Jin", "name_ko": "동진",
    },
    # ━━━ Jin Empire: 여진 금(金) (1115-1234, 만주 팔레트로 전환) ━━━
    ("Jin Empire", 1115, 1234): {
        "name_local": "金", "name_en": "Jin Dynasty (Jurchen)", "name_ko": "금나라",
        "palette": "Manchuria",
    },
    # ━━━ 한국: 고려 (918-1392, HB에서 "Korea"로 표기되는 시기) ━━━
    ("Korea", 918, 1392): {
        "name_local": "고려", "name_en": "Goryeo", "name_ko": "고려",
    },
    # ━━━ 한국: 대한제국 (1897-1910, 독립) ━━━
    ("Korea", 1897, 1910): {
        "name_local": "대한제국", "name_en": "Korean Empire",
    },
    # ━━━ 한국: 일제강점기 (1910-1945, 식민지) ━━━
    ("Korea", 1910, 1945): {
        "name_local": "대한제국", "name_en": "Korea", "name_ko": "대한제국",
        "colony": True, "ruler": "大日本帝国",
    },
    # ━━━ 일본: 대일본제국 (1868-1947) ━━━
    ("Japan", 1868, 1947): {
        "name_local": "大日本帝国", "name_en": "Empire of Japan",
    },
    # ━━━ 중국: 대청제국 (CShapes "China" 1886-1911) ━━━
    ("China", 1886, 1911): {
        "name_local": "大清帝國", "name_en": "Qing Dynasty",
    },
    # ━━━ 중국: 중화민국 (1912-1949) ━━━
    ("China", 1912, 1949): {
        "name_local": "中華民國", "name_en": "Republic of China",
    },
    # ━━━ 대만: 일본 식민지 (1895-1945) ━━━
    ("Taiwan", 1895, 1945): {
        "name_local": "臺灣", "name_en": "Taiwan",
        "colony": True, "ruler": "大日本帝国",
    },
    # ━━━ 로마: BC 시기 "Rome" → 로마 공화국 (HB 데이터가 "Rome"과 "Roman Republic"을 혼용) ━━━
    ("Rome", -753, -27): {
        "name_local": "SPQR", "name_en": "Roman Republic", "name_ko": "로마 공화국",
    },
    # ━━━ 로마: 300년 사분통치 → 한국어 이름 ━━━
    ("Rome (Constantinus)", 250, 340): {
        "name_local": "SPQR", "name_en": "Roman Empire (Constantine)", "name_ko": "로마 제국 (콘스탄티누스)",
    },
    ("Rome (Diocletianus)", 250, 340): {
        "name_local": "SPQR", "name_en": "Roman Empire (Diocletian)", "name_ko": "로마 제국 (디오클레티아누스)",
    },
    ("Rome (Galerius)", 250, 340): {
        "name_local": "SPQR", "name_en": "Roman Empire (Galerius)", "name_ko": "로마 제국 (갈레리우스)",
    },
    ("Rome (Maximian)", 250, 340): {
        "name_local": "SPQR", "name_en": "Roman Empire (Maximian)", "name_ko": "로마 제국 (막시미아누스)",
    },
}


def generate_entity_metadata(original_name, year, coords=None):
    """단일 Entity의 메타데이터를 규칙에 따라 생성.
    coords: (lng, lat) 좌표 — 미매핑 엔티티의 지역 팔레트 결정용.
    """
    if original_name in ENTITY_RULES:
        rule = ENTITY_RULES[original_name]
        is_colony = rule.get("colony", False)

        metadata = {
            "display_name_en": rule["name_en"],
            "display_name_local": rule["name_local"],
            "is_colony": is_colony,
            "fill_color": PALETTES.get(rule["palette"], PALETTES["Default"]),
            "confidence": "high",
        }

        # [cl] 연도 범위 오버라이드 적용 (시대별 국명/식민지 상태 변경)
        for (oname, start, end), override in YEAR_RANGE_OVERRIDES.items():
            if oname == original_name and start <= year <= end:
                metadata["display_name_en"] = override["name_en"]
                metadata["display_name_local"] = override["name_local"]
                # [cl] 한국어 이름 오버라이드 (name_en → KOREAN_NAMES 매핑이 부정확할 때)
                if override.get("name_ko"):
                    metadata["_ko_override"] = override["name_ko"]
                # [cl] 팔레트 오버라이드 (같은 이름이 시대별로 다른 세력일 때)
                if override.get("palette"):
                    metadata["fill_color"] = PALETTES.get(override["palette"], metadata["fill_color"])
                # 오버라이드에 식민지 정보가 있으면 적용
                if override.get("colony"):
                    metadata["is_colony"] = True
                    is_colony = True
                    if override.get("ruler"):
                        metadata["colonial_ruler"] = override["ruler"]
                        metadata["colonial_note"] = f"Under {override['ruler']} Rule"
                break  # 첫 매칭만 적용

        # [cl] ENTITY_RULES 기본 ruler (오버라이드가 없을 때만)
        if rule.get("ruler") and "colonial_ruler" not in metadata:
            metadata["colonial_ruler"] = rule["ruler"]
            metadata["colonial_note"] = f"Under {rule['ruler']} Rule"
        if rule.get("independence"):
            metadata["independence_year"] = rule["independence"]

        # [cl] capital_coords 추가 (라벨 위치 결정용)
        if original_name in CAPITAL_COORDS:
            metadata["capital_coords"] = CAPITAL_COORDS[original_name]

    else:
        # [cl] 좌표 기반 지역 팔레트 자동 배정 — 회색 대신 해당 지역 색상 사용
        auto_palette = "Default"
        if coords:
            lng, lat = coords
            region = classify_region_by_coords(lat, lng)
            if region and region in REGION_PALETTE_MAP:
                auto_palette = REGION_PALETTE_MAP[region]
        metadata = {
            "display_name_en": original_name,
            "display_name_local": original_name,
            "is_colony": False,
            "fill_color": PALETTES.get(auto_palette, PALETTES["Default"]),
            "confidence": "low",
        }

    # [cl] 한국어 국명 추가 + display_name을 "한국어 (영어)" 형식으로 생성
    # _ko_override가 있으면 우선 사용 (YEAR_RANGE_OVERRIDES의 name_ko)
    ko_name = metadata.pop("_ko_override", None) or get_korean_name(metadata["display_name_en"])
    metadata["display_name_ko"] = ko_name
    en_base = metadata["display_name_en"].split("(")[0].strip()
    metadata["display_name"] = f"{ko_name} ({en_base})" if ko_name != en_base else ko_name

    # [cl] 식민지 지배국명 한국어 추가
    if metadata.get("colonial_ruler"):
        metadata["colonial_ruler_ko"] = RULER_NAMES_KO.get(
            metadata["colonial_ruler"], metadata["colonial_ruler"])

    return metadata


def _get_centroid(geometry):
    """GeoJSON geometry에서 대략적 중심점(lng, lat) 추출."""
    coords = geometry.get("coordinates", [])
    if not coords:
        return (0, 0)
    # 가장 깊은 좌표 리스트까지 파고들기
    flat = coords
    while flat and isinstance(flat[0], list):
        flat = flat[0]
    if len(flat) >= 2:
        return (flat[0], flat[1])  # (lng, lat)
    return (0, 0)


# [cl] 좌표 기반 지역 자동 분류 → 미매핑 엔티티에 회색 대신 지역 팔레트 배정
REGION_PALETTE_MAP = {
    "EastAsia":     "EastAsia",
    "SoutheastAsia":"SoutheastAsia",
    "SouthAsia":    "SouthAsia",
    "WestAsia":     "Islamic_Arab",
    "Europe":       "EastEurope",
    "EastEurope":   "Russian",
    "Africa":       "Africa_West",
    "NorthAmerica": "US",
    "SouthAmerica": "LatinAmerica",
    "Oceania":      "Oceania",
    "Arctic":       "Nordic",
}

def classify_region_by_coords(lat, lng):
    """위경도로 지역 분류 → REGION_PALETTE_MAP 키 반환."""
    if lat > 65: return "Arctic"
    if 20 < lat < 55 and 100 < lng < 145: return "EastAsia"
    if -10 < lat < 25 and 95 < lng < 145: return "SoutheastAsia"
    if 5 < lat < 40 and 60 < lng < 100: return "SouthAsia"
    if 10 < lat < 50 and 25 < lng < 65: return "WestAsia"
    if 35 < lat < 72 and -12 < lng < 30: return "Europe"
    if 35 < lat < 65 and 30 < lng < 65: return "EastEurope"
    if -35 < lat < 38 and -20 < lng < 55: return "Africa"
    if 5 < lat < 72 and -170 < lng < -50: return "NorthAmerica"
    if -60 < lat < 15 and -90 < lng < -30: return "SouthAmerica"
    if -50 < lat < 5 and 100 < lng < 180: return "Oceania"
    return None


def extract_names_from_geojson(geojson_path):
    """GeoJSON 파일에서 고유 NAME 목록 + 중심 좌표 추출."""
    with open(geojson_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    entities = {}  # name → (lng, lat)
    for feature in data.get("features", []):
        name = feature.get("properties", {}).get("NAME")
        if name and name not in entities:
            lng, lat = _get_centroid(feature.get("geometry", {}))
            entities[name] = (lng, lat)
    return entities


def create_snapshot_json(year, entities, output_dir):
    """특정 연도의 메타데이터 JSON 생성.
    entities: dict {name: (lng, lat)} 또는 list [name, ...]
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # 하위호환: list면 좌표 없음
    if isinstance(entities, list):
        entities = {n: None for n in entities}

    snapshot_data = {}
    for name, coords in entities.items():
        snapshot_data[name] = generate_entity_metadata(name, year, coords)

    # [cl] 식민지 가상 엔트리 삽입 (피지배국 이름 우선 표기 원칙)
    virtual_count = 0
    for (parent, start, end), overlays in COLONIAL_OVERLAYS.items():
        if parent in snapshot_data and start <= year <= end:
            for overlay in overlays:
                key = overlay["key"]
                if key not in snapshot_data:
                    entry = {k: v for k, v in overlay.items() if k != "key"}
                    # [cl] 가상 엔트리에도 한국어 필드 추가
                    en_name = entry.get("display_name_en", "")
                    ko_name = get_korean_name(en_name)
                    entry["display_name_ko"] = ko_name
                    en_base = en_name.split("(")[0].strip()
                    entry["display_name"] = f"{ko_name} ({en_base})" if ko_name != en_base else ko_name
                    if entry.get("colonial_ruler"):
                        entry["colonial_ruler_ko"] = RULER_NAMES_KO.get(
                            entry["colonial_ruler"], entry["colonial_ruler"])
                    snapshot_data[key] = entry
                    virtual_count += 1

    output_path = os.path.join(output_dir, f"{year}.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(snapshot_data, f, ensure_ascii=False, separators=(",", ":"))

    high = sum(1 for v in snapshot_data.values() if v.get("confidence") == "high")
    low = sum(1 for v in snapshot_data.values() if v.get("confidence") == "low")
    size_kb = os.path.getsize(output_path) / 1024
    virt_str = f" virtual:{virtual_count}" if virtual_count else ""
    print(f"  [{year}] {len(entities)} entities | high:{high} low:{low}{virt_str} | {size_kb:.1f}KB")
    return high, low


if __name__ == "__main__":
    import glob

    GEOJSON_DIR = os.path.join(os.getcwd(), "public", "geo", "borders")
    OUTPUT_DIR = os.path.join(GEOJSON_DIR, "metadata")

    # [cl] historical-basemaps 스냅샷 (world_*.geojson) 자동 탐색
    # 파일명 형식: world_bc3000.geojson (BC=음수), world_1880.geojson (AD=양수)
    import re
    HB_SNAPSHOTS = []
    for path in sorted(glob.glob(os.path.join(GEOJSON_DIR, "world_*.geojson"))):
        fname = os.path.basename(path)
        m = re.match(r"world_(bc)?(\d+)\.geojson", fname)
        if m:
            year = -int(m.group(2)) if m.group(1) else int(m.group(2))
            HB_SNAPSHOTS.append((year, fname))
    HB_SNAPSHOTS.sort(key=lambda x: x[0])

    # [cl] CShapes 2.0 스냅샷 (cshapes_*.geojson) 자동 탐색
    CS_SNAPSHOTS = []
    for path in sorted(glob.glob(os.path.join(GEOJSON_DIR, "cshapes_*.geojson"))):
        fname = os.path.basename(path)
        year = int(fname.replace("cshapes_", "").replace(".geojson", ""))
        CS_SNAPSHOTS.append((year, fname))

    # [cl] CShapes가 있는 연도는 HB 제외 (index.json도 CShapes를 사용)
    cs_years = {y for y, _ in CS_SNAPSHOTS}
    HB_FILTERED = [(y, f) for y, f in HB_SNAPSHOTS if y not in cs_years]
    ALL_SNAPSHOTS = HB_FILTERED + CS_SNAPSHOTS
    ALL_SNAPSHOTS.sort(key=lambda x: x[0])

    print(f"=== 역사 국경 메타데이터 생성 (규칙: {len(ENTITY_RULES)}개) ===")
    print(f"    HB: {len(HB_FILTERED)}개 (원본 {len(HB_SNAPSHOTS)}개, CShapes 중복 {len(HB_SNAPSHOTS)-len(HB_FILTERED)}개 제외)")
    print(f"    CShapes: {len(CS_SNAPSHOTS)}개 | 총: {len(ALL_SNAPSHOTS)}개\n")

    total_high = 0
    total_low = 0
    for year, filename in ALL_SNAPSHOTS:
        geojson_path = os.path.join(GEOJSON_DIR, filename)
        if not os.path.exists(geojson_path):
            print(f"  [{year}] SKIP - {filename} not found")
            continue
        entities = extract_names_from_geojson(geojson_path)
        h, l = create_snapshot_json(year, entities, OUTPUT_DIR)
        total_high += h
        total_low += l

    print(f"\n완료! 규칙 매칭: {total_high} | 수동 검수 필요: {total_low}")
    print(f"출력: {OUTPUT_DIR}/")
