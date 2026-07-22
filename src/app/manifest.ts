import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "싱송 — 노래방 세션 플래너",
    short_name: "싱송",
    description: "한 번의 노래방 세션을 정리하고 계산해 티켓으로 공유합니다.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#FAF7F0",
    theme_color: "#FAF7F0",
    lang: "ko-KR",
    categories: ["utilities", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
