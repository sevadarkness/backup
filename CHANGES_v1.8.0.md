# ChatBackup v1.8.0 - Visual Changes Overview

## UI Before and After

### Contact List Section (BEFORE v1.7.1)
```
📇 Selecionar Conversa
┌─────────────────────────────────┐
│ 🔄 Carregar Contatos            │
└─────────────────────────────────┘

After clicking:
┌─────────────────────────────────┐
│ 🔍 Buscar contato ou grupo...   │
├─────────────────────────────────┤
│ 👥 Group 1                      │
│ 👤 Contact 1                    │
│ 👥 Group 2                      │
│ 👤 Contact 2                    │
│ ... (ALL contacts, no limit)    │
└─────────────────────────────────┘
```

### Contact List Section (AFTER v1.8.0)
```
📇 Selecionar Conversa
┌─────────────────────────────────┐
│ 🔄 Carregar Contatos            │
└─────────────────────────────────┘

After clicking:
┌─────────────────────────────────┐
│ 🔍 Buscar contato ou grupo...   │
├─────────────────────────────────┤
│ Ordenar por: [Mais recentes ▼] │
├─────────────────────────────────┤
│ Exibindo 20 de 150 contatos     │ ← NEW COUNTER
├─────────────────────────────────┤
│ ▼ 👥 Grupos (80)                │ ← COLLAPSIBLE
│   👥 Group 1                    │
│   👥 Group 2                    │
│   ... (max 15 shown initially)  │
├─────────────────────────────────┤
│ ▼ �� Contatos (70)              │ ← COLLAPSIBLE
│   👤 Contact 1                  │
│   👤 Contact 2                  │
│   ... (max 5 shown initially)   │
├─────────────────────────────────┤
│      [Carregar mais]            │ ← NEW BUTTON
└─────────────────────────────────┘
```

### Chat Card (BEFORE v1.7.1)
```
┌─────────────────────────────────┐
│ 💬 Chat Name                    │
│ 👤 Conversa                     │
└─────────────────────────────────┘
```

### Chat Card (AFTER v1.8.0)
```
┌─────────────────────────────────┐
│ 💬 Chat Name                    │
│ 👤 Conversa                     │
├─────────────────────────────────┤
│ 📤 Exportar Conversa Atual      │ ← NEW BUTTON
└─────────────────────────────────┘
```

### Media Export (BEFORE v1.7.1)
```
📦 Exportar Mídias (opcional)
☐ 🖼️ Imagens (includes videos!)
☐ 🎵 Áudios
☐ 📎 Documentos
```

### Media Export (AFTER v1.8.0)
```
📦 Exportar Mídias (opcional)
☐ 🖼️ Imagens (images & stickers only)
☐ 🎬 Vídeos (new separate option!)
☐ 🎵 Áudios
☐ 📎 Documentos
```

### Progress Bars (BEFORE v1.7.1)
```
During export:
📊 Progresso de Mídias:
🖼️ Imagens:  [████████] 100/100
🎵 Áudios:   [████████] 50/50
📎 Documentos: [████████] 10/10
```

### Progress Bars (AFTER v1.8.0)
```
During export:
📊 Progresso de Mídias:
🖼️ Imagens:  [████████] 80/80    (no videos!)
🎬 Vídeos:   [████████] 20/20    ← NEW PROGRESS BAR
🎵 Áudios:   [████████] 50/50
📎 Documentos: [████████] 10/10
```

## File Structure Changes

### Download Results (BEFORE v1.7.1)
```
Downloads folder:
├── ChatName_2024-12-31.html       (text export)
├── ChatName_2024-12-31_imagens.zip
│   ├── image_001.jpg
│   ├── video_001.mp4              ← videos mixed with images
│   ├── image_002.png
│   └── video_002.mp4
├── ChatName_2024-12-31_audios.zip
└── ChatName_2024-12-31_docs.zip
```

### Download Results (AFTER v1.8.0)
```
Downloads folder:
├── ChatName_2024-12-31.html       (text export)
├── ChatName_2024-12-31_imagens.zip
│   ├── image_001.jpg              ← only images now!
│   ├── image_002.png
│   └── sticker_001.webp
├── ChatName_2024-12-31_videos.zip ← NEW separate file
│   ├── video_001.mp4
│   └── video_002.mp4
├── ChatName_2024-12-31_audios.zip
└── ChatName_2024-12-31_docs.zip
```

## User Workflows

### Workflow 1: Export with Contact Selector
```
1. Click extension icon
2. Click "🔄 Carregar Contatos"
3. Search or browse contacts (paginated)
4. Select contact from list
5. Configure settings
6. Click "Exportar conversa"
```

### Workflow 2: Export Current Chat (NEW!)
```
1. Open a chat in WhatsApp Web
2. Click extension icon
3. See chat info displayed
4. Configure settings
5. Click "📤 Exportar Conversa Atual"  ← NEW simplified flow
```

### Workflow 3: Video Export
```
1. Select or open chat
2. Check ✓ 🖼️ Imagens
3. Check ✓ 🎬 Vídeos              ← NEW checkbox
4. Check ✓ 🎵 Áudios (optional)
5. Check ✓ 📎 Documentos (optional)
6. Click "Exportar conversa"
7. Watch separate progress bars
8. Receive separate ZIP files      ← NEW behavior
```

## Behavioral Changes

### Pagination Behavior
| Action | Items Shown |
|--------|-------------|
| Initial load | 20 contacts (groups first) |
| Click "Carregar mais" | +20 more contacts |
| Continue clicking | Until all shown |
| Search/Filter | Reset to 20 from filtered set |

### Sorting Behavior
| Option | Effect |
|--------|--------|
| Mais recentes | Original WhatsApp order (by last message) |
| Nome A-Z | Alphabetical ascending |
| Nome Z-A | Alphabetical descending |

### Section Collapse Behavior
| State | Visual | Action |
|-------|--------|--------|
| Expanded | ▼ Title (X) | Click to collapse |
| Collapsed | ▶ Title (X) | Click to expand |
| Count | Updates with filter | Shows total in section |

### Export Button States
| Button | Enabled When | Action |
|--------|-------------|--------|
| Exportar conversa | Always | Uses selected contact OR current chat |
| Exportar Conversa Atual | Chat is open | Uses current chat (ignores selection) |

## Progress Timeline Changes

### Old Progress (v1.7.1)
```
0%  ─────► 60% ─────► 85% ─────► 95% ─────► 100%
    Load      Process   Download    Generate   Done
    messages  messages  all media   file
```

### New Progress (v1.8.0)
```
0%  ─────► 30% ─────► 35% ─────► 50% ─────► 60% ─────► 70% ─────► 78% ─────► 85% ─────► 100%
    Load      Process   Generate  Download  Download  Download  Download  Final     Done
    messages  messages  text      images    videos    audios    docs      steps
                                  (50-60%)  (60-70%)  (70-78%)  (78-85%)
```

## Storage Keys Added

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| chatbackup_export_videos | boolean | false | Remember video export preference |

## API Changes (Internal)

### Message to Bridge (content.js → extractor.js)
```javascript
// OLD
downloadMediaForExport(messages, {
  exportImages: true,  // includes videos
  exportAudios: true,
  exportDocs: true
})

// NEW
downloadMediaForExport(messages, {
  exportImages: true,  // images/stickers only
  exportVideos: true,  // videos separate
  exportAudios: true,
  exportDocs: true
})
```

### Response Structure
```javascript
// OLD
{
  images: { blobUrl, count },
  audios: { blobUrl, count },
  docs: { blobUrl, count }
}

// NEW
{
  images: { blobUrl, count },  // no videos
  videos: { blobUrl, count },  // new field
  audios: { blobUrl, count },
  docs: { blobUrl, count }
}
```

## Performance Impact

| Aspect | Before | After | Impact |
|--------|--------|-------|--------|
| Contact list render | All at once | 20 at a time | ✅ Faster initial load |
| Memory usage (contacts) | All loaded | All loaded (same) | ➖ No change |
| Video download | With images | Separate | ➖ Same speed, better organization |
| Progress updates | 3 types | 4 types | ➖ Negligible |
| UI responsiveness | Good | Better | ✅ Improved with pagination |

## Migration Path

No user action required. Changes are backward compatible:
- Existing exports remain valid
- Old settings migrate automatically
- New features available immediately
- No data loss or corruption

---

**Version**: 1.8.0  
**Date**: 2024-12-31  
**Breaking Changes**: None  
**Migration Required**: No
