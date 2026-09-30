# Changelog

## 4.1.0 — 2026-09-30

- Added Wallpaper, Appearance, and Desktop & Dock sections in Settings.
- Added six wallpaper choices with previews and device-local persistence.
- Added iPadOS three-dot, macOS title-bar, and legacy transparency focus styles. Tiled windows stay opaque in every style.
- Inactive app content requires one focus click before use and is excluded from keyboard navigation.
- Added Show Desktop and restore through the Apple icon, OS name, and Win / Command + D.
- Added default Dock visibility and separate maximized-app visibility. Hidden Dock can be revealed from the bottom edge or keyboard.
- Added visual administration using the actual desktop preview and a right-hand inspector. Edit text, colors, font size and weight, alignment, radius, and padding.
- Added draft undo, discard, JSON backup, and optimistic publishing conflicts. Shared text edits apply across display modes; desktop design overrides apply to Desktop.
- Connected Google OAuth, shared JSON documents, and administrator authorization to Supabase with RLS.
- Fixed drag cancellation, title-bar double-click, offset corner snapping, and snapped bounds after viewport resizing.
- Fixed main-data loading to use shared content and Terminal input focus and safe plain-text output.

Browser shortcuts reserved by the operating system may be intercepted before a web page receives them; the menu buttons always remain available.
