import { supabaseAdmin } from '../lib/supabaseClient.js';

export async function listEmails() {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseAdmin
    .from('emails')
    .select(`
      id,
      sender,
      recipient,
      subject,
      received_at,
      raw_text,
      parsed_content:parsed_email_content (
        text_content,
        image_urls,
        processed
      )
    `)
    .order('received_at', { ascending: false });

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
  imageUrls
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
      raw_text: rawText
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

export async function fetchEmailsForDateRange(startDate, endDate) {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseAdmin
    .from('emails')
    .select('*')
    .gte('received_at', startDate.toISOString())
    .lte('received_at', endDate.toISOString())
    .order('received_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}
