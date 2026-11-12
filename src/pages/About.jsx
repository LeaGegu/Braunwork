const storyPoints = [
	{
		title: 'Our Story',
		description:
			'Founded by Harley Julian on July 12, 2019, Braunwork began as a construction company, building its foundation through hands-on experience, craftsmanship, and a commitment to quality.',
	},
	{
		title: 'Expanding Our Capabilities',
		description:
			'As the industry evolved during the pandemic, the company expanded into modular cabinetry and built-in solutions. Over six years, it refined its production systems, fabrication processes, and quality standards.',
	},
	{
		title: 'Building the Next Chapter',
		description:
			'With experience in design, fabrication, and construction, Braunwork now offers modular cabinetry, interior fit-outs, small-scale renovations, and complete residential construction from the ground up.',
	},
]

function About() {
	return (
		<section id="about" className="section-shell border-b border-[var(--line)] bg-[var(--bg-warm)]">
			<div className="container-shell">
				<div className="mb-12 max-w-3xl">
					<p className="eyebrow mb-4">About / Our Story</p>
					<h2 className="section-title">
						Built on Experience. Driven by Systems. Focused on Quality.
					</h2>
				</div>

				<div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
					<div className="space-y-6">
						{storyPoints.map((point, index) => (
							<article
								key={point.title}
								className="reveal-card border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-7"
								style={{ animationDelay: `${index * 120}ms` }}
							>
								<p className="eyebrow mb-3">{point.title}</p>
								<p className="body-copy">{point.description}</p>
							</article>
						))}
					</div>

					<div className="border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8 shadow-[var(--shadow-soft)]">
						<div className="max-w-2xl text-left">
							<p className="eyebrow mb-4">Our Commitment</p>
							<h2 className="section-title">Adapt, improve, and build better.</h2>
							<p className="mt-5 body-copy">
								Our commitment remains the same: adapt, improve, and build better.
							</p>
						</div>

						<div className="mt-8 space-y-5 text-base leading-7 text-[var(--muted)]">
							<p>
								From the start, Braunwork has approached every project with a
								practical understanding of how spaces need to function in real life.
							</p>
							<p>
								That same philosophy guides the company today as it continues to
								deliver thoughtful construction, cabinetry, and interior improvements
								with consistency and care.
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

export default About
