import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Camera, Plus, FolderOpen, ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { CollectionView } from './CollectionView';
import { API_BASE_URL, authHeaders } from '../../lib/api';
import type { Collection } from '../types';

interface ClientDashboardProps {
  onBack: () => void;
  onSignOut: () => void;
}

export function ClientDashboard({ onBack, onSignOut }: ClientDashboardProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [showAccessPassword, setShowAccessPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      // Charger les collections stockées localement
      const storedCollections = localStorage.getItem('client_collections');
      if (storedCollections) {
        const collectionIds = JSON.parse(storedCollections);
        const loadedCollections: Collection[] = [];

        for (const id of collectionIds) {
          try {
            // Ajouter un timeout de 5 secondes
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(
              `${API_BASE_URL}/collections/${id}`,
              {
                headers: authHeaders,
                signal: controller.signal,
              }
            );

            clearTimeout(timeoutId);

            if (response.ok) {
              const data = await response.json();
              if (data.collection) {
                loadedCollections.push(data.collection);
              }
            }
          } catch (error) {
            console.error('Error loading collection:', id, error);
            
            // Essayer de charger depuis le cache
            const cachedCollection = localStorage.getItem(`cached_collection_${id}`);
            if (cachedCollection) {
              try {
                loadedCollections.push(JSON.parse(cachedCollection));
              } catch (e) {
                console.error('Cache parse error:', e);
              }
            }
          }
        }

        setCollections(loadedCollections);
        
        if (loadedCollections.length === 0 && collectionIds.length > 0) {
          toast.error('Impossible de charger les collections. Connexion lente.');
        }
      }
    } catch (error) {
      console.error('Load collections error:', error);
      toast.error('Erreur lors du chargement');
    }
  };

  const saveCollectionLocally = (collectionId: string) => {
    const storedCollections = localStorage.getItem('client_collections');
    const collectionIds = storedCollections ? JSON.parse(storedCollections) : [];
    
    if (!collectionIds.includes(collectionId)) {
      collectionIds.push(collectionId);
      localStorage.setItem('client_collections', JSON.stringify(collectionIds));
    }
  };

  const handleAccessCollection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const code = formData.get('code') as string;
    const password = formData.get('password') as string;

    try {
      // Ajouter un timeout de 10 secondes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(
        `${API_BASE_URL}/collections/access`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({ code: code.toUpperCase(), password }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Mot de passe incorrect');
        } else {
          toast.error('Code de collection invalide');
        }
        return;
      }

      // Sauvegarder l'accès localement
      saveCollectionLocally(data.collection.id);
      
      // Mettre en cache la collection
      localStorage.setItem(`cached_collection_${data.collection.id}`, JSON.stringify(data.collection));

      setCollections([...collections, data.collection]);
      setIsAccessDialogOpen(false);
      toast.success('Accès accordé à la collection !');
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error('Access collection error:', error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Le serveur met trop de temps à répondre. Veuillez réessayer.');
      } else {
        toast.error('Erreur lors de l\'accès. Vérifiez votre connexion.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedCollection) {
    return (
      <CollectionView
        collection={selectedCollection}
        isPhotographer={false}
        onBack={() => {
          setSelectedCollection(null);
          loadCollections();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">PhotoShare</h1>
                <p className="text-sm text-gray-500">Mode Client</p>
              </div>
            </div>
            <Button variant="outline" onClick={onSignOut}>
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Mes Collections</h2>
          <Dialog open={isAccessDialogOpen} onOpenChange={setIsAccessDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Accéder à une collection
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Accéder à une collection</DialogTitle>
                <DialogDescription>
                  Entrez le code fourni par votre photographe
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAccessCollection} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code de collection *</Label>
                  <Input
                    id="code"
                    name="code"
                    placeholder="ABCD1234"
                    required
                    className="uppercase font-mono"
                    maxLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe (si requis)</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Mot de passe de la collection"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAccessDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Vérification...' : 'Accéder'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {collections.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FolderOpen className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Aucune collection
              </h3>
              <p className="text-gray-500 text-center mb-4">
                Demandez un code de collection à votre photographe pour commencer
              </p>
              <Button onClick={() => setIsAccessDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Accéder à une collection
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
              <Card
                key={collection.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedCollection(collection)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="truncate">{collection.name}</span>
                    {collection.passwordProtected && (
                      <Lock className="w-4 h-4 text-yellow-600" />
                    )}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {collection.description || 'Aucune description'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>{collection.photoCount || 0} photo(s)</span>
                    <span>{new Date(collection.createdAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Par {collection.photographerName}
                  </p>
                  <Button className="w-full mt-2">
                    Ouvrir la galerie
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
