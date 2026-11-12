const emptyState = {
  title: 'Project portfolio coming soon',
  description:
    'Verified Braunwork project details are not yet available in the current source materials. This page remains ready for official project entries without presenting placeholder work as actual company projects.',
}

function Projects() {
  return (
    <section id="projects" className="section-shell border-b border-[var(--line)] bg-[var(--bg-warm)]">
      <div className="container-shell">
        <div className="mb-12 max-w-3xl">
          <p className="eyebrow mb-4">Projects / Portfolio</p>
          <h2 className="section-title">Selected work and project highlights.</h2>
        </div>

        <div className="border border-[var(--line)] bg-[var(--panel)] p-8 text-center shadow-[var(--shadow-soft)] sm:p-12">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center border border-[var(--charcoal)] bg-[var(--charcoal)] text-xl text-[var(--bg-ivory)]">
            ✓
          </div>
          <h3 className="text-3xl font-medium tracking-[-0.04em] text-[var(--charcoal)]">
            {emptyState.title}
          </h3>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">
            {emptyState.description}
          </p>
          <a href="#contact" className="btn-primary mt-8">
            Discuss a Project
          </a>
        </div>
      </div>
    </section>
  )
}

export default Projects
