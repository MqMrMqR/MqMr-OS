# Changelog

## Desktop menus and themes — 2026-10-01

- Extended auto-hide Dock activation 18px above its resting top edge while preserving horizontal and bottom bounds.
- Added persistent Align to Grid with collision resolution, Clean Up, Sort by Name, Select All and Appearance actions in a desktop context menu.
- Added icon context-menu opening, Shift+F10, arrow/Home/End navigation and Escape dismissal.
- Added Light, Dark and Automatic appearance in Settings; shared semantic colors across Desktop, Simple, Phone and Admin with system-theme and cross-tab updates.
- Added regression checks for grid collisions, stable alignment, theme persistence and preference isolation.

## Desktop icons and motion — 2026-10-01

- Added desktop app icons with double-click/Enter opening, rubber-band selection, Shift/Ctrl/Command multi-selection, bounded group dragging, and device-local position persistence.
- Added arrow-key navigation, Alt+arrow positioning, Ctrl/Command+A selection, and Escape cancellation.
- Show Desktop now uses the original minimize animation and restores positions with a matching return animation; removed its Settings row and View-menu entry.
- macOS window controls fade in and out with reduced-motion support.
- Auto-hidden Dock reveals at its actual resting height and width, rather than at the bottom screen edge.
- Replaced the Original wallpaper with a clean generated wave illustration, delivered as a compact WebP.
- Fixed an app reopening during minimize/close being hidden by an old timer.

## Desktop refinements — 2026-09-30

- Maximized apps fill the screen below the menu bar, independently of Dock visibility. Dock hide options remain available.
- Grouped Display, Wallpaper, Window focus, Menu bar, and Desktop & Dock inside Appearance.
- Fixed overflowing navigation widths and unified compact setting rows, Apple-style select controls, and switches.
- Added wallpaper crossfades with reduced-motion support.
- macOS focus hides inactive window controls while preserving the title-bar layout.
- Visible window controls close or minimize inactive tiled apps on the first press. Content still requires a focus click before interaction.
- Closing or minimizing the active app transfers focus to the next visible app; restored closing/minimizing animations.

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
