import type { NextConfig } from "next";
import CopyPlugin from "copy-webpack-plugin";
import path from "path";

const nextConfig: NextConfig = {
  // [cl] CesiumJS 정적 에셋(워커, 텍스처 등)을 public 폴더로 복사
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins?.push(
        new CopyPlugin({
          patterns: [
            {
              from: path.join(
                __dirname,
                "node_modules/cesium/Build/Cesium/Workers"
              ),
              to: path.join(__dirname, "public/cesium/Workers"),
            },
            {
              from: path.join(
                __dirname,
                "node_modules/cesium/Build/Cesium/ThirdParty"
              ),
              to: path.join(__dirname, "public/cesium/ThirdParty"),
            },
            {
              from: path.join(
                __dirname,
                "node_modules/cesium/Build/Cesium/Assets"
              ),
              to: path.join(__dirname, "public/cesium/Assets"),
            },
            {
              from: path.join(
                __dirname,
                "node_modules/cesium/Build/Cesium/Widgets"
              ),
              to: path.join(__dirname, "public/cesium/Widgets"),
            },
          ],
        })
      );
    }
    return config;
  },
};

export default nextConfig;
