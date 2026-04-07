import { Link, useLocation } from "react-router-dom";
import "./Navbar.css";

export default function Navbar() {
    const { pathname } = useLocation();

    return (
        <nav className="navbar">
            <Link to="/" className="nav-brand">
                <div className="nav-logo-icon">📰</div>
                <span className="nav-brand-name">TruthLens</span>
            </Link>

            <div className="nav-links">
                <Link to="/" className={`nav-link ${pathname === "/" ? "active" : ""}`}>
                    <span className="nav-dot" />
                    News
                </Link>
                <Link to="/detect" className={`nav-link ${pathname === "/detect" ? "active" : ""}`}>
                    <span className="nav-dot" />
                    Detector
                </Link>
                <Link to="/insights" className={`nav-link ${pathname === "/insights" ? "active" : ""}`}>
                    <span className="nav-dot" />
                    Insights
                </Link>
            </div>

            <div className="nav-right">
                <span className="nav-badge">Live</span>
                <div className="nav-avatar">TL</div>
            </div>
        </nav>
    );
}