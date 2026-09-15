import { Link } from 'react-router-dom'
import { Shell } from '../components/Shell'
import { isDeviceBlocked } from '../lib/deviceBlock'

export default function Landing() {
  if (isDeviceBlocked()) {
    return (
      <Shell footer={false}>
        <section className="flex min-h-[70dvh] items-center justify-center text-center">
          <p className="font-serif text-2xl text-charcoal-400">This application is closed.</p>
        </section>
      </Shell>
    )
  }

  return (
    <Shell>
      <section className="flex min-h-[70dvh] flex-col items-center justify-center text-center">
        <p className="mb-6 text-xs font-medium tracking-[0.3em] text-rose-500 uppercase">By invitation of intent</p>
        <h1 className="font-serif text-5xl leading-[1.05] text-charcoal-900 sm:text-7xl">
          The Chosen <em className="text-rose-600">Path</em>
        </h1>
        <div className="my-8 h-px w-16 bg-rose-300" />
        <p className="max-w-md text-lg leading-relaxed text-charcoal-500">
          This is a private and highly selective process, open to straight men only. Every application is read
          personally, and only those whose values, faith and future align will hear back.
        </p>
        <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
          <Link to="/signup" className="btn-primary">
            Apply Now
          </Link>
          <Link to="/login" className="btn-secondary">
            Continue Application
          </Link>
        </div>
      </section>
    </Shell>
  )
}
