import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

export interface CodeProps {
    children: string
    language?: string
}

export const CodeBlock: React.FC<CodeProps> =
    ({ children, language }) => <SyntaxHighlighter

     language={language?.toLowerCase()}>
        {children}
    </SyntaxHighlighter>