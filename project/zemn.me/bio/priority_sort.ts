#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * @fileoverview
 * Interactive sorter for `project/zemn.me/bio/priority.json`.
 * Adds a progress bar to show how many items remain to be ranked.
 */

import fs from 'node:fs/promises';
import * as path from 'node:path';
import readline from 'node:readline/promises';

import { Bio } from '#root/project/zemn.me/bio/bio.js';
import * as lang from '#root/ts/react/lang/index.js';

const root = process.env.BUILD_WORKSPACE_DIRECTORY;
if (!root) throw new Error(
  'BUILD_WORKSPACE_DIRECTORY environment variable is not set. ' +
  'Please run this script from Bazel.',
);

const prioPath = path.join(root, 'project/zemn.me/bio/priority.json');

interface TimelineEvent {
  id: string;
  title: string;
  desc?: string;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function loadBio(): Promise<TimelineEvent[]> {
  return Bio.timeline.map(ev => ({
    id: ev.id,
    title: lang.text(ev.title),
    desc:
      'description' in ev && ev.description
        ? lang.text(ev.description)
        : undefined,
  }));
}

async function loadPriorities(): Promise<string[]> {
  try {
    return JSON.parse(await fs.readFile(prioPath, 'utf8'));
  } catch {
    return [];
  }
}

function savePriorities(list: string[]): Promise<void> {
  return fs.writeFile(prioPath, JSON.stringify(list, null, 2) + '\n');
}

async function ask(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = (await rl.question(question)).trim().toLowerCase();
  rl.close();
  return answer === 'y' || answer === 'yes';
}

/**
 * Displays a simple text progress bar, width 30 characters.
 */
function showProgress(done: number, total: number): void {
  const width = 30;
  const filled = Math.round((done / total) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  console.log(`\nProgress: [${bar}] ${done}/${total} ranked`);
}

/**
 * Recursively finds the correct insertion index for `item` within `prio`.
 */
async function locateIndex(
  prio: string[],
  item: TimelineEvent,
  events: Map<string, TimelineEvent>,
  left = 0,
  right = prio.length,
): Promise<number> {
  if (left === right) return left;

  const mid = (left + right) >> 1;
  const pivot = events.get(prio[mid]!)!;

  const higher = await ask(
    `\n⚖️  Compare importance\n` +
      `──────────────────────\n` +
      `New   : ${item.title}\n        ${item.desc ?? ''}\n\n` +
      `Pivot : ${pivot.title}\n        ${pivot.desc ?? ''}\n\n` +
      `Is the new item MORE important than the pivot? (y/n) `,
  );

  return higher
    ? locateIndex(prio, item, events, left, mid)
    : locateIndex(prio, item, events, mid + 1, right);
}

/* -------------------------------------------------------------------------- */
/*  Main                                                                       */
/* -------------------------------------------------------------------------- */

(async () => {
  const eventsArr = await loadBio();
  const events = new Map(eventsArr.map(e => [e.id, e]));
  const allIds = new Set(eventsArr.map(e => e.id));

  let prio = await loadPriorities();

  // Fast-exit if already complete
  if (prio.length === allIds.size && prio.every(id => allIds.has(id))) {
    console.log('✅ priority.json already up-to-date.');
    return;
  }

  for (;;) {
    prio = await loadPriorities();
    const done = new Set(prio);
    const todo = [...allIds].filter(id => !done.has(id));

    // Nothing left to do
    if (todo.length === 0) {
      console.log('🎉 All timeline entries ranked. Goodbye.');
      return;
    }

    // Show progress before handling next item
    showProgress(done.size, allIds.size);

    const newId = todo[0]!;
    const newItem = events.get(newId)!;

    if (prio.length === 0) {
      await savePriorities([newId]);
      continue;
    }

    const idx = await locateIndex(prio, newItem, events);
    prio.splice(idx, 0, newId);
    await savePriorities(prio);
  }
})().catch(err => {
  console.error('💥', err);
  process.exit(1);
});
