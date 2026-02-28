#!/usr/bin/env python3
# [cl] 역사 국경 메타데이터 일괄 생성 스크립트
# 원본 뼈대: 지훈(Gemini), 규칙 확충: 민철(Claude)
# 사용법: python3 scripts/geo/generateBorderMetadata.py

import json
import os

# ── 문명권 기반 색상 팔레트 ──
PALETTES = {
    "EastAsia":      "#F4D03F",  # 중국 왕조 (골드)
    "Korea":         "#45B39D",  # 한국 (청자색)
    "Japan":         "#E74C3C",  # 일본 (적색)
    "SoutheastAsia": "#27AE60",  # 동남아 (녹색)
    "SouthAsia":     "#E67E22",  # 남아시아 (오렌지)
    "British":       "#F5B7B1",  # 대영제국 (핑크)
    "French":        "#5DADE2",  # 프랑스 (블루)
    "Spanish_Port":  "#EB984E",  # 스페인/포르투갈 (테라코타)
    "Roman_Italy":   "#8E44AD",  # 로마/이탈리아 (보라)
    "Germanic":      "#CD6155",  # 독일/오스트리아 (다크 레드)
    "Russian":       "#7FB3D8",  # 러시아 (라이트 블루)
    "Nordic":        "#85C1E9",  # 북유럽/기타 유럽 (스카이)
    "Islamic":       "#58D68D",  # 이슬람 권역 (녹색)
    "US":            "#34495E",  # 미국 (네이비)
    "LatinAmerica":  "#F5B041",  # 라틴아메리카 (옐로우)
    "Africa":        "#D4AC0D",  # 아프리카 (골드)
    "Oceania":       "#48C9B0",  # 오세아니아 (민트)
    "Default":       "#D5D8DC",  # 미분류 (회색)
}

# ── 핵심 매핑 규칙 (original GeoJSON NAME → 메타데이터) ──
# colony=True인 경우 피지배국 이름을 우선 (자기결정권 원칙)
ENTITY_RULES = {
    # ━━━ 동아시아: 중국 ━━━
    "Manchu Empire":    {"name_local": "大清帝國", "name_en": "Qing Dynasty", "palette": "EastAsia"},
    "China":            {"name_local": "中国", "name_en": "China", "palette": "EastAsia"},
    "Chinese Warlords": {"name_local": "中国 (军阀时期)", "name_en": "China (Warlord Era)", "palette": "EastAsia"},
    "Chinese warlords": {"name_local": "中国 (军阀时期)", "name_en": "China (Warlord Era)", "palette": "EastAsia"},
    "Manchuria":        {"name_local": "满洲", "name_en": "Manchuria", "palette": "EastAsia"},
    "Xinjiang":         {"name_local": "新疆", "name_en": "Xinjiang", "palette": "EastAsia"},
    "Taiwan":           {"name_local": "臺灣", "name_en": "Taiwan", "palette": "EastAsia"},
    "Hong Kong":        {"name_local": "香港", "name_en": "Hong Kong", "colony": True, "ruler": "British Empire", "palette": "EastAsia"},
    "Tibet":            {"name_local": "བོད", "name_en": "Tibet", "palette": "EastAsia"},
    "Mongolia":         {"name_local": "Монгол Улс", "name_en": "Mongolia", "palette": "EastAsia"},

    # ━━━ 동아시아: 한국 ━━━
    "Korea":            {"name_local": "조선", "name_en": "Joseon", "palette": "Korea"},
    "Korea (USA)":      {"name_local": "한국 (미군정)", "name_en": "Korea (US Zone)", "colony": True, "ruler": "United States", "palette": "Korea"},
    "Korea (USSR)":     {"name_local": "한국 (소군정)", "name_en": "Korea (Soviet Zone)", "colony": True, "ruler": "USSR", "palette": "Korea"},
    "Korea, Republic of":                       {"name_local": "대한민국", "name_en": "Republic of Korea", "palette": "Korea"},
    "Korea, Democratic People's Republic of":    {"name_local": "조선민주주의인민공화국", "name_en": "DPRK", "palette": "Korea"},

    # ━━━ 동아시아: 일본 ━━━
    "Imperial Japan":   {"name_local": "大日本帝国", "name_en": "Empire of Japan", "palette": "Japan"},
    "Empire of Japan":  {"name_local": "大日本帝国", "name_en": "Empire of Japan", "palette": "Japan"},
    "Japan":            {"name_local": "日本", "name_en": "Japan", "palette": "Japan"},
    "Japan (USA)":      {"name_local": "日本 (連合国占領)", "name_en": "Japan (Allied Occupation)", "colony": True, "ruler": "United States", "palette": "Japan"},

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
    "Cambodia":             {"name_local": "កម្ពុជា", "name_en": "Cambodia", "palette": "SoutheastAsia"},
    "Laos":                 {"name_local": "ລາວ", "name_en": "Laos", "palette": "SoutheastAsia"},
    "Burma":                {"name_local": "မြန်မာ", "name_en": "Myanmar (Burma)", "colony": True, "ruler": "British Empire", "palette": "SoutheastAsia"},
    "Philippines":          {"name_local": "Pilipinas", "name_en": "Philippines", "palette": "SoutheastAsia"},
    "Dutch East Indies":    {"name_local": "Indonesia", "name_en": "Indonesia (1945)", "colony": True, "ruler": "Netherlands", "independence": 1945, "palette": "SoutheastAsia"},
    "Netherlands Indies":   {"name_local": "Indonesia", "name_en": "Indonesia (1945)", "colony": True, "ruler": "Netherlands", "independence": 1945, "palette": "SoutheastAsia"},
    "Indonesia":            {"name_local": "Indonesia", "name_en": "Indonesia", "palette": "SoutheastAsia"},
    "Malaya":               {"name_local": "Tanah Melayu", "name_en": "Malaya", "colony": True, "ruler": "British Empire", "palette": "SoutheastAsia"},
    "Malaysia":             {"name_local": "Malaysia", "name_en": "Malaysia", "palette": "SoutheastAsia"},
    "Brunei":               {"name_local": "Brunei", "name_en": "Brunei", "palette": "SoutheastAsia"},

    # ━━━ 남아시아 ━━━
    "British Raj":  {"name_local": "भारत", "name_en": "India", "colony": True, "ruler": "British Empire", "palette": "SouthAsia"},
    "India":        {"name_local": "भारत", "name_en": "India", "palette": "SouthAsia"},
    "Pakistan":     {"name_local": "پاکستان", "name_en": "Pakistan", "palette": "SouthAsia"},
    "Bangladesh":   {"name_local": "বাংলাদেশ", "name_en": "Bangladesh", "palette": "SouthAsia"},
    "Nepal":        {"name_local": "नेपाल", "name_en": "Nepal", "palette": "SouthAsia"},
    "Bhutan":       {"name_local": "འབྲུག", "name_en": "Bhutan", "palette": "SouthAsia"},
    "Sri Lanka":    {"name_local": "ශ්‍රී ලංකා", "name_en": "Sri Lanka", "palette": "SouthAsia"},
    "Ceylon":       {"name_local": "ශ්‍රී ලංකා", "name_en": "Sri Lanka (Ceylon)", "colony": True, "ruler": "British Empire", "palette": "SouthAsia"},

    # ━━━ 중동 / 서아시아 ━━━
    "Ottoman Empire":    {"name_local": "دولت عثمانیه", "name_en": "Ottoman Empire", "palette": "Islamic"},
    "Ottoman Sultanate": {"name_local": "دولت عثمانیه", "name_en": "Ottoman Sultanate", "palette": "Islamic"},
    "Turkey":            {"name_local": "Türkiye", "name_en": "Turkey", "palette": "Islamic"},
    "Persia":            {"name_local": "ایران", "name_en": "Persia", "palette": "Islamic"},
    "Iran":              {"name_local": "ایران", "name_en": "Iran", "palette": "Islamic"},
    "Iraq":              {"name_local": "العراق", "name_en": "Iraq", "palette": "Islamic"},
    "Mesopotamia (GB)":  {"name_local": "العراق", "name_en": "Iraq", "colony": True, "ruler": "British Empire", "palette": "Islamic"},
    "Saudi Arabia":      {"name_local": "المملكة العربية السعودية", "name_en": "Saudi Arabia", "palette": "Islamic"},
    "Arabia":            {"name_local": "العرب", "name_en": "Arabia", "palette": "Islamic"},
    "Arabia (Nejd)":     {"name_local": "نجد", "name_en": "Nejd", "palette": "Islamic"},
    "Hejaz":             {"name_local": "الحجاز", "name_en": "Hejaz", "palette": "Islamic"},
    "Hail":              {"name_local": "حائل", "name_en": "Ha'il Emirate", "palette": "Islamic"},
    "Emirate of Bin Shal'an": {"name_local": "إمارة", "name_en": "Rashidi Emirate", "palette": "Islamic"},
    "Yemen":             {"name_local": "اليمن", "name_en": "Yemen", "palette": "Islamic"},
    "Yemen (UK)":        {"name_local": "اليمن", "name_en": "Yemen (Aden)", "colony": True, "ruler": "British Empire", "palette": "Islamic"},
    "Oman":              {"name_local": "عُمان", "name_en": "Oman", "palette": "Islamic"},
    "Muscat and Oman":   {"name_local": "عُمان", "name_en": "Oman (Muscat)", "palette": "Islamic"},
    "Oman (British Raj)":{"name_local": "عُمان", "name_en": "Oman", "colony": True, "ruler": "British Empire", "palette": "Islamic"},
    "Trucial Oman":      {"name_local": "الإمارات", "name_en": "Trucial States", "colony": True, "ruler": "British Empire", "palette": "Islamic"},
    "United Arab Emirates":{"name_local": "الإمارات", "name_en": "UAE", "palette": "Islamic"},
    "Qatar":             {"name_local": "قطر", "name_en": "Qatar", "palette": "Islamic"},
    "Kuwait":            {"name_local": "الكويت", "name_en": "Kuwait", "palette": "Islamic"},
    "Jordan":            {"name_local": "الأردن", "name_en": "Jordan", "palette": "Islamic"},
    "Israel":            {"name_local": "ישראל / فلسطين", "name_en": "Israel/Palestine", "palette": "Islamic"},
    "Lebanon":           {"name_local": "لبنان", "name_en": "Lebanon", "palette": "Islamic"},
    "Syria":             {"name_local": "سوريا", "name_en": "Syria", "palette": "Islamic"},
    "Syria (France)":    {"name_local": "سوريا", "name_en": "Syria", "colony": True, "ruler": "France", "palette": "Islamic"},
    "Mandatory Palestine (GB)": {"name_local": "فلسطين", "name_en": "Palestine", "colony": True, "ruler": "British Empire", "palette": "Islamic"},
    "Afghanistan":       {"name_local": "افغانستان", "name_en": "Afghanistan", "palette": "Islamic"},
    "Egypt":             {"name_local": "مصر", "name_en": "Egypt", "palette": "Islamic"},
    "central Asian khanates": {"name_local": "وسط آسیا", "name_en": "Central Asian Khanates", "palette": "Islamic"},
    "Bokhara Khanate":   {"name_local": "بخارا", "name_en": "Bukhara Khanate", "palette": "Islamic"},

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
    "Austro-Hungarian Empire": {"name_local": "Österreich-Ungarn", "name_en": "Austria-Hungary", "palette": "Germanic"},
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
    "Greece":            {"name_local": "Ελλάδα", "name_en": "Greece", "palette": "Nordic"},
    "Poland":            {"name_local": "Polska", "name_en": "Poland", "palette": "Nordic"},
    "Hungary":           {"name_local": "Magyarország", "name_en": "Hungary", "palette": "Nordic"},
    "Romania":           {"name_local": "România", "name_en": "Romania", "palette": "Nordic"},
    "Bulgaria":          {"name_local": "България", "name_en": "Bulgaria", "palette": "Nordic"},
    "Serbia":            {"name_local": "Србија", "name_en": "Serbia", "palette": "Nordic"},
    "Montenegro":        {"name_local": "Crna Gora", "name_en": "Montenegro", "palette": "Nordic"},
    "Albania":           {"name_local": "Shqipëria", "name_en": "Albania", "palette": "Nordic"},
    "Croatia":           {"name_local": "Hrvatska", "name_en": "Croatia", "palette": "Nordic"},
    "Slovenia":          {"name_local": "Slovenija", "name_en": "Slovenia", "palette": "Nordic"},
    "Bosnia and Herzegovina": {"name_local": "Bosna i Hercegovina", "name_en": "Bosnia and Herzegovina", "palette": "Nordic"},
    "Bosnia-Herzegovina":{"name_local": "Bosna i Hercegovina", "name_en": "Bosnia-Herzegovina", "palette": "Nordic"},
    "Yugoslavia":        {"name_local": "Jugoslavija", "name_en": "Yugoslavia", "palette": "Nordic"},
    "Czechoslovakia":    {"name_local": "Československo", "name_en": "Czechoslovakia", "palette": "Nordic"},
    "Czech Republic":    {"name_local": "Česko", "name_en": "Czech Republic", "palette": "Nordic"},
    "Slovakia":          {"name_local": "Slovensko", "name_en": "Slovakia", "palette": "Nordic"},
    "Estonia":           {"name_local": "Eesti", "name_en": "Estonia", "palette": "Nordic"},
    "Latvia":            {"name_local": "Latvija", "name_en": "Latvia", "palette": "Nordic"},
    "Lithuania":         {"name_local": "Lietuva", "name_en": "Lithuania", "palette": "Nordic"},
    "Moldova":           {"name_local": "Moldova", "name_en": "Moldova", "palette": "Nordic"},
    "Ukraine":           {"name_local": "Україна", "name_en": "Ukraine", "palette": "Nordic"},
    "Byelarus":          {"name_local": "Беларусь", "name_en": "Belarus", "palette": "Nordic"},
    "White Russia":      {"name_local": "Беларусь", "name_en": "Belarus (SSR)", "palette": "Russian"},
    "Georgia":           {"name_local": "საქართველო", "name_en": "Georgia", "palette": "Nordic"},
    "Armenia":           {"name_local": "Հայաստան", "name_en": "Armenia", "palette": "Nordic"},
    "Azerbaijan":        {"name_local": "Azərbaycan", "name_en": "Azerbaijan", "palette": "Nordic"},
    "Kazakhstan":        {"name_local": "Қазақстан", "name_en": "Kazakhstan", "palette": "Islamic"},
    "Uzbekistan":        {"name_local": "Oʻzbekiston", "name_en": "Uzbekistan", "palette": "Islamic"},
    "Turkmenistan":      {"name_local": "Türkmenistan", "name_en": "Turkmenistan", "palette": "Islamic"},
    "Kyrgyzstan":        {"name_local": "Кыргызстан", "name_en": "Kyrgyzstan", "palette": "Islamic"},
    "Tajikistan":        {"name_local": "Тоҷикистон", "name_en": "Tajikistan", "palette": "Islamic"},
    "Far Eastern SSR":   {"name_local": "ДВР", "name_en": "Far Eastern Republic", "palette": "Russian"},
    "South Russia":      {"name_local": "Россия", "name_en": "South Russia", "palette": "Russian"},
    "Andorra":           {"name_local": "Andorra", "name_en": "Andorra", "palette": "Nordic"},
    "Liechtenstein":     {"name_local": "Liechtenstein", "name_en": "Liechtenstein", "palette": "Nordic"},
    "Malta":             {"name_local": "Malta", "name_en": "Malta", "palette": "Nordic"},
    "Macedonia":         {"name_local": "Македонија", "name_en": "North Macedonia", "palette": "Nordic"},
    "Cyprus":            {"name_local": "Κύπρος", "name_en": "Cyprus", "palette": "Nordic"},
    "Turkish Cypriot-administered area": {"name_local": "Kuzey Kıbrıs", "name_en": "Northern Cyprus", "palette": "Islamic"},
    "Greenland":         {"name_local": "Kalaallit Nunaat", "name_en": "Greenland", "palette": "Nordic"},
    "Saar Protectorate": {"name_local": "Saarland", "name_en": "Saar Protectorate", "colony": True, "ruler": "France", "palette": "French"},
    "Dominion of Newfoundland": {"name_local": "Newfoundland", "name_en": "Newfoundland", "palette": "British"},
    "Germany (France)":  {"name_local": "Deutschland", "name_en": "Germany (French Zone)", "colony": True, "ruler": "France", "palette": "Germanic"},
    "Germany (Soviet)":  {"name_local": "Deutschland", "name_en": "Germany (Soviet Zone)", "colony": True, "ruler": "USSR", "palette": "Germanic"},
    "Germany (UK)":      {"name_local": "Deutschland", "name_en": "Germany (British Zone)", "colony": True, "ruler": "British Empire", "palette": "Germanic"},
    "Germany (USA)":     {"name_local": "Deutschland", "name_en": "Germany (US Zone)", "colony": True, "ruler": "United States", "palette": "Germanic"},

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
    "Algeria":              {"name_local": "الجزائر", "name_en": "Algeria", "colony": True, "ruler": "France", "palette": "Islamic"},
    "Algeria (FR)":         {"name_local": "الجزائر", "name_en": "Algeria", "colony": True, "ruler": "France", "palette": "Islamic"},
    "Algeria (France)":     {"name_local": "الجزائر", "name_en": "Algeria", "colony": True, "ruler": "France", "palette": "Islamic"},
    "Morocco":              {"name_local": "المغرب", "name_en": "Morocco", "palette": "Islamic"},
    "Morocco (France)":     {"name_local": "المغرب", "name_en": "Morocco", "colony": True, "ruler": "France", "palette": "Islamic"},
    "Spanish Morocco":      {"name_local": "المغرب", "name_en": "Morocco (Spanish Zone)", "colony": True, "ruler": "Spain", "palette": "Spanish_Port"},
    "Tunisia":              {"name_local": "تونس", "name_en": "Tunisia", "colony": True, "ruler": "France", "palette": "Islamic"},
    "Libya":                {"name_local": "ليبيا", "name_en": "Libya", "palette": "Islamic"},
    "Libya (IT)":           {"name_local": "ليبيا", "name_en": "Libya", "colony": True, "ruler": "Italy", "palette": "Islamic"},
    "Cyraneica (UK Lybia)": {"name_local": "ليبيا", "name_en": "Libya (Cyrenaica)", "colony": True, "ruler": "British Empire", "palette": "Islamic"},
    "Tripolitana (UK Lybia)":{"name_local": "ليبيا", "name_en": "Libya (Tripolitania)", "colony": True, "ruler": "British Empire", "palette": "Islamic"},
    "Fezzan (Frech Lybia)": {"name_local": "ليبيا", "name_en": "Libya (Fezzan)", "colony": True, "ruler": "France", "palette": "French"},
    "Rio De Oro":           {"name_local": "الصحراء الغربية", "name_en": "Western Sahara", "colony": True, "ruler": "Spain", "palette": "Spanish_Port"},
    "Western Sahara":       {"name_local": "الصحراء الغربية", "name_en": "Western Sahara", "palette": "Islamic"},
    "Spanish Sahara":       {"name_local": "الصحراء الغربية", "name_en": "Western Sahara", "colony": True, "ruler": "Spain", "palette": "Spanish_Port"},
    "Sudan":                {"name_local": "السودان", "name_en": "Sudan", "palette": "Africa"},
    "Anglo-Egyption Sudan": {"name_local": "السودان", "name_en": "Sudan", "colony": True, "ruler": "British Empire", "palette": "Africa"},

    # ━━━ 아프리카: 동부 ━━━
    "Ethiopia":             {"name_local": "ኢትዮጵያ", "name_en": "Ethiopia", "palette": "Africa"},
    "Abyssinia":            {"name_local": "ኢትዮጵያ", "name_en": "Ethiopia (Abyssinia)", "palette": "Africa"},
    "Ethiopia (Italy)":     {"name_local": "ኢትዮጵያ", "name_en": "Ethiopia", "colony": True, "ruler": "Italy", "palette": "Africa"},
    "Eritrea":              {"name_local": "ኤርትራ", "name_en": "Eritrea", "colony": True, "ruler": "Italy", "palette": "Africa"},
    "Eritrea (Italy)":      {"name_local": "ኤርትራ", "name_en": "Eritrea", "colony": True, "ruler": "Italy", "palette": "Africa"},
    "Somalia":              {"name_local": "Soomaaliya", "name_en": "Somalia", "palette": "Africa"},
    "British Somaliland":   {"name_local": "Soomaaliya", "name_en": "Somalia (1960)", "colony": True, "ruler": "British Empire", "independence": 1960, "palette": "Africa"},
    "Italian Somaliland":   {"name_local": "Soomaaliya", "name_en": "Somalia (1960)", "colony": True, "ruler": "Italy", "independence": 1960, "palette": "Africa"},
    "French Somaliland":    {"name_local": "Djibouti", "name_en": "Djibouti (1977)", "colony": True, "ruler": "France", "independence": 1977, "palette": "Africa"},
    "Djibouti":             {"name_local": "Djibouti", "name_en": "Djibouti", "palette": "Africa"},
    "Kenya":                {"name_local": "Kenya", "name_en": "Kenya", "palette": "Africa"},
    "British East Africa":  {"name_local": "Kenya", "name_en": "Kenya (1963)", "colony": True, "ruler": "British Empire", "independence": 1963, "palette": "Africa"},
    "Uganda":               {"name_local": "Uganda", "name_en": "Uganda", "palette": "Africa"},
    "Tanzania, United Republic of": {"name_local": "Tanzania", "name_en": "Tanzania", "palette": "Africa"},
    "German E. Africa (Tanganyika)": {"name_local": "Tanzania", "name_en": "Tanzania (1961)", "colony": True, "ruler": "Germany", "independence": 1961, "palette": "Africa"},
    "Rwanda":               {"name_local": "Rwanda", "name_en": "Rwanda", "palette": "Africa"},
    "Rwanda (Belgium)":     {"name_local": "Rwanda", "name_en": "Rwanda", "colony": True, "ruler": "Belgium", "palette": "Africa"},
    "Burundi":              {"name_local": "Burundi", "name_en": "Burundi", "palette": "Africa"},
    "Madagascar":           {"name_local": "Madagasikara", "name_en": "Madagascar", "palette": "Africa"},
    "Madagascar (France)":  {"name_local": "Madagasikara", "name_en": "Madagascar", "colony": True, "ruler": "France", "palette": "Africa"},
    "Imerina":              {"name_local": "Madagasikara", "name_en": "Madagascar (Merina)", "palette": "Africa"},

    # ━━━ 아프리카: 서부 ━━━
    "Nigeria":              {"name_local": "Nigeria", "name_en": "Nigeria", "palette": "Africa"},
    "Ghana":                {"name_local": "Ghana", "name_en": "Ghana", "palette": "Africa"},
    "Gold Coast":           {"name_local": "Ghana", "name_en": "Ghana (1957)", "colony": True, "ruler": "British Empire", "independence": 1957, "palette": "Africa"},
    "Gold Coast (GB)":      {"name_local": "Ghana", "name_en": "Ghana (1957)", "colony": True, "ruler": "British Empire", "independence": 1957, "palette": "Africa"},
    "Sierra Leone":         {"name_local": "Sierra Leone", "name_en": "Sierra Leone", "palette": "Africa"},
    "Liberia":              {"name_local": "Liberia", "name_en": "Liberia", "palette": "Africa"},
    "Senegal":              {"name_local": "Sénégal", "name_en": "Senegal", "palette": "Africa"},
    "Senegal (FR)":         {"name_local": "Sénégal", "name_en": "Senegal", "colony": True, "ruler": "France", "palette": "Africa"},
    "Gambia":               {"name_local": "Gambia", "name_en": "Gambia", "palette": "Africa"},
    "Gambia, The":          {"name_local": "Gambia", "name_en": "Gambia", "palette": "Africa"},
    "Guinea":               {"name_local": "Guinée", "name_en": "Guinea", "palette": "Africa"},
    "Guinea-Bissau":        {"name_local": "Guiné-Bissau", "name_en": "Guinea-Bissau", "palette": "Africa"},
    "Guinea-Bissau (Portugal)": {"name_local": "Guiné-Bissau", "name_en": "Guinea-Bissau", "colony": True, "ruler": "Portugal", "palette": "Africa"},
    "Portuguese Guinea":    {"name_local": "Guiné-Bissau", "name_en": "Guinea-Bissau (1974)", "colony": True, "ruler": "Portugal", "independence": 1974, "palette": "Africa"},
    "Portuguese East Africa":{"name_local": "Moçambique", "name_en": "Mozambique (1975)", "colony": True, "ruler": "Portugal", "independence": 1975, "palette": "Africa"},
    "Ivory Coast":          {"name_local": "Côte d'Ivoire", "name_en": "Côte d'Ivoire", "palette": "Africa"},
    "Burkina Faso":         {"name_local": "Burkina Faso", "name_en": "Burkina Faso", "palette": "Africa"},
    "Mali":                 {"name_local": "Mali", "name_en": "Mali", "palette": "Africa"},
    "Niger":                {"name_local": "Niger", "name_en": "Niger", "palette": "Africa"},
    "Chad":                 {"name_local": "Tchad", "name_en": "Chad", "palette": "Africa"},
    "Mauritania":           {"name_local": "موريتانيا", "name_en": "Mauritania", "palette": "Africa"},
    "Benin":                {"name_local": "Bénin", "name_en": "Benin", "palette": "Africa"},
    "Dahomey":              {"name_local": "Bénin", "name_en": "Benin (Dahomey)", "palette": "Africa"},
    "Togo":                 {"name_local": "Togo", "name_en": "Togo", "palette": "Africa"},
    "Togoland":             {"name_local": "Togo", "name_en": "Togo (Togoland)", "colony": True, "ruler": "Germany", "palette": "Africa"},
    "Cameroon":             {"name_local": "Cameroun", "name_en": "Cameroon", "palette": "Africa"},
    "Kamerun":              {"name_local": "Cameroun", "name_en": "Cameroon (Kamerun)", "colony": True, "ruler": "Germany", "palette": "Africa"},
    "French Cameroons":     {"name_local": "Cameroun", "name_en": "Cameroon", "colony": True, "ruler": "France", "palette": "Africa"},
    "Southern Cameroon":    {"name_local": "Cameroun", "name_en": "Cameroon (Southern)", "colony": True, "ruler": "British Empire", "palette": "Africa"},
    "Gabon":                {"name_local": "Gabon", "name_en": "Gabon", "palette": "Africa"},
    "Equatorial Guinea":    {"name_local": "Guinea Ecuatorial", "name_en": "Equatorial Guinea", "palette": "Africa"},
    "Spanish Guinea":       {"name_local": "Guinea Ecuatorial", "name_en": "Equatorial Guinea", "colony": True, "ruler": "Spain", "palette": "Africa"},
    "Central African Republic": {"name_local": "Centrafrique", "name_en": "Central African Republic", "palette": "Africa"},
    "Congo":                {"name_local": "Congo", "name_en": "Congo", "palette": "Africa"},
    "Congo (France)":       {"name_local": "Congo", "name_en": "Congo (French)", "colony": True, "ruler": "France", "palette": "Africa"},
    "Belgian Congo":        {"name_local": "Congo", "name_en": "DR Congo (1960)", "colony": True, "ruler": "Belgium", "independence": 1960, "palette": "Africa"},
    "Zaire":                {"name_local": "Congo", "name_en": "DR Congo", "palette": "Africa"},
    "Zaire (Belgium)":      {"name_local": "Congo", "name_en": "DR Congo (1960)", "colony": True, "ruler": "Belgium", "independence": 1960, "palette": "Africa"},
    "French West Africa":   {"name_local": "AOF", "name_en": "French West Africa", "colony": True, "ruler": "France", "palette": "French"},
    "French Equatorial Africa": {"name_local": "AEF", "name_en": "French Equatorial Africa", "colony": True, "ruler": "France", "palette": "French"},

    # ━━━ 아프리카: 남부 ━━━
    "South Africa":         {"name_local": "South Africa", "name_en": "South Africa", "palette": "Africa"},
    "Union of South Africa":{"name_local": "South Africa", "name_en": "South Africa", "palette": "Africa"},
    "Cape Colony":          {"name_local": "South Africa", "name_en": "South Africa (Cape Colony)", "colony": True, "ruler": "British Empire", "palette": "Africa"},
    "Natal":                {"name_local": "South Africa", "name_en": "South Africa (Natal)", "colony": True, "ruler": "British Empire", "palette": "Africa"},
    "Transvaal":            {"name_local": "South Africa", "name_en": "South Africa (Transvaal)", "palette": "Africa"},
    "Orange Free State":    {"name_local": "South Africa", "name_en": "South Africa (Orange Free State)", "palette": "Africa"},
    "Griqualand West":      {"name_local": "South Africa", "name_en": "South Africa (Griqualand)", "colony": True, "ruler": "British Empire", "palette": "Africa"},
    "Namibia":              {"name_local": "Namibia", "name_en": "Namibia", "palette": "Africa"},
    "German South-West Africa": {"name_local": "Namibia", "name_en": "Namibia (1990)", "colony": True, "ruler": "Germany", "independence": 1990, "palette": "Africa"},
    "Walbis Bay":           {"name_local": "Walvis Bay", "name_en": "Walvis Bay", "colony": True, "ruler": "British Empire", "palette": "Africa"},
    "Botswana":             {"name_local": "Botswana", "name_en": "Botswana", "palette": "Africa"},
    "Basutoland":           {"name_local": "Lesotho", "name_en": "Lesotho (1966)", "colony": True, "ruler": "British Empire", "independence": 1966, "palette": "Africa"},
    "Lesotho":              {"name_local": "Lesotho", "name_en": "Lesotho", "palette": "Africa"},
    "Swaziland":            {"name_local": "eSwatini", "name_en": "Eswatini", "palette": "Africa"},
    "Zimbabwe":             {"name_local": "Zimbabwe", "name_en": "Zimbabwe", "palette": "Africa"},
    "Rhodesia":             {"name_local": "Zimbabwe", "name_en": "Zimbabwe (Rhodesia)", "colony": True, "ruler": "British Empire", "palette": "Africa"},
    "Southern Rhodesia":    {"name_local": "Zimbabwe", "name_en": "Zimbabwe (Rhodesia)", "colony": True, "ruler": "British Empire", "palette": "Africa"},
    "Northern Rhodesia":    {"name_local": "Zambia", "name_en": "Zambia (1964)", "colony": True, "ruler": "British Empire", "independence": 1964, "palette": "Africa"},
    "Zambia":               {"name_local": "Zambia", "name_en": "Zambia", "palette": "Africa"},
    "Malawi":               {"name_local": "Malawi", "name_en": "Malawi", "palette": "Africa"},
    "Nyasaland":            {"name_local": "Malawi", "name_en": "Malawi (1964)", "colony": True, "ruler": "British Empire", "independence": 1964, "palette": "Africa"},
    "Mozambique":           {"name_local": "Moçambique", "name_en": "Mozambique", "palette": "Africa"},
    "Mozambique (Portugal)":{"name_local": "Moçambique", "name_en": "Mozambique", "colony": True, "ruler": "Portugal", "palette": "Africa"},
    "Angola":               {"name_local": "Angola", "name_en": "Angola", "palette": "Africa"},
    "Angola (Portugal)":    {"name_local": "Angola", "name_en": "Angola", "colony": True, "ruler": "Portugal", "palette": "Africa"},

    # ━━━ 아프리카: 왕국/소국 ━━━
    "Asante":       {"name_local": "Asante", "name_en": "Ashanti Empire", "palette": "Africa"},
    "Sokoto Caliphate": {"name_local": "Sokoto", "name_en": "Sokoto Caliphate", "palette": "Africa"},
    "Buganda":      {"name_local": "Buganda", "name_en": "Buganda Kingdom", "palette": "Africa"},
    "Bunyoro":      {"name_local": "Bunyoro", "name_en": "Bunyoro Kingdom", "palette": "Africa"},
    "Lozi":         {"name_local": "Lozi", "name_en": "Lozi Kingdom", "palette": "Africa"},
    "Luba":         {"name_local": "Luba", "name_en": "Luba Kingdom", "palette": "Africa"},
    "Lunda":        {"name_local": "Lunda", "name_en": "Lunda Empire", "palette": "Africa"},
    "Kuba":         {"name_local": "Kuba", "name_en": "Kuba Kingdom", "palette": "Africa"},
    "Ndebele":      {"name_local": "Ndebele", "name_en": "Ndebele Kingdom", "palette": "Africa"},
    "Shona":        {"name_local": "Shona", "name_en": "Shona", "palette": "Africa"},
    "Nguni":        {"name_local": "Nguni", "name_en": "Nguni", "palette": "Africa"},
    "Ngwato":       {"name_local": "Ngwato", "name_en": "Ngwato", "palette": "Africa"},
    "Oyo":          {"name_local": "Oyo", "name_en": "Oyo Empire", "palette": "Africa"},
    "Ibadan":       {"name_local": "Ibadan", "name_en": "Ibadan", "palette": "Africa"},
    "Lagos":        {"name_local": "Lagos", "name_en": "Lagos", "colony": True, "ruler": "British Empire", "palette": "Africa"},
    "Kanem-Bornu":  {"name_local": "Kanem-Bornu", "name_en": "Kanem-Bornu", "palette": "Africa"},
    "Mossi States": {"name_local": "Mossi", "name_en": "Mossi States", "palette": "Africa"},
    "Zululand":     {"name_local": "KwaZulu", "name_en": "Zululand", "palette": "Africa"},
    "Sultinate of Zanzibar": {"name_local": "Zanzibar", "name_en": "Zanzibar", "palette": "Africa"},
    "Harer (Egypt)":{"name_local": "Harar", "name_en": "Harar (Egyptian)", "colony": True, "ruler": "Egypt", "palette": "Africa"},
    "Teke":         {"name_local": "Teke", "name_en": "Teke Kingdom", "palette": "Africa"},
    "Yaka":         {"name_local": "Yaka", "name_en": "Yaka Kingdom", "palette": "Africa"},
    "Yeke":         {"name_local": "Yeke", "name_en": "Yeke Kingdom", "palette": "Africa"},
    "Mbailundu":    {"name_local": "Mbailundu", "name_en": "Mbailundu Kingdom", "palette": "Africa"},
    "Ovimbundu":    {"name_local": "Ovimbundu", "name_en": "Ovimbundu", "palette": "Africa"},
    "Calabar":      {"name_local": "Calabar", "name_en": "Calabar", "palette": "Africa"},
    "Opobo":        {"name_local": "Opobo", "name_en": "Opobo", "palette": "Africa"},
    "Barotse":      {"name_local": "Barotse", "name_en": "Barotse", "palette": "Africa"},
    "Cotonou":      {"name_local": "Cotonou", "name_en": "Cotonou", "colony": True, "ruler": "France", "palette": "Africa"},
    "Borgu States": {"name_local": "Borgu", "name_en": "Borgu States", "palette": "Africa"},
    "Dendi Kingdom":{"name_local": "Dendi", "name_en": "Dendi Kingdom", "palette": "Africa"},
    "Futa Jalon":   {"name_local": "Futa Jalon", "name_en": "Futa Jalon", "palette": "Africa"},
    "Futa Toro":    {"name_local": "Futa Toro", "name_en": "Futa Toro", "palette": "Africa"},
    "Kong Empire":  {"name_local": "Kong", "name_en": "Kong Empire", "palette": "Africa"},
    "Kong":         {"name_local": "Kong", "name_en": "Kong", "palette": "Africa"},
    "First Samori Empire":  {"name_local": "Samori", "name_en": "Samori Empire", "palette": "Africa"},
    "Second Samori Empire": {"name_local": "Samori", "name_en": "Samori Empire (2nd)", "palette": "Africa"},
    "Wassoulou Empire":     {"name_local": "Wassoulou", "name_en": "Wassoulou Empire", "palette": "Africa"},
    "Tukular Caliphate":    {"name_local": "Tukular", "name_en": "Tukular Empire", "palette": "Africa"},
    "Wadai Empire":         {"name_local": "Wadai", "name_en": "Wadai Empire", "palette": "Africa"},
    "Sultanate of Damagaram": {"name_local": "Damagaram", "name_en": "Damagaram", "palette": "Africa"},
    "Sultanate of Utetera":   {"name_local": "Utetera", "name_en": "Utetera", "palette": "Africa"},
    "Ato trading confederacy":{"name_local": "Ato", "name_en": "Ato Confederacy", "palette": "Africa"},
    "Mirambo Unyanyembe Ukimbu": {"name_local": "Unyanyembe", "name_en": "Mirambo's Empire", "palette": "Africa"},
    "Rabih az-Zubayr":      {"name_local": "Rabih", "name_en": "Rabih's Empire", "palette": "Africa"},
    "Accra":                {"name_local": "Accra", "name_en": "Accra", "palette": "Africa"},
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
}

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

# ── 연도별 특수 처리 (같은 NAME이 시대별로 의미가 다를 때) ──
YEAR_OVERRIDES = {
    ("Korea", 1900): {"name_local": "대한제국", "name_en": "Korean Empire"},
}


def generate_entity_metadata(original_name, year):
    """단일 Entity의 메타데이터를 규칙에 따라 생성."""
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

        # 연도별 오버라이드 적용
        key = (original_name, year)
        if key in YEAR_OVERRIDES:
            override = YEAR_OVERRIDES[key]
            metadata["display_name_en"] = override["name_en"]
            metadata["display_name_local"] = override["name_local"]

        # display_name = "현지어 (영문)" 형태
        metadata["display_name"] = f"{metadata['display_name_local']} ({metadata['display_name_en'].split('(')[0].strip()})"

        if rule.get("ruler"):
            metadata["colonial_ruler"] = rule["ruler"]
            metadata["colonial_note"] = f"Under {rule['ruler']} Rule"
        if rule.get("independence"):
            metadata["independence_year"] = rule["independence"]

        # [cl] capital_coords 추가 (라벨 위치 결정용)
        if original_name in CAPITAL_COORDS:
            metadata["capital_coords"] = CAPITAL_COORDS[original_name]

    else:
        metadata = {
            "display_name": original_name,
            "display_name_en": original_name,
            "display_name_local": original_name,
            "is_colony": False,
            "fill_color": PALETTES["Default"],
            "confidence": "low",
        }

    return metadata


def extract_names_from_geojson(geojson_path):
    """GeoJSON 파일에서 고유 NAME 목록 추출."""
    with open(geojson_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    names = set()
    for feature in data.get("features", []):
        name = feature.get("properties", {}).get("NAME")
        if name:
            names.add(name)
    return sorted(names)


def create_snapshot_json(year, name_list, output_dir):
    """특정 연도의 메타데이터 JSON 생성."""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    snapshot_data = {}
    for name in name_list:
        snapshot_data[name] = generate_entity_metadata(name, year)

    # [cl] 식민지 가상 엔트리 삽입 (피지배국 이름 우선 표기 원칙)
    virtual_count = 0
    for (parent, start, end), overlays in COLONIAL_OVERLAYS.items():
        if parent in snapshot_data and start <= year <= end:
            for overlay in overlays:
                key = overlay["key"]
                if key not in snapshot_data:
                    snapshot_data[key] = {k: v for k, v in overlay.items() if k != "key"}
                    virtual_count += 1

    output_path = os.path.join(output_dir, f"{year}.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(snapshot_data, f, ensure_ascii=False, separators=(",", ":"))

    high = sum(1 for v in snapshot_data.values() if v.get("confidence") == "high")
    low = sum(1 for v in snapshot_data.values() if v.get("confidence") == "low")
    size_kb = os.path.getsize(output_path) / 1024
    virt_str = f" virtual:{virtual_count}" if virtual_count else ""
    print(f"  [{year}] {len(name_list)} entities | high:{high} low:{low}{virt_str} | {size_kb:.1f}KB")
    return high, low


if __name__ == "__main__":
    GEOJSON_DIR = os.path.join(os.getcwd(), "public", "geo", "borders")
    OUTPUT_DIR = os.path.join(GEOJSON_DIR, "metadata")

    SNAPSHOTS = [
        (1880, "world_1880.geojson"),
        (1900, "world_1900.geojson"),
        (1914, "world_1914.geojson"),
        (1920, "world_1920.geojson"),
        (1930, "world_1930.geojson"),
        (1938, "world_1938.geojson"),
        (1945, "world_1945.geojson"),
        (1960, "world_1960.geojson"),
        (1994, "world_1994.geojson"),
        (2000, "world_2000.geojson"),
        (2010, "world_2010.geojson"),
    ]

    print(f"=== 역사 국경 메타데이터 생성 (규칙: {len(ENTITY_RULES)}개) ===\n")

    total_high = 0
    total_low = 0
    for year, filename in SNAPSHOTS:
        geojson_path = os.path.join(GEOJSON_DIR, filename)
        if not os.path.exists(geojson_path):
            print(f"  [{year}] SKIP - {filename} not found")
            continue
        names = extract_names_from_geojson(geojson_path)
        h, l = create_snapshot_json(year, names, OUTPUT_DIR)
        total_high += h
        total_low += l

    print(f"\n완료! 규칙 매칭: {total_high} | 수동 검수 필요: {total_low}")
    print(f"출력: {OUTPUT_DIR}/")
