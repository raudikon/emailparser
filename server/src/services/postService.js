import { supabaseAdmin } from '../lib/supabaseClient.js';

export async function listDailyPosts(organizationId = null, limit = 30) {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  let query = supabaseAdmin
    .from('ai_generated_posts')
    .select('*');

  // Filter by organization if provided
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  query = query
    .order('created_at', { ascending: false })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function storeGeneratedPosts(posts, organizationId = null) {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  if (!Array.isArray(posts) || posts.length === 0) {
    return [];
  }

  const payload = posts.map((post) => ({
    caption_text: post.caption_text,
    email_id: post.email_id ?? null,
    source_image_url: post.source_image_url ?? null,
    // Keep image_url for backward compatibility
    image_url: post.image_url ?? null,
    suggested_image: post.suggested_image ?? null,
    created_at: post.created_at ?? new Date().toISOString(),
    organization_id: organizationId
  }));

  const { data, error } = await supabaseAdmin
    .from('ai_generated_posts')
    .insert(payload)
    .select();

  if (error) {
    throw error;
  }

  return data ?? [];
}
