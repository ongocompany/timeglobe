"use client";

// [cl] WebGL2 워프 쉐이더 컴포넌트 — 방사형 하이퍼스페이스 스트릭
// 원작: docs/디자인샘플/warp_alt.css (GLSL polar-coord radial streaks)

import { useEffect, useRef, useState } from "react";

// [cl] 방사형 하이퍼스페이스 스트릭 셰이더
// 200개 별이 중심→외곽으로 방사, screen blend 전용 (검정=투명)
const DEFAULT_FRAG = `#version 300 es
precision highp float;
out vec4 O;
uniform float time;
uniform vec2 resolution;

#define FC gl_FragCoord.xy
#define R resolution
#define T time

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  vec2 st = (FC - .5 * R) / R.y;
  vec3 color = vec3(0.);

  float len = length(st);

  // [cl] 극좌표: 중심에서 바깥으로 방사 + 스파이럴 twist
  float twist = len * 0.6 + T * 0.15;
  vec2 polar = vec2(atan(st.y, st.x) + twist, len);

  // [cl] 200개 별 줄기
  float num_stars = 200.;
  polar.x *= num_stars;

  float star_seed = floor(polar.x) + .5;
  float random_star = random(vec2(star_seed));

  // [cl] 별 이동: time에 따라 바깥으로 흘러감
  float time_offset = T * (.5 + random_star * .5);
  float star_pos = fract(random_star + time_offset) * 2.;

  // [cl] 줄기 폭 + 형태
  float streak_width = .005 + random_star * .005;
  float star_streak = smoothstep(-streak_width, streak_width, polar.y - star_pos)
                    - smoothstep(streak_width, streak_width + .2, polar.y - star_pos);

  // [cl] 가장자리 페이드: 중심과 외곽에서 소멸
  star_streak *= smoothstep(0., .3, polar.y) * smoothstep(1., .7, polar.y);

  float brightness = .5 + random_star * .5;
  vec3 star_color = vec3(.8, .9, 1.) * brightness;

  // [cl] 2% 확률로 핑크/보라 별
  if (random(vec2(star_seed, 2.)) > .98) {
    star_color = vec3(1., .6, .8);
  }

  color += star_streak * star_color;
  O = vec4(color, 1.);
}`;

const DEFAULT_VERT = `#version 300 es
precision highp float;
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

interface LightSpeedProps {
  className?: string;
  paused?: boolean;
  speed?: number;
  // [cl] 외부 speed 제어용 ref — sine 이징 애니메이션에서 매 프레임 속도 주입
  speedRef?: { current: number };
  fragmentSource?: string;
  onShaderError?: (err: string) => void;
}

export default function LightSpeed({
  className = "relative w-full h-full overflow-hidden",
  paused = false,
  speed = 1,
  speedRef,
  fragmentSource = DEFAULT_FRAG,
  onShaderError,
}: LightSpeedProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const buffersRef = useRef<{ vbo: WebGLBuffer | null }>({ vbo: null });
  const uniformsRef = useRef<{ time?: WebGLUniformLocation; resolution?: WebGLUniformLocation }>({});
  const rafRef = useRef<number>(0);
  // [cl] paused/speed → ref 동기화: 메인 useEffect 재실행 없이 즉시 반영
  const pausedRef = useRef(paused);
  const internalSpeedRef = useRef(speed);
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { internalSpeedRef.current = speed; }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = (canvas.getContext("webgl2") as WebGL2RenderingContext) || null;

    if (!gl) { setWebglOk(false); return; }
    setWebglOk(true);
    glRef.current = gl;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(sh) || "Shader compile error";
        gl.deleteShader(sh);
        throw new Error(info);
      }
      return sh;
    };

    const link = (vs: WebGLShader, fs: WebGLShader) => {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(prog) || "Program link error";
        gl.deleteProgram(prog);
        throw new Error(info);
      }
      return prog;
    };

    let vs: WebGLShader | null = null;
    let fs: WebGLShader | null = null;
    let prog: WebGLProgram | null = null;

    try {
      vs = compile(gl.VERTEX_SHADER, DEFAULT_VERT);
      fs = compile(gl.FRAGMENT_SHADER, fragmentSource);
      prog = link(vs, fs);
    } catch (err: unknown) {
      onShaderError?.(String((err as Error)?.message || err));
      if (fragmentSource !== DEFAULT_FRAG) {
        try {
          fs = compile(gl.FRAGMENT_SHADER, DEFAULT_FRAG);
          prog = link(vs!, fs);
        } catch (err2: unknown) {
          onShaderError?.(String((err2 as Error)?.message || err2));
          setWebglOk(false);
          return;
        }
      } else {
        setWebglOk(false);
        return;
      }
    }

    programRef.current = prog;
    gl.useProgram(prog);

    const vbo = gl.createBuffer();
    buffersRef.current.vbo = vbo;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const verts = new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    const locPos = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

    uniformsRef.current.time = gl.getUniformLocation(prog, "time")!;
    uniformsRef.current.resolution = gl.getUniformLocation(prog, "resolution")!;

    const resize = () => {
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const cssW = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
      const cssH = canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniformsRef.current.resolution!, canvas.width, canvas.height);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("resize", resize);
    resize();

    // [cl] 시간 누적 방식: speed가 매 프레임 바뀌어도 shader time이 연속적
    let accumulatedTime = 0;
    let lastFrameTime = performance.now();

    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);

      const dt = (t - lastFrameTime) * 0.001;
      lastFrameTime = t;

      // [cl] 외부 speedRef 우선, 없으면 내부 speed ref
      const currentSpeed = speedRef ? speedRef.current : internalSpeedRef.current;
      if (pausedRef.current || currentSpeed <= 0) return;

      accumulatedTime += dt * currentSpeed;
      gl.useProgram(programRef.current);
      gl.uniform1f(uniformsRef.current.time!, accumulatedTime);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      if (gl && programRef.current) {
        const p = programRef.current;
        const attached = gl.getAttachedShaders(p) || [];
        attached.forEach((s) => gl.deleteShader(s));
        gl.deleteProgram(p);
      }
      if (gl && buffersRef.current.vbo) gl.deleteBuffer(buffersRef.current.vbo);
    };
    // [cl] fragmentSource/onShaderError/speedRef 변경 시만 WebGL 재초기화
    // paused/speed는 ref 동기화로 처리 → 재초기화 불필요
  }, [fragmentSource, onShaderError, speedRef]);

  return (
    <div className={className}>
      {!webglOk && (
        <div className="absolute inset-0 grid place-items-center text-neutral-200">
          <p className="text-sm opacity-60">WebGL2 not supported</p>
        </div>
      )}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
    </div>
  );
}
