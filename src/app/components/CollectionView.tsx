import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { ArrowLeft, Upload, Download, Heart, MessageCircle, Star, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { API_BASE_URL, authHeaders, getOrCreateLocalId } from '../../lib/api';
import type { Collection, Photo, PhotoComment } from '../types';

interface CollectionViewProps {
  collection: Collection;
  isPhotographer: boolean;
  onBack: () => void;
}

export function CollectionView({ collection, isPhotographer, onBack }: CollectionViewProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [userFavorites, setUserFavorites] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [userName, setUserName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPhotos();
    loadUserInteractions();
    loadUserName();
  }, [collection.id]);

  const getSessionId = () => {
    const sessionId = isPhotographer 
      ? localStorage.getItem('photographer_session_id')
      : crypto.randomUUID();
    return sessionId || '';
  };

  const getVisitorId = () => getOrCreateLocalId('visitor_id');

  const loadUserName = () => {
    const stored = localStorage.getItem('user_display_name');
    setUserName(stored || '');
  };

  const saveUserName = (name: string) => {
    localStorage.setItem('user_display_name', name);
    setUserName(name);
  };

  const loadPhotos = async () => {
    try {
      // Ajouter un timeout de 5 secondes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(
        `${API_BASE_URL}/collections/${collection.id}/photos`,
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
      if (data.photos) {
        setPhotos(data.photos);
        // Mettre en cache les photos
        localStorage.setItem(`cached_photos_${collection.id}`, JSON.stringify(data.photos));
        localStorage.setItem(`cached_photos_${collection.id}_timestamp`, Date.now().toString());
      }
    } catch (error) {
      console.error('Load photos error:', error);
      
      // Charger depuis le cache
      const cachedPhotos = localStorage.getItem(`cached_photos_${collection.id}`);
      const cacheTimestamp = localStorage.getItem(`cached_photos_${collection.id}_timestamp`);
      const cacheAge = cacheTimestamp ? Date.now() - parseInt(cacheTimestamp) : Infinity;
      
      if (cachedPhotos && cacheAge < 3600000) { // Cache valide pendant 1 heure
        try {
          setPhotos(JSON.parse(cachedPhotos));
          toast.info('Photos chargées depuis le cache');
          return;
        } catch (e) {
          console.error('Cache parse error:', e);
        }
      }
      
      // Si pas de cache ou erreur
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Le serveur met trop de temps à répondre.');
      } else {
        toast.error('Impossible de charger les photos.');
      }
      
      setPhotos([]);
    }
  };

  const loadUserInteractions = () => {
    try {
      // Charger les likes et favoris depuis le localStorage
      const likes = localStorage.getItem(`likes_${collection.id}`);
      const favorites = localStorage.getItem(`favorites_${collection.id}`);

      if (likes) {
        setUserLikes(new Set(JSON.parse(likes)));
      }

      if (favorites) {
        setUserFavorites(new Set(JSON.parse(favorites)));
      }
    } catch (error) {
      console.error('Load user interactions error:', error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (collection.localOnly) {
      toast.error('Cette collection est locale. Connectez Supabase pour téléverser des photos.');
      return;
    }

    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const totalFiles = files.length;
    let uploadedFiles = 0;

    try {
      const sessionId = getSessionId();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('collectionId', collection.id);
        formData.append('sessionId', sessionId);

        const response = await fetch(
          `${API_BASE_URL}/photos/upload`,
          {
            method: 'POST',
            headers: authHeaders,
            body: formData,
          }
        );

        if (response.ok) {
          uploadedFiles++;
          setUploadProgress((uploadedFiles / totalFiles) * 100);
        }
      }

      toast.success(`${uploadedFiles} photo(s) téléversée(s) avec succès !`);
      loadPhotos();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erreur lors du téléversement');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette photo ?')) {
      return;
    }

    try {
      const sessionId = getSessionId();
      const response = await fetch(
        `${API_BASE_URL}/photos/${collection.id}/${photoId}?sessionId=${sessionId}`,
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

      setPhotos(photos.filter(p => p.id !== photoId));
      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto(null);
      }
      toast.success('Photo supprimée avec succès !');
    } catch (error) {
      console.error('Delete photo error:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDownloadPhoto = async (photo: any) => {
    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photo.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Téléchargement démarré !');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const handleDownloadAll = async () => {
    if (photos.length === 0) {
      toast.error('Aucune photo à télécharger');
      return;
    }

    toast.info('Préparation du fichier ZIP...');

    try {
      const zip = new JSZip();

      // Download all photos and add to zip
      for (const photo of photos) {
        const response = await fetch(photo.url);
        const blob = await response.blob();
        zip.file(photo.name, blob);
      }

      // Generate and download zip
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${collection.name}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Collection téléchargée avec succès !');
    } catch (error) {
      console.error('Download all error:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const handleToggleLike = async (photoId: string) => {
    try {
      const newLikes = new Set(userLikes);
      const isLiked = newLikes.has(photoId);

      if (isLiked) {
        newLikes.delete(photoId);
      } else {
        newLikes.add(photoId);
      }

      setUserLikes(newLikes);
      localStorage.setItem(`likes_${collection.id}`, JSON.stringify([...newLikes]));

      // Mettre à jour le compteur de likes
      const response = await fetch(
        `${API_BASE_URL}/photos/${photoId}/like`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({ 
            collectionId: collection.id,
            liked: !isLiked,
            userId: getVisitorId(),
          }),
        }
      );

      const data = await response.json();
      if (response.ok && data.likes !== undefined) {
        setPhotos((currentPhotos) =>
          currentPhotos.map((photo) =>
            photo.id === photoId ? { ...photo, likes: data.likes } : photo
          )
        );
        setSelectedPhoto((currentPhoto) =>
          currentPhoto?.id === photoId ? { ...currentPhoto, likes: data.likes } : currentPhoto
        );
      }
    } catch (error) {
      console.error('Toggle like error:', error);
    }
  };

  const handleToggleFavorite = (photoId: string) => {
    const newFavorites = new Set(userFavorites);
    
    if (newFavorites.has(photoId)) {
      newFavorites.delete(photoId);
      toast.success('Photo retirée des favoris');
    } else {
      newFavorites.add(photoId);
      toast.success('Photo ajoutée aux favoris');
    }

    setUserFavorites(newFavorites);
    localStorage.setItem(`favorites_${collection.id}`, JSON.stringify([...newFavorites]));
  };

  const loadComments = async (photoId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/photos/${photoId}/comments`,
        {
          headers: authHeaders,
        }
      );

      const data = await response.json();
      if (data.comments) {
        setComments(data.comments);
      }
    } catch (error) {
      console.error('Load comments error:', error);
    }
  };

  const handleAddComment = async (photoId: string, text: string, name: string) => {
    if (!text.trim()) return;
    if (!name.trim()) {
      toast.error('Veuillez entrer votre nom');
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({
            photoId,
            collectionId: collection.id,
            text,
            userName: name,
          }),
        }
      );

      if (response.ok) {
        saveUserName(name);
        loadComments(photoId);
        toast.success('Commentaire ajouté');
      }
    } catch (error) {
      console.error('Add comment error:', error);
      toast.error('Erreur lors de l\'ajout du commentaire');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{collection.name}</h1>
                <p className="text-sm text-gray-500">{photos.length} photo(s)</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isPhotographer && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading || collection.localOnly}>
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploading ? 'Téléversement...' : collection.localOnly ? 'Supabase requis' : 'Ajouter des photos'}
                  </Button>
                </>
              )}
              {photos.length > 0 && (
                <Button variant="outline" onClick={handleDownloadAll}>
                  <Download className="w-4 h-4 mr-2" />
                  Tout télécharger
                </Button>
              )}
            </div>
          </div>

          {isUploading && (
            <div className="mt-4">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-sm text-gray-500 mt-2">
                Téléversement en cours... {Math.round(uploadProgress)}%
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Photo Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {photos.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ImageIcon className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Aucune photo
              </h3>
              <p className="text-gray-500 text-center mb-4">
                {isPhotographer
                  ? 'Commencez par ajouter des photos à cette collection'
                  : 'Le photographe n\'a pas encore ajouté de photos'}
              </p>
              {isPhotographer && (
                <Button onClick={() => fileInputRef.current?.click()} disabled={collection.localOnly}>
                  <Upload className="w-4 h-4 mr-2" />
                  {collection.localOnly ? 'Supabase requis' : 'Ajouter des photos'}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <Card key={photo.id} className="overflow-hidden group">
                <div className="relative aspect-square bg-gray-100">
                  <img
                    src={photo.url}
                    alt={photo.name}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => {
                      setSelectedPhoto(photo);
                      loadComments(photo.id);
                    }}
                  />
                  {userFavorites.has(photo.id) && (
                    <Star className="absolute top-2 right-2 w-6 h-6 text-yellow-400 fill-yellow-400" />
                  )}
                </div>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium truncate">{photo.name}</span>
                  </div>
                  <div className="flex items-center justify-between space-x-2">
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleLike(photo.id)}
                        className="h-8 px-2"
                      >
                        <Heart
                          className={`w-4 h-4 ${
                            userLikes.has(photo.id) ? 'fill-red-500 text-red-500' : ''
                          }`}
                        />
                        <span className="ml-1 text-xs">{photo.likes || 0}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleFavorite(photo.id)}
                        className="h-8 px-2"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            userFavorites.has(photo.id) ? 'fill-yellow-400 text-yellow-400' : ''
                          }`}
                        />
                      </Button>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownloadPhoto(photo)}
                        className="h-8 px-2"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      {isPhotographer && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="h-8 px-2 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Photo Detail Dialog */}
      {selectedPhoto && (
        <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedPhoto.name}</DialogTitle>
              <DialogDescription>
                Détails et commentaires de la photo
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.name}
                className="w-full h-auto rounded-lg"
              />
              
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleLike(selectedPhoto.id)}
                  >
                    <Heart
                      className={`w-4 h-4 mr-2 ${
                        userLikes.has(selectedPhoto.id) ? 'fill-red-500 text-red-500' : ''
                      }`}
                    />
                    {selectedPhoto.likes || 0} J'aime
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleFavorite(selectedPhoto.id)}
                  >
                    <Star
                      className={`w-4 h-4 mr-2 ${
                        userFavorites.has(selectedPhoto.id) ? 'fill-yellow-400 text-yellow-400' : ''
                      }`}
                    />
                    Favori
                  </Button>
                </div>
                <Button size="sm" onClick={() => handleDownloadPhoto(selectedPhoto)}>
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger
                </Button>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Commentaires ({comments.length})
                </h3>
                <div className="space-y-3 mb-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{comment.userName}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.text}</p>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const text = formData.get('comment') as string;
                    const name = formData.get('userName') as string;
                    handleAddComment(selectedPhoto.id, text, name);
                    (e.target as HTMLFormElement).reset();
                  }}
                  className="space-y-2"
                >
                  <Input
                    name="userName"
                    placeholder="Votre nom"
                    defaultValue={userName}
                    required
                  />
                  <div className="flex space-x-2">
                    <Textarea
                      name="comment"
                      placeholder="Ajouter un commentaire..."
                      className="flex-1"
                      rows={2}
                      required
                    />
                    <Button type="submit">Envoyer</Button>
                  </div>
                </form>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
