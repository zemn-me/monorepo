'use client';

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from 'react';
import { createPortal } from 'react-dom';
import style from '#root/project/me/zemn/components/CopyrightNotices/style.module.css';

interface Notice {
	readonly key: string;
	readonly content: ReactNode;
}

type Register = (notice: Notice) => () => void;
const CopyrightContext = createContext<Register | null>(null);

export function CopyrightNotices({
	children,
}: {
	readonly children: ReactNode;
}) {
	const [registrations, setRegistrations] = useState<
		ReadonlyMap<symbol, Notice>
	>(() => new Map());
	const register = useCallback<Register>(notice => {
		const instance = Symbol();
		setRegistrations(current => new Map(current).set(instance, notice));
		return () =>
			setRegistrations(current => {
				const next = new Map(current);
				next.delete(instance);
				return next;
			});
	}, []);
	const notices = new Map(
		Array.from(registrations.values(), notice => [
			notice.key,
			notice.content,
		])
	);

	return (
		<CopyrightContext.Provider value={register}>
			{children}
			{notices.size > 0 &&
				createPortal(
					<aside
						aria-label="Copyright notices"
						className={style.notices}
					>
						<ul>
							{Array.from(notices, ([key, content]) => (
								<li key={key}>{content}</li>
							))}
						</ul>
					</aside>,
					document.body
				)}
		</CopyrightContext.Provider>
	);
}

export function useVisibleCopyright(element: Element | null, notice: Notice) {
	const register = useContext(CopyrightContext);
	const [visibleElement, setVisibleElement] = useState<Element | null>(null);
	useEffect(() => {
		if (!element) return;
		const observer = new IntersectionObserver(entries => {
			const entry = entries.at(-1);
			setVisibleElement(entry?.isIntersecting ? element : null);
		});
		observer.observe(element);
		return () => {
			observer.disconnect();
			setVisibleElement(null);
		};
	}, [element]);
	const visible = element !== null && visibleElement === element;
	const { key, content } = notice;
	useEffect(() => {
		if (visible) return register?.({ key, content });
	}, [visible, register, key, content]);
	return visible;
}
