// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import * as migration_20250410_20250100 from './20250410_20250100'
import * as migration_20250630_055612 from './20250630_055612'

export const migrations = [
  {
    up: migration_20250410_20250100.up,
    down: migration_20250410_20250100.down,
    name: '20250410_20250100',
  },
  {
    up: migration_20250630_055612.up,
    down: migration_20250630_055612.down,
    name: '20250630_055612',
  },
]
