import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { s3Client } from "@/lib/storage";
import {
  MAX_PROFILE_IMAGE_SIZE,
  PROFILE_IMAGE_PATH,
  PROFILE_IMAGE_TYPES,
  profileImageKey,
} from "@/lib/profile-image";

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const { filename } = await context.params;
  const image = `${PROFILE_IMAGE_PATH}${filename}`;
  const key = profileImageKey(image, "", "");
  if (!key) return new Response(null, { status: 404 });
  // Avatars are visible to their owner and fellow project members only.
  const owner = await prisma.user.findFirst({
    where: {
      image,
      OR: [
        { id: session.user.id },
        {
          memberships: {
            some: {
              project: { members: { some: { userId: session.user.id } } },
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  if (!owner) return new Response(null, { status: 404 });
  try {
    const object = await s3Client.send(
      new GetObjectCommand({ Bucket: process.env.MINIO_BUCKET, Key: key }),
    );
    if (
      !object.Body ||
      !PROFILE_IMAGE_TYPES.includes(object.ContentType ?? "") ||
      !object.ContentLength ||
      object.ContentLength > MAX_PROFILE_IMAGE_SIZE
    ) {
      return new Response(null, { status: 404 });
    }
    return new Response(
      new Uint8Array(await object.Body.transformToByteArray()),
      {
        headers: {
          "Content-Type": object.ContentType!,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    console.error("Unable to load profile image", error);
    return new Response(null, { status: 502 });
  }
}
