import React from 'react';

export enum RenderMode {
	Long,
	Short,
}

export const RenderModeContext = React.createContext<RenderMode>(
	RenderMode.Long
);

export interface ArticleProps {
	readonly short?: boolean;
	readonly children?: React.ReactElement<
		unknown,
		typeof Article | typeof Blurb
	>[];
}

export const Article: React.FC<ArticleProps> = ({ short, children }) => (
	<RenderModeContext.Provider
		value={short ? RenderMode.Short : RenderMode.Long}
	>
		{children}
	</RenderModeContext.Provider>
);

export const Blurb: React.FC<{ readonly children?: React.ReactNode }> = ({
	children,
}) => <>{children}</>;

export const Main: React.FC<{ readonly children?: React.ReactNode }> = ({
	children,
}) => {
	// don't render if in short mode
	if (React.useContext(RenderModeContext) == RenderMode.Short) return null;

	return <>{children}</>;
};
