export type Version = readonly [ major: number, minor: number, patch: number, preRelease?: string, build?: string ];

export function major(v: Version) { return v[0] }
export function minor(v: Version) { return v[1] }
export function patch(v: Version) { return v[2] }
export function preRelease(v: Version) { return v[3]}
export function build(v: Version) { return v[4] }

export function toString(...v: Version): string {
    return [major(v), minor(v), patch(v)].join(".") +
        (preRelease(v)? `-${preRelease(v)}`: "") +
        (build(v)? `+${build(v)}`: "");
}

export function add(a: Version, b: Version) {
    let [ major, minor, patch ] = a;
    major += major(a);

    // if major changes, then the minor version must be reset to 0
    if (major != major(a)) minor = 0;

    minor += minor(b);

    // if minor changes, then the patch version must be reset to 0
    if (minor != minor(a)) patch = 0;

    patch += patch(b);

    return [ major, minor, patch ]
}