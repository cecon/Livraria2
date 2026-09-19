import { useRef, type RefObject } from "react";

export function usePaymentNavigation(
  formas: readonly { id: number }[],
  codigoRef: RefObject<HTMLInputElement | null>,
) {
  const campos = useRef(new Map<number, HTMLInputElement>());

  function registrarCampo(id: number, elemento: HTMLInputElement | null) {
    if (elemento) campos.current.set(id, elemento);
    else campos.current.delete(id);
  }

  function focarPagamento(indice: number) {
    const campo = indice < 0 || indice >= formas.length
      ? codigoRef.current
      : campos.current.get(formas[indice].id);
    campo?.focus();
    campo?.select();
  }

  return { registrarCampo, focarPagamento };
}
