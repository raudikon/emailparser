import { supabaseAdmin } from '../lib/supabaseClient.js';

export async function listEmails(organizationId = null) {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  let query = supabaseAdmin
    .from('emails')
    .select(`
      id,
      sender,
      recipient,
      subject,
      received_at,
      raw_text,
      organization_id,
      parsed_content:parsed_email_content (
        text_content,
        image_urls,
        processed
      )
    `);

  // Filter by organization if provided
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  query = query.order('received_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function insertEmail({
  sender,
  recipient,
  subject,
  receivedAt,
  rawText,
  textContent,
  imageUrls,
  organizationId
}) {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  const { data: emailData, error: emailError } = await supabaseAdmin
    .from('emails')
    .insert({
      sender,
      recipient,
      subject,
      received_at: receivedAt,
      raw_text: rawText,
      organization_id: organizationId
    })
    .select()
    .single();

  if (emailError) {
    throw emailError;
  }

  const { error: parsedError } = await supabaseAdmin
    .from('parsed_email_content')
    .insert({
      email_id: emailData.id,
      text_content: textContent,
      image_urls: imageUrls ?? [],
      processed: true
    });

  if (parsedError) {
    throw parsedError;
  }

  return emailData;
}

export async function fetchEmailsForDateRange(startDate, endDate, organizationId = null) {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  let query = supabaseAdmin
    .from('emails')
    .select('*')
    .gte('received_at', startDate.toISOString())
    .lte('received_at', endDate.toISOString());

  // Filter by organization if provided
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  query = query.order('received_at', { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}
