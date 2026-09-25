"use client";
import { Input } from "./input";
import { Label } from "./label";
import { Textarea } from "./textarea";
import { CATEGORIAS } from "../catalogo";

export type FormProduto = {
  codigo: string;
  titulo: string;
  autor: string;
  valor: string;
  categoria: string;
  descricao: string;
  estoque: string;
};
export const novoFormProduto = (codigo = ""): FormProduto => ({
  codigo,
  titulo: "",
  autor: "",
  valor: "",
  categoria: "0",
  descricao: "",
  estoque: "0",
});
export function lerInteiro(valor: string): number {
  if (!/^\d+$/.test(valor.trim()))
    throw new Error("Informe uma quantidade inteira não negativa.");
  const n = Number(valor);
  if (!Number.isSafeInteger(n))
    throw new Error("Quantidade fora do limite permitido.");
  return n;
}
export function lerCentavos(valor: string): number {
  const v = valor.trim();
  if (!/^(\d+|\d{1,3}(\.\d{3})+)(,\d{1,2})?$/.test(v))
    throw new Error("Informe o preço no formato 19,90.");
  const [reais, decimais = ""] = v.replace(/\./g, "").split(",");
  const cents = BigInt(reais) * 100n + BigInt(decimais.padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Preço fora do limite permitido.");
  return Number(cents);
}
export function validarProduto(f: FormProduto) {
  if (!f.codigo.trim() || !f.titulo.trim())
    throw new Error("Informe código e título.");
  const categoria = lerInteiro(f.categoria);
  if (categoria > 6) throw new Error("Categoria inválida.");
  return {
    codigo: f.codigo.trim(),
    titulo: f.titulo.trim(),
    autor: f.autor.trim() || null,
    precoCentavos: lerCentavos(f.valor),
    categoria,
    descricao: f.descricao.trim() || null,
    estoqueInicial: lerInteiro(f.estoque),
  };
}
export function ProdutoCampos({
  value: f,
  onChange,
  disabled,
  editando = false,
  id = "produto",
}: {
  value: FormProduto;
  onChange: (f: FormProduto) => void;
  disabled?: boolean;
  editando?: boolean;
  id?: string;
}) {
  const campo = (
    key: keyof FormProduto,
    label: string,
    extra: Record<string, unknown> = {},
  ) => (
    <div>
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      <Input
        id={`${id}-${key}`}
        value={f[key]}
        {...extra}
        onChange={(e) => onChange({ ...f, [key]: e.target.value })}
        className="mt-1"
      />
    </div>
  );
  return (
    <fieldset disabled={disabled} className="space-y-4">
      {campo("codigo", "Código de barras (EAN/ISBN)", {
        required: true,
        disabled: editando,
      })}
      {campo("titulo", "Título", { required: true })}
      <div className="grid gap-4 sm:grid-cols-2">
        {campo("valor", "Preço (R$)", {
          required: true,
          inputMode: "decimal",
          placeholder: "0,00",
        })}
        {!editando &&
          campo("estoque", "Estoque inicial", {
            required: true,
            inputMode: "numeric",
          })}
      </div>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Informações adicionais
        </summary>
        <div className="mt-3 space-y-3">
          {campo("autor", "Autor")}
          <div>
            <Label htmlFor={`${id}-categoria`}>Categoria</Label>
            <select
              id={`${id}-categoria`}
              value={f.categoria}
              onChange={(e) => onChange({ ...f, categoria: e.target.value })}
              className="bg-background mt-1 h-9 w-full rounded-md border px-3 text-sm"
            >
              {CATEGORIAS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`${id}-descricao`}>Descrição</Label>
            <Textarea
              id={`${id}-descricao`}
              value={f.descricao}
              onChange={(e) => onChange({ ...f, descricao: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>
      </details>
    </fieldset>
  );
}
