import { apiRequest } from "./api.js";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxFileSize = 5 * 1024 * 1024;

export function validateProductImage(file) {
  if (!allowedTypes.includes(file.type)) return "Choose a JPEG, PNG, or WEBP image.";
  if (file.size > maxFileSize) return "Image must be 5 MB or smaller.";
  return "";
}

export async function uploadProductImage(file, token) {
  const auth = await apiRequest("/upload/auth", { token });
  if (!auth.publicKey) throw new Error("ImageKit public key is not configured on the backend.");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", file.name);
  formData.append("publicKey", auth.publicKey);
  formData.append("signature", auth.signature);
  formData.append("expire", String(auth.expire));
  formData.append("token", auth.token);
  formData.append("folder", "products");

  let response;
  try {
    response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error("Could not reach ImageKit. Check the browser connection and ImageKit configuration.");
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "ImageKit could not upload this image.");
  if (!result.url || !result.fileId) throw new Error("ImageKit returned an incomplete upload response.");

  return { imageUrl: result.url, imageFileId: result.fileId };
}
