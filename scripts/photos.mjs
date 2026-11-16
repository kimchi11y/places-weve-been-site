// Makes the page's photos from the app's example trips (public-domain Wikimedia photos) and README screenshots.
// Usage: npm run photos -- ../places-weve-been
import { mkdir, readdir, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const app = path.resolve(process.argv[2] ?? '../places-weve-been');
const out = path.resolve('public/img');
await rm(out, { recursive: true, force: true });

// Every photo in two widths. sharp drops EXIF/GPS unless asked to keep it.
const trips = path.join(app, 'seed/trips');
for (const trip of await readdir(trips)) {
  const photos = path.join(trips, trip, 'photos');
  for (const stop of await readdir(photos)) {
    for (const file of await readdir(path.join(photos, stop))) {
      if (!/\.jpe?g$/i.test(file)) continue;
      const name = file.replace(/\.\w+$/, '');
      await mkdir(path.join(out, trip), { recursive: true });
      for (const w of [480, 1100]) {
        await sharp(path.join(photos, stop, file)).rotate().resize({ width: w }).webp({ quality: w > 500 ? 76 : 72 })
          .toFile(path.join(out, trip, `${name}-${w}.webp`));
      }
    }
  }
}

const shots = path.join(app, 'docs/screenshots');
await mkdir(path.join(out, 'app'), { recursive: true });
for (const file of await readdir(shots)) {
  await sharp(path.join(shots, file)).webp({ quality: 82 }).toFile(path.join(out, 'app', file.replace(/\.png$/, '.webp')));
}

await copyFile(path.join(app, 'seed/CREDITS.md'), path.resolve('PHOTO-CREDITS.md'));
console.log('photos ready in public/img');
