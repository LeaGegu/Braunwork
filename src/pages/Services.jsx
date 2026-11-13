
const productCategories = [
	{
		title: 'Modular Kitchen',
		description: 'Custom-designed kitchen cabinets and storage solutions made to fit your space.',
	},
	{
		title: 'Closet',
		description: 'Functional and customized closet systems designed for organized living.',
	},
	{
		title: 'Vanity',
		description: 'Custom vanity cabinets that combine practical storage and clean design.',
	},
	{
		title: 'Entertainment Cabinet',
		description: 'Built-in entertainment units designed to complement your interior.',
	},
	{
		title: 'Countertops',
		description: 'Countertop solutions available in solid surface and quartz materials.',
	},
	{
		title: 'Official / Store Installations',
		description: 'Installation solutions for official stores and commercial spaces.',
	},
]

const materialCategories = [
	{
		title: 'System Door Fronts',
		items: [
			'Melamine-faced marine plywood laminate',
			'Glass doors',
			'Lacquered doors (automotive paint)',
			'Aluminum-framed glass doors',
			'Solid wood doors',
		],
	},
	{
		title: 'Cabinet Carcass',
		items: [
			'Melamine marine plywood',
			'High-moisture-resistant material for kitchen durability',
		],
	},
	{
		title: 'Countertop Materials',
		items: [
			'Solid surface',
			'Quartz',
		],
	},
	{
		title: 'Hardware & Accessories',
		items: [
			'Blum German-brand hinges and drawer systems',
			'Wall fixing units',
			'Plinth',
		],
	},
]

const otherServices = [
	'Interior Design',
	'Renovation',
	'Interior Fit-out',
	'2D & 3D Design Layout and Visualization',
]

function Services() {
	return (
		<section id="services" className="section-shell border-b border-[var(--line)] bg-[var(--bg-warm)]">
			<div className="container-shell">
				<div className="mb-14 max-w-3xl">
					<p className="eyebrow mb-4">Services & Solutions</p>
					<h2 className="section-title">Thoughtful solutions for every space.</h2>
					<p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">
						From custom cabinetry and carefully selected materials to interior
						design and renovation, Braunwork provides practical solutions
						built around your space and needs.
					</p>
				</div>

				{/* Products */}
				<div className="mb-20">
					<div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
						<div>
							<p className="eyebrow mb-3">01 / What We Make</p>
							<h3 className="text-3xl font-medium tracking-[-0.05em] text-[var(--charcoal)]">
								Our Products
							</h3>
						</div>
						<p className="max-w-md text-sm leading-6 text-[var(--muted)]">
							Custom cabinetry and built-in solutions designed for
							functionality, quality, and everyday living.
						</p>
					</div>

					<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
						{productCategories.map((product, index) => (
							<article
								key={product.title}
								className="reveal-card border border-[var(--line)] bg-[var(--panel)] p-7 shadow-[var(--shadow-soft)]"
								style={{ animationDelay: `${index * 100}ms` }}
							>
								<p className="mb-5 text-xs tracking-[0.16em] text-[var(--brown)]">
									{String(index + 1).padStart(2, '0')}
								</p>
								<h4 className="mb-3 text-xl font-medium tracking-[-0.04em] text-[var(--charcoal)]">
									{product.title}
								</h4>
								<p className="text-sm leading-7 text-[var(--muted)]">
									{product.description}
								</p>
								<a
									href="#contact"
									className="mt-6 inline-flex text-xs font-medium uppercase tracking-[0.14em] text-[var(--brown)] hover:text-[var(--charcoal)]"
								>
									Inquire
								</a>
							</article>
						))}
					</div>
				</div>

				{/* Materials and Specifications */}
				<div className="mb-20 border-t border-[var(--line)] pt-14">
					<div className="mb-8">
						<p className="eyebrow mb-3">02 / What Goes Into Our Work</p>
						<h3 className="text-3xl font-medium tracking-[-0.05em] text-[var(--charcoal)]">
							Materials & Specifications
						</h3>
						<p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
							Explore the materials, finishes, and hardware options used
							in our cabinetry and interior solutions.
						</p>
					</div>

					<div className="grid gap-5 sm:grid-cols-2">
						{materialCategories.map((category, index) => (
							<article
								key={category.title}
								className="border border-[var(--line)] bg-[var(--panel)] p-7"
							>
								<p className="mb-4 text-xs tracking-[0.16em] text-[var(--brown)]">
									{String(index + 1).padStart(2, '0')}
								</p>
								<h4 className="mb-5 text-xl font-medium tracking-[-0.04em] text-[var(--charcoal)]">
									{category.title}
								</h4>
								<ul className="space-y-3">
									{category.items.map((item) => (
										<li
											key={item}
											className="flex gap-3 text-sm leading-6 text-[var(--muted)]"
										>
											<span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brown)]" />
											{item}
										</li>
									))}
								</ul>
							</article>
						))}
					</div>
				</div>

				{/* Other Services */}
				<div className="border-t border-[var(--line)] pt-14">
					<div className="mb-8">
						<p className="eyebrow mb-3">03 / Additional Solutions</p>
						<h3 className="text-3xl font-medium tracking-[-0.05em] text-[var(--charcoal)]">
							Other Services
						</h3>
					</div>

					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{otherServices.map((service) => (
							<div
								key={service}
								className="border border-[var(--line)] bg-[var(--panel)] p-6"
							>
								<h4 className="text-base font-medium leading-7 text-[var(--charcoal)]">
									{service}
								</h4>
							</div>
						))}
					</div>
				</div>

				<div className="mt-14 border border-[var(--line)] bg-[var(--panel-strong)] p-8 sm:p-10">
					<div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
						<div>
							<p className="eyebrow mb-3">Have a project in mind?</p>
							<h3 className="text-2xl font-medium tracking-[-0.04em] text-[var(--charcoal)]">
								Let's discuss your space.
							</h3>
						</div>
						<a href="#contact" className="btn-primary w-fit">
							Get in Touch
						</a>
					</div>
				</div>
			</div>
		</section>
	)
}

export default Services
