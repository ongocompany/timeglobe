#!/usr/bin/env node
/**
 * persons_cards.json 중복 제거 + 한국인물 좌표 범위 정리
 * [cl] 민철 — 2026-03-22
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'public', 'data', 'persons_cards.json');
const persons = JSON.parse(fs.readFileSync(FILE, 'utf8'));

console.log('=== 중복 제거 시작 ===');
console.log('원본:', persons.length, '개');

// 1. 제목(ko) 기준 중복 탐지
const titleMap = new Map();
const duplicates = [];

for (let i = 0; i < persons.length; i++) {
  const p = persons[i];
  const titleKo = typeof p.title === 'object' ? p.title.ko : p.title;
  if (!titleKo) continue;

  // 정규화: 공백 제거, 괄호 안 내용 제거
  const normalized = titleKo.replace(/\s*[\(（].*?[\)）]\s*/g, '').trim();

  if (titleMap.has(normalized)) {
    const existing = titleMap.get(normalized);
    // 더 풍부한 데이터를 가진 항목 유지 (description 길이 기준)
    const existingDescLen = typeof existing.item.description === 'object'
      ? (existing.item.description.ko || '').length
      : (existing.item.description || '').length;
    const currentDescLen = typeof p.description === 'object'
      ? (p.description.ko || '').length
      : (p.description || '').length;

    if (currentDescLen > existingDescLen) {
      // 현재가 더 풍부 → 기존 것을 중복 처리
      duplicates.push({ idx: existing.idx, title: titleKo, reason: '짧은 설명 → 교체' });
      titleMap.set(normalized, { item: p, idx: i });
    } else {
      // 기존이 더 풍부 → 현재를 중복 처리
      duplicates.push({ idx: i, title: titleKo, reason: '중복 제거' });
    }
  } else {
    titleMap.set(normalized, { item: p, idx: i });
  }
}

// 중복 인덱스 세트
const dupIdxSet = new Set(duplicates.map(d => d.idx));

// 2. 유지할 항목만 필터
const deduped = persons.filter((_, i) => !dupIdxSet.has(i));

// 3. 중복 목록 출력
console.log('\n중복 제거:', duplicates.length, '개');
const grouped = {};
duplicates.forEach(d => {
  const key = d.title.replace(/\s*[\(（].*?[\)）]\s*/g, '').trim();
  if (!grouped[key]) grouped[key] = [];
  grouped[key].push(d);
});
Object.entries(grouped).sort((a, b) => b[1].length - a[1].length).slice(0, 30).forEach(([name, dups]) => {
  console.log(`  "${name}" → ${dups.length}개 중복 제거`);
});

console.log('\n최종:', deduped.length, '개');
console.log('제거:', persons.length - deduped.length, '개');

// 4. 저장
fs.writeFileSync(FILE, JSON.stringify(deduped, null, 2), 'utf8');
console.log('저장 완료!');
