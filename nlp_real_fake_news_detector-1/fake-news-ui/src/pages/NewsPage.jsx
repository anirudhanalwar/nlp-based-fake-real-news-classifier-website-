import { useState } from "react";
import "./NewsPage.css";

const NEWS = [
    {
        title: "Bank of England holds interest rates amid stable inflation data",
        desc: "Officials cited stable inflation data and moderate economic growth as reasons for maintaining current rates following the latest monetary policy meeting.",
        tag: "Business",
        tc: "tag-biz",
        time: "1 hr ago",
        author: "Reuters",
        read: "3 min",
        url: "https://www.bbc.com/news/business",
        featured: "big",
    },
    {
        title: "Rail services disrupted after suspected sabotage on Rome-Naples line",
        desc: "Authorities reported suspected sabotage to high-speed train infrastructure. Services were delayed for several hours affecting thousands of commuters.",
        tag: "World",
        tc: "tag-world",
        time: "2 hr ago",
        author: "AP News",
        read: "4 min",
        url: "https://apnews.com/world-news",
        featured: true,
    },
    {
        title: "U.S. stock markets close higher following strong jobs report",
        desc: "Markets closed slightly higher on Friday following the release of new economic data showing steady job growth. Analysts said investors responded positively.",
        tag: "Business",
        tc: "tag-biz",
        time: "3 hr ago",
        author: "Bloomberg",
        read: "3 min",
        url: "https://www.bloomberg.com/markets",
        featured: true,
    },
    {
        title: "WHO reports sharp rise in respiratory illness cases across Southeast Asia",
        desc: "Health officials are monitoring a spike in pneumonia-like cases in Vietnam and Thailand, urging hospitals to increase surveillance capacity.",
        tag: "Health",
        tc: "tag-health",
        time: "4 hr ago",
        author: "Reuters Health",
        read: "4 min",
        url: "https://www.reuters.com/business/healthcare-pharmaceuticals/",
    },
    {
        title: "Federal Reserve signals possible rate cut in upcoming meeting",
        desc: "Fed chair indicated the central bank is open to easing monetary policy if inflation continues its downward trend over the next quarter.",
        tag: "Business",
        tc: "tag-biz",
        time: "5 hr ago",
        author: "Wall Street Journal",
        read: "4 min",
        url: "https://www.wsj.com/economy",
    },
    {
        title: "UN Security Council passes resolution on Gaza humanitarian corridors",
        desc: "The resolution passed with 13 votes in favour, calling for immediate safe passage of aid trucks and civilian evacuation routes.",
        tag: "World",
        tc: "tag-world",
        time: "6 hr ago",
        author: "Al Jazeera",
        read: "5 min",
        url: "https://www.aljazeera.com/news/",
    },
    {
        title: "India's central bank cuts repo rate to boost economic growth",
        desc: "The Reserve Bank of India reduced its benchmark rate by 25 basis points citing easing inflation and the need to support slowing domestic demand.",
        tag: "Business",
        tc: "tag-biz",
        time: "7 hr ago",
        author: "Economic Times",
        read: "3 min",
        url: "https://economictimes.indiatimes.com/markets",
    },
    {
        title: "Scientists confirm deep-sea coral bleaching off Australia's coast",
        desc: "Marine researchers reported extensive bleaching events at depths previously thought immune to warming, marking a concerning expansion of the crisis.",
        tag: "Environment",
        tc: "tag-env",
        time: "8 hr ago",
        author: "BBC Science",
        read: "4 min",
        url: "https://www.bbc.com/news/science-environment",
    },
    {
        title: "Apple faces antitrust probe in European Union over App Store fees",
        desc: "EU regulators opened a formal investigation into Apple's developer fee structure, which critics say locks out competing app marketplaces.",
        tag: "Technology",
        tc: "tag-tech",
        time: "9 hr ago",
        author: "The Verge",
        read: "4 min",
        url: "https://www.theverge.com/tech",
    },
    {
        title: "NATO allies increase defence spending commitments at Brussels summit",
        desc: "Member nations agreed to raise minimum defence spending targets following renewed concerns about security along NATO's eastern flank.",
        tag: "World",
        tc: "tag-world",
        time: "10 hr ago",
        author: "BBC News",
        read: "4 min",
        url: "https://www.bbc.com/news/world",
    },
    {
        title: "New study links ultra-processed food consumption to early cognitive decline",
        desc: "A longitudinal study of 72,000 adults found that high intake of ultra-processed foods was associated with a 28% faster rate of memory deterioration.",
        tag: "Health",
        tc: "tag-health",
        time: "11 hr ago",
        author: "The Lancet",
        read: "5 min",
        url: "https://www.thelancet.com/",
    },
    {
        title: "China's exports fall for third consecutive month amid trade tensions",
        desc: "Customs data showed a 6.4% year-on-year decline in Chinese exports, reflecting weakening global demand and ongoing tariff disputes with the US.",
        tag: "Business",
        tc: "tag-biz",
        time: "12 hr ago",
        author: "Reuters",
        read: "3 min",
        url: "https://www.reuters.com/markets/",
    },
    {
        title: "SpaceX successfully launches Starship on fifth integrated test flight",
        desc: "The vehicle completed a full ascent and splashdown sequence, marking significant progress toward operational deep-space missions.",
        tag: "Science",
        tc: "tag-sci",
        time: "13 hr ago",
        author: "NASA / SpaceX",
        read: "4 min",
        url: "https://www.space.com/",
    },
    {
        title: "Germany enters recession as industrial output contracts sharply",
        desc: "Europe's largest economy recorded its second consecutive quarter of negative GDP growth, driven by declining factory orders and high energy costs.",
        tag: "Business",
        tc: "tag-biz",
        time: "14 hr ago",
        author: "Financial Times",
        read: "4 min",
        url: "https://www.ft.com/economics",
    },
    {
        title: "Arctic sea ice reaches second-lowest extent ever recorded",
        desc: "Satellite measurements from NSIDC show summer minimum coverage of 4.14 million sq km, the second lowest since records began in 1979.",
        tag: "Environment",
        tc: "tag-env",
        time: "15 hr ago",
        author: "Nature",
        read: "5 min",
        url: "https://www.nature.com/",
    },
    {
        title: "OpenAI releases new model with improved reasoning capabilities",
        desc: "The latest release demonstrates significantly stronger performance on mathematical benchmarks and multi-step logical reasoning tasks.",
        tag: "Technology",
        tc: "tag-tech",
        time: "16 hr ago",
        author: "TechCrunch",
        read: "4 min",
        url: "https://techcrunch.com/",
    },
];

const CATEGORIES = ["All", "Technology", "Environment", "Business", "Health", "Science", "World"];

export default function NewsPage() {
    const [active, setActive] = useState("All");

    const filtered = active === "All" ? NEWS : NEWS.filter((n) => n.tag === active);
    const featured = filtered.filter((n) => n.featured);
    const grid = filtered.filter((n) => !n.featured);

    const handleClick = (url) => {
        window.open(url, "_blank", "noopener,noreferrer");
    };

    return (
        <div className="news-page">
            <div className="np-header">
                <h1 className="np-title">Latest news</h1>
                <span className="np-meta">
                    {filtered.length} {filtered.length === 1 ? "story" : "stories"}
                </span>
            </div>

            <div className="np-filters">
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat}
                        className={`np-pill${active === cat ? " on" : ""}`}
                        onClick={() => setActive(cat)}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {featured.length > 0 && (
                <div className="np-hero">
                    {featured.map((item, i) => (
                        <div
                            key={i}
                            className={`np-feat${item.featured === "big" ? " big" : ""}`}
                            onClick={() => handleClick(item.url)}
                        >
                            <div className="np-feat-top">
                                <span className={`np-tag ${item.tc}`}>{item.tag}</span>
                                <span className="np-time">{item.time}</span>
                            </div>
                            <div>
                                <p className="np-feat-title">{item.title}</p>
                                <p className="np-feat-desc">{item.desc}</p>
                            </div>
                            <div className="np-feat-foot">
                                <span className="np-author">{item.author}</span>
                                <span className="np-read">{item.read} read →</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {grid.length > 0 && (
                <>
                    <div className="np-divider">
                        {featured.length > 0 ? "More stories" : "All stories"}
                    </div>
                    <div className="np-grid">
                        {grid.map((item, i) => (
                            <div
                                key={i}
                                className="np-card"
                                onClick={() => handleClick(item.url)}
                            >
                                <div className="np-card-top">
                                    <span className={`np-tag ${item.tc}`}>{item.tag}</span>
                                    <span className="np-time">{item.time}</span>
                                </div>
                                <p className="np-card-title">{item.title}</p>
                                <p className="np-card-desc">{item.desc}</p>
                                <div className="np-card-foot">
                                    <span className="np-author">{item.author}</span>
                                    <span className="np-read">{item.read} read →</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {filtered.length === 0 && (
                <div className="np-empty">No stories in this category yet.</div>
            )}
        </div>
    );
}