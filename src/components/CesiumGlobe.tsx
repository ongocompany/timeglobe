"use client";

// [cl] CesiumJS + Resium 기본 3D 지구본 컴포넌트
// Phase 0: 기본 렌더링 확인용

// [cl] Cesium 정적 에셋 경로 설정 — import 전에 설정해야 함
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).CESIUM_BASE_URL = "/cesium";
}

import { Viewer, Entity } from "resium";
import { Cartesian3, Color } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

export default function CesiumGlobe() {

  return (
    <Viewer
      full
      timeline={false}
      animation={false}
      homeButton={false}
      geocoder={false}
      baseLayerPicker={false}
      navigationHelpButton={false}
      sceneModePicker={false}
      fullscreenButton={false}
      vrButton={false}
      selectionIndicator={false}
      infoBox={false}
    >
      {/* [cl] Phase 0 테스트: 서울에 기본 마커 1개 */}
      <Entity
        name="Seoul"
        position={Cartesian3.fromDegrees(126.978, 37.5665, 0)}
        point={{
          pixelSize: 12,
          color: Color.YELLOW,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
        }}
        description="Phase 0 테스트 마커 - 서울"
      />
    </Viewer>
  );
}
