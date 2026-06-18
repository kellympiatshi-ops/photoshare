import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Camera, Image, Upload, Download, Images, Link2, Lock, MessageCircle, Eye, ArrowRight } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface HomePageProps {
  onSelectMode: (mode: 'photographer' | 'client') => void;
  onSignOut: () => void;
  userEmail: string;
}

export function HomePage({ onSelectMode, onSignOut, userEmail }: HomePageProps) {
  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      {/* Header */}
      <header className="bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-black text-white p-3 rounded-2xl shadow-md flex items-center justify-center">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-[color:var(--foreground)]">PhotoShare</h1>
                {userEmail ? <p className="text-xs text-[color:var(--muted-foreground)]">{userEmail}</p> : null}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <ThemeToggle />
              <Button variant="ghost" onClick={onSignOut} className="text-sm text-[color:var(--muted-foreground)]">
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Title */}
        <div className="text-center mb-12">
          <h2 className="text-6xl font-extrabold text-[color:var(--foreground)] leading-tight mb-4">
            Partagez vos photos avec élégance
          </h2>
          <p className="text-lg text-[color:var(--muted-foreground)] max-w-2xl mx-auto">
            Un espace simple, sécurisé et visuellement soigné pour présenter et distribuer vos meilleures images.
          </p>
        </div>

        {/* Two Cards Section */}
        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-16">
          {/* Studio Card */}
          <Card className="hover:shadow-2xl transition-all duration-300 border bg-white/70 dark:bg-card/80 backdrop-blur-md overflow-hidden rounded-2xl">
            <CardHeader className="pb-6">
              <div className="flex items-center space-x-4 mb-6">
                <div className="bg-indigo-100 p-4 rounded-2xl">
                  <Camera className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                  <CardTitle className="text-3xl font-bold text-gray-900">Studio</CardTitle>
                  <CardDescription className="text-base text-gray-600">
                    Créez et gérez vos collections de photos
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3.5">
                <li className="flex items-start space-x-3">
                  <Images className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Créer des collections d'événements</span>
                </li>
                <li className="flex items-start space-x-3">
                  <Upload className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Téléverser vos photos en haute qualité</span>
                </li>
                <li className="flex items-start space-x-3">
                  <Link2 className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Partager via des liens sécurisés</span>
                </li>
                <li className="flex items-start space-x-3">
                  <Lock className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Protection par <span className="font-semibold">mot de passe</span> (optionnelle)</span>
                </li>
              </ul>
              <Button 
                className="w-full mt-6 bg-[color:var(--primary)] hover:brightness-95 text-[color:var(--primary-foreground)] py-5 text-base font-semibold rounded-lg flex items-center justify-center" 
                onClick={() => onSelectMode('photographer')}
              >
                Accéder au Studio
                <ArrowRight className="w-5 h-5 ml-2 transition-transform" />
              </Button>
            </CardContent>
          </Card>

          {/* Galerie Card */}
          <Card className="hover:shadow-2xl transition-all duration-300 border bg-white/70 dark:bg-card/80 backdrop-blur-md overflow-hidden rounded-2xl">
            <CardHeader className="pb-6">
              <div className="flex items-center space-x-4 mb-6">
                <div className="bg-orange-100 p-4 rounded-2xl">
                  <Image className="w-8 h-8 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-3xl font-bold text-gray-900">Galerie</CardTitle>
                  <CardDescription className="text-base text-gray-600">
                    Accédez aux collections partagées avec vous
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3.5">
                <li className="flex items-start space-x-3">
                  <Link2 className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Accéder avec un <span className="font-semibold">code de collection</span></span>
                </li>
                <li className="flex items-start space-x-3">
                  <Eye className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Visualiser toutes les photos</span>
                </li>
                <li className="flex items-start space-x-3">
                  <Download className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Télécharger en qualité originale</span>
                </li>
                <li className="flex items-start space-x-3">
                  <MessageCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Liker et commenter les photos</span>
                </li>
              </ul>
              <Button 
                className="w-full mt-6 bg-[color:var(--accent)] hover:brightness-95 text-[color:var(--accent-foreground)] py-5 text-base font-semibold rounded-lg flex items-center justify-center"
                onClick={() => onSelectMode('client')}
              >
                Accéder à la Galerie
                <ArrowRight className="w-5 h-5 ml-2 transition-transform" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Features Section */}
        <div className="mt-16 border-t pt-12">
          <h3 className="text-2xl font-bold text-gray-900 mb-10 text-center">
            Fonctionnalités principales
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="text-center">
              <div className="bg-indigo-100 w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Images className="w-7 h-7 text-indigo-600" />
              </div>
              <h4 className="font-semibold text-sm text-gray-900">Collections</h4>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Upload className="w-7 h-7 text-blue-600" />
              </div>
              <h4 className="font-semibold text-sm text-gray-900">Uploader</h4>
            </div>
            <div className="text-center">
              <div className="bg-red-100 w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Eye className="w-7 h-7 text-red-600" />
              </div>
              <h4 className="font-semibold text-sm text-gray-900">Aperçu</h4>
            </div>
            <div className="text-center">
              <div className="bg-orange-100 w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Download className="w-7 h-7 text-orange-600" />
              </div>
              <h4 className="font-semibold text-sm text-gray-900">Téléchargement</h4>
            </div>
            <div className="text-center">
              <div className="bg-pink-100 w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="w-7 h-7 text-pink-600" />
              </div>
              <h4 className="font-semibold text-sm text-gray-900">Commentaires</h4>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-600 text-sm">
            © 2024 PhotoShare - Partage de photos simplifié
          </p>
        </div>
      </footer>
    </div>
  );
}
