import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Camera, Plus, FolderOpen, ArrowLeft, Copy, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { CollectionView } from './CollectionView';
import {
  API_BASE_URL,
  authHeaders,
  createLocalCollection,
  deleteLocalCollection,
  getCreateCollectionErrorMessage,
  getLocalCollections,
  getOrCreateLocalId,
  isRecoverableCreateError,
  saveLocalCollection,
} from '../../lib/api';
import type { Collection } from '../types';

interface PhotographerDashboardProps {
  onBack: () => void;
  onSignOut: () => void;
}

export function PhotographerDashboard({ onBack, onSignOut }: PhotographerDashboardProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      const sessionId = getOrCreateSessionId();
      
      // Ajouter un timeout de 5 secondes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(
        `${API_BASE_URL}/collections?sessionId=${sessionId}`,
        {
          headers: authHeaders,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.collections) {
        const localCollections = getLocalCollections(sessionId);
        const nextCollections = mergeCollections(data.collections, localCollections);
        setCollections(nextCollections);
        // Mettre en cache les collections
        localStorage.setItem('cached_collections', JSON.stringify(nextCollections));
        localStorage.setItem('cached_collections_timestamp', Date.now().toString());
      }
    } catch (error) {
      console.error('Load collections error:', error);
      
      // Charger depuis le cache
      const cachedCollections = localStorage.getItem('cached_collections');
      const cacheTimestamp = localStorage.getItem('cached_collections_timestamp');
      const cacheAge = cacheTimestamp ? Date.now() - parseInt(cacheTimestamp) : Infinity;
      
      if (cachedCollections && cacheAge < 3600000) { // Cache valide pendant 1 heure
        try {
          const sessionId = getOrCreateSessionId();
          const nextCollections = mergeCollections(JSON.parse(cachedCollections), getLocalCollections(sessionId));
          setCollections(nextCollections);
          toast.info('Collections chargées depuis le cache');
          return;
        } catch (e) {
          console.error('Cache parse error:', e);
        }
      }
      
      // Si pas de cache ou erreur, afficher un message
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Le serveur met trop de temps à répondre. Connexion lente détectée.');
      } else {
        toast.error('Impossible de charger les collections. Mode déconnecté.');
      }
      
      // Initialiser avec un tableau vide pour permettre la création
      setCollections(getLocalCollections(getOrCreateSessionId()));
    }
  };

  const getOrCreateSessionId = () => {
    return getOrCreateLocalId('photographer_session_id');
  };

  const handleCreateCollection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const password = formData.get('password') as string;
    const photographerName = formData.get('photographerName') as string;

    try {
      const sessionId = getOrCreateSessionId();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${API_BASE_URL}/collections`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({ 
            name, 
            description, 
            password: password || null,
            photographerName: photographerName || 'Photographe',
            sessionId 
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404 || response.status >= 500) {
          createFallbackCollection({ name, description, password, photographerName, sessionId });
          return;
        }
        toast.error(`Erreur: ${data.error || 'Erreur inconnue'}`);
        return;
      }

      setCollections([...collections, data.collection]);
      setIsCreateDialogOpen(false);
      toast.success('Collection créée avec succès !');
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error('Create collection error:', error);
      if (isRecoverableCreateError(error)) {
        createFallbackCollection({
          name,
          description,
          password,
          photographerName,
          sessionId: getOrCreateSessionId(),
        });
      } else {
        toast.error(getCreateCollectionErrorMessage(error));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const createFallbackCollection = (input: {
    name: string;
    description: string;
    password: string;
    photographerName: string;
    sessionId: string;
  }) => {
    const collection = createLocalCollection(input);
    saveLocalCollection(collection);
    const nextCollections = mergeCollections(collections, [collection]);
    setCollections(nextCollections);
    localStorage.setItem('cached_collections', JSON.stringify(nextCollections));
    localStorage.setItem('cached_collections_timestamp', Date.now().toString());
    setIsCreateDialogOpen(false);
    toast.warning('Supabase est injoignable. Collection créée en mode local sur cet appareil.');
  };

  const handleCopyCode = async (code: string) => {
    try {
      // Try using the Clipboard API
      await navigator.clipboard.writeText(code);
      toast.success('Code copié dans le presse-papiers !');
    } catch (error) {
      // Fallback: Create a temporary text area
      try {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          toast.success('Code copié dans le presse-papiers !');
        } else {
          // If both methods fail, show the code to the user
          toast.info(`Code d'accès : ${code}`);
        }
      } catch (fallbackError) {
        // If all methods fail, show the code
        toast.info(`Code d'accès : ${code}`);
      }
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette collection et toutes ses photos ?')) {
      return;
    }

    const collection = collections.find((item) => item.id === collectionId);
    if (collection?.localOnly) {
      deleteLocalCollection(collectionId);
      setCollections(collections.filter(c => c.id !== collectionId));
      toast.success('Collection locale supprimée avec succès !');
      return;
    }

    try {
      const sessionId = getOrCreateSessionId();
      const response = await fetch(
        `${API_BASE_URL}/collections/${collectionId}?sessionId=${sessionId}`,
        {
          method: 'DELETE',
          headers: authHeaders,
        }
      );

      if (!response.ok) {
        const data = await response.json();
        toast.error('Erreur: ' + (data.error || 'Erreur inconnue'));
        return;
      }

      setCollections(collections.filter(c => c.id !== collectionId));
      if (selectedCollection?.id === collectionId) {
        setSelectedCollection(null);
      }
      toast.success('Collection supprimée avec succès !');
    } catch (error) {
      console.error('Delete collection error:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  if (selectedCollection) {
    return (
      <CollectionView
        collection={selectedCollection}
        isPhotographer={true}
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
                <p className="text-sm text-gray-500">Mode Photographe</p>
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
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle Collection
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une nouvelle collection</DialogTitle>
                <DialogDescription>
                  Organisez vos photos par événement ou client
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCollection} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="photographerName">Votre nom *</Label>
                  <Input
                    id="photographerName"
                    name="photographerName"
                    placeholder="Ex: Studio Photo Martin"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nom de la collection *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Ex: Mariage Sophie & Thomas"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Description optionnelle..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe (optionnel)</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showCreatePassword ? 'text' : 'password'}
                      placeholder="Protection supplémentaire"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500"
                      onClick={() => setShowCreatePassword((v) => !v)}
                    >
                      {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Ajoutez un mot de passe pour sécuriser l'accès
                  </p>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Création...' : 'Créer'}
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
                Créez votre première collection pour commencer à partager vos photos
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Créer une collection
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
              <Card
                key={collection.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="truncate">{collection.name}</span>
                    {collection.passwordProtected && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        Protégé
                      </span>
                    )}
                    {collection.localOnly && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Local
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {collection.description || 'Aucune description'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>{collection.photoCount || 0} photo(s)</span>
                    <span>{new Date(collection.createdAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Code de partage</p>
                        <p className="font-mono font-bold text-indigo-600">
                          {collection.code}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyCode(collection.code)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      className="flex-1"
                      onClick={() => setSelectedCollection(collection)}
                    >
                      Ouvrir
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeleteCollection(collection.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function mergeCollections(primary: Collection[], secondary: Collection[]) {
  const collections = new Map<string, Collection>();
  for (const collection of primary) {
    collections.set(collection.id, collection);
  }
  for (const collection of secondary) {
    collections.set(collection.id, collection);
  }
  return Array.from(collections.values());
}
