import { supabaseAdmin } from '../lib/supabaseClient.js';

export async function listDailyPosts(limit = 30) {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseAdmin
    .from('ai_generated_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function storeGeneratedPosts(posts) {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  if (!Array.isArray(posts) || posts.length === 0) {
    return [];
  }

  const payload = posts.map((post) => ({
    caption_text: post.caption_text,
    image_url: post.image_url ?? null,
    created_at: post.created_at ?? new Date().toISOString()
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
