// [cl] 3D Model Manager — Meshy 생성 파이프라인 관리 UI
'use client';

import { useEffect, useState, useRef } from 'react';
import Script from 'next/script';

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
  glbExists: boolean;
  glbSize: number | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  prehistoric: '선사시대',
  war: '전쟁/분쟁',
  revolution: '혁명/봉기',
  people: '인물/문화',
  science: '과학/발명',
  politics: '정치/사회',
  establishment: '건국/수립',
  landmark: '랜드마크',
};

const CATEGORY_COLORS: Record<string, string> = {
  prehistoric: '#8B7355',
  war: '#DC3545',
  revolution: '#FF6B35',
  people: '#6C63FF',
  science: '#28A745',
  politics: '#17A2B8',
  establishment: '#FFC107',
  landmark: '#E91E90',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '대기', color: '#666' },
  generated: { label: '생성완료', color: '#FFA500' },
  approved: { label: '승인', color: '#28A745' },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function ModelManagerPage() {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingPrompt, setEditingPrompt] = useState('');
  const [editingNotes, setEditingNotes] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    originalSize: number;
    finalSize: number;
    reduction: string;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchModels = async () => {
    const res = await fetch('/api/models');
    const data = await res.json();
    setModels(data.models);
    setLoading(false);
  };

  useEffect(() => { fetchModels(); }, []);

  const selected = models.find((m) => m.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setEditingPrompt(selected.prompt);
      setEditingNotes(selected.notes);
    }
    setUploadResult(null);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // [cl] 드래그앤드롭 / 파일선택 업로드 핸들러
  const handleFileUpload = async (file: File) => {
    if (!selected) return;
    if (!file.name.toLowerCase().endsWith('.glb')) {
      alert('GLB 파일만 업로드 가능합니다.');
      return;
    }
    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append('modelId', selected.id);
    formData.append('file', file);
    try {
      const res = await fetch('/api/models/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok) {
        setUploadResult({
          originalSize: data.originalSize,
          finalSize: data.finalSize,
          reduction: data.reduction,
        });
        await fetchModels();
      } else {
        alert('업로드 실패: ' + data.error);
      }
    } catch (err) {
      alert('업로드 중 오류 발생');
    }
    setUploading(false);
  };

  // [cl] 전체 GLB 일괄 최적화
  const handleOptimizeAll = async () => {
    setOptimizing(true);
    setOptimizeResult(null);
    try {
      const res = await fetch('/api/models/optimize', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setOptimizeResult(
          `${data.count}개 최적화 완료! ${formatBytes(data.totalOriginal)} → ${formatBytes(data.totalFinal)} (${data.totalReduction} 절감)`
        );
        await fetchModels();
      }
    } catch {
      setOptimizeResult('최적화 중 오류 발생');
    }
    setOptimizing(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleCopy = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(editingPrompt);
    setCopyFeedback(selected.id);
    setTimeout(() => setCopyFeedback(null), 1500);
  };

  const handleSave = async (overrides?: Partial<ModelEntry>) => {
    if (!selected) return;
    setSaving(true);
    await fetch('/api/models', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        prompt: editingPrompt,
        notes: editingNotes,
        ...overrides,
      }),
    });
    await fetchModels();
    setSaving(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    await handleSave({ status: newStatus as ModelEntry['status'] });
  };

  const filtered = models.filter((m) => {
    if (filterCategory !== 'all' && m.category !== filterCategory) return false;
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: models.length,
    pending: models.filter((m) => m.status === 'pending').length,
    generated: models.filter((m) => m.status === 'generated').length,
    approved: models.filter((m) => m.status === 'approved').length,
    withGlb: models.filter((m) => m.glbExists).length,
  };

  if (loading) {
    return (
      <div style={{ padding: 40, color: '#ccc', fontFamily: 'system-ui' }}>
        Loading model registry...
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://unpkg.com/@google/model-viewer@3.3.0/dist/model-viewer.min.js"
        type="module"
      />
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        color: '#e0e0e0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '20px 30px',
          borderBottom: '1px solid #222',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
              3D Model Manager
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
              TimeGlobe — Meshy Text-to-3D 생성 파이프라인
            </p>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span style={{ color: '#666' }}>전체 {stats.total}</span>
            <span style={{ color: STATUS_LABELS.pending.color }}>
              대기 {stats.pending}
            </span>
            <span style={{ color: STATUS_LABELS.generated.color }}>
              생성 {stats.generated}
            </span>
            <span style={{ color: STATUS_LABELS.approved.color }}>
              승인 {stats.approved}
            </span>
            <span style={{ color: '#4FC3F7' }}>
              GLB {stats.withGlb}/{stats.total}
            </span>
          </div>
        </div>

        {/* 필터 바 */}
        <div style={{
          padding: '12px 30px',
          borderBottom: '1px solid #1a1a1f',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          fontSize: 13,
        }}>
          <span style={{ color: '#888' }}>카테고리:</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={selectStyle}
          >
            <option value="all">전체</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <span style={{ color: '#888', marginLeft: 8 }}>상태:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={selectStyle}
          >
            <option value="all">전체</option>
            <option value="pending">대기</option>
            <option value="generated">생성완료</option>
            <option value="approved">승인</option>
          </select>
          <button
            onClick={handleOptimizeAll}
            disabled={optimizing}
            style={{
              ...btnStyle,
              marginLeft: 'auto',
              background: optimizing ? '#333' : '#1a2a1a',
              color: '#28A745',
              fontWeight: 600,
            }}
          >
            {optimizing ? '최적화 중...' : '전체 GLB 최적화'}
          </button>
          <button
            onClick={fetchModels}
            style={{
              ...btnStyle,
              background: '#1a1a2e',
            }}
          >
            새로고침
          </button>
        </div>

        {/* [cl] 전체 최적화 결과 */}
        {optimizeResult && (
          <div style={{
            padding: '8px 30px',
            background: '#0a1a0a',
            fontSize: 13,
            color: '#28A745',
            borderBottom: '1px solid #1a3a1a',
          }}>
            {optimizeResult}
          </div>
        )}

        {/* 메인 레이아웃: 좌 목록 + 우 상세 */}
        <div style={{ display: 'flex', height: 'calc(100vh - 120px)' }}>
          {/* 좌측: 모델 목록 */}
          <div style={{
            width: 420,
            borderRight: '1px solid #1a1a1f',
            overflowY: 'auto',
          }}>
            {filtered.map((m) => (
              <div
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                style={{
                  padding: '12px 20px',
                  borderBottom: '1px solid #151519',
                  cursor: 'pointer',
                  background: selectedId === m.id ? '#15152a' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (selectedId !== m.id) {
                    (e.currentTarget as HTMLDivElement).style.background = '#111118';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedId !== m.id) {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                  }
                }}
              >
                {/* 카테고리 뱃지 */}
                <div style={{
                  width: 6,
                  height: 36,
                  borderRadius: 3,
                  background: CATEGORY_COLORS[m.category] ?? '#444',
                  flexShrink: 0,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {m.id}
                    </span>
                    <span style={{ fontSize: 14 }}>{m.name_ko}</span>
                    <span style={{ fontSize: 12, color: '#666' }}>
                      {m.name_en}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: '#666',
                    marginTop: 2,
                    display: 'flex',
                    gap: 8,
                  }}>
                    <span style={{
                      color: CATEGORY_COLORS[m.category],
                      fontWeight: 500,
                    }}>
                      {CATEGORY_LABELS[m.category]}
                    </span>
                    <span>{m.era}</span>
                    <span>{m.yearRange}</span>
                  </div>
                </div>

                {/* 상태 + GLB 표시 */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 4,
                  flexShrink: 0,
                }}>
                  <span style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: STATUS_LABELS[m.status].color + '22',
                    color: STATUS_LABELS[m.status].color,
                    fontWeight: 600,
                  }}>
                    {STATUS_LABELS[m.status].label}
                  </span>
                  {m.glbExists && (
                    <span style={{
                      fontSize: 10,
                      color: '#4FC3F7',
                    }}>
                      GLB {m.glbSize ? formatBytes(m.glbSize) : ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 우측: 상세 패널 */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 30,
          }}>
            {!selected ? (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#444',
                fontSize: 14,
              }}>
                좌측 목록에서 모델을 선택하세요
              </div>
            ) : (
              <div>
                {/* 모델 헤더 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 24,
                }}>
                  <div style={{
                    width: 10,
                    height: 40,
                    borderRadius: 5,
                    background: CATEGORY_COLORS[selected.category],
                  }} />
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                      {selected.name_ko}
                      <span style={{ fontWeight: 400, color: '#888', marginLeft: 8 }}>
                        {selected.name_en}
                      </span>
                    </h2>
                    <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
                      {CATEGORY_LABELS[selected.category]} / {selected.era} / {selected.yearRange}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    {(['pending', 'generated', 'approved'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        style={{
                          ...btnStyle,
                          background: selected.status === s
                            ? STATUS_LABELS[s].color
                            : '#1a1a2e',
                          color: selected.status === s ? '#fff' : '#888',
                          fontWeight: selected.status === s ? 700 : 400,
                        }}
                      >
                        {STATUS_LABELS[s].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 프롬프트 편집 */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#aaa' }}>
                      Meshy Prompt
                    </label>
                    <button
                      onClick={handleCopy}
                      style={{
                        ...btnStyle,
                        background: copyFeedback === selected.id ? '#28A745' : '#2a2a4e',
                        color: copyFeedback === selected.id ? '#fff' : '#4FC3F7',
                        fontWeight: 600,
                      }}
                    >
                      {copyFeedback === selected.id ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <textarea
                    ref={promptRef}
                    value={editingPrompt}
                    onChange={(e) => setEditingPrompt(e.target.value)}
                    rows={5}
                    style={{
                      width: '100%',
                      background: '#111118',
                      border: '1px solid #2a2a3e',
                      borderRadius: 8,
                      color: '#e0e0e0',
                      padding: 12,
                      fontSize: 13,
                      lineHeight: 1.6,
                      resize: 'vertical',
                      fontFamily: 'monospace',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* 메모 */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#aaa',
                    display: 'block',
                    marginBottom: 8,
                  }}>
                    메모
                  </label>
                  <textarea
                    value={editingNotes}
                    onChange={(e) => setEditingNotes(e.target.value)}
                    rows={2}
                    placeholder="생성 시 참고사항, 수정 메모 등..."
                    style={{
                      width: '100%',
                      background: '#111118',
                      border: '1px solid #2a2a3e',
                      borderRadius: 8,
                      color: '#e0e0e0',
                      padding: 12,
                      fontSize: 13,
                      lineHeight: 1.5,
                      resize: 'vertical',
                      fontFamily: 'system-ui',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* 저장 버튼 */}
                <div style={{ marginBottom: 24 }}>
                  <button
                    onClick={() => handleSave()}
                    disabled={saving}
                    style={{
                      ...btnStyle,
                      background: '#4FC3F7',
                      color: '#000',
                      fontWeight: 700,
                      padding: '8px 24px',
                      opacity: saving ? 0.5 : 1,
                    }}
                  >
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>

                {/* 파일 정보 */}
                <div style={{
                  padding: 16,
                  background: '#111118',
                  borderRadius: 8,
                  border: '1px solid #2a2a3e',
                  marginBottom: 20,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#aaa', marginBottom: 8 }}>
                    파일 정보
                  </div>
                  <div style={{ fontSize: 13, color: '#888', lineHeight: 1.8 }}>
                    <div>
                      경로: <code style={{ color: '#4FC3F7' }}>
                        public/models/{selected.filePath}
                      </code>
                    </div>
                    <div>
                      상태:{' '}
                      {selected.glbExists ? (
                        <span style={{ color: '#28A745' }}>
                          파일 있음 ({selected.glbSize ? formatBytes(selected.glbSize) : ''})
                        </span>
                      ) : (
                        <span style={{ color: '#DC3545' }}>
                          파일 없음 — Meshy에서 생성 후 위 경로에 넣어주세요
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* GLB 3D 프리뷰 */}
                {selected.glbExists && (
                  <div style={{
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: '1px solid #2a2a3e',
                    background: '#111118',
                  }}>
                    <div style={{
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#aaa',
                      borderBottom: '1px solid #2a2a3e',
                    }}>
                      3D Preview
                    </div>
                    {/* @ts-expect-error model-viewer web component */}
                    <model-viewer
                      src={`/models/${selected.filePath}`}
                      alt={selected.name_en}
                      auto-rotate
                      camera-controls
                      shadow-intensity="1"
                      style={{
                        width: '100%',
                        height: 400,
                        background: '#0a0a12',
                      }}
                    />
                  </div>
                )}

                {/* [cl] GLB 교체 버튼 (이미 파일 있을 때) */}
                {selected.glbExists && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        ...btnStyle,
                        background: '#1a1a2e',
                        color: '#888',
                      }}
                    >
                      GLB 교체
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".glb"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                        e.target.value = '';
                      }}
                    />
                    {uploading && (
                      <span style={{ fontSize: 12, color: '#4FC3F7' }}>최적화 중...</span>
                    )}
                  </div>
                )}

                {/* [cl] 드래그앤드롭 업로드 영역 (GLB 없을 때) */}
                {!selected.glbExists && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      borderRadius: 12,
                      border: `2px dashed ${dragOver ? '#4FC3F7' : '#2a2a3e'}`,
                      background: dragOver ? '#111128' : 'transparent',
                      height: 300,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: dragOver ? '#4FC3F7' : '#444',
                      gap: 12,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".glb"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                        e.target.value = '';
                      }}
                    />
                    {uploading ? (
                      <>
                        <div style={{ fontSize: 36 }}>⏳</div>
                        <div style={{ fontSize: 14, color: '#4FC3F7' }}>
                          업로드 + 최적화 중...
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 48 }}>📦</div>
                        <div style={{ fontSize: 14 }}>
                          GLB 파일을 여기에 드래그하거나 클릭하세요
                        </div>
                        <div style={{ fontSize: 12, color: '#555' }}>
                          자동으로 이름 변경 + 폴더 저장 + 압축됩니다
                        </div>
                        <code style={{
                          fontSize: 11,
                          color: '#666',
                          background: '#111118',
                          padding: '4px 12px',
                          borderRadius: 4,
                        }}>
                          → public/models/{selected.filePath}
                        </code>
                      </>
                    )}
                  </div>
                )}

                {/* [cl] 업로드 결과 표시 */}
                {uploadResult && (
                  <div style={{
                    marginTop: 12,
                    padding: 12,
                    background: '#0a1a0a',
                    border: '1px solid #28A745',
                    borderRadius: 8,
                    fontSize: 13,
                    color: '#28A745',
                  }}>
                    업로드 완료! 원본 {formatBytes(uploadResult.originalSize)} → 최적화 {formatBytes(uploadResult.finalSize)} ({uploadResult.reduction} 절감)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const selectStyle: React.CSSProperties = {
  background: '#111118',
  border: '1px solid #2a2a3e',
  color: '#e0e0e0',
  padding: '4px 8px',
  borderRadius: 4,
  fontSize: 13,
  outline: 'none',
};

const btnStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 6,
  border: 'none',
  fontSize: 12,
  cursor: 'pointer',
  color: '#ccc',
  transition: 'all 0.15s',
};
