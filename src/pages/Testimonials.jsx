
const reviews = [
  {
    author: 'Janice Bartolome',
    quote: '"I saw your work, ang ganda at polido! I will certainly refer to brownworks to my friends! I am so happy and thank you again!"',
  },
  {
    author: 'Patricia Mae Tamayo',
    quote:
      '"I\'m so happy with the FEEL, MOOD, and TONE of my condo. I love my kitchen, dresser, TV console, closet, shoe rack, bed, and bathroom storage — everything I wanted was achieved!\n\nIt\'s the little details that made my heart smile. Thank you for making my new home feel so special and for turning what I envisioned into reality. We are forever grateful that you were the contractor for this project!"',
  },
  {
    author: 'Van Damme',
    quote: '"Sooo good!✨"',
  },
  {
    author: 'Il_lusso',
    quote:
      '"Seeing all the details finally come together makes me appreciate the work of braunwork even more. Grabe, sobrang pulido! Every little request - from the vault, lighting, storage, down to the colors - was thoughtfully executed. They really paid attention to every detail and brought my vision to life. I can\'t wait to show you the finished space."',
  },
]

const notableMentions = [
  {
    author: 'Joycepring',
    quote: '"😍🙌"',
  },
  {
    author: 'Alex Gonzaga',
    quote:
      '"Sobrang good din sila, sobrang bait ng owner and then sobra din yung after service nila, pag meron kang problema nagpapapunta kaagad sila ng mga staff, thank you so much brownwork for giving me the best deal and discount"',
  },
]

function Testimonials() {
  return (
    <section id="reviews" className="section-shell border-b border-[var(--line)] bg-[var(--bg-warm)]">
      <div className="container-shell">
        <div className="mb-12 max-w-3xl">
          <p className="eyebrow mb-4">Reviews / Client Feedback</p>
          <h2 className="section-title">
            What clients say about Braunwork.
          </h2>
          <p className="mt-5 body-copy">
            The experiences and feedback shared by clients reflect the care
            and attention that go into every project.
          </p>
        </div>

        <div className="mb-14">
          <div className="mb-6">
            <p className="eyebrow">Client Reviews</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {reviews.map((review, index) => (
              <article
                key={review.author}
                className="reveal-card flex flex-col border border-[var(--line)] bg-[var(--panel)] p-7 shadow-[var(--shadow-soft)] sm:p-8"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="mb-5 flex h-10 w-10 items-center justify-center border border-[var(--charcoal)] bg-[var(--charcoal)] text-xl text-[var(--bg-ivory)]">
                  “
                </div>

                <p className="flex-1 whitespace-pre-line text-base leading-8 text-[var(--charcoal)]">
                  {review.quote}
                </p>

                <p className="mt-7 border-t border-[var(--line)] pt-5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--brown)]">
                  {review.author}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--line)] pt-12">
          <div className="mb-6">
            <p className="eyebrow">Notable Mentions</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {notableMentions.map((mention, index) => (
              <article
                key={mention.author}
                className="reveal-card flex flex-col border border-[var(--line)] bg-[var(--panel)] p-7 shadow-[var(--shadow-soft)] sm:p-8"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <p className="flex-1 whitespace-pre-line text-base leading-8 text-[var(--charcoal)]">
                  {mention.quote}
                </p>

                <p className="mt-7 border-t border-[var(--line)] pt-5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--brown)]">
                  {mention.author}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Testimonials
