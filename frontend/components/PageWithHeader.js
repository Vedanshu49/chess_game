import { useRouter } from 'next/router';
import NavBar from './NavBar';

export default function PageWithHeader({ user, title, children }) {
  const router = useRouter();

  return (
    <>
      <NavBar user={user} />
      <div className="container mx-auto p-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="btn mb-4"
        >
          &larr; Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold mb-4">{title}</h1>
        {children}
      </div>
    </>
  );
}
