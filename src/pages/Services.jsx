const services = [
	{
		title: 'Residential Construction',
		description: 'Complete residential construction and practical building solutions.',
	},
	{
		title: 'Modular Cabinetry',
		description: 'Custom modular cabinetry, built-in storage, and functional interior solutions.',
	},
	{
		title: 'Renovation & Interior Fit-Outs',
		description: 'Small-scale renovations, interior improvements, and fit-out solutions.',
	},
]

function Services() {
	return (
		<section id="services" className="section-shell border-b border-[var(--line)] bg-[var(--bg-warm)]">
			<div className="container-shell">
				<div className="mb-12 max-w-3xl">
					<p className="eyebrow mb-4">Services & Solutions</p>
					<h2 className="section-title">What Braunwork can do for your space.</h2>
				</div>

				<div className="grid gap-6 md:grid-cols-3">
					{services.map((service, index) => (
						<article
							key={service.title}
							className="reveal-card border border-[var(--line)] bg-[var(--panel)] p-7 shadow-[var(--shadow-soft)]"
							style={{ animationDelay: `${index * 120}ms` }}
						>
							<div className="mb-6 h-12 w-12 border border-[var(--charcoal)] bg-[var(--panel-strong)]" aria-hidden="true" />
							<h3 className="mb-4 text-2xl font-medium tracking-[-0.04em] text-[var(--charcoal)]">
								{service.title}
							</h3>
							<p className="text-base leading-7 text-[var(--muted)]">{service.description}</p>
							<a
								href="#contact"
								className="mt-6 inline-flex text-sm font-medium uppercase tracking-[0.14em] text-[var(--brown)] hover:text-[var(--charcoal)]"
							>
								Inquire
							</a>
						</article>
					))}
				</div>
			</div>
		</section>
	)
}

export default Services
