# ChatBackup v1.5.0

## Novidades da versão 1.5.0
- 📇 **Seletor de Contatos**: Agora é possível carregar todos os contatos/chats e exportar sem precisar abrir o chat no WhatsApp
- 🔍 **Busca de Contatos**: Campo de busca para filtrar contatos por nome
- 👥 **Diferenciação Visual**: Ícones diferentes para grupos (👥) e contatos (👤)
- ⏱️ **Ordenação Inteligente**: Conversas ordenadas por mensagem mais recente

## Novidades da versão 1.4.3
- 🔧 **Simplificação**: Removida funcionalidade de download de mídias (não estava funcionando corretamente)
- 💬 **Foco em mensagens**: Exportação agora concentrada em texto das conversas
- ⚡ **Mais rápido**: Sem processamento de mídias, exportação é mais rápida e confiável

## Novidades da versão 1.4.0
- 📊 **Barra de progresso com porcentagem**: Visualização detalhada do progresso de extração com porcentagem e status
- 🖼️ **Foto e nome do chat no popup**: Exibição da foto de perfil e nome do chat ativo no popup
- 📅 **Filtro de período (calendário)**: Filtrar mensagens por data específica (De/Até) usando seletores de data

## O que esta versão faz
- Exporta **histórico completo** via **API interna (WAWeb*)** com `loadEarlierMsgs()` em loop.
- Diferencia **Enviada vs Recebida** usando `fromMe`.
- Suporta múltiplos formatos: **HTML, JSON, CSV, TXT**
- Filtragem por data e limite de mensagens
- Interface simples e intuitiva

## Como instalar
1) chrome://extensions
2) Ativar "Modo do desenvolvedor"
3) "Carregar sem compactação" → selecione a pasta extraída
4) Abra web.whatsapp.com e recarregue a aba

## Funcionalidades
- ✅ Carregamento de todas as mensagens (loop corrigido)
- ✅ Nome do chat no popup
- ✅ Filtro de datas
- ✅ Filtro de quantidade (limite)
- ✅ Barra de progresso
- ✅ localStorage para configurações
- ✅ Exportação em HTML, CSV, JSON, TXT (apenas texto)
- ✅ Timestamps e remetente opcionais
