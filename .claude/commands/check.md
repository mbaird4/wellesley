Review all LOCAL uncommitted changes against the CLAUDE.md rules and fix every violation.

IMPORTANT: This is a LOCAL-ONLY review. Do NOT use `gh`, do NOT check GitHub PRs, do NOT make any network requests. Only use `git diff` and `git status` to inspect the local working tree.

## Steps

1. Run `git diff HEAD` and `git diff --name-only HEAD` to see local uncommitted changes. Do NOT use `gh` or any GitHub CLI commands.
2. SCOPE: Only review and fix files that appear in `git diff --name-only HEAD`. Do NOT touch files that have no uncommitted changes, even if they have pre-existing violations. Pre-existing issues in unchanged files are out of scope.
3. Read each changed file in full (not just the diff — violations may exist in surrounding code you touched).
4. Check every rule from the "Hard Rules" section and the "Pre-Completion Checklist" in CLAUDE.md. For each changed file, identify:
   - Functions called in templates (must be `computed()` or pipes)
   - Formatting logic in components (must be shared pipes)
   - `[style]` bindings (must use `[class]` with Tailwind)
   - `block`/`inline`/`inline-block` layouts (must be `flex` or `grid`)
   - Child margins for sibling spacing (must use `gap-*` on parent)
   - Components over ~150 lines (must extract sub-components)
   - Duplicated HTML blocks (must extract to component or `<ng-template>`)
   - Duplicated TypeScript logic (must extract to shared utility)
   - Wrapper `<div>`s used solely for styling (must use `host` classes)
   - Manual responsive padding like `p-4 md:p-8` (must use `p-section`/`p-card`/`p-cell`)
   - `for`/`for...of`/`while` loops (must use array methods)
   - Missing curly braces on single-line `if`/`else`/`for`
   - Missing blank lines before `return` statements or around block structures
   - Responsive branching using `lt*` instead of `gt*` signals
5. Fix every violation found in changed files. Do NOT just report them — actually refactor the code. Do NOT fix violations in files you didn't find in step 1.
6. After all fixes, run `prettier --write` ONLY on the changed files (pass individual file paths). Then run `nx lint --fix` ONLY for the Nx projects that contain changed files (e.g., `nx lint wellesley --fix`, `nx lint shared-ui --fix`). Do NOT run `npm run lint` or any command that lints the entire project. Ignore warnings/errors in files outside the change set.
7. Summarize what you changed and why.
8. Draft a commit message for all changes (both the original work and your refactors). Use conventional commit format (`feat:`, `fix:`, `refactor:`, `chore:`, etc.). Keep the subject line under 70 chars. Add a body with bullet points if multiple things changed. Copy the commit message to the clipboard with `pbcopy`.
