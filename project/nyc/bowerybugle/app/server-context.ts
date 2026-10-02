import { createContext } from 'react-router';
export const apiContext = createContext<
	| {
			apiOrigin: string;
			apiFetchOrigin?: string;
	  }
	| undefined
>(undefined);
