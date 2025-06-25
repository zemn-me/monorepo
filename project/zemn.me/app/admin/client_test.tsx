import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.useFakeTimers();

const defaultValues = {
  authorizers: [],
  fallbackPhone: '',
  entryCodes: [],
  partyMode: false as boolean | undefined,
};

jest.mock('#root/project/zemn.me/hook/useZemnMeApi.js', () => {
  const React = require('react');
  const defaultValuesMock = {
    authorizers: [],
    fallbackPhone: '',
    entryCodes: [],
    partyMode: false as boolean | undefined,
  };
  const mutateSpy = jest.fn();
  return {
    __esModule: true,
    mutateSpy,
    useZemnMeApi: () => {
      const [success, setSuccess] = React.useState(false);
      return {
        useQuery: () => ({ status: 'success', data: defaultValuesMock }),
        useMutation: () => ({
          mutate: (args: unknown) => {
            setSuccess(true);
            return mutateSpy(args);
          },
          get isSuccess() {
            return success;
          },
        }),
      };
    },
  };
});


// Use require so the mocked module is loaded after jest.mock executes in ESM
// environments. This avoids hoisting issues with static imports.
const { mutateSpy } = require('#root/project/zemn.me/hook/useZemnMeApi.js');


jest.mock('#root/project/zemn.me/components/Link/index.js', () => ({
  __esModule: true,
  default: () => null,
}));


import { SettingsEditor } from './client.js';

function renderEditor() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsEditor Authorization="tok" />
    </QueryClientProvider>
  );
}

describe('SettingsEditor autosave', () => {
  beforeEach(() => {
    mutateSpy.mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  test('saves changes automatically', async () => {
    renderEditor();
    const input = screen.getByLabelText(/Fallback phone number/);
    fireEvent.change(input, { target: { value: '+123' } });
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    await Promise.resolve();
    await waitFor(() => {
      expect(mutateSpy).toHaveBeenCalledWith({
        headers: { Authorization: 'tok' },
        body: { ...defaultValues, fallbackPhone: '+123' },
      });
    });
  });

  test('undo reverts to last saved values', async () => {
    renderEditor();
    const input = screen.getByLabelText(/Fallback phone number/);
    fireEvent.change(input, { target: { value: '+456' } });
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    await Promise.resolve();
    mutateSpy.mockClear();
    fireEvent.change(input, { target: { value: '+789' } });
    const undo = screen.getByText('Undo');
    await act(async () => {
      fireEvent.click(undo);
    });
    expect((input as HTMLInputElement).value).toBe('+456');
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    await waitFor(() => {
      expect(mutateSpy).not.toHaveBeenCalled();
    });
  });
});
