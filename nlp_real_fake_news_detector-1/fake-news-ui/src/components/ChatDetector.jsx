import { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./ChatDetector.css";

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || "";
const FIRECRAWL_API_KEY = process.env.REACT_APP_FIRECRAWL_API_KEY || "";
const GEMINI_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash",
    "gemini-3.8-flash"
];
const BACKEND_URLS = ["http://127.0.0.1:5001", "http://127.0.0.1:5000"];

function formatTime() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function extractUrl(text) {
    if (!text) return null;
    const match = text.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/i);
    if (!match) return null;
    let url = match[0].replace(/[.,;:)]+$/, "");
    if (url.startsWith("www.")) url = "https://" + url;
    return url;
}

function getDomain(urlString) {
    try {
        const u = new URL(urlString);
        return u.hostname.replace(/^www\./, "");
    } catch {
        return "web source";
    }
}

function cleanMarkdownText(rawMarkdown) {
    if (!rawMarkdown) return "";
    let clean = rawMarkdown;
    clean = clean.replace(/!\[.*?\]\(.*?\)/g, ""); // strip images
    clean = clean.replace(/\[(.*?)\]\(.*?\)/g, "$1"); // strip links keeping anchor text
    clean = clean.replace(/<[^>]+>/g, ""); // strip html
    clean = clean.replace(/#{1,6}\s*/g, ""); // strip headers

    const paragraphs = clean
        .split("\n")
        .map((p) => p.trim())
        .filter((p) => p.length > 35 && !/cookie|privacy policy|subscribe|all rights reserved|advertisement|sign in|log in/i.test(p));

    return paragraphs.slice(0, 2).join(" ");
}

async function scrapeWithFirecrawl(targetUrl) {
    // 1. Try direct Firecrawl API
    try {
        const res = await axios.post(
            "https://api.firecrawl.dev/v1/scrape",
            {
                url: targetUrl,
                formats: ["markdown"],
                onlyMainContent: true
            },
            {
                headers: {
                    Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 15000
            }
        );

        if (res?.data?.success && res.data.data) {
            const data = res.data.data;
            const meta = data.metadata || {};
            const title = meta.title || meta.ogTitle || "Extracted News Article";
            const desc = meta.description || meta.ogDescription || "";
            const leadText = cleanMarkdownText(data.markdown || "");

            // Extract small, neat, clean amount of news
            const summary = (desc.trim() || leadText.slice(0, 220) || "No synopsis available").trim();
            const cleanLead = leadText.length > 450 ? leadText.slice(0, 450) + "…" : leadText;

            return {
                url: targetUrl,
                domain: getDomain(targetUrl),
                title: title.trim(),
                summary: summary.length > 250 ? summary.slice(0, 250) + "…" : summary,
                // Focused claim for Gemini fact checking
                llmClaim: `${title}. ${summary}`.trim(),
                // Focused news excerpt for ML model tone analysis
                mlText: `${title}. ${cleanLead || summary}`.slice(0, 550).trim()
            };
        }
    } catch (err) {
        console.warn("Direct Firecrawl scrape attempt error:", err?.message);
    }

    // 2. Fallback to Flask backend /scrape
    for (const baseUrl of BACKEND_URLS) {
        try {
            const res = await axios.post(`${baseUrl}/scrape`, { url: targetUrl }, { timeout: 15000 });
            if (res?.data?.success) {
                return {
                    url: targetUrl,
                    domain: getDomain(targetUrl),
                    title: res.data.title,
                    summary: res.data.summary,
                    llmClaim: res.data.llm_claim,
                    mlText: res.data.ml_text
                };
            }
        } catch (backendErr) {
            console.warn(`Backend scrape failed on ${baseUrl}:`, backendErr?.message);
        }
    }

    throw new Error("Could not extract article details from this link. Please check the URL.");
}

function parseFactCheckResponse(rawText) {
    if (!rawText) return null;
    let clean = rawText.trim();
    if (clean.startsWith("```")) {
        clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    const fb = clean.indexOf("{");
    const lb = clean.lastIndexOf("}");
    if (fb !== -1 && lb !== -1) {
        clean = clean.slice(fb, lb + 1);
    }

    try {
        const parsed = JSON.parse(clean);
        return {
            verdict: (parsed.verdict || "ANALYSIS").toString().toUpperCase(),
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 95,
            summary: parsed.summary || "",
            explanation: parsed.explanation || clean
        };
    } catch {
        let verdict = "ANALYSIS";
        const upper = rawText.toUpperCase();
        if (upper.includes("VERDICT: TRUE") || upper.includes('"TRUE"') || upper.includes("**TRUE**") || upper.startsWith("TRUE")) {
            verdict = "TRUE";
        } else if (upper.includes("VERDICT: FALSE") || upper.includes('"FALSE"') || upper.includes("**FALSE**") || upper.startsWith("FALSE")) {
            verdict = "FALSE";
        } else if (upper.includes("MISLEADING")) {
            verdict = "MISLEADING";
        } else if (upper.includes("PARTIALLY TRUE")) {
            verdict = "PARTIALLY TRUE";
        }

        return {
            verdict,
            confidence: 90,
            summary: "",
            explanation: rawText
        };
    }
}

async function queryGeminiFactCheck(claimText) {
    const prompt = `You are TruthBot, an expert, objective Fact Checker. Analyze the following news, claim, or statement to determine whether it is factually true or false:

Claim: "${claimText}"

Respond with strict JSON adhering to this schema:
{
  "verdict": "TRUE" | "FALSE" | "PARTIALLY TRUE" | "MISLEADING" | "UNVERIFIED",
  "confidence": 95,
  "summary": "One or two concise sentences stating the verdict.",
  "explanation": "Clear, contextual paragraph explaining the facts with evidence."
}
Respond ONLY with the JSON object. Do not include markdown fences or preamble.`;

    for (const model of GEMINI_MODELS) {
        try {
            const res = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
                {
                    contents: [{ parts: [{ text: prompt }] }]
                },
                { timeout: 15000 }
            );

            const rawText = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
                return parseFactCheckResponse(rawText);
            }
        } catch (err) {
            console.warn(`Direct Gemini call failed on ${model}:`, err?.message);
        }
    }

    for (const baseUrl of BACKEND_URLS) {
        try {
            const res = await axios.post(
                `${baseUrl}/fact-check`,
                { text: claimText },
                { timeout: 15000 }
            );
            if (res && res.data) {
                return res.data;
            }
        } catch (err) {
            console.warn(`Backend fact-check failed on ${baseUrl}:`, err?.message);
        }
    }

    throw new Error("Could not verify fact. Both Gemini API and local backend did not respond.");
}

async function queryToneAnalysis(text) {
    for (const baseUrl of BACKEND_URLS) {
        try {
            const res = await axios.post(
                `${baseUrl}/predict`,
                { text },
                { timeout: 10000 }
            );
            if (res && res.data) {
                return res.data; // { prediction: "REAL"|"FAKE", confidence: number }
            }
        } catch (err) {
            console.warn(`Backend predict failed on ${baseUrl}:`, err?.message);
        }
    }

    throw new Error("Backend not responding. Please make sure the Flask server is running.");
}

export default function ChatDetector() {
    // Mode: "fact-check" (Gemini LLM) or "tone-analyzer" (ML Model)
    const [activeMode, setActiveMode] = useState("fact-check");
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const menuRef = useRef(null);

    // Auto-scroll on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    // Close dropup menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Auto-resize textarea
    const handleInput = (e) => {
        setInput(e.target.value);
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = "42px";
            ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
        }
    };

    const handleSend = async (overrideText) => {
        const textToSend = (typeof overrideText === "string" ? overrideText : input).trim();
        if (!textToSend || loading) return;

        const currentMode = activeMode;
        const detectedUrl = extractUrl(textToSend);

        const userMsg = {
            role: "user",
            text: textToSend,
            time: formatTime(),
            mode: currentMode,
            url: detectedUrl
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        if (textareaRef.current) textareaRef.current.style.height = "42px";
        setLoading(true);

        try {
            let extractedArticle = null;
            let textToProcess = textToSend;

            // ── If input is or contains a URL, scrape necessary details cleanly with Firecrawl ──
            if (detectedUrl) {
                setStatusText("Extracting article via Firecrawl…");
                extractedArticle = await scrapeWithFirecrawl(detectedUrl);
            }

            if (currentMode === "fact-check") {
                setStatusText("Gemini is fact-checking…");
                // For LLM: pass the extracted concise claim (or plain text)
                const queryText = extractedArticle ? extractedArticle.llmClaim : textToProcess;
                const factResult = await queryGeminiFactCheck(queryText);

                setMessages((prev) => [
                    ...prev,
                    {
                        role: "bot",
                        mode: "fact-check",
                        result: factResult,
                        extractedArticle,
                        time: formatTime()
                    }
                ]);
            } else {
                setStatusText("ML model analyzing tone…");
                // For ML model: pass the concise natural news text (or plain text)
                const queryText = extractedArticle ? extractedArticle.mlText : textToProcess;
                const toneResult = await queryToneAnalysis(queryText);

                setMessages((prev) => [
                    ...prev,
                    {
                        role: "bot",
                        mode: "tone-analyzer",
                        result: toneResult,
                        extractedArticle,
                        time: formatTime()
                    }
                ]);
            }
        } catch (err) {
            console.error("ANALYSIS ERROR:", err);
            setMessages((prev) => [
                ...prev,
                {
                    role: "bot",
                    mode: currentMode,
                    error: true,
                    errorMessage: err.message,
                    time: formatTime()
                }
            ]);
        }

        setLoading(false);
        setStatusText("");
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const isFactCheck = activeMode === "fact-check";

    const sampleChips = isFactCheck
        ? [
              "https://en.wikipedia.org/wiki/Moon",
              "The Earth revolves around the Sun",
              "Humans only use 10% of their brain"
          ]
        : [
              "https://www.bbc.com/news",
              "Treasury yields climbed after global central banks reviewed monetary policy",
              "SHOCKING SECRET revealed! Mainstream media is hiding this truth!"
          ];

    return (
        <div className="chat-page">
            <div className="chat-wrapper">

                {/* ── TruthBot Clean Header ── */}
                <div className="chat-header">
                    <div className="chat-header-main">
                        <div className="chat-avatar">
                            <img src="/truthbot-logo.png" alt="TruthBot" />
                        </div>
                        <div className="chat-header-info">
                            <h2>
                                {isFactCheck ? "TruthBot · Fact Checker" : "TruthBot · Tone Analyzer"}
                            </h2>
                            <p>
                                <span className={`chat-status-dot ${isFactCheck ? "dot-gemini" : "dot-ml"}`} />
                                {isFactCheck
                                    ? "Gemini Free LLM + Firecrawl · Verifying news links & factual truth"
                                    : "TruthBot ML Model + Firecrawl · Judging journalistic tone from links & text"}
                            </p>
                        </div>
                    </div>

                    <div className="header-mode-indicator">
                        <span className={`engine-badge-pill ${isFactCheck ? "badge-gemini" : "badge-ml"}`}>
                            {isFactCheck ? "🌐 Gemini Fact-Check" : "⚡ Tone ML Model"}
                        </span>
                    </div>
                </div>

                {/* ── Messages Container ── */}
                <div className="chat-messages">
                    {messages.length === 0 && !loading && (
                        <div className="chat-empty">
                            <div className="chat-empty-avatar">
                                <img src="/truthbot-logo.png" alt="TruthBot" className="empty-logo-img" />
                            </div>
                            <h3 className="chat-empty-title">
                                {isFactCheck ? "Fact Checking Assistant (Gemini LLM)" : "Tone & Style Analyzer (ML Model)"}
                            </h3>
                            <p className="chat-empty-desc">
                                {isFactCheck ? (
                                    <>
                                        Paste any <strong>news link</strong> or enter a claim below. Firecrawl extracts the key facts and Gemini verifies whether it is <strong>True</strong>, <strong>False</strong>, or <strong>Misleading</strong>.
                                    </>
                                ) : (
                                    <>
                                        Paste any <strong>news link</strong> or text below. Firecrawl extracts the lead story and our ML model judges whether its tone is <strong>Journalistic/Real</strong> or <strong>Sensational/Fake</strong>.
                                    </>
                                )}
                            </p>

                            <div className="chat-sample-chips">
                                <span className="chips-hint">Try an example link or statement:</span>
                                {sampleChips.map((chip, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className="sample-chip-btn"
                                        onClick={() => handleSend(chip)}
                                    >
                                        {chip.startsWith("http") ? `🔗 ${chip}` : `"${chip}"`}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => {
                        if (msg.role === "user") {
                            return (
                                <div className="chat-row user" key={i}>
                                    <div className="bubble-avatar user-av">👤</div>
                                    <div className="bubble-col">
                                        <div className="bubble user-bubble">
                                            {msg.url && (
                                                <div className="user-link-pill">
                                                    <span>🔗 {getDomain(msg.url)}</span>
                                                </div>
                                            )}
                                            {msg.text}
                                        </div>
                                        <div className="bubble-time">{msg.time}</div>
                                    </div>
                                </div>
                            );
                        }

                        // Bot response
                        const isMsgFactCheck = msg.mode === "fact-check";
                        const article = msg.extractedArticle;

                        return (
                            <div className="chat-row bot" key={i}>
                                <div className="bubble-avatar bot-av">
                                    <img src="/truthbot-logo.png" alt="TruthBot" />
                                </div>
                                <div className="bubble-col">
                                    <div className="bubble bot-bubble">
                                        {/* Engine Badge */}
                                        <div className="engine-badge-tag">
                                            {isMsgFactCheck ? (
                                                <span className="badge-gemini">✨ Gemini Free LLM · Fact Check</span>
                                            ) : (
                                                <span className="badge-ml">⚡ TruthBot ML · Tone Analysis</span>
                                            )}
                                        </div>

                                        {/* ── Extracted Article Card (if URL provided) ── */}
                                        {article && (
                                            <div className="scraped-source-card">
                                                <div className="source-domain-row">
                                                    <span className="firecrawl-pill">🔥 Firecrawl Extracted</span>
                                                    <a
                                                        href={article.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="source-external-link"
                                                    >
                                                        {article.domain} ↗
                                                    </a>
                                                </div>
                                                <div className="source-article-title">{article.title}</div>
                                                {article.summary && (
                                                    <div className="source-article-summary">
                                                        "{article.summary}"
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {msg.error ? (
                                            <div className="bubble-error">
                                                ⚠️ {msg.errorMessage || "Error processing request. Please retry."}
                                            </div>
                                        ) : isMsgFactCheck ? (
                                            /* ── Fact Check Result ── */
                                            <div className="fact-check-card">
                                                <div className="fact-header-row">
                                                    <div
                                                        className={`verdict-badge verdict-${(msg.result?.verdict || "info").toLowerCase().replace(/\s+/g, "-")}`}
                                                    >
                                                        {msg.result?.verdict === "TRUE" && "✅  FACT: TRUE"}
                                                        {msg.result?.verdict === "FALSE" && "❌  FACT: FALSE"}
                                                        {msg.result?.verdict === "PARTIALLY TRUE" && "⚠️  PARTIALLY TRUE"}
                                                        {msg.result?.verdict === "MISLEADING" && "⚠️  MISLEADING"}
                                                        {msg.result?.verdict === "UNVERIFIED" && "ℹ️  UNVERIFIED"}
                                                        {!["TRUE", "FALSE", "PARTIALLY TRUE", "MISLEADING", "UNVERIFIED"].includes(msg.result?.verdict) &&
                                                            `ℹ️  ${msg.result?.verdict || "VERIFIED"}`}
                                                    </div>

                                                    {typeof msg.result?.confidence === "number" && (
                                                        <span className="confidence-pill">
                                                            {msg.result.confidence}% Certainty
                                                        </span>
                                                    )}
                                                </div>

                                                {msg.result?.summary && (
                                                    <div className="fact-summary">
                                                        {msg.result.summary}
                                                    </div>
                                                )}

                                                {msg.result?.explanation && (
                                                    <div className="fact-explanation">
                                                        {msg.result.explanation}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            /* ── Tone Analyzer ML Result ── */
                                            <div className="tone-analysis-card">
                                                {(() => {
                                                    const isFake = msg.result?.prediction === "FAKE";
                                                    return (
                                                        <>
                                                            <div className={`verdict-label ${isFake ? "fake" : "real"}`}>
                                                                {isFake ? "⚠️  SENSATIONAL / FAKE TONE" : "✅  OBJECTIVE / REAL TONE"}
                                                            </div>
                                                            <div className={`verdict-confidence ${isFake ? "" : "real-conf"}`}>
                                                                Tone Confidence: {msg.result?.confidence}%
                                                            </div>
                                                            <div className="conf-bar-track">
                                                                <div
                                                                    className={`conf-bar-fill ${isFake ? "" : "real-fill"}`}
                                                                    style={{ width: `${msg.result?.confidence || 0}%` }}
                                                                />
                                                            </div>
                                                            <p className="tone-desc-sub">
                                                                {isFake
                                                                    ? "Detected sensationalist and emotionally loaded vocabulary typical of fabricated reporting."
                                                                    : "Detected balanced, neutral vocabulary characteristic of factual journalistic reporting."}
                                                            </p>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="bubble-time">{msg.time}</div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Thinking indicator */}
                    {loading && (
                        <div className="chat-row bot">
                            <div className="bubble-avatar bot-av">
                                <img src="/truthbot-logo.png" alt="TruthBot" />
                            </div>
                            <div className="bubble-col">
                                <div className="bubble bot-bubble">
                                    <div className="thinking-row">
                                        <div className="thinking-dots">
                                            <span /><span /><span />
                                        </div>
                                        <span className="thinking-text">
                                            {statusText || (isFactCheck ? "TruthBot is verifying facts…" : "TruthBot analyzing tone…")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* ── Input bar with Dynamic Drop-Up Switch Button ── */}
                <div className="chat-input-area">
                    <textarea
                        ref={textareaRef}
                        className="chat-textarea"
                        placeholder={
                            isFactCheck
                                ? "Paste a news link or claim to fact-check with Gemini… (Enter to send)"
                                : "Paste a news link or text to analyze tone with ML model… (Enter to send)"
                        }
                        value={input}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />

                    {/* ── Drop-up model switch button near chat send button ── */}
                    <div className="model-dropup-container" ref={menuRef}>
                        {menuOpen && (
                            <div className="model-dropup-menu" role="menu">
                                <div className="dropup-header">
                                    <span>Select Model</span>
                                    <span className="dropup-header-sub">TruthBot Engine</span>
                                </div>

                                <button
                                    type="button"
                                    className={`dropup-item ${isFactCheck ? "active" : ""}`}
                                    onClick={() => {
                                        setActiveMode("fact-check");
                                        setMenuOpen(false);
                                    }}
                                >
                                    <div className="dropup-item-left">
                                        <span className="dropup-item-icon">🌐</span>
                                        <div className="dropup-item-content">
                                            <div className="dropup-item-heading">
                                                <span>Fact Checker</span>
                                                <span className="dropup-badge badge-gemini">Gemini LLM</span>
                                            </div>
                                            <div className="dropup-item-sub">
                                                Extracts facts via Firecrawl & checks if True or False
                                            </div>
                                        </div>
                                    </div>
                                    {isFactCheck && <span className="dropup-check-mark">✓</span>}
                                </button>

                                <button
                                    type="button"
                                    className={`dropup-item ${!isFactCheck ? "active" : ""}`}
                                    onClick={() => {
                                        setActiveMode("tone-analyzer");
                                        setMenuOpen(false);
                                    }}
                                >
                                    <div className="dropup-item-left">
                                        <span className="dropup-item-icon">⚡</span>
                                        <div className="dropup-item-content">
                                            <div className="dropup-item-heading">
                                                <span>Tone Analyzer</span>
                                                <span className="dropup-badge badge-ml">ML Model</span>
                                            </div>
                                            <div className="dropup-item-sub">
                                                Extracts story & judges tone: Journalistic vs Sensational
                                            </div>
                                        </div>
                                    </div>
                                    {!isFactCheck && <span className="dropup-check-mark">✓</span>}
                                </button>
                            </div>
                        )}

                        <button
                            type="button"
                            className={`dropup-trigger-btn ${menuOpen ? "open" : ""} ${isFactCheck ? "mode-gemini" : "mode-ml"}`}
                            onClick={() => setMenuOpen(!menuOpen)}
                            title="Click to switch model / engine"
                            aria-haspopup="true"
                            aria-expanded={menuOpen}
                        >
                            <span className="trigger-icon">{isFactCheck ? "🌐" : "⚡"}</span>
                            <span className="trigger-label">{isFactCheck ? "Fact Checker" : "Tone Analyzer"}</span>
                            <span className="trigger-arrow">{menuOpen ? "▾" : "▴"}</span>
                        </button>
                    </div>

                    <button
                        className="chat-send-btn"
                        onClick={() => handleSend()}
                        disabled={!input.trim() || loading}
                        title={isFactCheck ? "Verify with Gemini" : "Analyze Tone with ML Model"}
                    >
                        ➤
                    </button>
                </div>

            </div>
        </div>
    );
}
