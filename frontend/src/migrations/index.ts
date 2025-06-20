// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0 

import * as migration_20250410_081008 from './20250410_081008'

export const migrations = [
  {
    up: migration_20250410_081008.up,
    down: migration_20250410_081008.down,
    name: '20250410_081008'
  },
]
