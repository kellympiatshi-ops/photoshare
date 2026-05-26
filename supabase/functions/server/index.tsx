import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Create storage bucket on startup
const BUCKET_NAME = 'make-66ce0d40-photos';
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
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

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
      password: password || null,
      code,
      photographerName: photographerName || 'Photographe',
      sessionId,
      createdAt: new Date().toISOString(),
      photoCount: 0,
    };

    await kv.set(`collection:${collectionId}`, collection);
    await kv.set(`collection:code:${code}`, collectionId);

    return c.json({ collection });
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
    const userCollections = allCollections.filter((col: any) => 
      col.sessionId === sessionId && !col.id.includes(':code:')
    );

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

    return c.json({ collection });
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
    
    // Check password if required
    if (collection.password && collection.password !== password) {
      return c.json({ error: 'Invalid password' }, 403);
    }

    return c.json({ collection });
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
      password: password !== undefined ? password : collection.password,
    };

    await kv.set(`collection:${collectionId}`, updatedCollection);

    return c.json({ collection: updatedCollection });
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

    // Create signed URL (valid for 1 year)
    const { data: urlData } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 31536000);

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
        .createSignedUrl(photo.storagePath, 31536000);
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
    const { collectionId, liked } = await c.req.json();

    const photo = await kv.get(`photo:${collectionId}:${photoId}`);
    if (!photo) {
      return c.json({ error: 'Photo not found' }, 404);
    }

    // Update likes count
    if (liked) {
      photo.likes = (photo.likes || 0) + 1;
    } else {
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
