// [cl] 3D 모델 레지스트리 API — 조회/수정/GLB 파일 감지
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const REGISTRY_PATH = path.join(process.cwd(), 'src/data/modelRegistry.json');
const MODELS_DIR = path.join(process.cwd(), 'public/models');

interface ModelEntry {
  id: string;
  category: string;
  name_ko: string;
  name_en: string;
  era: string;
  yearRange: string;
  fileName: string;
  filePath: string;
  prompt: string;
  status: 'pending' | 'generated' | 'approved';
  notes: string;
}

function readRegistry(): { models: ModelEntry[] } {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeRegistry(data: { models: ModelEntry[] }) {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// [cl] GLB 파일 존재 여부 확인
function checkGlbExists(filePath: string): boolean {
  const fullPath = path.join(MODELS_DIR, filePath);
  return fs.existsSync(fullPath);
}

// [cl] GLB 파일 크기 (bytes)
function getGlbSize(filePath: string): number | null {
  const fullPath = path.join(MODELS_DIR, filePath);
  try {
    const stat = fs.statSync(fullPath);
    return stat.size;
  } catch {
    return null;
  }
}

// GET — 전체 모델 목록 + GLB 존재 여부
export async function GET() {
  const registry = readRegistry();
  const modelsWithFileInfo = registry.models.map((m) => ({
    ...m,
    glbExists: checkGlbExists(m.filePath),
    glbSize: getGlbSize(m.filePath),
  }));
  return NextResponse.json({ models: modelsWithFileInfo });
}

// PUT — 모델 수정 (prompt, status, notes)
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, prompt, status, notes } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const registry = readRegistry();
  const idx = registry.models.findIndex((m) => m.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: 'model not found' }, { status: 404 });
  }

  if (prompt !== undefined) registry.models[idx].prompt = prompt;
  if (status !== undefined) registry.models[idx].status = status;
  if (notes !== undefined) registry.models[idx].notes = notes;

  writeRegistry(registry);
  return NextResponse.json({ ok: true, model: registry.models[idx] });
}
