import React from 'react';

export enum RenderMode {
	Long,
	Short,
}

export const RenderModeContext = React.createContext<RenderMode>(
	RenderMode.Long
);

export interface ArticleProps {
	short?: boolean;
	children?: React.ReactElement<unknown, typeof Article | typeof Blurb>[];
}

export const Article: React.FC<ArticleProps> = ({ short, children }) => {
	return (
		<RenderModeContext.Provider
			value={short ? RenderMode.Short : RenderMode.Long}
		>
			{children}
		</RenderModeContext.Provider>
	);
};

export const Blurb: React.FC<{ children?: React.ReactNode }> = ({
	children,
}) => <>{children}</>;

export const Main: React.FC<{ children?: React.ReactNode }> = ({
	children,
}) => {
	// don't render if in short mode
	if (React.useContext(RenderModeContext) == RenderMode.Short) return null;

	return <>{children}</>;
};
