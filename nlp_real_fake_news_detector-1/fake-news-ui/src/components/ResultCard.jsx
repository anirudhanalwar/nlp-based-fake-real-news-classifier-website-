export default function ResultCard({ result }) {
    if (!result) return null;

    const isFake = result.prediction === "FAKE";

    return (
        <div
            style={{
                marginTop: "30px",
                padding: "20px",
                borderRadius: "10px",
                background: isFake ? "#2a2a2a" : "#e0e0e0",
                color: isFake ? "white" : "#111111",
                width: "300px",
                marginLeft: "auto",
                marginRight: "auto",
            }}
        >
            <h2>{result.prediction}</h2>
            <p>Confidence: {result.confidence}%</p>
        </div>
    );
}