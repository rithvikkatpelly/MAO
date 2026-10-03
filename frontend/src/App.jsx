import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import Protected, { FullPageLoader } from "./components/Protected";
import { ToastProvider } from "./components/Toast";
import LandingPage from "./pages/LandingPage";

const SignInPage = lazy(() => import("./pages/auth/SignInPage"));
const SignOutPage = lazy(() => import("./pages/auth/SignOutPage"));
const OnboardingPage = lazy(() => import("./pages/auth/OnboardingPage"));
const LibraryPage = lazy(() => import("./pages/app/LibraryPage"));
const CreatePage = lazy(() => import("./pages/app/CreatePage"));
const BrandPage = lazy(() => import("./pages/app/BrandPage"));
const EditorPage = lazy(() => import("./pages/app/EditorPage"));
const CalendarPage = lazy(() => import("./pages/app/CalendarPage"));
const IdeasPage = lazy(() => import("./pages/app/IdeasPage"));
const InsightsPage = lazy(() => import("./pages/app/InsightsPage"));
const ConnectionsPage = lazy(() => import("./pages/app/ConnectionsPage"));

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
        <Suspense fallback={<FullPageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/signout" element={<SignOutPage />} />
            <Route path="/studio" element={<Navigate to="/app/new" replace />} />

            <Route element={<Protected requireOnboarded={false} />}>
              <Route path="/onboarding" element={<OnboardingPage />} />
            </Route>

            <Route element={<Protected />}>
              <Route path="/app" element={<AppShell />}>
                <Route index element={<LibraryPage />} />
                <Route path="new" element={<CreatePage />} />
                <Route path="brand" element={<BrandPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="ideas" element={<IdeasPage />} />
                <Route path="insights" element={<InsightsPage />} />
                <Route path="connections" element={<ConnectionsPage />} />
              </Route>
              <Route path="/app/p/:id" element={<EditorPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  );
}
