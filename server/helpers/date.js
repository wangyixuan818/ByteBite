function formatDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // mths is zero indexed
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function todayDate() {
    return formatDate(new Date());
}

function addDays(date, days) {
    const base = new Date(date);
    base.setDate(base.getDate() + days);
    return formatDate(base);
}   

module.exports = { formatDate, todayDate, addDays };