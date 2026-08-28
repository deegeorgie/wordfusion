---
Task ID: 5-a
Agent: fullstack-developer
Task: Add Packs tab, category icons, and pack selector to admin panel and puzzle editor

Work Log:
- Updated AdminPanel.tsx types:
  - Added PackItem interface (id, name, description, icon, language, _count)
  - Extended PuzzleSummary with categoryIcon, packId, packName, packIcon fields
  - Extended AdminData with packs array
  - Added icon field to CategoryItem interface
- Updated CategoryManager in AdminPanel.tsx:
  - Added icon input field (emoji) to create form
  - Icon now shown in category list table before name
  - Icon editable in inline edit mode (icon input + name input side by side)
  - Icon sent in POST/PUT fetch bodies
- Created PackManager sub-component in AdminPanel.tsx:
  - Create form: icon input, name input, description input, language select
  - Pack list table: Name (with icon), Langue, Puzzles count, Actions (edit/delete)
  - Inline editing for packs (same pattern as CategoryManager)
  - Delete confirmation dialog for packs
  - All CRUD via /api/packs endpoint
- Updated AdminPanel main component:
  - Changed TabsList from grid-cols-3 to grid-cols-4
  - Added 4th Collections tab with Package icon from lucide-react
  - Updated dialog description to mention collections
  - Added packFilter state alongside categoryFilter
  - Updated filteredPuzzles useMemo to include pack filtering
  - Added Pack filter dropdown in puzzle filters section
  - Added Collection column header to puzzles table
  - Added pack badge (icon + name) in each puzzle row
  - Updated category badge to show icon
  - Updated category filter dropdown to show icon
- Updated PuzzleEditor.tsx:
  - Added icon?: string to CategoryOption interface
  - Added PackOption interface (id, name, icon, language)
  - Added nonePack constant
  - Added packId state and packs state
  - Added /api/packs fetch alongside /api/categories on dialog open
  - Added Collection (Pack) selector dropdown in puzzle settings grid (6 cols)
  - Pack selector shows pack icon + language flag + name, includes Sans collection option
  - packId included in save body (both create and edit)
  - packId loaded from existing puzzle data when editing
  - packId reset on new puzzle creation
  - Category items now show icon in dropdown
- Verified lint passes clean
- Verified dev server compiles without errors

Stage Summary:
- Admin panel now has 4 tabs: Categories, Collections, Puzzles, Programme
- Category management supports emoji icons (create, edit, display)
- Pack management fully implemented with CRUD operations
- Puzzles table shows both category badge (with icon) and pack badge (with icon)
- Puzzle filters include pack filter dropdown
- Puzzle editor includes Collection (Pack) selector alongside Language, Category, Difficulty
- All labels in French, existing UI patterns preserved
