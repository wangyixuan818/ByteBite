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