import React from 'react';

export interface Record {
    /**
     * Title of this section
     * @example "My Cool Article"
     */
    readonly title?: React.ReactElement

    /**
     * Anchor for this section
     * @example "#my_cool_article"
     */
    readonly id?: string

    /**
     * Children of this section
     */
    readonly children?: readonly Record[]

    /**
     * Whether the section is visible within the scope of the viewport
     */
    readonly visible?: boolean
}

export interface RegistrationContextType {
    register(): [
        onChange: (record: Record) => void,
        unregister: () => void
    ]
}

const noop = () => {}

export const RegistrationContext = React.createContext<RegistrationContextType>({
    register() { return [ noop, noop ] }
});

interface SectionManagerProps {
    readonly title: React.ReactElement
    readonly id: string
    readonly children: React.ReactElement<{
        readonly ref: (e: HTMLElement) => void
    }>
}

export type SectionsContextType = readonly Record[]

export const SectionsContext = React.createContext<SectionsContextType>([]);

export const SectionsProvider:
    React.FC
=
    ({ children: reactChildren }) => {
        const [ children, setChildren ] = React.useState<Map<{}, Record>>(() => new Map());
        const sectCtx = React.useMemo(() => [...children.values()], [children])

        console.log("SectionsProvider detected change");

        const register = React.useCallback<RegistrationContextType["register"]>(() => {
                const key = {};

                return [ 
                    r => {
                        if (children.get(key) == r) return;
                        children.set(key, r);
                        setChildren(() => new Map(children));
                    },
                    () => {
                        if (!children.has(key)) return;
                        children.delete(key);
                        setChildren(() => new Map(children));
                    }
                ]
            }, [ setChildren ] );


        const regCtx = React.useMemo(() => ({ register }), [ register ]);

        return <SectionsContext.Provider value={[...children.values()]}>
                <RegistrationContext.Provider value={regCtx}>
                    {reactChildren}
                </RegistrationContext.Provider>
        </SectionsContext.Provider>
    }
;

export const SectionManager:
    React.FC<SectionManagerProps>
=
    ({ title, id, children: childElement }) => {
        const { register } = React.useContext(RegistrationContext) ?? {};
        const [ visible, setVisible ] = React.useState<boolean>(false);
        const [ onChange, setOnChange ] = React.useState<(record: Record) => void>();
        const [ children, setChildren ] = React.useState<Map<{}, Record>>(() => new Map());

        React.useEffect(() => {
            const [ onChange, unregister ] = register();

            setOnChange(() => onChange);
            return unregister
        }, [ register ]);

        React.useEffect(() => {
            if (onChange) onChange({ title, id, visible, children: [...children.values()] });
        }, [ title, id, visible, children, onChange ]);

        const onVisibilityChanged = React.useCallback(([ { isIntersecting: visible } ]) => setVisible(() => visible), [ setVisible ]);


        const [ element, setElement ] = React.useState<Element>();

        React.useEffect(() => {
            if (!element) return;
            const observer = new IntersectionObserver(onVisibilityChanged);
            observer.observe(element);
            return () => observer.disconnect();
        }, [ element ]);

        const ourRegister = React.useCallback<RegistrationContextType["register"]>(() => {
            const key = {};

            return [ 
                r => {
                    if (children.get(key) == r) return;
                    children.set(key, r);
                    setChildren(() => new Map(children));
                },
                () => {
                    if (!children.has(key)) return;
                    children.delete(key);
                    setChildren(() => new Map(children));
                }
            ]
        }, [ setChildren ] );

        const ctxValue = React.useMemo(() => ({ register: ourRegister }), [ ourRegister ]);

        return <RegistrationContext.Provider value={ctxValue}>{React.cloneElement(childElement, {
            ...childElement.props,
            ref: setElement
        }, childElement.props.children)}</RegistrationContext.Provider>

    }
;