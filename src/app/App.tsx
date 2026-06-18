import { useEffect, useState } from 'react';
import { HomePage } from './components/HomePage';
import { PhotographerDashboard } from './components/PhotographerDashboard';
import { ClientDashboard } from './components/ClientDashboard';
import { IntroLoader } from './components/IntroLoader';
import { Toaster } from './components/ui/sonner';
import { AuthScreen } from './components/AuthScreen';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [mode, setMode] = useState<'home' | 'photographer' | 'client'>('home');
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initializeSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setSession(data.session);
        setAuthReady(true);
      }
    };

    void initializeSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleBack = () => {
    setMode('home');
  };

  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  if (showIntro) {
    return <IntroLoader onComplete={handleIntroComplete} />;
  }

  if (!authReady) {
    return (
      <>
        <AuthScreen />
        <Toaster />
      </>
    );
  }

  if (!session) {
    return (
      <>
        <AuthScreen />
        <Toaster />
      </>
    );
  }

  if (mode === 'home') {
    return (
      <>
        <HomePage onSelectMode={setMode} onSignOut={() => void supabase.auth.signOut()} userEmail={session.user.email ?? ''} />
        <Toaster />
      </>
    );
  }

  return (
    <>
      {mode === 'photographer' ? (
        <PhotographerDashboard onBack={handleBack} onSignOut={() => void supabase.auth.signOut()} />
      ) : (
        <ClientDashboard onBack={handleBack} onSignOut={() => void supabase.auth.signOut()} />
      )}
      <Toaster />
    </>
  );
}

export default App;
