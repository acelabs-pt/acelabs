// Gera o par de chaves VAPID das notificações push (uma vez por cliente). Uso:
//
//   node scripts/gerar-vapid.mjs
//
// A chave pública vai para a Vercel como NEXT_PUBLIC_VAPID_PUBLIC_KEY e para os segredos da função
// do Supabase como VAPID_PUBLIC_KEY. A privada vai para a Vercel como VAPID_PRIVATE_KEY e para a
// função como VAPID_PRIVATE_KEY. Nunca para o repositório. Trocar as chaves depois obriga cada
// telemóvel a voltar a ligar as notificações.
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:geral@acelabs.pt");
