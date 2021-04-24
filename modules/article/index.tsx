import React from 'react';

export enum RenderMode {
    Long,
    Short
}

export const RenderModeContext = React.createContext<RenderMode>(RenderMode.Long);

export interface Article {
    short?: boolean
}

export const Article: React.FC<{
    short?: boolean   
}> = ({short, children}) => {
    return <RenderModeContext.Provider value={
        short?RenderMode.Short: RenderMode.Long
    }>
        {React.Children.map((child: React.ReactElement) => {
            
        }}
    </RenderModeContext.Provider>
}


export const Title: React.FC = ({ children }) => <>{children}</>;

/**
 * When Article is rendered in 'short' mode, it is rendered
 * only with Blurb and title.
 */
export function Blurb() {
    
}