function Process() {
  const steps = [
    {
      number: '01',
      title: 'Consultation',
      description: 'Understand the client\'s needs, goals, and project scope.',
    },
    {
      number: '02',
      title: 'Planning',
      description: 'Discuss the project requirements and plan the appropriate approach.',
    },
    {
      number: '03',
      title: 'Build',
      description: 'Carry out the agreed construction, fabrication, or improvement work.',
    },
    {
      number: '04',
      title: 'Finish',
      description: 'Complete the work with attention to quality and detail.',
    },
  ]

  return (
    <section id="process" className="section-shell border-b border-[var(--line)] bg-[var(--panel)]">
      <div className="container-shell">
        <div className="mb-12 max-w-3xl">
          <p className="eyebrow mb-4">Our Process</p>
          <h2 className="section-title">A clear, practical path from concept to completion.</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="reveal-card border border-[var(--line)] bg-[var(--bg-ivory)] p-6 sm:p-7"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brown)]">{step.number}</p>
              <h3 className="mt-4 text-2xl font-medium tracking-[-0.04em] text-[var(--charcoal)]">{step.title}</h3>
              <p className="mt-4 text-base leading-7 text-[var(--muted)]">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Process
