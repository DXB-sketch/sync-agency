import { Eyebrow } from "sync-agency";

export const Default = () => <Eyebrow text="The Depop Blueprint" />;

export const AboveSectionTitle = () => (
  <div style={{ maxWidth: 520 }}>
    <Eyebrow text="How it works" />
    <h2 className="section-title" style={{ marginTop: 14 }}>
      Built to print profit
    </h2>
  </div>
);
