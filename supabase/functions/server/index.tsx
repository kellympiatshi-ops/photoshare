import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();
const BUCKET_NAME = 'make-66ce0d40-photos';
const SIGNED_URL_EXPIRES_IN = Number(Deno.env.get('SIGNED_URL_EXPIRES_IN') ?? 3600);
const MAX_UPLOAD_BYTES = Number(Deno.env.get('MAX_UPLOAD_BYTES') ?? 25 * 1024 * 1024);
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Create storage bucket on startup
(async () => {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
    if (!bucketExists) {
      await supabase.storage.createBucket(BUCKET_NAME, { public: false });
      console.log(`Created bucket: ${BUCKET_NAME}`);
    }
  } catch (error) {
    console.error('Error creating bucket:', error);
  }
})();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: (origin) => isAllowedOrigin(origin) ? origin : allowedOrigins[0] ?? '',
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

function sanitizeCollection(collection: any) {
  const { password, passwordHash, ...safeCollection } = collection;
  return {
    ...safeCollection,
    passwordProtected: Boolean(collection.passwordProtected || password || passwordHash),
  };
}

async function hashPassword(password: string) {
  const iterations = 100000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    passwordKey,
    256,
  );
  return `pbkdf2$${iterations}$${toHex(salt)}$${toHex(new Uint8Array(derivedBits))}`;
}

async function verifyCollectionPassword(collection: any, password: string | undefined) {
  if (!collection.passwordProtected && !collection.password && !collection.passwordHash) {
    return true;
  }

  if (!password) {
    return false;
  }

  if (collection.passwordHash) {
    return verifyPasswordHash(password, collection.passwordHash);
  }

  // Backward compatibility for collections created before password hashing.
  return collection.password === password;
}

function isAllowedOrigin(origin: string) {
  return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
}

function isValidImage(file: File) {
  return ALLOWED_IMAGE_TYPES.has(file.type) && file.size <= MAX_UPLOAD_BYTES;
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function verifyPasswordHash(password: string, storedHash: string) {
  if (!storedHash.startsWith('pbkdf2$')) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    return toHex(new Uint8Array(digest)) === storedHash;
  }

  const [, iterationsValue, saltValue, hashValue] = storedHash.split('$');
  const salt = fromHex(saltValue);
  const expectedHash = fromHex(hashValue);
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: Number(iterationsValue),
    },
    passwordKey,
    expectedHash.length * 8,
  );
  return toHex(new Uint8Array(derivedBits)) === toHex(expectedHash);
}

// Generate random code for collections
function generateCollectionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Health check endpoint
app.get("/make-server-66ce0d40/health", (c) => {
  return c.json({ status: "ok" });
});

// ==================== COLLECTION ROUTES ====================

// Create collection
app.post("/make-server-66ce0d40/collections", async (c) => {
  try {
    const { name, description, password, photographerName, sessionId } = await c.req.json();
    
    if (!name || !sessionId) {
      return c.json({ error: 'Collection name and sessionId are required' }, 400);
    }

    const collectionId = crypto.randomUUID();
    const code = generateCollectionCode();

    const collection = {
      id: collectionId,
      name,
      description: description || '',
      passwordHash: password ? await hashPassword(password) : null,
      passwordProtected: Boolean(password),
      code,
      photographerName: photographerName || 'Photographe',
      sessionId,
      createdAt: new Date().toISOString(),
      photoCount: 0,
    };

    await kv.set(`collection:${collectionId}`, collection);
    await kv.set(`collection:code:${code}`, collectionId);

    return c.json({ collection: sanitizeCollection(collection) });
  } catch (error) {
    console.error('Create collection error:', error);
    return c.json({ error: 'Failed to create collection' }, 500);
  }
});

// Get user's collections
app.get("/make-server-66ce0d40/collections", async (c) => {
  try {
    const sessionId = c.req.query('sessionId');
    
    if (!sessionId) {
      return c.json({ collections: [] });
    }

    const allCollections = await kv.getByPrefix('collection:');
    
    // Filter collections by sessionId
    const userCollections = allCollections
      .filter((col: any) => col.sessionId === sessionId && col.id)
      .map(sanitizeCollection);

    return c.json({ collections: userCollections });
  } catch (error) {
    console.error('Get collections error:', error);
    return c.json({ error: 'Failed to fetch collections' }, 500);
  }
});

// Get collection by ID
app.get("/make-server-66ce0d40/collections/:id", async (c) => {
  try {
    const collectionId = c.req.param('id');
    const collection = await kv.get(`collection:${collectionId}`);

    if (!collection) {
      return c.json({ error: 'Collection not found' }, 404);
    }

    return c.json({ collection: sanitizeCollection(collection) });
  } catch (error) {
    console.error('Get collection error:', error);
    return c.json({ error: 'Failed to fetch collection' }, 500);
  }
});

// Access collection with code
app.post("/make-server-66ce0d40/collections/access", async (c) => {
  try {
    const { code, password } = await c.req.json();

    if (!code) {
      return c.json({ error: 'Collection code is required' }, 400);
    }

    const collectionId = await kv.get(`collection:code:${code.toUpperCase()}`);
    if (!collectionId) {
      return c.json({ error: 'Invalid collection code' }, 404);
    }

    const collection = await kv.get(`collection:${collectionId}`);
    
    if (!await verifyCollectionPassword(collection, password)) {
      return c.json({ error: 'Invalid password' }, 403);
    }

    if (collection.password && !collection.passwordHash) {
      collection.passwordHash = await hashPassword(password);
      collection.password = null;
      collection.passwordProtected = true;
      await kv.set(`collection:${collectionId}`, collection);
    }

    return c.json({ collection: sanitizeCollection(collection) });
  } catch (error) {
    console.error('Access collection error:', error);
    return c.json({ error: 'Failed to access collection' }, 500);
  }
});

// Update collection
app.put("/make-server-66ce0d40/collections/:id", async (c) => {
  try {
    const collectionId = c.req.param('id');
    const { name, description, password, sessionId } = await c.req.json();
    const collection = await kv.get(`collection:${collectionId}`);

    if (!collection) {
      return c.json({ error: 'Collection not found' }, 404);
    }

    if (collection.sessionId !== sessionId) {
      return c.json({ error: 'Only the photographer can update this collection' }, 403);
    }

    const updatedCollection = {
      ...collection,
      name: name ?? collection.name,
      description: description ?? collection.description,
      passwordHash: password !== undefined
        ? (password ? await hashPassword(password) : null)
        : collection.passwordHash,
      password: null,
      passwordProtected: password !== undefined ? Boolean(password) : Boolean(collection.passwordProtected || collection.password || collection.passwordHash),
    };

    await kv.set(`collection:${collectionId}`, updatedCollection);

    return c.json({ collection: sanitizeCollection(updatedCollection) });
  } catch (error) {
    console.error('Update collection error:', error);
    return c.json({ error: 'Failed to update collection' }, 500);
  }
});

// Delete collection
app.delete("/make-server-66ce0d40/collections/:id", async (c) => {
  try {
    const collectionId = c.req.param('id');
    const sessionId = c.req.query('sessionId');
    const collection = await kv.get(`collection:${collectionId}`);

    if (!collection) {
      return c.json({ error: 'Collection not found' }, 404);
    }

    if (collection.sessionId !== sessionId) {
      return c.json({ error: 'Only the photographer can delete this collection' }, 403);
    }

    // Delete all photos in collection
    const photos = await kv.getByPrefix(`photo:${collectionId}:`);
    for (const photo of photos) {
      await supabase.storage.from(BUCKET_NAME).remove([photo.storagePath]);
      await kv.del(`photo:${collectionId}:${photo.id}`);
    }

    // Delete collection code mapping
    await kv.del(`collection:code:${collection.code}`);
    
    // Delete collection
    await kv.del(`collection:${collectionId}`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete collection error:', error);
    return c.json({ error: 'Failed to delete collection' }, 500);
  }
});

// ==================== PHOTO ROUTES ====================

// Upload photo
app.post("/make-server-66ce0d40/photos/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const collectionId = formData.get('collectionId') as string;
    const sessionId = formData.get('sessionId') as string;

    if (!file || !collectionId || !sessionId) {
      return c.json({ error: 'File, collectionId, and sessionId are required' }, 400);
    }

    const collection = await kv.get(`collection:${collectionId}`);
    if (!collection) {
      return c.json({ error: 'Collection not found' }, 404);
    }

    if (collection.sessionId !== sessionId) {
      return c.json({ error: 'Only the photographer can upload photos' }, 403);
    }

    if (!isValidImage(file)) {
      return c.json({ error: 'Only JPEG, PNG, WebP or GIF images up to 25 MB are allowed' }, 400);
    }

    const photoId = crypto.randomUUID();
    const fileExt = file.name.split('.').pop();
    const storagePath = `${collectionId}/${photoId}.${fileExt}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, await file.arrayBuffer(), {
        contentType: file.type,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return c.json({ error: 'Failed to upload photo' }, 500);
    }

    const { data: urlData } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN);

    const photo = {
      id: photoId,
      collectionId,
      name: file.name,
      storagePath,
      url: urlData?.signedUrl,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
      likes: 0,
    };

    await kv.set(`photo:${collectionId}:${photoId}`, photo);

    // Update collection photo count
    collection.photoCount = (collection.photoCount || 0) + 1;
    await kv.set(`collection:${collectionId}`, collection);

    return c.json({ photo });
  } catch (error) {
    console.error('Upload photo error:', error);
    return c.json({ error: 'Failed to upload photo' }, 500);
  }
});

// Get photos for a collection
app.get("/make-server-66ce0d40/collections/:id/photos", async (c) => {
  try {
    const collectionId = c.req.param('id');
    const collection = await kv.get(`collection:${collectionId}`);

    if (!collection) {
      return c.json({ error: 'Collection not found' }, 404);
    }

    const photos = await kv.getByPrefix(`photo:${collectionId}:`);

    // Refresh signed URLs if needed
    for (const photo of photos) {
      const { data: urlData } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(photo.storagePath, SIGNED_URL_EXPIRES_IN);
      photo.url = urlData?.signedUrl;
    }

    return c.json({ photos });
  } catch (error) {
    console.error('Get photos error:', error);
    return c.json({ error: 'Failed to fetch photos' }, 500);
  }
});

// Delete photo
app.delete("/make-server-66ce0d40/photos/:collectionId/:photoId", async (c) => {
  try {
    const collectionId = c.req.param('collectionId');
    const photoId = c.req.param('photoId');
    const sessionId = c.req.query('sessionId');

    const collection = await kv.get(`collection:${collectionId}`);
    if (!collection) {
      return c.json({ error: 'Collection not found' }, 404);
    }

    if (collection.sessionId !== sessionId) {
      return c.json({ error: 'Only the photographer can delete photos' }, 403);
    }

    const photo = await kv.get(`photo:${collectionId}:${photoId}`);
    if (!photo) {
      return c.json({ error: 'Photo not found' }, 404);
    }

    // Delete from storage
    await supabase.storage.from(BUCKET_NAME).remove([photo.storagePath]);

    // Delete from KV
    await kv.del(`photo:${collectionId}:${photoId}`);

    // Update collection photo count
    collection.photoCount = Math.max(0, (collection.photoCount || 0) - 1);
    await kv.set(`collection:${collectionId}`, collection);

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete photo error:', error);
    return c.json({ error: 'Failed to delete photo' }, 500);
  }
});

// ==================== COMMENT ROUTES ====================

// Add comment
app.post("/make-server-66ce0d40/comments", async (c) => {
  try {
    const { photoId, collectionId, text, userName } = await c.req.json();

    if (!photoId || !collectionId || !text || !userName) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const photo = await kv.get(`photo:${collectionId}:${photoId}`);
    if (!photo) {
      return c.json({ error: 'Photo not found' }, 404);
    }

    const commentId = crypto.randomUUID();

    const comment = {
      id: commentId,
      photoId,
      collectionId,
      userName,
      text,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`comment:${photoId}:${commentId}`, comment);

    return c.json({ comment });
  } catch (error) {
    console.error('Add comment error:', error);
    return c.json({ error: 'Failed to add comment' }, 500);
  }
});

// Get comments for a photo
app.get("/make-server-66ce0d40/photos/:photoId/comments", async (c) => {
  try {
    const photoId = c.req.param('photoId');
    const comments = await kv.getByPrefix(`comment:${photoId}:`);

    return c.json({ comments });
  } catch (error) {
    console.error('Get comments error:', error);
    return c.json({ error: 'Failed to fetch comments' }, 500);
  }
});

// ==================== LIKE ROUTES ====================

// Toggle like
app.post("/make-server-66ce0d40/photos/:photoId/like", async (c) => {
  try {
    const photoId = c.req.param('photoId');
    const { collectionId, liked, userId } = await c.req.json();

    if (!collectionId || !userId) {
      return c.json({ error: 'collectionId and userId are required' }, 400);
    }

    const photo = await kv.get(`photo:${collectionId}:${photoId}`);
    if (!photo) {
      return c.json({ error: 'Photo not found' }, 404);
    }

    const likeKey = `like:${photoId}:${userId}`;
    const existingLike = await kv.get(likeKey);

    if (liked && !existingLike) {
      await kv.set(likeKey, { photoId, collectionId, userId, createdAt: new Date().toISOString() });
      photo.likes = (photo.likes || 0) + 1;
    } else if (!liked && existingLike) {
      await kv.del(likeKey);
      photo.likes = Math.max(0, (photo.likes || 0) - 1);
    }

    await kv.set(`photo:${collectionId}:${photoId}`, photo);

    return c.json({ liked, likes: photo.likes });
  } catch (error) {
    console.error('Toggle like error:', error);
    return c.json({ error: 'Failed to toggle like' }, 500);
  }
});

Deno.serve(app.fetch);
