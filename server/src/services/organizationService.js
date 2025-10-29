import { supabaseAdmin } from '../lib/supabaseClient.js';

/**
 * Create a new organization
 */
export async function createOrganization({ name, recipientEmail }) {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  // Normalize email to lowercase for consistency
  const normalizedEmail = recipientEmail.toLowerCase().trim();

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .insert({
      name,
      recipient_email: normalizedEmail
    })
    .select()
    .single();

  if (error) {
    // Check if it's a unique constraint violation
    if (error.code === '23505') {
      throw new Error('This email address is already taken');
    }
    throw error;
  }

  return data;
}

/**
 * Get organization by recipient email (case-insensitive)
 */
export async function getOrganizationByRecipient(recipientEmail) {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  const normalizedEmail = recipientEmail.toLowerCase().trim();
  console.log(`[OrgService] Looking up organization with email: "${normalizedEmail}"`);

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .ilike('recipient_email', normalizedEmail)
    .single();

  console.log(`[OrgService] Query result - data:`, data, 'error:', error?.message || 'none');

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    throw error;
  }

  return data;
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(organizationId) {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data;
}

/**
 * Get user's organization
 */
export async function getUserOrganization(userId) {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select(`
      organization_id,
      role,
      organizations (
        id,
        name,
        recipient_email,
        created_at
      )
    `)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return {
    ...data.organizations,
    userRole: data.role
  };
}

/**
 * Assign user to organization
 */
export async function assignUserToOrganization({ userId, organizationId, role = 'member' }) {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .insert({
      user_id: userId,
      organization_id: organizationId,
      role
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('User already assigned to an organization');
    }
    throw error;
  }

  return data;
}

/**
 * Check if recipient email is available
 */
export async function isRecipientEmailAvailable(recipientEmail) {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  const normalizedEmail = recipientEmail.toLowerCase().trim();

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .ilike('recipient_email', normalizedEmail)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data === null;
}

/**
 * List all organizations (admin use)
 */
export async function listOrganizations() {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

/**
 * Get organization owner's email
 */
export async function getOrganizationOwnerEmail(organizationId) {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select(`
      user_id,
      role
    `)
    .eq('organization_id', organizationId)
    .eq('role', 'owner')
    .single();

  if (error) {
    console.error(`Failed to get owner for organization ${organizationId}:`, error);
    return null;
  }

  if (!data) {
    return null;
  }

  // Get user's email from auth.users
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(data.user_id);

  if (userError || !userData.user) {
    console.error(`Failed to get user email for ${data.user_id}:`, userError);
    return null;
  }

  return userData.user.email;
}
