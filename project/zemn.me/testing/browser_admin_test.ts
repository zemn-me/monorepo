import { ChildProcess, spawn } from 'node:child_process';
import { runfiles } from '@bazel/runfiles';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { Browser, By, ThenableWebDriver } from 'selenium-webdriver';

import { Driver } from '#root/ts/selenium/webdriver.js';

const token = 'eyJhbGciOiJub25lIn0.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJzdWIiOiIxMjM0NSIsImF1ZCI6ImNsaWVudCIsImV4cCI6OTk5OTk5OTk5OSwiaWF0IjowfQ.';

describe('zemn.me admin panel (browser)', () => {
  let apiProc: ChildProcess;
  let apiOrigin: string;
  let webProc: ChildProcess;
  let origin: string;
  let driver: ThenableWebDriver;

  beforeAll(async () => {
    const apiBin = runfiles.resolveWorkspaceRelative(
      'project/zemn.me/api/cmd/localserver/localserver_/localserver',
    );
    apiProc = spawn(apiBin, { stdio: ['ignore', 'pipe', 'inherit'] });
    apiOrigin = await new Promise<string>((resolve, reject) => {
      apiProc.stdout!.on('data', chunk => {
        const m = /PORT=(\d+)/.exec(chunk.toString());
        if (m) {
          resolve(`http://localhost:${m[1]}`);
        }
      });
      apiProc.once('error', reject);
      setTimeout(() => reject(new Error('api server did not start')), 10000);
    });

    const nextBin = runfiles.resolveWorkspaceRelative('project/zemn.me/start');
  webProc = spawn(nextBin, {
    stdio: ['ignore', 'pipe', 'inherit'],
  env: {
    ...process.env,
    PORT: '0',
    NEXT_PUBLIC_ZEMN_ME_API_BASE: apiOrigin,
  },
  });
    origin = await new Promise<string>((resolve, reject) => {
      webProc.stdout!.on('data', chunk => {
        const m = /localhost:(\d+)/.exec(chunk.toString());
        if (m) {
          resolve(`http://localhost:${m[1]}`);
        }
      });
      webProc.once('error', reject);
      setTimeout(() => reject(new Error('next server did not start')), 20000);
    });
  });

  beforeEach(() => {
    driver = Driver().forBrowser(Browser.CHROME).build();
  });

  afterAll(() => {
    apiProc.kill();
    webProc.kill();
  });

  it('adds and removes entry codes', async () => {
    await driver.manage().setTimeouts({ implicit: 5000 });
    await driver.get(`${origin}/admin`);
    await driver.executeScript(
      `localStorage.clear(); localStorage.setItem('1', JSON.stringify({ 'https://accounts.google.com': { id_token: '${token}' } }));`,
    );
    await driver.navigate().refresh();

    const fieldset = await driver.findElement(By.xpath("//legend[text()='Entry Codes']/.."));
    const addBtn = await fieldset.findElement(By.xpath(".//button[text()='+']"));

    let inputs = await fieldset.findElements(By.css('fieldset input'));
    expect(inputs.length).toBe(0);
    await addBtn.click();
    await driver.wait(async () => {
      inputs = await fieldset.findElements(By.css('fieldset input'));
      return inputs.length === 1;
    }, 5000);

    const removeBtn = await fieldset.findElement(By.xpath(".//button[text()='-']"));
    await removeBtn.click();
    await driver.wait(async () => {
      inputs = await fieldset.findElements(By.css('fieldset input'));
      return inputs.length === 0;
    }, 5000);
  });
});
