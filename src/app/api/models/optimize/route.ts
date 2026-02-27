// [cl] 기존 GLB 파일 일괄 최적화 API
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { dedup, quantize, weld } from '@gltf-transform/functions';

const REGISTRY_PATH = path.join(process.cwd(), 'src/data/modelRegistry.json');
const MODELS_DIR = path.join(process.cwd(), 'public/models');

interface ModelEntry {
  id: string;
  filePath: string;
  [key: string]: unknown;
}

async function optimizeGlb(inputBuffer: Uint8Array): Promise<Uint8Array> {
  const io = new NodeIO();
  const doc = await io.readBinary(inputBuffer);
  await doc.transform(dedup(), weld(), quantize());
  return await io.writeBinary(doc);
}

// POST — 존재하는 모든 GLB 파일을 일괄 최적화
export async function POST() {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
  const registry: { models: ModelEntry[] } = JSON.parse(raw);

  const results: {
    id: string;
    originalSize: number;
    finalSize: number;
    reduction: string;
    error?: string;
  }[] = [];

  for (const model of registry.models) {
    const fullPath = path.join(MODELS_DIR, model.filePath);
    if (!fs.existsSync(fullPath)) continue;

    const originalBuffer = new Uint8Array(fs.readFileSync(fullPath));
    const originalSize = originalBuffer.length;

    try {
      const optimized = await optimizeGlb(originalBuffer);
      fs.writeFileSync(fullPath, optimized);
      results.push({
        id: model.id,
        originalSize,
        finalSize: optimized.length,
        reduction: `${Math.round((1 - optimized.length / originalSize) * 100)}%`,
      });
    } catch (err) {
      results.push({
        id: model.id,
        originalSize,
        finalSize: originalSize,
        reduction: '0%',
        error: String(err),
      });
    }
  }

  const totalOriginal = results.reduce((s, r) => s + r.originalSize, 0);
  const totalFinal = results.reduce((s, r) => s + r.finalSize, 0);

  return NextResponse.json({
    ok: true,
    count: results.length,
    totalOriginal,
    totalFinal,
    totalReduction: totalOriginal > 0
      ? `${Math.round((1 - totalFinal / totalOriginal) * 100)}%`
      : '0%',
    results,
  });
}
