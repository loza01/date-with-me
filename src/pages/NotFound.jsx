import { Link } from 'react-router-dom'

/** Plain, generic 404. Also served for the hidden admin route. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 text-center font-sans text-neutral-800">
      <p className="text-7xl font-semibold tracking-tight text-neutral-300">404</p>
      <h1 className="mt-4 text-2xl font-semibold">Page Not Found</h1>
      <p className="mt-2 text-neutral-500">The page you are looking for doesn’t exist or has been moved.</p>
      <Link to="/" className="mt-8 rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">
        Go to homepage
      </Link>
    </div>
  )
}
