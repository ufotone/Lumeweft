# Bundled JP tag data notice

Lumeweft bundles only the four CSV files required for Japanese/English tag lookup:

- `danbooru.csv`
- `danbooru-jp.csv`
- `danbooru-machine-jp.csv`
- `jp_tag_dictionary.csv`

The Lumeweft maintainer confirmed on 2026-09-14 that the author of `dr1610/a1111-sd-webui-jp-tag-assistant` granted explicit permission via social media to bundle the dictionary files. The maintainer should retain the original permission record outside this repository.

The 30 MB related-tag co-occurrence archive is intentionally not included because it is not required for basic lookup.

Additional provenance reported by the source project:

- `danbooru.csv`: `DraconicDragon/dbr-e621-lists-archive`, Unlicense, snapshot 2026-04-01.
- `danbooru-jp.csv` and `danbooru-machine-jp.csv`: `boorutan/booru-japanese-tag` at `cec5f7eefbe5c3addd8fb9338d11435518ae8ccf`, MIT.
- `jp_tag_dictionary.csv`: bundled under the direct permission described above.

The source project's Python and JavaScript implementation is not included or adapted.
