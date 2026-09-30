type ProtocolRequest = {
  headers: { get(name: string): string | null };
  nextUrl: { protocol: string };
};

export function requestUsesHttps(request: ProtocolRequest) {
  const forwarded = request.headers.get("x-forwarded-proto")
    ?.split(",", 1)[0]
    ?.trim()
    .toLowerCase();
  const protocol = forwarded || request.nextUrl.protocol.replace(":", "").toLowerCase();
  return protocol === "https";
}
