import ImageKit from "@imagekit/nodejs";

const client = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

export default async function uploadFile(buffer, fileName = "image.jpg", folder = "products") {
  if (!process.env.IMAGEKIT_PRIVATE_KEY) throw new Error("ImageKit private key is not configured");
  return client.files.upload({
    file: buffer.toString("base64"),
    fileName,
    folder
  });
}