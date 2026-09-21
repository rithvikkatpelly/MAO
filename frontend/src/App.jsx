import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import PlatformShowcase from "./components/PlatformShowcase";
import StatsBand from "./components/StatsBand";
import Workflow from "./components/Workflow";
import FeatureGrid from "./components/FeatureGrid";
import Templates from "./components/Templates";
import TechStack from "./components/TechStack";
import Newsletter from "./components/Newsletter";
import Footer from "./components/Footer";

export default function App() {
  return (
    <div className="min-h-screen bg-cream-50">
      <Navbar />
      <main>
        <Hero />
        <PlatformShowcase />
        <StatsBand />
        <Workflow />
        <FeatureGrid />
        <Templates />
        <TechStack />
        <Newsletter />
      </main>
      <Footer />
    </div>
  );
}
