
const emptyState = {
  title: 'Our Projects',
  description:
    'We are preparing a collection of Braunwork projects to showcase our work in construction, modular cabinetry, and interior solutions. Check back soon for updates.',
}

function Projects() {
  return (
    <section id="projects" className="section-shell border-b border-[var(--line)] bg-[var(--bg-warm)]">
      <div className="container-shell">
        <div className="mb-12 max-w-3xl">
          <p className="eyebrow mb-4">Projects / Portfolio</p>
          <h2 className="section-title">
            Selected work and project highlights.
          </h2>
        </div>

        <div className="border border-[var(--line)] bg-[var(--panel)] p-8 text-center shadow-[var(--shadow-soft)] sm:p-12">
          <p className="eyebrow mb-4">Portfolio Coming Soon</p>

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
