import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST() {
  try {
    const bytes = crypto.randomBytes(64);
    const key = bytes.toString("base64");
    return NextResponse.json({
      key,
      length: key.length,
    });
  } catch (error) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Failed to generate key." },
      { status: 500 }
    );
  }
}
