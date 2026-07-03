import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Private S3 storage for gallery assets + exported files. Credentials come from
// the default AWS provider chain (the EC2/ECS instance role) — no static keys.
// Objects are never public; access is always via short-TTL presigned URLs.

const PRESIGN_TTL = Number(process.env.S3_PRESIGN_TTL ?? 900); // 15 min

let client: S3Client | null = null;

export function s3(): S3Client {
  if (!client) {
    client = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
  }
  return client;
}

export function bucket(): string {
  const b = process.env.AWS_BUCKET_NAME;
  if (!b) throw new Error("Missing required env var AWS_BUCKET_NAME");
  return b;
}

export function isS3Configured(): boolean {
  return Boolean(process.env.AWS_BUCKET_NAME && process.env.AWS_REGION);
}

/** Canonical (non-presigned) object URL — stored for record-keeping only;
 *  actual reads always go through a fresh presigned URL since the bucket is
 *  private. */
export function publicUrl(key: string): string {
  return `https://${bucket()}.s3.${process.env.AWS_REGION ?? "us-east-1"}.amazonaws.com/${key}`;
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/** Presigned GET URL — used for download + canvas-safe image rendering. */
export function presignGet(key: string, ttl = PRESIGN_TTL): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: ttl,
  });
}

/** Presigned PUT URL — lets the browser upload bytes straight to S3. */
export function presignPut(
  key: string,
  contentType: string,
  ttl = PRESIGN_TTL
): Promise<string> {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn: ttl }
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function listPrefix(prefix: string): Promise<string[]> {
  const out: string[] = [];
  let token: string | undefined;
  do {
    const res = await s3().send(
      new ListObjectsV2Command({
        Bucket: bucket(),
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    for (const o of res.Contents ?? []) if (o.Key) out.push(o.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}
