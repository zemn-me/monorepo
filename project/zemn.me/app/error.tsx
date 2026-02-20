'use client';

import { useEffect } from 'react';

import style from '#root/project/zemn.me/app/error.module.css';

export default function ErrorPage({ error }: { readonly error: Error & { digest?: string }; readonly reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={style.Error}>
      <i lang="en-GB">Something went wrong.</i>
      <details>
        <summary>Stack trace</summary>
        <pre>{error.stack}</pre>
      </details>
    </main>
  );
}
