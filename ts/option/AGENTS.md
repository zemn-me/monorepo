# Option notes

Church-encoded `Option` values are functions. When storing one in React state,
wrap both initial values and setter values in `() => option`; otherwise React
invokes it as a lazy initializer or updater.
