
const storyPoints = [
	{
		title: 'Our Story',
		description:
			'Founded by Harley Julian on July 12, 2019, Braunwork began as a construction company, building its foundation through hands-on experience, craftsmanship, and a commitment to quality.',
	},
	{
		title: 'Expanding Our Capabilities',
		description:
			'As the industry evolved during the pandemic, the company expanded into modular cabinetry and built-in solutions. Over the years, it refined its production systems, fabrication processes, and quality standards.',
	},
	{
		title: 'Building the Next Chapter',
		description:
			'With experience in design, fabrication, and construction, Braunwork now offers modular cabinetry, interior fit-outs, renovations, and complete residential construction.',
	},
]

const coreValues = [
	{
		title: 'Quality',
		description:
			'We aim to deliver work that reflects care, consistency, and attention to detail.',
	},
	{
		title: 'Integrity',
		description:
			'We value honesty, accountability, and doing what is right in every project.',
	},
	{
		title: 'Craftsmanship',
		description:
			'We take pride in the skill, effort, and precision behind the work we do.',
	},
	{
		title: 'Continuous Improvement',
		description:
			'We keep learning, refining our processes, and finding better ways to work.',
	},
]

function About() {
	return (
		<section id="about" className="section-shell border-b border-[var(--line)] bg-[var(--bg-warm)]">
			<div className="container-shell">
				{/* Introduction */}
				<div className="mb-12 max-w-3xl">
					<p className="eyebrow mb-4">About / Our Story</p>
					<h2 className="section-title">
						Built on Experience. Driven by Systems. Focused on Quality.
					</h2>
				</div>

				{/* Company Story */}
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
						<p className="eyebrow mb-4">Our Commitment</p>
						<h3 className="section-title">Adapt, improve, and build better.</h3>

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

				{/* Vision and Mission */}
				<div className="mt-20 grid gap-6 md:grid-cols-2">
					<article className="border border-[var(--line)] bg-[var(--panel)] p-8 sm:p-10">
						<p className="eyebrow mb-4">Where We Want to Go</p>
						<h3 className="mb-5 text-3xl font-medium tracking-[-0.05em] text-[var(--charcoal)]">
							Our Vision
						</h3>
						<p className="body-copy">
							To be a trusted name in construction and interior solutions,
							recognized for quality workmanship, thoughtful design, and
							reliable project delivery.
						</p>
					</article>

					<article className="border border-[var(--line)] bg-[var(--panel)] p-8 sm:p-10">
						<p className="eyebrow mb-4">What Guides Our Work</p>
						<h3 className="mb-5 text-3xl font-medium tracking-[-0.05em] text-[var(--charcoal)]">
							Our Mission
						</h3>
						<p className="body-copy">
							To provide practical and well-crafted construction and interior
							solutions through skilled workmanship, organized processes,
							and a commitment to customer satisfaction.
						</p>
					</article>
				</div>

				{/* Core Values */}
				<div className="mt-20">
					<div className="mb-8 max-w-2xl">
						<p className="eyebrow mb-4">What We Stand For</p>
						<h3 className="text-3xl font-medium tracking-[-0.05em] text-[var(--charcoal)]">
							Our Core Values
						</h3>
					</div>

					<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
						{coreValues.map((value, index) => (
							<article
								key={value.title}
								className="border border-[var(--line)] bg-[var(--panel)] p-6"
							>
								<p className="mb-5 text-xs tracking-[0.16em] text-[var(--brown)]">
									{String(index + 1).padStart(2, '0')}
								</p>
								<h4 className="mb-3 text-xl font-medium text-[var(--charcoal)]">
									{value.title}
								</h4>
								<p className="text-sm leading-7 text-[var(--muted)]">
									{value.description}
								</p>
							</article>
						))}
					</div>
				</div>

				{/* Meet the Team */}
				<div className="mt-20">
					<div className="mb-8 max-w-2xl">
						<p className="eyebrow mb-4">The People Behind the Work</p>
						<h3 className="text-3xl font-medium tracking-[-0.05em] text-[var(--charcoal)]">
							Meet the Team
						</h3>
						<p className="mt-4 body-copy">
							Every project is made possible by the people who bring
							experience, skill, and dedication to the work.
						</p>
					</div>

					<div className="flex min-h-[280px] items-center justify-center border border-dashed border-[var(--line)] bg-[var(--panel)] p-8 text-center sm:min-h-[380px]">
						<div>
							<p className="eyebrow mb-3">Team Photo</p>
							<p className="text-sm leading-7 text-[var(--muted)]">
								Your Braunwork team photo will be displayed here.
							</p>
							<p className="mt-2 text-xs text-[var(--muted)]">
								Photo can be uploaded through the admin dashboard later.
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

export default About
