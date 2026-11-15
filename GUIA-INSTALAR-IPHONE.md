# StructaNote no iPhone — guia grátis (sem Mac, sem conta paga)

Este guia instala a StructaNote num iPhone gastando **0 €/R$**: o GitHub compila a app num Mac
na nuvem e o seu notebook apenas assina e envia o ficheiro para o telefone.

Tempo total: cerca de 40 minutos na primeira vez. Depois, repetir a assinatura a cada 7 dias.

---

## Antes de começar

- Um **notebook com Windows 10/11 ou macOS** (para o Sideloadly).
- Um **iPhone** com iOS 16 ou superior e um **Apple ID** (o gratuito serve).
- Conta **GitHub** gratuita: https://github.com/signup
- O ficheiro **StructaNote-GitHub.zip** (este pacote) descompactado no notebook.

---

## Passo 1 — Criar o repositório no GitHub (5 min)

1. Em https://github.com/new crie um repositório:
   - **Name**: `structanote`
   - **Visibility**: **Public** (obrigatório — só os repositórios públicos têm minutos de macOS gratuitos e ilimitados)
   - Não marque "Add a README".
2. Clique em **Create repository**.
3. Envie o conteúdo da pasta descompactada. Duas formas:

   **A) Pelo site (sem instalar nada)**
   - No repositório vazio, clique em **uploading an existing file**.
   - Abra a pasta no Explorador e arraste **todo o conteúdo** para o navegador
     (incluindo as pastas `.github`, `ios` e `www`).
   - Escreva uma mensagem ("StructaNote iOS") e clique em **Commit changes**.

   **B) Com GitHub Desktop (mais seguro para pastas escondidas)**
   - Instale o GitHub Desktop → **File → Add local repository** → escolha a pasta.
   - **Publish repository** → desmarque *Keep this code private*.

> Se a pasta `.github` não subir pelo site, use o GitHub Desktop ou crie manualmente o ficheiro
> `.github/workflows/ios.yml` no site (botão *Add file → Create new file*, escrevendo o caminho completo).

## Passo 2 — Compilar no GitHub Actions (10 min, automático)

1. No repositório, abra o separador **Actions**.
2. Se aparecer um aviso, clique em **I understand my workflows, go ahead and enable them**.
3. Escolha **iOS build (StructaNote)** na lista da esquerda → botão **Run workflow** → **Run workflow**.
4. Espere 15–25 minutos. O símbolo fica verde quando terminar.
5. Abra a execução concluída e, no fundo, em **Artifacts**, descarregue **StructaNote-ipa**.
6. Descompacte o ficheiro descarregado: dentro está **`StructaNote-unsigned.ipa`**.

## Passo 3 — Preparar o Windows (5 min)

1. Instale o **Sideloadly**: https://sideloadly.io
2. Instale o **Apple Devices** (Microsoft Store) ou o **iTunes** — são os drivers do iPhone no Windows.
3. Ligue o iPhone por cabo e toque em **Confiar** no telefone.

## Passo 4 — Ativar o Modo de Desenvolvedor no iPhone (só na primeira vez)

1. No iPhone: **Ajustes → Privacidade e Segurança → Modo de Desenvolvedor** → ativar.
2. O iPhone pede para **reiniciar** — reinicie e confirme o Modo de Desenvolvedor ao ligar.

> Esta opção só aparece depois de o iPhone "ver" o primeiro pacote de desenvolvimento; se não
> estiver lá, avance para o passo 5 e volte a este passo depois da primeira tentativa de instalação.

## Passo 5 — Assinar e instalar com o Sideloadly (5 min)

1. Abra o Sideloadly e arraste o `StructaNote-unsigned.ipa` para a janela
   (ou clique no ícone da maçã e escolha o ficheiro).
2. Em **Apple ID**, escreva o seu Apple ID e a palavra-passe.
3. Se pedir código de verificação de dois fatores, introduza o código que aparece no iPhone.
4. Opcional: mude o **Bundle ID** (ex.: `com.seunome.structanote`) se der erro de identificador
   já usado.
5. Clique em **Start**. O Sideloadly assina e instala — demora 2 a 5 minutos.
6. No fim, aparece "Done".

## Passo 6 — Confiar na app no iPhone

1. No iPhone: **Ajustes → Geral → VPN e Gestão de Dispositivos → Developer App** →
   toque no seu Apple ID → **Confiar**.
2. Abra a StructaNote. Na primeira utilização aceite as permissões de localização, câmara e
   movimento/sensores.

---

## Renovar a cada 7 dias

A conta Apple gratuita assina por 7 dias. Antes de expirar:

1. Ligue o iPhone ao notebook.
2. Abra o Sideloadly, arraste o mesmo `.ipa` e clique em **Start**.
3. A app abre normalmente e os dados ficam intactos (as atualizações por cima mantêm a base de dados).

Alternativa: **AltStore** ou **SideStore** fazem esta renovação sozinhos, mas exigem o notebook
ligado na mesma rede Wi-Fi.

---

## Problemas comuns

| Mensagem | Solução |
| --- | --- |
| `This app cannot be installed because its integrity could not be verified` | Falta confiar no programador: Ajustes → Geral → VPN e Gestão de Dispositivos |
| `Developer Mode disabled` | Ativar o Modo de Desenvolvedor (Passo 4) e reiniciar |
| `Unable to install at this time` | Desligue e ligue o iPhone, confirme "Confiar" no telefone e repita |
| `The maximum number of apps for free development profiles has been reached` | Limite da conta gratuita (3 apps). Apague uma app antiga assinada pela mesma conta |
| `Your Apple ID or password is incorrect` | Use a palavra-passe normal do Apple ID (não a de um app específico); se tiver 2FA, introduza o código |
| Actions falha em `pod install` | Execute novamente o workflow; se persistir, troque `runs-on: macos-14` por `macos-15` |
| App abre e fecha de imediato | A assinatura expirou: repita o Passo 5 |

---

## Quando a conta gratuita não chega

Se quiser a app instalada durante 1 ano, TestFlight para testadores ou App Store:

- **Apple Developer Program** (99 USD/ano) → builds com validade de 1 ano e TestFlight até 10 000
  testadores. Depois disso pode usar o Xcode no Mac, ou preencher os segredos do workflow
  (`BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD`, `PROVISIONING_PROFILE_BASE64`, `TEAM_ID`) para o
  GitHub gerar o `.ipa` já assinado.

## Atualizar a app mais tarde

Quando houver uma versão nova (novo `www/`):

1. Substitua a pasta `www` no repositório (arraste a nova pasta para o site do GitHub → Commit).
2. Actions → **Run workflow** → descarregue o novo `.ipa`.
3. Sideloadly → instalar por cima. Os dados do utilizador são mantidos.
