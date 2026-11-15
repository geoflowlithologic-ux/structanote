# StructaNote — projeto iOS (Capacitor)

Projeto pronto a compilar no GitHub Actions e instalar num iPhone com conta Apple gratuita.

- **App web**: pasta `www/` (a mesma que corre no Android e no navegador).
- **Projeto iOS**: `ios/App` (Xcode workspace, permissões, ícone, splash).
- **Workflow**: `.github/workflows/ios.yml` — gera `StructaNote-unsigned.ipa`.

## Instalar no iPhone (grátis)

Siga o passo a passo em [GUIA-INSTALAR-IPHONE.md](GUIA-INSTALAR-IPHONE.md): criar repositório
**público**, Actions → *Run workflow*, descarregar o `.ipa` e assinar com o Sideloadly.

## Compilar localmente (precisa de macOS)

```bash
npm install
npx cap sync ios
cd ios/App && pod install && cd ../..
open ios/App/App.xcworkspace
```

Detalhes e notas da App Store: [iOS-BUILD.md](iOS-BUILD.md).

## Atualizar a app

Substitua a pasta `www/` pela versão nova, faça commit e volte a correr o workflow.
