export const MAX_PROFILE_IMAGE_SIZE = 2 * 1024 * 1024;
export const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PROFILE_IMAGE_PATH = "/api/profile-images/";

export function profileImageError(file: File): string | null {
  if (!file.size) return "Le fichier image est vide.";
  if (file.size > MAX_PROFILE_IMAGE_SIZE)
    return "L'image ne doit pas dépasser 2 Mo.";
  if (!PROFILE_IMAGE_TYPES.includes(file.type))
    return "Seuls les formats JPEG, PNG et WEBP sont acceptés.";
  return null;
}

export function profileImageKey(
  image: string | null,
  endpoint: string,
  bucket: string,
): string | null {
  if (!image) return null;
  if (image.startsWith(PROFILE_IMAGE_PATH)) {
    const filename = image.slice(PROFILE_IMAGE_PATH.length);
    return /^[\da-f-]{36}\.(jpg|png|webp)$/.test(filename)
      ? `profiles/${filename}`
      : null;
  }
  // Only delete legacy objects belonging to our exact storage location.
  const prefix = `${endpoint.replace(/\/+$/, "")}/${bucket}/profiles/`;
  if (!image.startsWith(prefix)) return null;
  const filename = image.slice(prefix.length);
  return filename && !/[/?#\\]/.test(filename) ? `profiles/${filename}` : null;
}
