<<<<<<< HEAD
# vscode.extensions.xaf.modeleditor
XAF Model Editor VS Code extension. Integrates DevExpress XAF Model Editor with VS Code, including context menu, solution build, and dynamic version detection.
=======
# XAF Model Editor VS Code Extension

This extension integrates DevExpress XAF Model Editor with Visual Studio Code.

## Features
- Högerklick/dubbelklick på `Model.xafml` öppnar Model Editor för rätt DevExpress-version
- Bygger solutionen automatiskt innan Model Editor startas
- Läser DevExpress-version från projektfil eller Directory.Build.props
- Kontrollerar att rätt Model Editor-exe finns, annars får du länk till nedladdning

## Installation
1. Klona/förbered extensionen i din VS Code-miljö
2. Bygg och installera som VSIX eller kör i utvecklingsläge

## Användning
1. Högerklicka eller dubbelklicka på `Model.xafml`
2. Extensionen bygger solutionen
3. Model Editor startas med rätt argument

## Felsökning
- Om Model Editor-exe saknas får du ett meddelande och länk till https://www.devexpress.com/ClientCenter/DownloadManager/
- Kontrollera att DevExpress är installerat på standardplatsen

## Konfiguration
- Om du har DevExpress på annan plats, kan du ange sökvägen i extension settings

## Krav
- DevExpress XAF installerat lokalt
- Windows
- .NET SDK (för build)

---

För frågor, kontakta utvecklaren eller se DevExpress dokumentation.
>>>>>>> 00cd273 (Initial commit: XAF Model Editor VS Code extension)
