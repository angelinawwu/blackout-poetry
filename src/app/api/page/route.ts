import { NextResponse } from "next/server";
import { getRandomExcerpt } from "@/lib/gutendex";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const excerpt = await getRandomExcerpt();
  return NextResponse.json(excerpt, {
    headers: { "Cache-Control": "no-store" },
  });
}
