import { OAuthConnectionForm } from "./oauth-connection-form";

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] || "" : value || "",
    ]),
  );
  return <OAuthConnectionForm params={params} />;
}
