# StructaNote — compilar para iOS

Projeto iOS (Capacitor 7) já configurado: permissões de GPS, câmara, fototeca e sensores, ícone
1024 px sem transparência, splash escuro, plugins Filesystem, Share, Geolocation e Status Bar.

A app web é partilhada: a pasta `www/` é copiada do projeto web (`/home/ubuntu/structanote/public`).
Antes de compilar, execute sempre `npx cap sync ios` para levar as alterações.

---

## Opção A — Mac com Xcode (mais simples)

Requisitos: macOS 14+, Xcode 15+, CocoaPods, conta Apple (gratuita serve para testar no próprio iPhone).

```bash
npm install
npx cap sync ios
cd ios/App && pod install && cd ../..
open ios/App/App.xcworkspace
```

No Xcode:

1. Selecione o projeto **App** → separador **Signing & Capabilities**.
2. Em **Team**, escolha a sua conta Apple.
3. Se o identificador `br.com.litobrasil.structanote` já existir noutra conta, altere o
   **Bundle Identifier** (ex.: `com.seunome.structanote`) e repita `npx cap sync ios`.
4. Ligue o iPhone por cabo, escolha-o como destino e carregue em **Run** (▶).

Na primeira execução, o iPhone pede para confiar no programador: Ajustes → Geral →
VPN e Gestão de Dispositivos → Confiar.

> Com conta gratuita o app expira ao fim de 7 dias (basta voltar a instalar). Com conta paga,
> vale 1 ano e pode ser enviado para TestFlight/App Store.

## Opção B — GitHub Actions (sem Mac)

O repositório traz `.github/workflows/ios.yml`:

1. Crie um repositório no GitHub e envie esta pasta (sem `node_modules`).
2. Em **Actions → iOS build → Run workflow**.
3. No fim, descarregue o artefacto `StructaNote-ipa` com o ficheiro **`StructaNote-unsigned.ipa`**.
4. Assine o `.ipa` no Windows ou Mac com o seu Apple ID:
   - **Sideloadly** (Windows/Mac) — arraste o `.ipa`, introduza o Apple ID e instale no iPhone ligado.
   - **AltStore / SideStore** — instalação automática com assinatura a cada 7 dias.

Para gerar um `.ipa` já assinado (Ad Hoc/TestFlight), acrescente estes segredos ao repositório:
`BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD`, `PROVISIONING_PROFILE_BASE64`, `TEAM_ID`.

## Opção C — App Store / TestFlight

Precisa de **Apple Developer Program** (99 USD/ano). Depois de assinado, use o Xcode
(**Product → Archive → Distribute App**) ou o Transporter para enviar para App Store Connect.
Notas de revisão:

- A app não recolhe dados para servidores (tudo fica no aparelho) — declare isso na privacidade.
- Explique a utilização de localização (caderneta georreferenciada) e de sensores (bússola/clinómetro).
- O GPS em segundo plano só é usado durante a gravação de trilhos.

---

## O que já está tratado no código

| Área | Estado |
| --- | --- |
| Fotos | IndexedDB (sem limite de 5 MB), migração automática, backup embute imagens |
| Exportações | Folha de partilha / Filesystem + Share |
| GPS | `@capacitor/geolocation` ligado a `navigator.geolocation` no iOS |
| Bússola / clinómetro | `requestPermission` + `webkitCompassHeading`, aviso sem magnetómetro |
| Interface | Áreas seguras, inputs a 16 px, barra de estado clara |
| Ícone / splash | 1024 px opaco e splash escuro com logótipo |

## Limitações conhecidas no iOS

- O Safari/WKWebView suspende o GPS quando o ecrã bloqueia (limitação do sistema).
- Service worker não existe dentro do WKWebView — é irrelevante, a app já está no aparelho.
- A bússola depende do magnetómetro; em rochas muito magnéticas confirme com bússola convencional.
