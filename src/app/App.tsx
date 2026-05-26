import { useState } from 'react';
import { HomePage } from './components/HomePage';
import { PhotographerDashboard } from './components/PhotographerDashboard';
import { ClientDashboard } from './components/ClientDashboard';
import { IntroLoader } from './components/IntroLoader';
import { Toaster } from './components/ui/sonner';

function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [mode, setMode] = useState<'home' | 'photographer' | 'client'>('home');

  const handleBack = () => {
    setMode('home');
  };

  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  if (showIntro) {
    return <IntroLoader onComplete={handleIntroComplete} />;
  }

  if (mode === 'home') {
    return (
      <>
        <HomePage onSelectMode={setMode} />
        <Toaster />
      </>
    );
  }

  return (
    <>
      {mode === 'photographer' ? (
        <PhotographerDashboard onBack={handleBack} />
      ) : (
        <ClientDashboard onBack={handleBack} />
      )}
      <Toaster />
    </>
  );
}

export default App;