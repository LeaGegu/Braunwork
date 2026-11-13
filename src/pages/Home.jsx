
function Home() {
  return (
    <div id="home">
      <section className="relative overflow-hidden border-b border-[var(--line)] bg-[var(--bg-warm)]">
        <div className="container-shell grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div>
            <p className="eyebrow mb-6">Braunwork Builders Corporation</p>

            <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.06em] text-[var(--charcoal)] sm:text-5xl lg:text-7xl">
              Built on experience.
              <span className="mt-2 block text-[var(--brown)]">
                Driven by craft.
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-8 text-[var(--muted)]">
              Braunwork Builders Corporation creates residential construction,
              modular cabinetry, and interior fit-out solutions rooted in
              craftsmanship, practical thinking, and dependable execution.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a href="#contact" className="btn-primary">
                Request a Consultation
              </a>

              <a href="#projects" className="btn-secondary">
                View Projects
              </a>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.68rem] uppercase tracking-[0.18em] text-[var(--muted)]">
              <span>Dasmariñas City</span>
              <span>•</span>
              <span>Cavite</span>
              <span>•</span>
              <span>Philippines</span>
              <span>•</span>
              <span>Since 2019</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-8 top-10 h-40 w-40 rounded-full bg-[var(--taupe)]/30 blur-3xl" />
            <div className="absolute -right-8 bottom-8 h-48 w-48 rounded-full bg-[var(--greige)]/50 blur-3xl" />

            <div className="relative overflow-hidden border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-soft)]">
              <div className="h-[480px] w-full bg-[linear-gradient(135deg,#d8d0c7,#7a5f51)] p-6 sm:p-8">
                <div className="flex h-full flex-col justify-between border border-[rgba(255,255,255,0.25)] bg-[rgba(39,37,34,0.18)] p-6 backdrop-blur-[2px]">
                  <div className="flex items-center justify-between text-[var(--bg-ivory)]">
                    <span className="text-xs uppercase tracking-[0.24em]">
                      Braunwork
                    </span>
                    <span className="text-xs uppercase tracking-[0.22em]">
                      Since 2019
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div className="h-px w-16 bg-[rgba(245,241,235,0.7)]" />

                    <p className="max-w-xs text-3xl font-medium leading-tight text-[var(--bg-ivory)]">
                      Residential construction and interior spaces built for
                      everyday life.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
