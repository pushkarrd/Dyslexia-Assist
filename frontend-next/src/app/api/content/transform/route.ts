import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function normalizeHttpUrl(rawUrl: string): string {
  let url = rawUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

function getUpstreamApiBase(): string {
  const configured =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8000/api";

  const normalized = normalizeHttpUrl(configured);
  return /\/api$/i.test(normalized) ? normalized : `${normalized}/api`;
}

export async function POST(request: Request) {
  try {
    const body = await request.text();

    const upstream = await fetch(`${getUpstreamApiBase()}/content/transform`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body,
      cache: "no-store",
    });

    const contentType = upstream.headers.get("content-type") || "application/json";
    const payload = await upstream.text();

    return new NextResponse(payload, {
      status: upstream.status,
      headers: { "content-type": contentType },
    });
  } catch (error: any) {
    return NextResponse.json(
      { detail: error?.message || "Upstream content service is unavailable" },
      { status: 502 }
    );
  }
}
