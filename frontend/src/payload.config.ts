// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { Users } from './collections/Users'
import { Workloads } from './collections/Workloads'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Workloads],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // database-adapter-config-start
  db: sqliteAdapter({
    // SQLite-specific arguments go here.
    // `client.url` is required.
    client: {
      url: process.env.DATABASE_URL ?? 'db.sqlite',
    },
    prodMigrations: migrations,
  }),
  // database-adapter-config-end
  sharp,
})
