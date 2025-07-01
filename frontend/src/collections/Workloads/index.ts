// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { getRandomInt } from '@/lib/getRandomInt'
import { CollectionConfig } from 'payload'
import { createWorkloadAfterChange } from './hooks/createWorkloadAfterChange'
import { deleteWorkloadAfterDelete } from './hooks/deleteWorkloadAfterDelete'

export const Workloads: CollectionConfig = {
  slug: 'workloads',
  fields: [
    {
      name: 'task',
      type: 'text',
      required: true,
    },
    {
      name: 'usecase',
      type: 'text',
      required: true,
    },
    {
      name: 'model',
      type: 'text',
      required: true,
    },
    {
      name: 'devices',
      type: 'array',
      fields: [
        {
          name: 'device',
          type: 'text',
        },
      ],
      required: true,
    },
    {
      name: 'source',
      type: 'group',
      fields: [
        {
          name: 'type',
          type: 'text',
          required: false,
        },
        {
          name: 'name',
          type: 'text',
          required: false,
        },
        {
          name: 'size',
          type: 'number',
          required: false,
        },
      ],
    },
    {
      name: 'port',
      type: 'number',
      unique: true,
      hooks: {
        beforeValidate: [
          ({ data }) => {
            if (!data?.port) {
              return getRandomInt(5000, 6000)
            }
          },
        ],
      },
    },
    {
      name: 'metadata',
      type: 'json',
      required: false,
    },
    {
      name: 'status',
      type: 'text',
      required: true,
      defaultValue: 'prepare',
    },
  ],
  hooks: {
    afterChange: [createWorkloadAfterChange],
    afterDelete: [deleteWorkloadAfterDelete],
  },
  access: {
    create: () => true,
    read: () => true,
    update: () => true,
    delete: () => true,
  },
}
