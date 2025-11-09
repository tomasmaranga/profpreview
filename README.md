# ProfPreview: Rate My Professors Chrome Extension for Tufts SIS

This Chrome extension helps Tufts students easily access their professors' Rate My Professors statistics directly on SIS. It provides quick access to professor ratings, tags, and other helpful information directly from the SIS website.

## Features

- **Hover Popup:** View ratings, average difficulty, and top tags by hovering over a professor's name
- **Quick Links:** Access the professor's full Rate My Professors profile with a single click
- **Search Ambiguity:** Handles multiple matches for similar names by offering alternative selections
- **Class Filtering:** Update the stats displayed for each individual class
- **Toggle Extension:** Enable or disable the extension easily from the popup menu

## Installation

To install the extension:

1. Visit the Chrome Web Store listing: [ProfPreview: Rate My Professors for Tufts SIS](https://chromewebstore.google.com/detail/profpreview-rate-my-profe/eplniknciabfmepplkpocomfmgklaebb).
2. Click the **"Add to Chrome"** button.
3. Confirm by clicking **"Add Extension"** in the pop-up prompt.
4. Once installed, the extension icon will appear in your browser toolbar.

## Usage

1. Navigate to Tufts' SIS search results page or your enrollment cart.
2. Hover over a professor's name to view their RMP stats in a popup.
3. Use the extension popup menu to:
   - Enable/disable the extension.
   - Send feedback or report issues.

## File Structure

- `public/`
  - **`manifest.json`**: Chrome extension configuration file.
- `src/`
  - **`background.ts`**: Handles background tasks and RMP API requests.
  - **`content.ts`**: Injected into the SIS page to add hover functionality.
  - **`popupRenderer.ts`**: Generates the HTML for the hover popup.
  - **`App.tsx`**: Handles the extension's popup menu UI.
  - **`main.tsx`** - Boots the popup UI.

## Feedback

Any feedback is greatly appreciated! Use the "Send Feedback" button in the extension's popup menu or visit the [feedback form](https://forms.gle/Z17XMjh2qoVzNW9w8).

If you would like to adapt this extension to your own university, feel free to reach out!

---

**Thank you!**
