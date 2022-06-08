#!/usr/bin/env node

import Database from 'better-sqlite3';
import { lookup } from 'mime-types';
import { nanoid } from 'nanoid';
import { exiftool, ExifDateTime } from 'exiftool-vendored';
import sharp from 'sharp';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const db = new Database(process.argv[3]);

const setupStmt = db.prepare(
    `CREATE TABLE 'photos' (
        'id' TEXT NOT NULL,
        'date' TEXT,

        'type' TEXT NOT NULL,
        'path' TEXT NOT NULL,
        'thumbnailType' TEXT NOT NULL,
        'thumbnailPath' TEXT NOT NULL
    );`,
);
setupStmt.run();

const processDir = async (path) => {
    const entries = await readdir(path, { withFileTypes: true });

    for (const entry of entries) {
        const entryPath = join(path, entry.name);

        if (entry.isDirectory()) {
            await processDir(entryPath);
        }
        if (entry.isFile()) {
            await processFile(entryPath);
        }
    }
};

const insertStmt = db.prepare(
    `INSERT INTO 'photos' (
        'id',
        'date',

        'type',
        'path',
        'thumbnailType',
        'thumbnailPath'
    ) VALUES (
        ?,
        ?,

        ?,
        ?,
        ?,
        ?
    )`,
);

const processFile = async (path) => {
    const type = lookup(path) || 'application/octet-stream';

    if (type.startsWith('image/')) {
        const id = nanoid();

        const exif = await exiftool.read(path);
        const date =
            exif.DateTimeOriginal instanceof ExifDateTime
                ? exif.DateTimeOriginal.toISOString()
                : null;

        const thumbPath = join(process.argv[4], id + '.jpeg');
        await sharp(await readFile(path))
            .rotate()
            .resize({ width: 256, height: 256, fit: 'cover' })
            .jpeg({ quality: 80, mozjpeg: true })
            .toFile(thumbPath);

        insertStmt.run(
            id,
            date,

            type,
            path,
            'image/jpeg',
            thumbPath,
        );
    }
};

await processDir(process.argv[2]);
exiftool.end();
