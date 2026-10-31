// Aplica ao projeto iOS (ios/) tudo o que o Cockpit precisa e que o Capacitor não põe sozinho: textos das permissões
// em português, notificações em segundo plano e entitlements (push e links universais). É seguro correr
// mais de uma vez. Uso (depois de `npx cap add ios`, ou quando se mudar algo aqui):
//
//   node scripts/configurar-ios.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const PLIST = "ios/App/App/Info.plist";
const ENTITLEMENTS = "ios/App/App/App.entitlements";
const PBXPROJ = "ios/App/App.xcodeproj/project.pbxproj";
if (!existsSync(PLIST)) {
  console.error("Não encontro ios/. Corre primeiro: npx cap add ios");
  process.exit(1);
}

// 1. Info.plist
let plist = readFileSync(PLIST, "utf8");
const chaves = {
  NSFaceIDUsageDescription: "O Cockpit usa o Face ID para abrir a app só a ti.",
  NSCalendarsUsageDescription: "O Cockpit põe as tuas visitas, tarefas e reuniões na agenda do telemóvel.",
  NSCalendarsWriteOnlyAccessUsageDescription: "O Cockpit põe as tuas visitas, tarefas e reuniões na agenda do telemóvel.",
  NSCalendarsFullAccessUsageDescription: "O Cockpit põe as tuas visitas, tarefas e reuniões na agenda do telemóvel.",
  NSContactsUsageDescription: "O Cockpit importa o contacto que escolheres para criar um comprador ou proprietário.",
};
let acrescentos = "";
for (const [k, v] of Object.entries(chaves)) {
  if (!plist.includes(`<key>${k}</key>`)) acrescentos += `\t<key>${k}</key>\n\t<string>${v}</string>\n`;
}
if (!plist.includes("<key>UIBackgroundModes</key>")) {
  acrescentos += "\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>remote-notification</string>\n\t</array>\n";
}
if (acrescentos) plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/, `${acrescentos}</dict>\n</plist>\n`);
writeFileSync(PLIST, plist);

// 2. Entitlements: notificações push e links universais do domínio da app.
// aps-environment "development" serve para correr a partir do Xcode; na versão da loja o Xcode assina com "production".
writeFileSync(
  ENTITLEMENTS,
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>aps-environment</key>
\t<string>development</string>
\t<key>com.apple.developer.associated-domains</key>
\t<array>
\t\t<string>applinks:cockpit.acelabs.pt</string>
\t</array>
</dict>
</plist>
`
);

// 3. Ligar os entitlements ao alvo (Debug e Release).
let pbx = readFileSync(PBXPROJ, "utf8");
if (!pbx.includes("CODE_SIGN_ENTITLEMENTS")) {
  pbx = pbx.replace(/(\t+)(PRODUCT_BUNDLE_IDENTIFIER = pt\.acelabs\.cockpit;)/g, "$1CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n$1$2");
  writeFileSync(PBXPROJ, pbx);
}
console.log("iOS configurado: permissões, notificações em segundo plano e entitlements.");
