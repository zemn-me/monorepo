'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import style from '#root/project/me/zemn/components/FootnotePreviews/style.module.css';

interface Preview {
	readonly anchor: HTMLAnchorElement;
	readonly text: string;
}

function referenceFor(anchor: HTMLAnchorElement): HTMLElement | null {
	let hashID = '';
	try {
		hashID = anchor.hash ? decodeURIComponent(anchor.hash.slice(1)) : '';
	} catch {
		// A malformed fragment is still a valid link, but not a footnote target.
	}
	const id = anchor.dataset.footnoteTarget ?? hashID;
	return id ? anchor.ownerDocument.getElementById(id) : null;
}

function referenceText(reference: HTMLElement): string {
	const copy = reference.cloneNode(true) as HTMLElement;
	for (const backReference of copy.querySelectorAll(
		'[data-footnote-backref]'
	)) {
		backReference.remove();
	}
	return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function footnoteAnchor(
	target: EventTarget | null,
	root: HTMLElement
): HTMLAnchorElement | null {
	if (!(target instanceof Element)) return null;
	const anchor = target.closest('a[data-footnote-ref]');
	return anchor instanceof HTMLAnchorElement && root.contains(anchor)
		? anchor
		: null;
}

/** Adds Wikipedia-style previews to standard footnote references in a scope. */
export function FootnotePreviews({
	root,
}: {
	readonly root: HTMLElement | null;
}) {
	const tooltipID = useId();
	const tooltipRef = useRef<HTMLDivElement>(null);
	const activeAnchorRef = useRef<HTMLAnchorElement | null>(null);
	const originalDescriptionRef = useRef<string | null>(null);
	const lastPointerTypeRef = useRef('');
	const touchPreviewWasOpenRef = useRef(false);
	const [preview, setPreview] = useState<Preview | null>(null);

	useEffect(() => {
		if (!root) return;

		const hide = () => {
			const anchor = activeAnchorRef.current;
			if (anchor) {
				const original = originalDescriptionRef.current;
				if (original === null)
					anchor.removeAttribute('aria-describedby');
				else anchor.setAttribute('aria-describedby', original);
			}
			activeAnchorRef.current = null;
			originalDescriptionRef.current = null;
			setPreview(null);
		};
		const show = (anchor: HTMLAnchorElement) => {
			const reference = referenceFor(anchor);
			if (!reference) return;
			const text = referenceText(reference);
			if (!text) return;
			if (activeAnchorRef.current !== anchor) {
				hide();
				activeAnchorRef.current = anchor;
				originalDescriptionRef.current =
					anchor.getAttribute('aria-describedby');
				anchor.setAttribute(
					'aria-describedby',
					[originalDescriptionRef.current, tooltipID]
						.filter(Boolean)
						.join(' ')
				);
			}
			setPreview({ anchor, text });
		};
		const onPointerOver = (event: PointerEvent) => {
			if (event.pointerType !== 'touch') {
				const anchor = footnoteAnchor(event.target, root);
				if (anchor) show(anchor);
			}
		};
		const onPointerOut = (event: PointerEvent) => {
			const anchor = footnoteAnchor(event.target, root);
			if (
				anchor &&
				(!(event.relatedTarget instanceof Node) ||
					!anchor.contains(event.relatedTarget))
			) {
				hide();
			}
		};
		const onFocusIn = (event: FocusEvent) => {
			const anchor = footnoteAnchor(event.target, root);
			if (anchor) show(anchor);
		};
		const onFocusOut = (event: FocusEvent) => {
			const anchor = footnoteAnchor(event.target, root);
			if (anchor) hide();
		};
		const onPointerDown = (event: PointerEvent) => {
			lastPointerTypeRef.current = event.pointerType;
			const anchor = footnoteAnchor(event.target, root);
			touchPreviewWasOpenRef.current =
				event.pointerType === 'touch' &&
				activeAnchorRef.current === anchor;
		};
		const onClick = (event: MouseEvent) => {
			const anchor = footnoteAnchor(event.target, root);
			if (!anchor) return;
			const pointerType = lastPointerTypeRef.current;
			const touch =
				pointerType === 'touch' ||
				(event.detail > 0 &&
					root.ownerDocument.defaultView?.matchMedia?.(
						'(hover: none)'
					).matches);
			const previewWasOpen =
				pointerType === 'touch'
					? touchPreviewWasOpenRef.current
					: activeAnchorRef.current === anchor;
			lastPointerTypeRef.current = '';
			touchPreviewWasOpenRef.current = false;
			if (touch && !previewWasOpen) {
				event.preventDefault();
				show(anchor);
			}
		};
		const onDocumentPointerDown = (event: PointerEvent) => {
			const anchor = activeAnchorRef.current;
			if (
				anchor &&
				event.target instanceof Node &&
				!anchor.contains(event.target) &&
				!tooltipRef.current?.contains(event.target)
			) {
				hide();
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') hide();
		};

		root.addEventListener('pointerover', onPointerOver);
		root.addEventListener('pointerout', onPointerOut);
		root.addEventListener('pointerdown', onPointerDown, true);
		root.addEventListener('click', onClick, true);
		root.addEventListener('focusin', onFocusIn);
		root.addEventListener('focusout', onFocusOut);
		root.ownerDocument.addEventListener(
			'pointerdown',
			onDocumentPointerDown
		);
		root.ownerDocument.addEventListener('keydown', onKeyDown);
		return () => {
			hide();
			root.removeEventListener('pointerover', onPointerOver);
			root.removeEventListener('pointerout', onPointerOut);
			root.removeEventListener('pointerdown', onPointerDown, true);
			root.removeEventListener('click', onClick, true);
			root.removeEventListener('focusin', onFocusIn);
			root.removeEventListener('focusout', onFocusOut);
			root.ownerDocument.removeEventListener(
				'pointerdown',
				onDocumentPointerDown
			);
			root.ownerDocument.removeEventListener('keydown', onKeyDown);
		};
	}, [root, tooltipID]);

	useLayoutEffect(() => {
		const tooltip = tooltipRef.current;
		if (!preview || !tooltip) return;
		const view = preview.anchor.ownerDocument.defaultView;
		if (!view) return;
		const anchor = preview.anchor.getBoundingClientRect();
		const bounds = tooltip.getBoundingClientRect();
		const margin = 12;
		const left = Math.min(
			view.innerWidth - bounds.width - margin,
			Math.max(margin, anchor.left + anchor.width / 2 - bounds.width / 2)
		);
		const below = anchor.bottom + 8;
		const top =
			below + bounds.height <= view.innerHeight - margin
				? below
				: Math.max(margin, anchor.top - bounds.height - 8);
		tooltip.style.left = `${left}px`;
		tooltip.style.top = `${top}px`;
	}, [preview]);

	return preview ? (
		<div
			className={style.tooltip}
			id={tooltipID}
			ref={tooltipRef}
			role="tooltip"
		>
			{preview.text}
		</div>
	) : null;
}
