import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Camera, CheckCircle2, CircleAlert, Eye, EyeOff, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type AuthMode = 'login' | 'signup';

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');

  const baseUrl = useMemo(() => `${window.location.origin}${window.location.pathname}`, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = window.location.hash;
    const isRecoveryLink =
      url.searchParams.get('mode') === 'recovery' ||
      url.searchParams.get('type') === 'recovery' ||
      hash.includes('type=recovery') ||
      hash.includes('recovery');

    if (!isRecoveryLink) {
      return;
    }

    setMode('login');
    setRecoveryReady(true);
    setRecoveryMessage('Lien de récupération détecté. Choisissez un nouveau mot de passe.');

    const exchangeSession = async () => {
      const code = url.searchParams.get('code');

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) {
            throw error;
          }
        }
      } catch (error) {
        console.error('Recovery exchange error:', error);
        toast.error('Impossible de valider le lien de récupération.');
      }
    };

    void exchangeSession();
  }, []);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      toast.success('Connexion réussie.');
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error instanceof Error ? error.message : 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${baseUrl}?mode=recovery`,
        },
      });

      if (error) {
        throw error;
      }

      toast.success('Compte créé. Vérifiez votre boîte mail si la confirmation est requise.');
    } catch (error) {
      console.error('Signup error:', error);
      toast.error(error instanceof Error ? error.message : 'Création du compte impossible.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}?mode=recovery`,
      });

      if (error) {
        throw error;
      }

      setResetSent(true);
      toast.success('Lien de réinitialisation envoyé.');
    } catch (error) {
      console.error('Reset email error:', error);
      toast.error(error instanceof Error ? error.message : 'Envoi impossible.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    if (newPassword.length < 8) {
      toast.error('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        throw error;
      }

      window.history.replaceState({}, document.title, baseUrl);
      setRecoveryReady(false);
      setRecoveryMessage('');
      setNewPassword('');
      toast.success('Mot de passe mis à jour.');
    } catch (error) {
      console.error('Password update error:', error);
      toast.error(error instanceof Error ? error.message : 'Impossible de changer le mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_32%),linear-gradient(135deg,_#0f172a,_#111827_42%,_#f8fafc_42%,_#f8fafc)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="flex flex-col justify-between gap-8 rounded-3xl border border-white/10 bg-slate-950/90 p-8 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500 text-slate-950">
                <Camera className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-cyan-200/80">PhotoShare</p>
                <h1 className="text-3xl font-semibold">Accès sécurisé à l'app</h1>
              </div>
            </div>

            <div className="max-w-xl space-y-4">
              <p className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
                Connectez-vous pour gérer vos collections et les partager sans exposer l'application.
              </p>
              <p className="max-w-lg text-sm leading-6 text-slate-300">
                Connexion, création de compte, et réinitialisation de mot de passe sont gérées directement dans l’interface.
              </p>
            </div>

            <div className="grid gap-3 text-sm text-slate-200 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <ShieldCheck className="mb-3 h-5 w-5 text-cyan-300" />
                Authentification
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <KeyRound className="mb-3 h-5 w-5 text-cyan-300" />
                Réinitialisation
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <Mail className="mb-3 h-5 w-5 text-cyan-300" />
                Par e-mail
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center">
            <Card className="w-full max-w-xl border-slate-200/80 shadow-xl">
              <CardHeader className="space-y-3">
                <CardTitle className="text-2xl">Connexion</CardTitle>
                <CardDescription>
                  Accédez à votre espace ou créez un compte si vous n’en avez pas encore.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {recoveryReady && (
                  <Alert className="border-cyan-200 bg-cyan-50 text-cyan-950">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Réinitialisation en cours</AlertTitle>
                    <AlertDescription>{recoveryMessage}</AlertDescription>
                  </Alert>
                )}

                <Tabs value={mode} onValueChange={(value) => setMode(value as AuthMode)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Connexion</TabsTrigger>
                    <TabsTrigger value="signup">Créer un compte</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="mt-6 space-y-5">
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email">E-mail</Label>
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="vous@exemple.com"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="login-password">Mot de passe</Label>
                        <div className="relative">
                          <Input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Votre mot de passe"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500"
                            onClick={() => setShowPassword((value) => !value)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <Button
                          type="button"
                          variant="link"
                          className="px-0 text-slate-600"
                          onClick={() => {
                            setResetSent(false);
                            setMode('login');
                          }}
                        >
                          Mot de passe oublié
                        </Button>
                        <Button type="submit" disabled={loading}>
                          {loading ? 'Connexion...' : 'Se connecter'}
                        </Button>
                      </div>
                    </form>

                    <form onSubmit={handleSendReset} className="space-y-4 border-t pt-5">
                      <div className="space-y-2">
                        <Label htmlFor="reset-email">E-mail pour réinitialiser</Label>
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="vous@exemple.com"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-slate-500">
                          Un lien sera envoyé pour choisir un nouveau mot de passe.
                        </p>
                        <Button type="submit" variant="outline" disabled={loading || !email}>
                          {loading ? 'Envoi...' : 'Réinitialiser'}
                        </Button>
                      </div>
                      {resetSent && (
                        <p className="text-sm text-emerald-600">
                          Si l’adresse existe, un e-mail de réinitialisation a été envoyé.
                        </p>
                      )}
                    </form>

                    {recoveryReady && (
                      <form onSubmit={handleUpdatePassword} className="space-y-4 border-t pt-5">
                        <div className="space-y-2">
                          <Label htmlFor="new-password">Nouveau mot de passe</Label>
                          <div className="relative">
                            <Input
                              id="new-password"
                              type={showNewPassword ? 'text' : 'password'}
                              placeholder="Nouveau mot de passe"
                              value={newPassword}
                              onChange={(event) => setNewPassword(event.target.value)}
                              minLength={8}
                              required
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500"
                              onClick={() => setShowNewPassword((value) => !value)}
                            >
                              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? 'Mise à jour...' : 'Enregistrer le nouveau mot de passe'}
                        </Button>
                      </form>
                    )}
                  </TabsContent>

                  <TabsContent value="signup" className="mt-6">
                    <form onSubmit={handleSignup} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">E-mail</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="vous@exemple.com"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Mot de passe</Label>
                        <div className="relative">
                          <Input
                            id="signup-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Au moins 8 caractères"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            minLength={8}
                            required
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500"
                            onClick={() => setShowPassword((value) => !value)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-confirm">Confirmer le mot de passe</Label>
                        <div className="relative">
                          <Input
                            id="signup-confirm"
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="Confirmez le mot de passe"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            minLength={8}
                            required
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500"
                            onClick={() => setShowConfirmPassword((value) => !value)}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Création...' : 'Créer mon compte'}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
