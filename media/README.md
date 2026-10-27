# media/

Images for the app (character portraits, places, maps of a place, event illustrations), matched to records **by filename**. No AI session or data edit is needed: the next build picks them up.

```
media/characters/mara.jpg           main image for character "mara"
media/characters/mara--2.png        extra image (--2, --3, …)
media/places/gull-point-lighthouse.webp
media/events/the-storm.jpg
media/groups/…  media/lore/…
```

- The filename must be the record's `id`. IDs are shown at the bottom of each page in the app, and are the file names in `data/<type>/`.
- Supported formats are `.jpg`, `.jpeg`, `.png`, `.webp` and `.gif`.
- To add images from a phone, go to the repository on GitHub, open the folder (create it by typing `media/characters/` in front of the filename when uploading), choose **Add file**, then **Upload files**, and commit.
- Optional captions go in the record's `images` field, for example `[{ "file": "mara--2.png", "caption": "…" }]`.
- Keep files reasonably small (under about 1 MB each) so the repository stays light.
- The app only updates after a build (`node tools/build.mjs`, or the next reparse). You can ask Claude to "rebuild the app" after adding images.
