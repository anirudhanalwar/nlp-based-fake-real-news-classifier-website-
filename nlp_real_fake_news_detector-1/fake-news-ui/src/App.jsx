import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";

import NewsPage from "./pages/NewsPage";
import DetectorPage from "./pages/DetectorPage";
import InsightsPage from "./pages/InsightsPage";

function App() {
    return (
        <Router>
            <Navbar />

            <Routes>
                <Route path="/" element={<NewsPage />} />
                <Route path="/detect" element={<DetectorPage />} />
                <Route path="/insights" element={<InsightsPage />} />
            </Routes>
        </Router>
    );
}

export default App;