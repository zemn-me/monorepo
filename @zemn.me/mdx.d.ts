

declare module '@mdx-js/react' {
  import * as React from 'react';

  export type ComponentType =
    | 'a'
    | 'blockquote'
    | 'code'
    | 'delete'
    | 'em'
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'hr'
    | 'img'
    | 'inlineCode'
    | 'li'
    | 'ol'
    | 'p'
    | 'pre'
    | 'strong'
    | 'sup'
    | 'table'
    | 'td'
    | 'thematicBreak'
    | 'tr'
    | 'ul'

  export type Components = {
    [key in ComponentType]?: React.ComponentType<{children?: React.ReactNode,
        className?: string }>;
  }

  export interface MDXCreateElementProps {
    children?: React.ReactElement[]
    mdxType?: string
    originalType?: string | Function
    [key: any]: any
  }
  export interface MDXProviderProps {
    children?: React.ReactNode
    components?: Components
  }

  export class MDXProvider extends React.Component<MDXProviderProps> {}
}

declare module "*.mdx" {
    interface TOCNode {
      readonly id?: string
      readonly level: number
      readonly title: string
      readonly children: readonly TOCNode[]
    }

    const cmp: React.ComponentType;
    function tableofContents(): TOCNode[];
    export default cmp;
}