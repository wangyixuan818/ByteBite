export default function RecipeDifficulty({ level }) {
    const value = Math.max(0, Math.min(5, Number(level) || 0));
    const stars = Array.from({ length: 5 }, (_, index) => index < value);

    return (
        <p className="recipe-difficulty" aria-label={`Difficulty level: ${value} out of 5`}>
            <span>Difficulty level:</span>
            <span className="difficulty-stars" aria-hidden="true">
                {stars.map((filled, index) => (
                    <span key={index} className={filled ? 'filled' : ''}>
                        {filled ? '★' : '☆'}
                    </span>
                ))}
            </span>
        </p>
    );
}
