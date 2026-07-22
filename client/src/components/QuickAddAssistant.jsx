import { useState } from 'react';
import { useAuthentication } from '../context/AuthenticationContext';
import { addItem, getFoodTypes } from '../api/item';
import { normaliseName, searchByName } from '../utils/text';

// date parsing
const MONTHS = { jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12 };
const pad = n => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// build a date, rolling to next year if it's already past (used when no year was given)
function futureDated(year, month, day) {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let d = new Date(year, month - 1, day);
    if (d < todayMidnight) d = new Date(year + 1, month - 1, day);
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function parseDate(str) {
    const s = str.trim().toLowerCase();
    const year = new Date().getFullYear();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return iso(+m[1], +m[2], +m[3]);          // 2026-06-17
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/))) {                                  // 17/6 or 17/6/2026
        if (m[3]) { let y = +m[3]; if (y < 100) y += 2000; return iso(y, +m[2], +m[1]); }
        return futureDated(year, +m[2], +m[1]);
    }
    // 17 june  /  17 june 2027
    if ((m = s.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/)) && MONTHS[m[2]]) {
        return m[3] ? iso(+m[3], MONTHS[m[2]], +m[1]) : futureDated(year, MONTHS[m[2]], +m[1]);
    }
    // june 17  /  june 17 2027
    if ((m = s.match(/^([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/)) && MONTHS[m[1]]) {
        return m[3] ? iso(+m[3], MONTHS[m[1]], +m[2]) : futureDated(year, MONTHS[m[1]], +m[2]);
    }
    return null;
}

// command parsing
const titleCase = s => s.replace(/\b\w/g, c => c.toUpperCase());

function matchFoodType(name, foodTypes) {
    const key = normaliseName(name);
    const exact = foodTypes.find(ft => normaliseName(ft.name) === key);
    if (exact) return exact;
    return searchByName(foodTypes, name)[0] ?? null;
}

function parseCommand(input, foodTypes) {
    let s = input.trim().toLowerCase();
    if (!s) return null;
    s = s.replace(/^add\s+/, '');   // optional leading "add"

    // pull off an "expire <date>" tail, if the keyword is present
    let expiryDate;
    const exp = s.match(/\s+(?:expire|expires|expiry|exp)\s+(.+)$/);
    if (exp) {
        expiryDate = parseDate(exp[1]) ?? undefined;
        s = s.slice(0, exp.index).trim();
    }

    // no "expire" keyword? try to peel a date off the end anyway
    if (!exp) {
        const tail = s.match(/\s+(\d{1,2}\s+[a-z]+(?:\s+\d{4})?|[a-z]+\s+\d{1,2}(?:\s+\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{1,2}-\d{1,2})$/);
        if (tail) {
            const maybe = parseDate(tail[1]);
            if (maybe) { expiryDate = maybe; s = s.slice(0, tail.index).trim(); }
        }
    }

    // leading quantity (a number, or "a"/"an" = 1)
    let quantity = 1, m;
    if ((m = s.match(/^(\d+)\s+(.+)$/))) { quantity = parseInt(m[1], 10); s = m[2].trim(); }
    else if ((m = s.match(/^(a|an)\s+(.+)$/))) { s = m[2].trim(); }

    const rawName = s.trim();
    if (!rawName) return null;

    const match = matchFoodType(rawName, foodTypes);
    return {
        quantity,
        displayName: match ? match.name : titleCase(rawName),
        foodTypeId: match?.id,
        expiryDate,
    };
}

export default function QuickAddAssistant() {
    const { user } = useAuthentication();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [foodTypes, setFoodTypes] = useState([]);
    const [parsed, setParsed] = useState(null);
    const [adding, setAdding] = useState(false);
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);

    if (!user) return null;   // only for signed-in users

    const openPanel = async () => {
        setOpen(true);
        if (foodTypes.length === 0) {
            try {
                const res = await getFoodTypes();
                setFoodTypes(res.data);
            } catch { /* matching just falls back to the raw name */ }
        }
    };

    const handleParse = (e) => {
        e.preventDefault();
        setMessage(''); setIsError(false);
        const result = parseCommand(text, foodTypes);
        if (!result) {
            setParsed(null); setIsError(true);
            setMessage('Try "add 12 eggs" or "add 2 milk expire 17 june".');
            return;
        }
        setParsed(result);
    };

    const handleConfirm = async () => {
        setAdding(true); setMessage(''); setIsError(false);
        try {
            const payload = { name: parsed.displayName, quantity: parsed.quantity };
            if (parsed.foodTypeId) payload.food_type_id = parsed.foodTypeId;
            if (parsed.expiryDate) payload.expiry_date = parsed.expiryDate;
            await addItem(payload);
            setMessage(`Added ${parsed.quantity} × ${parsed.displayName}.`);
            setParsed(null); setText('');
            window.dispatchEvent(new CustomEvent('bytebite:item-added'));
        } catch (err) {
            setIsError(true);
            setMessage(err.response?.data?.error?.message || 'Could not add that item.');
        } finally {
            setAdding(false);
        }
    };

    return (
        <>
            {open && (
                <div className="qa-panel" role="dialog" aria-label="Quick add">
                    <div className="qa-header">
                        <strong>Quick add</strong>
                        <button className="qa-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
                    </div>
                    <p className="qa-hint">Type a command like “add 12 eggs” or “add 2 milk expire 17 june”.</p>

                    <form onSubmit={handleParse} className="qa-form">
                        <input
                            className="qa-input"
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder="add 12 eggs..."
                            autoFocus
                        />
                        <button type="submit" className="qa-go">Go</button>
                    </form>

                    {parsed && (
                        <div className="qa-confirm">
                            <p>
                                Add <strong>{parsed.quantity} × {parsed.displayName}</strong>
                                {parsed.expiryDate
                                    ? <>, expiring <strong>{parsed.expiryDate}</strong>?</>
                                    : <> <span className="qa-muted">(expiry auto-estimated)</span>?</>}
                            </p>
                            <div className="qa-confirm-actions">
                                <button className="qa-cancel" onClick={() => setParsed(null)}>Cancel</button>
                                <button className="qa-add" onClick={handleConfirm} disabled={adding}>
                                    {adding ? 'Adding...' : 'Add it'}
                                </button>
                            </div>
                        </div>
                    )}

                    {message && <p className={`qa-message${isError ? ' error' : ''}`}>{message}</p>}
                </div>
            )}

            <button className="qa-bubble" onClick={() => (open ? setOpen(false) : openPanel())} aria-label="Quick add assistant">
                {open ? '×' : '+'}
            </button>
        </>
    );
}