# Frontmatter

A buffer's markdown can start with frontmatter: a block of YAML metadata between `---`
fences. The frontmatter panel above the markdown editor lists that block as one row per
key and value pair, so metadata is edited as fields instead of raw text. Frontmatter stays
part of the buffer's markdown and is saved and synced with the writing around it; exports
leave it out.

## Reading and writing

Frontmatter is only frontmatter when the buffer's markdown starts with a `---` fence on
its first line and a closing `---` fence follows. Markdown without that pair is body text,
and the frontmatter panel shows no rows. A leading horizontal rule in a buffer is
therefore safe: a buffer that opens with `---` and closes the block is treated as
frontmatter, which matches Obsidian and Jekyll.

Opening a buffer strips frontmatter before the markdown editor builds its document, so the
fences and the YAML never appear as writing. The frontmatter panel takes over. Every later
edit re-joins the frontmatter to the body: a change to the body and a change to the
frontmatter both report markdown with the block at the top.

## Editing frontmatter

The panel adds, renames, and removes rows. Each row shows an editor for its value type:

| Value type | Editor                                                 |
| ---------- | ------------------------------------------------------ |
| Text       | A single-line field, or a taller field for line breaks |
| Number     | A number field                                         |
| Checkbox   | A checkbox                                             |
| List       | Chips with one field to add items                      |

List items are added with Enter or a comma and removed from their chip. The type menu on
each row converts between the four types; a conversion that would lose the value, such as
turning text that is not a number into a number, keeps the value as it is.

The add button is on every buffer and writes nothing on its own. A row reaches the file
only once it has a name, and removing the last row removes the whole block from the
buffer's markdown. Two rows cannot share a name, because a repeated key would make the
markdown ambiguous. Frontmatter the panel cannot represent, such as a nested mapping or a
comment, is shown as written and re-saved exactly as it was.

Values are re-serialized when a buffer is saved, so equivalent YAML may come back in
another shape. A list written as an indented block of `-` items is written as a flow list
in brackets, and single-quoted text may come back double-quoted. Both forms read back as
the same value, and unchanged buffers are left untouched.

## Validation and acceptance

Run `bun run format`, `bun run lint`, `bun run check-types`, and `bun run build` to
validate changes. Interactive checks have not been run.

Acceptance requires a buffer with frontmatter to open with the block in the frontmatter
panel and none of it visible as writing. Editing a row, editing the body, adding a row,
and removing one must each persist to the saved file with the block at the top. Removing
the last row must leave the markdown without the block. Nested mappings and comments must
survive a save. Exports must not include frontmatter. A buffer without frontmatter must
keep its current behavior, and a horizontal rule at the top of a buffer must not be
swallowed.
