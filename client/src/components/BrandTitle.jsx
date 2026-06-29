import { Link } from 'react-router-dom';
import logoMark from '../assets/bytebite-logo-mark.png';

export default function BrandTitle({ as = 'strong', className = '', to, onClick }) {
    const content = (
        <>
            <img className="brand-logo-mark" src={logoMark} alt="" aria-hidden="true" />
            <span>ByteBite</span>
        </>
    );

    if (to) {
        return <Link className={`brand-title ${className}`.trim()} to={to}>{content}</Link>;
    }

    if (as === 'button') {
        return <button className={`brand-title ${className}`.trim()} type="button" onClick={onClick}>{content}</button>;
    }

    const Tag = as;
    return <Tag className={`brand-title ${className}`.trim()}>{content}</Tag>;
}
