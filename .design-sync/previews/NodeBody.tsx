import { NodeBody } from "sync-agency";

const lesson = `Welcome to **Phase 1 — Store Setup**. Before you list anything, your storefront needs to look established.

1. Pick your username with the **Y2k[YourName]** convention
2. Upload a clean profile photo and banner
3. Write a bio that mentions *fast AU shipping*

> Sellers with a complete profile convert around three times better in the first week.

\`\`\`copy
Y2kDexter — vintage & Y2K pieces · AU shipped · new drops weekly
\`\`\`

Once your profile is live, move on to sourcing your first six products.`;

export const LessonContent = () => (
  <div style={{ maxWidth: 560 }}>
    <NodeBody markdown={lesson} />
  </div>
);
