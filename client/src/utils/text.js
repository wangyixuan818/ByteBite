// base fold: trim + lowercase + collapse spaces 
// safe for live/substring search
export function foldText(s = '') {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

// whole word key: also strips a trailing "s" so "prawn" and "prawns" match
// this for clash checks, NOT for search
export function normaliseName(s = '') {
    return foldText(s).replace(/s$/, '');
}

// filter a list by a name query and rank matches by distance of match from start of name
// getName lets it work on any shape (items, recipes, ...)
export function searchByName(list = [], query, getName = (entry) => entry.name) {
    const q = foldText(query);
    if (!q) return list;
    return list
        .map((entry) => ({ entry, pos: foldText(getName(entry)).indexOf(q) }))
        .filter((row) => row.pos !== -1)
        .sort((a, b) => a.pos - b.pos)
        .map((row) => row.entry);
}