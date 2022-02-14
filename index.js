#!/usr/bin/env node

import { readdir } from 'fs/promises';
import { join } from 'path';

import Database from 'better-sqlite3';
import { lookup } from 'mime-types';
import { exiftool, ExifDateTime } from 'exiftool-vendored';

const db = new Database(process.argv[2]);

const initStatement = db.prepare(
    `CREATE TABLE 'photos' (
        'id' INTEGER NOT NULL,

        'date' TEXT,
        'deviceMake' TEXT,
        'deviceModel' TEXT,

        'fileType' TEXT NOT NULL,
        'filePath' TEXT NOT NULL,

        PRIMARY KEY ('id' AUTOINCREMENT)
    );`,
);
initStatement.run();

const insertStatement = db.prepare(
    `INSERT INTO 'photos' (
        'date',
        'deviceMake',
        'deviceModel',

        'fileType',
        'filePath'
    ) VALUES (
        ?,
        ?,
        ?,

        ?,
        ?
    )`,
);

const processDir = async (path) => {
    const entries = await readdir(path, {
        withFileTypes: true,
    });

    await Promise.all(
        entries.map(async (entry) => {
            const entryPath = join(path, entry.name);

            if (entry.isDirectory()) {
                await processDir(entryPath);
            }

            if (entry.isFile()) {
                await processFile(entryPath);
            }
        }),
    );
};

const processFile = async (path) => {
    const type = lookup(path) || 'application/octet-stream';

    if (type.startsWith('image/')) {
        const exif = await exiftool.read(path);

        insertStatement.run(
            exif.DateTimeOriginal instanceof ExifDateTime
                ? exif.DateTimeOriginal.toISOString()
                : null,
            exif.Make,
            exif.Model,

            type,
            path,
        );
    }
};

await processDir(process.argv[3]);

exiftool.end();
