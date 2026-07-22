import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Home da retaguarda. Requer sessão (o middleware já redireciona; reforço aqui).
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Quem logou é o usuário da tabela `usuario` (ADR-0019), não a conta de serviço.
  const quem = (await cookies()).get("app_user")?.value ?? "operador";

  return (
    <main>
      <h1>Escritório — Livraria</h1>
      <p>Logado como <strong>{quem}</strong></p>
      <nav className="nav">
        <a className="card" href="/recebimento">📦 Receber livros</a>
        <a className="card" href="/fornecedores">🏢 Fornecedores</a>
        <a className="card" href="/livros">📚 Cadastro / preço</a>
        <a className="card" href="/operadores">👤 Operadores</a>
        <a className="card" href="/consulta">🔎 Estoque &amp; vendas</a>
        <a className="card" href="/relatorios">📊 Relatórios</a>
      </nav>
    </main>
  );
}
