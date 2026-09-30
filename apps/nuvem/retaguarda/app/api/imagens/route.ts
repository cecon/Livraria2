import { NextRequest } from "next/server";
import { imageUploadProxy } from "@/lib/api/image-upload-proxy";
export async function POST(req: NextRequest) { return imageUploadProxy(req); }
