import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

// Home da retaguarda. Requer sessão (o middleware já redireciona; reforço aqui).
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main>
      <h1>Escritório — Livraria</h1>
      <p>Logado como <strong>{user.email}</strong></p>
      <nav className="nav">
        <a className="card" href="/recebimento">📦 Receber livros</a>
        <a className="card" href="/fornecedores">🏢 Fornecedores</a>
        <a className="card" href="/livros">📚 Cadastro / preço</a>
        <a className="card" href="/operadores">👤 Operadores</a>
        <a className="card" href="/consulta">🔎 Estoque &amp; vendas</a>
      </nav>
    </main>
  );
}
