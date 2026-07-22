import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

// Home da retaguarda. Requer sessão (o middleware já redireciona; reforço aqui).
// A navegação fica na barra lateral (paridade com o PDV) — aqui só as boas-vindas.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Escritório — Livraria</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Logado como <strong className="text-foreground">{user.email}</strong>
      </p>
      <p className="mt-6 text-sm text-muted-foreground">
        Use o menu à esquerda para navegar pelas seções.
      </p>
    </main>
  );
}
