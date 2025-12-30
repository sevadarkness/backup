# Testing Guide for ChatBackup v1.4.0

## Prerequisites
1. Load the extension in Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `/home/runner/work/backup/backup` directory

2. Open WhatsApp Web:
   - Navigate to https://web.whatsapp.com
   - Login if needed
   - Select a chat

## Test Cases

### 1. Progress Bar with Percentage
**Expected:** Progress bar should show percentage and detailed status during export

**Steps:**
1. Click the extension icon
2. Click "Exportar conversa"
3. Observe the progress bar

**Verification:**
- Progress bar shows percentage (0-100%)
- Status messages show stages: "Carregando histórico...", "Baixando mídias...", "Gerando arquivo..."
- Detail shows current/total counts

### 2. Chat Photo Display
**Expected:** Chat photo and name should display in popup

**Steps:**
1. Select a chat with a profile picture
2. Click the extension icon
3. Look at the chat card

**Verification:**
- Chat photo displays (if available)
- Chat name displays correctly
- Group indicator shows "👥 Grupo" for groups
- Contact indicator shows "👤 Conversa" for individual chats

### 3. Date Filter (Calendar)
**Expected:** User can filter messages by date range

**Steps:**
1. Click the extension icon
2. Set "De:" date (e.g., 2024-01-01)
3. Set "Até:" date (e.g., 2024-12-31)
4. Click "Exportar conversa"

**Verification:**
- Only messages within the date range are exported
- Empty dates export all messages
- Date inputs accept valid dates

### 4. ZIP Export with Media
**Expected:** Export creates a ZIP file containing HTML, JSON, and media files

**Steps:**
1. Select a chat with media (images, videos, etc.)
2. Check "Baixar e incluir mídias"
3. Click "Exportar conversa"
4. Wait for export to complete
5. Extract the downloaded ZIP file

**Verification:**
- ZIP file downloaded with format: `backup_ChatName_YYYY-MM-DD.zip`
- ZIP contains:
  - `backup.html` - Main HTML file
  - `backup.json` - JSON data
  - `media/` folder with media files (image_001.jpg, video_002.mp4, etc.)
- Open `backup.html` in browser
- Media files display correctly in HTML
- Media references use local paths (e.g., `media/image_001.jpg`)

### 5. Media Types Support
**Expected:** All media types are supported and properly formatted

**Types to test:**
- Images (JPG, PNG, WEBP, GIF)
- Videos (MP4, 3GP)
- Audio (OGG, MP3, OPUS)
- Documents (PDF, DOC, DOCX)
- Voice messages (PTT)

**Verification:**
- All media types download successfully
- Correct file extensions assigned
- Media viewable in exported HTML

### 6. Export Formats
**Expected:** All export formats work correctly

**Formats:**
- HTML (with ZIP if media included)
- CSV
- JSON
- TXT

**Verification:**
- Each format exports successfully
- Data is correctly formatted
- Media handling works per format

### 7. Progress Details
**Expected:** Detailed progress information during media download

**Steps:**
1. Export a chat with many media files
2. Watch the progress messages

**Verification:**
- Shows "Baixando mídias... (X/Y, ✓Success ✗Failed)"
- Final summary shows total success/failure count
- Progress percentage updates smoothly

## Known Issues/Limitations
- JSZip loads dynamically in content script
- Profile picture extraction depends on WhatsApp Web API
- Maximum ~5000 media files per export
- Date filter requires valid date format (YYYY-MM-DD)

## Debugging
If issues occur:
1. Open Chrome DevTools (F12)
2. Check Console for errors
3. Check Network tab for failed requests
4. Verify extension permissions in manifest.json
5. Check that JSZip loaded correctly
