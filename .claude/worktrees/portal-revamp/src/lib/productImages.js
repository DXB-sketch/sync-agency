import { supabase } from "./supabase";

// All images for a product, oldest schema (single image_url) included.
export function productImages(p) {
  if (p.image_urls?.length) return p.image_urls;
  return p.image_url ? [p.image_url] : [];
}

// Uploads each file to the product-images bucket and returns the public URLs.
export async function uploadProductImages(files, folder) {
  const urls = [];
  for (const [i, file] of [...(files ?? [])].entries()) {
    const path = `${folder}/${Date.now()}-${i}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, { contentType: file.type });
    if (error) throw error;
    urls.push(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
  }
  return urls;
}
