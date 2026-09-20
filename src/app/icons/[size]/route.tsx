import { ImageResponse } from "next/og";

// App icons for the PWA / home-screen install, generated on the fly so no
// binary image tooling is needed. Navy square with a white serif "GS" monogram,
// matching the app's accent. Served at /icons/180, /icons/192, /icons/512.
export const dynamic = "force-static";

const ALLOWED: Record<string, number> = { "180": 180, "192": 192, "512": 512 };

export function generateStaticParams() {
  return Object.keys(ALLOWED).map((size) => ({ size }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size: sizeStr } = await params;
  const size = ALLOWED[sizeStr] ?? 512;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1B2A4E",
          color: "#FFFFFF",
          fontSize: Math.round(size * 0.46),
          fontWeight: 700,
          fontFamily: "Georgia, 'Times New Roman', serif",
          letterSpacing: -2,
        }}
      >
        GS
      </div>
    ),
    { width: size, height: size }
  );
}
