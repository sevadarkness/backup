# ChatBackup v1.4.0

## Novidades da versão 1.4.0
- 📊 **Barra de progresso com porcentagem**: Visualização detalhada do progresso de extração com porcentagem e status
- 🖼️ **Foto e nome do chat no popup**: Exibição da foto de perfil e nome do chat ativo no popup
- 📅 **Filtro de período (calendário)**: Filtrar mensagens por data específica (De/Até) usando seletores de data
- 📦 **Exportação ZIP com mídias**: Todas as mídias agora são exportadas em um único arquivo ZIP contendo:
  - `backup.html` - Arquivo HTML principal com referências às mídias locais
  - `backup.json` - Dados brutos em JSON
  - `media/` - Pasta com todas as mídias (imagens, vídeos, áudios, documentos)
- ✅ **Mídias visualizáveis**: Após extrair o ZIP, todas as mídias são visualizáveis localmente no HTML

## Novidades da versão 1.1.0
- ✨ **Suporte a mais módulos WAWeb**: WAWebMsgCollection, WAWebChatLoadMessages, WAWebDownloadManager
- 🎥 **Suporte a vídeos e áudios**: Exporta e embute vídeos/áudios no HTML (além de imagens)
- 📄 **Suporte a documentos**: Exporta documentos (PDF, DOC, etc.) com links de download no HTML
- 🔐 **Download aprimorado**: Usa WAWebDownloadManager.downloadAndMaybeDecrypt() para melhor tratamento de mídias
- 🔄 **Múltiplos fallbacks para mídias**: 
  - WAWebDownloadManager.downloadAndMaybeDecrypt()
  - msg.downloadMedia()
  - mediaData.downloadMedia()
  - mediaData.mediaBlob()
  - deprecatedMms3Url (URL direta do CDN)
- 📊 **Serialização completa**: Extrai todas as propriedades __x_* das mensagens (mediaKey, directPath, mimetype, etc.)
- 📈 **Progresso detalhado**: Mostra contador de sucessos/falhas durante download de mídias

## O que esta versão faz
- Exporta **histórico completo** via **API interna (WAWeb*)** com `loadEarlierMsgs()` em loop.
- Diferencia **Enviada vs Recebida** usando `fromMe`.
- Baixa **imagens, vídeos, áudios e documentos** via API interna:
  - embute mídias no HTML (até ~25MB total)
  - e/ou baixa arquivos separadamente se marcado no popup.
- Suporta múltiplos formatos: **HTML, JSON, CSV, TXT**
- **Robustez**: Múltiplos métodos de fallback para download de mídias quando primário falha

## Como instalar
1) chrome://extensions
2) Ativar "Modo do desenvolvedor"
3) "Carregar sem compactação" → selecione a pasta extraída
4) Abra web.whatsapp.com e recarregue a aba

## Observação
Algumas mídias podem falhar (403/expiradas) por política do WhatsApp Web, mas o sistema tenta múltiplos métodos de download automaticamente.
