const cards = [
  ["Scan", "Index OneDrive metadata and keep it current with delta sync."],
  ["Duplicates", "Verify exact duplicates before any recycle-bin action."],
  ["Categories", "Classify thumbnails locally and review before album sync."],
  ["Private by default", "Runs in Docker on localhost; Tailscale Serve is optional."],
] as const;

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">Qeo OneDrive Photo Cleaner</span>
        <h1>Clean a huge photo library without giving up control.</h1>
        <p>Local-first indexing, duplicate verification, and photo categorization for OneDrive Personal. Nothing is deleted without review.</p>
      </section>
      <section className="grid">
        {cards.map(([title, body]) => (
          <article className="card" key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
