// One-off import of the Internal/Catalogue_Images_All_Items photo folders into the
// product catalogue, so admins can assign them to clients from /admin/products.
//
// Signs in as an admin (normal RLS applies — needs the product_catalog admin policy
// from supabase/migrations/20261017000000_product_catalog_admin_access.sql), uploads
// every photo to the public product-images bucket, then writes product_catalog rows.
// Six items were already quick-added to a couple of stores on 2026-10-15 under short
// names; those rows (catalogue + store copies) are renamed and given the full photo
// set instead of being duplicated, keeping the price the clients already have.
//
// Run from the repo root in your own terminal (credentials stay out of chat logs):
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... node --env-file=.env scripts/import-internal-catalogue.mjs
// Safe to re-run: uploads overwrite, rows are matched by name and price.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = "Internal/Catalogue_Images_All_Items";
const TAGS = "#Y2KFashion #y2k #vintage #streetwear #hoodies";

// price = what the member pays; listing = 2.5–3x price; discount = 30–45% off
// listing while keeping the member's profit at least 50% of what they paid.
const ITEMS = [
  { folder: "AE Pink Acid Washed Crop Zip Up Hoodie", name: "AE Pink Acid Washed Crop Zip Up Hoodie", price: 24, listing: 66, discount: 42,
    description: "American Eagle pink acid wash cropped zip up hoodie. Faded vintage wash, ribbed cuffs and hem." },
  { folder: "Aeropastle White 87", name: "Aeropostale White 87 Zip Up Hoodie", price: 21, listing: 59, discount: 37,
    description: "Cream Aeropostale zip up hoodie with the big navy 87 and arched logo print." },
  { folder: "Black Studded Pocket Furlined Hood", name: "Black Studded Pocket Fur Lined Hoodie", price: 27, listing: 78, discount: 48,
    description: "Black zip up hoodie with faux fur lined hood, pom pom drawstrings, cross zip pull and studded pockets." },
  { folder: "Blue Aeropostale New York 1987 Jumper", name: "Blue Aeropostale New York 1987 Jumper", oldName: "Aeropostale Navy New York", price: 18.5, listing: 54, discount: 35,
    description: "Navy Aeropostale New York 1987 zip up with sherpa lined hood, distressed print and lace detailing." },
  { folder: "Bluish Black Abercrombie", name: "Bluish Black Abercrombie Fur Lined Hoodie", oldName: "Grey Abercrombie", price: 23, listing: 62, discount: 39,
    description: "Washed blue-black Abercrombie & Fitch zip up hoodie with fur lined hood and felt applique lettering." },
  { folder: "Brown Aeropastle 39-06", name: "Brown Aeropostale 39-06 Hoodie", oldName: "Brown Aeropostale", price: 21, listing: 57, discount: 36,
    description: "Tan brown Aeropostale 39-06 pullover hoodie with felt lettering and kangaroo pocket." },
  { folder: "Brown Hollister Sherpa", name: "Brown Hollister Sherpa Zip Up Hoodie", price: 26, listing: 72, discount: 46,
    description: "Chocolate brown Hollister zip up hoodie with sherpa lined hood and felt chest logo." },
  { folder: "Dark Blue Fur Lined Abercrombie", name: "Navy Abercrombie 1892 Fur Hood Zip Up", price: 28, listing: 79, discount: 49,
    description: "Navy Abercrombie & Fitch 1892 zip up hoodie with faux fur trim hood and felt lettering." },
  { folder: "Grey Abercrombie 1892", name: "Grey Abercrombie 1892 Zip Up Hoodie", price: 20, listing: 55, discount: 34,
    description: "Heather grey Abercrombie 1892 zip up hoodie with burgundy felt script and sherpa lined hood." },
  { folder: "Grey Hollister Sherpa Hood", name: "Grey Hollister Fur Hood Zip Up", price: 25, listing: 70, discount: 44,
    description: "Charcoal grey Hollister Southern California zip up hoodie with faux fur trim and sherpa lined hood." },
  { folder: "Pink 1982", name: "Pink 1982 Fur Hood Zip Up", oldName: "Pink 1982", price: 21.5, listing: 59, discount: 37,
    description: "Baby pink 1982 zip up hoodie with faux fur trim hood and New York sleeve patch." },
  { folder: "Red Aeropostale White Fur Hood", name: "Red Aeropostale Sherpa Hood Zip Up", oldName: "Red Aeropostale", price: 25, listing: 69, discount: 43,
    description: "Red Aeropostale zip up hoodie with white sherpa lined hood and tonal script print." },
  { folder: "Salmon Pink Aeropastle 1987", name: "Pink Aeropostale 1987 Sherpa Zip Up", oldName: "Pink Aeropostale", price: 22, listing: 62, discount: 39,
    description: "Hot pink Aeropostale 1987 zip up hoodie with sherpa lined hood and tonal print." },
  { folder: "Victoria Secret Blue A-Lister", name: "Victoria's Secret Navy A-Lister Zip Up", price: 19, listing: 55, discount: 34,
    description: "Navy Victoria's Secret A-Lister zip up hoodie with sherpa lined hood and embroidered crest." },
  { folder: "White Abercrombie Fur", name: "Cream Abercrombie New York Fur Hood Zip Up", price: 29, listing: 80, discount: 50,
    description: "Cream Abercrombie & Fitch New York zip up hoodie with faux fur lined hood and navy felt lettering." },
];

const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Missing env — run with --env-file=.env and set ADMIN_EMAIL / ADMIN_PASSWORD.");
  process.exit(1);
}

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);
const { error: authErr } = await supabase.auth.signInWithPassword({
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});
if (authErr) throw authErr;

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const key = (s) => s.trim().toLowerCase();

for (const item of ITEMS) {
  const dir = path.join(ROOT, item.folder);
  const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  const urls = [];
  for (const file of files) {
    const objectPath = `catalogue/${slug(item.name)}/${file}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(objectPath, await readFile(path.join(dir, file)), {
        contentType: file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
        upsert: true,
      });
    if (error) throw new Error(`${item.name}: upload ${file} failed — ${error.message}`);
    urls.push(supabase.storage.from("product-images").getPublicUrl(objectPath).data.publicUrl);
  }

  const fields = {
    name: item.name,
    description: `${item.description} ${TAGS}`,
    image_url: urls[0],
    image_urls: urls,
    listing_price: item.listing,
    discount_price: item.discount,
    category: "apparel",
  };

  if (item.oldName) {
    // Store copies keep their price and Stripe link; only the listing details change.
    const { error: prodErr } = await supabase
      .from("products")
      .update(fields)
      .in("name", [item.oldName, `${item.oldName} `, item.name]);
    if (prodErr) throw new Error(`${item.name}: store copies — ${prodErr.message}`);
    const { error: catErr } = await supabase
      .from("product_catalog")
      .update({ ...fields, key: key(item.name), active: true })
      .in("key", [key(item.oldName), key(item.name)])
      .eq("price", item.price);
    if (catErr) throw new Error(`${item.name}: catalogue — ${catErr.message}`);
  } else {
    const { error: catErr } = await supabase
      .from("product_catalog")
      .upsert({ ...fields, key: key(item.name), price: item.price, active: true }, { onConflict: "key,price" });
    if (catErr) throw new Error(`${item.name}: catalogue — ${catErr.message}`);
  }
  console.log(`✓ ${item.name} — ${urls.length} photos, $${item.price} → list $${item.listing} / discount $${item.discount}`);
}

await supabase.auth.signOut();
console.log("Done.");
