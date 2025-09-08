
# Copilot Instructions for XAF Model Editor VS Code Extension

- Read the DevExpress version from the project file or Directory.Build.props
- Build the path to the Model Editor based on the version (e.g. `c:\Program Files\DevExpress 24.2\Components\Tools\eXpressAppFrameworkNetCore\Model Editor\`)
- If the executable is missing: show a message and a link to https://www.devexpress.com/ClientCenter/DownloadManager/
- Register a context menu/double-click action for Model.xafml
- Automatically build the solution before starting the Model Editor
- Start the Model Editor with the correct arguments (exe/config/diff-path)
- The extension must work on Windows
- All code must be robust, well-documented, maintainable, and user-friendly
- Follow best practices for error handling and user feedback
- Always follow best practices for VS Code extension development
