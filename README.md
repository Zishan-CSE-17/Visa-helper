# Japan Visa Form Helper

A free website that writes your answers into the **official ISA Excel form**. No server, no login: everything runs in your browser, so passport and residence card details never leave your device. Works offline after the first visit and can be installed on a phone.

## Put it online (GitHub Pages)

1. On GitHub create a **Public** repository (e.g. `visa-helper`).
2. Unzip this package, then drag **all the files** into the repo page (Add file > Upload files) and commit.
3. Settings > Pages > Source: **Deploy from a branch**, branch **main**, folder **/ (root)**.
4. After about a minute the site is at `https://YOUR-NAME.github.io/visa-helper/`. Send that link to friends.

When you upload a new version, replace the files with the same names. Old copies on phones update the next time the site is opened with internet.

## How to use

1. Download the official Excel form from the ISA links on the page.
2. Fill in your details (English letters as in your passport). Bengali help is shown under each box.
3. Choose the Excel file. The site finds the boxes by their printed labels and shows where each answer will go. Fix any cell that looks wrong.
4. Press **Test** once to see placeholders in the right boxes, then **Download filled Excel**.
5. Add the photo, signature and any circles by hand in Excel.

Cell map examples: `C5` one cell, `Sheet2!C5` another sheet, `C5,E5,G5` date in year/month/day boxes, `Male=E5;Female=G5` marks the chosen option with a circle.

## Share one cell map with all friends

When the boxes are all correct, press **Save cell map (.json)**, rename the file to `mapping.json` (it must contain both `"change"` and `"extension"` keys, or just the mode you use) and upload it to the repo. Everyone then gets the correct boxes automatically.

## What is in the folder

| File | Purpose |
| --- | --- |
| `index.html`, `style.css` | page and look (light/dark mode) |
| `schema.js` | fields, validation, Bengali help |
| `xlsx-fill.js` | edits the Excel file directly inside the zip, so drawings, validation and formatting stay untouched |
| `xlsx-write.js` | simple data-list Excel export |
| `app.js` | the app |
| `checklist.js` | document checklist (which papers to prepare) |
| `jszip.min.js` | zip library (MIT), included so nothing loads from the internet |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | offline mode and phone install |
| `mapping.json` | optional shared cell map |

## Notes

- Excel files must be `.xlsx`. For an old `.xls`, open it in Excel and Save As `.xlsx`.
- Cells that already contain text, or formulas, are skipped unless you tick "Allow overwriting".
- Unofficial tool. Check every value against the current ISA instructions before submitting.
