import { createContext, Dispatch, ReactNode, SetStateAction } from 'react';

export const gladeMenuTopContentContext = createContext<
	Dispatch<SetStateAction<ReactNode | null>> | null
>(null);
