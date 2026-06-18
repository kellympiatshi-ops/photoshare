export interface Collection {
  id: string;
  name: string;
  description: string;
  code: string;
  photographerName: string;
  sessionId?: string;
  createdAt: string;
  photoCount: number;
  passwordProtected?: boolean;
  password?: string | null;
  localOnly?: boolean;
}

export interface Photo {
  id: string;
  collectionId: string;
  name: string;
  storagePath: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
  likes: number;
}

export interface PhotoComment {
  id: string;
  photoId: string;
  collectionId: string;
  userName: string;
  text: string;
  createdAt: string;
}
