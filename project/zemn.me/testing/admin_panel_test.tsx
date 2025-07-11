import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react';
import Admin from '#root/project/zemn.me/app/admin/client.js';
import { Providers } from '#root/project/zemn.me/app/providers.js';

const token = 'eyJhbGciOiJub25lIn0.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJzdWIiOiIxMjM0NSIsImF1ZCI6ImNsaWVudCIsImV4cCI6OTk5OTk5OTk5OSwiaWF0IjowfQ.';

const defaultSettings = { authorizers: [], fallbackPhone: '', entryCodes: [], partyMode: false };

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('1', JSON.stringify({
    'https://accounts.google.com': { id_token: token },
  }));

  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = init?.method ?? 'GET';
    if (url.endsWith('/callbox/settings') && method === 'GET') {
      return Promise.resolve(new Response(JSON.stringify(defaultSettings), { status: 200 }));
    }
    if (url.endsWith('/callbox/settings') && method === 'POST') {
      return Promise.resolve(new Response(init?.body as BodyInit));
    }
    if (url.endsWith('/phone/number')) {
      return Promise.resolve(new Response(JSON.stringify({ phoneNumber: '+1' }), { status: 200 }));
    }
    if (url.endsWith('/admin/uid')) {
      return Promise.resolve(new Response('12345', { status: 200 }));
    }
    return Promise.reject(new Error(`Unhandled request: ${method} ${url}`));
  }) as jest.Mock;
});

describe('zemn.me admin panel', () => {
  it('adds and removes entry codes', async () => {
    render(<Providers apiBaseUrl="https://api.example.test"><Admin /></Providers>);
    const entryCodesLegend = await screen.findByText('Entry Codes');
    const fieldset = entryCodesLegend.closest('fieldset')!;
    const addBtn = within(fieldset).getByText('+');

    expect(within(fieldset).queryAllByRole('textbox')).toHaveLength(0);
    fireEvent.click(addBtn);
    expect(within(fieldset).getAllByRole('textbox')).toHaveLength(1);

    const removeBtn = within(fieldset).getByText('-');
    fireEvent.click(removeBtn);
    expect(within(fieldset).queryAllByRole('textbox')).toHaveLength(0);
  });
});
