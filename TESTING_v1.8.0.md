# Testing Guide for ChatBackup v1.8.0

## What's New in v1.8.0

### 1. Improved Contact List with Pagination
- Shows 20 contacts initially
- "Load More" button to load additional contacts
- Counter showing "Exibindo X de Y contatos"

### 2. Contact Sorting
- Dropdown with sorting options:
  - "Mais recentes" (default - by last message)
  - "Nome A-Z" (alphabetical ascending)
  - "Nome Z-A" (alphabetical descending)

### 3. Collapsible Sections for Groups/Contacts
- Two separate sections:
  - "👥 Grupos (X)" - All groups
  - "👤 Contatos (Y)" - Individual contacts
- Click section headers to expand/collapse
- Shows count for each type

### 4. Export Current Chat Button
- New button "📤 Exportar Conversa Atual" in chat card
- Exports the chat currently open in WhatsApp Web
- Disabled (grayed out) when no chat is open
- Independent from contact selector

### 5. Videos Separated from Images
- New checkbox "🎬 Vídeos" in media export section
- Videos now export to separate `videos.zip` file
- Images (`images.zip`) now only contains images and stickers
- Separate progress bar for videos during export

## Test Prerequisites

1. Load extension in Chrome:
   - Navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the project directory

2. Open WhatsApp Web:
   - Go to https://web.whatsapp.com
   - Login if needed

## Test Cases

### Test 1: Contact Pagination
**Expected:** Contacts load 20 at a time with option to load more

**Steps:**
1. Click extension icon
2. Click "🔄 Carregar Contatos"
3. Wait for contacts to load
4. Verify only 20 contacts show initially
5. Check for "Carregar mais" button at bottom
6. Click "Carregar mais"
7. Verify 20 more contacts appear

**Verification:**
✅ Initial load shows max 20 contacts  
✅ Counter shows "Exibindo X de Y contatos"  
✅ "Carregar mais" button visible if more than 20 total  
✅ Each click loads up to 20 more  
✅ Button hides when all contacts loaded  

### Test 2: Contact Sorting
**Expected:** Contacts sort by selected option

**Steps:**
1. Load contacts
2. Select "Nome A-Z" from dropdown
3. Verify contacts sorted alphabetically
4. Select "Nome Z-A"
5. Verify reverse alphabetical order
6. Select "Mais recentes"
7. Verify original order (by last message)

**Verification:**
✅ A-Z sorts alphabetically  
✅ Z-A sorts reverse alphabetically  
✅ "Mais recentes" maintains original order  
✅ Sorting persists when loading more  
✅ Sorting works with search filter  

### Test 3: Collapsible Sections
**Expected:** Groups and contacts in separate collapsible sections

**Steps:**
1. Load contacts
2. Verify two sections visible:
   - "👥 Grupos (X)"
   - "👤 Contatos (Y)"
3. Click "Grupos" header
4. Verify groups section collapses (icon changes to ▶)
5. Click header again
6. Verify groups section expands (icon changes to ▼)
7. Repeat for "Contatos" section

**Verification:**
✅ Sections show correct counts  
✅ Clicking header toggles visibility  
✅ Arrow icon changes (▼ expanded, ▶ collapsed)  
✅ Can collapse/expand independently  
✅ State persists during pagination  

### Test 4: Export Current Chat Button
**Expected:** Button exports the currently open chat

**Steps:**
1. Open WhatsApp Web
2. Open a specific chat (don't select from extension)
3. Click extension icon
4. Verify "📤 Exportar Conversa Atual" button visible
5. Configure export settings
6. Click "Exportar Conversa Atual"
7. Wait for export to complete
8. Verify exported chat matches the open chat

**Test without open chat:**
1. Don't open any chat in WhatsApp
2. Click extension icon
3. Verify button is disabled/grayed out

**Verification:**
✅ Button visible in chat card  
✅ Disabled when no chat open  
✅ Exports currently open chat  
✅ Works independently of contact selector  
✅ Shows proper chat name during export  

### Test 5: Video Export Separation
**Expected:** Videos export separately from images

**Steps:**
1. Select a chat with both images and videos
2. Check "🖼️ Imagens" checkbox
3. Check "🎬 Vídeos" checkbox
4. Click "Exportar conversa"
5. Watch progress bars
6. Wait for completion
7. Check downloaded files

**Verification:**
✅ Videos checkbox present in UI  
✅ Separate video progress bar appears  
✅ Progress shows for videos: "Baixando vídeos... (X/Y)"  
✅ Two separate ZIP files downloaded:
   - `[ChatName]_[Date]_imagens.zip` (only images/stickers)
   - `[ChatName]_[Date]_videos.zip` (only videos)  
✅ Images ZIP does NOT contain videos  
✅ Videos ZIP contains .mp4/.3gp files  

### Test 6: Combined Features
**Expected:** All features work together

**Steps:**
1. Load contacts
2. Use search to filter: "test"
3. Change sort to "Nome A-Z"
4. Collapse groups section
5. Load more contacts
6. Select a contact
7. Check all media types including videos
8. Export

**Verification:**
✅ Search, sort, and pagination work together  
✅ Collapsed sections stay collapsed during pagination  
✅ Selected contact shows in chat card  
✅ Export includes videos separately  
✅ All progress bars update correctly  

### Test 7: Settings Persistence
**Expected:** Settings saved and restored

**Steps:**
1. Check "🎬 Vídeos" checkbox
2. Select "Nome Z-A" sorting
3. Close popup
4. Reopen popup
5. Verify settings maintained

**Verification:**
✅ Video checkbox state saved  
✅ Other media checkboxes saved  
✅ Export format saved  
✅ Limit saved  
✅ Date filters saved  

## Known Issues/Limitations

- Maximum 20 contacts per pagination page
- Sorting only applies to displayed contacts
- Collapsible state resets on popup close
- Export current chat requires active WhatsApp Web session

## Performance Notes

- Contact list virtualization not implemented (acceptable for typical use)
- Video exports may be slower due to file size
- Progress ranges: Images 50-60%, Videos 60-70%, Audios 70-78%, Docs 78-85%

## Debugging

If issues occur:
1. Open Chrome DevTools (F12)
2. Check Console tab for errors
3. Verify WhatsApp Web is fully loaded
4. Check that contacts load successfully
5. Verify version shows v1.8.0 in popup header
6. Check Network tab during media downloads

## Browser Compatibility

Tested on:
- Chrome 120+
- Edge 120+
- Brave 1.60+
- Opera 105+

## Success Criteria

All features working correctly:
- ✅ Pagination shows 20 items, loads more on demand
- ✅ Sorting changes contact order as expected
- ✅ Sections collapse/expand on click
- ✅ Export current chat button works with open chat
- ✅ Videos export separately from images
- ✅ All progress bars update correctly
- ✅ Settings persist across sessions
- ✅ No console errors during normal operation
- ✅ No security vulnerabilities (CodeQL passed)
