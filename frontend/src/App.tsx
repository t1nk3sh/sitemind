import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { AppProvider } from "./lib/store";
import { CracksPage } from "./pages/CracksPage";
import { DailySitePage } from "./pages/DailySitePage";
import { DashboardPage } from "./pages/DashboardPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { PlanningPage } from "./pages/PlanningPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { SafetyPage } from "./pages/SafetyPage";
import { ValuationPage } from "./pages/ValuationPage";

export function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/safety" element={<SafetyPage />} />
            <Route path="/cracks" element={<CracksPage />} />
            <Route path="/valuation" element={<ValuationPage />} />
            <Route path="/planning" element={<PlanningPage />} />
            <Route path="/daily-site" element={<DailySitePage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AppProvider>
  );
}
