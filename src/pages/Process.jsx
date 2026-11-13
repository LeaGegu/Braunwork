
function Process() {
  const steps = [
    {
      number: '01',
      title: 'Consultation',
      description:
        'We discuss your ideas, requirements, preferred style, budget, and project goals to understand what you need.',
    },
    {
      number: '02',
      title: 'Planning & Design',
      description:
        'We develop the project approach, discuss materials and specifications, and prepare the necessary designs and plans.',
    },
    {
      number: '03',
      title: 'Execution',
      description:
        'Our team carries out the agreed construction, fabrication, or installation work with attention to detail and quality.',
    },
    {
      number: '04',
      title: 'Completion & Turnover',
      description:
        'We complete the project, review the finished work, and prepare the space for handover.',
    },
  ]

  return (
    <section id="process" className="section-shell border-b border-[var(--line)] bg-[var(--panel)]">
      <div className="container-shell">
        <div className="mb-12 max-w-3xl">
          <p className="eyebrow mb-4">Our Process</p>
          <h2 className="section-title">
            A clear, practical path from concept to completion.
          </h2>
          <p className="mt-5 body-copy">
            Every project starts with understanding your needs and ends with
            delivering a space built with care and purpose.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="reveal-card border border-[var(--line)] bg-[var(--bg-ivory)] p-6 sm:p-7"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brown)]">
                {step.number}
              </p>
              <h3 className="mt-4 text-2xl font-medium tracking-[-0.04em] text-[var(--charcoal)]">
                {step.title}
              </h3>
              <p className="mt-4 text-base leading-7 text-[var(--muted)]">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Process
