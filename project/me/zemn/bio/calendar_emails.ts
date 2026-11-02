#!/usr/bin/env node

import { Bio } from '#root/project/me/zemn/bio/bio.js';

process.stdout.write(`${JSON.stringify(Bio.email, null, '\t')}\n`);
