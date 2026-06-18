import { projectId, publicAnonKey } from './supabase';
import type { Collection } from '../app/types';

const configuredProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || projectId;
const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || `https://${configuredProjectId}.supabase.co`;
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || publicAnonKey;

export const API_BASE_URL = `${configuredSupabaseUrl}/functions/v1/make-server-66ce0d40`;

export const authHeaders = {
  Authorization: `Bearer ${configuredAnonKey}`,
};

export function getOrCreateLocalId(key: string) {
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
}

export function getCreateCollectionErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Le serveur Supabase met trop de temps à répondre.';
  }

  if (error instanceof TypeError) {
    return 'Serveur Supabase injoignable. Vérifiez la connexion Internet ou l’ID du projet Supabase.';
  }

  return 'Erreur lors de la création';
}

export function isRecoverableCreateError(error: unknown) {
  return error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError');
}

export function createLocalCollection(input: {
  name: string;
  description: string;
  password: string;
  photographerName: string;
  sessionId: string;
}): Collection {
  return {
    id: `local-${crypto.randomUUID()}`,
    name: input.name,
    description: input.description || '',
    code: generateLocalCode(),
    photographerName: input.photographerName || 'Photographe',
    sessionId: input.sessionId,
    createdAt: new Date().toISOString(),
    photoCount: 0,
    passwordProtected: Boolean(input.password),
    localOnly: true,
  };
}

export function getLocalCollections(sessionId: string) {
  try {
    const collections = JSON.parse(localStorage.getItem('local_collections') || '[]') as Collection[];
    return collections.filter((collection) => collection.sessionId === sessionId);
  } catch (error) {
    console.error('Load local collections error:', error);
    return [];
  }
}

export function saveLocalCollection(collection: Collection) {
  const collections = getAllLocalCollections().filter((item) => item.id !== collection.id);
  collections.push(collection);
  localStorage.setItem('local_collections', JSON.stringify(collections));
}

export function deleteLocalCollection(collectionId: string) {
  const collections = getAllLocalCollections().filter((item) => item.id !== collectionId);
  localStorage.setItem('local_collections', JSON.stringify(collections));
}

function getAllLocalCollections() {
  try {
    return JSON.parse(localStorage.getItem('local_collections') || '[]') as Collection[];
  } catch {
    return [];
  }
}

function generateLocalCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
