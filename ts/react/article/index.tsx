import React from 'react';

export enum RenderMode {
	Long,
	Short,
}

export const RenderModeContext = React.createContext<RenderMode>(
	RenderMode.Long
);

export interface Article {
	short?: boolean;
	children?: React.ReactNode;
}

export const Article: React.FC<{
	readonly short?: boolean;
	readonly children?: React.ReactNode;
}> = ({ short, children }) => (
	<RenderModeContext.Provider
		value={short ? RenderMode.Short : RenderMode.Long}
	>
		{children}
	</RenderModeContext.Provider>
);

export const Title: React.FC<{
	readonly children?: React.ReactNode;
}> = ({ children }) => <>{children}</>;

/**
 * When Article is rendered in 'short' mode, it is rendered
 * only with Blurb and title.
 */
export const Blurb: React.FC = () => null;
