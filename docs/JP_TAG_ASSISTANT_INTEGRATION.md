# JP Tag Assistant integration

Lumeweft includes a native CANVAS template named **日本語タグ検索 / JP Tag Search**. It searches a minimal set of dictionaries from [a1111-sd-webui-jp-tag-assistant](https://github.com/dr1610/a1111-sd-webui-jp-tag-assistant) without requiring ComfyUI or the upstream custom-node implementation.

## Permission and implementation boundary

The Lumeweft maintainer confirmed on 2026-09-14 that the upstream author granted explicit permission via social media to bundle the dictionary files. The original permission record should be retained outside the repository with project/release records.

This permission is treated as applying to dictionary files only. Lumeweft does not copy or adapt the upstream Python or JavaScript implementation, whose repository did not contain an explicit overall code license at audited commit `8136d50cc6b24e2835aa3a150608a82fdab67a85`.

The lookup and ranking logic in `src/services/jpTagAssistant.mjs` is a Lumeweft implementation.

## Bundled data

Only the files needed for Japanese/English lookup are stored under `public/data/jp-tag-assistant/`:

- `danbooru.csv`: English tag, category, count, and alias data.
- `danbooru-jp.csv`: manually maintained Japanese labels.
- `danbooru-machine-jp.csv`: machine-generated Japanese labels, optionally searched.
- `jp_tag_dictionary.csv`: compact Japanese phrase and alias overrides.

The approximately 30.5 MB `danbooru_tags_cooccurrence.csv.gz` archive is not included. Therefore the native Lumeweft edition does not currently provide the upstream related-tag recommendation modes.

See `public/data/jp-tag-assistant/NOTICE.md` for provenance and permission notes.

## CANVAS behavior

- Search terms may be Japanese or English and may be separated by spaces or Japanese/ASCII commas.
- Results are ranked by exact, prefix, and substring matches, then by Danbooru post count.
- Copyright and character categories can be excluded.
- Machine-generated Japanese labels can be enabled or disabled.
- Output is a comma-separated English tag fragment that can be connected to prompt, viewer, or text-output nodes.

The dictionaries load lazily on the first search and remain cached for the renderer session.
