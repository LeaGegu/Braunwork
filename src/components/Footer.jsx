function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[var(--line)] bg-[var(--charcoal)] text-[var(--bg-ivory)]">
      <div className="container-shell grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-[rgba(245,241,235,0.4)] bg-[rgba(245,241,235,0.08)] text-sm font-semibold tracking-[0.2em] text-[var(--bg-ivory)]">
              B
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--greige)]">
                Braunwork
              </div>
              <div className="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--taupe)]">
                Builders Corporation
              </div>
            </div>
          </div>
          <p className="max-w-xs text-sm leading-6 text-[rgba(245,241,235,0.72)]">
            Built on Experience. Driven by Systems. Focused on Quality.
          </p>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--greige)]">
            Navigate
          </h3>
          <ul className="space-y-3 text-sm text-[rgba(245,241,235,0.72)]">
            <li><a href="#home" className="hover:text-[var(--bg-ivory)]">Home</a></li>
            <li><a href="#about" className="hover:text-[var(--bg-ivory)]">About</a></li>
            <li><a href="#services" className="hover:text-[var(--bg-ivory)]">Services</a></li>
            <li><a href="#process" className="hover:text-[var(--bg-ivory)]">Process</a></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--greige)]">
            Company
          </h3>
          <ul className="space-y-3 text-sm text-[rgba(245,241,235,0.72)]">
            <li><a href="#projects" className="hover:text-[var(--bg-ivory)]">Projects</a></li>
            <li><a href="#reviews" className="hover:text-[var(--bg-ivory)]">Reviews</a></li>
            <li><a href="#contact" className="hover:text-[var(--bg-ivory)]">Contact</a></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--greige)]">
            Location
          </h3>
          <p className="text-sm leading-6 text-[rgba(245,241,235,0.72)]">
            Dasmariñas City, Cavite, Philippines
          </p>
        </div>
      </div>

      <div className="border-t border-[rgba(245,241,235,0.12)]">
        <div className="container-shell flex flex-col gap-3 py-5 text-xs uppercase tracking-[0.14em] text-[rgba(245,241,235,0.7)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Braunwork Builders Corporation</p>
          <p>Built on Experience. Driven by Systems.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
