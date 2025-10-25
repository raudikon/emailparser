import { Anthropic } from '@anthropic-ai/sdk';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-3-haiku-20240307';
const anthropic = process.env.CLAUDE_API_KEY
  ? new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })
  : null;

export async function generateInstagramCaptions({ emails, date }) {
  if (!anthropic) {
    throw new Error('Claude client not configured');
  }

  const emailSummaries = emails.map((email, index) => {
    const trimmed = (email.raw_text ?? '').slice(0, 2000);
    return `Email ${index + 1}:
Subject: ${email.subject ?? 'N/A'}
Sender: ${email.sender ?? 'N/A'}
Body:
${trimmed}`;
  }).join('\n\n');

  const prompt = `You are a social media manager for a school. Based on the forwarded emails below, craft three engaging Instagram captions that parents and students will love. Each caption must be concise (max 60 words), upbeat, and mention the key details (dates, times, people) from the emails when relevant. If no image suggestion is obvious, say "Suggested image: none".

Daily context date: ${date.toISOString().split('T')[0]}

Forwarded emails:
${emailSummaries}

Respond in valid JSON with the shape:
{
  "captions": [
    { "text": "Caption text...", "suggested_image": "Optional short suggestion" },
    ...
  ]
}

Make sure there are exactly three captions.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    temperature: 0.7,
    system: 'You write ready-to-post Instagram captions for schools.',
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const messageContent = response.content?.[0]?.text ?? '{}';

  try {
    const parsed = JSON.parse(messageContent);
    if (!Array.isArray(parsed.captions) || parsed.captions.length === 0) {
      throw new Error('Claude response missing captions array');
    }

    return parsed.captions.map((caption) => ({
      caption_text: caption.text,
      image_url: caption.suggested_image && caption.suggested_image.toLowerCase() !== 'none'
        ? caption.suggested_image
        : null,
      created_at: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Failed to parse Claude response', error);
    throw new Error('Claude response parsing failed');
  }
}
