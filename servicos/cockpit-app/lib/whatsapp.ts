/**
 * Endereço do WhatsApp para um telemóvel, com a mensagem já escrita se houver. O wa.me só aceita dígitos
 * com o indicativo do país: tira espaços, "+" e o resto, e um número português sem indicativo leva o 351.
 */
export function linkWhatsapp(tel: string, texto?: string): string {
  let digitos = tel.replace(/\D/g, "");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.length === 9) digitos = "351" + digitos;
  return `https://wa.me/${digitos}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}
