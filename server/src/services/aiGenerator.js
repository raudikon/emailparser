import { Anthropic } from '@anthropic-ai/sdk';

// Use vision-capable model - Claude 3 Opus has excellent vision capabilities
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5';
const anthropic = process.env.CLAUDE_API_KEY
  ? new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })
  : null;

/**
 * Generate Instagram captions by having Claude review images and email content
 * Claude will select the best 3-5 image+caption combinations from all emails
 */
export async function generateInstagramCaptions({ emails, date }) {
  if (!anthropic) {
    throw new Error('Claude client not configured');
  }

  if (!emails || emails.length === 0) {
    return [];
  }

  console.log(`[AI] Using Claude model: ${CLAUDE_MODEL}`);

  // Build content array with images and text for Claude to review
  const contentBlocks = [];

  // Add intro text
  contentBlocks.push({
    type: 'text',
    text: `You are a social media manager for a school. Today's date is ${date.toISOString().split('T')[0]}.

You will review ${emails.length} emails with images from today. Each email may contain multiple images. Your task is to:

1. Review all the images and their associated email content
2. Select the 3-5 BEST image+caption combinations that would work great for Instagram
3. For each selected image, write an engaging Instagram caption (max 60 words, upbeat, mention key details)

Focus on images that are:
- Visually appealing and clear
- Show engaging activities or moments
- Would resonate with parents and students

Here are the emails with their images:\n\n`
  });

  // Add each email with its images
  emails.forEach((email, emailIndex) => {
    // Add email context
    contentBlocks.push({
      type: 'text',
      text: `--- Email ${emailIndex + 1} ---
Subject: ${email.subject ?? 'No subject'}
From: ${email.sender ?? 'Unknown'}
Text content: ${(email.textContent ?? '').slice(0, 1500)}

Images from this email:`
    });

    // Add each image from this email
    email.imageUrls.forEach((imageUrl, imageIndex) => {
      // Check if it's a base64 data URL or HTTP(S) URL
      const base64Matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);

      if (base64Matches) {
        // Handle base64 data URLs (legacy format)
        const mediaType = base64Matches[1];
        const base64Data = base64Matches[2];

        // Log image size for debugging
        const sizeInMB = (base64Data.length * 0.75) / (1024 * 1024); // base64 is ~1.33x larger than binary
        console.log(`[AI] Image ${emailIndex + 1}-${imageIndex + 1}: ${sizeInMB.toFixed(2)}MB (base64)`);

        // Anthropic's API has limits - skip images over 5MB
        if (sizeInMB > 5) {
          console.warn(`[AI] Skipping image ${emailIndex + 1}-${imageIndex + 1}: too large (${sizeInMB.toFixed(2)}MB)`);
          return;
        }

        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data
          }
        });
      } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        // Handle HTTP(S) URLs (Supabase Storage)
        console.log(`[AI] Image ${emailIndex + 1}-${imageIndex + 1}: ${imageUrl.substring(0, 80)}... (URL)`);

        contentBlocks.push({
          type: 'image',
          source: {
            type: 'url',
            url: imageUrl
          }
        });
      } else {
        console.warn(`[AI] Skipping image ${emailIndex + 1}-${imageIndex + 1}: unsupported format`);
        return;
      }

      contentBlocks.push({
        type: 'text',
        text: `[This is image ${imageIndex + 1} of ${email.imageUrls.length} from Email ${emailIndex + 1}]\n`
      });
    });

    contentBlocks.push({
      type: 'text',
      text: '\n'
    });
  });

  // Add instructions for response format
  contentBlocks.push({
    type: 'text',
    text: `\n\nNow, select the 3-5 best image+caption combinations. Respond in valid JSON with this exact shape:
{
  "selections": [
    {
      "email_index": 0,
      "image_index": 0,
      "caption": "Your engaging Instagram caption here...",
      "reasoning": "Brief explanation of why this image works well"
    }
  ]
}

The email_index and image_index are 0-based (Email 1 = index 0, first image = index 0).
Make sure to pick the most visually appealing and engaging combinations.`
  });

  // Retry logic for overloaded errors
  let response;
  let retries = 3;
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[AI] Sending request to Claude (attempt ${i + 1}/${retries})...`);
      response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        temperature: 0.7,
        system: 'You are an expert social media manager for schools. You have a great eye for selecting engaging photos and writing compelling Instagram captions.',
        messages: [
          {
            role: 'user',
            content: contentBlocks
          }
        ]
      });
      break; // Success, exit retry loop
    } catch (error) {
      lastError = error;
      console.error(`[AI] Attempt ${i + 1} failed:`, error.message);

      // If it's an overloaded error and we have retries left, wait and retry
      if (error.status === 529 && i < retries - 1) {
        const waitTime = (i + 1) * 2000; // 2s, 4s, 6s
        console.log(`[AI] Claude overloaded, retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error; // No more retries or different error
      }
    }
  }

  if (!response) {
    throw lastError || new Error('Failed to get response from Claude');
  }

  const messageContent = response.content?.[0]?.text ?? '{}';

  try {
    // Strip markdown code fences if present (```json ... ```)
    let jsonString = messageContent.trim();
    if (jsonString.startsWith('```')) {
      // Remove opening fence (```json or ```JSON or just ```)
      jsonString = jsonString.replace(/^```(?:json|JSON)?\n?/, '');
      // Remove closing fence
      jsonString = jsonString.replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed.selections) || parsed.selections.length === 0) {
      console.warn('Claude returned no selections, using fallback');
      return [];
    }

    // Map Claude's selections back to actual email IDs and image URLs
    const captions = parsed.selections.map((selection) => {
      const email = emails[selection.email_index];
      if (!email) {
        console.warn(`Invalid email_index ${selection.email_index}`);
        return null;
      }

      const imageUrl = email.imageUrls[selection.image_index];
      if (!imageUrl) {
        console.warn(`Invalid image_index ${selection.image_index} for email ${selection.email_index}`);
        return null;
      }

      return {
        caption_text: selection.caption,
        email_id: email.id,
        source_image_url: imageUrl,
        created_at: new Date().toISOString()
      };
    }).filter(Boolean); // Remove any null entries

    console.log(`Generated ${captions.length} captions from ${emails.length} emails`);
    return captions;
  } catch (error) {
    console.error('Failed to parse Claude response:', error);
    console.error('Response was:', messageContent);
    throw new Error('Claude response parsing failed');
  }
}
