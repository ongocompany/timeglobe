// [cl] GLB 파일 업로드 API — 드래그앤드롭 → 자동 리네임 + 저장 + 압축
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { dedup, quantize, weld } from '@gltf-transform/functions';

const REGISTRY_PATH = path.join(process.cwd(), 'src/data/modelRegistry.json');
const MODELS_DIR = path.join(process.cwd(), 'public/models');

interface ModelEntry {
  id: string;
  category: string;
  fileName: string;
  filePath: string;
  status: 'pending' | 'generated' | 'approved';
  [key: string]: unknown;
}

function readRegistry(): { models: ModelEntry[] } {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeRegistry(data: { models: ModelEntry[] }) {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// [cl] GLB 최적화: dedup + weld + quantize
async function optimizeGlb(inputBuffer: Uint8Array): Promise<Uint8Array> {
  const io = new NodeIO();
  const doc = await io.readBinary(inputBuffer);
  await doc.transform(dedup(), weld(), quantize());
  return await io.writeBinary(doc);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const modelId = formData.get('modelId') as string;
  const file = formData.get('file') as File;

  if (!modelId || !file) {
    return NextResponse.json(
      { error: 'modelId and file are required' },
      { status: 400 }
    );
  }

  // [cl] 레지스트리에서 모델 정보 찾기
  const registry = readRegistry();
  const model = registry.models.find((m) => m.id === modelId);
  if (!model) {
    return NextResponse.json({ error: 'model not found' }, { status: 404 });
  }

  // [cl] 파일을 Buffer로 읽기
  const arrayBuffer = await file.arrayBuffer();
  const originalBuffer = new Uint8Array(arrayBuffer);
  const originalSize = originalBuffer.length;

  // [cl] 디렉토리 확인/생성
  const targetDir = path.join(MODELS_DIR, path.dirname(model.filePath));
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetPath = path.join(MODELS_DIR, model.filePath);

  // [cl] GLB 최적화 시도
  let finalBuffer = originalBuffer;
  let optimized = false;
  try {
    finalBuffer = await optimizeGlb(originalBuffer);
    optimized = true;
  } catch {
    // 최적화 실패 시 원본 그대로 저장
    finalBuffer = originalBuffer;
  }

  // [cl] 파일 저장
  fs.writeFileSync(targetPath, finalBuffer);

  // [cl] 상태 업데이트 (pending → generated)
  const idx = registry.models.findIndex((m) => m.id === modelId);
  if (idx !== -1 && registry.models[idx].status === 'pending') {
    registry.models[idx].status = 'generated';
    writeRegistry(registry);
  }

  return NextResponse.json({
    ok: true,
    modelId,
    fileName: model.fileName,
    savedTo: model.filePath,
    originalSize,
    finalSize: finalBuffer.length,
    optimized,
    reduction: optimized
      ? `${Math.round((1 - finalBuffer.length / originalSize) * 100)}%`
      : '0%',
  });
}
