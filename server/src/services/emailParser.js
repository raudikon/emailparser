import { simpleParser } from 'mailparser';

export async function parseMailgunPayload(payload) {
  if (!payload) {
    throw new Error('Missing Mailgun payload');
  }

  if (payload['body-mime']) {
    // Raw MIME string present
    return parseMime(payload['body-mime']);
  }

  if (payload['body-html'] || payload['body-plain']) {
    return {
      text: payload['body-plain'] ?? '',
      html: payload['body-html'] ?? '',
      attachments: []
    };
  }

  throw new Error('Unsupported Mailgun payload format');
}

async function parseMime(mime) {
  const parsed = await simpleParser(mime);

  const imageAttachments = (parsed.attachments ?? [])
    .filter((attachment) => attachment.contentType?.startsWith('image/'))
    .map((attachment) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      content: attachment.content
    }));

  return {
    text: parsed.text ?? '',
    html: parsed.html ?? '',
    attachments: imageAttachments
  };
}
