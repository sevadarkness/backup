# ChatBackup v1.0.6

## O que esta versão faz (do jeito que você pediu)
- Exporta **histórico completo** via **API interna (WAWeb*)** com `loadEarlierMsgs()` em loop.
- Diferencia **Enviada vs Recebida** usando `fromMe`.
- Baixa imagens via `msg.downloadMedia()` (best-effort) e:
  - embute no HTML (até ~25MB de imagens)
  - e/ou baixa arquivos separadamente se marcado no popup.

## Como instalar
1) chrome://extensions
2) Ativar "Modo do desenvolvedor"
3) "Carregar sem compactação" → selecione a pasta extraída
4) Abra web.whatsapp.com e recarregue a aba

## Observação
Algumas mídias podem falhar (403/expiradas) por política do WhatsApp Web.
