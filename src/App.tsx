import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";

function App() {
  const [greetMsg, setGreetMsg] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name: "Espaço do Livro" }));
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Livraria 2
        </h1>
        <p className="text-muted-foreground text-sm">
          Tauri 2 · React · TypeScript · shadcn/ui · Tailwind
        </p>
      </div>

      <Button onClick={greet}>Testar comando Rust</Button>

      {greetMsg && (
        <p className="text-muted-foreground text-sm">{greetMsg}</p>
      )}
    </main>
  );
}

export default App;
