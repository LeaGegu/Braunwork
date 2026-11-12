import SectionHeader from '../components/SectionHeader.jsx'

const products = [
	{
		name: 'Residential Construction',
		category: 'Built Projects',
		description:
			'Practical residential work shaped around long-term durability, comfort, and real everyday use.',
	},
	{
		name: 'Modular Cabinetry',
		category: 'Interior Solutions',
		description:
			'Custom-fit cabinetry and organized storage solutions designed for function and visual calm.',
	},
	{
		name: 'Renovation & Fit-Outs',
		category: 'Upgrades',
		description:
			'Thoughtful transformations for homes and spaces needing efficient, long-lasting improvements.',
	},
]

function Products() {
	return (
		<div id="products">
			<section className="border-b border-[var(--line)] bg-[var(--bg-warm)]">
				<div className="container-shell grid items-center gap-10 py-16 lg:grid-cols-[1fr_1fr] lg:py-24">
					<div>
						<p className="eyebrow mb-5">Products</p>
						<h1 className="max-w-xl text-4xl font-semibold tracking-[-0.06em] text-[var(--charcoal)] sm:text-5xl lg:text-6xl">
							Solutions designed around everyday living.
						</h1>
						<p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">
							Braunwork’s work focuses on residential construction, interior fit-outs,
							storage solutions, and renovation projects that improve function and quality
							of life.
						</p>
						<div className="mt-8 flex flex-col gap-4 sm:flex-row">
							<a href="#contact" className="btn-primary">
								Inquire About Products
							</a>
							<a href="#services" className="btn-secondary">
								Explore Services
							</a>
						</div>
					</div>

					<div className="overflow-hidden border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-soft)]">
						<div className="h-[440px] bg-[linear-gradient(145deg,#d8d0c7,#8d7368)] p-5">
							<div className="flex h-full items-end border border-[rgba(255,255,255,0.35)] bg-[rgba(39,37,34,0.14)] p-6">
								<p className="text-xs uppercase tracking-[0.2em] text-[var(--bg-ivory)]">
									Built for real life
								</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section className="section-shell">
				<div className="container-shell">
					<SectionHeader
						eyebrow="Offerings"
						title="The areas Braunwork focuses on."
						description="These categories reflect the company’s known construction and interior capabilities and align with the official Braunwork profile."
						align="center"
					/>

					<div className="mt-12 grid gap-6 md:grid-cols-3">
						{products.map((product) => (
							<article
								key={product.name}
								className="overflow-hidden border border-[var(--line)] bg-[var(--panel)]"
							>
								<div className="h-56 bg-[linear-gradient(135deg,#efe7df,#bca796)] p-5">
									<div className="flex h-full items-end border border-[rgba(255,255,255,0.35)] bg-[rgba(39,37,34,0.12)] p-4">
										<span className="text-[0.65rem] uppercase tracking-[0.22em] text-[var(--bg-ivory)]">
											{product.category}
										</span>
									</div>
								</div>

								<div className="space-y-4 p-6">
									<h3 className="text-2xl font-medium tracking-[-0.04em] text-[var(--charcoal)]">
										{product.name}
									</h3>
									<p className="text-base leading-7 text-[var(--muted)]">
										{product.description}
									</p>
									<a
										href="#contact"
										className="inline-flex text-sm font-medium uppercase tracking-[0.14em] text-[var(--brown)] hover:text-[var(--charcoal)]"
									>
										Inquire
									</a>
								</div>
							</article>
						))}
					</div>
				</div>
			</section>

			<section
				id="contact"
				className="border-t border-[var(--line)] bg-[var(--bg-warm)]"
			>
				<div className="container-shell section-shell">
					<div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
						<div className="max-w-2xl">
							<p className="eyebrow mb-4">Product Inquiry</p>
							<h2 className="section-title">
								Need a tailored solution for your space?
							</h2>
						</div>
						<a href="#contact" className="btn-primary">
							Contact Braunwork
						</a>
					</div>
				</div>
			</section>
		</div>
	)
}

export default Products
