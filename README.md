# Language File Handler

A web-based tool for managing internationalization (i18n) JSON language files with AI-powered translation and validation.

## Features

- **Load Language Files**: Drag & drop, file picker, or open a folder directly
- **Visual Table Editor**: View all translation keys across all languages in a unified table
- **CRUD Operations**:
  - Add new keys with values for each language
  - Delete keys from all languages
  - Edit values inline (click any cell)
  - Add/remove values for specific languages
- **Add New Languages**: Create new language files on the fly
- **AI Translation** (via LM Studio):
  - Auto-translate missing values using context from existing translations
  - Maintains formatting, placeholders, and special syntax
- **AI Validation**:
  - Select "source of truth" languages
  - Validate other translations for correctness
  - Get suggested corrections for incorrect translations
  - Apply all suggestions with one click
- **Comments System**:
  - Add comments to any key for any language
  - Comments are stored in separate `{lang}.comments.json` files
  - AI translations are automatically commented as "AI Translated"
  - AI validation issues are automatically logged with suggested corrections
  - View and add comments when editing any value
- **Save & Export**:
  - Save directly to the opened folder (File System Access API)
  - Download all files as a ZIP archive
- **Search & Filter**: Quickly find keys by name

## Requirements

- **Browser**: Chrome or Edge (for File System Access API support)
- **LM Studio** (optional): Running at `http://127.0.0.1:1234` for AI features

## Getting Started

1. Open `index.html` in Chrome or Edge
2. Load your language files using one of these methods:
   - Drag & drop JSON files onto the drop zone
   - Click "Pick Files" to select files
   - Click "Open Folder" to select a folder containing JSON files (enables direct saving)
3. Edit translations in the table
4. Save your changes

## JSON File Format

The tool expects JSON files with nested structures. File names (without `.json`) become language identifiers.

Example (`en.json`):
```json
{
  "strings": {
    "welcomeMessage": "Welcome to the app!",
    "ui": {
      "menu": "MENU",
      "play": "PLAY",
      "settings": "SETTINGS"
    },
    "achievements": {
      "tutorialHeader": "FAST LEARNER",
      "tutorialDescription": "FINISH THE TUTORIAL"
    }
  }
}
```

Keys are displayed in dot-notation: `strings.ui.menu`, `strings.achievements.tutorialHeader`, etc.

## Comment Files

Comments are stored in separate files named `{lang}.comments.json`. For example, comments for English translations are stored in `en.comments.json`.

Example (`en.comments.json`):
```json
{
  "strings.ui.menu": [
    "[2026-02-13T12:00:00.000Z] AI Translated",
    "[2026-02-13T12:05:00.000Z] Reviewed by John"
  ],
  "strings.achievements.tutorialHeader": [
    "[2026-02-13T12:10:00.000Z] AI Validation: Incorrect. Suggested: \"QUICK LEARNER\""
  ]
}
```

Comments are automatically added when:
- AI translates a missing value ("AI Translated")
- AI validation finds an incorrect translation (includes the suggested correction)

You can also manually add comments when editing any value.

## Using AI Features

### Setup LM Studio

1. Download and install [LM Studio](https://lmstudio.ai/)
2. Load a language model (recommended: any instruction-tuned model)
3. Start the local server (default: `http://127.0.0.1:1234`)
4. The status indicator in the app header will show "AI Online" when connected

### Auto-Translation

1. Click the globe icon on any row with missing translations
2. The AI will use existing translations as context
3. Missing languages will be filled automatically

### Translation Validation

1. Click "Validate Translations" in the toolbar
2. Select source languages (these are considered correct)
3. Select languages to validate
4. Choose scope (all keys or filtered keys)
5. Click "Start Validation"
6. Review results and apply suggestions

## Keyboard Shortcuts

- `Ctrl+S` / `Cmd+S`: Save (to folder if opened, otherwise download ZIP)
- `Escape`: Close any open modal

## File System Access API

When you use "Open Folder", the app gains permission to write back to that folder:
- The "Save to Folder" button becomes enabled
- New languages are automatically saved as new files
- Changes are written directly to the source files

**Note**: This feature requires Chrome or Edge. Firefox and Safari will need to use the ZIP download option.

## Tips

- Use the search box to filter keys when working with large files
- The language column headers show completion counts (e.g., "150/200")
- Click any cell to edit its value
- Check "Remove this key from this language" to mark a translation as missing
- AI translation preserves special formatting like `{0}`, `[b]`, `[icon=...]`

## Troubleshooting

### AI features are disabled
- Ensure LM Studio is running
- Check that the server is accessible at `http://127.0.0.1:1234`
- The status indicator should show "AI Online"

### Can't save to folder
- Use Chrome or Edge browser
- Use "Open Folder" instead of drag & drop or file picker
- Grant permission when prompted

### JSON parsing errors
- Ensure your files are valid JSON
- Check for trailing commas or syntax errors
- The console will show detailed error messages

## License

MIT License - Feel free to use and modify as needed.
