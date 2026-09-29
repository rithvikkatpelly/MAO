import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AppShell from "./components/AppShell";
import { ToastProvider } from "./components/Toast";
import LandingPage from "./pages/LandingPage";

const LibraryPage = lazy(() => import("./pages/app/LibraryPage"));
const CreatePage = lazy(() => import("./pages/app/CreatePage"));
const BrandPage = lazy(() => import("./pages/app/BrandPage"));
const EditorPage = lazy(() => import("./pages/app/EditorPage"));

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-subtle">
      <Loader2 size={20} className="animate-spin" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
      <p className="text-sm font-medium text-accent">404</p>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">This page does not exist</h1>
      <Link to="/app" className="btn btn-primary mt-3">
        Go to your projects
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/studio" element={<Navigate to="/app/new" replace />} />
            <Route path="/app" element={<AppShell />}>
              <Route index element={<LibraryPage />} />
              <Route path="new" element={<CreatePage />} />
              <Route path="brand" element={<BrandPage />} />
            </Route>
            <Route path="/app/p/:id" element={<EditorPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  );
}
