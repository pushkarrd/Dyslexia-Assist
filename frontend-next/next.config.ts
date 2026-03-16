import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@tensorflow/tfjs-core",
    "@tensorflow/tfjs-backend-webgl",
    "@tensorflow/tfjs-converter",
    "@tensorflow-models/face-landmarks-detection",
    "@mediapipe/face_mesh",
  ],
};

export default nextConfig;
