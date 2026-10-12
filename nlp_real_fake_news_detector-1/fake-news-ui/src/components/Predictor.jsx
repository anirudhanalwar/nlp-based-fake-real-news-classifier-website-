import { useState } from "react";
import axios from "axios";
import ResultCard from "./ResultCard";

export default function Predictor() {
    const [text, setText] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handlePredict = async () => {
        if (!text.trim()) return;

        setLoading(true);

        try {
            let res;
            try {
                res = await axios.post("http://127.0.0.1:5001/predict", { text });
            } catch {
                res = await axios.post("http://127.0.0.1:5000/predict", { text });
            }

            if (res && res.data) {
                setResult(res.data);
            }
        } catch (err) {
            console.error("API ERROR:", err);
            alert("Backend not responding");
        }

        setLoading(false);
    };

    return (
        <div style={{ textAlign: "center", marginTop: "40px" }}>
            <textarea
                placeholder="Paste news article here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{
                    width: "60%",
                    height: "120px",
                    padding: "10px",
                    borderRadius: "10px",
                }}
            />

            <br />

            <button
                onClick={handlePredict}
                style={{
                    marginTop: "20px",
                    padding: "10px 20px",
                    fontSize: "16px",
                    cursor: "pointer",
                }}
            >
                {loading ? "Analyzing..." : "Predict"}
            </button>

            {/* ✅ SAFE rendering */}
            {result && <ResultCard result={result} />}
        </div>
    );
}