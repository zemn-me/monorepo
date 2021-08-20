export function quote(s: string | undefined) {
    if (s == undefined) return 'undefined';
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\'').replace(/\n/g, "\\n")}"`
}

export function quoteIfNotIdentifier(s: string | undefined) {
    if (s == undefined) return 'undefined';
    if (s.indexOf(" ") !== -1) return quote(s);
    return s;
}

