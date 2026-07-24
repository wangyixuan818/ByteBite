import { useState } from 'react';
import { useAuthentication } from '../context/AuthenticationContext';
import { addItem, getFoodTypes, getItemList, consumeItem, disposeItem, deleteItem } from '../api/item';
import { normaliseName, searchByName } from '../utils/text';


// date parsing
const MONTHS = { jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12 };
const pad = n => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// browser speech recognition (Chrome/Edge/Safari; not Firefox)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// build a date, rolling to next year if it's already past (used when no year was given)
function futureDated(year, month, day) {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let d = new Date(year, month - 1, day);
    if (d < todayMidnight) d = new Date(year + 1, month - 1, day);
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function parseDate(str) {
    // drop ordinal suffixes: "17th" -> "17", "3rd" -> "3" (speech often adds them)
    const s = str.trim().toLowerCase().replace(/(\d{1,2})(?:st|nd|rd|th)\b/g, '$1');


// relative dates
    const base = new Date();
    const addDays = (n) => { const d = new Date(base); d.setDate(d.getDate() + n); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
    if (s === 'today') return addDays(0);
    if (s === 'tomorrow' || s === 'tmr' || s === 'tmrw') return addDays(1);
    let rel = s.match(/^in\s+(\d+)\s+days?$/);
    if (rel) return addDays(+rel[1]);
    rel = s.match(/^in\s+(a|an|one)\s+(day|week)$/);
    if (rel) return addDays(rel[2] === 'week' ? 7 : 1);
    rel = s.match(/^in\s+(\d+)\s+weeks?$/);
    if (rel) return addDays(+rel[1] * 7);
    rel = s.match(/^next\s+week$/);
    if (rel) return addDays(7);


    const year = new Date().getFullYear();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return iso(+m[1], +m[2], +m[3]);          // 2026-06-17
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/))) {                                  // 17/6 or 17/6/2026
        if (m[3]) { let y = +m[3]; if (y < 100) y += 2000; return iso(y, +m[2], +m[1]); }
        return futureDated(year, +m[2], +m[1]);
    }
    // 17 june  /  17 june 2027
    if ((m = s.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/)) && MONTHS[m[2]]) {
        return iso(m[3] ? +m[3] : year, MONTHS[m[2]], +m[1]);
    }
    // june 17  /  june 17 2027
    if ((m = s.match(/^([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/)) && MONTHS[m[1]]) {
        return iso(m[3] ? +m[3] : year, MONTHS[m[1]], +m[2]);
    }
    return null;
}

// command parsing
const titleCase = s => s.replace(/\b\w/g, c => c.toUpperCase());

const NUMBER_WORDS = {
    zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10,
    eleven:11, twelve:12, dozen:12, a:1, an:1,

    // homophones / common speech mis-hears -> the digit they sounded like
    to:2, too:2,
    tree:3, free:3, time:3,          // "three"
    for:4, fore:4,                   // "four"
    ate:8,                           // "eight"
    won:1,                           // "one"
    tin:10, ten:10,                  // "ten"
    sex:6,                           // "six" (it happens)
    nain:9, night:9,                 // "nine"
};

// turn a leading spoken number word into a digit, so things like "add to bread" becomes "add 2 bread"
function normaliseQuantityWord(s) {
    return s.replace(/^(\w+)\s+/, (whole, word) => {
        const n = NUMBER_WORDS[word.toLowerCase()];
        return n !== undefined ? `${n} ` : whole;
    });
}

// common mishears for the trigger word "add"
const ADD_WORDS = new Set(['add', 'at', 'ad', 'and', 'had', 'a', 'ada', 'adds', 'att']);

// if the command starts with an "add" like word, treat it as "add" and strip it
function stripAddWord(s) {
    const first = s.match(/^(\w+)\s+/);
    if (first && ADD_WORDS.has(first[1].toLowerCase())) {
        return s.slice(first[0].length);
    }
    return s;   // no add-like opener leave it (still parseable)
}

// clean a transcript for display: normalise the "add" like verb TO "add" 
// and turn the following number word into a digit
function cleanForDisplay(raw) {
    const s = raw.trim().toLowerCase();
    const { action, rest } = detectAction(s);
    const body = action === 'add' ? stripAddWord(rest) : rest;
    const first = s.match(/^(\w+)\s+/);
    return `${ACTION_LABEL[action]} ${normaliseQuantityWord(body)}`.trim();
}

function matchFoodType(name, foodTypes) {
    const key = normaliseName(name);
    const exact = foodTypes.find(ft => normaliseName(ft.name) === key);
    if (exact) return exact;
    return searchByName(foodTypes, name)[0] ?? null;
}

function parseCommand(input, foodTypes) {
    let s = input.trim().toLowerCase();
    if (!s) return null;

    const { action, rest } = detectAction(s);
    s = action === 'add' ? stripAddWord(rest) : rest;   // "add" may still carry the word while verbs already stripped
    s = normaliseQuantityWord(s);

    // expiry only makes sense for add
    let expiryDate;
    if (action === 'add') {
        const exp = s.match(/\s+(?:expire|expires|expiry|exp|expired|expiration|by|on|expiring)\s+(.+)$/);
        if (exp) {
            expiryDate = parseDate(exp[1]) ?? undefined;
            s = s.slice(0, exp.index).trim();
        } else {
            const tail = s.match(/\s+(\d{1,2}\s+[a-z]+(?:\s+\d{4})?|[a-z]+\s+\d{1,2}(?:\s+\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{1,2}-\d{1,2})$/);
            if (tail) { const maybe = parseDate(tail[1]); if (maybe) { expiryDate = maybe; s = s.slice(0, tail.index).trim(); } }
        }
    }

    // quantity: a number or "a"/"an"
    // null = unspecified which means "the whole thing" for consume or dispose
    let quantity = null, m;
    if ((m = s.match(/^(\d+)\s+(.+)$/))) { quantity = parseInt(m[1], 10); s = m[2].trim(); }
    else if ((m = s.match(/^(a|an)\s+(.+)$/))) { quantity = 1; s = m[2].trim(); }

    const rawName = s.trim();
    if (!rawName) return null;

    const match = matchFoodType(rawName, foodTypes);
    return {
        action,
        quantity,
        rawName,
        displayName: match ? match.name : titleCase(rawName),
        foodTypeId: match?.id,
        expiryDate,
    };
}

const VERBS = [
    { action: 'consume', words: ['consume','consumed','eat','ate','eaten','finish','finished','use','used','drink','drank','had'] },
    { action: 'dispose', words: ['dispose','disposed','throw','threw','thrown','throwaway','bin','binned','chuck','chucked','toss','tossed','waste','wasted','discard','discarded'] },
    { action: 'delete',  words: ['delete','deleted','remove','removed','cancel','undo'] },
];

const ACTION_LABEL = { add: 'add', consume: 'consume', dispose: 'throw away', delete: 'delete' };

// detect a leading verb; strip it (and a trailing "away"/"out"); default to "add"
function detectAction(s) {
    for (const v of VERBS) {
        for (const w of v.words) {
            const re = new RegExp(`^${w}(?:\\s+(?:away|out|the))?\\s+`, 'i');
            if (re.test(s)) return { action: v.action, rest: s.replace(re, '') };
        }
    }
    return { action: 'add', rest: s };   // no verb means add (keeps existing behaviour)
}

// find which inventory item a consume/dispose/delete refers to: exact name, else fuzzy
// closest to expiry prioritised
function findTargetItem(name, items) {
    const key = normaliseName(name);
    const exact = items.filter(it => normaliseName(it.name) === key);
    const pool = exact.length ? exact : searchByName(items, name);
    if (!pool.length) return null;
    return [...pool].sort((a, b) => {
        const ax = a.expiry_date ?? '9999-12-31';   // no-expiry items sort last
        const bx = b.expiry_date ?? '9999-12-31';
        return ax < bx ? -1 : ax > bx ? 1 : 0;
    })[0];
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
    const [listening, setListening] = useState(false);
    const [items, setItems] = useState([]);

    if (!user) return null;   // only for signed-in users

    const openPanel = async () => {
        setOpen(true);
        try {
            if (foodTypes.length === 0) { const r = await getFoodTypes(); setFoodTypes(r.data); }
            const it = await getItemList();      // fresh inventory each open, so lookups are current
            setItems(it.data);
        } catch { /* matching falls back gracefully */ }
    };

        const handleParse = (e) => {
        e.preventDefault();
        setMessage(''); setIsError(false);
        const result = parseCommand(text, foodTypes);
        if (!result) {
            setParsed(null); setIsError(true);
            setMessage('Try "add 12 eggs"; "consume 2 milk"; or "throw away eggs".');
            return;
        }
        if (result.action === 'add') { setParsed(result); return; }

        // consume / dispose / delete: find the item to act on
        const target = findTargetItem(result.rawName, items);
        if (!target) {
            setParsed(null); setIsError(true);
            setMessage(`You don't have any ${result.displayName} in your inventory.`);
            return;
        }
        const have = Number(target.quantity ?? 1);
        let amount = result.quantity == null ? have : result.quantity;
        const capped = amount > have;               // asked for more than exists
        if (capped) amount = have;                  // cap at the max possible
        setParsed({
            ...result,
            itemId: target.id,
            itemName: target.name,
            have,
            amount,
            whole: result.quantity == null || amount >= have,
            capped,
        });
    };

    const handleConfirm = async () => {
        setAdding(true); setMessage(''); setIsError(false);
        const p = parsed;
        try {
            if (p.action === 'add') {
                const payload = { name: p.displayName, quantity: p.quantity ?? 1 };
                if (p.foodTypeId) payload.food_type_id = p.foodTypeId;
                if (p.expiryDate) payload.expiry_date = p.expiryDate;
                await addItem(payload);
                setMessage(`Added ${p.quantity ?? 1} × ${p.displayName}.`);
            } else if (p.action === 'consume') {
                await consumeItem(p.itemId, p.whole ? null : p.amount);
                setMessage(`Consumed ${p.whole ? 'all' : `${p.amount} ×`} ${p.itemName}.`);
            } else if (p.action === 'dispose') {
                await disposeItem(p.itemId, p.whole ? null : p.amount);
                setMessage(`Threw away ${p.whole ? 'all' : `${p.amount} ×`} ${p.itemName}.`);
            } else if (p.action === 'delete') {
                await deleteItem(p.itemId);
                setMessage(`Removed ${p.itemName} from inventory.`);
            }
            setParsed(null); setText('');
            window.dispatchEvent(new CustomEvent('bytebite:item-added'));
            try { const it = await getItemList(); setItems(it.data); } catch { /* ignore */ }
        } catch (err) {
            setIsError(true);
            setMessage(err.response?.data?.error?.message || 'Could not complete that.');
        } finally {
            setAdding(false);
        }
    };

    const startVoice = () => {
        if (!SpeechRecognition) {
            setIsError(true);
            setMessage('Voice input is not supported in this browser. Try Chrome.');
            return;
        }
        if (listening) return;   // ignore clicks while already listening

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-SG';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        setMessage(''); setIsError(false);

        recognition.onresult = (event) => {
            const raw = event.results[0][0].transcript;
            const shown = cleanForDisplay(raw);
            setText(shown);                              // box shows "add 3 bread"
            const result = parseCommand(shown, foodTypes);
            if (result) { setParsed(result); setMessage(''); setIsError(false); }
            else { setIsError(true); setMessage('Did not catch a valid command — try again.'); }
        };

        recognition.onerror = (event) => {
            setIsError(true);
            const reasons = {
                'not-allowed': 'Microphone is blocked. Allow it in the browser (see the address bar), then retry.',
                'service-not-allowed': 'Microphone is blocked. Allow it in the browser, then retry.',
                'no-speech': 'Did not catch any speech — try again.',
                'audio-capture': 'No microphone found on this device.',
                'network': 'Speech service could not be reached (check your connection).',
            };
            setMessage(reasons[event.error] || `Voice error: ${event.error}`);
            setListening(false);          // reset here too, onend may not fire on error
        };
        recognition.onend = () => setListening(false);

        try {
            recognition.start();
            setListening(true);
        } catch {
            setListening(false);          // start() can throw if a previous session hasnt released
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
                    <p className="qa-hint">Try “add 12 eggs”, “consume 2 milk”, “throw away bread”, or “delete rice”.</p>

                    <form onSubmit={handleParse} className="qa-form">
                        <input
                            className="qa-input"
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder="add 12 eggs; consume 2 milk..."
                            autoFocus
                        />
                        <button type="submit" className="qa-go">Go</button>

                        <button
                            type="button"
                            className={`qa-mic${listening ? ' listening' : ''}`}
                            onClick={startVoice}
                            aria-label="Speak a command"
                            title="Speak"
                        >
                            🎤
                        </button>
                    </form>

                    {parsed && (
                        <div className="qa-confirm">
                            {parsed.action === 'add' && (
                                <p>
                                    ➕ Add <strong>{parsed.quantity ?? 1} × {parsed.displayName}</strong>
                                    {parsed.expiryDate
                                        ? <>, expiring <strong>{parsed.expiryDate}</strong>?</>
                                        : <> <span className="qa-muted">(expiry auto-estimated)</span>?</>}
                                </p>
                            )}
                            {parsed.action === 'consume' && (
                                <p>🥄 Consume <strong>{parsed.whole ? `all ${parsed.have}` : parsed.amount} × {parsed.itemName}</strong>?
                                    {parsed.capped && <span className="qa-muted"> (only {parsed.have} in stock)</span>}</p>
                            )}
                            {parsed.action === 'dispose' && (
                                <p>🗑️ Throw away <strong>{parsed.whole ? `all ${parsed.have}` : parsed.amount} × {parsed.itemName}</strong>?
                                    {parsed.capped && <span className="qa-muted"> (only {parsed.have} in stock)</span>}</p>
                            )}
                            {parsed.action === 'delete' && (
                                <p>✕ Remove <strong>{parsed.itemName}</strong> from inventory?</p>
                            )}
                            <div className="qa-confirm-actions">
                                <button className="qa-cancel" onClick={() => setParsed(null)}>Cancel</button>
                                <button className="qa-add" onClick={handleConfirm} disabled={adding}>
                                    {adding ? 'Working...' : 'Confirm'}
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