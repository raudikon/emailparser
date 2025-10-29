import { supabaseAdmin } from '../lib/supabaseClient.js';
import crypto from 'crypto';

const BUCKET_NAME = 'email-images';

/**
 * Initialize the storage bucket if it doesn't exist
 */
export async function initializeStorage() {
  if (!supabaseAdmin) {
    console.warn('[Storage] Supabase not configured, skipping storage initialization');
    return false;
  }

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();

    if (listError) {
      console.error('[Storage] Failed to list buckets:', listError);
      return false;
    }

    const bucketExists = buckets.some(bucket => bucket.name === BUCKET_NAME);

    if (!bucketExists) {
      // Create bucket with public access
      const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 10485760 // 10MB
      });

      if (createError) {
        console.error('[Storage] Failed to create bucket:', createError);
        return false;
      }

      console.log(`[Storage] Created bucket: ${BUCKET_NAME}`);
    }

    return true;
  } catch (error) {
    console.error('[Storage] Storage initialization failed:', error);
    return false;
  }
}

/**
 * Upload an image to Supabase Storage
 * @param {Buffer} imageBuffer - The image data as a Buffer
 * @param {string} contentType - MIME type (e.g., 'image/jpeg', 'image/png')
 * @param {string} organizationId - Organization ID for organizing files
 * @returns {Promise<string>} - Public URL of the uploaded image
 */
export async function uploadImage(imageBuffer, contentType, organizationId) {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured');
  }

  // Generate unique filename
  const hash = crypto.createHash('md5').update(imageBuffer).digest('hex');
  const extension = contentType.split('/')[1] || 'jpg';
  const filename = `${organizationId}/${Date.now()}-${hash}.${extension}`;

  // Upload to storage
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(filename, imageBuffer, {
      contentType,
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filename);

  return publicUrl;
}

/**
 * Convert base64 data URL to buffer and extract content type
 * @param {string} dataUrl - Data URL (e.g., 'data:image/jpeg;base64,...')
 * @returns {Object} - { buffer: Buffer, contentType: string }
 */
export function parseDataUrl(dataUrl) {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!matches) {
    throw new Error('Invalid data URL format');
  }

  const contentType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  return { buffer, contentType };
}
